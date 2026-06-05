/**
 * Exception hierarchy for the Hatchup Payment Service SDK.
 *
 * All errors raised by the SDK derive from {@link PSIPError}. Resource methods
 * never leak `fetch`-level errors directly — {@link Transport} classifies every
 * failure into one of the types below so callers can branch on a single
 * hierarchy.
 *
 * Mirrors the Python SDK's `hatchup_psip.exceptions` hierarchy. Subclass names
 * and semantics match across both SDKs.
 */

export class PSIPError extends Error {
  override name = "PSIPError";

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    // Ensure `instanceof` works correctly when transpiled.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Underlying transport failed before a response was received.
 *
 * Wraps the cause (a `TypeError` from `fetch`, an `AbortError` from a timeout,
 * a DNS failure, a socket reset). Retries have already been exhausted by the
 * time this is raised.
 */
export class PSIPNetworkError extends PSIPError {
  override name = "PSIPNetworkError";

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * The server response or webhook payload did not match the documented shape.
 *
 * Raised when:
 * - HTTP status is 2xx but the body is not valid JSON, or doesn't contain
 *   the `{data, status, message}` envelope.
 * - HTTP status is 2xx but the envelope's `status` is `"failure"` — the
 *   server is contradicting itself and the SDK refuses to guess.
 * - A webhook payload fails schema validation.
 */
export class PSIPProtocolError extends PSIPError {
  override name = "PSIPProtocolError";

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface PSIPAPIErrorOptions {
  statusCode: number;
  message: string;
  raw?: Record<string, unknown>;
  requestId?: string | null;
  cause?: unknown;
}

/**
 * The server returned a documented error response (HTTP 4xx/5xx, envelope
 * `status: "failure"`).
 *
 * The HTTP status code drives which subclass is raised. Always carries
 * `statusCode`, `message` (the server's human-readable string), the raw
 * envelope as `raw`, and `requestId` if the server emits one (today it
 * doesn't — value is `null`).
 */
export class PSIPAPIError extends PSIPError {
  override name = "PSIPAPIError";
  readonly statusCode: number;
  readonly raw: Record<string, unknown>;
  readonly requestId: string | null;

  constructor(options: PSIPAPIErrorOptions) {
    super(`[${options.statusCode}] ${options.message}`, { cause: options.cause });
    this.statusCode = options.statusCode;
    this.raw = options.raw ?? {};
    this.requestId = options.requestId ?? null;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 401 — API key missing, invalid, inactive, or IP-restricted. */
export class PSIPAuthError extends PSIPAPIError {
  override name = "PSIPAuthError";

  constructor(options: PSIPAPIErrorOptions) {
    super(options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 400 — request body or query params failed server-side validation. */
export class PSIPValidationError extends PSIPAPIError {
  override name = "PSIPValidationError";

  constructor(options: PSIPAPIErrorOptions) {
    super(options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 404 — the requested resource (transaction, order_id, …) does not exist. */
export class PSIPNotFoundError extends PSIPAPIError {
  override name = "PSIPNotFoundError";

  constructor(options: PSIPAPIErrorOptions) {
    super(options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 5xx — the payment-system or upstream Stripe failed unexpectedly. */
export class PSIPServerError extends PSIPAPIError {
  override name = "PSIPServerError";

  constructor(options: PSIPAPIErrorOptions) {
    super(options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * The inbound webhook body wasn't valid JSON or didn't match the documented
 * event shape.
 */
export class PSIPWebhookValidationError extends PSIPProtocolError {
  override name = "PSIPWebhookValidationError";

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Server roundtrip refused to confirm the webhook payload.
 *
 * Raised by {@link WebhookDispatcher} (with `verify: true`) when
 * `client.webhooks.verifyEvent` finds that the server's record of the
 * transaction is missing or differs from what the webhook claimed
 * (mismatched `orderId`, `amount`, `currency`, or `status`).
 *
 * Treat this exception as "do not trust this payload" — never let user
 * handlers run after it's raised. The payment-system does not
 * cryptographically sign outbound webhooks today (for the legacy per-row
 * webhooks), so this round-trip is the SDK's only forgery defence for that
 * path.
 */
export class PSIPWebhookForgeryError extends PSIPProtocolError {
  override name = "PSIPWebhookForgeryError";

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
