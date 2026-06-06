import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PaymentServiceClient } from "../../src/client.js";
import { PSIPConfigSchema } from "../../src/config.js";
import { CustomersResource } from "../../src/resources/customers.js";
import { PaymentsResource } from "../../src/resources/payments.js";
import { TransactionsResource } from "../../src/resources/transactions.js";

const BASE_URL = "https://payments.test/api/v1/";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("PaymentServiceClient", () => {
  it("constructs from raw PSIPConfigInput by parsing through the schema", () => {
    const client = new PaymentServiceClient({
      apiKey: "hp_test_aaaaaaaa",
      baseUrl: BASE_URL,
    });
    // Parsed config has the resolved defaults populated.
    expect(client.config.userAgent).toMatch(/^hatchup-psip\/\d+\.\d+\.\d+/);
    expect(client.config.retry.maxRetries).toBe(2);
  });

  it("accepts an already-parsed PSIPConfig without re-validating", () => {
    const parsed = PSIPConfigSchema.parse({
      apiKey: "hp_test_aaaaaaaa",
      baseUrl: BASE_URL,
      userAgent: "custom-ua/1.0",
    });
    const client = new PaymentServiceClient(parsed);
    expect(client.config).toEqual(parsed);
    expect(client.config.userAgent).toBe("custom-ua/1.0");
  });

  it("exposes resource instances of the right classes", () => {
    const client = new PaymentServiceClient({
      apiKey: "hp_test_aaaaaaaa",
      baseUrl: BASE_URL,
    });
    expect(client.payments).toBeInstanceOf(PaymentsResource);
    expect(client.transactions).toBeInstanceOf(TransactionsResource);
    expect(client.customers).toBeInstanceOf(CustomersResource);
  });

  it("client.verify(orderId, price) makes the verify call directly", async () => {
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
    const client = new PaymentServiceClient({
      apiKey: "hp_test_aaaaaaaa",
      baseUrl: BASE_URL,
      retry: { maxRetries: 0, backoffFactor: 0 },
    });
    const res = await client.verify("ord_1", "9.99");
    expect(body).toEqual({ order_id: "ord_1", price: "9.99", currency: "usd" });
    expect(res).toEqual({ orderId: "ord_1", verified: true });
  });

  it("client.verify forwards currency override", async () => {
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
    const client = new PaymentServiceClient({
      apiKey: "hp_test_aaaaaaaa",
      baseUrl: BASE_URL,
      retry: { maxRetries: 0, backoffFactor: 0 },
    });
    await client.verify("ord_1", "9.99", { currency: "EUR" });
    expect(captured.body.currency).toBe("eur");
  });
});
