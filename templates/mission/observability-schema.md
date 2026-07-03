# Observability Schema: [system or agent name]

> **Usage.** An unobserved agentic system is ungovernable and unpredictable in cost. Observability is a design property carried by the middleware chain, never an end-of-project option. Three independent levels: structured logs, lifecycle events, per-model-call metrics. One request ID propagated from entry to every tool and model call — and to sub-agents via parent/child lineage — makes every trajectory replayable and auditable. The same trace stream also feeds continuous evaluation and provenance. Auditing a past decision means rebuilding the context as it was: the schema must let you unfold a consolidated memory back to its raw facts at the exact timestamp. Cost is steered by architecture, with explicit ceilings. Replace every `[placeholder]`; delete this notice on delivery.

**Version**: [vX.Y] · **Last review**: [YYYY-MM-DD]

## 1. The three levels

[What is emitted at each level, and where it aggregates.]

| Level | What | Fields | Use |
|---|---|---|---|
| **Structured logs** | one line per event, typed context | [module, request ID, session, timestamp] | [aggregation, search, alerting] |
| **Lifecycle events** | every orchestrator step and tool call, persisted | [step, tool, input, output, status] | [trajectory replay, behavioral audit] |
| **Per-model-call metrics** | one measurement per inference | [input tokens, output tokens, cache, tier used, duration, status, attempt] | [cost and performance tracking per agent] |

## 2. Propagated request ID

[The single identifier that threads the whole trajectory.]

- **Origin**: [generated at system entry.]
- **Propagation**: [passed to every tool and model call.]
- **Parent/child lineage**: [propagated to sub-agents to reconstruct a task's tree.]
- **Carrier field**: [field name in logs, events, and metrics.]

## 3. Provenance

[What makes it possible to replay exactly what the model saw, even after working memory is gone.]

- **Per-inference fingerprint**: [what was actually injected into context on each call.]
- **Associated versions**: [prompt and model version behind each output, for temporal consistency.]
- **Linkage**: [how provenance ties to lifecycle events and metrics through the same request ID.]

## 4. Unfolding a consolidated memory (audit)

[The condition for an audit that holds: rebuild the context of a decision, not just observe that a call happened.]

- **Consolidation pointers**: [when a memory item is consolidated, deposit pointers to its raw source facts.]
- **Unfolding procedure**: [from a compressed item, walk the pointers back to the raw facts at the exact timestamp of the decision.]
- **Principle**: [current execution stays light; explaining a past decision stays possible after summarization.]

## 5. Cost ceilings

[Recurring cost as a steered quantity, not a suffered one — from day zero.]

- **Aggregate counter**: [per root task.]
- **Ceilings per time window**: [thresholds set in advance.]
- **Behavior on overrun**: [the orchestrator stops and returns a synthesis, instead of running open-ended.]
- **Structural cost levers**: [the model boundary (deterministic work pays no call); tier routing (fast / balanced / deep — one tier up when in doubt); caching and prompt stability (stability beats raw token trimming).]

## References

- [Evaluation rubric (fed by this trace stream), runbook, related ADRs.]
