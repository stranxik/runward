# ADR-0023: manifest --sync — runward scaffolds the form, never the content

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — factual audit (the hand-maintained manifest as the adoption brake and rubber-stamp feeder), challenge against the operator-owns-the-decision invariant, durable position

## Context

The conformance manifest is maintained entirely by hand: the operator (or their agent) writes every row of every gated deliverable's table. The audit named the two costs. **Tedium feeds theater**: the more painful the table plumbing, the more a tired operator stamps it — the exact failure mode ADR-0001's trigger (b) watches. **Rule-set evolution lands on the operator**: a renamed rule (ADR-0006) must be hand-edited in every manifest, and a rule newly mapped to a phase surfaces only as a red row at check time, one run at a time.

The plumbing is deterministic; the decisions are not. Today runward makes the operator do both.

## Decision

A `runward manifest` command. **Read-only by default**: for each gated deliverable, the overview — rows accounted for, expected rules missing, renamed slugs with their migration, duplicates, unknown slugs. **`--sync` writes the form, never the content**:

- creates a missing `## Rule conformance` section (with its documentation blockquote) in a gated deliverable that lacks one;
- appends one row per missing expected rule **with empty status and empty evidence** — and the gate refuses an empty status with a message that names the choice (`applied | deviated | n/a`), so a scaffolded row can never pass as accounted for;
- rewrites a renamed slug in place per the migration record (ADR-0006), preserving the row's status and evidence;
- **reports and never deletes**: duplicates, removed rules, unknown slugs stay the operator's edit.

**The invariant, stated once**: `--sync` never sets a status, never writes evidence, never deletes a row. The decision content stays the operator's and their agent's; runward moves the deterministic plumbing out of their way so the human effort lands on the pointer, not the table syntax. Respects `--dry-run`.

## Alternatives discarded

- **Pre-filling scaffolded rows with a default status** (`n/a`, or `applied` with a TODO). Builds the rubber stamp into the tool — a table full of plausible defaults is exactly what gets waved through. An empty status that the gate loudly refuses is the honest scaffold.
- **A virtual manifest** (derive the table at check time, no file). The manifest is an operator-owned document with provenance and history (ADR-0001); hiding it in the tool makes the trace invisible and the diff unreviewable.
- **Report-only linting** (no scaffold). Keeps the exact tedium that feeds the stamping; the audit's point was to kill the plumbing, not to describe it.

## Consequences

- **Positive.** A new mission or an updated rule set is one `manifest --sync` away from a complete, honest table skeleton; migrations stop being a hand-edit per manifest; the adoption brake and the theater feeder shrink together.
- **Negative, accepted.** A write path into operator-owned documents — bounded by the form-only invariant and `--dry-run`; the section-insertion logic must stay conservative (append, never reorder).
- **On other boundaries.** `src/lib/manifest-sync.ts` + `src/commands/manifest.ts` + a CLI entry; the gate's empty-status message names the expected gesture; smoke and unit tests cover scaffold, migration, idempotence, and that a scaffolded row still fails `--strict`.

## Reevaluation trigger (mandatory, dated)

Reopen if operators start treating a freshly synced (empty-status) table as progress in itself — the plumbing became the theater — or if `--sync` ever needs to touch a row's content to stay useful: that would cross the invariant and must be refused or re-decided here.

**Trigger set on**: 2026-07-16 · **Watched via**: how synced manifests look when missions cross the gate (empty rows filled, or lingering).

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the manifest this scaffolds; the operator-owns-the-decision invariant.
- [ADR-0006](ADR-0006-rule-set-evolution-as-tracked-migrations.md) — the migration record `--sync` applies mechanically.
- [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md) — the pointer grammar the freed effort should go into.
