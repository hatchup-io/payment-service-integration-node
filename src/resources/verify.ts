/**
 * Verify resource: `POST /api/v1/verify`.
 *
 * Exposed via {@link PaymentServiceClient.verify} as a top-level method on
 * the client (no `client.verify.run(...)` boilerplate) so the natural
 * reading `await client.verify(orderId, price)` works directly.
 */

import { VerifyResponseSchema, toVerifyWireBody } from "../models/verify.js";
import type { VerifyInput, VerifyResponse } from "../models/verify.js";
import { Resource, parseResponse } from "./_base.js";

export class VerifyResource extends Resource {
  /**
   * Confirm that a payment for `orderId` reached the server with a
   * matching `price` (and optional `currency`). Used both as the primary
   * consumer-side verification call and as the webhook forgery guard
   * inside {@link WebhookDispatcher} (M1.c).
   */
  async run(
    orderId: string,
    price: VerifyInput["price"],
    options: Omit<VerifyInput, "price"> = {},
  ): Promise<VerifyResponse> {
    const input: VerifyInput = {
      price,
      ...(options.currency !== undefined ? { currency: options.currency } : {}),
    };
    const data = await this.transport.request("POST", "verify", {
      json: toVerifyWireBody(orderId, input),
    });
    return parseResponse(VerifyResponseSchema, data);
  }
}
