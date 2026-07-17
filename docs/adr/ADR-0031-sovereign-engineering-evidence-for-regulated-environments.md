# ADR-0031: sovereign engineering evidence for regulated environments — narrow the wedge, never claim compliance

**Date**: 2026-07-17
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — grounded in a four-agent investigation (runward-in-regulated fit, regulated-OSS adoption requirements, the FDE market, competitor posture), cross-read against the compliance guardrails (ADR-0015/0016) and the vendor-neutral / never-a-runtime invariants, challenged against the "become a compliance validator" temptation, durable position

## Context

"Can runward be used in a regulated environment?" is now a first-order question, because the market runward addresses — teams shipping and governing agentic systems, on the FDE method — increasingly overlaps regulated sectors (finance, health, public, defence), and because ~95% of enterprise GenAI pilots die at the *ship / govern / run* stage that runward exists to hold.

The investigation returned a clear, honest picture:

1. **runward is usable in regulated environments today — as a wedge, not as a validator.** It produces deterministic, non-LLM, replayable *engineering evidence* (decision → ADR → conformance manifest → OSCAL) that *feeds* an ISO/IEC 42001 programme, a NIST AI RMF profile, or the EU AI Act technical documentation (art. 11 / Annex IV). It never confers compliance. The self-imposed guardrails (audit-*ready* not audit-grade; *feeds/supports* not *satisfies*; security-only by default, regulation as an optional lens — ADR-0015/0016) are honest and defensible, and this ADR keeps them intact.

2. **Being local is a structural advantage, not a limitation.** runward runs in the operator's own repository, emits no data, hosts nothing, calls no network. That makes the bulk of vendor due-diligence (TPRM) *moot*: SOC 2 / ISO 27001 of a host, a DPA / GDPR art. 28 processor agreement, sovereign hosting, service pen-tests, vendor continuity — all evaluate a third party that *holds* the data. Here there is no third party in the data flow. The review collapses onto **artifact integrity** and **project health**, where runward is already strong (OIDC trusted publishing + SLSA provenance, OpenSSF Scorecard, network-isolated core tests, SHA-pinned CI, SECURITY.md, CODEOWNERS, MIT).

3. **Two kinds of gap.** *Reducible* (in our hands): no SBOM published; no one-page "no data flow" vendor sheet to short-circuit the SaaS questionnaire; the MIT-tool / CC BY-ND-doctrine split is not spelled out for a regulated buyer; the OSCAL ingest path is documented but never exercised. *Structural by design* (must be named, never hidden): no runtime record-keeping (EU AI Act art. 12 stays the operator's), evidence is point-in-time (rerun in CI), single maintainer, MIT "AS IS" with no SLA.

Closing the reducible gaps narrows the wedge — it does not turn runward into something it must not be.

## Decision

**runward positions itself as sovereign, deterministic engineering evidence for regulated adoption, and closes the reducible adoption frictions — while remaining, by design, a wedge that feeds a compliance programme rather than a validator that confers compliance.**

Concretely:

- **Supply-chain artifacts.** Every release publishes a CycloneDX **SBOM**, attested (SLSA build-provenance attestation for the SBOM) and attached to the GitHub Release, alongside the existing npm provenance. No separate cosign step: the npm `--provenance` attestation *is* a Sigstore signature, verifiable with `npm audit signatures`; adding cosign for the same tarball would be redundant ceremony.
- **A regulated-adoption reference** (`docs/compliance/regulated-adoption.md`): the "no data flow" vendor-assessment one-pager (what is moot because local, what actually applies), the OpenSSF **OSPS Baseline** alignment, the explicit **licence framing** (MIT tooling is freely reusable; CC BY-ND doctrine may be *used internally* — CC 4.0 permits private adaptation — but redistributed derivatives of the canon are not), and the named limits (no runtime logs, point-in-time, single-maintainer / no SLA, forkability as the bus-factor answer).
- **OSCAL credibility.** Keep the NIST-schema validation and byte-golden test in CI (already present); document the ingest procedure explicitly (`oscal-ingest.md`) and state plainly that end-to-end ingestion into a specific GRC tool remains the operator's verification, not a runward claim.
- **Guardrails unchanged.** Still never "compliant / certified"; still "audit-ready supporting evidence"; still security-only default with regulation as an optional versioned lens; still never a runtime.

## Alternatives discarded

- **Become a compliance validator** (assert conformity, emit "compliant"). Violates ADR-0015/0016 and the whole honesty posture; it is the exact overclaim the Delve affair punishes. Rejected.
- **Add cosign signing of the npm tarball.** Redundant with npm `--provenance` (Sigstore-backed). Effort with no new assurance. Rejected; the real missing artifact is the SBOM, not another signature.
- **Pursue an editor SOC 2 / ISO 27001.** Moot for a local, no-data-flow tool with no service to audit; it would signal a SaaS posture we deliberately do not have. Rejected — artifact integrity + forkability are the recognised OSS substitutes.
- **Ship a runtime logging layer to satisfy art. 12.** Turns runward into a runtime, breaking the founding invariant. Rejected — the operator supplies runtime logs; runward feeds the design-time file.

## Consequences

- **Positive.** A regulated buyer's objections are answerable with artifacts, not promises; the *local / sovereign / no-data-flow* stance becomes a named advantage neither a SaaS nor a runtime governance engine can match. The vendor sheet doubles as a go-to-market asset for FDE-style / integrator buyers. The wedge is narrower and, crucially, *honest*.
- **Negative, accepted.** Maintenance cost (SBOM + attestation in CI). The structural limits (runtime logs, point-in-time, single maintainer) remain and are now written down where a buyer will read them — a feature, not a leak.
- **On other boundaries.** Reinforces ADR-0015 (regional/regulatory as an optional lens), ADR-0016 (read-only, feeds not satisfies), ADR-0025 (OSCAL as a citable spec). No conflict; this ADR names the *regulated-adoption operating model* those imply, and adds only supply-chain artifacts + documentation.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) an OSCAL ingest into a named GRC tool is actually exercised and could be verified in CI — then the "operator-verifies" caveat can be tightened; (b) runward ever introduces a data flow, telemetry, or a hosted surface — then the entire SaaS due-diligence set reapplies and this ADR is void; or (c) a regulator recognises (or rejects) OSCAL component-definitions as design-time evidence in a way that changes the claim.

**Trigger set on**: 2026-07-17 · **Watched via**: FedRAMP OSCAL requirements, the EU AI Act technical-file guidance, and the OSPS Baseline revisions.

## References

- [ADR-0015](ADR-0015-regulatory-conformance-as-a-regional-profile.md), [ADR-0016](ADR-0016-runward-compliance-evidence-pack-assembler.md) — the compliance guardrails this preserves.
- [ADR-0025](ADR-0025-oscal-mapping-published-as-a-citable-spec.md) — the OSCAL mapping this documents an ingest path for.
- `docs/compliance/regulated-adoption.md` — the vendor sheet + OSPS alignment + licence framing this ADR introduces.
- The four-agent investigation (2026-07-17): regulated fit, regulated-OSS requirements, the FDE market, competitor posture.
