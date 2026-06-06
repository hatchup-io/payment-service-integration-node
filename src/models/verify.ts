/**
 * Models for `POST /api/v1/verify`.
 *
 * The verify endpoint asserts that the payment for `orderId` reached the
 * server with a matching price and currency. Used both as the primary
 * consumer-side verification call and as the webhook forgery guard inside
 * `WebhookDispatcher` (M1.c).
 */

import { z } from "zod";

export interface VerifyInput {
  /** Amount as a decimal string or number. Must be positive. */
  price: string | number;
  /** ISO 4217 currency code; lowercased on the wire. Defaults to "usd". */
  currency?: string;
}

export function toVerifyWireBody(orderId: string, input: VerifyInput): Record<string, unknown> {
  const n = typeof input.price === "number" ? input.price : Number.parseFloat(input.price);
  if (!Number.isFinite(n) || n <= 0) {
    throw new RangeError(
      `verify price must be a positive finite number, got ${JSON.stringify(input.price)}`,
    );
  }
  return {
    order_id: orderId,
    price: String(input.price),
    currency: (input.currency ?? "usd").toLowerCase(),
  };
}

export const VerifyResponseSchema = z
  .object({
    order_id: z.string(),
    verified: z.boolean(),
  })
  .passthrough()
  .transform((wire) => ({
    orderId: wire.order_id,
    verified: wire.verified,
  }));

export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;
