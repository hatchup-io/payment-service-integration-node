/**
 * Models for the `/payment-intents` endpoints.
 */

import { z } from "zod";

export const PaymentIntentStatusSchema = z.enum([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
  "succeeded",
  "canceled",
]);
export type PaymentIntentStatus = z.infer<typeof PaymentIntentStatusSchema>;

export const CaptureMethodSchema = z.enum(["automatic", "manual"]);
export type CaptureMethod = z.infer<typeof CaptureMethodSchema>;

export const PaymentIntentCancellationReasonSchema = z.enum([
  "duplicate",
  "fraudulent",
  "requested_by_customer",
  "abandoned",
]);
export type PaymentIntentCancellationReason = z.infer<typeof PaymentIntentCancellationReasonSchema>;

// --------------------------------------------------------------------- //
// Requests
// --------------------------------------------------------------------- //

export interface PaymentIntentCreateInput {
  amount: string | number;
  currency?: string;
  customer?: string;
  paymentMethod?: string;
  confirm?: boolean;
  captureMethod?: CaptureMethod;
  description?: string;
  successWebhook?: string;
  failureWebhook?: string;
  sandbox?: boolean;
  metadata?: Record<string, string>;
}

export function toPaymentIntentCreateWireBody(
  input: PaymentIntentCreateInput,
): Record<string, unknown> {
  const amountNum =
    typeof input.amount === "number" ? input.amount : Number.parseFloat(input.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new RangeError(
      `amount must be a positive finite number, got ${JSON.stringify(input.amount)}`,
    );
  }
  const body: Record<string, unknown> = {
    amount: String(input.amount),
    currency: (input.currency ?? "usd").toLowerCase(),
    confirm: input.confirm ?? false,
    capture_method: input.captureMethod ?? "automatic",
    sandbox: input.sandbox ?? true,
  };
  if (input.customer !== undefined) body.customer = input.customer;
  if (input.paymentMethod !== undefined) body.payment_method = input.paymentMethod;
  if (input.description !== undefined) body.description = input.description;
  if (input.successWebhook !== undefined) body.success_webhook = input.successWebhook;
  if (input.failureWebhook !== undefined) body.failure_webhook = input.failureWebhook;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

export interface PaymentIntentConfirmInput {
  paymentMethod?: string;
}

export function toPaymentIntentConfirmWireBody(
  input: PaymentIntentConfirmInput = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.paymentMethod !== undefined) body.payment_method = input.paymentMethod;
  return body;
}

export interface PaymentIntentCaptureInput {
  amountToCapture?: string | number;
}

export function toPaymentIntentCaptureWireBody(
  input: PaymentIntentCaptureInput = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.amountToCapture !== undefined) {
    const n =
      typeof input.amountToCapture === "number"
        ? input.amountToCapture
        : Number.parseFloat(input.amountToCapture);
    if (!Number.isFinite(n) || n <= 0) {
      throw new RangeError(
        `amountToCapture must be a positive finite number, got ${JSON.stringify(input.amountToCapture)}`,
      );
    }
    body.amount_to_capture = String(input.amountToCapture);
  }
  return body;
}

export interface PaymentIntentCancelInput {
  cancellationReason?: PaymentIntentCancellationReason;
}

export function toPaymentIntentCancelWireBody(
  input: PaymentIntentCancelInput = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.cancellationReason !== undefined) body.cancellation_reason = input.cancellationReason;
  return body;
}

// --------------------------------------------------------------------- //
// Response
// --------------------------------------------------------------------- //

export const PaymentMethodDetailsSchema = z
  .object({
    type: z.string().default(""),
    brand: z.string().default(""),
    last4: z.string().default(""),
    exp_month: z.number().int().nullable().optional(),
    exp_year: z.number().int().nullable().optional(),
  })
  .passthrough()
  .transform((wire) => ({
    type: wire.type,
    brand: wire.brand,
    last4: wire.last4,
    expMonth: wire.exp_month ?? null,
    expYear: wire.exp_year ?? null,
  }));

export type PaymentMethodDetails = z.infer<typeof PaymentMethodDetailsSchema>;

export const PaymentIntentSchema = z
  .object({
    id: z.string(),
    object: z.string().default("payment_intent"),
    amount: z.union([z.string(), z.number()]).transform(String),
    currency: z.string(),
    status: PaymentIntentStatusSchema,
    client_secret: z.string().default(""),
    customer: z.string().nullable().optional(),
    payment_method: z.string().nullable().optional(),
    payment_method_details: z.unknown().default({}),
    metadata: z.record(z.string(), z.unknown()).default({}),
    is_test: z.boolean().default(true),
    last_error_message: z.string().nullable().optional(),
    cancellation_reason: z.string().nullable().optional(),
    created_at: z.string().datetime({ offset: true }),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    object: wire.object,
    amount: wire.amount,
    currency: wire.currency,
    status: wire.status,
    clientSecret: wire.client_secret,
    customer: wire.customer ?? null,
    paymentMethod: wire.payment_method ?? null,
    paymentMethodDetails: wire.payment_method_details,
    metadata: wire.metadata,
    isTest: wire.is_test,
    lastErrorMessage: wire.last_error_message ?? null,
    cancellationReason: wire.cancellation_reason ?? null,
    createdAt: wire.created_at,
  }));

export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;

export const PaymentIntentPageSchema = z
  .object({
    results: z.array(PaymentIntentSchema).default([]),
    page: z.number().int().default(1),
    page_size: z.number().int().default(20),
    count: z.number().int().default(0),
  })
  .passthrough()
  .transform((wire) => ({
    results: wire.results,
    page: wire.page,
    pageSize: wire.page_size,
    count: wire.count,
  }));

export type PaymentIntentPage = z.infer<typeof PaymentIntentPageSchema>;

export interface PaymentIntentListInput {
  customer?: string;
  status?: PaymentIntentStatus;
  page?: number;
  pageSize?: number;
}

export function toPaymentIntentListQuery(
  input: PaymentIntentListInput = {},
): Record<string, string> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError(`page must be a positive integer, got ${page}`);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError(`pageSize must be between 1 and 100, got ${pageSize}`);
  }
  const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
  if (input.customer !== undefined) params.customer = input.customer;
  if (input.status !== undefined) params.status = input.status;
  return params;
}
