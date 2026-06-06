import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PSIPConfigSchema } from "../../../src/config.js";
import { PSIPProtocolError } from "../../../src/exceptions.js";
import { TransactionsResource } from "../../../src/resources/transactions.js";
import { Transport } from "../../../src/transport.js";

const BASE_URL = "https://payments.test/api/v1/";

function makeResource() {
  const config = PSIPConfigSchema.parse({
    apiKey: "hp_test_aaaaaaaa",
    baseUrl: BASE_URL,
    userAgent: "psip-test/0.0.0",
    retry: { maxRetries: 0, backoffFactor: 0 },
  });
  return new TransactionsResource(new Transport(config));
}

function makeWireTx(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    order_id: "ord_1",
    amount: "9.99",
    currency: "usd",
    status: "succeeded",
    is_test: true,
    verified_at: "2026-06-05T12:00:00+00:00",
    created_at: "2026-06-05T11:59:00+00:00",
    stripe_checkout_session_id: "cs_test_1",
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("TransactionsResource.list", () => {
  it("sends filters as query params (snake_case) and parses the page", async () => {
    let url: string | null = null;
    server.use(
      http.get(`${BASE_URL}transactions`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { results: [makeWireTx()], page: 1, page_size: 20, count: 1 },
        });
      }),
    );

    const page = await makeResource().list({
      status: "succeeded",
      sandbox: true,
      verified: false,
      orderIdStartswith: "proj_abc_",
      dateFrom: new Date(Date.UTC(2026, 5, 1)),
      page: 2,
      pageSize: 50,
    });

    expect(url).toContain("status=succeeded");
    expect(url).toContain("sandbox=true");
    expect(url).toContain("verified=false");
    expect(url).toContain("order_id_startswith=proj_abc_");
    expect(url).toContain("date_from=2026-06-01");
    expect(url).toContain("page=2");
    expect(url).toContain("page_size=50");

    expect(page.results).toHaveLength(1);
    expect(page.results[0]?.orderId).toBe("ord_1");
    expect(page.results[0]?.isTest).toBe(true);
    expect(page.results[0]?.verifiedAt).toBe("2026-06-05T12:00:00+00:00");
    expect(page.results[0]?.stripeCheckoutSessionId).toBe("cs_test_1");
    expect(page.pageSize).toBe(20);
    expect(page.hasMore).toBe(false);
  });

  it("computes hasMore=true when the page is full", async () => {
    server.use(
      http.get(`${BASE_URL}transactions`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: {
            results: Array.from({ length: 20 }, (_, i) =>
              makeWireTx({ id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}` }),
            ),
            page: 1,
            page_size: 20,
            count: 20,
          },
        }),
      ),
    );
    const page = await makeResource().list({});
    expect(page.hasMore).toBe(true);
  });

  it("rejects pageSize > 100 before issuing a request", async () => {
    await expect(makeResource().list({ pageSize: 101 })).rejects.toThrowError(RangeError);
  });
});

describe("TransactionsResource.get", () => {
  it("URL-encodes the id segment", async () => {
    let url: string | null = null;
    server.use(
      http.get(`${BASE_URL}transactions/:id`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ status: "ok", message: "", data: makeWireTx() });
      }),
    );
    await makeResource().get("ord/with/slashes");
    expect(url).toContain("transactions/ord%2Fwith%2Fslashes");
  });

  it("wraps a malformed tx into PSIPProtocolError", async () => {
    server.use(
      http.get(`${BASE_URL}transactions/:id`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: makeWireTx({ status: "weird-status" }),
        }),
      ),
    );
    await expect(makeResource().get("ord_1")).rejects.toBeInstanceOf(PSIPProtocolError);
  });
});

describe("TransactionsResource.iterAll", () => {
  it("walks pages until hasMore=false (partial last page)", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE_URL}transactions`, ({ request }) => {
        callCount += 1;
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page"));
        const pageSize = 20;
        const total = 45;
        const start = (page - 1) * pageSize;
        const end = Math.min(start + pageSize, total);
        const results = Array.from({ length: end - start }, (_, i) =>
          makeWireTx({
            id: `00000000-0000-0000-0000-${String(start + i).padStart(12, "0")}`,
            order_id: `ord_${start + i}`,
          }),
        );
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { results, page, page_size: pageSize, count: results.length },
        });
      }),
    );

    const collected: string[] = [];
    for await (const tx of makeResource().iterAll({})) {
      collected.push(tx.orderId);
    }
    expect(collected).toHaveLength(45);
    expect(collected[0]).toBe("ord_0");
    expect(collected[44]).toBe("ord_44");
    expect(callCount).toBe(3); // page 1 (20) + page 2 (20) + page 3 (5)
  });

  it("stops after a single page when the result count is below pageSize", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE_URL}transactions`, () => {
        callCount += 1;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { results: [makeWireTx()], page: 1, page_size: 20, count: 1 },
        });
      }),
    );
    const collected = [];
    for await (const tx of makeResource().iterAll({})) collected.push(tx);
    expect(collected).toHaveLength(1);
    expect(callCount).toBe(1);
  });
});
