import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PSIPConfigSchema } from "../../../src/config.js";
import { PricesResource, ProductsResource } from "../../../src/resources/catalog.js";
import { Transport } from "../../../src/transport.js";

const BASE_URL = "https://payments.test/api/v1/";

function makeTransport() {
  const config = PSIPConfigSchema.parse({
    apiKey: "hp_test_aaaaaaaa",
    baseUrl: BASE_URL,
    userAgent: "psip-test/0.0.0",
    retry: { maxRetries: 0, backoffFactor: 0 },
  });
  return new Transport(config);
}

function makeProductWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod_1",
    object: "product",
    name: "Pro plan",
    description: "",
    metadata: {},
    is_active: true,
    is_test: true,
    created_at: "2026-06-07T10:00:00+00:00",
    updated_at: "2026-06-07T10:00:00+00:00",
    ...overrides,
  };
}

function makePriceWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "price_1",
    object: "price",
    product: "prod_1",
    unit_amount: "29.99",
    currency: "usd",
    recurring: { interval: "month", interval_count: 1 },
    nickname: "monthly",
    metadata: {},
    is_active: true,
    is_test: true,
    created_at: "2026-06-07T10:00:00+00:00",
    updated_at: "2026-06-07T10:00:00+00:00",
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("ProductsResource", () => {
  it("create posts snake_case body and parses snake_case response", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}products`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "ok", message: "", data: makeProductWire() });
      }),
    );
    const prod = await new ProductsResource(makeTransport()).create({
      name: "Pro plan",
      sandbox: false,
    });
    expect(captured.body).toEqual({ name: "Pro plan", sandbox: false });
    expect(prod.id).toBe("prod_1");
    expect(prod.isActive).toBe(true);
  });

  it("update sends only the supplied fields and translates isActive → is_active", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}products/prod_1`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: makeProductWire({ is_active: false }),
        });
      }),
    );
    const prod = await new ProductsResource(makeTransport()).update("prod_1", { isActive: false });
    expect(captured.body).toEqual({ is_active: false });
    expect(prod.isActive).toBe(false);
  });

  it("create rejects empty name before issuing a request", async () => {
    await expect(new ProductsResource(makeTransport()).create({ name: "" })).rejects.toThrowError(
      RangeError,
    );
  });

  it("list serializes active filter as the string 'true'/'false'", async () => {
    let url = "";
    server.use(
      http.get(`${BASE_URL}products`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { results: [makeProductWire()], page: 1, page_size: 20, count: 1 },
        });
      }),
    );
    await new ProductsResource(makeTransport()).list({ active: true });
    expect(url).toContain("active=true");
  });
});

describe("PricesResource", () => {
  it("create posts unit_amount as string + recurring_interval snake_case", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}prices`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "ok", message: "", data: makePriceWire() });
      }),
    );
    const price = await new PricesResource(makeTransport()).create({
      product: "prod_1",
      unitAmount: 29.99,
      recurringInterval: "month",
      recurringIntervalCount: 1,
      nickname: "monthly",
    });
    expect(captured.body).toEqual({
      product: "prod_1",
      unit_amount: "29.99",
      currency: "usd",
      recurring_interval: "month",
      recurring_interval_count: 1,
      sandbox: true,
      nickname: "monthly",
    });
    expect(price.unitAmount).toBe("29.99");
    expect(price.recurring?.interval).toBe("month");
    expect(price.recurring?.intervalCount).toBe(1);
  });

  it("create rejects non-positive unitAmount", async () => {
    await expect(
      new PricesResource(makeTransport()).create({ product: "prod_1", unitAmount: 0 }),
    ).rejects.toThrowError(RangeError);
  });

  it("list serializes product/active/recurring as snake_case query params", async () => {
    let url = "";
    server.use(
      http.get(`${BASE_URL}prices`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { results: [makePriceWire()], page: 1, page_size: 20, count: 1 },
        });
      }),
    );
    await new PricesResource(makeTransport()).list({
      product: "prod_1",
      active: true,
      recurring: true,
    });
    expect(url).toContain("product=prod_1");
    expect(url).toContain("active=true");
    expect(url).toContain("recurring=true");
  });

  it("deactivate issues DELETE and returns the raw envelope data", async () => {
    let method = "";
    server.use(
      http.delete(`${BASE_URL}prices/price_1`, ({ request }) => {
        method = request.method;
        return HttpResponse.json({ status: "ok", message: "", data: { id: "price_1" } });
      }),
    );
    const result = await new PricesResource(makeTransport()).deactivate("price_1");
    expect(method).toBe("DELETE");
    expect(result).toEqual({ id: "price_1" });
  });
});
