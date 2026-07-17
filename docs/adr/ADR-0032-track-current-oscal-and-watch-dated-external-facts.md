# ADR-0032: track the current OSCAL release, and watch dated external facts out-of-band

**Date**: 2026-07-17
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — a two-agent investigation (EU/global compliance landscape vs OSCAL; OSCAL versioning + dated-fact surveillance) surfaced that runward had silently fallen two OSCAL generations behind with no test reddening; a follow-up investigation the maintainer explicitly requested then *proved* the bump trivial (schema validation + real trestle ingestion), which flipped the initial "stay pinned" instinct. Cross-read against the zero-network determinism invariant (ADR-0001) and the versioned-port rule (ADR-0011, ADR-0022).

## Context

runward pins facts that live **outside** the repository and move on their own clock:

1. **The OSCAL schema version.** runward emitted an OSCAL component-definition pinned to **1.1.2** (Dec 2024). Since that pin, NIST shipped 1.1.3 (Nov 2025), 1.2.0 (Dec 2025, adds the Control Mapping model), 1.2.1 (Mar 2026) and **1.2.2** (Apr 2026). runward was two generations behind — **and no test reddened**, because every guard compares *repo to doc*, never *repo to world*. A drift guard checks that the string "1.1.2" is *present*, not that it is still *current*.

2. **Dated regulatory facts.** The regime lenses carry dates that expire independently of the repo: the EU AI Act 2 December 2027 high-risk date, the 2 August 2026 Article 50 / GPAI milestone, FedRAMP OSCAL expectations. `regimes/*.json` froze them with no re-check date.

The strategic frame (same investigation): there is **no European (or other) machine format** to migrate to — EUCS/SecNumCloud are cloud-service certifications that do not target a local tool, the EU AI Act technical documentation (Annex IV) has no executable format, and OSCAL is the only mature machine format, with growing non-US uptake (ECSO OSCAL Task Force, CRA). So the question is not *which format* but *how to keep the OSCAL pin and the dated wording honest, and current, over time*.

**The initial instinct was to pin at 1.1.2 deliberately** and justify the lag. The maintainer instead asked to look closer before deciding. That follow-up produced decisive evidence:

- runward's exact OSCAL output **validates against the NIST 1.2.2 component-definition schema** (verified with runward's own ajv harness), whether the declared `oscal-version` reads 1.1.2 or 1.2.2 — the model is unchanged.
- **IBM compliance-trestle 4.2.0** (the CI ingester) **loads a 1.2.2-stamped pack** without error (verified locally), despite nominally targeting 1.2.1 — `oscal-version` is a free string with no enum.
- Schema diff 1.1.2 → 1.2.2: **zero definitions removed**, root component-definition properties **identical**; the additions (markup datatypes, control-selection, the orthogonal Control Mapping model) touch nothing runward emits. NIST's versioning policy declares 1.2.x backward-compatible for component-definition.
- `oscal-version` does **not** feed the deterministic UUID seeds, so regenerating the golden is a **single-line** change (UUIDs stable).

The lag was therefore not protecting anything — it was a near-free gap with only a downside (optics: being "the OSCAL reference one cites" while trailing NIST by 18 months).

## Decision

**1. Track the current OSCAL release. Bump the pin to 1.2.2 now.**
Because the bump is proven trivial and risk-free (validates against 1.2.2, ingested by trestle 4.2.0, one-line golden), runward emits **OSCAL 1.2.2** and vendors the 1.2.2 schema. A future bump remains a *versioned-port* decision (ADR-0011, ADR-0022) — re-vendor the schema, regenerate the golden, re-check the trestle proof, update the declared version and the docs — a traced human act, never automatic. Packs previously emitted as 1.1.2 stay valid (backward-compatible); no migration is owed.

**2. Watch dated external facts out-of-band, never in the gate.**
A scheduled, **non-blocking** workflow (`.github/workflows/watch-external-facts.yml`) runs weekly, **outside** the deterministic gate, with network:
- it compares the pinned `OSCAL_VERSION` against the latest `usnistgov/OSCAL` release, and
- it compares each `regimes/*.json` `reviewBy` date against today,
and on any drift it **opens or refreshes a single tracking issue**. It never bumps a pin and never fails a build. Each regime file carries an optional `reviewBy` (EU AI Act → `2026-08-02`, right after the Article 50 milestone; the others → an annual `2027-01-01` checkpoint). This is the durable half of the ADR: the pin is current *today*, and the watch guarantees the next drift surfaces as a triageable issue rather than an unnoticed lag.

## Alternatives discarded

- **Stay pinned at 1.1.2.** The initial instinct, discarded once the bump was proven a one-line, fully-tested change: keeping an 18-month lag with no upside is the exact silent-staleness this ADR exists to end.
- **Bump only to 1.2.1** (matching trestle's internal constant exactly). Needlessly conservative: 1.2.2 was empirically ingested by trestle 4.2.0, so targeting 1.2.1 would leave runward one patch behind for no assurance gain.
- **A clock-driven or network test in the gate** (redden after a date, or fetch the latest version and assert). Rejected: it puts wall-clock and network into the deterministic, zero-network critical path (ADR-0001) — the golden pins `RUNWARD_NOW` precisely to forbid this. A test that reddens on a Tuesday with no code change is exactly the non-determinism runward exists to ban.
- **Auto-bump OSCAL via Dependabot.** Rejected: the vendored NIST schema is a copied JSON file, outside the dependency tree, and the pin is a decision (a pack must stay re-assemblable against the exact version its auditor saw). Dependabot cannot make that judgement.
- **Add/adopt an EU machine format.** Rejected: none exists as an adopted standard; inventing one is the opposite of the audit-ready promise. Keep OSCAL + the regime lenses (`regimes/*.json`).

## Consequences

- **Positive.** runward is current with NIST, killing the only real objection to its OSCAL posture. A pinned external fact can no longer fall behind unnoticed: the gap becomes an issue a human triages, while the gate stays deterministic and offline. One surface (the tracking issue) materialises every stale external fact — OSCAL and legal dates alike.
- **Negative, accepted.** A weekly scheduled job to maintain; the tracking issue needs human triage (by design — bumping is a decision). `reviewBy` is metadata on shipped regime files, but it never enters the OSCAL and does not alter the lens content, so it does not violate the "never edit a shipped mapping" rule (ADR-0022): it records *when to re-check*, not *what the mapping says*.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) NIST publishes an OSCAL release that is **not** backward-compatible for component-definitions, or that trestle refuses — then the bump stops being a one-line change and needs its own migration note; (b) the EU (via the ECSO OSCAL Task Force / a CRA or AI Act profile) publishes a recognised machine format for AI evidence — then re-evaluate supporting it; or (c) the watch workflow proves too noisy or too silent (false issues, or a known drift it missed).

**Trigger set on**: 2026-07-17 · **Watched via**: the `watch external facts` workflow itself, `usnistgov/OSCAL` releases, and the ECSO OSCAL Task Force.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the zero-LLM / zero-network gate this keeps determinism-safe.
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md), [ADR-0022](ADR-0022-regime-mappings-as-versioned-data.md) — the versioned-port / versioned-data rules a bump follows.
- [ADR-0025](ADR-0025-oscal-mapping-published-as-a-citable-spec.md), [ADR-0031](ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md) — the OSCAL-as-citable-spec and regulated-adoption posture this protects.
- The investigations (2026-07-17): EU/global landscape vs OSCAL; OSCAL versioning + dated-fact surveillance; the bump-safety proof (schema validation + trestle ingestion).
