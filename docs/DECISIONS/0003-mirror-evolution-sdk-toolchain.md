# ADR-0003: Mirror the evolution-sdk toolchain

**Status:** Accepted
**Date:** 2026-08-19

## Context

This project depends on `@evolution-sdk/evolution` for transaction construction, and the technical lead is a maintainer of that library. Toolchain choices for a new monorepo — package manager, task runner, module system, effect library, test runner, release tooling — are individually arguable and collectively expensive to revisit.

## Decision

Mirror IntersectMBO/evolution-sdk: pnpm workspaces, Turborepo, TypeScript strict ESM (`NodeNext`), Effect, Vitest, ESLint 9 flat config with Prettier, Changesets, MIT license.

We consume evolution-sdk for transaction construction. We do not reimplement any part of it.

## Alternatives considered

**Pick each tool on its own merits.** Produces a defensible stack and a week of decisions, on a budget where the effects engine is the critical path.

**Reimplement transaction building to avoid a heavy dependency.** Would replace the project's differentiator — effects derivation — with a rewrite of solved work, and forfeit the one credibility argument the proposal leans on: that the team maintains the library this is built on.

## Consequences

Context transfers in both directions: patterns, CI shapes, and debugging instincts from evolution-sdk apply here, and problems found here can be fixed upstream. Contributors who know one repo can navigate the other.

The cost is coupling to evolution-sdk's own toolchain drift, and inheriting the ESM/NodeNext strictness tax — explicit file extensions, occasional dependency friction — which we accept as the price of matching the ecosystem we are extending.
