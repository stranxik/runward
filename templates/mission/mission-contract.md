# Mission Contract: [system or mission name]

> **Usage.** One page, filled with the sponsor at framing; the steering contract of the mission. It states what is delivered, on what condition it is accepted, and along which roadmap. It links the success criterion to the deliverables and the milestones, and it is the shared reference from one gate to the next. Replace every `[placeholder]`; delete this notice on delivery.

**Date**: [YYYY-MM-DD] · **Sponsor**: [name or role] · **Engineer(s)**: [name(s)] · **Indicative horizon**: [e.g. framing in days, floor in weeks]

## Principle

A deliverable is judged by its **acceptance against an observable criterion**, not by its form. Every engagement therefore carries two inseparable faces: what is handed over, and the condition that says it is done. That condition — the Definition of Done — always ties back to the success criterion set at framing. This protects both sides: no fuzzy scope, no deliverable open to interpretation.

## Engagements

| Engagement | Deliverables | Definition of Done |
|---|---|---|
| **Flash framing** | Framing note: problem, target value, observable success criterion, floor vs target split, first costed increment, hard constraints | The sponsor validates the success criterion and the floor scope; what is deferred is named |
| **Executable floor** | System wired to real traffic; the deterministic taken out of the model as testable code; baseline observability; light architecture note | The system answers on real cases and a first proof of value is measured against the success criterion |
| **Staged iteration** | Increments delivered; structural decisions locked as ADRs; governance, security and evaluation instrumented | Every increment is measured, every added complexity traced to a trigger, every decision traceable |
| **Handover** | Reusable assets, tutorials, handover sessions; evidence in the code; recovery documentation | The team takes over and evolves the system without the engineer — demonstrated on a task redone autonomously |

## Acceptance of the whole mission

Beyond each engagement, the mission is done when these four conditions hold. This is the global acceptance — the one you sign.

1. A system **holds in production on real traffic**, not in a demo.
2. The success criterion set at framing is **measured and reached**, or its gap is explained.
3. **Governance is in place**: observability, provenance, human approval, untrusted inputs constrained.
4. The assets are **handed over and the team is autonomous** — demonstrated, not declared.

## Typical roadmap and decision gates

A mission follows a constant arc, punctuated by decision gates: a milestone is crossed only when the previous one has proven itself. Durations are indicative and set at framing.

```
DoR check --> Framing --> Executable floor --> Increments --> Handover
 (launch      (days)       (weeks)             (iterative,    (autonomy)
 conditions)                                    on evidence)
                       gate: floor proven?   gate: increment holds?
```

A gate is crossed on **measured evidence**, never by calendar or by principle.

- **After the floor**: is the first proof of value there? If not, fix the floor — do not add complexity.
- **After each increment**: is the gain measured and held? The next increment is justified only by an objective trigger.
- **Before handover**: is the system governed and the team ready to take over?

## The contract, to fill with the sponsor

| Field | To fill in |
|---|---|
| **Problem** | [The real need, not the dreamed one — as observed in the process] |
| **Success criterion** | [Observable and measurable on real traffic] |
| **Floor** | [The smallest system that proves value] |
| **Target** | [The full architecture aimed at, by increments — named, not built] |
| **Engagements retained** | [flash framing / executable floor / staged iteration / handover — which apply] |
| **Milestones & gates** | [Indicative dates and the passing condition of each gate] |
| **Deliverables & DoD** | [Taken from the engagements table, adjusted to this mission] |
| **Hard constraints** | [Sovereignty, regulation, security, legacy — whatever bounds the solution space] |
| **Risks owned by the sponsor** | [Missing launch conditions (DoR), if any, each named as an owned risk] |
