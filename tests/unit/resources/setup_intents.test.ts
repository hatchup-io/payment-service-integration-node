import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PSIPConfigSchema } from "../../../src/config.js";
import {
  PaymentMethodsResource,
  SetupIntentsResource,
} from "../../../src/resources/setup_intents.js";
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

function makeSiWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "seti_1",
    object: "setup_intent",
    status: "requires_payment_method",
    client_secret: "seti_1_secret_abc",
    customer: "cus_1",
    payment_method: null,
    usage: "off_session",
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

describe("SetupIntentsResource", () => {
  it("create posts usage + confirm + sandbox defaults", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}setup-intents`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "ok", message: "", data: makeSiWire() });
      }),
    );
    const si = await new SetupIntentsResource(makeTransport()).create({
      customer: "cus_1",
    });
    expect(captured.body).toEqual({
      usage: "off_session",
      confirm: false,
      sandbox: true,
      customer: "cus_1",
    });
    expect(si.id).toBe("seti_1");
    expect(si.clientSecret).toBe("seti_1_secret_abc");
    expect(si.usage).toBe("off_session");
  });

  it("confirm posts payment_method", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}setup-intents/seti_1/confirm`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: makeSiWire({ status: "succeeded", payment_method: "pm_2" }),
        });
      }),
    );
    const si = await new SetupIntentsResource(makeTransport()).confirm("seti_1", {
      paymentMethod: "pm_2",
    });
    expect(captured.body).toEqual({ payment_method: "pm_2" });
    expect(si.paymentMethod).toBe("pm_2");
  });

  it("cancel issues POST with no body", async () => {
    server.use(
      http.post(`${BASE_URL}setup-intents/seti_1/cancel`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: makeSiWire({ status: "canceled" }),
        }),
      ),
    );
    const si = await new SetupIntentsResource(makeTransport()).cancel("seti_1");
    expect(si.status).toBe("canceled");
  });
});

describe("PaymentMethodsResource.detach", () => {
  it("POSTs to /payment-methods/:id/detach and returns {id, detached}", async () => {
    server.use(
      http.post(`${BASE_URL}payment-methods/pm_1/detach`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: { id: "pm_1", detached: true },
        }),
      ),
    );
    const res = await new PaymentMethodsResource(makeTransport()).detach("pm_1");
    expect(res).toEqual({ id: "pm_1", detached: true });
  });
});
