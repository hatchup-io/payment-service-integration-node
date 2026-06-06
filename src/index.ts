/**
 * Public entry for `@hatchup-io/payment-service-integration`.
 *
 * M1.b.1 — config + exceptions + transport + the core checkout+lookup
 * resource surface (payments, verify, transactions, customers) + the
 * `PaymentServiceClient` facade. Catalog / paymentIntents / setupIntents /
 * subscriptions / webhookEndpoints land in M1.b.2; webhook parser +
 * dispatcher in M1.c.
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

// Client facade
export { PaymentServiceClient } from "./client.js";

// Resource classes (publicly accessible via the client; exported for type
// imports and for advanced consumers who wire their own transports).
export { PaymentsResource } from "./resources/payments.js";
export { VerifyResource } from "./resources/verify.js";
export { TransactionsResource } from "./resources/transactions.js";
export { CustomersResource } from "./resources/customers.js";

// Models — envelope + payment + verify + transaction + customer
export { ApiEnvelopeSchema, ApiEnvelopeStatusSchema } from "./models/envelope.js";
export type { ApiEnvelope, ApiEnvelopeStatus } from "./models/envelope.js";

export {
  CheckoutSessionVerifyResponseSchema,
  PaymentCreateResponseSchema,
  PaymentTypeSchema,
  RefundResponseSchema,
  toPaymentCreateWireBody,
  toRefundWireBody,
  toRepaymentWireBody,
} from "./models/payment.js";
export type {
  CheckoutSessionVerifyResponse,
  PaymentCreateInput,
  PaymentCreateResponse,
  PaymentType,
  RefundInput,
  RefundResponse,
  RepaymentInput,
} from "./models/payment.js";

export { VerifyResponseSchema, toVerifyWireBody } from "./models/verify.js";
export type { VerifyInput, VerifyResponse } from "./models/verify.js";

export {
  TransactionPageSchema,
  TransactionSchema,
  TransactionStatusSchema,
  toTransactionListQuery,
} from "./models/transaction.js";
export type {
  Transaction,
  TransactionListFilters,
  TransactionPage,
  TransactionStatus,
} from "./models/transaction.js";

export {
  CustomerListPageSchema,
  CustomerPortalSessionSchema,
  CustomerSchema,
  PaymentMethodCardSchema,
  PaymentMethodListSchema,
  PaymentMethodSchema,
  toCustomerCreateWireBody,
  toCustomerListQuery,
  toCustomerPortalSessionWireBody,
  toCustomerUpdateWireBody,
} from "./models/customer.js";
export type {
  Customer,
  CustomerCreateInput,
  CustomerListInput,
  CustomerListPage,
  CustomerPortalSession,
  CustomerPortalSessionInput,
  CustomerUpdateInput,
  PaymentMethod,
  PaymentMethodCard,
  PaymentMethodList,
} from "./models/customer.js";
