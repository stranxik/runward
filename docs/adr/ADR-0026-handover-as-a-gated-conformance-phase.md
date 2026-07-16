# ADR-0026: Hand-over as a gated conformance phase — the succession is proven, not promised

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — the audit's whitespace finding ("the scaffolds stop at tested code; run and hand-over after merge is where you are alone") confronted with runward's own precedent (ADR-0017: a deliverable no gate enforces drifts to orphan), challenge on ceremony cost, durable position

## Context

Hand-over is runward's exclusive ground. The audit verified it as genuinely empty competitive space: every spec-driven scaffold stops at tested code; none carries the system across the succession — the runbook, the finalized charter, the moment the receiving team runs it without the builder. runward's method carries it (`workflows/handover.md`), and the public promise is precise: *the hand-over is proven by a real task redone without you*.

But the promise is enforced nowhere. The `handover` phase has **zero gated deliverable and zero mapped rules**: `check --strict` verifies architect, topology, floor and govern manifests, and stops. The redone-task proof, the runbook's executability, the finalized charter, the named successor — all Definition-of-Done prose, none of it verified. This is the exact defect ADR-0017 closed for the topology vision, one phase later: **a deliverable no gate enforces drifts back to orphan**, and a differentiator no gate backs is a claim, not a feature. The strongest ground runward owns is the least verified part of its chain.

## Decision

Gate the hand-over, symmetric with ADR-0017's topology move. Five pieces.

1. **A gated deliverable: `runward/handover.md`** — the hand-over note, the kit made legible in one place: the kit index (each leave-behind artifact, where it lives, its state), the **redone-task proof record** (which real task, when, by whom, with an evidence pointer the gate can verify), the **named succession** (owner, escalation path, review cadence), and the provider-swap drill record. Scaffolded by `init` (joins `MISSION_LAYOUT`), listed as a phase-6 artifact beside the runbook.
2. **Four craft rules, `phases: [handover]`**, each verifying a traced decision, never a live state:
   - `handover-redone-task-proof` (CRITICAL, ASI09) — a real task was redone end to end without the departing builder, and the record names the task, the date, the doer and the evidence.
   - `handover-runbook-executable` (HIGH, ASI08) — the runbook covers the recovery gestures (start, observe, debug, resume from checkpoint, swap the model provider, rerun the evaluation bench, process a suspended approval) with real commands, not prose intentions.
   - `handover-agents-charter-final` (HIGH, ASI10) — `AGENTS.md` is finalized as the leave-behind: verification commands (including `runward check --strict`), judgment boundaries, never/PR rules — the standing constraint on every agent that inherits the system.
   - `handover-succession-named` (HIGH) — the system has a named owner after the departure, an escalation path, and a review cadence; an unowned agentic system is an incident with a start date.
3. **The gate config grows one pair**: `handover → handover.md` in `GATED_DELIVERABLES`, `EXPECTED_MAPPED.handover = 4` (the ADR-0002 non-vacuity floor). `conformance()` is phase-generic — no mechanics change. The compliance assembler inherits the new manifest automatically (it reads `GATED_DELIVERABLES`).
4. **A hand-over phase skill** (ADR-0018): the fifth relevance-loaded skill, emitted with the other four — the craft surfaces when an agent starts preparing a succession.
5. **The reference mission and this repository's own mission** each carry a filled `handover.md` that passes the gate — the feature ships demonstrated, per the self-gating standard (v0.15.0).

The invariants hold: the gate checks that the succession decisions are *traced* (a recorded proof, a named owner, real pointers — verifiable down to the typed-evidence layer of ADR-0019), never that the hand-over went well. Deterministic, zero-LLM, never a runtime.

## Alternatives discarded

- **Keep hand-over as Definition-of-Done prose.** The status quo, and ADR-0017's rejected alternative verbatim: a deliverable no gate enforces drifts to orphan. Worse here — this is the differentiator the positioning leans on; prose-only makes the flagship claim the least backed one.
- **Gate the runbook alone** (no hand-over note). The runbook is one artifact of the kit; the redone-task proof and the succession have no home in it, and stretching it into one would bloat a recovery document with governance records. The note indexes; the runbook operates.
- **Verify the redone task by running something.** Crosses never-a-runtime (ADR-0005). The gate verifies the *record* of the proof — task, date, doer, evidence pointer — exactly as it verifies a placement or a threat-model decision.
- **More than four rules** (charter-per-agent, drill-per-provider…). Ceremony. Four rules cover the four failure modes the field names: nobody re-ran it, nobody can operate it, nothing constrains the next agent, nobody owns it. Growth on evidence, like every rule set change.

## Consequences

- **Positive.** The exclusive ground becomes the *verified* ground: "the hand-over is proven by a real task redone without you" stops being copy and becomes a red-or-green fact. The evidence pack gains a Handover section for free; the whitespace the audit told us to own is now gated, not narrated.
- **Negative, accepted.** Every mission gains a fifth manifest to fill (`manifest --sync` scaffolds it; for a mission that never reaches hand-over, the note honestly says so and its rows stay ahead as the phase-6 gap the gate already reports). Rules 60 → 64, the floors table grows, and the smoke/tests surface follows.
- **On other boundaries.** `MISSION_LAYOUT`, `PHASES` (phase 6 gains the note), `GATED_DELIVERABLES`, `EXPECTED_MAPPED`, `EXPECTED_RULES`, the phase-skill set, the `handover` workflow's Outputs/DoD, both shipped missions, smoke and unit tests.

## Reevaluation trigger (mandatory, dated)

Reopen if real missions systematically park all four handover rules as `n/a` before ever reaching phase 6 (signal that the manifest lands too early in the mission's life — consider gating it only once the floor phase closes), or if operators fake the redone-task record (a proof record that is theater means the check must move closer to the evidence, e.g. requiring a typed pointer to the redone task's artifact — still deterministic).

**Trigger set on**: 2026-07-16 · **Watched via**: the `n/a` ratio on handover rules across missions and the hand-over sections of field reports.

## References

- [ADR-0017](ADR-0017-application-infrastructure-double-vision-gated.md) — the precedent: an orphaned vision made a gated phase; this repeats the move for phase 6.
- [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md) — the evidence layer the proof record's pointers inherit.
- [ADR-0010](ADR-0010-agents-md-as-a-first-class-handover-deliverable.md) — the charter-as-leave-behind this gates.
- `templates/workflows/handover.md` — the workflow whose Definition of Done becomes verifiable.
