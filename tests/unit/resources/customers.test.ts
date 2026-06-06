import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PSIPConfigSchema } from "../../../src/config.js";
import { CustomersResource } from "../../../src/resources/customers.js";
import { Transport } from "../../../src/transport.js";

const BASE_URL = "https://payments.test/api/v1/";

function makeResource() {
  const config = PSIPConfigSchema.parse({
    apiKey: "hp_test_aaaaaaaa",
    baseUrl: BASE_URL,
    userAgent: "psip-test/0.0.0",
    retry: { maxRetries: 0, backoffFactor: 0 },
  });
  return new CustomersResource(new Transport(config));
}

function makeWireCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: "cus_test_1",
    object: "customer",
    email: "user@example.com",
    name: "User",
    phone: "",
    description: "",
    metadata: {},
    is_test: true,
    deleted_at: null,
    created_at: "2026-06-05T11:00:00+00:00",
    updated_at: "2026-06-05T11:00:00+00:00",
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("CustomersResource.create", () => {
  it("posts snake_case body, parses snake_case response into camelCase", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}customers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "ok", message: "", data: makeWireCustomer() });
      }),
    );
    const cust = await makeResource().create({
      email: "user@example.com",
      name: "User",
      metadata: { tier: "gold" },
    });
    expect(body).toEqual({
      sandbox: true,
      email: "user@example.com",
      name: "User",
      metadata: { tier: "gold" },
    });
    expect(cust.id).toBe("cus_test_1");
    expect(cust.isTest).toBe(true);
    expect(cust.createdAt).toBe("2026-06-05T11:00:00+00:00");
  });

  it("rejects overlong description before issuing a request", async () => {
    await expect(makeResource().create({ description: "x".repeat(501) })).rejects.toThrowError(
      RangeError,
    );
  });
});

describe("CustomersResource.update", () => {
  it("posts only the supplied fields", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}customers/cus_test_1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: makeWireCustomer({ name: "New Name" }),
        });
      }),
    );
    const cust = await makeResource().update("cus_test_1", { name: "New Name" });
    expect(body).toEqual({ name: "New Name" });
    expect(cust.name).toBe("New Name");
  });
});

describe("CustomersResource.list", () => {
  it("serializes filters (snake_case) and parses the page", async () => {
    let url: string | null = null;
    server.use(
      http.get(`${BASE_URL}customers`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { results: [makeWireCustomer()], page: 1, page_size: 20, count: 1 },
        });
      }),
    );
    const page = await makeResource().list({ email: "user@example.com", sandbox: false });
    expect(url).toContain("email=user%40example.com");
    expect(url).toContain("sandbox=false");
    expect(url).toContain("page=1");
    expect(url).toContain("page_size=20");
    expect(page.results[0]?.email).toBe("user@example.com");
    expect(page.pageSize).toBe(20);
  });
});

describe("CustomersResource.listPaymentMethods", () => {
  it("parses the saved-card list with camelCase fields", async () => {
    server.use(
      http.get(`${BASE_URL}customers/cus_test_1/payment-methods`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: {
            object: "list",
            results: [
              {
                id: "pm_1",
                type: "card",
                card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
                customer: "cus_test_1",
              },
            ],
          },
        }),
      ),
    );
    const list = await makeResource().listPaymentMethods("cus_test_1");
    expect(list.results).toHaveLength(1);
    expect(list.results[0]?.card?.expMonth).toBe(12);
    expect(list.results[0]?.card?.expYear).toBe(2030);
    expect(list.results[0]?.card?.last4).toBe("4242");
  });
});

describe("CustomersResource.createPortalSession", () => {
  it("posts {return_url} (snake_case) and parses the {id, url} response", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}customers/cus_test_1/portal-sessions`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { id: "bps_1", url: "https://billing.stripe.com/p/session/bps_1" },
        });
      }),
    );
    const session = await makeResource().createPortalSession("cus_test_1", {
      returnUrl: "https://app.test/account",
    });
    expect(body).toEqual({ return_url: "https://app.test/account" });
    expect(session.id).toBe("bps_1");
    expect(session.url).toBe("https://billing.stripe.com/p/session/bps_1");
  });

  it("rejects a non-URL returnUrl before issuing the request", async () => {
    await expect(
      makeResource().createPortalSession("cus_test_1", { returnUrl: "not-a-url" }),
    ).rejects.toThrowError(TypeError);
  });
});
