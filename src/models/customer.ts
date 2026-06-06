/**
 * Models for the `/customers` endpoints.
 */

import { z } from "zod";

// --------------------------------------------------------------------- //
// Requests
// --------------------------------------------------------------------- //

export interface CustomerCreateInput {
  email?: string;
  name?: string;
  phone?: string;
  /** Free-text, max 500 chars. */
  description?: string;
  sandbox?: boolean;
  metadata?: Record<string, string>;
}

export function toCustomerCreateWireBody(input: CustomerCreateInput): Record<string, unknown> {
  validateDescriptionLength(input.description);
  const body: Record<string, unknown> = { sandbox: input.sandbox ?? true };
  if (input.email !== undefined) body.email = input.email;
  if (input.name !== undefined) body.name = input.name;
  if (input.phone !== undefined) body.phone = input.phone;
  if (input.description !== undefined) body.description = input.description;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

export interface CustomerUpdateInput {
  email?: string;
  name?: string;
  phone?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export function toCustomerUpdateWireBody(input: CustomerUpdateInput): Record<string, unknown> {
  validateDescriptionLength(input.description);
  const body: Record<string, unknown> = {};
  if (input.email !== undefined) body.email = input.email;
  if (input.name !== undefined) body.name = input.name;
  if (input.phone !== undefined) body.phone = input.phone;
  if (input.description !== undefined) body.description = input.description;
  if (input.metadata !== undefined) body.metadata = input.metadata;
  return body;
}

// --------------------------------------------------------------------- //
// Responses
// --------------------------------------------------------------------- //

export const CustomerSchema = z
  .object({
    id: z.string(),
    object: z.string().default("customer"),
    email: z.string().default(""),
    name: z.string().default(""),
    phone: z.string().default(""),
    description: z.string().default(""),
    metadata: z.record(z.string(), z.unknown()).default({}),
    is_test: z.boolean().default(true),
    deleted_at: z.string().datetime({ offset: true }).nullable().optional(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    object: wire.object,
    email: wire.email,
    name: wire.name,
    phone: wire.phone,
    description: wire.description,
    metadata: wire.metadata,
    isTest: wire.is_test,
    deletedAt: wire.deleted_at ?? null,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  }));

export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerListPageSchema = z
  .object({
    results: z.array(CustomerSchema).default([]),
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

export type CustomerListPage = z.infer<typeof CustomerListPageSchema>;

export const PaymentMethodCardSchema = z
  .object({
    brand: z.string().default(""),
    last4: z.string().default(""),
    exp_month: z.number().int().nullable().optional(),
    exp_year: z.number().int().nullable().optional(),
  })
  .passthrough()
  .transform((wire) => ({
    brand: wire.brand,
    last4: wire.last4,
    expMonth: wire.exp_month ?? null,
    expYear: wire.exp_year ?? null,
  }));

export type PaymentMethodCard = z.infer<typeof PaymentMethodCardSchema>;

export const PaymentMethodSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    card: PaymentMethodCardSchema.nullable().optional(),
    customer: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    type: wire.type,
    card: wire.card ?? null,
    customer: wire.customer ?? null,
  }));

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentMethodListSchema = z
  .object({
    object: z.string().default("list"),
    results: z.array(PaymentMethodSchema).default([]),
  })
  .passthrough()
  .transform((wire) => ({
    object: wire.object,
    results: wire.results,
  }));

export type PaymentMethodList = z.infer<typeof PaymentMethodListSchema>;

export interface CustomerPortalSessionInput {
  returnUrl: string;
}

export function toCustomerPortalSessionWireBody(
  input: CustomerPortalSessionInput,
): Record<string, unknown> {
  if (!input.returnUrl.startsWith("http://") && !input.returnUrl.startsWith("https://")) {
    throw new TypeError(`returnUrl must be a URL, got ${JSON.stringify(input.returnUrl)}`);
  }
  return { return_url: input.returnUrl };
}

export const CustomerPortalSessionSchema = z
  .object({
    id: z.string(),
    url: z.string(),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    url: wire.url,
  }));

export type CustomerPortalSession = z.infer<typeof CustomerPortalSessionSchema>;

export interface CustomerListInput {
  email?: string;
  sandbox?: boolean;
  page?: number;
  pageSize?: number;
}

export function toCustomerListQuery(input: CustomerListInput = {}): Record<string, string> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError(`page must be a positive integer, got ${page}`);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError(`pageSize must be between 1 and 100, got ${pageSize}`);
  }
  const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
  if (input.email !== undefined) params.email = input.email;
  if (input.sandbox !== undefined) params.sandbox = input.sandbox ? "true" : "false";
  return params;
}

// --------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------- //

function validateDescriptionLength(description: string | undefined): void {
  if (description !== undefined && description.length > 500) {
    throw new RangeError(`description must be at most 500 chars, got ${description.length}`);
  }
}
