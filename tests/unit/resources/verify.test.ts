import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PSIPConfigSchema } from "../../../src/config.js";
import { VerifyResource } from "../../../src/resources/verify.js";
import { Transport } from "../../../src/transport.js";

const BASE_URL = "https://payments.test/api/v1/";

function makeResource() {
  const config = PSIPConfigSchema.parse({
    apiKey: "hp_test_aaaaaaaa",
    baseUrl: BASE_URL,
    userAgent: "psip-test/0.0.0",
    retry: { maxRetries: 0, backoffFactor: 0 },
  });
  return new VerifyResource(new Transport(config));
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("VerifyResource.run", () => {
  it("posts {order_id, price, currency} and returns {orderId, verified}", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}verify`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { order_id: "ord_1", verified: true },
        });
      }),
    );

    const res = await makeResource().run("ord_1", "9.99");
    expect(body).toEqual({ order_id: "ord_1", price: "9.99", currency: "usd" });
    expect(res).toEqual({ orderId: "ord_1", verified: true });
  });

  it("lowercases the currency on the wire", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}verify`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { order_id: "ord_1", verified: false },
        });
      }),
    );
    await makeResource().run("ord_1", 1, { currency: "EUR" });
    expect(captured.body.currency).toBe("eur");
  });

  it("accepts both number and string prices and serializes to a string", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}verify`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { order_id: "ord_1", verified: true },
        });
      }),
    );
    await makeResource().run("ord_1", 12);
    expect(captured.body.price).toBe("12");
  });

  it("rejects non-positive price before issuing a request", async () => {
    await expect(makeResource().run("ord_1", 0)).rejects.toThrowError(RangeError);
  });
});
