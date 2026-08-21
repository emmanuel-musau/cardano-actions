---
CIP: "?"
Title: Cardano Slips
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

This proposal defines *Cardano Slips*: a protocol by which an HTTP endpoint
describes an on-chain intent and returns an unsigned transaction, so that an
ordinary URL can carry a specific, signable intent to wherever a person already
is — a social post, a chat message, a printed QR code.

A Slip is two HTTP methods on one endpoint. `GET` returns metadata
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

This proposal also registers the `//slip` authority under [CIP-13], defines an
`slips.json` mapping from human-readable paths to endpoints, and specifies the
unavailable and failure states a client must render.

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
peer. Supporting a new kind of Slip therefore means writing a new CIP and
persuading every wallet to implement it, one at a time — a cost the support
matrices for `//pay`, `//drep` and `//browse` make visible.

The nearest precedent is [CIP-99], which is Active with five wallet
implementations and already has wallets send an HTTP `POST` to a project's own
server from a link. What CIP-99 does not do is return a transaction for the user
to authorise: its server builds, signs and submits the transaction itself and
pays for it, which suits a faucet and cannot express a Slip the user
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

### Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC 2119] and [RFC 8174] when, and only when, they
appear in all capitals.

Three roles are referred to throughout:

- **Slip endpoint** — the HTTP resource that answers `GET` and `POST`.
- **Publisher** — the party operating the endpoint.
- **Client** — software that resolves a link, renders the Slip, derives the
  effects of the resulting transaction, and drives the wallet.

Every payload defined here has a JSON Schema under
[`schemas/`](./schemas), and those schemas are normative: where this prose and a
schema disagree, the schema is the defect. Payloads that a conforming
implementation MUST accept, and payloads it MUST reject, are published as a
test corpus in [`../examples/`](../examples).

### Discovery

A client discovers a Slip by issuing `GET` to the Slip endpoint.

The request carries no body. A client MUST NOT send credentials — no cookies,
no `Authorization` header — and an endpoint MUST NOT require them in order to
describe itself. Discovery is anonymous by construction: the same bytes are
returned to the person who clicked the link and to the crawler that generated
its preview, and an endpoint therefore learns nothing about a person from the
fact that a card was rendered.

```http
GET /api/slips/pay/corner-store HTTP/1.1
Host: linktap.example
Accept: application/json
```

A successful response MUST have status `200`, MUST set `Content-Type` to
`application/json`, and MUST set `Access-Control-Allow-Origin: *`. A client
executes inside a page on an origin the publisher does not control, so an
endpoint without that header is unreachable by every client. Preflight
requirements are specified with `POST`.

```http
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=60
```

The response MUST NOT vary by requester identity, and SHOULD be cacheable.

