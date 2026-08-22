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

This proposal also registers the `//slip` authority under [CIP-13], defines a
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
malformed response. What it does about that is specified under [Protocol
versioning](#protocol-versioning).

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
requests that genuinely fail are specified under [Failure
responses](#failure-responses).

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

### Failure responses

A request that cannot be answered fails with a non-2xx status and a body of the
shape defined here.

This is not the same thing as an action that cannot be used. `disabled` and its
`reason` describe a Slip that was served successfully and currently offers
nothing to sign; a failure response says the exchange itself did not happen. The
body's discriminator is `"error"` for that reason, and this document says
*failure* throughout to keep the two apart in prose.

An endpoint MUST NOT report at `POST` a state it could have reported at `GET`.
Where the state genuinely changed between the two — the last seat was taken, a
deadline passed — the codes below carry it, and a client meeting one MUST
re-fetch discovery, so that the person is shown the same closed card everyone
else can now see rather than a failure private to them.

| Field | Required | Type | Rule |
|---|---|---|---|
| `type` | yes | string | MUST be `"error"`. Discriminates a failure from the shapes `GET` and `POST` return on success. |
| `version` | yes | string | The major version of this protocol the endpoint speaks, under the same rule as discovery. Present on the failure path so that a client which cannot read a response can still learn what it was. |
| `code` | yes | string | One of the codes in the table below. Names what a client does next, not what went wrong inside the endpoint. |
| `message` | yes | string | Plain text addressed to the person, 1–300 characters. MUST NOT contain markup; a client MUST render it as text. MUST NOT carry internal detail — no stack traces, no query text, no upstream URLs, no identifiers of the publisher's own systems. |
| `field` | no | string | The `name` of the parameter at fault, so a client can attach `message` to the field that caused it. Valid only alongside `code: "INVALID_PARAMETER"`. |

A client MUST reject a failure body carrying a member not defined above, for the
same reason it rejects one in discovery.

A failure response MUST set `Content-Type` to `application/json` and MUST set
`Access-Control-Allow-Origin: *`. A client executes on an origin the publisher
does not control, and without that header on the failure path the browser
withholds the body: every failure then reaches the person as an unexplained one,
including the failures they could have corrected themselves. A failure response
MUST NOT be cached, and SHOULD set `Cache-Control: no-store`.

**The taxonomy.** Every code belongs to one of three classes, and the class is
what a client acts on. The class is a property of the code, fixed by this
document, and is deliberately not a field: an endpoint able to declare its own
failure retryable is an endpoint able to keep a client asking.

| Code | Class | Status | Raised by | Rule |
|---|---|---|---|---|
| `INVALID_PARAMETER` | request | 400 | endpoint | A submitted value was rejected. `field` names it where a single parameter is at fault. |
| `WRONG_NETWORK` | request | 400 | endpoint, client | The Slip's `network` and the connected wallet's network do not agree. |
| `NOT_FOUND` | terminal | 404 | endpoint | Nothing at this URL describes a Slip. |
| `UNAVAILABLE` | terminal | 409 | endpoint | The action is closed for now, and may open again. |
| `EXPIRED` | terminal | 410 | endpoint | The Slip had a deadline and it has passed. This is permanent. |
| `MALFORMED_RESPONSE` | terminal | — | client | A response arrived that this protocol cannot read. |
| `UNSUPPORTED_VERSION` | terminal | — | client | The response is in a major version this client does not implement. |
| `RATE_LIMITED` | transient | 429 | endpoint | The endpoint is deliberately refusing for now. `Retry-After` SHOULD be set. |
| `UPSTREAM_FAILURE` | transient | 502 | endpoint | A service the endpoint depends on failed. |
| `INTERNAL_ERROR` | transient | 500 | endpoint | The endpoint failed and cannot say more than that. |
| `UNREACHABLE` | transient | — | client | No usable response: DNS, TLS, a timeout, or a cross-origin request the browser refused. |

An endpoint MUST send each code with the status paired with it above, and MUST
NOT send a code the table marks as raised only by a client. Those carry no
status because nothing usable was received: they name a failure of the exchange
itself, and they exist so that a client renders every failure through one
vocabulary rather than showing the publisher's words for one half of them and a
browser exception for the other. `WRONG_NETWORK` is raised by both, because the
same disagreement is observable at two points — by a client before it sends, and
by an endpoint reading `network` out of what arrived.

What each class obliges of a client:

- **request** — the person or the client can act. A client MUST return to the
  state the request was made from with `message` shown against `field` where one
  is given, and MUST NOT retry the identical request.
- **terminal** — this Slip will not produce a transaction, and repeating the
  request cannot change that. A client MUST stop and MUST render `message`.
- **transient** — the same request may succeed later. A client MAY retry, and
  before each attempt MUST wait at least the interval given by `Retry-After`, or
  at least one second where none is given. Successive intervals MUST increase,
  and the attempts MUST be bounded. `Retry-After` is only a SHOULD on the
  endpoint, so without a floor and a growing interval the polite path and the
  one that hammers a struggling publisher are the same code. Retrying is
  otherwise safe by construction: a `POST` returns a transaction and signs
  nothing, so no retry can duplicate an on-chain effect.

Two schemas govern this body, and they bind different parties. An endpoint
conforms to [`slip-error-response-endpoint.schema.json`](./schemas/slip-error-response-endpoint.schema.json),
which admits only the codes marked `endpoint` above. A client validates against
[`slip-error-response.schema.json`](./schemas/slip-error-response.schema.json),
which constrains `code` to the shape of a code and not to that list. A client
able to read only the codes it already knows would discard a publisher's
`message` over a value it could have rendered, and would report a condition this
document defines as an unreadable response.

A client MUST classify a failure by the first of these that applies:

1. A body that is not JSON, or that does not satisfy the client schema, is not a
   failure response at all. The client MUST classify by status alone — `429` and
   `5xx` as transient, every other status as terminal — and MUST NOT render any
   part of it. An unparsed body is as likely to be an intermediary's HTML error
   page as it is the publisher's words.
2. A body that satisfies the client schema but carries a `code` this document
   does not define is terminal, and the client MUST render its `message`. The
   other two classes each authorise the client to act again, by retrying or by
   resubmitting a corrected request, and neither is safe to do on a failure whose
   meaning is unknown. A disagreeing status MUST NOT override this: an
   uninterpretable code arriving with a status that says to try again is the one
   combination that could hold a client in a loop it cannot reason about.
3. Otherwise the client MUST classify by `code`, and MUST ignore a status that
   contradicts it.

A code this document does not define means a non-conforming endpoint, not a
newer one. A response from a later major version never reaches this rule,
because the version check precedes it — see [Protocol
versioning](#protocol-versioning).

Conditions arising after a transaction exists — derived effects contradicting
declared metadata, a refused signature, a rejected submission — are named where
those steps are specified. They are client conditions in this same vocabulary
and never travel over HTTP.

```json
{
  "type": "error",
  "version": "1",
  "code": "INVALID_PARAMETER",
  "message": "Amount must be between 1 and 500 USDM.",
  "field": "amount"
}
```

```json
{
  "type": "error",
  "version": "1",
  "code": "EXPIRED",
  "message": "This campaign closed on 12 August. Nothing can be signed from this link."
}
```

### Protocol versioning

`version` carries a major version and nothing else. Discovery responses, the
partial intents `POST` returns, and failure bodies all carry the same value, and
it is the only compatibility signal in this protocol: a client MUST NOT infer
what an endpoint supports from the presence or absence of any field.

There are no minor versions, because there is nothing left for one to describe.
A client MUST reject a response carrying an undefined member, so a field cannot
be added to a shape compatibly, and a change that cannot be ignored is not a
minor change. Every change to a shape is therefore a new major version, and the
number stays a single integer.

**One URL speaks one major version.** There is no negotiation. A client sends no
version, and an endpoint MUST NOT vary the response body by request header:
discovery is required to return the same bytes to every requester, and a
response that turns on a header is neither cacheable nor the same document a
link unfurler fetched. A publisher supporting two major versions publishes one
URL per version, exactly as it already publishes one URL per network.

**A client MUST read `version` before validating the rest of a response.** A
response in a later major version may satisfy this document's schema while
meaning something else, or fail it over a field that version defines; reporting
a malformed response in either case tells the person the wrong thing about a
working endpoint.

Where `version` is not a major version the client implements, the client MUST
fail with `UNSUPPORTED_VERSION`, MUST NOT render any part of the response as
something that can be acted on, and MUST NOT `POST`. Rendering the fields it
happens to recognise, from a response it has admitted it does not understand, is
precisely the gap between what is shown and what is signed that this protocol
exists to close.

<!--
Filled incrementally, one section per issue. Add subsections here rather than
new top-level headings — CIP-0001 fixes the H2 set.

  #16  slips.json domain mapping
  #17  POST request/response and the partial-intent format (Mode A)
  #19  mandatory client-side effects derivation and mismatch rules
  #20  security considerations

Those four insert above 'Failure responses' and 'Protocol versioning', which
are cross-cutting and read last.

The `//slip` authority registration and its versioned grammar belong here
too — see docs/DECISIONS/0007-action-authority.md. Shapes freeze at #21.

Two rules the ecosystem has already paid for (docs/ECOSYSTEM.md §1):

  - Quantities are integer base units, never decimals-adjusted, typed as
    strings. Display decimals travel separately and are never authoritative.
    Mishandled decimals on `amount` is the most repeated bug in the
    web+cardano family. Applies to #17 and to the mismatch rules in #19.
  - The authority follows CIP-158's shipped shape —
    `web+cardano://browse/v1?uri=...`: fixed authority token, /v1 path
    segment, query payload. Never a variable directly after `//`.
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

<!--
Written at #21, under one hard constraint: no criterion may require a wallet
to implement a URI authority. That criterion is what has held CIP-13 at
Proposed since 2020 and CIP-157 open since 2024 (docs/ECOSYSTEM.md §1). M1
runs on ordinary https:// links and CIP-30, so these criteria are met by
publishers, our own client and the reference integration. CIP-99 is the
template: reference server, real use case, wallet co-author.
-->

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
