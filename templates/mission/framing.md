# Framing Note: [system or mission name]

> **Usage.** Produce this note at the end of the `frame` workflow, before any code. One page is enough. It records the problem, the observable success criterion, the floor/target split with named deferrals, and the hard constraints. It closes with the Definition of Ready check for the engagement. Replace every `[placeholder]`; delete this notice on delivery. New in this revision: the success criterion is a typed block the whole chain reads back — `floor.md` echoes its **Metric** and **Threshold (success)** lines character for character, and the gate compares the strings; it never judges the metric.

**Date**: [YYYY-MM-DD] · **Sponsor**: [name or role] · **Entry mode**: [greenfield | brownfield M1–M4] · **Stopping tier**: [framing | floor | full chain]

## 1. Problem

[The real process as observed, not as idealized. Where the friction, manual rework, and waiting actually are. Who lives with it, how often.]

## 2. Value

[Where value is created if this works: time saved, errors avoided, quality raised, new service. Who benefits and at what frequency.]

## 3. Observable success criterion

<!-- gate: at least one SC block, every field present; Threshold matches (<|<=|>|>=|=) + number;
     "unknown" is a legal Baseline; Measured by may stay [tbd] until the floor. The gate reads the
     SHAPE of these fields — never whether the metric is the right one. -->

### SC-1

**Metric**: [one line: the quantity observed]
**Unit**: [%, seconds, count/week, …]
**Baseline**: [number + date | unknown]
**Threshold (success)**: [comparator + number, e.g. >= 80]
**Measured on**: [the traffic source: real inbound, replayed sample, …]
**Measured by**: [command or file: pointer — may stay [tbd] until the floor]

## 4. Floor

[The smallest system that proves the value on real traffic: one orchestrator, a model port, persistence, guardrails, baseline observability. What is IN, in one paragraph.]

## 5. Target (named, not built)

[The capabilities that give direction without being commitments. Named to orient the architecture, never scheduled.]

## 6. Named deferrals

| Deferred capability | Lean default in place | Trigger to revisit |
|---|---|---|
| [capability] | [what stands in for it today] | [the objective signal that reopens it] |

## 7. Hard constraints

[Data residency, human review obligations, figures that must come from source records, regulatory deadlines. The constraints that survive every iteration.]

## 8. Presumed boundaries

[Ports foreseen. Language and topology explicitly left open — adapter decisions belong to the architect phase.]

## 9. Definition of Ready check

<!-- gate: Status is met or risk; every "risk" row names its risk in the third cell — a dash is
     an answer only beside "met". -->

| Condition | Status | If missing: named risk |
|---|---|---|
| Real problem, identified sponsor | [met \| risk] | [— or the named risk] |
| Observable success criterion | [met \| risk] | [— or the named risk] |
| Floor-first principle accepted | [met \| risk] | [— or the named risk] |
| Access to the real process and people | [met \| risk] | [— or the named risk] |
| Usable data or a path to it | [met \| risk] | [— or the named risk] |
| Access to technical infrastructure | [met \| risk] | [— or the named risk] |
| Hard constraints known | [met \| risk] | [— or the named risk] |
| Human available to decide and approve | [met \| risk] | [— or the named risk] |
