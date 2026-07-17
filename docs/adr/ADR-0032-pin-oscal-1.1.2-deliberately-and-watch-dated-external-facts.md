# ADR-0032: pin OSCAL 1.1.2 deliberately, and watch dated external facts out-of-band

**Date**: 2026-07-17
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — grounded in a two-agent investigation (EU/global compliance landscape vs OSCAL; OSCAL versioning + dated-fact surveillance), which surfaced that runward had silently fallen two OSCAL generations behind with no test reddening; cross-read against the zero-network determinism invariant (ADR-0001) and the versioned-port rule (ADR-0011, ADR-0022)

## Context

runward pins facts that live **outside** the repository and move on their own clock:

1. **The OSCAL schema version.** runward emits an OSCAL component-definition pinned to **1.1.2** (`src/lib/compliance.ts` `OSCAL_VERSION`, the vendored schema, the golden, `test/oscal-ingest.py`). Since that pin, NIST shipped 1.1.3 (Nov 2025), **1.2.0** (Dec 2025, adds the Control Mapping model), 1.2.1 (Mar 2026) and **1.2.2** (Apr 2026). runward is two generations behind — **and no test reddened**, because every guard compares *repo to doc*, never *repo to world*. A drift guard checks that the string "1.1.2" is *present*, not that it is still *current*.

2. **Dated regulatory facts.** The regime lenses carry dates that expire independently of the repo: the EU AI Act 2 December 2027 high-risk date, the 2 August 2026 Article 50 / GPAI milestone, FedRAMP OSCAL expectations. `regimes/*.json` froze them with no re-check date.

The investigation also confirmed the strategic frame: there is **no European (or other) machine format** to migrate to — EUCS/SecNumCloud are cloud-service certifications that do not target a local tool, the EU AI Act technical documentation (Annex IV) has no executable format, and OSCAL is the only mature machine format, with growing non-US uptake (ECSO OSCAL Task Force, CRA). So the question is not *which format* but *how to keep the OSCAL pin and the dated wording honest over time*.

## Decision

**1. Stay pinned to OSCAL 1.1.2 — deliberately, not by omission.**
The 1.1.x releases are backward-compatible patches; 1.2.0 is an additive minor (a new model) that does not invalidate an existing component-definition; the `oscal-version` field is a free string with no enum, so a 1.1.2 pack stays valid and ingestible (proven every CI run by compliance-trestle). There is therefore **no correctness or ingestion reason to bump now**. Bumping is a *versioned-port* decision (ADR-0011, ADR-0022): it re-vendors the schema, regenerates the golden, and re-checks the trestle proof — a traced human act, never automatic. The only real cost of staying is optics (being "the OSCAL reference one cites" while trailing NIST), which this ADR neutralises by making the pin a *recorded choice* rather than a silent lag.

**2. Watch dated external facts out-of-band, never in the gate.**
A new **scheduled, non-blocking** workflow (`.github/workflows/watch-external-facts.yml`) runs weekly, **outside** the deterministic gate, with network:
- it compares `OSCAL_VERSION` against the latest `usnistgov/OSCAL` release, and
- it compares each `regimes/*.json` `reviewBy` date against today,
and on any drift it **opens or refreshes a single tracking issue**. It never bumps a pin and never fails a build. Each regime file gains an optional `reviewBy` (EU AI Act → `2026-08-02`, right after the Article 50 milestone; the others → an annual `2027-01-01` checkpoint).

## Alternatives discarded

- **A clock-driven test in the gate** (redden after a date, or fetch the latest version and assert). Rejected: it puts wall-clock and network into the deterministic, zero-network critical path (ADR-0001) — the golden pins `RUNWARD_NOW` precisely to forbid this. A test that reddens on a Tuesday with no code change is exactly the non-determinism runward exists to ban.
- **Auto-bump OSCAL via Dependabot.** Rejected: the vendored NIST schema is a copied JSON file, outside the dependency tree, and the pin is a decision (a pack must stay re-assemblable against the exact version its auditor saw). Dependabot cannot make that judgement.
- **Bump to 1.2.2 now.** Rejected for this ADR (no correctness/ingestion gain today), but the watch issue keeps the option live and visible; a future ADR can flip it.
- **Add/adopt an EU machine format.** Rejected: none exists as an adopted standard; inventing one is the opposite of the audit-ready promise. Keep OSCAL + the regime lenses (`regimes/*.json`).

## Consequences

- **Positive.** A pinned external fact can no longer fall behind unnoticed: the gap becomes an issue a human triages, while the gate stays deterministic and offline. The OSCAL lag is now a written choice, defensible to a buyer, not an oversight. One surface (the tracking issue) materialises every stale external fact — OSCAL and legal dates alike.
- **Negative, accepted.** A weekly scheduled job to maintain; the tracking issue needs human triage (by design — bumping is a decision). `reviewBy` is metadata on shipped regime files, but it never enters the OSCAL and does not alter the lens content, so it does not violate the "never edit a shipped mapping" rule (ADR-0022): it records *when to re-check*, not *what the mapping says*.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) NIST publishes an OSCAL release that is **not** backward-compatible for component-definitions, making the 1.1.2 pack un-ingestible — then bumping stops being optional; (b) the EU (via the ECSO OSCAL Task Force / a CRA or AI Act profile) publishes a recognised machine format for AI evidence — then re-evaluate supporting it; or (c) the watch workflow proves too noisy or too silent (false issues, or a known drift it missed).

**Trigger set on**: 2026-07-17 · **Watched via**: the `watch external facts` workflow itself, `usnistgov/OSCAL` releases, and the ECSO OSCAL Task Force.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the zero-LLM / zero-network gate this keeps determinism-safe.
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md), [ADR-0022](ADR-0022-regime-mappings-as-versioned-data.md) — the versioned-port / versioned-data rules a bump must follow.
- [ADR-0025](ADR-0025-oscal-mapping-published-as-a-citable-spec.md), [ADR-0031](ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md) — the OSCAL-as-citable-spec and regulated-adoption posture this protects.
- The two-agent investigation (2026-07-17): EU/global landscape vs OSCAL; OSCAL versioning + dated-fact surveillance.
