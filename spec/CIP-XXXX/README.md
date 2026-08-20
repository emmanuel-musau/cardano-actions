---
CIP: "?"
Title: Cardano Actions
Category: Wallets
Status: Proposed
Authors:
    - Emmanuel Mutisya <emmanuelmutisya254@gmail.com>
Implementors: []
Solution To:
    - CPS-0016: https://github.com/cardano-foundation/CIPs/tree/master/CPS-0016
Discussions:
    - Original PR: https://github.com/cardano-foundation/CIPs/pull/?
Created: 2026-08-20
License: CC-BY-4.0
---

## Abstract

This proposal defines *Cardano Actions*: a protocol by which an HTTP endpoint
describes an on-chain intent and returns an unsigned transaction, so that an
ordinary URL can carry a specific, signable action to wherever a person already
is — a social post, a chat message, a printed QR code.

An Action is two HTTP methods on one endpoint. `GET` returns metadata
describing the intent and its parameters. `POST` returns a *partial
transaction* carrying only the publisher's side of it. A client resolves the
link, balances the transaction locally against the user's own unspent outputs
— the endpoint never receives them — derives the transaction's exact effects
from its body, and refuses to request a signature if those effects contradict
the metadata the endpoint declared.

Because an eUTxO transaction fully determines its own effects and fee before
submission, that comparison is arithmetic over the transaction body rather than
a simulation of it. A client can therefore establish what a transaction does
without trusting its publisher, and no registry of approved publishers is
required.

This proposal also registers the `//action` authority under [CIP-13], defines an
`actions.json` mapping from human-readable paths to endpoints, and specifies the
error and disabled states a client must render.

## Motivation: Why is this CIP necessary?

<!-- #14 drafts this; #21 finalises it against the frozen v1 shapes. -->

[CPS-16] asks, as its third open question, what new authorities or protocols
could be built to leverage Cardano URIs. This proposal is one answer.

Cardano has the components for shareable on-chain interactions and no standard
that joins them. [CIP-13] defines the `web+cardano:` scheme, and nine
authorities are registered under it. Four produce a transaction — payment,
stake delegation, DRep delegation and token claims — and each fixes that
transaction's shape in the URI itself, with a defined set of query parameters.
The remainder reference chain data, open a URL in a wallet's browser, or pair a
peer. Supporting a new kind of action therefore means writing a new CIP and
persuading every wallet to implement it, one at a time — a cost the support
matrices for `//pay`, `//drep` and `//browse` make visible.

The nearest precedent is [CIP-99], which is Active with five wallet
implementations and already has wallets send an HTTP `POST` to a project's own
server from a link. What CIP-99 does not do is return a transaction for the user
to authorise: its server builds, signs and submits the transaction itself and
pays for it, which suits a faucet and cannot express an action the user
initiates. Across every registered authority, either the transaction shape is
fixed in the URI or the server signs. Nothing lets a publisher express an
arbitrary intent that the user authorises.

The stakeholders are the dApps that lose users in the gap between seeing a link
and reaching a signing screen; the merchants and creators who want to be paid in
native assets without operating a checkout; the stake pool operators and
referrers whose distribution is entirely link-sharing; and the wallets, which
today must implement each new URI authority separately rather than one general
mechanism.

A protocol that returns a server-built transaction also creates a risk the
existing authorities do not carry: the user is asked to sign something a third
party constructed. [CIP-13]'s own security considerations raise the related
concern of links that misrepresent where they lead. This proposal answers both
by making client-side derivation of a transaction's effects mandatory, and a
contradiction between derived effects and declared metadata a hard block on
signing.

## Specification

<!--
Filled incrementally, one section per issue. Add subsections here rather than
new top-level headings — CIP-0001 fixes the H2 set.

  #15  GET discovery response shape
  #16  actions.json domain mapping
  #17  POST request/response and the partial-intent format (Mode A)
  #18  error-code taxonomy and versioning strategy
  #19  mandatory client-side effects derivation and mismatch rules
  #20  security considerations

The `//action` authority registration and its versioned grammar belong here
too — see docs/DECISIONS/0007-action-authority.md. Shapes freeze at #21.
-->

## Rationale: How does this CIP achieve its goals?

<!--
Written at #21, once the shapes are frozen. Must cover: why client-side
balancing is the only v1 mode (docs/DECISIONS/0002); why effects derivation
replaces a publisher registry; how this relates to CIP-13, CIP-99 and CIP-157;
and how it answers CPS-16. Unresolved questions belong here as an
`### Open Questions` subsection, not as a top-level heading.
-->

## Path to Active

### Acceptance Criteria

<!-- Written at #21. -->

### Implementation Plan

<!-- Written at #21. -->

## Copyright

This CIP is licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

[CIP-13]: https://github.com/cardano-foundation/CIPs/tree/master/CIP-0013
[CIP-99]: https://github.com/cardano-foundation/CIPs/tree/master/CIP-0099
[CPS-16]: https://github.com/cardano-foundation/CIPs/tree/master/CPS-0016
