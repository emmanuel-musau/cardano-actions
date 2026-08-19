# Requirements

Distilled from the design document. This file is the product source of truth for development; the CIP draft in `spec/` is the normative protocol text once written.

## 1. Problem

Every on-chain action on Cardano begins with leaving the current context: navigate to a dApp, connect a wallet, find the screen, fill a form, sign. Intent forms when a link is seen and dies before the dApp loads. There is no standard way to say "here is a specific thing to do on-chain, ready to sign" in a form that travels — X, WhatsApp, Telegram, SMS, a printed QR code.

## 2. What we build

Three deliberately separate things:

- **Action** — an HTTP endpoint hosted by the dApp. `GET` describes an intent (metadata); `POST` returns a **partial transaction** describing only the dApp's side.
- **Link** — a shareable URL pointing at an Action, optionally fronted by a human marketing URL via `actions.json`.
- **Client** — anything that renders the link and drives the wallet handoff. M1 client: the interstitial web page (desktop, CIP-30).

## 3. Protocol contract (v1)

### GET — discovery
Returns: `type`, `version`, `title`, `description`, `icon`, `label`, `network`, `links.actions[]` (each with `label`, `href`, optional `parameters[]` with `name/label/type/min/max/required`). Template placeholders like `{amount}` in `href`. Unavailable actions still respond with `disabled: true` and an `error.message` — they render greyed out, never fail after the user commits.

### actions.json — domain mapping
Served from the domain root, CORS-enabled: `rules[]` of `pathPattern` → `apiPath` with `*`/`**` wildcards. Lets `adalink.io/delegate/POOL1` resolve to the real endpoint while the shared link stays human.

### POST — build (Mode A, client-side balancing — the v1 default and only mode)
Request: `{ changeAddress, network }`. Response: `{ type: "partial", intent: { outputs, certificates, requiredSigners, validUntil }, message }`. The client balances locally with evolution-sdk against the user's own UTxOs. **The endpoint never sees the user's UTxO set.**

Mode B (server-side balancing, client ships UTxOs) is specified as reserved/declared-in-GET but **out of scope for M1** — servers must declare it, clients must warn.

### Sign and submit
Client ends with a complete unsigned tx: derive effects → show → CIP-30 `signTx` (returns a **witness set**) → assemble witnesses into the body → `submitTx`. Short validity intervals plus automatic rebuild-and-retry when UTxOs move between build and sign.

## 4. The effects engine — the security model

The server's metadata is a claim; the transaction is the truth. Before any signature request the client independently derives from the tx CBOR:

- net ADA delta for the user's addresses, and the exact fee
- net native-asset deltas per policy/asset
- certificates (delegate → pool, register/deregister + deposit), withdrawals
- mint/burn, validity interval (as wall-clock expiry)

Derived effects are compared against declared metadata. **Any contradiction hard-blocks signing** and shows the mismatch. This is why no gatekeeping registry is needed, and it is only possible because eUTxO transactions fully determine their own effects. The public **adversarial corpus** (transactions whose metadata lies) with a proven 100% block rate is the artefact that makes this claim credible.

## 5. Identity layer (CIP-0170)

Publishers issue KERI-backed attestations (via signify-ts) binding a domain to its action endpoints. Clients resolve and verify the attestation and display verified publisher identity beside the derived effects. Effects prove *what* happens; the attestation proves *who* is asking. Identity augments but never gates: unverified publishers are clearly marked, not blocked. Explicit go/no-go at end of Month 1 (issue #63); fallback is shipping the stablecoin action alone.

## 6. M1 scope (mainnet in 3 months)

**In:** spec + CIP draft; `core`; `server` with one adapter (Next.js); the `verifier` effects engine; the `flow` client SDK; hosted + self-hostable interstitial; CIP-0170 publisher attestation; AdaLink USDM/USDCx payment action live on mainnet; public adversarial corpus.

**Deferred (roadmap — do not build in M1):** mobile CIP-13 `//action` deep links; browser extension inline rendering; server-side balancing (Mode B); additional framework adapters; additional action types.

## 7. Reference integration — AdaLink

Stablecoin payment action: recipient, amount, USDM/USDCx choice; parameterised tip variant; human URLs (`/pay/HANDLE`) via actions.json. Declared metadata must exactly match derived effects. End-to-end on preprod first, then mainnet with transactions labelled with the registered message tag.

## 8. What shipping means (each one ticketed)

- Four packages published to npm under `@cardano-actions` with release notes and a fresh-install smoke test.
- Developer documentation: quickstart, `actions.json` and client integration guides, effects-model explainer, self-host walkthrough.
- Public adversarial corpus with a 100% block-rate report, plus a wallet compatibility matrix run on preprod.
- CIP PR to `cardano-foundation/CIPs` — submitted after mainnet, documenting a running implementation.
- Usage measured from external wallets only; transactions we generate ourselves are recorded and never counted.

## 9. Non-goals, stated plainly

No custody, no treasury validator, no relayer, no fee tank, no central registry. The blast radius of a bug is a failed transaction, never a drained wallet. Nothing we ship requires ongoing funding to keep running.
