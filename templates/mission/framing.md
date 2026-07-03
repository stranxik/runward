# Framing Note: [system or mission name]

> **Usage.** Produce this note at the end of the `frame` workflow, before any code. One page is enough. It records the problem, the observable success criterion, the floor/target split with named deferrals, and the hard constraints. It closes with the Definition of Ready check for the engagement. Replace every `[placeholder]`; delete this notice on delivery.

**Date**: [YYYY-MM-DD] · **Sponsor**: [name or role] · **Entry mode**: [greenfield | brownfield M1–M4] · **Stopping tier**: [framing | floor | full chain]

## 1. Problem

[The real process as observed, not as idealized. Where the friction, manual rework, and waiting actually are. Who lives with it, how often.]

## 2. Value

[Where value is created if this works: time saved, errors avoided, quality raised, new service. Who benefits and at what frequency.]

## 3. Observable success criterion

[The measurable fact, observable on real traffic, that will say "it works". Not an impression. This criterion is what the floor will be proven against — without it, no gate can be crossed.]

## 4. Floor

[The smallest system that proves value on real traffic. Typically: one orchestrator, a model port, persistence, a few deterministic guardrails, baseline observability. List exactly what is in.]

## 5. Target (named, not built)

[The full architecture this system heads toward: elaborate memory, multi-agent, externalized state, distribution, continuous evaluation — whichever apply. Named to give direction only.]

## 6. Named deferrals

[Everything excluded from the floor, each with the objective trigger that will reactivate it.]

| Deferred capability | Lean default in place | Trigger to revisit |
|---|---|---|
| [e.g. long-term memory] | [explicit per-turn context] | [measured need for cross-session continuity] |
| [e.g. multi-agent] | [single orchestrator] | [genuinely parallelizable subtasks] |
| [e.g. externalized state] | [in-memory, single instance] | [replication or shared state needed] |

## 7. Hard constraints

[Sovereignty, regulated sector, legacy integration, confidentiality, mandatory human approval on specific actions. These bound the solution space.]

## 8. Presumed boundaries

[The domain ports and integration protocol foreseen at this stage. Language and topology explicitly left open — they are adapter decisions for the `architect` phase.]

## 9. Definition of Ready check

[For each condition: met, or named as a risk owned by the sponsor. A missing condition does not block the start; it becomes the first object of discovery.]

| Condition | Status | If missing: named risk |
|---|---|---|
| Real problem, identified sponsor | [met / risk] | [—] |
| Observable success criterion | [met / risk] | [—] |
| Floor-first principle accepted | [met / risk] | [—] |
| Access to the real process and people | [met / risk] | [—] |
| Usable data or a path to it | [met / risk] | [—] |
| Access to technical infrastructure | [met / risk] | [—] |
| Hard constraints known | [met / risk] | [—] |
| Human available to decide and approve | [met / risk] | [—] |
