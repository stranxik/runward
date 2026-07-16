# ADR-0024: A machine surface for the rule set — rules --json, explain

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — factual audit (no machine surface; the why of a rule locked in markdown bodies), challenge on scope creep, durable position

## Context

The audit named two blind spots with one root. **No machine surface**: the rule set — runward's content moat — is consumable only by reading sixty markdown files; a CI dashboard, an editor extension or a script that wants "the CRITICAL rules mapped to floor, with their signatures" must reimplement frontmatter parsing against an undocumented shape. **The why is buried**: a rule's rationale lives in its body; the CLI never surfaces it, so the tacit knowledge stays tacit — the onboarding cost is "read the doctrine", and the bus factor concentrates in whoever already has.

The rule set is already the product's data. What is missing is the seam.

## Decision

Two read-only, zero-LLM commands over the effective rule set (the mission's `runward/rules/` copy when present, else the package's — exactly the gate's own resolution):

- **`runward rules [--json] [--phase <id>]`** — the deterministic inventory: slug, title, impact, phases, ASI mapping, signature presence. `--json` emits a stable machine envelope — `{ runward, source, count, rules: [...] }`, rules sorted by slug — treated as a **versioned, additive contract** (`contracts-governance` applied to ourselves: fields are added, never renamed or repurposed).
- **`runward explain <rule> [--json]`** — the rule's contract surface (title, impact, the why via `impactDescription`, phases, ASI, signature) followed by its full body: the rationale inline, at the point of asking, no doctrine excavation. Unknown slugs answer with the migration record's guidance (ADR-0006) when one exists.

## Alternatives discarded

- **An HTTP/registry endpoint for rules.** runward is never a runtime; the CLI is the seam, scripts compose it.
- **A separate rules-data npm package.** Splits the rules from the gate that verifies them and doubles the release surface; the mission-copy resolution (operators may edit their rules) would be lost.
- **Rendering the doctrine's full rationale into `explain`.** The rule body already is the operational form of the rationale; duplicating doctrine prose creates a second source of truth that drifts.

## Consequences

- **Positive.** Dashboards, editor extensions and CI annotations get a supported contract instead of scraping; the why of a rule is one command away — the tacit-knowledge tax and the bus factor both shrink; the content moat gains a platform seam.
- **Negative, accepted.** The JSON envelope is a public contract to honor additively from now on; `explain` output quality is bounded by rule-body quality (a pressure on rule authoring, accepted as healthy).
- **On other boundaries.** `src/lib/rules.ts` (one parser for the full frontmatter shape) + `src/commands/rules.ts`; README documents the envelope; smoke and unit tests pin determinism, sorting, and the migration answer for renamed slugs.

## Reevaluation trigger (mandatory, dated)

Reopen if a consumer needs a field the envelope cannot add additively (a breaking shape change — expand/contract like any port, ADR-0011), or if `--json` output is observed drifting between runs on an unchanged rule set (a determinism bug, treated as a gate-grade incident).

**Trigger set on**: 2026-07-16 · **Watched via**: consumer reports and the release review of the envelope shape.

## References

- [ADR-0006](ADR-0006-rule-set-evolution-as-tracked-migrations.md) — the migration guidance `explain` answers with.
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) — the versioned-port discipline the JSON envelope inherits.
- `templates/rules/` — the data this surfaces.
