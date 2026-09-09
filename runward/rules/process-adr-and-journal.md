---
title: ADR Discipline and Working Journal
requires: adr
impact: HIGH
phases: [architect]
noAsi: decision traceability, not an agentic-security control.
impactDescription: Makes structural decisions traceable and reversible-by-record, so the system can be picked up by anyone without re-litigating settled choices
tags: [process, adr, journal, traceability, governance]
noTerritory: This is a decision discipline: it fires when a structural choice is made or a session ends, and the rule names no ADR directory or file convention that a path could be checked against.
---

## ADR Discipline and Working Journal

A structural decision that lives only in someone's head is a decision that will be re-debated. Two lightweight records keep the system legible: ADRs for structural choices, a journal for the running thread.

**ADR (Architecture Decision Record):**

- One ADR per structural decision: a boundary, a port, a model, a persistence choice, a safety guard.
- An accepted ADR is **never edited**. A new decision that changes it is a **new ADR that supersedes or refines** the old one (the trail stays intact).
- Each ADR records its **trigger**: the objective signal that would reopen it. "Default: sober; trigger: this measured condition." A decision with no trigger is a decision you cannot revisit on evidence.

```
# ADR-008 - Grounding guard over an expanded set
Status: accepted · Refines: ADR-001 · Date: 2026-06-22
Context: the guard rejected a legitimate figure present in a served fact's label.
Decision: the grounded set = fact values ∪ numbers in served labels ∪ years.
Trigger to revisit: wiring the model in structured outputs -> switch to {fN}
                    slot references -> write ADR-009 at that point.
Consequences: the unit test now feeds realistic facts with their labels.
```

**Journal (one entry per working session):**

```
## YYYY-MM-DD - short title
- Done: ...
- Decided: ... (if structural, point to ADR-xxx)
- Blocked / to dig: ...
- Next: ...
```

The journal carries minor decisions and progress; structural ones graduate to an ADR. Together they answer "why is it like this?" without archaeology.

**Commits and the code as evidence:**

- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`) so history is scannable.
- The code is the final proof: a decision that matters has a test, a guard, or a runnable check that demonstrates it. An ADR points at that proof, it does not replace it.

**Checklist:**

- [ ] Every structural choice has an ADR with an explicit revisit trigger.
- [ ] Accepted ADRs are immutable; change means a new, superseding ADR.
- [ ] A journal entry closes each session (done / decided / blocked / next).
- [ ] Decisions that matter are backed by a test or guard in the code.
