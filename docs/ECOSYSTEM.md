# Ecosystem

The Cardano standards this project sits among: what each one does, what we take from it, and what we leave alone. Surveyed 2026-08-20 against `cardano-foundation/CIPs`.

Read this before writing spec text or arguing that something doesn't exist. Most of what looks like a gap turns out to be something already built for a neighbouring purpose, and saying so first is cheaper than being corrected in public.

## 1. The `web+cardano:` family

CIP-13 defines the scheme; every extension registers an authority under it. CPS-16 is the coordination point.

| Authority | CIP | Status | What it does |
|---|---|---|---|
| *(none)* | CIP-13 | Proposed | Address plus optional lovelace amount |
| `//stake` | CIP-13 | Proposed | Pool delegation |
| `//claim` | CIP-99 | **Active** | Token claim: wallet POSTs to a project server, server pays out |
| `//transaction`, `//block` | CIP-107 | Proposed | Historical reference |
| `//addr` | CIP-134 | Proposed | Address reference |
| `//connect` | CIP-45 | Active | WebRTC peer pairing |
| `//browse` | CIP-158 | Proposed | Open a URL in the wallet's in-app browser |
| `//drep` | CIP-162 | Proposed | DRep delegation |
| `//pay` | CIP-157 | Draft, open since 2024-06 | Payment with native assets and metadata |
| `//action` | *ours* | Unclaimed | An arbitrary intent, built on demand by an endpoint |

Every one of these except ours fixes the transaction shape in the URI itself. Adding a new kind of action means writing a new CIP and persuading each wallet separately. That is the gap, and it is the whole argument.

**The registry is not authoritative.** CPS-16's list omits `//connect`, which CIP-45 has used since 2023. Grep the repo before claiming a name is free.

## 2. CIP-99 — the precedent that matters most

Status **Active**, the only CIP-13 extension to reach it, with five wallet implementors: VESPR, Yoroi, Lace, Begin, Eternl Mobile.

It is already a URI → wallet → HTTP POST to a third-party server → structured JSON response protocol. The wallet posts `{ address, code }` to a `faucet_url` carried in the URI. Ours posts `{ changeAddress, network }`. The shape is not novel and the ecosystem has already accepted it.

**What CIP-99 does not do is return a transaction the user signs.** Its server builds and submits the transaction itself and pays for it; the user receives tokens and never signs anything. That is the honest statement of what we add, and it is stronger than an argument from absence:

> Wallets will POST to a project's own server from a URI — CIP-99 is Active with five implementations. What no authority does is return a transaction for the user to authorise. Every existing one either fixes the shape in the URI or has the server sign.

**It is also the template for getting to Active.** CIP-99 shipped with an open-source reference server, a wallet vendor among its authors, and a concrete use case. CIP-157 has none of those and has sat open since June 2024. We have the reference server (`server` plus the AdaLink integration) and the use case. The missing ingredient is a wallet co-author.

## 3. CIP-186 — the mobile transport, and why it is not ours

Merged 2026-08-04 as Proposed. A CIP-30 transport over OS deep links: `connect`, `signTx`, `signData`, X25519 pairing, a BLAKE2b-256 commit over the canonical tx body, witness set returned via a universal-link callback. Eternl, Gero and Yuti have independently converged implementations.

**It cannot carry the interstitial, and we should not claim it does.** Its source-app identity binding is normative and assumes a native app: on iOS the wallet must find an `applinks` entry in the redirect host's `apple-app-site-association` and display the bundle ID, and on Android it must match `getCallingPackage()` against `assetlinks.json`. Failure is `errorCode=-13 SourceAppUnverified` before the signing screen renders. A web page has neither a bundle ID nor a package. Serving an AASA for an app we don't ship would forge the exact attestation the check exists to make.

**What it does confirm is our mobile path.** CIP-186's *In-process WebView dApps* clause states that a dApp inside a wallet's WebView "is NOT a deep-link dApp — it already has `window.cardano` injected per CIP-30 and MUST use that interface instead," and requires wallets to refuse the deep link there. Our `//browse` → wallet in-app browser → injected CIP-30 route is the path CIP-186 points at, not a workaround competing with it.

**What we take from it.** Three wallet teams reviewed these decisions for free:

| Take | Why |
|---|---|
| Commit binding: `BLAKE2b-256(canonical-cbor(tx_body))`, echoed in the response and re-checked by the client | Binds a returned witness set to the exact body we derived effects from. Matters most on rebuild-and-retry, where a body changes mid-flow |
| Witness merge is append, never replace, on `vkey_witnesses`; reject responses carrying non-vkey material we did not expect | Replace semantics silently drops co-signers; unexpected script material is injection |
| Strict base64url decode — reject padding and non-canonical tails | Permissive decoders admit malleability |
| Wallets return no UTxOs; addresses capped | Our Mode A privacy stance, already normative somewhere we can cite |

Its test vectors under `CIP-0186/tests/vectors/` cover Conway tx body extraction, commit computation and witness splicing — behaviours `verifier` and `flow` must get right whatever the transport. Reuse them as fixtures rather than deriving our own oracle.

**Do not overstate its maturity.** `Implementors:` is empty, the reference SDK it names is not published, and its acceptance criteria are unchecked. It is "merged, with three converging implementations" — not "shipping".

## 4. CIP-170 — identity

KERI-backed attestations, anchoring a digest of arbitrary data in an issuer's Key Event Log and referencing it in transaction metadata under label `170`. Cardano Foundation authors; Reeve and Veridian as implementors.

It defines no publisher payload and no domain→identifier discovery, and its own text calls watcher-network deployment immature. That is why identity ships in two tiers — see ADR-0006.

Its acceptance criteria are unchecked, and criterion 2 names "identity-bound actions" as a qualifying use. Being the implementation that satisfies it is worth raising with the authors directly.

## 5. CPS-10 — wallet connectors

The open problem statement CIP-186 answers: CIP-30 is a JavaScript injection contract over a shared browser window, which excludes non-web wallets and non-JS stacks. Relevant context for why the mobile story is shaped the way it is. We are not proposing a solution to it.

## 6. People

The URI space is small and the same names recur. Engage before submitting, not after.

- **rphair** — CIP editor, the ecosystem's most persistent URI advocate. Puts URI items on the biweekly editors' agenda (`hackmd.io/@cip-editors`).
- **Adam Dean (Crypto2099)** — author of CIP-13's extensions, CIP-99, CIP-157, CIP-158, and CPS-16. Asked publicly at Buidler Fest for help with QR codes carrying a whole contract.
- **Alex Dochioiu** — VESPR; co-author of CIP-99, and the one who de-prioritised CIP-157.
- **realdecimalist** — CIP-186.
- **marcuspuchalla** — Eternl; built the first CIP-186 implementation and reviewed the spec against it.

The CIP-13 wallet support tracker at `cip13.cardanothings.io` is useful but unmaintained since its author left Cardano in July 2026.
