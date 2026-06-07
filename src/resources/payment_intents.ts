/**
 * PaymentIntents resource — `/payment-intents` endpoints.
 */

import type {
  PaymentIntent,
  PaymentIntentCancelInput,
  PaymentIntentCaptureInput,
  PaymentIntentConfirmInput,
  PaymentIntentCreateInput,
  PaymentIntentListInput,
  PaymentIntentPage,
} from "../models/payment_intent.js";
import {
  PaymentIntentPageSchema,
  PaymentIntentSchema,
  toPaymentIntentCancelWireBody,
  toPaymentIntentCaptureWireBody,
  toPaymentIntentConfirmWireBody,
  toPaymentIntentCreateWireBody,
  toPaymentIntentListQuery,
} from "../models/payment_intent.js";
import { Resource, parseResponse } from "./_base.js";

export class PaymentIntentsResource extends Resource {
  async create(input: PaymentIntentCreateInput): Promise<PaymentIntent> {
    const data = await this.transport.request("POST", "payment-intents", {
      json: toPaymentIntentCreateWireBody(input),
    });
    return parseResponse(PaymentIntentSchema, data);
  }

  async retrieve(stripePaymentIntentId: string): Promise<PaymentIntent> {
    const data = await this.transport.request(
      "GET",
      `payment-intents/${encodeURIComponent(stripePaymentIntentId)}`,
    );
    return parseResponse(PaymentIntentSchema, data);
  }

  async confirm(
    stripePaymentIntentId: string,
    input: PaymentIntentConfirmInput = {},
  ): Promise<PaymentIntent> {
    const data = await this.transport.request(
      "POST",
      `payment-intents/${encodeURIComponent(stripePaymentIntentId)}/confirm`,
      { json: toPaymentIntentConfirmWireBody(input) },
    );
    return parseResponse(PaymentIntentSchema, data);
  }

  async capture(
    stripePaymentIntentId: string,
    input: PaymentIntentCaptureInput = {},
  ): Promise<PaymentIntent> {
    const data = await this.transport.request(
      "POST",
      `payment-intents/${encodeURIComponent(stripePaymentIntentId)}/capture`,
      { json: toPaymentIntentCaptureWireBody(input) },
    );
    return parseResponse(PaymentIntentSchema, data);
  }

  async cancel(
    stripePaymentIntentId: string,
    input: PaymentIntentCancelInput = {},
  ): Promise<PaymentIntent> {
    const data = await this.transport.request(
      "POST",
      `payment-intents/${encodeURIComponent(stripePaymentIntentId)}/cancel`,
      { json: toPaymentIntentCancelWireBody(input) },
    );
    return parseResponse(PaymentIntentSchema, data);
  }

  async list(input: PaymentIntentListInput = {}): Promise<PaymentIntentPage> {
    const data = await this.transport.request("GET", "payment-intents", {
      params: toPaymentIntentListQuery(input),
    });
    return parseResponse(PaymentIntentPageSchema, data);
  }
}
