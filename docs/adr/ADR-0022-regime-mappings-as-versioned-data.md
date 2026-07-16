# ADR-0022: Regime mappings as versioned data, selected by --regime-version

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — factual audit of the compliance layer (mappings hardcoded in TypeScript), cross-read against ADR-0015/0016 provenance guardrails, challenge on over-engineering, durable position

## Context

The audit confirmed: the regime structure `runward compliance` renders — ISO/IEC 42001 clause references, the EU AI Act Annex IV point table, the NIST AI RMF crosswalk, each regime's "required from the operator" list — lives as string literals inside `src/lib/compliance.ts`. Evolving a mapping when a regulatory text moves (an ISO revision, an Annex IV amendment, an AI RMF update) is a code patch and a release, when it is in truth an edit to **data about a dated external text**. ADR-0015 already frames a regime as a *dated lens*; ADR-0016 already stamps the drafts as dated engineering framing. What is missing is the mechanical consequence: the dated part extracted into dated files, and a way for the operator to pin which version of the lens a pack was assembled with.

## Decision

1. **Extract the regime structure into versioned data files**, shipped with the package: `regimes/<regime>@<version>.json` (e.g. `iso-42001@2023.json`, `eu-ai-act@2024-1689.json`, `nist-ai-rmf@1.0.json`). Each file carries the regime label, its version identifier, its dated notes (e.g. the Annex III applicability date), the clause/point mappings, and the operator-required list. The render functions consume the data; the narrative glue — stable prose that does not track the regulatory text — stays code. No template DSL.
2. **`runward compliance <regime> --regime-version <v>`** selects the lens version; the default is the highest shipped version. The selected version is **stamped into the draft header and the OSCAL props** — a dated lens must say its date (anti-overclaim, ADR-0015/0016). Old versions stay shipped: a pack assembled last quarter must be re-assemblable against the lens its auditor saw.
3. **A regulatory change becomes a data-file addition** (a new `<regime>@<newversion>.json`), reviewed like any mapping change, never a silent edit of an existing version.
4. **The OSCAL component-definition stays regime-neutral** (unchanged): the ASI grammar is the universal layer (ADR-0009); regimes are lenses over it.
5. **Ingestion proof posture.** The shipped, offline proof remains schema validation against the vendored NIST OSCAL schema with negative controls. A real-ingest test enters CI **only if** a credible, maintained OSS OSCAL ingester runs offline after install; a flaky or abandoned dependency in the gate's test path is worse than an honest documented boundary. Either way, the manual ingest procedure (how to feed the pack to a GRC tool) is documented.

## Alternatives discarded

- **A full document-template DSL** (every sentence in data). Over-engineering: the prose glue is stable product voice; only the regulatory mapping tracks an external text. Extracting the moving part is the whole point; extracting the stable part is ceremony.
- **Mission-level regime files** (operators editing the mapping per mission). A silently edited regulatory mapping with the package's name on it is a provenance leak (ADR-0016 explicitly guards pack provenance). The package versions the lens; the operator picks the version.
- **Fetching regime updates remotely.** Violates zero-network; versions ship with releases, deterministically.

## Consequences

- **Positive.** A regulation moves → a data file is added; the pack says which lens version produced it; past packs stay reproducible. The compliance layer's honesty claim gains a mechanical backbone.
- **Negative, accepted.** A loader, a version-selection surface and a data schema to maintain; two sources of truth (code glue + data) instead of one file — accepted because they change on different clocks.
- **On other boundaries.** `compliance.ts` gains a regime loader; `cli.ts` gains `--regime-version`; `package.json` ships `regimes/`; the readiness drafts and OSCAL stamp the lens version; unit tests pin loader determinism and version selection.

## Reevaluation trigger (mandatory, dated)

Reopen if a regime's structure stops fitting the shared data shape (a regime needing logic, not data — that is a code change by nature), or if shipped versions accumulate beyond usefulness (then define a retention rule, still never breaking a published pack's reproducibility).

**Trigger set on**: 2026-07-16 · **Watched via**: each regime-mapping release review.

## References

- [ADR-0015](ADR-0015-regulatory-conformance-as-a-regional-profile.md) — the regime-as-dated-lens framing this mechanizes.
- [ADR-0016](ADR-0016-runward-compliance-evidence-pack-assembler.md) — the assembler and provenance guardrails this preserves.
- [ADR-0009](ADR-0009-owasp-agentic-top-10-as-the-gate-risk-grammar.md) — the regime-neutral ASI grammar under the lenses.
