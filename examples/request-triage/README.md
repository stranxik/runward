# Example mission: request triage

A complete Runward mission, filled end to end, on a deliberately ordinary case: an organization receives heterogeneous inbound requests (support, sales, compliance) and triages them by hand. The floor is a qualifier that classifies each request, extracts the key fields, and routes it — with an observable success criterion measured on real traffic against the manual baseline.

Every document follows the corresponding template in `templates/mission/`, placeholders replaced. All names, volumes and figures are **illustrative**: they show what a filled note looks like, not a real engagement.

## How to read it

Read in mission order — the order the workflows produce them:

1. `runward/framing.md` — the problem, the observable success criterion, floor vs target, named deferrals, DoR check (one condition carried as a named risk).
2. `runward/architecture.md` — boundaries before stack: ports, versioned contract, default topology with triggers, language explicitly left open.
3. `runward/adr/ADR-0001-single-orchestrator.md` — the sober default, with its dated reevaluation trigger.
4. `runward/adr/ADR-0002-deterministic-guard-on-extracted-fields.md` — the model never supplies a value the system can compute or verify deterministically.
5. `runward/floor.md` — the proof record: what shipped, what was measured, gaps, and which trigger is watched next.

Notice what the documents *refuse* to do: no stack picked at framing, no complexity without a trigger, no proof on hand-picked cases.
