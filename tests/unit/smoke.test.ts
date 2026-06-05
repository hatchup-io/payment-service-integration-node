import { describe, expect, it } from "vitest";
import { VERSION } from "../../src/index.js";

describe("package smoke", () => {
  it("exposes a semver-shaped VERSION string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/);
  });

  it("VERSION agrees with package.json", async () => {
    const pkg = (await import("../../package.json", { with: { type: "json" } })).default as {
      version: string;
    };
    expect(VERSION).toBe(pkg.version);
  });
});
