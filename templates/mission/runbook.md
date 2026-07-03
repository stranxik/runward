# Runbook: [system or agent name]

> **Usage.** This runbook is the transfer object: it lets a team that did not build the system start it, keep it running, and bring it back after an incident. Two principles behind it. Resilience is designed in by default, not after the incident: fail-open for the non-critical, fail-closed and explicit for the sensitive action. And the agent is a reducer with no hidden state — state lives outside: recovery rereads recorded outputs and restarts from a checkpoint; it never re-calls the non-deterministic model. Filling in contacts and the provider-failover procedure is not clerical work: it is what turns an incident into a non-event. Replace every `[placeholder]`; delete this notice on delivery.

**Version**: [vX.Y] · **Last review**: [YYYY-MM-DD] · **Owner**: [name or role]

## 1. Startup

[The boot sequence, from the strict minimum to full mode.]

- **Prerequisites**: [environment, permissions, access, secrets expected in typed configuration.]
- **Start command**: [ordered steps.]
- **Feature detection at boot**: [the system detects which services are actually available; a missing dependency cleanly disables its feature instead of crashing.]
- **Health check**: [how to confirm the system is up. Signals to watch: model health, persistence health, sidecar health.]

## 2. Dependencies and degraded modes

[For each dependency: its role, its behavior on failure, the associated degraded mode.]

| Dependency | Role | Criticality | Behavior on failure |
|---|---|---|---|
| [model gateway] | [generation] | [critical] | [failover to fallback provider, same port] |
| [persistence] | [state, log] | [critical] | [fail-closed on sensitive writes] |
| [capability sidecar] | [specialized capability] | [non-critical] | [circuit breaker, feature disabled and signaled] |
| [observability] | [traces, metrics] | [non-critical] | [silent degraded mode] |

**Transverse rule**: degrade reading, never acting. A sensitive action fails closed, explicit and traced, rather than executing in doubt.

## 3. Checkpoints and recovery

[How state is held, and how to restart after a stop.]

- **State model**: [immutable interaction log (truth, audit); derived working memory (which forgets); prompt provenance (which reconciles).]
- **Recovery**: [restart from a checkpoint without replaying everything; reread recorded outputs; do not re-call the model.]
- **Replication**: [if multi-instance, externalized state lives in the shared store; another instance picks up the same explicit state.]
- **Agent suspended awaiting approval**: [state serialized durably, resources freed, agent rehydrated when the decision arrives — exactly where it stopped.]

## 4. Common incidents

[Expected failures, qualified by error type, with the reaction.]

| Symptom | Error type | Diagnosis | Action |
|---|---|---|---|
| [timeout, overload] | [transient] | [check the dependency] | [retry with bounded exponential backoff] |
| [non-conforming output] | [validation] | [read the diagnostic] | [single retry, diagnostic fed back] |
| [missing resource] | [business] | [trace the trajectory via request ID] | [diagnose or escalate to a human] |
| [model provider silent] | [unavailable] | [provider health] | [failover — see section 6] |
| [cost overrun] | [ceiling] | [aggregate counter per root task] | [stop, synthesis returned] |

## 5. Contacts

| Role | Person | Channel | Scope |
|---|---|---|---|
| [technical on-call] | [name] | [channel] | [operations] |
| [product owner] | [name] | [channel] | [business decisions] |
| [sensitive-action approver] | [name] | [channel] | [human validation] |
| [model infrastructure provider] | [contact] | [channel] | [escalation] |

## 6. Model provider failover

[Keep availability failover sharply distinct from promoting a new model.]

- **Availability failover (immediate)**: [primary provider drops; automatic switch to the fallback behind the same port, no rewrite. Verify the fallback is healthy; watch for divergence.]
- **Manual override**: [how to force the switch when the automation does not trigger.]
- **Promoting a new model (earned)**: [never in one move. Validate in shadow deployment on real traffic; measure behavioral divergence with the same evaluation; roll out in stages with instant rollback on any regression.]
- **Rollback**: [how to return to the previous provider, and on which signal.]

## References

- [Observability schema, threat model, evaluation rubric, related ADRs.]
