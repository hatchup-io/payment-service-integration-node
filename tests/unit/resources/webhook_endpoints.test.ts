import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PSIPConfigSchema } from "../../../src/config.js";
import { WebhookEndpointsResource } from "../../../src/resources/webhook_endpoints.js";
import { Transport } from "../../../src/transport.js";

const BASE_URL = "https://payments.test/api/v1/";

function makeResource() {
  const config = PSIPConfigSchema.parse({
    apiKey: "hp_test_aaaaaaaa",
    baseUrl: BASE_URL,
    userAgent: "psip-test/0.0.0",
    retry: { maxRetries: 0, backoffFactor: 0 },
  });
  return new WebhookEndpointsResource(new Transport(config));
}

function makeEndpointWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "we_1",
    object: "webhook_endpoint",
    url: "https://app.test/webhooks/psip",
    description: "",
    subscribed_events: ["payment.completed", "payment.refunded"],
    is_active: true,
    signing_secret: "whsec_test_abc",
    created_at: "2026-06-07T10:00:00+00:00",
    updated_at: "2026-06-07T10:00:00+00:00",
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("WebhookEndpointsResource", () => {
  it("create posts url + subscribed_events as snake_case and parses the secret", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}webhook-endpoints`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "ok", message: "", data: makeEndpointWire() });
      }),
    );
    const endpoint = await makeResource().create({
      url: "https://app.test/webhooks/psip",
      subscribedEvents: ["payment.completed", "payment.refunded"],
      description: "Production webhook",
    });
    expect(captured.body).toEqual({
      url: "https://app.test/webhooks/psip",
      subscribed_events: ["payment.completed", "payment.refunded"],
      description: "Production webhook",
    });
    expect(endpoint.id).toBe("we_1");
    expect(endpoint.signingSecret).toBe("whsec_test_abc");
    expect(endpoint.subscribedEvents).toEqual(["payment.completed", "payment.refunded"]);
  });

  it("create rejects non-http url", async () => {
    await expect(
      makeResource().create({ url: "ftp://example.com", subscribedEvents: ["x"] }),
    ).rejects.toThrowError(TypeError);
  });

  it("create rejects empty subscribed_events", async () => {
    await expect(
      makeResource().create({ url: "https://app.test/", subscribedEvents: [] }),
    ).rejects.toThrowError(RangeError);
  });

  it("update translates isActive → is_active and sends only supplied fields", async () => {
    const captured: { body: Record<string, unknown> } = { body: {} };
    server.use(
      http.post(`${BASE_URL}webhook-endpoints/we_1`, async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: makeEndpointWire({ is_active: false, signing_secret: "" }),
        });
      }),
    );
    const endpoint = await makeResource().update("we_1", { isActive: false });
    expect(captured.body).toEqual({ is_active: false });
    expect(endpoint.isActive).toBe(false);
    // Subsequent reads return blank signingSecret — schema preserves it.
    expect(endpoint.signingSecret).toBe("");
  });

  it("rotateSecret POSTs to /rotate-secret and returns a fresh signing_secret", async () => {
    server.use(
      http.post(`${BASE_URL}webhook-endpoints/we_1/rotate-secret`, () =>
        HttpResponse.json({
          status: "ok",
          message: "",
          data: makeEndpointWire({ signing_secret: "whsec_rotated_xyz" }),
        }),
      ),
    );
    const endpoint = await makeResource().rotateSecret("we_1");
    expect(endpoint.signingSecret).toBe("whsec_rotated_xyz");
  });

  it("delete issues DELETE and returns the raw envelope data", async () => {
    let method = "";
    server.use(
      http.delete(`${BASE_URL}webhook-endpoints/we_1`, ({ request }) => {
        method = request.method;
        return HttpResponse.json({ status: "ok", message: "", data: { id: "we_1" } });
      }),
    );
    const result = await makeResource().delete("we_1");
    expect(method).toBe("DELETE");
    expect(result).toEqual({ id: "we_1" });
  });

  it("list serializes active filter as snake_case true/false", async () => {
    let url = "";
    server.use(
      http.get(`${BASE_URL}webhook-endpoints`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          status: "ok",
          message: "",
          data: { results: [makeEndpointWire()], page: 1, page_size: 20, count: 1 },
        });
      }),
    );
    await makeResource().list({ active: true });
    expect(url).toContain("active=true");
  });
});
