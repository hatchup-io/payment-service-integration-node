# @hatchup-io/payment-service-integration

> **Status:** 0.1.0 — toolchain bootstrap (M0). Public client + resources land in 0.2.0.

TypeScript SDK for the [Hatchup Payment Service](https://github.com/hatchup-io/hatchup-payment-system) — an internal Stripe Connect gateway. Functional + protocol parity with the Python SDK at [`hatchup-payment-service-integration`](https://pypi.org/project/hatchup-payment-service-integration/) on PyPI.

## What this is

Framework-agnostic Node SDK for any Hatchup product (or sister service) that needs to take payments. Same wire protocol, same error hierarchy, same webhook verify-by-default story as the Python SDK — adapted to TypeScript idioms (async-only, Zod-validated, native `fetch`).

Direct Stripe SDK access is intentionally out of scope. See the Python repo's [`docs/STRIPE_PASSTHROUGH.md`](https://github.com/hatchup-io/payment-service-integration/blob/main/docs/STRIPE_PASSTHROUGH.md) for the rationale.

## Install

```bash
pnpm add @hatchup-io/payment-service-integration
# or
npm install @hatchup-io/payment-service-integration
# or
yarn add @hatchup-io/payment-service-integration
```

Requires Node 20+.

## Status

This package is in milestone **M0 — toolchain bootstrap**. The public API (client + resources + webhooks) ships in 0.2.0 per the [Node SDK plan](https://github.com/hatchup-io/payment-service-integration/blob/main/docs/NODE_SDK_PLAN.md).

| Milestone | Version | Status |
|---|---|---|
| M0 — toolchain bootstrap | 0.1.0 | in progress |
| M1 — transport + client + resources + webhooks | 0.2.0 | planned |
| M2 — contract tripwire | 0.3.0 | planned |
| M3 — production-hardened release pipeline | 0.4.0 | planned |
| M4 — framework adapter (Express) | 0.5.0 | planned |
| 1.0.0 — stabilize after first Node consumer | 1.0.0 | planned |

## Roadmap parity with the Python SDK

This SDK targets the same 11-resource surface the Python SDK exposes once M1 ships:

- `client.payments` (incl. refund)
- `client.verify` (incl. `session()`)
- `client.transactions` (with `iterAll` async generator)
- `client.customers` (incl. `email` filter)
- `client.invoices`
- `client.catalog`
- `client.paymentIntents`
- `client.setupIntents`
- `client.subscriptions`
- `client.webhookEndpoints`
- `client.webhooks` (forgery roundtrip)

Plus webhook parsing + dispatch:

- `parsePaymentCompleted(body)`
- `verifyEvent(event, transactions)`
- `WebhookDispatcher` (verify-by-default, async + sync handler support)

## Development

```bash
pnpm install
pnpm run check    # biome + tsc --noEmit
pnpm run test     # vitest
pnpm run build    # tsup → ESM + CJS + .d.ts
```

## License

MIT — see [LICENSE](LICENSE).
