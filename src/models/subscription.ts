/**
 * Models for the `/subscriptions` endpoints.
 */

import { z } from "zod";

export const SubscriptionStatusSchema = z.enum([
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const ProrationBehaviorSchema = z.enum(["create_prorations", "none", "always_invoice"]);
export type ProrationBehavior = z.infer<typeof ProrationBehaviorSchema>;

export const SubscriptionCancellationReasonSchema = z.enum([
  "customer_service",
  "low_quality",
  "missing_features",
  "switched_service",
  "too_complex",
  "too_expensive",
  "unused",
  "other",
]);
export type SubscriptionCancellationReason = z.infer<typeof SubscriptionCancellationReasonSchema>;

// --------------------------------------------------------------------- //
// Item inputs / responses
// --------------------------------------------------------------------- //

export interface SubscriptionItemInput {
  /** Existing line id (`si_…`) — pass on update or delete. */
  id?: string;
  /** Stripe Price id (`price_…`) — pass to add a new line on update or
   *  to set the price on create. */
  price?: string;
  quantity?: number;
  /** Set to `true` together with `id` to remove a line on update. */
  deleted?: boolean;
}

function validateItem(item: SubscriptionItemInput, index: number): void {
  if (!item.id && !item.price) {
    throw new RangeError(
      `items[${index}] must carry an 'id' (update/delete) or a 'price' (new line)`,
    );
  }
  if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new RangeError(
      `items[${index}].quantity must be a positive integer, got ${item.quantity}`,
    );
  }
}

function toItemWire(item: SubscriptionItemInput): Record<string, unknown> {
  const wire: Record<string, unknown> = { deleted: item.deleted ?? false };
  if (item.id !== undefined) wire.id = item.id;
  if (item.price !== undefined) wire.price = item.price;
  if (item.quantity !== undefined) wire.quantity = item.quantity;
  return wire;
}

export const SubscriptionItemSnapshotSchema = z
  .object({
    stripe_subscription_item_id: z.string(),
    price_id: z.string(),
    quantity: z.number().int().default(1),
  })
  .passthrough()
  .transform((wire) => ({
    stripeSubscriptionItemId: wire.stripe_subscription_item_id,
    priceId: wire.price_id,
    quantity: wire.quantity,
  }));

export type SubscriptionItemSnapshot = z.infer<typeof SubscriptionItemSnapshotSchema>;

// --------------------------------------------------------------------- //
// Request bodies
// --------------------------------------------------------------------- //

export interface SubscriptionCreateInput {
  customer: string;
  items: SubscriptionItemInput[];
  trialPeriodDays?: number;
  defaultPaymentMethod?: string;
  metadata?: Record<string, string>;
  sandbox?: boolean;
}

export function toSubscriptionCreateWireBody(
  input: SubscriptionCreateInput,
): Record<string, unknown> {
  if (input.customer.length === 0) {
    throw new RangeError("subscription.customer must be non-empty");
  }
  if (input.items.length === 0) {
    throw new RangeError("subscription.items must contain at least one item");
  }
  input.items.forEach(validateItem);
  if (
    input.trialPeriodDays !== undefined &&
    (!Number.isInteger(input.trialPeriodDays) || input.trialPeriodDays < 0)
  ) {
    throw new RangeError(
      `trialPeriodDays must be a non-negative integer, got ${input.trialPeriodDays}`,
    );
  }
  const body: Record<string, unknown> = {
    customer: input.customer,
    items: input.items.map(toItemWire),
    sandbox: input.sandbox ?? true,
  };
  if (input.trialPeriodDays !== undefined) body.trial_period_days = input.trialPeriodDays;
  if (input.defaultPaymentMethod !== undefined)
    body.default_payment_method = input.defaultPaymentMethod;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

export interface SubscriptionUpdateInput {
  items?: SubscriptionItemInput[];
  defaultPaymentMethod?: string;
  cancelAtPeriodEnd?: boolean;
  prorationBehavior?: ProrationBehavior;
  metadata?: Record<string, string>;
}

export function toSubscriptionUpdateWireBody(
  input: SubscriptionUpdateInput,
): Record<string, unknown> {
  if (input.items !== undefined) {
    if (input.items.length === 0) {
      throw new RangeError("subscription update items[] must be non-empty when provided");
    }
    input.items.forEach(validateItem);
  }
  const body: Record<string, unknown> = {};
  if (input.items !== undefined) body.items = input.items.map(toItemWire);
  if (input.defaultPaymentMethod !== undefined)
    body.default_payment_method = input.defaultPaymentMethod;
  if (input.cancelAtPeriodEnd !== undefined) body.cancel_at_period_end = input.cancelAtPeriodEnd;
  if (input.prorationBehavior !== undefined) body.proration_behavior = input.prorationBehavior;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

export interface SubscriptionCancelInput {
  atPeriodEnd?: boolean;
  cancellationReason?: SubscriptionCancellationReason;
  invoiceNow?: boolean;
  prorate?: boolean;
}

export function toSubscriptionCancelWireBody(
  input: SubscriptionCancelInput = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    at_period_end: input.atPeriodEnd ?? false,
    invoice_now: input.invoiceNow ?? false,
  };
  if (input.cancellationReason !== undefined) body.cancellation_reason = input.cancellationReason;
  if (input.prorate !== undefined) body.prorate = input.prorate;
  return body;
}

// --------------------------------------------------------------------- //
// Response
// --------------------------------------------------------------------- //

export const SubscriptionSchema = z
  .object({
    id: z.string(),
    object: z.string().default("subscription"),
    customer: z.string(),
    status: SubscriptionStatusSchema,
    items: z.array(SubscriptionItemSnapshotSchema).default([]),
    current_period_start: z.string().datetime({ offset: true }).nullable().optional(),
    current_period_end: z.string().datetime({ offset: true }).nullable().optional(),
    trial_start: z.string().datetime({ offset: true }).nullable().optional(),
    trial_end: z.string().datetime({ offset: true }).nullable().optional(),
    cancel_at_period_end: z.boolean().default(false),
    canceled_at: z.string().datetime({ offset: true }).nullable().optional(),
    cancellation_reason: z.string().nullable().optional(),
    default_payment_method: z.string().nullable().optional(),
    latest_invoice: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    is_test: z.boolean().default(true),
    created_at: z.string().datetime({ offset: true }),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    object: wire.object,
    customer: wire.customer,
    status: wire.status,
    items: wire.items,
    currentPeriodStart: wire.current_period_start ?? null,
    currentPeriodEnd: wire.current_period_end ?? null,
    trialStart: wire.trial_start ?? null,
    trialEnd: wire.trial_end ?? null,
    cancelAtPeriodEnd: wire.cancel_at_period_end,
    canceledAt: wire.canceled_at ?? null,
    cancellationReason: wire.cancellation_reason ?? null,
    defaultPaymentMethod: wire.default_payment_method ?? null,
    latestInvoice: wire.latest_invoice ?? null,
    metadata: wire.metadata,
    isTest: wire.is_test,
    createdAt: wire.created_at,
  }));

export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscriptionPageSchema = z
  .object({
    results: z.array(SubscriptionSchema).default([]),
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

export type SubscriptionPage = z.infer<typeof SubscriptionPageSchema>;

export interface SubscriptionListInput {
  customer?: string;
  status?: SubscriptionStatus;
  page?: number;
  pageSize?: number;
}

export function toSubscriptionListQuery(input: SubscriptionListInput = {}): Record<string, string> {
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
