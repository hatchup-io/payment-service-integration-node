import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PSIPConfigSchema } from "../../src/config.js";
import {
  PSIPAuthError,
  PSIPNetworkError,
  PSIPNotFoundError,
  PSIPProtocolError,
  PSIPServerError,
  PSIPValidationError,
} from "../../src/exceptions.js";
import { Transport } from "../../src/transport.js";

const BASE_URL = "https://payments.test/api/v1/";

/**
 * Build a config with retries disabled by default — tests that exercise the
 * retry loop set them explicitly. `backoffFactor: 0` keeps the loop fast
 * (no `setTimeout` waits) even when `maxRetries > 0`.
 */
function makeConfig(
  overrides: Partial<{
    retry: { maxRetries: number; backoffFactor: number; retryOnStatus: number[] };
  }> = {},
) {
  return PSIPConfigSchema.parse({
    apiKey: "hp_test_aaaaaaaa",
    baseUrl: BASE_URL,
    timeout: 5,
    userAgent: "psip-test/0.0.0",
    retry: { maxRetries: 0, backoffFactor: 0, retryOnStatus: [502, 503, 504], ...overrides.retry },
  });
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Transport — 2xx envelope handling", () => {
  it("returns envelope.data on a well-formed 2xx", async () => {
    server.use(
      http.get(`${BASE_URL}payments`, () =>
        HttpResponse.json({
          status: "success",
          message: "ok",
          data: { id: "txn_123", amount: "9.99" },
        }),
      ),
    );

    const t = new Transport(makeConfig());
    const data = await t.request<{ id: string; amount: string }>("GET", "payments");
    expect(data).toEqual({ id: "txn_123", amount: "9.99" });
  });

  it("raises PSIPProtocolError on envelope status=failure with 2xx", async () => {
    server.use(
      http.get(`${BASE_URL}payments`, () =>
        HttpResponse.json({ status: "failure", message: "soft fail", data: null }),
      ),
    );

    const t = new Transport(makeConfig());
    await expect(t.request("GET", "payments")).rejects.toThrowError(PSIPProtocolError);
  });

  it("raises PSIPProtocolError when 'data' is null on a 2xx", async () => {
    server.use(
      http.get(`${BASE_URL}payments`, () =>
        HttpResponse.json({ status: "success", message: "ok", data: null }),
      ),
    );

    const t = new Transport(makeConfig());
    await expect(t.request("GET", "payments")).rejects.toThrowError(
      /non-object 'data' field: null/,
    );
  });

  it("raises PSIPProtocolError when 'data' is an array on a 2xx", async () => {
    server.use(
      http.get(`${BASE_URL}payments`, () =>
        HttpResponse.json({ status: "success", message: "ok", data: [1, 2, 3] }),
      ),
    );

    const t = new Transport(makeConfig());
    await expect(t.request("GET", "payments")).rejects.toThrowError(
      /non-object 'data' field: array/,
    );
  });

  it("raises PSIPProtocolError when the body isn't JSON on a 2xx", async () => {
    server.use(
      http.get(
        `${BASE_URL}payments`,
        () =>
          new HttpResponse("<html>nope</html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const t = new Transport(makeConfig());
    await expect(t.request("GET", "payments")).rejects.toThrowError(/non-JSON body/);
  });
});

describe("Transport — error classification", () => {
  it.each([
    [400, PSIPValidationError],
    [422, PSIPValidationError],
    [401, PSIPAuthError],
    [404, PSIPNotFoundError],
    [500, PSIPServerError],
    [503, PSIPServerError],
  ] as const)("HTTP %i → %s", async (status, Cls) => {
    server.use(
      http.get(`${BASE_URL}payments`, () =>
        HttpResponse.json({ status: "failure", message: `oops ${status}`, data: null }, { status }),
      ),
    );

    const t = new Transport(makeConfig());
    await expect(t.request("GET", "payments")).rejects.toBeInstanceOf(Cls);
  });

  it("propagates statusCode, message, and raw envelope onto the error", async () => {
    server.use(
      http.get(`${BASE_URL}payments`, () =>
        HttpResponse.json(
          { status: "failure", message: "bad request", data: null, code: "bad_field" },
          {
            status: 400,
            headers: { "X-Request-ID": "req_xyz" },
          },
        ),
      ),
    );

    const t = new Transport(makeConfig());
    await expect(t.request("GET", "payments")).rejects.toMatchObject({
      statusCode: 400,
      raw: { status: "failure", message: "bad request", data: null, code: "bad_field" },
      requestId: "req_xyz",
      message: "[400] bad request",
    });
  });
});

describe("Transport — retry loop", () => {
  it("retries 503 up to maxRetries and surfaces the last response if it stays 503", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}payments`, () => {
        calls += 1;
        return HttpResponse.json(
          { status: "failure", message: "down", data: null },
          { status: 503 },
        );
      }),
    );

    const t = new Transport(
      makeConfig({ retry: { maxRetries: 2, backoffFactor: 0, retryOnStatus: [502, 503, 504] } }),
    );
    await expect(t.request("GET", "payments")).rejects.toBeInstanceOf(PSIPServerError);
    expect(calls).toBe(3); // 1 attempt + 2 retries
  });

  it("returns the first 2xx after a transient 503", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}payments`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { status: "failure", message: "down", data: null },
            { status: 503 },
          );
        }
        return HttpResponse.json({ status: "success", message: "ok", data: { ok: true } });
      }),
    );

    const t = new Transport(
      makeConfig({ retry: { maxRetries: 2, backoffFactor: 0, retryOnStatus: [502, 503, 504] } }),
    );
    const data = await t.request<{ ok: boolean }>("GET", "payments");
    expect(data.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("does NOT retry on 401", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}payments`, () => {
        calls += 1;
        return HttpResponse.json({ status: "failure", message: "no", data: null }, { status: 401 });
      }),
    );

    const t = new Transport(
      makeConfig({ retry: { maxRetries: 3, backoffFactor: 0, retryOnStatus: [502, 503, 504] } }),
    );
    await expect(t.request("GET", "payments")).rejects.toBeInstanceOf(PSIPAuthError);
    expect(calls).toBe(1);
  });

  it("retries network failures up to maxRetries, then PSIPNetworkError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("ECONNREFUSED"));

    const t = new Transport(
      makeConfig({ retry: { maxRetries: 2, backoffFactor: 0, retryOnStatus: [502, 503, 504] } }),
      fetchImpl,
    );
    await expect(t.request("GET", "payments")).rejects.toBeInstanceOf(PSIPNetworkError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("Transport — headers + body", () => {
  it("attaches Authorization and User-Agent on every request", async () => {
    let captured: Request | null = null;
    server.use(
      http.get(`${BASE_URL}payments`, ({ request }) => {
        captured = request;
        return HttpResponse.json({ status: "success", message: "ok", data: {} });
      }),
    );

    const t = new Transport(makeConfig());
    await t.request("GET", "payments");
    const r = captured as unknown as Request;
    expect(r.headers.get("Authorization")).toBe("Bearer hp_test_aaaaaaaa");
    expect(r.headers.get("User-Agent")).toBe("psip-test/0.0.0");
    expect(r.headers.get("Accept")).toBe("application/json");
  });

  it("JSON-encodes the body and sets Content-Type on POST", async () => {
    let captured: Request | null = null;
    server.use(
      http.post(`${BASE_URL}payments`, async ({ request }) => {
        captured = request.clone();
        return HttpResponse.json({
          status: "success",
          message: "ok",
          data: { id: "txn_1" },
        });
      }),
    );

    const t = new Transport(makeConfig());
    await t.request("POST", "payments", { json: { price: "9.99", order_id: "ord_1" } });
    const r = captured as unknown as Request;
    expect(r.headers.get("Content-Type")).toBe("application/json");
    expect(await r.json()).toEqual({ price: "9.99", order_id: "ord_1" });
  });

  it("serializes query params onto the URL", async () => {
    let url: string | null = null;
    server.use(
      http.get(`${BASE_URL}transactions`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ status: "success", message: "ok", data: { items: [] } });
      }),
    );

    const t = new Transport(makeConfig());
    await t.request("GET", "transactions", {
      params: { page: 1, status: "succeeded", verified: true, skipMe: undefined, alsoSkip: null },
    });
    expect(url).toContain("page=1");
    expect(url).toContain("status=succeeded");
    expect(url).toContain("verified=true");
    expect(url).not.toContain("skipMe");
    expect(url).not.toContain("alsoSkip");
  });
});

describe("Transport — idempotency", () => {
  it("auto-generates an Idempotency-Key on POST", async () => {
    let captured: Request | null = null;
    server.use(
      http.post(`${BASE_URL}payments`, ({ request }) => {
        captured = request;
        return HttpResponse.json({ status: "success", message: "ok", data: { id: "1" } });
      }),
    );

    const t = new Transport(makeConfig());
    await t.request("POST", "payments", { json: { foo: "bar" } });
    const key = (captured as unknown as Request).headers.get("Idempotency-Key");
    expect(key).toMatch(/[0-9a-f-]{36}/i); // crypto.randomUUID() hex+hyphens form
  });

  it("does NOT attach Idempotency-Key on GET", async () => {
    let captured: Request | null = null;
    server.use(
      http.get(`${BASE_URL}payments`, ({ request }) => {
        captured = request;
        return HttpResponse.json({ status: "success", message: "ok", data: {} });
      }),
    );

    const t = new Transport(makeConfig());
    await t.request("GET", "payments");
    expect((captured as unknown as Request).headers.get("Idempotency-Key")).toBeNull();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "honors a caller-provided idempotencyKey on %s",
    async (method) => {
      let captured: Request | null = null;
      const handler = (request: Request) => {
        captured = request;
        return HttpResponse.json({ status: "success", message: "ok", data: {} });
      };
      server.use(
        http.post(`${BASE_URL}r`, ({ request }) => handler(request)),
        http.put(`${BASE_URL}r`, ({ request }) => handler(request)),
        http.patch(`${BASE_URL}r`, ({ request }) => handler(request)),
        http.delete(`${BASE_URL}r`, ({ request }) => handler(request)),
      );

      const t = new Transport(makeConfig());
      await t.request(method, "r", { json: {}, idempotencyKey: "fixed-key-123" });
      expect((captured as unknown as Request).headers.get("Idempotency-Key")).toBe("fixed-key-123");
    },
  );

  it("reuses the same Idempotency-Key across SDK-level retries", async () => {
    const keys: string[] = [];
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}payments`, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key") ?? "");
        calls += 1;
        if (calls < 3) {
          return HttpResponse.json(
            { status: "failure", message: "down", data: null },
            { status: 503 },
          );
        }
        return HttpResponse.json({ status: "success", message: "ok", data: { id: "1" } });
      }),
    );

    const t = new Transport(
      makeConfig({ retry: { maxRetries: 3, backoffFactor: 0, retryOnStatus: [502, 503, 504] } }),
    );
    await t.request("POST", "payments", { json: { foo: "bar" } });
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1); // all three attempts used the same key
  });
});
