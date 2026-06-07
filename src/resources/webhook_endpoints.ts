/**
 * WebhookEndpoint subscription management — `/webhook-endpoints` endpoints.
 *
 * The `signingSecret` is returned ONLY on create + rotateSecret; subsequent
 * reads return blank. Persist it on creation.
 */

import type {
  WebhookEndpoint,
  WebhookEndpointCreateInput,
  WebhookEndpointListInput,
  WebhookEndpointPage,
  WebhookEndpointUpdateInput,
} from "../models/webhook_endpoint.js";
import {
  WebhookEndpointPageSchema,
  WebhookEndpointSchema,
  toWebhookEndpointCreateWireBody,
  toWebhookEndpointListQuery,
  toWebhookEndpointUpdateWireBody,
} from "../models/webhook_endpoint.js";
import { Resource, parseResponse } from "./_base.js";

export class WebhookEndpointsResource extends Resource {
  async create(input: WebhookEndpointCreateInput): Promise<WebhookEndpoint> {
    const data = await this.transport.request("POST", "webhook-endpoints", {
      json: toWebhookEndpointCreateWireBody(input),
    });
    return parseResponse(WebhookEndpointSchema, data);
  }

  async retrieve(endpointId: string): Promise<WebhookEndpoint> {
    const data = await this.transport.request(
      "GET",
      `webhook-endpoints/${encodeURIComponent(endpointId)}`,
    );
    return parseResponse(WebhookEndpointSchema, data);
  }

  async update(endpointId: string, input: WebhookEndpointUpdateInput): Promise<WebhookEndpoint> {
    const data = await this.transport.request(
      "POST",
      `webhook-endpoints/${encodeURIComponent(endpointId)}`,
      { json: toWebhookEndpointUpdateWireBody(input) },
    );
    return parseResponse(WebhookEndpointSchema, data);
  }

  async delete(endpointId: string): Promise<Record<string, unknown>> {
    return this.transport.request("DELETE", `webhook-endpoints/${encodeURIComponent(endpointId)}`);
  }

  /**
   * Mint a fresh signing secret. The old secret stops verifying
   * immediately on the server, so update consumers before calling this
   * unless you're rotating in response to a leak.
   */
  async rotateSecret(endpointId: string): Promise<WebhookEndpoint> {
    const data = await this.transport.request(
      "POST",
      `webhook-endpoints/${encodeURIComponent(endpointId)}/rotate-secret`,
    );
    return parseResponse(WebhookEndpointSchema, data);
  }

  async list(input: WebhookEndpointListInput = {}): Promise<WebhookEndpointPage> {
    const data = await this.transport.request("GET", "webhook-endpoints", {
      params: toWebhookEndpointListQuery(input),
    });
    return parseResponse(WebhookEndpointPageSchema, data);
  }
}
