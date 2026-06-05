/**
 * Public entry for `@hatchup-io/payment-service-integration`.
 *
 * M1.a — config + exceptions + transport are shipped. Resource classes +
 * webhook handling land in M1.b / M1.c per the Node SDK plan in the sibling
 * Python repo's `docs/NODE_SDK_PLAN.md`.
 */

export { VERSION } from "./_version.js";

// Config + retry policy
export {
  DEFAULT_BASE_URL,
  ENV_PREFIX_DEFAULT,
  PSIPConfigSchema,
  RetryPolicySchema,
  configFromEnv,
} from "./config.js";
export type { PSIPConfig, PSIPConfigInput, RetryPolicy } from "./config.js";

// Exception hierarchy
export {
  PSIPAPIError,
  PSIPAuthError,
  PSIPError,
  PSIPNetworkError,
  PSIPNotFoundError,
  PSIPProtocolError,
  PSIPServerError,
  PSIPValidationError,
  PSIPWebhookForgeryError,
  PSIPWebhookValidationError,
} from "./exceptions.js";
export type { PSIPAPIErrorOptions } from "./exceptions.js";

// Transport
export { Transport } from "./transport.js";
export type { QueryParamValue, RequestOptions } from "./transport.js";
