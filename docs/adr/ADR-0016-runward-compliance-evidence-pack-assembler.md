# ADR-0016: `runward compliance <regime>` — a deterministic evidence-pack assembler, upstream of the auditor

**Date**: 2026-07-10
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — two 2026 investigations (per-regime evidence-pack anatomy for ISO/IEC 42001, NIST AI RMF, EU AI Act Annex IV, SOC 2; and the compliance-tooling landscape / OSCAL). Decided against the never-a-runtime, zero-LLM-tool and anti-overclaim invariants. Decision only; no code in this ADR.

## Context

ADR-0015 made regulatory conformance a regional framing layer — reference docs under `docs/compliance/`. Honest assessment: those docs are **inert**. They explain how the manifest *could* map to a regime, but they produce nothing for the operator, who never even sees them from `npx runward init`. The framing is a half-step; it does not make the compliance angle useful.

Two investigations sharpened what a *useful* hook could be, and where the honest line is:

- **The quadrant is open.** The market has two evidence models, and **neither derives evidence from a human-ratified engineering decision journal**. Vanta/Drata/Secureframe scrape live system state (continuous monitoring, integrations, auditor portals); Credo AI/AnnexOps/watsonx LLM-draft from asset metadata and questionnaires, then human-review. Both treat design decisions as questionnaire *inputs*, never as the attested artifact. The one genuinely deterministic, vendor-neutral, CLI neighbour — **OSCAL** and `compliance-trestle` — is a security-control *interchange format*, not derived from an ADR journal and not agentic-security-specific.
- **The honest boundary is identical across all four regimes.** runward can populate the **technical-evidence layer and its cross-referenced index**; it can never produce the **applicability decisions, risk-acceptance, policy/management sign-off, the EU declaration of conformity, post-market/monitoring plans, or the assessor's/CPA's opinion**. No regime permits self-declaring "compliant/certified" from engineering artifacts. The manifest maps almost cleanly onto ISO 42001's SoA implementation-status + evidence columns; the ADR journal is a near-verbatim fit for EU AI Act Annex IV Point 2 (design choices, alternatives, assumptions, pre-determined changes) and NIST's MEASURE/TEVV documentation; the threat model and eval rubric populate the risk and validation sections.

The trap: this is a strong temptation to LLM-draft a "compliance report" or scrape live state — which would break the invariants and destroy the very thing that is distinctive.

## Decision

Build **`runward compliance <regime>`** — a **deterministic, read-only, zero-LLM** command, **outside the gate**, that reads the mission's real artifacts and assembles a **regime-framed evidence pack marked as an assessment-readiness draft**, explicitly flagging what only the operator/organization can supply, and emits an **OSCAL-compatible** artifact so the evidence flows into the platforms and auditor workflows runward will never own. It is a **provenance layer, upstream of the auditor** — never a compliance oracle.

- **Reads (at rest):** the conformance manifest (craft rules → OWASP ASI coverage, per-rule `applied+pointer` / `deviated+ADR` / `n-a+reason`), the ADR journal, the threat model, the evaluation rubric. It parses artifacts; it runs, installs and scrapes nothing.
- **Assembles, per regime**, only what runward can honestly populate:
  - **ISO/IEC 42001** — the SoA implementation-status + evidence-pointer columns; risk/threat and design-decision records.
  - **NIST AI RMF** — the MEASURE/TEVV documentation answers and an **ASI ↔ subcategory crosswalk in NIST's own table shape**.
  - **EU AI Act** — Annex IV Point 2 (architecture, datasheets, validation/metrics/logs, cybersecurity) and the design-rationale/change history (Points 2 & 6) from the ADR journal.
  - **SOC 2** (later) — a control-matrix skeleton with criteria/ASI mapping and evidence pointers.
  The per-regime mapping tables are the `docs/compliance/*` references (ADR-0015), now made operational.
