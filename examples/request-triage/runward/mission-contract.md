# Mission Contract: Inbound Request Triage

**Date**: 2026-05-04 · **Sponsor**: Head of Operations · **Operator(s)**: one operator (anonymized) · **Indicative horizon**: framing in one week, floor proven in six weeks

> All dates, volumes and amounts in this contract are **illustrative** — they show what a signed steering contract looks like, not a real engagement.

## Principle

A deliverable is judged by its **acceptance against an observable criterion**, not by its form. Every engagement below carries two inseparable faces: what is handed over, and the condition that says it is done. That condition always ties back to the success criterion set in [framing.md](framing.md) §3.

## Engagements

| Engagement | Deliverables | Definition of Done |
|---|---|---|
| **Flash framing** | Framing note: manual triage problem, value, observable success criterion, floor vs target split, hard constraints | Sponsor validates the criterion and the floor scope; deferrals named — **done 2026-05-06** |
| **Executable floor** | Qualifier wired to the real mailbox and web form; deterministic guards as testable code (ADR-0002); baseline observability; architecture note | The system triages real traffic and a first proof is measured against the criterion — see [floor.md](floor.md) §2 |
| **Staged iteration** | Increments on evidence only; structural decisions locked as ADRs; governance instrumented from day zero | Every increment measured; every added complexity traced to a fired trigger; every decision in the ADR journal |
| **Handover** | Runbook, contracts, evaluation set, transfer sessions | The operations team runs and evolves the system without the operator — demonstrated on a task redone autonomously |

## Acceptance of the whole mission

1. The qualifier **holds in production on real inbound traffic**, not in a demo.
2. First-assignment routing accuracy is **measured and exceeds the manual baseline**, or the gap is explained; zero silent compliance misses.
3. **Governance is in place**: threat model, evaluation rubric, observability schema, human review on compliance-flagged records.
4. Assets are **handed over and the team is autonomous** — demonstrated, not declared.

## Milestones and decision gates (illustrative dates)

```
DoR check --> Framing --> Executable floor --> Increments --> Handover
2026-05-04    2026-05-06   2026-06-19          on evidence     autonomy
                       gate: floor proven?   gate: increment holds?
```

- **After the floor** (2026-06-19): first proof measured on replay + one live shadow week; the gate to iterate closes only after the full two-week live window required by the criterion's wording.
- **After each increment**: gain measured and held; the next increment needs a fired trigger from the deferral table.
- **Before handover**: system governed, runbook exercised by the receiving team.

## The contract, filled with the sponsor

| Field | Agreed |
|---|---|
| **Problem** | ~400 heterogeneous inbound requests/week triaged by hand; misroutes cost 1–3 days; compliance requests carry regulatory deadlines |
| **Success criterion** | First-assignment routing accuracy on real traffic over ≥2 weeks exceeds the manual baseline of the same period the previous month; attached condition: no compliance request routed past human review |
| **Floor** | Classify, extract key fields under deterministic guard, route or escalate; immutable triage log; the floor never replies to requesters |
| **Target** | Auto-drafted acknowledgments under approval, priority scoring, requester memory, reassignment-to-evaluation loop — named, not built |
| **Engagements retained** | All four: flash framing, executable floor, staged iteration, handover |
| **Milestones & gates** | See arc above; a gate is crossed on measured evidence, never by calendar |
| **Deliverables & DoD** | Taken from the engagements table above |
| **Hard constraints** | Personal data stays on approved infrastructure; ticketing system remains the system of record; no outbound replies at the floor tier |
| **Risks owned by the sponsor** | The manual baseline was never measured live; reconstructed from ticketing reassignment history — owned by the sponsor since 2026-05-04 (framing DoR) |
