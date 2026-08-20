# Example corpus

Canonical payloads for the shapes defined in [`../CIP-XXXX/README.md`](../CIP-XXXX/README.md).
They are part of the specification, not test scaffolding: an independent
implementation can run this corpus and find out whether it conforms without
reading a line of our code.

```
get/
├── valid/            MUST be accepted
└── invalid/
    ├── schema/       MUST be rejected by the JSON Schema alone
    └── rule/         schema-valid, and MUST still be rejected
```

## `invalid/rule` — the checks a validator cannot make

Four normative rules compare values a JSON Schema cannot see at once, or need
the request URL. A client that validates and stops is not conforming; these are
the payloads that prove it.

| Payload | Rejected because |
|---|---|
| `cross-origin-href.json` | `href` resolves to an origin other than the discovery URL's. Requires the request URL, which the schema never has. |
| `bounds-reversed.json` | `max` is less than `min`. Compares two sibling values. |
| `undeclared-placeholder.json` | `href` contains `{amount}` with no parameter named `amount`. |
| `unfilled-placeholder-parameter.json` | A parameter is declared that no placeholder references, so its value would reach nothing. |

## Keeping it honest

`test/spec-get-discovery.test.ts` asserts that every file here is accounted for:
each `valid/` payload validates, each `invalid/schema/` payload is rejected by
the keyword and at the location its case names, and each `invalid/rule/` payload
**passes** validation — which is what makes it evidence that the rule has to
live somewhere else. Adding a file without recording what it demonstrates fails
the suite.

Every JSON example printed in the CIP is one of these files. The specification
and the corpus cannot disagree, because the text is drawn from the corpus.
