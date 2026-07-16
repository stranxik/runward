# Hand-over Note — Request Triage

**Date**: 2026-07-03 · **Departing builder**: the mission operator · **Receiving side**: operations team (triage product owner) · All names and dates **illustrative**, like the rest of the reference mission.

## 1. The kit

| Artifact | Where | State | Exercised by the receiving side? |
|---|---|---|---|
| Recovery runbook | `runbook.md` | ready | 2026-06-30 — ops engineer ran the recovery replay (§3) during the drill |
| Agent charter (finalized) | `AGENTS.md` (project root) | finalized at hand-over | read and countersigned at the second transfer session |
| Architecture note + decision journal | `architecture.md` · `adr/` (3 ADRs, triggers dated) | current | walked through, hands on keyboard |
| Evaluation bench | `cd code && npm test` + the replay set (floor.md §2) | ready | 2026-07-02 — re-run alone (see §2) |
| Evidence pack | `compliance/` — regenerate with `runward compliance <regime>` | regenerable on demand | generated once by the ops engineer during the drill |

## 2. The redone task (the proof)

- **Task**: after the illustrative provider incident of 2026-06-29 (gateway timeouts, fallback classifier engaged — runbook §4 first row), re-run the full behavioral proof and the demo, then process the suspended compliance approval that had queued during the incident — end to end, from the leave-behinds alone.
- **Date / doer**: 2026-07-02, the operations engineer of the receiving team; the builder unavailable by agreement (out of the loop for the day).
- **Evidence**: file:code/test/triage.test.ts; file:runward/runbook.md#Recovery — the proof re-ran green, the replay recovered the queued state, the suspended approval was released through the approval path (ADR-0002 provenance rules held).
- **Gaps found**: two, both folded back the same day — the runbook did not name where the review queue persists (added to §3), and the demo's expected output was undocumented (added to the code README).

## 3. Succession

- **Owner after departure**: the triage product owner (operations) — incidents, cost, credentials, and the three open ADR re-evaluation triggers.
- **Escalation path**: compliance officer for category/vocabulary questions; the sponsor (Head of Operations) for scope; provider support through the gateway contract.
- **Review cadence**: the usage registry and the ADR triggers are re-read at the weekly observability review (the guard-escalation rate of ADR-0002 is already on its agenda); the evidence seal is re-taken at each gate crossing.
- **Credentials boundary**: ticketing and gateway credentials live in the ops vault, injected at the network boundary; the builder's accesses were revoked on 2026-07-03 as part of this note.

## 4. Provider-swap drill

2026-06-27 — swapped the model adapter from the approved gateway deployment to the deterministic keyword fallback and back (the adapter switch of architecture.md §2), then re-ran the bench: accuracy on the replay set within the expected fallback envelope, provenance rules unaffected. The port held; the domain never noticed. Next drill on the shared-gateway trigger (ADR-0003).

## Rule conformance

| Rule | Status | Evidence |
|---|---|---|
| handover-redone-task-proof | applied | §2 — 2026-07-02, ops engineer, incident-recovery task end to end without the builder; file:code/test/triage.test.ts; file:runward/runbook.md#Recovery |
| handover-runbook-executable | applied | file:runward/runbook.md#Recovery — the seven gestures carry commands/paths (start §1, observe §1, debug §4, resume §3, swap §2+§4, bench: cd code && npm test, approvals §3); exercised during the 2026-07-02 task |
| handover-agents-charter-final | applied | file:AGENTS.md#Never — finalized at hand-over: mission-specific boundaries (registry read-only, compliance always approval-gated), exact verification commands, never/PR rules |
| handover-succession-named | applied | §3 — named owner (triage product owner), escalation path, weekly review cadence, builder's accesses revoked 2026-07-03 |

## Cross-references

- `workflows/handover.md` — the phase this note closes.
- `runbook.md` — the operational half of the kit.
- `AGENTS.md` — the charter the next agent inherits.
- `adr/` — the open re-evaluation triggers the owner now watches.
