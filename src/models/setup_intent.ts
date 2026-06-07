/**
 * Models for the `/setup-intents` endpoints + the
 * `/payment-methods/{id}/detach` response shape.
 */

import { z } from "zod";

export const SetupIntentStatusSchema = z.enum([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "succeeded",
  "canceled",
]);
export type SetupIntentStatus = z.infer<typeof SetupIntentStatusSchema>;

export const SetupIntentUsageSchema = z.enum(["off_session", "on_session"]);
export type SetupIntentUsage = z.infer<typeof SetupIntentUsageSchema>;

// --------------------------------------------------------------------- //
// Requests
// --------------------------------------------------------------------- //

export interface SetupIntentCreateInput {
  customer?: string;
  paymentMethod?: string;
  usage?: SetupIntentUsage;
  description?: string;
  confirm?: boolean;
  sandbox?: boolean;
  metadata?: Record<string, string>;
}

export function toSetupIntentCreateWireBody(
  input: SetupIntentCreateInput = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    usage: input.usage ?? "off_session",
    confirm: input.confirm ?? false,
    sandbox: input.sandbox ?? true,
  };
  if (input.customer !== undefined) body.customer = input.customer;
  if (input.paymentMethod !== undefined) body.payment_method = input.paymentMethod;
  if (input.description !== undefined) body.description = input.description;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

export interface SetupIntentConfirmInput {
  paymentMethod?: string;
}

export function toSetupIntentConfirmWireBody(
  input: SetupIntentConfirmInput = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.paymentMethod !== undefined) body.payment_method = input.paymentMethod;
  return body;
}

// --------------------------------------------------------------------- //
// Responses
// --------------------------------------------------------------------- //

export const SetupIntentSchema = z
  .object({
    id: z.string(),
    object: z.string().default("setup_intent"),
    status: SetupIntentStatusSchema,
    client_secret: z.string().default(""),
    customer: z.string().nullable().optional(),
    payment_method: z.string().nullable().optional(),
    usage: SetupIntentUsageSchema.default("off_session"),
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
    status: wire.status,
    clientSecret: wire.client_secret,
    customer: wire.customer ?? null,
    paymentMethod: wire.payment_method ?? null,
    usage: wire.usage,
    metadata: wire.metadata,
    isTest: wire.is_test,
    lastErrorMessage: wire.last_error_message ?? null,
    cancellationReason: wire.cancellation_reason ?? null,
    createdAt: wire.created_at,
  }));

export type SetupIntent = z.infer<typeof SetupIntentSchema>;

export const SetupIntentPageSchema = z
  .object({
    results: z.array(SetupIntentSchema).default([]),
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

export type SetupIntentPage = z.infer<typeof SetupIntentPageSchema>;

export const DetachedPaymentMethodSchema = z
  .object({
    id: z.string(),
    detached: z.boolean().default(true),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    detached: wire.detached,
  }));

export type DetachedPaymentMethod = z.infer<typeof DetachedPaymentMethodSchema>;

export interface SetupIntentListInput {
  customer?: string;
  status?: SetupIntentStatus;
  page?: number;
  pageSize?: number;
}

export function toSetupIntentListQuery(input: SetupIntentListInput = {}): Record<string, string> {
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
