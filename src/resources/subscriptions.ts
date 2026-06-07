/**
 * Subscriptions resource — `/subscriptions` endpoints.
 */

import type {
  Subscription,
  SubscriptionCancelInput,
  SubscriptionCreateInput,
  SubscriptionListInput,
  SubscriptionPage,
  SubscriptionUpdateInput,
} from "../models/subscription.js";
import {
  SubscriptionPageSchema,
  SubscriptionSchema,
  toSubscriptionCancelWireBody,
  toSubscriptionCreateWireBody,
  toSubscriptionListQuery,
  toSubscriptionUpdateWireBody,
} from "../models/subscription.js";
import { Resource, parseResponse } from "./_base.js";

export class SubscriptionsResource extends Resource {
  async create(input: SubscriptionCreateInput): Promise<Subscription> {
    const data = await this.transport.request("POST", "subscriptions", {
      json: toSubscriptionCreateWireBody(input),
    });
    return parseResponse(SubscriptionSchema, data);
  }

  async retrieve(stripeSubscriptionId: string): Promise<Subscription> {
    const data = await this.transport.request(
      "GET",
      `subscriptions/${encodeURIComponent(stripeSubscriptionId)}`,
    );
    return parseResponse(SubscriptionSchema, data);
  }

  async update(
    stripeSubscriptionId: string,
    input: SubscriptionUpdateInput,
  ): Promise<Subscription> {
    const data = await this.transport.request(
      "POST",
      `subscriptions/${encodeURIComponent(stripeSubscriptionId)}`,
      { json: toSubscriptionUpdateWireBody(input) },
    );
    return parseResponse(SubscriptionSchema, data);
  }

  async cancel(
    stripeSubscriptionId: string,
    input: SubscriptionCancelInput = {},
  ): Promise<Subscription> {
    const data = await this.transport.request(
      "POST",
      `subscriptions/${encodeURIComponent(stripeSubscriptionId)}/cancel`,
      { json: toSubscriptionCancelWireBody(input) },
    );
    return parseResponse(SubscriptionSchema, data);
  }

  async resume(stripeSubscriptionId: string): Promise<Subscription> {
    const data = await this.transport.request(
      "POST",
      `subscriptions/${encodeURIComponent(stripeSubscriptionId)}/resume`,
    );
    return parseResponse(SubscriptionSchema, data);
  }

  async list(input: SubscriptionListInput = {}): Promise<SubscriptionPage> {
    const data = await this.transport.request("GET", "subscriptions", {
      params: toSubscriptionListQuery(input),
    });
    return parseResponse(SubscriptionPageSchema, data);
  }
}