A Slip that cannot currently be used MUST still answer `200` with a complete
body and `disabled` set, as described under [Unavailable
actions](#unavailable-actions). Reporting unavailability with a non-2xx status
is non-conforming: it turns a state the client can render into a failure the
person meets only after committing to the action. Non-2xx responses signal that
discovery itself failed.

### The discovery response

The response body is a single JSON object.

| Field | Required | Type | Rule |
|---|---|---|---|
| `type` | yes | string | MUST be `"slip"`. Discriminates discovery metadata from the partial intent `POST` returns. |
| `version` | yes | string | The major version of this protocol the response speaks, in decimal, with no leading zero. `"1"` for this document. |
| `title` | yes | string | What the Slip does, in the publisher's own words. 1–120 characters. |
| `description` | yes | string | Plain text, 1–500 characters. MUST NOT contain markup; a client MUST render it as text. |
| `icon` | yes | string | Absolute `https:` URL of a square image. `data:` URIs MUST NOT be used — the same image is fetched by link unfurlers that never execute the publisher's code. |
| `label` | yes | string | The Slip's call to action, 1–48 characters. Labels the single button when `links` is absent; where `links` is present a client MUST render the linked actions and use `label` only where one string is all that fits, such as a link preview. |
| `network` | yes | string | One of `mainnet`, `preprod`, `preview`. A client MUST NOT `POST` while the connected wallet is on a different network. |
| `links` | no | object | Carries `actions`, an array of 1–3 [linked actions](#linked-actions). When absent, the Slip is a single button labelled `label` whose target is the discovery URL itself. |
| `disabled` | no | boolean | When `true`, nothing in this response may be signed. See [Unavailable actions](#unavailable-actions). |
| `reason` | no | object | Why the Slip is unavailable. Valid only alongside `disabled`. |

A client MUST reject a response carrying a member not defined above. An
undefined member is either a newer version the client has not been told about
or a payload it has misidentified, and both are safer refused than rendered.

`version` is matched as a decimal string rather than pinned to `"1"`, so that a
client meeting a future major version can tell an unsupported protocol from a
malformed response. What it does about that is specified with the error
taxonomy.

```json
{
  "type": "slip",
  "version": "1",
  "network": "mainnet",
  "icon": "https://linktap.example/i/corner-store.png",
  "title": "Pay 12.00 USDM to Corner Store",
  "description": "One payment to the shop's address. Nothing is stored, no account is created.",
  "label": "Pay 12.00 USDM"
}
```

Every field above describes the Slip; none of it describes the person, and
nothing in discovery is a promise about the transaction. `title` and
`description` are claims by the publisher, checked later against the effects a
client derives from the transaction body itself.

The `network` field is named rather than numeric because a CIP-30 wallet
reports only `0` or `1`, which cannot separate `preprod` from `preview`. An
endpoint serving more than one network MUST publish one URL per network.

### Linked actions

`links.actions` replaces the single button with up to three, each a distinct
action against the same publisher.

| Field | Required | Type | Rule |
|---|---|---|---|
| `label` | yes | string | Button text, 1–64 characters. MAY contain placeholders drawn from this action's `parameters`. |
| `href` | yes | string | The `POST` target: a path-absolute reference, or an absolute `https:` URL. MAY contain placeholders. |
| `parameters` | no | array | 1–8 [parameters](#parameters) whose values complete `href`. |
| `disabled` | no | boolean | When `true`, this option alone cannot be used. |
| `reason` | no | object | Why this option is unavailable. Valid only alongside `disabled`. |

A client MUST resolve `href` against the discovery URL, and MUST reject the
response unless every resolved target has the same origin as the discovery URL.
A Slip that hands a person to a third party for the transaction is
indistinguishable from a hijacked link, and [CIP-13]'s own security
considerations raise exactly that concern. Where a publisher wants a human URL
in front of a technical endpoint, `slips.json` is the sanctioned indirection.

The cap of three is a property of the shape, not of any client: a publisher
offering more choices expresses them as a `select` parameter, which stays
legible at any width and keeps a card from becoming a menu.

```json
{
  "type": "slip",
  "version": "1",
  "network": "mainnet",
  "icon": "https://fund.linktap.example/i/community-fund.png",
  "title": "Contribute to the Community Fund",
  "description": "Pick an amount and a token. The fund's address is the only recipient.",
  "label": "Contribute",
  "links": {
    "actions": [
      { "label": "Contribute 25 USDM", "href": "/api/slips/fund/community?amount=25&token=usdm" },
      { "label": "Contribute 100 USDM", "href": "/api/slips/fund/community?amount=100&token=usdm" },
      {
        "label": "Contribute {amount} {token}",
        "href": "/api/slips/fund/community?amount={amount}&token={token}",
        "parameters": [
          { "name": "amount", "label": "Amount", "type": "number", "min": 1, "max": 500, "required": true },
          {
            "name": "token",
            "label": "Token",
            "type": "select",
            "required": true,
            "options": [
              { "label": "USDM", "value": "usdm" },
              { "label": "USDCx", "value": "usdcx" }
            ]
          }
        ]
      }
    ]
  }
}
```

### Parameters

A parameter describes one field of a form the client generates. It describes
input only: it is a hint about what to collect, never a guarantee about what
arrives, and an endpoint MUST validate every value it receives regardless of
what it declared.

| Field | Required | Type | Rule |
|---|---|---|---|
| `name` | yes | string | Matches the placeholder it fills. Begins with a letter, then letters, digits or `_`, up to 32 characters. MUST be unique within its action. |
| `label` | yes | string | Field label, 1–48 characters. |
| `type` | yes | string | One of `text`, `number`, `select`. |
| `required` | no | boolean | Defaults to `false`. A client MUST NOT `POST` while a required parameter is empty. |
| `min` | no | number | For `number`, the smallest accepted value. For `text`, the smallest accepted length, as a non-negative integer. MUST NOT appear on `select`. |
| `max` | no | number | The corresponding upper bound, and MUST NOT be less than `min`. MUST NOT appear on `select`. |
| `options` | no | array | 1–20 `{ label, value }` pairs. REQUIRED on `select`, and MUST NOT appear on any other type. |

A client MUST enforce `required`, `min` and `max` before sending a request, and
MUST show the bounds alongside the field rather than only on failure.

The three types are the set whose meaning is unambiguous across every client
this protocol expects. Types carrying Cardano-specific validation — addresses,
asset amounts with decimals — are deliberately absent from version 1 rather
than specified before there is an implementation to check them against.

### Templated references

`label` and `href` MAY contain placeholders of the form `{name}`, where `name`
matches a parameter of the same linked action.

- A client MUST substitute the collected value for each placeholder.
- A value substituted into `href` MUST be percent-encoded per [RFC 3986].
- A placeholder in `label` is substituted verbatim, for display only.
- A response containing a placeholder with no matching parameter MUST be
  rejected. Braces are never literal.
- A response declaring a parameter that no placeholder references MUST be
  rejected. A collected value that reaches nothing is a defect in the endpoint,
  not an optional extra.

A linked action without `parameters` is submitted as soon as it is chosen.

### Unavailable actions

`disabled` appears at two levels, and its accompanying `reason` explains it.

- `disabled` at the top level closes the entire action.
- `disabled` on a linked action closes that option alone.
- Where both appear, the top level wins. A linked action MUST NOT be treated as
  usable because it carries `disabled: false` under a disabled response.
- `disabled: true` MUST be accompanied by `reason` at the same level. A control
  a person cannot use, with no reason given, leaves them unable to distinguish a
  closed action from a broken one.
- `reason` MUST NOT appear without `disabled: true`. It states why something is
  unavailable and carries no other meaning.

A client MUST render a disabled action, and MUST render its `reason.message` in
place of the control it disables. A client MUST NOT hide a disabled action or
omit a disabled option: a shared link is seen by many people at once, and a
client that silently drops part of it shows different people different actions
with no way for the publisher to know.

`reason` carries a REQUIRED human-readable `message` of 1–300 characters, and an
OPTIONAL machine-readable `code` naming the unavailability. A `code` here is not
a failure code: the request succeeded, and the response is describing the state
of the action rather than reporting that something went wrong. Codes for
requests that genuinely fail are specified with the error taxonomy.

```json
{
  "type": "slip",
  "version": "1",
  "network": "mainnet",
  "icon": "https://linktap.example/i/community-pool.svg",
  "title": "Delegate to Community Stake Pool",
  "description": "Stake your ADA. Funds never leave your wallet.",
  "label": "Delegate",
  "disabled": true,
  "reason": { "message": "This campaign closed on 12 August. Nothing can be signed from this link." }
}
```

```json
{
  "type": "slip",
  "version": "1",
  "network": "preprod",
  "icon": "https://linktap.example/i/builders-workshop.png",
  "title": "Reserve a seat at the builders workshop",
  "description": "One payment reserves one seat. Seats are released in tiers.",
  "label": "Reserve a seat",
  "links": {
    "actions": [
      { "label": "General seat — 25 USDM", "href": "/api/slips/workshop/reserve?tier=general" },
      {
        "label": "Front row — 75 USDM",
        "href": "/api/slips/workshop/reserve?tier=front",
        "disabled": true,
        "reason": { "message": "Front row is sold out. General seats are still available." }
      }
    ]
  }
}
```

<!--
Filled incrementally, one section per issue. Add subsections here rather than
new top-level headings — CIP-0001 fixes the H2 set.

  #16  slips.json domain mapping
  #17  POST request/response and the partial-intent format (Mode A)
  #18  error-code taxonomy and versioning strategy
  #19  mandatory client-side effects derivation and mismatch rules
  #20  security considerations

The `//slip` authority registration and its versioned grammar belong here
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
[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174
[RFC 3986]: https://www.rfc-editor.org/rfc/rfc3986
