/**
 * Runtime configuration for the Hatchup Payment Service SDK.
 *
 * Mirrors the Python SDK's `hatchup_psip.config.PSIPConfig` shape. Field names
 * are camelCase on the TS side (snake_case on the wire — see `configFromEnv`
 * env-var names below, which match Python's `PSIP_*`).
 */

import { z } from "zod";
import { VERSION } from "./_version.js";

export const DEFAULT_BASE_URL = "https://payments.hatchup.io/api/v1/";
export const ENV_PREFIX_DEFAULT = "PSIP_";

const defaultUserAgent = (): string => `hatchup-psip/${VERSION} (api=v1, runtime=node)`;

/**
 * Retry configuration for transient server errors.
 *
 * Only retries on the listed status codes. 4xx is never retried — it's
 * deterministic. Network errors are retried using the same policy.
 */
export const RetryPolicySchema = z
  .object({
    maxRetries: z.number().int().min(0).max(10).default(2),
    backoffFactor: z.number().min(0).default(0.5),
    retryOnStatus: z.array(z.number().int()).default([502, 503, 504]),
  })
  .strict();

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/**
 * Connection settings for a `PaymentServiceClient` instance.
 *
 * Construction precedence:
 * 1. Explicit fields passed to `PSIPConfigSchema.parse(...)` always win.
 * 2. `configFromEnv()` reads `PSIP_*` environment variables.
 *
 * There is intentionally no module-level singleton: multi-tenant consumers
 * (e.g. launchpad-backend, where each Project has its own API key) need a
 * config per tenant.
 *
 * `apiKey` is held as a plain string — there is no native `SecretStr`
 * equivalent in JS. Do not log the config object verbatim in production;
 * if you need a safe representation, project the fields you need explicitly.
 */
export const PSIPConfigSchema = z
  .object({
    apiKey: z
      .string()
      .trim()
      .refine((v) => v.length >= 8, "apiKey looks too short to be valid")
      .refine(
        (v) => v.startsWith("hp_"),
        "apiKey must start with 'hp_' (payment-system convention)",
      ),
    baseUrl: z
      .string()
      .refine(
        (v) => v.startsWith("http://") || v.startsWith("https://"),
        "baseUrl must start with http:// or https://",
      )
      .transform((v) => (v.endsWith("/") ? v : `${v}/`))
      .default(DEFAULT_BASE_URL),
    timeout: z.number().positive().default(10.0),
    defaultSandbox: z.boolean().default(true),
    userAgent: z.string().trim().min(1, "userAgent must not be empty").default(defaultUserAgent),
    retry: RetryPolicySchema.default({}),
  })
  .strict();

export type PSIPConfig = z.infer<typeof PSIPConfigSchema>;
export type PSIPConfigInput = z.input<typeof PSIPConfigSchema>;

/**
 * Parse a `PSIPConfig` from environment variables, with optional overrides.
 *
 * Reads `{prefix}API_KEY`, `{prefix}BASE_URL`, `{prefix}TIMEOUT`, and
 * `{prefix}DEFAULT_SANDBOX` (the same set the Python SDK reads). Explicit
 * fields in `overrides` take precedence over env values.
 */
export function configFromEnv(
  options: { prefix?: string } & Partial<PSIPConfigInput> = {},
): PSIPConfig {
  const { prefix = ENV_PREFIX_DEFAULT, ...overrides } = options;
  const env: Partial<PSIPConfigInput> = {};

  const apiKey = process.env[`${prefix}API_KEY`];
  if (apiKey !== undefined) env.apiKey = apiKey;

  const baseUrl = process.env[`${prefix}BASE_URL`];
  if (baseUrl !== undefined) env.baseUrl = baseUrl;

  const timeout = process.env[`${prefix}TIMEOUT`];
  if (timeout !== undefined) {
    const parsed = Number.parseFloat(timeout);
    if (Number.isNaN(parsed)) {
      throw new TypeError(`${prefix}TIMEOUT must be a number, got ${JSON.stringify(timeout)}`);
    }
    env.timeout = parsed;
  }

  const defaultSandbox = process.env[`${prefix}DEFAULT_SANDBOX`];
  if (defaultSandbox !== undefined) {
    env.defaultSandbox = ["1", "true", "yes", "on"].includes(defaultSandbox.trim().toLowerCase());
  }

  return PSIPConfigSchema.parse({ ...env, ...overrides });
}
