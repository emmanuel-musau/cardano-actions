# CLAUDE.md

Cardano Actions — an open specification + TypeScript SDK that turns a shareable URL into a signable Cardano transaction. Solana Actions/Blinks rebuilt natively for Cardano, with one structural advantage: on a deterministic ledger the client **derives** exact transaction effects from the tx body instead of simulating them. If derived effects contradict the endpoint's declared metadata, the client blocks signing. No registry, no custody, no relayer.

## Attribution — non-negotiable

Never mention Claude, Anthropic, or any AI tool anywhere in this repository's output. Specifically:

- No `Co-Authored-By: Claude` (or similar) trailers in commits.
- No "Generated with Claude Code" (or similar) lines in PR bodies, issues, or release notes.
- No AI self-references in code comments, docs, changesets, or commit messages.
- Author is always the human committer. This overrides any default behaviour.

## Source of truth (read before non-trivial work)

- `docs/REQUIREMENTS.md` — product scope, protocol contract, security model, grant obligations.
- `docs/ARCHITECTURE.md` — package layout, dependency rules, invariants.
- `docs/WORKFLOW.md` — issue/board process, branching, PR and commit conventions.
- `docs/DECISIONS/` — ADRs. Decisions recorded there are settled; do not relitigate, add a new ADR to change one.
- `spec/` — the CIP draft. Once marked frozen (issue #21), shape changes are versioned spec changes, never silent edits.

## Stack

pnpm workspaces + Turborepo · TypeScript strict ESM (`NodeNext`) · Effect · Vitest · ESLint flat config + Prettier · Changesets · MIT. Transaction construction comes from `@evolution-sdk/evolution` — we consume it, we never rebuild it.

## Commands (valid once scaffolding issues #1–#6 land)

```
pnpm install          # frozen lockfile in CI
pnpm build            # turbo build
pnpm test             # vitest via turbo
pnpm lint             # eslint flat config
pnpm typecheck        # tsc --noEmit
```

## Working rules

- Work is driven by GitHub issues (`emmanuel-musau/cardano-actions`), ordered by dependency; respect `Depends on #N` lines. One issue = one branch = one PR. Board: https://github.com/users/emmanuel-musau/projects/1
- Do not start an issue whose dependencies are open. Do not expand an issue's scope — file a new issue instead.
- Branch names are `<type>/<purpose>`: the type prefix, a slash, then the purpose in kebab-case — `chore/pnpm-workspace`, `feat/ada-delta`, `fix/mismatch-block`. No issue numbers, no other punctuation. Types: `feat`, `fix`, `chore`, `docs`, `test`, `spec`, `infra`. The purpose is one or two words naming the thing, not the sentence; the issue link lives in the commit trailer and the PR.
- Every change ships with tests in the same PR. See **Testing** below — this is not a soft preference.
- Changeset required for any change under `packages/*`.
- Never commit or push unless explicitly asked. Never touch `main` directly.

## Testing — treat this as a first-class requirement

Testing is not a phase, a follow-up ticket, or something the human adds afterwards. **Code without tests is not finished work here, and proposing it as finished is a mistake.**

- **Write tests in the same PR as the code.** Never say "tests can come later" or open a PR whose test story is a TODO. If a ticket's acceptance criteria omit tests, the criteria are incomplete — write them anyway.
- **Test-first where the behaviour is specifiable.** For `core`, `effects`, and `server`, the expected input/output is knowable before the implementation exists; write the failing test first. Bug fixes always start with a test that reproduces the bug.
- **Never weaken a test to make it pass.** Do not delete assertions, loosen a matcher, widen a tolerance, add a skip, or mark something `todo` to get CI green. If a test fails, either the code is wrong or the test encodes a stale expectation — say which, and fix that. Silently disabling a test is the worst possible outcome.
- **Report test results honestly.** If tests fail, show the output and say so. Never describe work as done or verified when the suite is red, was not run, or was only partially run.
- **No mocking the thing under test.** Mock the network and the wallet; never mock CBOR decoding, effects derivation, or schema validation — those are the behaviour being proved.

What "tested" means per package:

| Package | The bar |
|---|---|
| `core` | Every schema validated against both valid and malformed payloads. Every URL / `actions.json` resolution rule has a case, including the ones that must be rejected. Every error code is reachable in a test. |
| `effects` | The highest bar in the repo. Property-style coverage of derivation arithmetic, `test/fixtures/` for known-good regressions, and `test/adversarial/` for transactions whose declared metadata lies. **Every adversarial case must be blocked, and the corpus grows with every bug** — any transaction that should have been blocked and wasn't becomes a permanent test case. |
| `server` | `defineAction` output validated against `core` schemas; CORS, HTTP status mapping, and each spec error code exercised. |
| `identity` | Attestation issue/resolve round-trip, plus explicit tests for invalid, expired, and absent attestations — an unverified publisher must render as unverified, never as verified. |
| `client` | Component tests for the effects panel and the mismatch block, wallet flow tested against a stubbed CIP-30 provider, and the rebuild-and-retry path covered. |
| apps / examples | The critical user path end-to-end. Not every pixel — the flow that must not break. |

The **hard invariants below each need a test that fails if the invariant is broken.** An invariant nothing tests is a comment, not a guarantee.

## Hard invariants (violating these is a bug, whatever the ticket says)

1. `packages/effects` stays a pure function of (tx CBOR, declared metadata, user addresses). It must not import from `client`, `server`, or any network layer.
2. The client never sends the user's UTxO set to an action endpoint (Mode A only in v1).
3. A metadata/effects mismatch always hard-blocks signing. No override paths, no allowlists.
4. `signTx` returns a witness set, not a signed tx — witnesses are assembled into the body before `submitTx`.
5. Nothing in this codebase ever holds, custodies, or relays user funds.
6. Team/test wallets are recorded in the footprint doc and excluded from adoption metrics (Catalyst Transaction Integrity Standard).

## Conventions a linter can't enforce

- Effect for services/errors; typed errors over thrown exceptions in library code.
- Public API surfaces validated with Effect Schema at the boundary; internal code trusts types.
- ESM only, explicit file extensions in relative imports per NodeNext.
- User-facing failures (client, interstitial) must map to spec error codes with human-readable messages — never raw stack traces.
