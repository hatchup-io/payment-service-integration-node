/**
 * Models for the `/payment`, `/repayment`, `/checkout-sessions/.../verify`,
 * and `/transactions/{id}/refund` endpoints.
 *
 * Wire shape mirrors payment-system's `apps/payments/schema.py` 1:1
 * (snake_case JSON). The exported TS types are camelCase — Zod schemas
 * `.transform()` between the two.
 */

import { z } from "zod";

export const PaymentTypeSchema = z.union([z.literal("one_time"), z.literal("subscription")]);
export type PaymentType = z.infer<typeof PaymentTypeSchema>;

// --------------------------------------------------------------------- //
// Requests (camelCase TS input → snake_case wire payload via toWire*)
// --------------------------------------------------------------------- //

export interface PaymentCreateInput {
  /** Amount as a decimal string (preferred) or number. Must be positive. */
  price: string | number;
  /** ISO 4217 currency code; lowercased on the wire. Defaults to "usd". */
  currency?: string;
  orderId: string;
  paymentType?: PaymentType;
  successWebhook: string;
  failureWebhook: string;
  sandbox?: boolean;
  /** Optional Stripe Customer id (`cus_…`) to attach the session to. */
  customer?: string;
  /**
   * When true (and `paymentType="one_time"`), Stripe materializes a real
   * Invoice on session completion. Required for wallet-funding flows that
   * surface a billing history. Ignored for `subscription` mode.
   */
  createInvoice?: boolean;
  /**
   * Flat key→string map forwarded to Stripe Checkout Session metadata.
   * Server enforces Stripe's constraints (≤50 keys, ≤40-char keys,
   * ≤500-char values) and strips the reserved `payment_request_id` key.
   */
  metadata?: Record<string, string>;
}

/** snake_case wire body for `POST /api/v1/payment`. */
export function toPaymentCreateWireBody(input: PaymentCreateInput): Record<string, unknown> {
  validatePositiveAmount("price", input.price);
  const body: Record<string, unknown> = {
    price: String(input.price),
    currency: (input.currency ?? "usd").toLowerCase(),
    order_id: input.orderId,
    payment_type: input.paymentType ?? "one_time",
    success_webhook: input.successWebhook,
    failure_webhook: input.failureWebhook,
    sandbox: input.sandbox ?? true,
    create_invoice: input.createInvoice ?? false,
  };
  if (input.customer !== undefined) body.customer = input.customer;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

export interface RepaymentInput {
  orderId: string;
  successWebhook?: string;
  failureWebhook?: string;
  sandbox?: boolean;
  metadata?: Record<string, string>;
}

export function toRepaymentWireBody(input: RepaymentInput): Record<string, unknown> {
  const body: Record<string, unknown> = { order_id: input.orderId };
  if (input.successWebhook !== undefined) body.success_webhook = input.successWebhook;
  if (input.failureWebhook !== undefined) body.failure_webhook = input.failureWebhook;
  if (input.sandbox !== undefined) body.sandbox = input.sandbox;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

export interface RefundInput {
  /** Partial-refund amount. Omit for a full refund. */
  amount?: string | number;
  /** Free-text reason forwarded to Stripe; not constrained to Stripe's enum. */
  reason?: string;
}

export function toRefundWireBody(input: RefundInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.amount !== undefined) {
    validatePositiveAmount("amount", input.amount);
    body.amount = String(input.amount);
  }
  if (input.reason !== undefined) {
    if (input.reason.length === 0 || input.reason.length > 2000) {
      throw new RangeError("refund reason must be between 1 and 2000 characters");
    }
    body.reason = input.reason;
  }
  return body;
}

// --------------------------------------------------------------------- //
// Responses (snake_case wire → camelCase TS via .transform())
// --------------------------------------------------------------------- //

export const PaymentCreateResponseSchema = z
  .object({
    payment_url: z.string(),
    session_id: z.string(),
    order_id: z.string(),
  })
  .passthrough()
  .transform((wire) => ({
    paymentUrl: wire.payment_url,
    sessionId: wire.session_id,
    orderId: wire.order_id,
  }));

export type PaymentCreateResponse = z.infer<typeof PaymentCreateResponseSchema>;

export const CheckoutSessionVerifyResponseSchema = z
  .object({
    session_id: z.string(),
    order_id: z.string(),
    payment_status: z.string(),
    amount: z.union([z.string(), z.number()]).transform(String),
    currency: z.string(),
    transaction_id: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((wire) => ({
    sessionId: wire.session_id,
    orderId: wire.order_id,
    paymentStatus: wire.payment_status,
    amount: wire.amount,
    currency: wire.currency,
    transactionId: wire.transaction_id ?? null,
  }));

export type CheckoutSessionVerifyResponse = z.infer<typeof CheckoutSessionVerifyResponseSchema>;

export const RefundResponseSchema = z
  .object({
    refund_id: z.string(),
    transaction_id: z.string(),
    status: z.string(),
    amount: z.union([z.string(), z.number()]).transform(String),
    currency: z.string(),
    reason: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((wire) => ({
    refundId: wire.refund_id,
    transactionId: wire.transaction_id,
    status: wire.status,
    amount: wire.amount,
    currency: wire.currency,
    reason: wire.reason ?? null,
  }));

export type RefundResponse = z.infer<typeof RefundResponseSchema>;

// --------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------- //

function validatePositiveAmount(field: string, value: string | number): void {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new RangeError(`${field} must be a positive finite number, got ${JSON.stringify(value)}`);
  }
}
