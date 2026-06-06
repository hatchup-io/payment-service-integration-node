/**
 * Customers resource: `/customers` endpoints.
 */

import type {
  Customer,
  CustomerCreateInput,
  CustomerListInput,
  CustomerListPage,
  CustomerPortalSession,
  CustomerPortalSessionInput,
  CustomerUpdateInput,
  PaymentMethodList,
} from "../models/customer.js";
import {
  CustomerListPageSchema,
  CustomerPortalSessionSchema,
  CustomerSchema,
  PaymentMethodListSchema,
  toCustomerCreateWireBody,
  toCustomerListQuery,
  toCustomerPortalSessionWireBody,
  toCustomerUpdateWireBody,
} from "../models/customer.js";
import { Resource, parseResponse } from "./_base.js";

export class CustomersResource extends Resource {
  /**
   * Create a new Stripe customer through the gateway. Use the `email`
   * filter on `list()` to implement get-or-create: catch a 409 on
   * `create()` and recover with `list({ email })`.
   */
  async create(input: CustomerCreateInput = {}): Promise<Customer> {
    const data = await this.transport.request("POST", "customers", {
      json: toCustomerCreateWireBody(input),
    });
    return parseResponse(CustomerSchema, data);
  }

  async retrieve(stripeCustomerId: string): Promise<Customer> {
    const data = await this.transport.request(
      "GET",
      `customers/${encodeURIComponent(stripeCustomerId)}`,
    );
    return parseResponse(CustomerSchema, data);
  }

  async update(stripeCustomerId: string, input: CustomerUpdateInput): Promise<Customer> {
    const data = await this.transport.request(
      "POST",
      `customers/${encodeURIComponent(stripeCustomerId)}`,
      { json: toCustomerUpdateWireBody(input) },
    );
    return parseResponse(CustomerSchema, data);
  }

  async delete(stripeCustomerId: string): Promise<Record<string, unknown>> {
    return this.transport.request("DELETE", `customers/${encodeURIComponent(stripeCustomerId)}`);
  }

  async list(input: CustomerListInput = {}): Promise<CustomerListPage> {
    const data = await this.transport.request("GET", "customers", {
      params: toCustomerListQuery(input),
    });
    return parseResponse(CustomerListPageSchema, data);
  }

  async listPaymentMethods(stripeCustomerId: string): Promise<PaymentMethodList> {
    const data = await this.transport.request(
      "GET",
      `customers/${encodeURIComponent(stripeCustomerId)}/payment-methods`,
    );
    return parseResponse(PaymentMethodListSchema, data);
  }

  async createPortalSession(
    stripeCustomerId: string,
    input: CustomerPortalSessionInput,
  ): Promise<CustomerPortalSession> {
    const data = await this.transport.request(
      "POST",
      `customers/${encodeURIComponent(stripeCustomerId)}/portal-sessions`,
      { json: toCustomerPortalSessionWireBody(input) },
    );
    return parseResponse(CustomerPortalSessionSchema, data);
  }
}
