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

## Runnable floor

The mission is also executable: [`code/`](code/) contains a standalone
TypeScript package (no key, no network, deterministic model adapter) that
implements what the documents decide — closed-vocabulary classification,
the deterministic guard on extracted fields (ADR-0002), guarded routing,
fail-closed compliance through suspend-and-rehydrate, abstention on unknown.
`npm install && npm test` in `code/` runs its 14 deterministic tests; see
[`code/README.md`](code/README.md).

## Machine evidence, regenerated before the gate

The manifests do not stop at naming files. The rows whose rules require a kind of evidence cite a
report of that kind, produced by a tool from this tree and committed in `code/reports/`: the JUnit
report of the suite, an LCOV coverage report, and one ESLint run written twice (per file as ESLint
JSON, per rule as SARIF) under a configuration that encodes the hexagon, refuses `eval`, and refuses
the literal shapes of credentials (`code/eslint.config.mjs`). `check --strict --json` on this mission
reports `requiresUnmet: []`.

A committed report is only as good as the proof that this tree produces it, so `runward/hooks.json`
regenerates all four and compares them with the committed ones (`npm run reports:fresh`) whenever the
gate runs as `runward check --strict --hooks`, which is what the CI samples in `runward/adapters/`, the
GitHub Action and the GitLab template run by default. Measured on this mission, a domain rewritten
around a database driver with a key in it, a file added that executes a model's output, emptied
tests, and stub files with every cited report forged by hand all pass `check --strict` on the
committed tree and are refused by that run (runward ADR-0115, which also says what it does not
catch).
