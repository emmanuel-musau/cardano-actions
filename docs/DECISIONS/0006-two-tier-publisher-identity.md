# ADR-0006: Ship publisher identity in two tiers, with the domain manifest as the default

**Status:** Accepted
**Date:** 2026-08-20
**Issue:** TBD — identity layer shape. Tier-2 go/no-go remains #63.

## Context

The identity layer was specified as "CIP-0170 attestation binding a domain to its
action endpoints." Reading CIP-0170 as merged shows that description claims more
than the CIP delivers.

**What CIP-0170 actually specifies.** A KERI `ATTEST` record anchors a digest of
arbitrary data in the issuer's Key Event Log and publishes a reference to that
event in transaction metadata under label `170`. Through an ACDC credential chain
the identifier resolves to a legally recognised entity, and the attestation is
valid only between `AUTH_BEGIN` and `AUTH_END`. It is a strong primitive and the
Cardano Foundation authors it, with Reeve and Veridian as implementors.

**Three things it does not give us:**

1. **No domain→AID discovery.** Nothing answers "given `linktap.example`, which
   identifier should I trust?" That is the exact question a client has to answer
   before it can render a publisher, and it is ours to define.
2. **No publisher payload.** The digest is over arbitrary data, so the shape of
   what a publisher attests is unspecified.
3. **Discovery infrastructure is immature by the CIP's own admission.** Watcher
   networks are not widely deployed; the named interim path is an OOBI published
   over "a known persistent channel."

There is also a cost floor: an attestation is an on-chain write, and verification
runs off-chain through indexers. That is proportionate for a regulated issuer and
disproportionate for someone posting a tip link — and tip links are a headline use
case, not an edge case.

Separately, CIP-0186 (merged, three independent wallet implementations) established
an origin-anchored `.well-known` manifest as the ecosystem's pattern for exactly
this kind of runtime trust anchor.

## Decision

Publisher identity ships in two tiers, and the client resolves them as a chain, not
as alternatives.

**Tier 1 — domain attestation. The default, in M1 unconditionally.** A signed
manifest at `https://<domain>/.well-known/cardano-actions.json` binds the domain to
the endpoints it vouches for. No chain write, no credential chain, no cost to
publish. Renders as "published by `<domain>`, domain-verified". Shape follows
CIP-0186's `.well-known/cip30dl-attestation.json` precedent.

**Tier 2 — CIP-0170 attestation. High assurance, subject to #63.** The Tier-1
manifest is the payload whose digest is anchored in the KEL, so Tier 2 sits *on top
of* Tier 1 rather than beside it, and Tier 1 supplies the domain→AID discovery the
CIP omits. Renders as "published by `<legal entity>`, identity-verified".

**Neither tier gates.** Absent, malformed, expired, revoked and valid are five
distinct rendered states; only the last says verified. A verified publisher never
relaxes the effects gate, and a failed resolve has no path that degrades into a
verified badge.

## Alternatives considered

**CIP-0170 alone, as originally written.** Rejected on cost and on the discovery
gap. It makes every publisher pay for a chain write and a credential chain before
they can be rendered as anything but unknown, and it still leaves us defining the
domain binding — so it is not even the smaller amount of specification work.

**Domain manifest alone, drop CIP-0170.** Rejected. Domain control is the weakest
useful claim: it proves someone holds DNS, not who they are. For the stablecoin and
merchant cases the project is aimed at, a path to legal identity is the difference
between a demo and something a regulated counterparty can use. It also forfeits an
alignment with the Cardano Foundation's own identity work that costs us little to
keep.

**A registry of known-good publishers.** Rejected outright, and permanently. A
central list of who may be rendered is precisely the mechanism Solana needed and
that the effects gate exists to make unnecessary. Reintroducing it in the identity
layer would give back the project's structural argument.

## Consequences

The identity layer now degrades instead of disappearing. If #63 goes the wrong way,
Tier 1 ships and publishers are still attributable — where previously a no-go left
M1 with no identity story at all. That is what makes #63 a genuinely open question
rather than one the schedule answers for us.

The cost is that we own a manifest format nobody else has specified: its schema,
its signing scheme, its cache and revocation posture. That work exists in either
design, but it is now explicitly ours and belongs in `spec/` alongside the action
payloads, not invented inside `packages/identity`.

Tier ordering is load-bearing and hard to reverse once the CIP is public. If Tier 2
were later respecified to carry its own discovery, Tier 1 would become redundant
rather than foundational, and clients written against the chain would need
rewriting. Watch the CIP-0170 discussion for movement on discovery before the CIP
PR (#71) is filed.

CIP-0170's own acceptance criteria are all still unchecked, and criterion 2 names
"identity-bound actions" as a qualifying use. Being the implementation that ticks
that box is worth raising with the authors directly.
