# Architecture

How the pieces fit, what each package owns, and the dependency rules that keep the security model intact.

## Repository layout

```
cardano-actions/
├── .github/
│   ├── workflows/ci.yml       lint, typecheck, test, build on every PR
│   ├── workflows/release.yml  Changesets → npm, manual approval before publish
│   ├── ISSUE_TEMPLATE/        bug, feature, spec-change
│   └── CODEOWNERS             spec/ and packages/effects/ route to the tech lead
├── spec/
│   ├── CIP-XXXX/
│   │   ├── README.md          the CIP: //action authority, GET/POST shapes,
│   │   │                      partial-intent format, error codes
│   │   └── schemas/           JSON Schema for every payload, consumed by core
│   └── examples/              canonical request/response pairs
├── packages/
│   ├── core/                  types, URL resolution, actions.json, validation
│   ├── effects/               CBOR decode → deltas. The security engine.
│   ├── server/                defineAction() + Next.js adapter
│   ├── identity/              CIP-0170 attestation issue + resolve (signify-ts)
│   └── client/                React components + CIP-30 orchestration
├── apps/
│   ├── interstitial/          hosted + self-hostable fallback page
│   └── docs/                  docs site + the Action tester
├── examples/
│   └── adalink/               reference integration: USDM/USDCx payment action
├── docs/                      requirements, architecture, workflow, ADRs
├── .changeset/
├── pnpm-workspace.yaml        packages/*, apps/*, examples/*
├── turbo.json                 task graph + caching, inter-package ordering
├── tsconfig.base.json         strict ESM, NodeNext — every package extends this
├── eslint.config.js           ESLint 9 flat config + Prettier
├── vitest.workspace.ts        whole suite from root; each package keeps its config
└── LICENSE                    MIT
```

Deferred to roadmap, **not** built in M1: `packages/deeplink` (CIP-13 `//action`), `apps/extension` (inline renderer).

## Package responsibilities

### `core`
Shared vocabulary. Effect Schema definitions for the GET metadata response and the partial-intent POST response; `actions.json` fetch + pathPattern resolution; parameter template interpolation (`{amount}`). Depends on nothing else in the workspace. Both `server` (produce) and `client` (consume) validate against these schemas, which makes the schema the executable form of the spec.

| Module | Owns |
|---|---|
| `types.ts` | `Action`, `Parameter`, `PartialIntent`, `DerivedEffects` — what a third-party implementer reads first |
| `url.ts` | Parse, resolve, validate action URLs; the human URL → technical endpoint indirection |
| `actions-json.ts` | Domain mapping rules, so `adalink.io/pay/kibera` resolves to `/api/actions/pay` |
| `errors.ts` | Typed error taxonomy — every failure mode the UI must render has a code here |

Zero runtime dependencies is the goal.

### `server`
`defineAction({ get, post })` — typed handlers whose output is validated against `core` schemas *before it leaves the server*, so a misconfigured dApp fails at its own boundary rather than at the user's wallet. One framework adapter in M1 (Next.js App Router): route handlers, CORS headers, `actions.json` serving, spec error codes mapped to HTTP status. Hono and Express adapters are deferred past M1.

| Module | Owns |
|---|---|
| `define-action.ts` | The core helper: `get` + `post` handlers → validated, spec-compliant endpoint with CORS and error handling built in |
| `adapters/nextjs.ts` | Framework binding |

The whole developer-experience promise — an Action in about twenty lines — is this package's job.

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

**This package is a pure function of (tx CBOR, declared metadata, user addresses).** It performs no I/O and imports nothing from `client`, `server`, or any network layer. That purity is what makes the adversarial corpus a meaningful proof: the corpus exercises the exact code path that runs before a real signature. If the engine had side effects or network calls, "we blocked 100% of lying transactions" would be a claim about a system rather than a property of a function.

