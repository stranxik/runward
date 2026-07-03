# Example mission: request triage

A complete Runward mission, filled end to end, on a deliberately ordinary case: an organization receives heterogeneous inbound requests (support, sales, compliance) and triages them by hand. The floor is a qualifier that classifies each request, extracts the key fields, and routes it — with an observable success criterion measured on real traffic against the manual baseline.

Every document follows the corresponding template in `templates/mission/`, placeholders replaced. All names, volumes and figures are **illustrative**: they show what a filled note looks like, not a real engagement.

## How to read it

Read in mission order — the order the workflows produce them:

1. `runward/framing.md` — the problem, the observable success criterion, floor vs target, named deferrals, DoR check (one condition carried as a named risk).
2. `runward/mission-contract.md` — the one-page steering contract signed with the sponsor: engagements, DoD, gates.
3. `runward/architecture.md` — boundaries before stack: ports, versioned contract, default topology with triggers, language explicitly left open.
4. `runward/decision-matrix.md` — the arbitration reference, adopted at the Architect gate; every position on its sober default.
5. `runward/contracts/` — the four port contracts the architecture note declares: request intake, model, routing, persistence.
6. `runward/adr/ADR-0001-single-orchestrator.md` — the sober default, with its dated reevaluation trigger.
7. `runward/adr/ADR-0002-deterministic-guard-on-extracted-fields.md` — the model never supplies a value the system can compute or verify deterministically.
8. `runward/governance/` — instrumented from day zero, not retrofitted: threat model (the 2-of-3 rule held by construction), evaluation rubric (floor-tier capabilities: routing fidelity, abstention, criterion compliance — no memory bench, because the floor has no memory), observability schema.
9. `runward/floor.md` — the proof record: what shipped, what was measured, gaps, and which trigger is watched next.
10. `runward/runbook.md` — what the receiving team inherits: startup, degraded modes, recovery, failover.

The chain passes the gate audit: `runward check -p examples/request-triage` exits 0 (the smoke test asserts it).

Notice what the documents *refuse* to do: no stack picked at framing, no complexity without a trigger, no proof on hand-picked cases, no evaluation of capabilities the floor does not have.
