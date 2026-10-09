# @hatchup-io/payment-service-integration

> **Status:** 0.1.0, unpublished. The client and all REST resources are implemented (M1.b.2); webhook parsing and dispatch (M1.c) are still pending.

TypeScript SDK for the [Hatchup Payment Service](https://github.com/hatchup-io/hatchup-payment-system) — an internal Stripe Connect gateway. Functional + protocol parity with the Python SDK at [`hatchup-payment-service-integration`](https://pypi.org/project/hatchup-payment-service-integration/) on PyPI.

## What this is

Framework-agnostic Node SDK for any Hatchup product (or sister service) that needs to take payments. Same wire protocol, same error hierarchy, same webhook verify-by-default story as the Python SDK — adapted to TypeScript idioms (async-only, Zod-validated, native `fetch`).

Direct Stripe SDK access is intentionally out of scope. See the Python repo's [`docs/STRIPE_PASSTHROUGH.md`](https://github.com/hatchup-io/payment-service-integration/blob/main/docs/STRIPE_PASSTHROUGH.md) for the rationale.

## Install

The package is **not published to npm yet** (`npm view @hatchup-io/payment-service-integration` returns 404), so `pnpm add @hatchup-io/payment-service-integration` will fail. Until the first release, build it from source and install it locally:

```bash
git clone https://github.com/hatchup-io/payment-service-integration-node.git
cd payment-service-integration-node
pnpm install
pnpm run build
pnpm pack                     # produces hatchup-io-payment-service-integration-0.1.0.tgz

# in the consuming project
pnpm add /path/to/hatchup-io-payment-service-integration-0.1.0.tgz
# or link the checkout directly
pnpm add file:/path/to/payment-service-integration-node
```

Installing straight from the git URL does not work yet: `dist/` is not committed and there is no `prepare` script to build it on install.

Requires Node 20+.

## Usage

```ts
import { PaymentServiceClient, configFromEnv } from "@hatchup-io/payment-service-integration";

// Reads PSIP_API_KEY, PSIP_BASE_URL, PSIP_TIMEOUT, PSIP_DEFAULT_SANDBOX
const client = new PaymentServiceClient(configFromEnv());

for await (const tx of client.transactions.iterAll({ status: "succeeded" })) {
  console.log(tx);
}

const result = await client.verify("ord_2026_05_001", "9.99");
```

API keys must start with `hp_`. The default base URL is `https://payments.hatchup.io/api/v1/`; override it with `baseUrl` or `PSIP_BASE_URL`. There is no module-level singleton, so multi-tenant consumers can build one client per API key.

## Status

| Milestone | Version | Status |
|---|---|---|
| M0 — toolchain bootstrap | 0.1.0 | done |
| M1.a/M1.b — transport, client, all REST resources | 0.1.0 (unreleased) | done |
| M1.c — webhook parsing + dispatcher | 0.2.0 | pending |
| M2 — contract tripwire | 0.3.0 | planned |
| M3 — production-hardened release pipeline | 0.4.0 | planned |
| M4 — framework adapter (Express) | 0.5.0 | planned |
| 1.0.0 — stabilize after first Node consumer | 1.0.0 | planned |

See the [Node SDK plan](https://github.com/hatchup-io/payment-service-integration/blob/main/docs/NODE_SDK_PLAN.md).

## Resources

Implemented on `PaymentServiceClient`:

- `client.payments` — `create`, `recreate`, `verifySession`, `refund`
- `client.verify(orderId, price)` — amount and currency check
- `client.transactions` — `list`, `get`, `iterAll` async generator
- `client.customers` — CRUD, `list` (incl. `email` filter), `listPaymentMethods`, `createPortalSession`
- `client.products`, `client.prices` — catalog
- `client.paymentIntents` — `create`, `retrieve`, `confirm`, `capture`, `cancel`, `list`
- `client.setupIntents`, `client.paymentMethods` (`detach`)
- `client.subscriptions` — `create`, `retrieve`, `update`, `cancel`, `resume`, `list`
- `client.webhookEndpoints` — CRUD, `rotateSecret`, `list`

Not implemented yet (M1.c): `client.invoices`, and webhook parsing and dispatch (`parsePaymentCompleted`, `verifyEvent`, `WebhookDispatcher`). The webhook exception classes (`PSIPWebhookForgeryError`, `PSIPWebhookValidationError`) are already exported.

## Development

```bash
pnpm install
pnpm run check    # biome + tsc --noEmit
pnpm run test     # vitest
pnpm run build    # tsup → ESM + CJS + .d.ts
```

## License

MIT — see [LICENSE](LICENSE).