| Module | Owns |
|---|---|
| `decode.ts` | CBOR → structured transaction. Where the edge cases live; budget accordingly. |
| `derive.ts` | Diffs inputs against outputs for the user's addresses → ADA delta, per-policy asset deltas, exact fee, certificates, withdrawals, mint/burn, validity interval |
| `deposits.ts` | Separates refundable deposits (stake registration's 2 ADA) from spent value. Showing a deposit as a cost is wrong; hiding it is worse. |
| `compare.ts` | Derived vs declared → verdict. This function is what blocks a signature. |
| `test/fixtures/` | ~50 known-good transactions with expected outputs. Regression safety. |
| `test/adversarial/` | **The proof artefact.** Transactions whose declared metadata contradicts what they do — hidden outputs, wrong pool, inflated fee, unexpected mint. Public, and the strongest single item in the Catalyst deliverable. |

Deliberately consumable standalone: a wallet or an explorer should be able to use `effects` without adopting the rest of the protocol. That reusability is an argument in the CIP.

### `identity`
CIP-0170 attestation issuance and resolution via `signify-ts`. A publisher binds their domain to their endpoints; clients resolve and display verified identity.

**Why it is its own package.** CIP-0170 is the piece most likely to be cut at the Month 1 go/no-go — it is pre-production and new to the team. As a separate package, cutting it means deleting a dependency line; folded into `client`, cutting it means untangling code under time pressure. This split is a scope-risk hedge, not an architectural preference.

### `client`
CIP-30 orchestration plus React components. Wallet discovery/enable, change address + network id, local balancing via `@evolution-sdk/evolution` against the user's own UTxOs, effects derivation, `signTx` → witness assembly → `submitTx`, and rebuild-and-retry when UTxOs move mid-flow. Components: action card, generated parameter form, effects panel with the mismatch block, publisher chip, wallet selector, receipt, error states. Hooks (`useAction`, `useWallet`, `useEffects`) are the composable surface.

`tokens.css` holds the design tokens as CSS custom properties and is the single source of truth — no hard-coded hex anywhere in components.

Must survive being dropped into a third-party page: no fixed positioning, no assumption it owns the page, self-contained styles that tolerate an inherited font stack.

### `apps/interstitial`
Tier-1 client and the M1 headline: a hosted, self-hostable page that runs the whole flow with zero wallet cooperation beyond CIP-30. Also owns OG/Twitter preview metadata, since the unfurl is the first impression of a shared link.

### `apps/docs`
Documentation site and the Action tester — paste an endpoint URL, see the rendered card alongside the raw GET/POST payloads. The tester is the single best adoption tool in the project: a developer verifies their endpoint in seconds without installing anything.

### `examples/adalink`
Reference integration, not a library. Proves the SDK on a product with real users: USDM/USDCx payment actions, human URLs via `actions.json`, live on mainnet with labelled transactions.

## Dependency rules

```
core  ←  server
  ↑
  └───  client  →  effects
          │  ↓
          │  evolution-sdk
          └→ identity

      interstitial  →  (client, core)
      docs          →  (client, core)
      adalink       →  (server)
```

- `core` depends on no workspace package.
- `effects` depends on `core` types only — never on `client`/`server`.
- `server` never imports `client` or `effects`; a dApp shipping an endpoint should not pull a React tree.
- `identity` is a leaf that `client` consumes; nothing depends on `identity` in reverse.
- Apps depend on packages, never the reverse.

Enforce the direction in review. The moment `effects` imports from `client`, the security argument gets harder to make.

## TypeScript configuration

`tsconfig.base.json` at the root holds compiler options and nothing else — no `include`, no `files`. It is strict, `ES2022`, `NodeNext` for both `module` and `moduleResolution`, and emits declarations with maps. Every package extends it; no package restates a compiler option that belongs in the base.

Root `tsconfig.json` is a solution file: `include: []` plus one reference per package, so `tsc --build` at the root walks the workspace in dependency order. Add the reference when the package lands.

Each package carries the same four files, mirroring evolution-sdk:

| File | Role |
|---|---|
| `tsconfig.json` | solution file for the package — `include: []`, references `tsconfig.src.json` |
| `tsconfig.src.json` | the sources: `include: ["src"]`, `rootDir: "src"`, own `tsBuildInfoFile` |
| `tsconfig.build.json` | extends `tsconfig.src.json`, adds `outDir: "dist"` and `stripInternal` — what `pnpm build` runs |
| `tsconfig.test.json` | `include` the tests, `noEmit`, references `tsconfig.src.json` |

```jsonc
// packages/core/tsconfig.src.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": ".tsbuildinfo/src.tsbuildinfo"
  }
}
```

Two consequences worth internalising before the first package is written:

- **Declaration output is the linkage.** `client` typechecks against `core`'s emitted `.d.ts`, not its sources. That is why the turbo `typecheck` and `test` tasks depend on `^build` — skip the build and the import is simply unresolvable.
- **Relative imports carry explicit file extensions** (`./util.js`, pointing at the emitted file, from `util.ts`). NodeNext rejects the extensionless form outright; this is the ESM strictness tax ADR-0003 accepts.

`types: []` in the base keeps ambient globals out. A package that needs Node globals opts in with `"types": ["node"]` in its own config, which keeps `core` honest about its zero-dependency goal.

## The two data flows

**Build (Mode A, the only v1 mode).** Client resolves the link through `actions.json` → `GET` metadata → renders card → wallet connect → `POST { changeAddress, network }` → server returns a *partial* intent (its side only) → **client balances locally** → complete unsigned tx. The endpoint never sees the user's UTxO set; that is the privacy advantage we extracted from the eUTxO input-selection constraint.

**Sign.** Derive effects → compare → block on mismatch, otherwise show exact effects → `signTx` (returns a **witness set**, not a signed tx) → assemble witnesses into the body → `submitTx` → receipt. On input-spent failure, rebuild from fresh UTxOs, re-derive effects, and only then re-prompt.

## Trust model

Two halves of one answer, and neither is sufficient alone:

- **Effects derivation** proves *what* the transaction does. Arithmetic on the tx body, not a simulation — possible because eUTxO transactions fully determine their own effects. Mismatch hard-blocks signing.
- **CIP-0170 attestation** proves *who* is asking. Resolved and verified client-side, rendered beside the effects. Unverified publishers are marked, not blocked — identity augments, effects gate.

Effects without identity leaves users approving correct transactions from unknown parties. Identity without effects is the central registry Solana needed and we are avoiding.

## Conventions a reviewer enforces

- **No hard-coded colours outside `tokens.css`.** Lint-enforced where possible.
- **`effects` stays pure.** No network calls, no React imports, no wallet references. Ever.
- **The adversarial corpus grows with every bug.** Any transaction that should have been blocked and wasn't becomes a permanent test case.
- **Spec changes are PRs against `spec/` first**, implementation second. The schemas are the contract.
- **Every package publishes independently** via Changesets. A fix in `effects` must not force a `client` release.

## Deliberate non-architecture

No treasury validator, no relayer, no fee tank, no custody, no central registry, no service we operate that the protocol depends on. dApps host their own endpoints; the interstitial is self-hostable; the SDK is a library. The blast radius of a bug here is a failed transaction, not a drained wallet.
