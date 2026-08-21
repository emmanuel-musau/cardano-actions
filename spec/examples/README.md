# Example corpus

Canonical payloads for the shapes defined in [`../CIP-XXXX/README.md`](../CIP-XXXX/README.md).
They are part of the specification, not test scaffolding: an independent
implementation can run this corpus and find out whether it conforms without
reading a line of our code.

One directory per shape, named for the `type` the payload declares, and the same
three buckets inside each:

```
get/                   type: "slip"    — discovery metadata
error/                 type: "error"   — a request that failed
└── valid/             MUST be accepted
    invalid/
    ├── schema/        MUST be rejected by the JSON Schema alone
    └── rule/          schema-valid, and MUST still be rejected
```

`error/` is validated by two schemas rather than one. An endpoint conforms to
`slip-error-response-endpoint.schema.json`, where `code` is closed to the eight
values version 1 lets an endpoint send; a client validates against
`slip-error-response.schema.json`, where `code` is constrained only to the shape
of a code. `invalid/schema/` means *rejected by the endpoint schema* — what a
publisher is held to. Two of those payloads are still readable by a client, and
that difference is the point: see below.

## `invalid/rule` — the checks a validator cannot make

Six normative rules compare values a JSON Schema cannot see at once, need the
request URL, or judge what a string says rather than what shape it is. A client
that validates and stops is not conforming; these are the payloads that prove
it.

| Payload | Rejected because |
|---|---|
| `get/cross-origin-href.json` | `href` resolves to an origin other than the discovery URL's. Requires the request URL, which the schema never has. |
| `get/bounds-reversed.json` | `max` is less than `min`. Compares two sibling values. |
| `get/undeclared-placeholder.json` | `href` contains `{amount}` with no parameter named `amount`. |
| `get/unfilled-placeholder-parameter.json` | A parameter is declared that no placeholder references, so its value would reach nothing. |
| `error/markup-in-message.json` | `message` carries markup, which a client renders as text — so the person reads the tags. |
| `error/internal-detail-in-message.json` | `message` names an internal host and path. Well-formed, well under the length limit, and still not something to show anyone. |

The last two are the reason `message` cannot be an exception's `.message`
piped to the wire: both would pass every check a schema can make.

## `error/` — the codes, and the two payloads that prove the split

The failure taxonomy is a closed set for an endpoint, and each of its eight
endpoint-raised codes has a payload in `valid/`. Three codes are raised only by
a client — `MALFORMED_RESPONSE`, `UNSUPPORTED_VERSION`, `UNREACHABLE` — and have
none on purpose: they name a failure of the exchange itself, so there is no body
they could arrive in. `WRONG_NETWORK` is raised by both and is sendable, so it
has one.

Two payloads under `invalid/schema/` are rejected by the endpoint schema and
**accepted** by the client schema, which is the only reason the two schemas
exist:

| Payload | Why it splits |
|---|---|
| `client-code-on-the-wire.json` | Sends `UNREACHABLE`, a condition only a client can observe. An endpoint may not claim it — but a client that met it anyway would still read the body and treat it as terminal, rather than reporting an unreadable response. |
| `unknown-code.json` | Invents `INSUFFICIENT_FUNDS`, the tempting one: it reads like a payment error an endpoint would raise, and an endpoint cannot possibly know it — the client balances against its own unspent outputs and the endpoint never sees them. Non-conforming, and still readable, so the publisher's `message` survives. |

Every other payload in that directory is structurally broken, and a client
rejects it too: those are not failure responses at all, and the client falls
back to classifying by HTTP status.

## Keeping it honest

`test/spec-get-discovery.test.ts` and `test/spec-error-taxonomy.test.ts` assert
that every file here is accounted for: each `valid/` payload validates, each
`invalid/schema/` payload is rejected by the keyword and at the location its
case names, and each `invalid/rule/` payload **passes** validation — which is
what makes it evidence that the rule has to live somewhere else. Every
`error/invalid/schema/` case also records whether a client can still read it,
and the suite fails if that column ever collapses to one value. Adding a file
without recording what it demonstrates fails the suite.

Every JSON example printed in the CIP is one of these files, matched to its
directory by the `type` it declares. The specification and the corpus cannot
disagree, because the text is drawn from the corpus.
