---
workflow: decision-loop
phase: none
gate: none
produces: [runward/adr]
requires: []
nonScope: Proves a decision was locked as an ADR in the journal; never that the position taken is right — the reevaluation trigger exists precisely because it might stop being.
---

# Decision Loop — Lock a Position Before Touching the Document

## When to use

Use this workflow whenever a durable technical position must be decided before editing an architecture document or committing a design: "should we change this?", "does this critique hold?", "what is the right practice here?", "add this idea to the doc". It pairs with `review`, which provides the expert eyes; this workflow provides the method. The rule that dominates everything: challenge and ask before any modification. Never edit on instinct, never edit before the lock.

## Inputs

- The critique, requirement, transcript, or doubt that triggered the loop.
- The document or design under question.
- Access to the real code that implements (or will implement) the system, or to public reference implementations.

## Outputs

- A locked design note in ADR form.
- A validated edit plan — and only then, edits.

## Procedure

**Hold the governing principle.** The document standardizes best practice, not the current state of the code that implements it. Check the code for reality, confront the state of the art for reference, then write the best defensible version — without ever exposing the code's limitations in the document. If the code is not yet up to standard, the code catches up; the document never stoops to the code.

**Run the loop, in order, for every critique, doubt, or proposed addition.**

1. **Reality-check the code.** Read what the code already does today in the repositories that carry the system. Identify what is implemented, partial, or absent. On greenfield, reality-check against public reference implementations and established architectures instead. These findings calibrate the position; they are never quoted in the document.
2. **Source the state of the art.** Hunt for evidence: research papers, leaders' documentation, standards, audits. Search, then read the sources. Never lock a position on intuition — anchor it on nameable sources. If an angle stays blurry, dig before locking.
3. **Challenge the source.** Confront the critique or requirement with what you just learned. Keep what has real merit; discard noise, passing fads, and overclaims. Distinguish the timeless pattern from the fashion of the season.
4. **Take a durable position.** Decide: what is the standard, defensible stance that would hold in front of a regulated-sector architecture committee? Formulate the general rule, not just the one-off answer.
5. **Lock it in writing.** Freeze the decision in a design note before any edit to the document. Not locked, not validated — not edited.
6. **Write the lock as an ADR.** Three sections: **Context** (the problem, what the code already does, the sourced state of the art), **Decision** (the position taken and the alternative discarded), **Consequences** (effects, plus the precise spec of the edits: which sections, which additions). Precise vocabulary, no hedging, no subjective escape hatches. The edit spec is validated before anything is written. Use `mission/adr/ADR-0000-template.md`.
7. **Integrate, in strict order.** First the blocking fixes — propagation of already-locked decisions for consistency, no new design. Then the important design questions, each by rerunning this full loop. Then a whole-document consistency pass — the entire document, not section by section. Minors last.

**Apply the golden rules throughout.** Ask before modifying, always. Never write before the lock. Standardize best practice; never expose the code's internal constraints in the document. Source every state-of-the-art claim. Distinguish the durable pattern from the passing fad. Watch for overlapping decisions: when two designs touch, reconcile them in one transition, never as two parallel mechanisms. End every cycle with whole-document consistency, never only local.

**Articulate with the review panel.** In practice: `review` spots a finding through its six-criterion grid and grades it blocking / important / minor. If the finding is a genuine design question, this loop runs (steps 1–6). Then integration happens (step 7), and the panel repasses for whole-document consistency. Both workflows share one golden rule: the reviewer criticizes and the loop decides — nobody rewrites without validation.

**Name the artifacts predictably.** In the mission's decision folder (for example `decisions/` or `adr/`): a dated triage of retained critiques; one dated, locked design note (ADR) per decision; a dated record of panel verdicts; a dated consolidated edit plan.

## Definition of Done

- Every triggered question ran the full loop in order — no step skipped.
- One locked ADR per decision, with sourced context and a discarded alternative.
- The edit spec validated before any edit.
- Integration done in order: blocking, important (with loop), whole-document consistency, minors.

## Anti-patterns

- Editing the document first and justifying afterward.
- Locking a position on intuition, without nameable sources.
- Quoting the code's current limitations in the document.
- Adopting a passing fad as if it were a durable pattern.
- Running two parallel mechanisms where two decisions should have been reconciled into one.
- Skipping the whole-document consistency pass after local edits.
