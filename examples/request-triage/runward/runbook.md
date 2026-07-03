# Runbook: Inbound Request Triage Qualifier

**Version**: v1.0 · **Last review**: 2026-06-19 · **Owner**: operations team (receiving team after handover)

This runbook lets the team that did not build the qualifier start it, keep it running, and bring it back after an incident. Names, channels and thresholds are **illustrative**.

## 1. Startup

- **Prerequisites**: ticketing API credential (required); model gateway credential (optional — without it the deterministic keyword fallback classifier runs and everything low-confidence goes to review); access to the shared mailbox and the web-form webhook; typed configuration validated at boot.
- **Start command**: single deployable — start the process; it validates configuration, then opens intake.
- **Feature detection at boot**: the model adapter probes the gateway once; if unreachable, the fallback classifier is enabled and the degradation is logged and announced on the ops channel. A missing observability sink degrades silently; a missing ticketing credential stops boot — routing without the system of record is not a mode.
- **Health check**: the startup log prints one line per port with its adapter and status. Watch: model gateway health, ticketing API health, triage-log store health.

## 2. Dependencies and degraded modes

| Dependency | Role | Criticality | Behavior on failure |
|---|---|---|---|
| Model gateway | classification and extraction proposals | degraded-capable | automatic switch to the keyword fallback classifier; low-confidence records flood the review queue — noisy but safe |
| Ticketing API | routing (system of record) | critical | fail-closed: validated records queue durably, routing retries with backoff; nothing is dropped, nothing routes blind |
| Triage-log store | immutable decision log | critical | fail-closed on writes: a decision that cannot be persisted does not act |
| Account registry | deterministic verification of account references | critical for the guard | affected fields stay `unverified`; records escalate to human review (ADR-0002 path) |
| Observability sink | traces, metrics | non-critical | silent degraded mode; local buffer replays on recovery |

**Transverse rule**: degrade reading and proposing, never acting. Routing fails closed, explicit and traced, rather than executing in doubt.

## 3. Checkpoints and recovery

- **State model**: the append-only triage log is the truth; queue state is derived and rebuilt from it. No hidden state in the process.
- **Recovery**: on restart, replay the triage log from the last routed position — reread recorded decisions; never re-call the model for an already-triaged request.
- **Replication**: single instance at the floor (named deferral, framing §6); the externalized-state row of the decision matrix fires before any second instance starts.
- **Records awaiting review**: the review queue is persisted; a restart loses nothing, reviewers resume exactly where the queue stood.

## 4. Common incidents

| Symptom | Error type | Diagnosis | Action |
|---|---|---|---|
| Gateway timeouts | transient | gateway health endpoint | bounded exponential backoff; fallback classifier after the retry budget |
| TriageRecord fails schema validation | validation | read the per-field diagnostic in the lifecycle event | single retry with the diagnostic fed back; then human review |
| Account reference does not resolve | business | trace the trajectory via request_id | expected guard behavior — record is in review with the failure reason; no action needed |
| Review queue growing (unknown rate above 5%) | capacity | weekly observability review; unknown-category rate | known watched signal (floor.md §5) — do not widen the category vocabulary ad hoc; it is a governed contract change |
| Weekly cost alert fires | ceiling | aggregate counter vs. intake volume | check for an intake loop or duplicate feed first; raising the ceiling is a sponsor decision |

## 5. Contacts

| Role | Person | Channel | Scope |
|---|---|---|---|
| Technical on-call | ops engineer on rotation | ops channel | operations, restarts, failover |
| Product owner | Head of Operations | direct | business decisions, ceiling changes |
| Sensitive-action approver | operations coordinators | review queue | compliance-flagged and guard-escalated records |
| Model infrastructure | platform team | platform channel | gateway escalation |

## 6. Model provider failover

- **Availability failover (immediate)**: the gateway drops → the keyword fallback classifier takes over behind the same ModelPort, automatically. Verify the review queue absorbs the extra load; coordinators are the backstop.
- **Manual override**: a configuration flag forces the fallback adapter; use it when the gateway degrades without failing outright.
- **Promoting a new model (earned)**: never in one move. Replay the labeled evaluation set (governance/evaluation-rubric.md), run one live shadow week against the incumbent, compare on the same rubric with the anchored judge, then stage the rollout with instant rollback.
- **Rollback**: repoint the adapter to the previous model version; the port contract is unchanged by design, so rollback is a configuration change, not a release.

## References

- [governance/observability-schema.md](governance/observability-schema.md) — every diagnosis starts from a request_id.
- [governance/threat-model.md](governance/threat-model.md) — why the review queue is the safe direction to degrade toward.
- [adr/ADR-0002-deterministic-guard-on-extracted-fields.md](adr/ADR-0002-deterministic-guard-on-extracted-fields.md) — the guard path incidents 3 and 4 traverse.
