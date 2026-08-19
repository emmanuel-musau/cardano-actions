# Architecture

How the pieces fit, what each package owns, and the dependency rules that keep the security model intact.

## Repository layout

```
cardano-actions/
├── spec/CIP-XXXX/        the CIP draft: //action authority, GET/POST shapes,
│                         partial-intent format, error codes
├── packages/
│   ├── core/             types, URL resolution, actions.json, validation
│   ├── server/           defineAction() + Next.js adapter
│   ├── effects/          CBOR decode → deltas. The security engine.
│   └── client/           React components + CIP-30 orchestration
├── apps/
│   └── interstitial/     hosted + self-hostable fallback page
├── examples/
│   └── adalink/          reference integration: USDM/USDCx payment action
└── docs/                 requirements, architecture, workflow, ADRs
```

Deferred to roadmap, **not** built in M1: `packages/deeplink` (CIP-13 `//action`), `apps/extension` (inline renderer).

## Package responsibilities

### `core`
Shared vocabulary. Effect Schema definitions for the GET metadata response and the partial-intent POST response; `actions.json` fetch + pathPattern resolution; parameter template interpolation (`{amount}`). Depends on nothing else in the workspace. Both `server` (produce) and `client` (consume) validate against these schemas, which makes the schema the executable form of the spec.

### `server`
`defineAction({ get, post })` — typed handlers whose output is validated against `core` schemas *before it leaves the server*, so a misconfigured dApp fails at its own boundary rather than at the user's wallet. One framework adapter in M1 (Next.js App Router): route handlers, CORS headers, `actions.json` serving, spec error codes mapped to HTTP status.

### `effects` — the security engine
Decodes balanced transaction CBOR and derives, independently of anything the endpoint claimed:

| Derived | Rendered as |
|---|---|
| net ADA delta for user addresses, exact fee, deposits | "You pay 0.17 ADA (fee)", "Deposit 2.00 ADA (refundable)" |
| net asset deltas per policy/asset | "You receive 25 USDM" |
| certificates | "Delegate → pool1xyz" |
| withdrawals | "Withdraws N ADA rewards" |
| mint/burn | assets created/destroyed |
| validity interval | "Expires in 4m 12s" |

Then compares derived effects against declared metadata and returns `match | mismatch(reasons[])`. Undeclared effects — an extra output, an unexpected certificate — are always a mismatch.

**This package is a pure function of (tx CBOR, declared metadata, user addresses).** It performs no I/O and imports nothing from `client`, `server`, or any network layer. That purity is what makes the adversarial corpus a meaningful proof: the corpus exercises the exact code path that runs before a real signature.

### `client`
CIP-30 orchestration plus React components. Wallet discovery/enable, change address + network id, local balancing via `@evolution-sdk/evolution` against the user's own UTxOs, effects derivation, `signTx` → witness assembly → `submitTx`, and rebuild-and-retry when UTxOs move mid-flow. Components: action card, generated parameter form, effects panel with the mismatch block.

### `apps/interstitial`
Tier-1 client and the M1 headline: a hosted, self-hostable page that runs the whole flow with zero wallet cooperation beyond CIP-30. Also owns OG/Twitter preview metadata, since the unfurl is the first impression of a shared link.

### `examples/adalink`
Reference integration, not a library. Proves the SDK on a product with real users: USDM/USDCx payment actions, human URLs via `actions.json`, live on mainnet with labelled transactions.

## Dependency rules

```
core  ←  server
  ↑
  └───  client  →  effects
            ↓
      interstitial  →  (client, core)
      adalink       →  (server)
```

- `core` depends on no workspace package.
- `effects` depends on `core` types only — never on `client`/`server`.
- `server` never imports `client` or `effects`; a dApp shipping an endpoint should not pull a React tree.
- Apps depend on packages, never the reverse.

## The two data flows

**Build (Mode A, the only v1 mode).** Client resolves the link through `actions.json` → `GET` metadata → renders card → wallet connect → `POST { changeAddress, network }` → server returns a *partial* intent (its side only) → **client balances locally** → complete unsigned tx. The endpoint never sees the user's UTxO set; that is the privacy advantage we extracted from the eUTxO input-selection constraint.

**Sign.** Derive effects → compare → block on mismatch, otherwise show exact effects → `signTx` (returns a **witness set**, not a signed tx) → assemble witnesses into the body → `submitTx` → receipt. On input-spent failure, rebuild from fresh UTxOs, re-derive effects, and only then re-prompt.

## Trust model

Two halves of one answer, and neither is sufficient alone:

- **Effects derivation** proves *what* the transaction does. Arithmetic on the tx body, not a simulation — possible because eUTxO transactions fully determine their own effects. Mismatch hard-blocks signing.
- **CIP-0170 attestation** proves *who* is asking. Resolved and verified client-side, rendered beside the effects. Unverified publishers are marked, not blocked — identity augments, effects gate.

Effects without identity leaves users approving correct transactions from unknown parties. Identity without effects is the central registry Solana needed and we are avoiding.

## Deliberate non-architecture

No treasury validator, no relayer, no fee tank, no custody, no central registry, no service we operate that the protocol depends on. dApps host their own endpoints; the interstitial is self-hostable; the SDK is a library. The blast radius of a bug here is a failed transaction, not a drained wallet.
