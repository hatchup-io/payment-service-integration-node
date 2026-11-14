/**
 * Public entry for `@hatchup-io/payment-service-integration`.
 *
 * M1.b.2 — full 11-resource parity matrix is now in place. Webhook
 * parsing + dispatcher land in M1.c.
 */

export { VERSION } from "./_version.js";
// Client facade
export { PaymentServiceClient } from "./client.js";
export type { PSIPConfig, PSIPConfigInput, RetryPolicy } from "./config.js";
// Config + retry policy
export {
  configFromEnv,
  DEFAULT_BASE_URL,
  ENV_PREFIX_DEFAULT,
  PSIPConfigSchema,
  RetryPolicySchema,
} from "./config.js";
export type { PSIPAPIErrorOptions } from "./exceptions.js";
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
export type {
  Price,
  PriceCreateInput,
  PriceListInput,
  PricePage,
  Product,
  ProductCreateInput,
  ProductListInput,
  ProductPage,
  ProductUpdateInput,
  RecurringInterval,
  RecurringPrice,
} from "./models/catalog.js";
export {
  PricePageSchema,
  PriceSchema,
  ProductPageSchema,
  ProductSchema,
  RecurringIntervalSchema,
  RecurringPriceSchema,
  toPriceCreateWireBody,
  toPriceListQuery,
  toProductCreateWireBody,
  toProductListQuery,
  toProductUpdateWireBody,
} from "./models/catalog.js";
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
export type { ApiEnvelope, ApiEnvelopeStatus } from "./models/envelope.js";
// Models — envelope + payment + verify + transaction + customer
export { ApiEnvelopeSchema, ApiEnvelopeStatusSchema } from "./models/envelope.js";
export type {
  CheckoutSessionVerifyResponse,
  PaymentCreateInput,
  PaymentCreateResponse,
  PaymentType,
  RefundInput,
  RefundResponse,
  RepaymentInput,
} from "./models/payment.js";
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
  CaptureMethod,
  PaymentIntent,
  PaymentIntentCancelInput,
  PaymentIntentCancellationReason,
  PaymentIntentCaptureInput,
  PaymentIntentConfirmInput,
  PaymentIntentCreateInput,
  PaymentIntentListInput,
  PaymentIntentPage,
  PaymentIntentStatus,
  PaymentMethodDetails,
} from "./models/payment_intent.js";
export {
  CaptureMethodSchema,
  PaymentIntentCancellationReasonSchema,
  PaymentIntentPageSchema,
  PaymentIntentSchema,
  PaymentIntentStatusSchema,
  PaymentMethodDetailsSchema,
  toPaymentIntentCancelWireBody,
  toPaymentIntentCaptureWireBody,
  toPaymentIntentConfirmWireBody,
  toPaymentIntentCreateWireBody,
  toPaymentIntentListQuery,
} from "./models/payment_intent.js";
export type {
  DetachedPaymentMethod,
  SetupIntent,
  SetupIntentConfirmInput,
  SetupIntentCreateInput,
  SetupIntentListInput,
  SetupIntentPage,
  SetupIntentStatus,
  SetupIntentUsage,
} from "./models/setup_intent.js";
export {
  DetachedPaymentMethodSchema,
  SetupIntentPageSchema,
  SetupIntentSchema,
  SetupIntentStatusSchema,
  SetupIntentUsageSchema,
  toSetupIntentConfirmWireBody,
  toSetupIntentCreateWireBody,
  toSetupIntentListQuery,
} from "./models/setup_intent.js";
export type {
  ProrationBehavior,
  Subscription,
  SubscriptionCancelInput,
  SubscriptionCancellationReason,
  SubscriptionCreateInput,
  SubscriptionItemInput,
  SubscriptionItemSnapshot,
  SubscriptionListInput,
  SubscriptionPage,
  SubscriptionStatus,
  SubscriptionUpdateInput,
} from "./models/subscription.js";
export {
  ProrationBehaviorSchema,
  SubscriptionCancellationReasonSchema,
  SubscriptionItemSnapshotSchema,
  SubscriptionPageSchema,
  SubscriptionSchema,
  SubscriptionStatusSchema,
  toSubscriptionCancelWireBody,
  toSubscriptionCreateWireBody,
  toSubscriptionListQuery,
  toSubscriptionUpdateWireBody,
} from "./models/subscription.js";
export type {
  Transaction,
  TransactionListFilters,
  TransactionPage,
  TransactionStatus,
} from "./models/transaction.js";
export {
  TransactionPageSchema,
  TransactionSchema,
  TransactionStatusSchema,
  toTransactionListQuery,
} from "./models/transaction.js";
export type { VerifyInput, VerifyResponse } from "./models/verify.js";
export { toVerifyWireBody, VerifyResponseSchema } from "./models/verify.js";
export type {
  WebhookEndpoint,
  WebhookEndpointCreateInput,
  WebhookEndpointListInput,
  WebhookEndpointPage,
  WebhookEndpointUpdateInput,
} from "./models/webhook_endpoint.js";
export {
  toWebhookEndpointCreateWireBody,
  toWebhookEndpointListQuery,
  toWebhookEndpointUpdateWireBody,
  WebhookEndpointPageSchema,
  WebhookEndpointSchema,
} from "./models/webhook_endpoint.js";
export { PricesResource, ProductsResource } from "./resources/catalog.js";
export { CustomersResource } from "./resources/customers.js";
export { PaymentIntentsResource } from "./resources/payment_intents.js";
// Resource classes (publicly accessible via the client; exported for type
// imports and for advanced consumers who wire their own transports).
export { PaymentsResource } from "./resources/payments.js";
export { PaymentMethodsResource, SetupIntentsResource } from "./resources/setup_intents.js";
export { SubscriptionsResource } from "./resources/subscriptions.js";
export { TransactionsResource } from "./resources/transactions.js";
export { VerifyResource } from "./resources/verify.js";
export { WebhookEndpointsResource } from "./resources/webhook_endpoints.js";
export type { QueryParamValue, RequestOptions } from "./transport.js";
// Transport
export { Transport } from "./transport.js";
