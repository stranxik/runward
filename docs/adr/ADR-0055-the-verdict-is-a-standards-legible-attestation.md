# ADR-0055: the verdict is a standards-legible in-toto attestation

**Date**: 2026-08-14
**Status**: accepted (2026-08-14; layers 1 and 2 proven, record below)

## Context

The 2026-08-14 technical-roadmap investigation named the single highest-leverage move that stays on
the right side of the runtime boundary ([ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md)):
express runward's deterministic verdict as an **in-toto attestation**. Measured on the same day,
`src/` emits no in-toto or DSSE today (grep returned nothing) — greenfield.

Why it matters. Today the verdict is a stable exit code plus a `check --json` object
([ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md)) — legible to
an agent that already knows runward. The rest of the agentic supply chain (cosign, Kyverno,
`gh attestation verify`, sigstore, GRC ingestors) speaks in-toto/DSSE. A verdict that speaks that
language becomes a first-class piece of delivery evidence any of those tools consumes, without
runward adopting Rego, a policy-decision-point, a trust root, or a service. The four spec-driven
tools (spec-kit, OpenSpec, BMAD) gate on LLM prose judgment and structurally cannot emit a
deterministic, re-verifiable attestation of a delivery; runward can.

The trap, named first (the counter-expertise caught it). A *DSSE envelope* carries a signature, and
a signature needs a key. If `check --attest` literally emitted a DSSE envelope, it would either
force runward to hold a signing key — breaking the ADR-0054 crossing (3) and the ADR-0021 threat
model — or emit an invalid empty-signature envelope. So the base path emits the **unsigned in-toto
Statement**; the signed envelope is a separate, opt-in, operator-keyed step.

## Decision

Six layers, each declaring its side of the ADR-0054 line. All are file emission or offline reading;
none runs, holds a key, or reaches the network in the verdict path.

**1. `check --attest` emits an unsigned in-toto Statement.** A deterministic JSON Statement whose
`subject` is the sealed working-tree digest
([ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) semantics) and whose `predicate`, under
a stable `predicateType` (a versioned `runward-verdict` URI, expand/contract only, ADR-0011), wraps
what `check --json` already computes (verdict, gaps, evidence breakdown, corpus status, seal,
criticalScope, gateNonScope). It is the keystone every layer below builds on. Unsigned, byte-idempotent,
zero network, zero LLM — a pure emission of the verdict the gate already reached (ADR-0054, thesis-consistent).

**2. `runward verify <attestation>` re-checks it offline.** Given an emitted Statement and the repo,
it re-derives the verdict and confirms the subject digest still matches the tree — exit 0 on a
matching tree, non-zero on a drifted one, with a negative control in the spirit of `verify-release.yml`.
It never phones a trust root in the default path and never reads a second tree or a base ref
(ADR-0054 crossings (1) and (4) forbidden). This makes the attestation self-checking by anyone,
months later, on the repo alone — the survivability property, now portable.

**3. `check --through <phase> --attest` emits a phase-crossing attestation.** Each declared horizon
([ADR-0053](ADR-0053-the-construction-gate-certifies-a-declared-horizon.md)) accrues an attestation
of the certified prefix: the predicate records `horizon` and the `deferredPhases` list, and the loud
"this is NOT a completion verdict" caveat travels **inside** the predicate so no verifier can re-read
a prefix as a full arc. `--through` with `--freeze` stays refused (ADR-0053). "Accrues" means
re-derived on demand and committed by the operator — never accumulated by runward across invocations
(ADR-0054 crossing (2)). A delivery thus carries a verifiable promotion trail with no registry.

**4. `runward bundle` binds the existing artifacts into one attested manifest.** The four artifacts
runward already ships separately — the evidence-lock seal, the OSCAL component-definition and the
readiness pack from `runward compliance`, the CycloneDX SBOM from the release
([ADR-0048](ADR-0048-the-release-carries-verifiable-proof.md)) — are referenced by SHA-256 in one
in-toto-attested manifest, byte-idempotent, so a factory hands an assessor a single provenance
instead of a pile of files. Removing any referenced artifact reddens the bundle. Integration over
pieces that exist; no new evidence and no runtime.

