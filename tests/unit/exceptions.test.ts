import { describe, expect, it } from "vitest";
import {
  PSIPAPIError,
  PSIPAuthError,
  PSIPError,
  PSIPNetworkError,
  PSIPNotFoundError,
  PSIPProtocolError,
  PSIPServerError,
  PSIPValidationError,
  PSIPWebhookForgeryError,
  PSIPWebhookValidationError,
} from "../../src/exceptions.js";

describe("exception hierarchy", () => {
  it("PSIPError is the root and extends Error", () => {
    const err = new PSIPError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PSIPError);
    expect(err.name).toBe("PSIPError");
    expect(err.message).toBe("boom");
  });

  it("network/protocol errors descend from PSIPError but not each other", () => {
    const net = new PSIPNetworkError("net");
    const proto = new PSIPProtocolError("proto");
    expect(net).toBeInstanceOf(PSIPError);
    expect(proto).toBeInstanceOf(PSIPError);
    expect(net).not.toBeInstanceOf(PSIPProtocolError);
    expect(proto).not.toBeInstanceOf(PSIPNetworkError);
  });

  it("PSIPAPIError propagates statusCode, raw, requestId; default raw is {}", () => {
    const err = new PSIPAPIError({ statusCode: 422, message: "nope" });
    expect(err.statusCode).toBe(422);
    expect(err.raw).toEqual({});
    expect(err.requestId).toBeNull();
    expect(err.message).toBe("[422] nope");
    expect(err).toBeInstanceOf(PSIPError);
  });

  it("PSIPAPIError carries the provided raw envelope and requestId", () => {
    const raw = { status: "failure", message: "bad", data: null };
    const err = new PSIPAPIError({
      statusCode: 400,
      message: "bad",
      raw,
      requestId: "req_abc",
    });
    expect(err.raw).toBe(raw);
    expect(err.requestId).toBe("req_abc");
  });

  it.each([
    ["PSIPAuthError", PSIPAuthError, 401],
    ["PSIPValidationError", PSIPValidationError, 400],
    ["PSIPNotFoundError", PSIPNotFoundError, 404],
    ["PSIPServerError", PSIPServerError, 503],
  ] as const)("%s is an APIError and PSIPError", (_name, Cls, status) => {
    const err = new Cls({ statusCode: status, message: "x" });
    expect(err).toBeInstanceOf(Cls);
    expect(err).toBeInstanceOf(PSIPAPIError);
    expect(err).toBeInstanceOf(PSIPError);
    expect(err.statusCode).toBe(status);
  });

  it("webhook errors descend from PSIPProtocolError", () => {
    const v = new PSIPWebhookValidationError("v");
    const f = new PSIPWebhookForgeryError("f");
    expect(v).toBeInstanceOf(PSIPProtocolError);
    expect(f).toBeInstanceOf(PSIPProtocolError);
    expect(v).not.toBeInstanceOf(PSIPWebhookForgeryError);
    expect(f).not.toBeInstanceOf(PSIPWebhookValidationError);
  });

  it("cause is propagated through ErrorOptions", () => {
    const cause = new Error("root");
    const net = new PSIPNetworkError("wrapped", { cause });
    expect(net.cause).toBe(cause);
  });
});
