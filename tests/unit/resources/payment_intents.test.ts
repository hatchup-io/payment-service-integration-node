import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PSIPConfigSchema } from "../../../src/config.js";
import { PSIPProtocolError } from "../../../src/exceptions.js";
import { PaymentIntentsResource } from "../../../src/resources/payment_intents.js";
import { Transport } from "../../../src/transport.js";

const BASE_URL = "https://payments.test/api/v1/";

function makeResource() {
  const config = PSIPConfigSchema.parse({
    apiKey: "hp_test_aaaaaaaa",
    baseUrl: BASE_URL,
    userAgent: "psip-test/0.0.0",
    retry: { maxRetries: 0, backoffFactor: 0 },
  });
  return new PaymentIntentsResource(new Transport(config));
}

function makePiWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "pi_1",
    object: "payment_intent",
    amount: "12.50",
    currency: "usd",
    status: "requires_capture",
    client_secret: "pi_1_secret_abc",
    customer: "cus_1",
    payment_method: "pm_1",
    payment_method_details: { type: "card", brand: "visa", last4: "4242" },
    metadata: {},
    is_test: true,
    last_error_message: null,
    cancellation_reason: null,
    created_at: "2026-06-07T10:00:00+00:00",
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("PaymentIntentsResource", () => {
  it("create posts amount as string + camelCase → snake_case translation", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}payment-intents`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "ok", message: "", data: makePiWire() });
      }),
    );
    const pi = await makeResource().create({
      amount: 12.5,
      customer: "cus_1",
      paymentMethod: "pm_1",
      captureMethod: "manual",
      successWebhook: "https://app.test/s",
      failureWebhook: "https://app.test/f",
    });
    expect(captured.body).toEqual({
      amount: "12.5",
      currency: "usd",
      confirm: false,
      capture_method: "manual",
      sandbox: true,
      customer: "cus_1",
      payment_method: "pm_1",
      success_webhook: "https://app.test/s",
      failure_webhook: "https://app.test/f",
    });
    expect(pi.id).toBe("pi_1");
    expect(pi.clientSecret).toBe("pi_1_secret_abc");
    expect(pi.paymentMethod).toBe("pm_1");
  });

  it("create rejects non-positive amount", async () => {
    await expect(makeResource().create({ amount: 0 })).rejects.toThrowError(RangeError);
  });

  it("confirm posts payment_method when supplied", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}payment-intents/pi_1/confirm`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "ok", message: "", data: makePiWire() });
      }),
    );
    await makeResource().confirm("pi_1", { paymentMethod: "pm_2" });
    expect(captured.body).toEqual({ payment_method: "pm_2" });
  });

  it("capture posts amount_to_capture as snake_case string", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}payment-intents/pi_1/capture`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: makePiWire({ status: "succeeded" }),
        });
      }),
    );
    const pi = await makeResource().capture("pi_1", { amountToCapture: "5.00" });
    expect(captured.body).toEqual({ amount_to_capture: "5.00" });
    expect(pi.status).toBe("succeeded");
  });

  it("cancel posts cancellation_reason as snake_case", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}payment-intents/pi_1/cancel`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: makePiWire({ status: "canceled", cancellation_reason: "fraudulent" }),
        });
      }),
    );
    const pi = await makeResource().cancel("pi_1", { cancellationReason: "fraudulent" });
    expect(captured.body).toEqual({ cancellation_reason: "fraudulent" });
    expect(pi.cancellationReason).toBe("fraudulent");
    expect(pi.status).toBe("canceled");
  });

  it("list serializes customer + status filters", async () => {
    let url = "";
    server.use(
      http.get(`${BASE_URL}payment-intents`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { results: [makePiWire()], page: 1, page_size: 20, count: 1 },
        });
      }),
    );
    await makeResource().list({ customer: "cus_1", status: "succeeded" });
    expect(url).toContain("customer=cus_1");
    expect(url).toContain("status=succeeded");
  });

  it("wraps malformed status into PSIPProtocolError", async () => {
    server.use(
      http.get(`${BASE_URL}payment-intents/pi_1`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: makePiWire({ status: "weird" }),
        }),
      ),
    );
    await expect(makeResource().retrieve("pi_1")).rejects.toBeInstanceOf(PSIPProtocolError);
  });
});