**5. Opt-in `--sign` wraps the Statement in a DSSE envelope under the OPERATOR's key.** Signing is a
thin invocation of the operator's own cosign under the operator's ambient OIDC identity, run in the
operator's CI. **runward custodies no key and no configured identity**; Rekor transparency-log
inclusion is a strictly post-verdict operator choice, never in any default path; and the verdict is
byte-identical whether signing is configured or not — the local re-run stays ground truth. This is
the single strongest pull toward the ADR-0054 boundary, contained ONLY by the invariant that the key
is the operator's; it ships LAST and only with that invariant enforced as a blocking test.

**6. A reference Kyverno consumer, shipped as documentation.** runward ships a reference
`ImageValidatingPolicy` + cosign snippet requiring a passing signed `runward-verdict` attestation
before an image is admitted, fail-closed if absent. runward produces the attestation; the admission
controller is the **operator's** Kyverno, never a process runward runs (ADR-0054). This extends the
opposable verdict into the deploy gate without crossing the line.

## Alternatives considered

- **Emit a DSSE envelope from the base command.** Rejected in Context: a valid envelope needs a key,
  which breaks ADR-0054 (3) / ADR-0021. The base path is the unsigned Statement; signing is layer 5.
- **A bespoke OPA decision-log / Rego output as the interop surface.** An in-toto attestation is
  already standards-legible to policy engines (OPA can verify attestations), so a second format is
  redundant surface with no named OPA-shop demand. Deferred to the roadmap's "Later", gated on a real
  signal — the same discipline ADR-0039 applies to the satellite.
- **A hosted attestation store / verdict registry.** The obvious "enterprise" shape, and exactly the
  runtime ADR-0054 (1) and ADR-0024 forbid. Every attestation here is a committed file the operator's
  own store (if they want one) ingests; runward operates nothing.
- **Sign under a runward-held key for convenience.** Rejected: the moment runward holds the key, the
  judge signs its own verdict and independence — the whole moat — is gone. The key stays the
  operator's or there is no signing.

## Consequences

- **The verdict becomes ecosystem-interoperable.** cosign, Kyverno and `gh attestation verify` can
  consume it; a GRC pipeline can ingest it beside the OSCAL pack. runward stops being "a CLI that
  exits 0/1" and becomes the deterministic evidence layer those tools read — the roadmap's central
  differentiator, delivered as files.
- **New surface, bounded.** `check --attest`, `runward verify`, `runward bundle`, and `--sign` are
  new commands/flags; each is additive, each declares its ADR-0054 side, and the two boundary-touching
  ones (verify's no-trust-root default, sign's operator-key) carry blocking invariant tests.
- **The construction gate gains an audit trail.** Phase-crossing attestations turn `--through` from a
  transient CI banner into committed, verifiable promotion evidence.
- **Cost, stated.** Roughly: predicate + `--attest` 5-7 days; `verify` + PR Action 4-6; phase-crossing
  3-5; bundle 4-6; opt-in signing 3-5 (last, guardrailed); Kyverno reference 1-2. Realistic for one
  maintainer + an agent, shipped in waves, each layer resting on layer 1.

## What this does not claim

- It does not make the verdict *more true*: `GATE_NON_SCOPE` is unchanged. An attestation certifies
  that the deterministic verdict — presence, pointers, integrity, shape — was reached on that tree,
  never that the code implements the rule. Wrapping the same verdict in a standard format does not
  upgrade what the verdict means ([ADR-0056](ADR-0056-the-evidence-layer-widens.md) widens the
  evidence; it too stays inside the non-scope).
- It does not make runward a signer, a store, or a service: it emits files; the operator's own
  cosign, Rekor, Kyverno and stores do the running.
- It does not adopt Rego, a policy-decision-point, or a trust root.
- It crosses no phase: cited by no manifest (ADR-0045 decision 4).
  `node dist/cli.js check --strict` reads exit 0 before this file and must read exit 0 after.

## Ratification

Accepted layer by layer; each layer's proof passes on the built binary, and the ADR is accepted
when at least the keystone (layer 1) and its verifier (layer 2) are proven, with the remaining
layers tracked on the roadmap:

1. **The Statement.** `check --attest` emits a JSON in-toto Statement whose `predicateType` is a
   stable versioned URI, whose `subject` digest equals the sealed tree digest, byte-identical across
   two runs; a CI step (mirroring the `oscal-ingest` job) schema-validates the envelope against the
   in-toto spec, and it carries no signature field. Test: `verdict-attestation.test.js`.
2. **Offline verify.** `runward verify` exits 0 on a matching tree, non-zero on a drifted one, opens
   no socket and reads no second tree (a boundary test citing ADR-0054); negative control included.
