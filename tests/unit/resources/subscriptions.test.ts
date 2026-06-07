import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PSIPConfigSchema } from "../../../src/config.js";
import { SubscriptionsResource } from "../../../src/resources/subscriptions.js";
import { Transport } from "../../../src/transport.js";

const BASE_URL = "https://payments.test/api/v1/";

function makeResource() {
  const config = PSIPConfigSchema.parse({
    apiKey: "hp_test_aaaaaaaa",
    baseUrl: BASE_URL,
    userAgent: "psip-test/0.0.0",
    retry: { maxRetries: 0, backoffFactor: 0 },
  });
  return new SubscriptionsResource(new Transport(config));
}

function makeSubWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: "active",
    items: [{ stripe_subscription_item_id: "si_1", price_id: "price_1", quantity: 1 }],
    current_period_start: "2026-06-01T00:00:00+00:00",
    current_period_end: "2026-07-01T00:00:00+00:00",
    trial_start: null,
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_reason: null,
    default_payment_method: "pm_1",
    latest_invoice: "in_1",
    metadata: {},
    is_test: true,
    created_at: "2026-06-01T00:00:00+00:00",
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("SubscriptionsResource", () => {
  it("create posts items + customer + sandbox", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}subscriptions`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "ok", message: "", data: makeSubWire() });
      }),
    );
    const sub = await makeResource().create({
      customer: "cus_1",
      items: [{ price: "price_1", quantity: 2 }],
      trialPeriodDays: 7,
      defaultPaymentMethod: "pm_1",
    });
    expect(captured.body).toEqual({
      customer: "cus_1",
      items: [{ deleted: false, price: "price_1", quantity: 2 }],
      sandbox: true,
      trial_period_days: 7,
      default_payment_method: "pm_1",
    });
    expect(sub.items[0]?.stripeSubscriptionItemId).toBe("si_1");
    expect(sub.items[0]?.priceId).toBe("price_1");
    expect(sub.defaultPaymentMethod).toBe("pm_1");
    expect(sub.currentPeriodStart).toBe("2026-06-01T00:00:00+00:00");
  });

  it("create rejects when items[] is empty", async () => {
    await expect(makeResource().create({ customer: "cus_1", items: [] })).rejects.toThrowError(
      RangeError,
    );
  });

  it("create rejects an item with neither id nor price", async () => {
    await expect(
      makeResource().create({ customer: "cus_1", items: [{ quantity: 1 }] }),
    ).rejects.toThrowError(RangeError);
  });

  it("update sends prorationBehavior as snake_case proration_behavior", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}subscriptions/sub_1`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "ok", message: "", data: makeSubWire() });
      }),
    );
    await makeResource().update("sub_1", {
      prorationBehavior: "create_prorations",
      cancelAtPeriodEnd: true,
    });
    expect(captured.body).toEqual({
      proration_behavior: "create_prorations",
      cancel_at_period_end: true,
    });
  });

  it("cancel posts at_period_end + invoice_now defaults", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}subscriptions/sub_1/cancel`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: makeSubWire({ status: "canceled", canceled_at: "2026-06-07T11:00:00+00:00" }),
        });
      }),
    );
    const sub = await makeResource().cancel("sub_1", {
      cancellationReason: "too_expensive",
    });
    expect(captured.body).toEqual({
      at_period_end: false,
      invoice_now: false,
      cancellation_reason: "too_expensive",
    });
    expect(sub.status).toBe("canceled");
    expect(sub.canceledAt).toBe("2026-06-07T11:00:00+00:00");
  });

  it("resume issues POST with no body", async () => {
    server.use(
      http.post(`${BASE_URL}subscriptions/sub_1/resume`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: makeSubWire({ status: "active" }),
        }),
      ),
    );
    const sub = await makeResource().resume("sub_1");
    expect(sub.status).toBe("active");
  });
});
