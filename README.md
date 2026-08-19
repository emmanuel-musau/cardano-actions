# Cardano Actions

Turn any URL into a signable Cardano transaction. Share a link on X, WhatsApp, or a printed QR code — the recipient reviews exactly what they're signing and confirms in their own wallet. Open spec + TypeScript SDK.

> Developed in the open — the specification, the SDK, and the reasoning behind both. Track what is moving in [issues](https://github.com/emmanuel-musau/cardano-actions/issues).

## Why it's different

Solana proved the format with Actions and Blinks. On an account-model chain, a client has to *simulate* a transaction and show the user a prediction. On Cardano the transaction body fully determines its own effects and fee, so a client can **derive** exact value movements, fees, certificates, and expiry as arithmetic — then **block the signature** if those effects contradict what the link claimed.

That is why this needs no gatekeeping registry: the server's metadata is a claim, and the transaction is the truth. It is also not a port — it is the version other chains cannot build.

## How it works

1. A dApp hosts an **Action** endpoint. `GET` describes the intent (title, icon, parameters); `POST` returns a *partial* transaction covering only the dApp's side.
2. Anyone shares the **link**. `actions.json` lets a human URL front a technical endpoint.
3. A **client** — the interstitial page, a wallet, a bot — resolves the link, balances the transaction locally against the user's own UTxOs (the endpoint never sees them), derives the exact effects, shows them, and hands off to the wallet over CIP-30.

Holds no user funds. No custody, no relayer, no treasury validator. The blast radius of a bug is a failed transaction, not a drained wallet.

## Packages

| Package | What it does |
|---|---|
| `@cardano-actions/core` | the shared contract — schemas, URL rules, error codes |
| `@cardano-actions/server` | publish an action endpoint — `defineAction()` + Next.js adapter |
| `@cardano-actions/verifier` | derive what the transaction really does, and block signing if the metadata lies |
| `@cardano-actions/flow` | run the user through it — action UI + CIP-30 wallet orchestration |

Plus `apps/interstitial` (hosted, self-hostable fallback page) and `examples/adalink` (reference integration: USDM/USDCx payment actions).

## Documentation

| Document | Read it for |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | product scope, protocol contract, security model, delivery scope |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | package layout, dependency rules, data flows, trust model |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | board process, branching, commits, definition of done |
| [docs/DECISIONS/](docs/DECISIONS/) | architecture decision records |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Cardano and protocol terms as used here |
| [CONTRIBUTING.md](CONTRIBUTING.md) | setup, branch and PR conventions, the testing bar, changesets |
| [SECURITY.md](SECURITY.md) | what counts as a vulnerability here, and how to report one privately |
| [spec/](spec/) | the CIP: request and response shapes, error codes, resolution rules |

## Built on

[`@evolution-sdk/evolution`](https://github.com/IntersectMBO/evolution-sdk) for transaction construction, CIP-30 for signing, CIP-13 for routing, CIP-0170 for publisher identity. This extends the ecosystem's own standards rather than replacing them.

## Standardisation

The specification is submitted to `cardano-foundation/CIPs` after the implementation runs on mainnet, so the standard belongs to the ecosystem rather than to this repository.

## License

MIT — see [LICENSE](LICENSE).
