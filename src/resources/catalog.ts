/**
 * Products + Prices resources — `/products` and `/prices` endpoints.
 */

import type {
  Price,
  PriceCreateInput,
  PriceListInput,
  PricePage,
  Product,
  ProductCreateInput,
  ProductListInput,
  ProductPage,
  ProductUpdateInput,
} from "../models/catalog.js";
import {
  PricePageSchema,
  PriceSchema,
  ProductPageSchema,
  ProductSchema,
  toPriceCreateWireBody,
  toPriceListQuery,
  toProductCreateWireBody,
  toProductListQuery,
  toProductUpdateWireBody,
} from "../models/catalog.js";
import { Resource, parseResponse } from "./_base.js";

export class ProductsResource extends Resource {
  async create(input: ProductCreateInput): Promise<Product> {
    const data = await this.transport.request("POST", "products", {
      json: toProductCreateWireBody(input),
    });
    return parseResponse(ProductSchema, data);
  }

  async retrieve(stripeProductId: string): Promise<Product> {
    const data = await this.transport.request(
      "GET",
      `products/${encodeURIComponent(stripeProductId)}`,
    );
    return parseResponse(ProductSchema, data);
  }

  async update(stripeProductId: string, input: ProductUpdateInput): Promise<Product> {
    const data = await this.transport.request(
      "POST",
      `products/${encodeURIComponent(stripeProductId)}`,
      { json: toProductUpdateWireBody(input) },
    );
    return parseResponse(ProductSchema, data);
  }

  async list(input: ProductListInput = {}): Promise<ProductPage> {
    const data = await this.transport.request("GET", "products", {
      params: toProductListQuery(input),
    });
    return parseResponse(ProductPageSchema, data);
  }
}

export class PricesResource extends Resource {
  async create(input: PriceCreateInput): Promise<Price> {
    const data = await this.transport.request("POST", "prices", {
      json: toPriceCreateWireBody(input),
    });
    return parseResponse(PriceSchema, data);
  }

  async retrieve(stripePriceId: string): Promise<Price> {
    const data = await this.transport.request("GET", `prices/${encodeURIComponent(stripePriceId)}`);
    return parseResponse(PriceSchema, data);
  }

  /**
   * Soft-deactivate a price (Stripe disallows hard-delete on prices).
   * Idempotent — the server returns the deactivation record either way.
   */
  async deactivate(stripePriceId: string): Promise<Record<string, unknown>> {
    return this.transport.request("DELETE", `prices/${encodeURIComponent(stripePriceId)}`);
  }

  async list(input: PriceListInput = {}): Promise<PricePage> {
    const data = await this.transport.request("GET", "prices", {
      params: toPriceListQuery(input),
    });
    return parseResponse(PricePageSchema, data);
  }
}
