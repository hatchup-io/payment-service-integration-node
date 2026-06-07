/**
 * Models for the `/webhook-endpoints` endpoints.
 *
 * The `signingSecret` is returned ONLY in the responses to `create` and
 * `rotateSecret`; subsequent reads return an empty string. Persist it on
 * creation.
 */

import { z } from "zod";

// --------------------------------------------------------------------- //
// Requests
// --------------------------------------------------------------------- //

export interface WebhookEndpointCreateInput {
  url: string;
  subscribedEvents: string[];
  description?: string;
}

export function toWebhookEndpointCreateWireBody(
  input: WebhookEndpointCreateInput,
): Record<string, unknown> {
  validateUrl(input.url);
  if (input.subscribedEvents.length === 0) {
    throw new RangeError("subscribedEvents must contain at least one event type");
  }
  if (input.description !== undefined && input.description.length > 255) {
    throw new RangeError(`description must be at most 255 chars, got ${input.description.length}`);
  }
  const body: Record<string, unknown> = {
    url: input.url,
    subscribed_events: input.subscribedEvents,
  };
  if (input.description !== undefined) body.description = input.description;
  return body;
}

export interface WebhookEndpointUpdateInput {
  url?: string;
  subscribedEvents?: string[];
  description?: string;
  isActive?: boolean;
}

export function toWebhookEndpointUpdateWireBody(
  input: WebhookEndpointUpdateInput,
): Record<string, unknown> {
  if (input.url !== undefined) validateUrl(input.url);
  if (input.subscribedEvents !== undefined && input.subscribedEvents.length === 0) {
    throw new RangeError("subscribedEvents must be non-empty when provided");
  }
  if (input.description !== undefined && input.description.length > 255) {
    throw new RangeError(`description must be at most 255 chars, got ${input.description.length}`);
  }
  const body: Record<string, unknown> = {};
  if (input.url !== undefined) body.url = input.url;
  if (input.subscribedEvents !== undefined) body.subscribed_events = input.subscribedEvents;
  if (input.description !== undefined) body.description = input.description;
  if (input.isActive !== undefined) body.is_active = input.isActive;
  return body;
}

// --------------------------------------------------------------------- //
// Response
// --------------------------------------------------------------------- //

export const WebhookEndpointSchema = z
  .object({
    id: z.string(),
    object: z.string().default("webhook_endpoint"),
    url: z.string(),
    description: z.string().default(""),
    subscribed_events: z.array(z.string()).default([]),
    is_active: z.boolean().default(true),
    signing_secret: z.string().default(""),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    object: wire.object,
    url: wire.url,
    description: wire.description,
    subscribedEvents: wire.subscribed_events,
    isActive: wire.is_active,
    signingSecret: wire.signing_secret,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  }));

export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;

export const WebhookEndpointPageSchema = z
  .object({
    results: z.array(WebhookEndpointSchema).default([]),
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

export type WebhookEndpointPage = z.infer<typeof WebhookEndpointPageSchema>;

export interface WebhookEndpointListInput {
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export function toWebhookEndpointListQuery(
  input: WebhookEndpointListInput = {},
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
  if (input.active !== undefined) params.active = input.active ? "true" : "false";
  return params;
}

function validateUrl(url: string): void {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new TypeError(`webhook url must be http(s), got ${JSON.stringify(url)}`);
  }
}
