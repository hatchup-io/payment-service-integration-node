/**
 * High-level facade for the Hatchup Payment Service SDK.
 *
 * One client per `PSIPConfig` (one config per tenant — there is no module-
 * level singleton). The constructor accepts either a parsed `PSIPConfig`
 * or a `PSIPConfigInput` (raw, gets validated through the schema).
 *
 * `verify` is a top-level method, not a separate sub-namespace, so the
 * natural reading `await client.verify(orderId, price)` works directly —
 * mirrors the Python SDK's `client.verify(order_id, price)` (`__call__`).
 */

import { PSIPConfigSchema } from "./config.js";
import type { PSIPConfig, PSIPConfigInput } from "./config.js";
import type { VerifyInput, VerifyResponse } from "./models/verify.js";
import { PricesResource, ProductsResource } from "./resources/catalog.js";
import { CustomersResource } from "./resources/customers.js";
import { PaymentIntentsResource } from "./resources/payment_intents.js";
import { PaymentsResource } from "./resources/payments.js";
import { PaymentMethodsResource, SetupIntentsResource } from "./resources/setup_intents.js";
import { SubscriptionsResource } from "./resources/subscriptions.js";
import { TransactionsResource } from "./resources/transactions.js";
import { VerifyResource } from "./resources/verify.js";
import { WebhookEndpointsResource } from "./resources/webhook_endpoints.js";
import { Transport } from "./transport.js";

function isParsedConfig(value: PSIPConfig | PSIPConfigInput): value is PSIPConfig {
  // A parsed config has `userAgent` populated (the schema fills it in) and
  // `retry` resolved into the canonical RetryPolicy object. We use the
  // resolved `retry.retryOnStatus` array as the discriminator since it's
  // always present after parse and never required on input.
  return (
    typeof (value as PSIPConfig).userAgent === "string" &&
    Array.isArray((value as PSIPConfig).retry?.retryOnStatus)
  );
}

export class PaymentServiceClient {
  readonly config: PSIPConfig;
  readonly transport: Transport;
  readonly payments: PaymentsResource;
  readonly transactions: TransactionsResource;
  readonly customers: CustomersResource;
  readonly products: ProductsResource;
  readonly prices: PricesResource;
  readonly paymentIntents: PaymentIntentsResource;
  readonly setupIntents: SetupIntentsResource;
  readonly paymentMethods: PaymentMethodsResource;
  readonly subscriptions: SubscriptionsResource;
  readonly webhookEndpoints: WebhookEndpointsResource;

  /** Internal — `client.verify(orderId, price)` is exposed as a method on the
   *  class, mirroring the Python SDK's `__call__` reading. */
  readonly #verifyResource: VerifyResource;

  /**
   * @param input  Either a parsed `PSIPConfig` or a `PSIPConfigInput`
   *   (will be validated via `PSIPConfigSchema.parse`).
   * @param fetchImpl  Optional `fetch` override — mainly for testing.
   */
  constructor(input: PSIPConfig | PSIPConfigInput, fetchImpl?: typeof fetch) {
    this.config = isParsedConfig(input) ? input : PSIPConfigSchema.parse(input);
    this.transport = new Transport(this.config, fetchImpl);
    this.payments = new PaymentsResource(this.transport);
    this.transactions = new TransactionsResource(this.transport);
    this.customers = new CustomersResource(this.transport);
    this.products = new ProductsResource(this.transport);
    this.prices = new PricesResource(this.transport);
    this.paymentIntents = new PaymentIntentsResource(this.transport);
    this.setupIntents = new SetupIntentsResource(this.transport);
    this.paymentMethods = new PaymentMethodsResource(this.transport);
    this.subscriptions = new SubscriptionsResource(this.transport);
    this.webhookEndpoints = new WebhookEndpointsResource(this.transport);
    this.#verifyResource = new VerifyResource(this.transport);
  }

  /**
   * Confirm a payment's amount + currency match what the consumer expected.
   *
   * ```ts
   * const result = await client.verify("ord_2026_05_001", "9.99");
   * if (!result.verified) throw new Error("forgery suspected");
   * ```
   */
  verify(
    orderId: string,
    price: VerifyInput["price"],
    options: Omit<VerifyInput, "price"> = {},
  ): Promise<VerifyResponse> {
    return this.#verifyResource.run(orderId, price, options);
  }
}
