/**
 * HTTP transport for the Hatchup Payment Service SDK.
 *
 * Centralizes:
 * - header construction (`Authorization`, `User-Agent`, `Idempotency-Key`)
 * - envelope decoding (`{data, status, message}`)
 * - HTTP-status → exception classification
 * - bounded retries on transient server errors
 *
 * Async-only — Node is single-threaded and naturally async, so the Python
 * SDK's `Transport` / `AsyncTransport` split collapses into a single class
 * here. Resource classes never call `fetch` directly; they go through
 * `request()` so error handling stays in one place.
 */

import type { PSIPConfig } from "./config.js";
import {
  PSIPAPIError,
  PSIPAuthError,
  PSIPNetworkError,
  PSIPNotFoundError,
  PSIPProtocolError,
  PSIPServerError,
  PSIPValidationError,
} from "./exceptions.js";

const REQUEST_ID_HEADER = "X-Request-ID";
const IDEMPOTENCY_HEADER = "Idempotency-Key";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type QueryParamValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  /** Body to JSON-encode. Omit for GET/DELETE-style requests. */
  json?: unknown;
  /** Query-string params. Undefined / null values are stripped. */
  params?: Record<string, QueryParamValue>;
  /**
   * Idempotency key to send on a mutating request. If omitted on a
   * POST/PUT/PATCH/DELETE, a UUID4 is generated and reused across SDK-level
   * retries so the gateway treats them as one call.
   */
  idempotencyKey?: string;
}

/** Minimal shape of the SDK envelope used internally. */
interface ApiEnvelope {
  status?: unknown;
  message?: unknown;
  data?: unknown;
  [k: string]: unknown;
}

export class Transport {
  readonly config: PSIPConfig;
  readonly #fetch: typeof fetch;

  /**
   * @param config Parsed `PSIPConfig`.
   * @param fetchImpl Optional `fetch` override — primarily for tests that
   *   don't want to use MSW. Defaults to the global `fetch`.
   */
  constructor(config: PSIPConfig, fetchImpl?: typeof fetch) {
    this.config = config;
    this.#fetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Execute a request and return the envelope's `data` field.
   *
   * Throws one of:
   * - `PSIPNetworkError` if the request never reached the server (after
   *   retries).
   * - `PSIPProtocolError` if the response body is not a valid
   *   `{data, status, message}` envelope, or contradicts a 2xx status by
   *   saying `status: "failure"`.
   * - `PSIPAPIError` (one of its subclasses) on HTTP 4xx/5xx.
   */
  async request<T = Record<string, unknown>>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const upperMethod = method.toUpperCase();
    const url = buildUrl(this.config.baseUrl, path, options.params);
    const idempotencyHeader = buildIdempotencyHeader(upperMethod, options.idempotencyKey);
    const body = options.json !== undefined ? JSON.stringify(options.json) : undefined;
    const baseHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "User-Agent": this.config.userAgent,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(idempotencyHeader ?? {}),
    };

    const retry = this.config.retry;
    let lastNetworkError: unknown = null;

    for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
      let response: Response;
      try {
        response = await this.#fetch(url, {
          method: upperMethod,
          headers: baseHeaders,
          signal: AbortSignal.timeout(this.config.timeout * 1000),
          ...(body !== undefined ? { body } : {}),
        });
      } catch (err) {
        lastNetworkError = err;
        if (attempt < retry.maxRetries) {
          await sleep(retry.backoffFactor * 2 ** attempt * 1000);
          continue;
        }
        throw new PSIPNetworkError(
          `transport failure calling ${upperMethod} ${path}: ${formatError(err)}`,
          { cause: err },
        );
      }

      if (retry.retryOnStatus.includes(response.status) && attempt < retry.maxRetries) {
        await sleep(retry.backoffFactor * 2 ** attempt * 1000);
        continue;
      }

      return (await handleResponse(response)) as T;
    }

    // Unreachable: every iteration either returns, continues, or throws.
    // Kept as a defensive barrier in case the control flow is broken later.
    /* c8 ignore next 4 */
    throw new PSIPNetworkError(
      `transport failure calling ${upperMethod} ${path}: ${formatError(lastNetworkError)}`,
      lastNetworkError !== null ? { cause: lastNetworkError } : undefined,
    );
  }
}

// ----------------------------------------------------------------------- //
// Shared response / error helpers (exported for the contract tripwire +
// the M1 resource classes' own helpers).
// ----------------------------------------------------------------------- //

export async function handleResponse(response: Response): Promise<Record<string, unknown>> {
  const envelope = await decodeEnvelope(response);
  const requestId = response.headers.get(REQUEST_ID_HEADER);

  if (response.status >= 200 && response.status < 300) {
    if (envelope.status === "failure") {
      const msg = typeof envelope.message === "string" ? envelope.message : "";
      throw new PSIPProtocolError(
        `server returned 2xx with envelope status='failure': ${JSON.stringify(msg)}`,
      );
    }
    const data = envelope.data;
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      const got = data === null ? "null" : Array.isArray(data) ? "array" : typeof data;
      throw new PSIPProtocolError(`server returned 2xx with non-object 'data' field: ${got}`);
    }
    return data as Record<string, unknown>;
  }

  const message = String(envelope.message ?? response.statusText ?? "");
  throw classifyError({
    statusCode: response.status,
    message,
    raw: envelope,
    requestId,
  });
}

async function decodeEnvelope(response: Response): Promise<ApiEnvelope> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.status >= 200 && response.status < 300) {
      const ct = response.headers.get("content-type");
      throw new PSIPProtocolError(
        `non-JSON body on 2xx response (content-type=${JSON.stringify(ct)})`,
      );
    }
    return {};
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    if (response.status >= 200 && response.status < 300) {
      const got = body === null ? "null" : Array.isArray(body) ? "array" : typeof body;
      throw new PSIPProtocolError(`expected JSON object envelope, got ${got}`);
    }
    return {};
  }
  return body as ApiEnvelope;
}

interface ClassifyErrorOptions {
  statusCode: number;
  message: string;
  raw: Record<string, unknown>;
  requestId: string | null;
}

function classifyError(options: ClassifyErrorOptions): PSIPAPIError {
  const { statusCode } = options;
  if (statusCode === 401) return new PSIPAuthError(options);
  if (statusCode === 404) return new PSIPNotFoundError(options);
  if (statusCode >= 400 && statusCode < 500) return new PSIPValidationError(options);
  if (statusCode >= 500 && statusCode < 600) return new PSIPServerError(options);
  /* c8 ignore next */
  return new PSIPAPIError(options); // 1xx/3xx — unreachable via fetch
}

function buildUrl(baseUrl: string, path: string, params?: Record<string, QueryParamValue>): string {
  // `new URL(path, baseUrl)` resolves `path` against `baseUrl`. We require
  // `baseUrl` to end with "/" (enforced by the config schema) so this composes
  // cleanly with relative paths like "payments" or "transactions/abc".
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildIdempotencyHeader(
  upperMethod: string,
  idempotencyKey: string | undefined,
): Record<string, string> | null {
  if (!MUTATING_METHODS.has(upperMethod)) return null;
  return { [IDEMPOTENCY_HEADER]: idempotencyKey ?? crypto.randomUUID() };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
