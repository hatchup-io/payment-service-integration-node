import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VERSION } from "../../src/_version.js";
import {
  DEFAULT_BASE_URL,
  ENV_PREFIX_DEFAULT,
  PSIPConfigSchema,
  RetryPolicySchema,
  configFromEnv,
} from "../../src/config.js";

describe("PSIPConfigSchema", () => {
  it("parses a minimal valid config and fills defaults", () => {
    const cfg = PSIPConfigSchema.parse({ apiKey: "hp_test_aaaaaaaa" });
    expect(cfg.apiKey).toBe("hp_test_aaaaaaaa");
    expect(cfg.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(cfg.timeout).toBe(10);
    expect(cfg.defaultSandbox).toBe(true);
    expect(cfg.userAgent).toBe(`hatchup-psip/${VERSION} (api=v1, runtime=node)`);
    expect(cfg.retry).toEqual({
      maxRetries: 2,
      backoffFactor: 0.5,
      retryOnStatus: [502, 503, 504],
    });
  });

  it("rejects an apiKey that doesn't start with hp_", () => {
    expect(() => PSIPConfigSchema.parse({ apiKey: "sk_live_aaaaaa" })).toThrowError(
      /must start with 'hp_'/,
    );
  });

  it("rejects an apiKey that's too short", () => {
    expect(() => PSIPConfigSchema.parse({ apiKey: "hp_x" })).toThrowError(/too short/);
  });

  it("trims whitespace around apiKey before validating", () => {
    const cfg = PSIPConfigSchema.parse({ apiKey: "  hp_test_aaaaaaaa  " });
    expect(cfg.apiKey).toBe("hp_test_aaaaaaaa");
  });

  it("rejects a baseUrl without scheme", () => {
    expect(() =>
      PSIPConfigSchema.parse({ apiKey: "hp_test_aaaaaaaa", baseUrl: "payments.example/api/v1" }),
    ).toThrowError(/must start with http/);
  });

  it("normalizes baseUrl to have a trailing slash", () => {
    const cfg = PSIPConfigSchema.parse({
      apiKey: "hp_test_aaaaaaaa",
      baseUrl: "https://payments.example/api/v1",
    });
    expect(cfg.baseUrl).toBe("https://payments.example/api/v1/");
  });

  it("leaves an already-slash-terminated baseUrl alone", () => {
    const cfg = PSIPConfigSchema.parse({
      apiKey: "hp_test_aaaaaaaa",
      baseUrl: "https://payments.example/api/v1/",
    });
    expect(cfg.baseUrl).toBe("https://payments.example/api/v1/");
  });

  it("rejects a non-positive timeout", () => {
    expect(() => PSIPConfigSchema.parse({ apiKey: "hp_test_aaaaaaaa", timeout: 0 })).toThrowError();
  });

  it("rejects an empty userAgent", () => {
    expect(() =>
      PSIPConfigSchema.parse({ apiKey: "hp_test_aaaaaaaa", userAgent: "  " }),
    ).toThrowError(/must not be empty/);
  });

  it("accepts a custom retry policy and clamps values via the schema", () => {
    const cfg = PSIPConfigSchema.parse({
      apiKey: "hp_test_aaaaaaaa",
      retry: { maxRetries: 5, backoffFactor: 1, retryOnStatus: [502] },
    });
    expect(cfg.retry).toEqual({
      maxRetries: 5,
      backoffFactor: 1,
      retryOnStatus: [502],
    });
  });

  it("rejects unknown top-level fields (strict mode)", () => {
    expect(() => PSIPConfigSchema.parse({ apiKey: "hp_test_aaaaaaaa", bogus: 1 })).toThrowError();
  });
});

describe("RetryPolicySchema", () => {
  it("rejects maxRetries above the cap", () => {
    expect(() => RetryPolicySchema.parse({ maxRetries: 11 })).toThrowError();
  });

  it("rejects negative backoffFactor", () => {
    expect(() => RetryPolicySchema.parse({ backoffFactor: -0.1 })).toThrowError();
  });
});

describe("configFromEnv", () => {
  const ENV_KEYS = [
    `${ENV_PREFIX_DEFAULT}API_KEY`,
    `${ENV_PREFIX_DEFAULT}BASE_URL`,
    `${ENV_PREFIX_DEFAULT}TIMEOUT`,
    `${ENV_PREFIX_DEFAULT}DEFAULT_SANDBOX`,
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("reads PSIP_* env vars", () => {
    process.env.PSIP_API_KEY = "hp_env_aaaaaaaa";
    process.env.PSIP_BASE_URL = "https://payments.test/api/v1";
    process.env.PSIP_TIMEOUT = "5";
    process.env.PSIP_DEFAULT_SANDBOX = "0";

    const cfg = configFromEnv();
    expect(cfg.apiKey).toBe("hp_env_aaaaaaaa");
    expect(cfg.baseUrl).toBe("https://payments.test/api/v1/");
    expect(cfg.timeout).toBe(5);
    expect(cfg.defaultSandbox).toBe(false);
  });

  it("overrides take precedence over env values", () => {
    process.env.PSIP_API_KEY = "hp_env_aaaaaaaa";
    process.env.PSIP_TIMEOUT = "5";

    const cfg = configFromEnv({ apiKey: "hp_override_aaa", timeout: 2 });
    expect(cfg.apiKey).toBe("hp_override_aaa");
    expect(cfg.timeout).toBe(2);
  });

  it("supports a custom prefix", () => {
    process.env.MYAPP_API_KEY = "hp_prefix_aaaaa";
    try {
      const cfg = configFromEnv({ prefix: "MYAPP_" });
      expect(cfg.apiKey).toBe("hp_prefix_aaaaa");
    } finally {
      // process.env requires `delete` to actually unset; assignment to
      // undefined would coerce to the string "undefined" and pollute the
      // env for subsequent tests.
      // biome-ignore lint/performance/noDelete: process.env semantics
      delete process.env.MYAPP_API_KEY;
    }
  });

  it("throws TypeError if PSIP_TIMEOUT is not a number", () => {
    process.env.PSIP_API_KEY = "hp_env_aaaaaaaa";
    process.env.PSIP_TIMEOUT = "not-a-number";
    expect(() => configFromEnv()).toThrowError(TypeError);
  });

  it.each([
    ["1", true],
    ["true", true],
    ["TRUE", true],
    ["yes", true],
    ["on", true],
    ["0", false],
    ["false", false],
    ["off", false],
    ["", false],
  ])("PSIP_DEFAULT_SANDBOX=%s → defaultSandbox=%s", (raw, expected) => {
    process.env.PSIP_API_KEY = "hp_env_aaaaaaaa";
    process.env.PSIP_DEFAULT_SANDBOX = raw;
    const cfg = configFromEnv();
    expect(cfg.defaultSandbox).toBe(expected);
  });
});
