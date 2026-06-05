/**
 * Single source of truth for the SDK version, used by the default
 * `User-Agent` header. Manually synced with `package.json` `version`; the
 * smoke test in `tests/unit/_version.test.ts` enforces parity.
 */

export const VERSION = "0.1.0";
