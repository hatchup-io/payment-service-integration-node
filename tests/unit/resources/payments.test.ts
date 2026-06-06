import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PSIPConfigSchema } from "../../../src/config.js";
import { PSIPProtocolError } from "../../../src/exceptions.js";
import { PaymentsResource } from "../../../src/resources/payments.js";
import { Transport } from "../../../src/transport.js";

const BASE_URL = "https://payments.test/api/v1/";

function makeResource() {
  const config = PSIPConfigSchema.parse({
    apiKey: "hp_test_aaaaaaaa",
    baseUrl: BASE_URL,
    userAgent: "psip-test/0.0.0",
    retry: { maxRetries: 0, backoffFactor: 0 },
  });
  return new PaymentsResource(new Transport(config));
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("PaymentsResource.create", () => {
  it("posts snake_case body and parses snake_case response into camelCase", async () => {
    let captured: Request | null = null;
    server.use(
      http.post(`${BASE_URL}payment`, ({ request }) => {
        captured = request.clone();
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: {
            payment_url: "https://checkout.stripe.com/c/pay/cs_test_1",
            session_id: "cs_test_1",
            order_id: "ord_2026_06_001",
          },
        });
      }),
    );

    const res = await makeResource().create({
      price: "9.99",
      orderId: "ord_2026_06_001",
      successWebhook: "https://app.test/success",
      failureWebhook: "https://app.test/failure",
      customer: "cus_abc",
      createInvoice: true,
      metadata: { project: "proj_1" },
    });

    expect(res).toEqual({
      paymentUrl: "https://checkout.stripe.com/c/pay/cs_test_1",
      sessionId: "cs_test_1",
      orderId: "ord_2026_06_001",
    });

    const body = await (captured as unknown as Request).json();
    expect(body).toEqual({
      price: "9.99",
      currency: "usd",
      order_id: "ord_2026_06_001",
      payment_type: "one_time",
      success_webhook: "https://app.test/success",
      failure_webhook: "https://app.test/failure",
      sandbox: true,
      customer: "cus_abc",
      create_invoice: true,
      metadata: { project: "proj_1" },
    });
  });

  it("lowercases currency on the wire", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}payment`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { payment_url: "u", session_id: "s", order_id: "o" },
        });
      }),
    );
    await makeResource().create({
      price: "1",
      currency: "EUR",
      orderId: "o",
      successWebhook: "https://app.test/s",
      failureWebhook: "https://app.test/f",
    });
    expect(captured.body.currency).toBe("eur");
  });

  it("rejects non-positive price before issuing a request", async () => {
    await expect(
      makeResource().create({
        price: -1,
        orderId: "o",
        successWebhook: "https://app.test/s",
        failureWebhook: "https://app.test/f",
      }),
    ).rejects.toThrowError(RangeError);
  });

  it("wraps a malformed response as PSIPProtocolError", async () => {
    server.use(
      http.post(`${BASE_URL}payment`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: { /* missing payment_url */ session_id: "s", order_id: "o" },
        }),
      ),
    );
    await expect(
      makeResource().create({
        price: "1",
        orderId: "o",
        successWebhook: "https://app.test/s",
        failureWebhook: "https://app.test/f",
      }),
    ).rejects.toBeInstanceOf(PSIPProtocolError);
  });
});

describe("PaymentsResource.recreate", () => {
  it("posts only the supplied fields (omits undefined)", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}repayment`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { payment_url: "u", session_id: "s", order_id: "ord_1" },
        });
      }),
    );
    await makeResource().recreate({ orderId: "ord_1" });
    expect(body).toEqual({ order_id: "ord_1" });
  });

  it("forwards overrides to the server", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}repayment`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { payment_url: "u", session_id: "s", order_id: "ord_1" },
        });
      }),
    );
    await makeResource().recreate({
      orderId: "ord_1",
      successWebhook: "https://app.test/s2",
      sandbox: false,
    });
    expect(body).toEqual({
      order_id: "ord_1",
      success_webhook: "https://app.test/s2",
      sandbox: false,
    });
  });
});

describe("PaymentsResource.verifySession", () => {
  it("URL-encodes the session_id and parses the response", async () => {
    let url: string | null = null;
    server.use(
      http.post(`${BASE_URL}checkout-sessions/:sid/verify`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: {
            session_id: "cs/with/slashes",
            order_id: "ord_1",
            payment_status: "paid",
            amount: "9.99",
            currency: "usd",
            transaction_id: "txn_1",
          },
        });
      }),
    );
    const res = await makeResource().verifySession("cs/with/slashes");
    expect(url).toContain("checkout-sessions/cs%2Fwith%2Fslashes/verify");
    expect(res).toEqual({
      sessionId: "cs/with/slashes",
      orderId: "ord_1",
      paymentStatus: "paid",
      amount: "9.99",
      currency: "usd",
      transactionId: "txn_1",
    });
  });

  it("treats missing transaction_id as null", async () => {
    server.use(
      http.post(`${BASE_URL}checkout-sessions/:sid/verify`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: {
            session_id: "cs_test_1",
            order_id: "ord_1",
            payment_status: "unpaid",
            amount: "9.99",
            currency: "usd",
          },
        }),
      ),
    );
    const res = await makeResource().verifySession("cs_test_1");
    expect(res.transactionId).toBeNull();
  });
});

describe("PaymentsResource.refund", () => {
  it("posts an empty body for a full refund", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}transactions/:id/refund`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: {
            refund_id: "re_1",
            transaction_id: "txn_1",
            status: "succeeded",
            amount: "9.99",
            currency: "usd",
          },
        });
      }),
    );
    const res = await makeResource().refund("txn_1");
    expect(body).toEqual({});
    expect(res).toEqual({
      refundId: "re_1",
      transactionId: "txn_1",
      status: "succeeded",
      amount: "9.99",
      currency: "usd",
      reason: null,
    });
  });

  it("includes amount + reason on partial refund", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}transactions/:id/refund`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: {
            refund_id: "re_1",
            transaction_id: "txn_1",
            status: "pending",
            amount: "3.50",
            currency: "usd",
            reason: "customer dispute",
          },
        });
      }),
    );
    const res = await makeResource().refund("txn_1", {
      amount: "3.50",
      reason: "customer dispute",
    });
    expect(body).toEqual({ amount: "3.50", reason: "customer dispute" });
    expect(res.reason).toBe("customer dispute");
  });

  it("rejects a zero or negative refund amount", async () => {
    await expect(makeResource().refund("txn_1", { amount: 0 })).rejects.toThrowError(RangeError);
  });

  it("rejects an empty refund reason string", async () => {
    await expect(makeResource().refund("txn_1", { reason: "" })).rejects.toThrowError(RangeError);
  });
});
