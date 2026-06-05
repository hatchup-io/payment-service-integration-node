# Changelog

All notable changes to `@hatchup-io/payment-service-integration` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-06-06

### Added

- **M0 — toolchain bootstrap.** Initial repo scaffolding only; no public client API yet (that arrives in 0.2.0 per the [Node SDK plan](https://github.com/hatchup-io/payment-service-integration/blob/main/docs/NODE_SDK_PLAN.md)).
  - `package.json` configured for `@hatchup-io/payment-service-integration`, dual ESM + CJS exports via `tsup`, Node ≥20, `publishConfig.provenance: true` so future releases ship npm provenance attestations from OIDC.
  - TypeScript 5.5+ strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`); `target: ES2022`, `module: NodeNext`.
  - Build pipeline: `tsup` emits ESM + CJS + `.d.ts` + sourcemaps from `src/index.ts` to `dist/`.
  - Lint + format: `@biomejs/biome` (1.9+), single tool replacing eslint + prettier.
  - Tests: `vitest` 2.1+ with v8 coverage, 80% thresholds across lines/functions/branches/statements.
  - Mocking: `msw` 2.4+ as the Python `respx` analog for `fetch` interception.
  - Validation: `zod` 3.23+ as the Pydantic analog (runtime parse + inferred TS types).
  - License: MIT (matches Python SDK).

[Unreleased]: https://github.com/hatchup-io/payment-service-integration-node/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hatchup-io/payment-service-integration-node/releases/tag/v0.1.0