- **Flags the human gaps explicitly** — the same forcing mechanic as the retro-doc ratification loop: every section runward cannot fill is listed as **"REQUIRED — operator/organization to supply"** (applicability, risk acceptance, management review, declaration of conformity, post-market plan, the assessor's opinion). The output cannot masquerade as complete.
- **Emits OSCAL-compatible output** for the control-status / crosswalk layer (the machine-readable interop), with the ADR-journal and threat-model provenance referenced. This is the standards-based move: don't reinvent a format, feed the one the ecosystem already ingests.
- **Honest label, always:** the output is an **"assessment-readiness draft — incomplete pending organizational input and independent assessment."** Never "compliant", "certified", "conformant", or "a compliance report."

The invariants that keep it honest and distinctive:

- **Deterministic, no model call.** runward *assembles from ratified artifacts*; it does not LLM-draft. That is the competitors' model and the exact opposite of the wedge — the value is evidence **traceable to a versioned, human-ratified decision**, not to a scrape or an LLM guess.
- **Out of the gate.** Like `check --coverage`, it is a report; it never changes an exit code. Compliance readiness is inherently incomplete (it needs org input) — gating on it would be a false verdict.
- **Never a runtime, vendor-neutral.** No live-state scraping, no integrations, no platform. It emits OSCAL so it can flow *into* Vanta/Drata/GRC/auditor workflows rather than compete with them.
- **Security-only default stands (ADR-0015);** naming a regime is opt-in via the `<regime>` argument.

## Alternatives discarded

- **LLM-draft the evidence** (the Credo/AnnexOps model). Breaks the zero-LLM-tool invariant and destroys the provenance wedge — a draft awaiting legal review is what everyone already ships. Rejected.
- **Scrape live system state** (the Vanta/Drata model). Requires becoming a runtime/integration platform; a different evidence class; violates never-a-runtime. Rejected — be the complementary upstream layer and emit OSCAL.
- **Generate a "compliance report" that asserts conformance.** Overclaim; no regime allows self-declaration from engineering artifacts. Rejected — readiness draft with explicit gaps.
- **Put compliance in the gate** (fail `check` on an incomplete pack). It is inherently incomplete by construction; gating would assert a falsehood. Rejected — advisory, outside the gate.
- **Leave `docs/compliance/` as inert reference** (status quo). Forfeits an open, doctrine-consistent wedge and leaves the angle useless. Rejected — that is the problem this ADR fixes.

## Consequences

- **Positive.** Turns the operator's *existing* conformance work into a hand-ready, regime-shaped, interoperable deliverable; occupies a quadrant no competitor holds; honest by construction (fills what it can, names what it cannot); OSCAL emission lets it flow into the ecosystem; the provenance model — evidence tied to ratified engineering decisions — is the defensible moat.
- **Negative, accepted.** Point-in-time by construction (drifts as code moves — re-run in CI, which the existing adapters already support). Necessary-but-not-sufficient: it does not provide the *operational/live* proof auditors also want, nor auditor relationships. The regime mappings need maintenance as regulations move (they carry dated "verify current text" caveats; primary-source counts/templates flagged unverified). The OSCAL mapping is partial (control/crosswalk layer, not the full ADR provenance). More surface to maintain.
- **On other boundaries.** A new `runward compliance` command; new `runward/compliance/<regime>-readiness.md` (+ an OSCAL `.json`) output artifacts; the `docs/compliance/*` references become the mapping source; the deterministic gate, the conformance manifest, and the OWASP ASI mapping are unchanged; no model call anywhere.

## Reevaluation trigger (mandatory, dated)

Reopen if assessors reject the readiness draft in practice (they need operational proof the pack cannot give) or the OSCAL emission proves insufficient for real ingestion. The response must **never** be to LLM-draft or to scrape live state — those break the invariants and the wedge. Instead deepen the OSCAL fidelity, strengthen the CI-rerun (freshness) story, or sharpen the explicit human-gap list. Also revisit the mapping tables whenever a cited regime changes materially.

**Trigger set on**: 2026-07-10 · **Watched via**: buyer/auditor feedback on the readiness draft and OSCAL ingestion, and the AI-governance veille.

## References

- [ADR-0015](ADR-0015-regulatory-conformance-as-a-regional-profile.md) — the regional profile and the `docs/compliance/*` references this command makes operational.
- [ADR-0009](ADR-0009-owasp-agentic-top-10-as-the-gate-risk-grammar.md) — the OWASP ASI mapping the pack is assembled from.
- [ADR-0013](ADR-0013-retro-documentation-as-transmission-pointed-backward.md) / [ADR-0014](ADR-0014-the-characterize-command-contract.md) — the ADR journal (incl. retro-reconstructed) that feeds the design-rationale sections.
- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the deterministic gate this command stays outside of.
- `docs/compliance/` — the per-regime mapping references (ISO 42001, NIST AI RMF, EU AI Act).
- OSCAL (NIST) and `compliance-trestle` — the vendor-neutral, machine-readable interop target.