3. **Boundary invariants (layer 5, before signing ships).** A blocking test proves `check --attest`
   is green and byte-identical with NO signing configured, and that the sign step runs only under the
   operator's OIDC with runward holding no key.
4. **Global invariant.** `check --strict` exits 0 before and after; `no-overclaim` green; the verdict
   is byte-identical whether an attestation is emitted or not (emission never feeds back into the
   verdict path, ADR-0054 (5)).

**Ratification record (2026-08-14).** Layers 1 and 2 pass on the built binary; the ADR is accepted on
that basis. Layer 1 (`check --attest`) landed in Wave A (on main, ships in the next release): a valid,
unsigned in-toto Statement v1, byte-idempotent across two runs, subject = the mission-state digest, no
signature field — validated in real conditions against the in-toto Statement v1 contract on runward's
own mission, and byte-idempotent there (`verdict-attestation.test.js`). Layer 2 (`runward verify`)
re-derives the digest and the verdict from the current tree, exit 0 on a match; the two negative
controls fail as required — a drifted tree (subject digest differs) and a tampered predicate (the
verdict re-derives to a different value) both exit 1, a non-attestation exits 2 — with no network, no
trust root, no second tree read (`verify-attestation.test.js`). Emitting or verifying an attestation
never changes `check --strict`'s exit code, and both reference missions stay strict-green.

**Amendment (2026-08-14, from the full-repo audit).** Three corrections to this record, each in the
direction of the proof, none of them a new capability:

- **The subject is the mission-state digest — stated, no longer silent.** Decision 1 and criterion 1
  wrote `subject` = "the sealed working-tree digest (ADR-0021 semantics)". What shipped binds the
  subject to `missionStateDigest` (the mission tree ∪ the cited evidence files,
  `src/lib/attestation.ts`) — deliberately: an attestation must be able to bind a tree BEFORE any
  seal exists (sealing is a later, optional operator gesture, and making attestation depend on it
  would invert their relationship), and the digest must cover the cited evidence OUTSIDE `runward/`
  that the verdict actually read, which the evidence-lock alone does not. The substitution was
  correct and undeclared; the audit named the silence, and this amendment ends it. From this date
  the words "sealed tree digest" in decision 1 and criterion 1 read as "mission-state digest".
- **Layers 3 and 4 are delivered, not roadmap.** Layer 3 (phase-crossing: `check --through --attest`
  records the declared horizon in the predicate; `verify` re-derives horizon-aware) and layer 4
  (`runward bundle`, verified by raw SHA-256 re-hash) are on the built binary with their tests
  (`test/unit/verify-attestation.test.js`, `test/unit/bundle.test.js`). Only layer 5 (opt-in
  signing under the operator's key) and layer 6 (the Kyverno reference doc) remain on the roadmap —
  and before layer 5 is built, "the operator's key" must be defined for N maintainers
  (multi-signature DSSE is the compatible path; the audit's multi-maintainer finding).
- **The criterion-1 CI step exists.** `test/intoto-schema.js` validates the `check --attest` and
  `bundle` envelopes against the VENDORED in-toto Statement v1 schema
  (`test/fixtures/intoto_statement_schema.v1.json`, mirroring the `oscal-schema` discipline), wired
  in `npm test` and inside CI's network-cut block (`.github/workflows/ci.yml`) — the envelope
  contract is proven offline. The `runward verify` cross-version guard added the same day
  (`producedBy`/`versionSkew`, `test/unit/verify-version-skew.test.js`) keeps a re-derivation
  failure under version skew distinguishable from tampering.

## References

- [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) — the line every layer here declares its side of
- [ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md) — the `check --json` payload the predicate wraps, additive-only
- [ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) — the sealing semantics the subject was first written against (see the 2026-08-14 amendment: the shipped subject is the mission-state digest); the no-key threat model
- [ADR-0053](ADR-0053-the-construction-gate-certifies-a-declared-horizon.md) — the declared horizon the phase-crossing attestation records
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) — the predicateType is a versioned port (expand/contract), no identity broker
- [ADR-0048](ADR-0048-the-release-carries-verifiable-proof.md) — the SBOM/provenance the bundle binds
- [ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md) — no registry; the attestation is a file, not a served endpoint
- [ADR-0056](ADR-0056-the-evidence-layer-widens.md) — the sibling decision widening what the verdict attests to
