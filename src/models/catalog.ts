/**
 * Models for the `/products` and `/prices` endpoints.
 *
 * `RecurringInterval` is the empty string for one-time prices, or one of
 * the Stripe recurring intervals for subscription-eligible prices.
 */

import { z } from "zod";

export const RecurringIntervalSchema = z.union([
  z.literal(""),
  z.literal("day"),
  z.literal("week"),
  z.literal("month"),
  z.literal("year"),
]);
export type RecurringInterval = z.infer<typeof RecurringIntervalSchema>;

// --------------------------------------------------------------------- //
// Product
// --------------------------------------------------------------------- //

export interface ProductCreateInput {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
  sandbox?: boolean;
}

export function toProductCreateWireBody(input: ProductCreateInput): Record<string, unknown> {
  if (input.name.length === 0 || input.name.length > 255) {
    throw new RangeError(`product name must be 1..255 chars, got ${input.name.length}`);
  }
  if (input.description !== undefined && input.description.length > 500) {
    throw new RangeError(
      `product description must be at most 500 chars, got ${input.description.length}`,
    );
  }
  const body: Record<string, unknown> = { name: input.name, sandbox: input.sandbox ?? true };
  if (input.description !== undefined) body.description = input.description;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

export interface ProductUpdateInput {
  name?: string;
  description?: string;
  metadata?: Record<string, string>;
  isActive?: boolean;
}

export function toProductUpdateWireBody(input: ProductUpdateInput): Record<string, unknown> {
  if (input.name !== undefined && (input.name.length === 0 || input.name.length > 255)) {
    throw new RangeError(`product name must be 1..255 chars, got ${input.name.length}`);
  }
  if (input.description !== undefined && input.description.length > 500) {
    throw new RangeError(
      `product description must be at most 500 chars, got ${input.description.length}`,
    );
  }
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  if (input.isActive !== undefined) body.is_active = input.isActive;
  return body;
}

export const ProductSchema = z
  .object({
    id: z.string(),
    object: z.string().default("product"),
    name: z.string(),
    description: z.string().default(""),
    metadata: z.record(z.string(), z.unknown()).default({}),
    is_active: z.boolean().default(true),
    is_test: z.boolean().default(true),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    object: wire.object,
    name: wire.name,
    description: wire.description,
    metadata: wire.metadata,
    isActive: wire.is_active,
    isTest: wire.is_test,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  }));

export type Product = z.infer<typeof ProductSchema>;

export const ProductPageSchema = z
  .object({
    results: z.array(ProductSchema).default([]),
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

export type ProductPage = z.infer<typeof ProductPageSchema>;

export interface ProductListInput {
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export function toProductListQuery(input: ProductListInput = {}): Record<string, string> {
  const { page, pageSize } = normalizePagination(input.page, input.pageSize);
  const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
  if (input.active !== undefined) params.active = input.active ? "true" : "false";
  return params;
}

// --------------------------------------------------------------------- //
// Price
// --------------------------------------------------------------------- //

export interface PriceCreateInput {
  product: string;
  /** Unit amount as a positive decimal string or number. */
  unitAmount: string | number;
  currency?: string;
  /** Empty string for one-time prices, or a Stripe interval. */
  recurringInterval?: RecurringInterval;
  recurringIntervalCount?: number;
  nickname?: string;
  metadata?: Record<string, string>;
  sandbox?: boolean;
}

export function toPriceCreateWireBody(input: PriceCreateInput): Record<string, unknown> {
  if (input.product.length === 0) {
    throw new RangeError("price.product must be non-empty");
  }
  const amountNum =
    typeof input.unitAmount === "number" ? input.unitAmount : Number.parseFloat(input.unitAmount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new RangeError(
      `unitAmount must be a positive finite number, got ${JSON.stringify(input.unitAmount)}`,
    );
  }
  const intervalCount = input.recurringIntervalCount ?? 1;
  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    throw new RangeError(`recurringIntervalCount must be a positive integer, got ${intervalCount}`);
  }
  if (input.nickname !== undefined && input.nickname.length > 255) {
    throw new RangeError(`price.nickname must be at most 255 chars, got ${input.nickname.length}`);
  }
  const body: Record<string, unknown> = {
    product: input.product,
    unit_amount: String(input.unitAmount),
    currency: (input.currency ?? "usd").toLowerCase(),
    recurring_interval: input.recurringInterval ?? "",
    recurring_interval_count: intervalCount,
    sandbox: input.sandbox ?? true,
  };
  if (input.nickname !== undefined) body.nickname = input.nickname;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

export const RecurringPriceSchema = z
  .object({
    interval: z.string(),
    interval_count: z.number().int().default(1),
  })
  .passthrough()
  .transform((wire) => ({
    interval: wire.interval,
    intervalCount: wire.interval_count,
  }));

export type RecurringPrice = z.infer<typeof RecurringPriceSchema>;

export const PriceSchema = z
  .object({
    id: z.string(),
    object: z.string().default("price"),
    product: z.string(),
    unit_amount: z.union([z.string(), z.number()]).transform(String),
    currency: z.string(),
    recurring: RecurringPriceSchema.nullable().optional(),
    nickname: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    is_active: z.boolean().default(true),
    is_test: z.boolean().default(true),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    object: wire.object,
    product: wire.product,
    unitAmount: wire.unit_amount,
    currency: wire.currency,
    recurring: wire.recurring ?? null,
    nickname: wire.nickname ?? null,
    metadata: wire.metadata,
    isActive: wire.is_active,
    isTest: wire.is_test,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  }));

export type Price = z.infer<typeof PriceSchema>;

export const PricePageSchema = z
  .object({
    results: z.array(PriceSchema).default([]),
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

export type PricePage = z.infer<typeof PricePageSchema>;

export interface PriceListInput {
  product?: string;
  active?: boolean;
  recurring?: boolean;
  page?: number;
  pageSize?: number;
}

export function toPriceListQuery(input: PriceListInput = {}): Record<string, string> {
  const { page, pageSize } = normalizePagination(input.page, input.pageSize);
  const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
  if (input.product !== undefined) params.product = input.product;
  if (input.active !== undefined) params.active = input.active ? "true" : "false";
  if (input.recurring !== undefined) params.recurring = input.recurring ? "true" : "false";
  return params;
}

// --------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------- //

function normalizePagination(
  page: number | undefined,
  pageSize: number | undefined,
): { page: number; pageSize: number } {
  const p = page ?? 1;
  const ps = pageSize ?? 20;
  if (!Number.isInteger(p) || p < 1) {
    throw new RangeError(`page must be a positive integer, got ${p}`);
  }
  if (!Number.isInteger(ps) || ps < 1 || ps > 100) {
    throw new RangeError(`pageSize must be between 1 and 100, got ${ps}`);
  }
  return { page: p, pageSize: ps };
}
