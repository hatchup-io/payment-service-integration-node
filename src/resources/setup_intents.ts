/**
 * SetupIntents resource + PaymentMethods.detach.
 */

import type {
  DetachedPaymentMethod,
  SetupIntent,
  SetupIntentConfirmInput,
  SetupIntentCreateInput,
  SetupIntentListInput,
  SetupIntentPage,
} from "../models/setup_intent.js";
import {
  DetachedPaymentMethodSchema,
  SetupIntentPageSchema,
  SetupIntentSchema,
  toSetupIntentConfirmWireBody,
  toSetupIntentCreateWireBody,
  toSetupIntentListQuery,
} from "../models/setup_intent.js";
import { Resource, parseResponse } from "./_base.js";

export class SetupIntentsResource extends Resource {
  async create(input: SetupIntentCreateInput = {}): Promise<SetupIntent> {
    const data = await this.transport.request("POST", "setup-intents", {
      json: toSetupIntentCreateWireBody(input),
    });
    return parseResponse(SetupIntentSchema, data);
  }

  async retrieve(stripeSetupIntentId: string): Promise<SetupIntent> {
    const data = await this.transport.request(
      "GET",
      `setup-intents/${encodeURIComponent(stripeSetupIntentId)}`,
    );
    return parseResponse(SetupIntentSchema, data);
  }

  async confirm(
    stripeSetupIntentId: string,
    input: SetupIntentConfirmInput = {},
  ): Promise<SetupIntent> {
    const data = await this.transport.request(
      "POST",
      `setup-intents/${encodeURIComponent(stripeSetupIntentId)}/confirm`,
      { json: toSetupIntentConfirmWireBody(input) },
    );
    return parseResponse(SetupIntentSchema, data);
  }

  async cancel(stripeSetupIntentId: string): Promise<SetupIntent> {
    const data = await this.transport.request(
      "POST",
      `setup-intents/${encodeURIComponent(stripeSetupIntentId)}/cancel`,
    );
    return parseResponse(SetupIntentSchema, data);
  }

  async list(input: SetupIntentListInput = {}): Promise<SetupIntentPage> {
    const data = await this.transport.request("GET", "setup-intents", {
      params: toSetupIntentListQuery(input),
    });
    return parseResponse(SetupIntentPageSchema, data);
  }
}

export class PaymentMethodsResource extends Resource {
  /**
   * Detach a saved payment method from its customer. Use this when the
   * consumer removes a card from the billing portal or settings UI.
   */
  async detach(paymentMethodId: string): Promise<DetachedPaymentMethod> {
    const data = await this.transport.request(
      "POST",
      `payment-methods/${encodeURIComponent(paymentMethodId)}/detach`,
    );
    return parseResponse(DetachedPaymentMethodSchema, data);
  }
}
