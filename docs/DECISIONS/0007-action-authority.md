# ADR-0007: Claim `//action` as the URI authority, register it through CPS-16, and keep it out of M1

**Status:** Superseded by [ADR-0008](0008-rename-to-slips.md)
**Date:** 2026-08-20
**Issue:** TBD — CIP draft. Registration lands with the CIP PR (#71).

## Context

The `web+cardano:` scheme is extended by registering an authority. CPS-16 states
that every future extension MUST register a new, unique authority, and recent
editor practice is a discrete CIP per authority rather than amendments to CIP-13.
Eight are taken: `null`, `//stake`, `//claim`, `//transaction`, `//block`,
`//addr`, `//browse`, `//drep` — plus `//connect`, which CIP-45 has used since
2023 and which CPS-16's list omits. `//action` has no hits anywhere in the CIPs
repository.

The project is also named Cardano Actions, the GitHub organisation is
`cardano-actions`, the npm scope is `@cardano-actions`, and the protocol's core
noun is an Action throughout `REQUIREMENTS.md` and `spec/`.

Two things had to be settled: what the authority is called, and when it is
claimed.

## Decision

**The authority is `//action`, versioned from the first release as
`web+cardano://action/v1/...`.** Versioning is in the grammar from day one, not
added later — `//claim` and `//pay` both carry versioned paths and `//stake` and
the authority-less payment form, which do not, are the two that have struggled
to change.

**Registration happens with the CIP PR, not before.** CPS-16 registration is a
pull request adding a bullet to a markdown list; it confers no allocation and
blocks nothing. Claiming early buys nothing and invites a naming argument before
there is an implementation to point at.

**The URI is not in M1.** M1 ships desktop web, CIP-30, and ordinary `https://`
links, none of which need the scheme. `REQUIREMENTS.md` §6 already defers mobile
deep links to roadmap and that stands.

**The CIP is framed as answering CPS-16's Open Question 3** — "what new
authorities or protocols could be built to leverage these URIs?" — and lists
itself under CPS-16's Proposed Solutions.

## Alternatives considered

**`//intent`.** Matches the protocol's own vocabulary — the POST response is a
*partial intent* — and carries no collision. Rejected on identity: the
organisation, the npm scope, the package names and the entire body of
documentation say Action, and a protocol whose URI disagrees with its own name
makes every sentence about it require a translation step. The naming risk below
is accepted knowingly in exchange for one word meaning one thing everywhere.

**`//tx`, `//sign`, `//do`, `//request`.** Each is free and each is worse.
`//tx` and `//sign` name the last step rather than the thing being shared,
`//do` says nothing, and `//request` collides conceptually with CIP-99's claim
request.

**Extend `//pay` (CIP-157) instead of registering a new authority.** Rejected.
CIP-157 is a static payment shape — four query parameters, no server round-trip
— and has been open since June 2024 with no implementations. Attaching arbitrary
intents to it inherits its stall without gaining anything, and CPS-16's own
guidance prefers a discrete CIP.

## Consequences

**The known cost: `action` is loaded vocabulary on Cardano.** Since Conway,
"governance action" is a first-class ledger concept, and `web+cardano://action`
sitting beside `//drep` will read as governance to part of the audience. This is
accepted, not overlooked. Mitigations, all cheap: the versioned path makes the
grammar unambiguous to parsers; the CIP's Abstract distinguishes the two in its
first paragraph; and no example anywhere in `spec/` uses a governance
transaction as its illustration.

If that collision proves genuinely confusing in review, the rename is a
find-and-replace across `spec/` while the CIP is a draft. After the CIP PR is
filed it is effectively permanent, because third-party implementers will cite
it. That is the decision point, not now.

Deferring registration means a small risk that someone claims `//action` first.
Low — nothing in the repository or its open PRs is heading there — and the CIP-99
precedent shows the ecosystem moves slowly enough that the risk of arguing about
a name before having an implementation is the larger one.
