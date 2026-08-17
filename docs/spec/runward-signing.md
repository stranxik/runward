# Signing a runward verdict: the specification, written before the code

**Status**: specification, dated 2026-08-17 · **Implements**: [ADR-0055](../adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md) layer 5 · **Blocks**: nothing yet — this document exists so layer 5 is built once, correctly.

Layer 5 says "opt-in signing under the **operator's** key", singular. The 2026-08-14 audit asked the
question that singular hides: *whose key, when there are five of them?* Retrofitting an answer after
the flag ships means either a breaking change or a permanent asymmetry between the team that signs
and the team that cannot. So the answer is written first, and the code follows it.

## The invariant this must not break

runward holds no key, no identity, and no trust root. It emits an unsigned Statement; whoever signs
does so with their own tooling, under their own OIDC or their own key material, outside runward's
process. Nothing below changes that: **runward never signs, never verifies a signature, and never
learns who signed.** What it must do is emit an artifact that N signatures can attach to without
anyone re-deriving anything, and refuse to pretend it verified what it did not.

## 1. The envelope: DSSE, N signatures over one payload

The signed form is a [DSSE](https://github.com/secure-systems-lab/dsse) envelope — the shape cosign
already produces and `runward verify` already tolerates (0.35.0):

```json
{
  "payloadType": "application/vnd.in-toto+json",
  "payload": "<base64 of the in-toto Statement>",
  "signatures": [
    { "keyid": "…", "sig": "…" },
    { "keyid": "…", "sig": "…" }
  ]
}
```

DSSE's `signatures` is an array **by design**: N signers, one payload, no re-encoding. That settles
the multi-maintainer question at the format level rather than in runward — which is the correct place
for it, because the number of humans who must agree is an organisational policy, not a property of a
verdict.

**The load-bearing consequence**: the PAE (Pre-Authentication Encoding) that each signer signs is
computed over the payload bytes. Two signers must therefore sign **the same bytes**, which is why the
Statement is byte-idempotent on an unchanged tree (and why the VSA, whose spec requires a clock,
needs `SOURCE_DATE_EPOCH` to be co-signable at all). A second signer never re-runs `check`; they sign
the artifact the first one signed.

## 2. What `--sign` will and will not do

When layer 5 ships, `check --attest --sign` **wraps** the Statement in a DSSE envelope with an empty
`signatures: []` array, and stops there. It shells out to nothing, holds no key, and calls no OIDC
provider. The operator's `cosign attest-blob` (or `sigstore-python`, or `openssl` for an offline key)
appends the signature.

Rejected, and why:

- **Shelling out to `cosign` from runward.** Convenient, and the ADR-0054 runtime crossing: the gate
  would spawn a process, need a binary on PATH, and inherit whatever ambient credentials the shell
  carries. A gate that can sign is a gate that can be made to sign.
- **Holding a key "for convenience".** The moment runward holds the key, the judge signs its own
  verdict and independence — the whole moat — is gone. Already refused in ADR-0055's alternatives;
  restated here because it is the shortcut every implementation will be tempted by.
- **A `--signers N` threshold enforced by runward.** How many signatures a verdict needs before it
  counts is the organisation's policy, and enforcing it would make runward a policy engine with a
  trust base it cannot anchor. The threshold belongs to the admission side (Kyverno, OPA, a branch
  rule), where the identities are known.

## 3. What `verify` will and will not say about signatures

Already true in 0.35.0, and frozen here so layer 5 cannot quietly widen it: `runward verify` decodes
the payload, re-derives the verdict, and reports

```json
"dsse": { "envelope": true, "signaturesPresent": 2, "signatureVerified": false }
```

`signatureVerified` is **always** `false`, and the human output says so in words with the gesture
that would check it (`cosign verify-blob-attestation`). runward anchors no trust root; a tool that
reported "2 signatures ✓" without being able to name whose keys those are would be asserting exactly
the kind of thing this project exists to refuse.

## 4. Who signed, and where that is recorded

Not in runward. A DSSE `keyid` is meaningful only against a keyring runward does not have, and a
"validated by" field inside a mission artifact would be re-signable by whoever writes the artifact —
declarative, worth nothing to an assessor, the floor [ADR-0002](../adr/ADR-0002-harden-the-strict-gate-against-vacuous-passing.md)
closed. Identity lives where identity lives: your OIDC provider, your Fulcio certificate, your
forge's review record. See [operator-role.md](../operator-role.md) ("When there are several of you")
for the pattern that works today with no new mechanism.

## 5. Acceptance criteria for layer 5

The flag ships only when all of these pass on the built binary:

1. **No key, proven structurally.** The transitive import closure of the signing path contains no
   crypto-signing module, no `child_process`, and no network module — the ADR-0054 boundary test,
   extended to cover it.
2. **Byte-idempotent payload.** Two runs on an unchanged tree produce the same `payload`, so a second
   signer signs the same PAE. Includes the VSA case under `SOURCE_DATE_EPOCH`.
3. **N signatures round-trip.** An envelope carrying two signatures verifies (payload decoded,
   verdict re-derived) and reports `signaturesPresent: 2`, `signatureVerified: false`. Already
   tested for one signature; extended to N.
4. **The unsigned path is unchanged.** `check --attest` without `--sign` emits the bare Statement,
   byte-identical to today — signing is opt-in, and its absence costs nothing.
5. **`no-overclaim` green**, with the "runward signs" and "runward verifies signatures" phrasings
   added to the forbidden list, in both languages.

## What this specification does not decide

It does not decide *whether* to build layer 5 — that stays gated on a real demand signal, like every
edge in [ADR-0039](../adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)'s posture. It decides
what layer 5 must look like **if** it is built, so the multi-maintainer question is answered before a
flag makes it expensive to answer.
