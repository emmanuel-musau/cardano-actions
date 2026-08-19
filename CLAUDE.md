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

pnpm workspaces + Turborepo · TypeScript strict ESM (`NodeNext`) · Effect · Vitest · ESLint 9 flat config + Prettier · Changesets · MIT. Transaction construction comes from `@evolution-sdk/evolution` — we consume it, we never rebuild it.

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
- Every package change ships with tests in the same PR; testing is never deferred to a later ticket except where the backlog explicitly says so.
- Changeset required for any change under `packages/*`.
- Never commit or push unless explicitly asked. Never touch `main` directly.

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
