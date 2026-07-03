# Iterate — Add Complexity Only on Proof

## When to use

Use this workflow once a floor is running and an evolution is on the table: "do we go multi-agent?", "should we extract this service?", "do we raise the model tier?", "do we add long-term memory?", "how do we scale?". This is phase 4 of `method`. Every switch has a lean default and a signal that commands the change; every evolution is guarded by a boundary and traced in an ADR.

## Inputs

- A proven floor: value measured against the success criterion.
- Real traffic over time — the source of trigger signals.
- The decision matrix below; the ADR template in `mission/adr/`.

## Outputs

- Evolutions shipped one tier at a time, each behind its boundary.
- One locked ADR per switch, with the reevaluation trigger.

## Procedure

**Enforce the entry rule.** No evolution without a signal. "Because it's better", "because it's more modern", "because we'll need it" are refused. Name the default in place, name the trigger, switch only when the trigger is observed on real traffic.

**Arbitrate with the decision matrix.** Apply the default, watch the signal, switch on proof.

- **Extract a component into a service.** Default: modular hexagonal monolith. Triggers: one instance no longer holds the load; a component has a sharply different load or cost profile; it needs its own release cycle; isolation is required for resilience or security; high availability is demanded. Boundaries being set, extraction is a local operation, not a rework.
- **Add an agent.** Default: one orchestrator directing specialists. Trigger: genuinely independent, parallelizable subtasks — not sequential reasoning in disguise. Distributed multi-agent wins on parallelizable work and degrades sequential reasoning; give it the same caution as microservices.
- **Change the model tier.** Default: one balanced tier, routing by estimated complexity. Trigger up: a task whose measured quality demands it. Trigger down: a deterministic task routed to a cheaper tier. In doubt, go one tier up rather than risk a wrong answer.
- **Cross the process boundary.** Default: as late as possible. Crossing changes semantics: an atomic local access becomes a network call, and three real costs are assumed — eventual consistency instead of strong; compensation steps instead of a single transaction; explicit causal ordering and idempotence under concurrency. That is the entry price of distribution — pay it only on trigger, knowingly.
- **Introduce elaborate memory.** Default: explicit per-turn context, minimal retrieval. Trigger: a measured, not anticipated, need for continuity beyond the session. Then compose role-specific stores behind ports, with deterministic staged retrieval, value scoring, invalidation rather than deletion, and heavy work moved out of the interactive turn.
- **Externalize state for multi-instance.** Default: in-memory structures, single instance. Trigger: replication (load, availability) or shared state. The shared store that unlocks multi-instance then hosts, at once, the externalized state, the capability discovery registry, and the budget allocation registry.
- **Go asynchronous.** Default: synchronous work inside the turn. Trigger: costly operations that must not keep the user waiting (fact extraction, consolidation, summaries) move to background jobs fired after the turn.

**Guard and trace every switch.**

1. **Lock the decision in an ADR before implementing.** Run `decision-loop`: reality-check, sourced state of the art, challenge, durable position, written lock. No lock, no code.
2. **Keep the evolution behind a boundary.** An extraction goes through the port already in place; a new agent through the registry; a tier change through the model gateway. The domain does not change; only the adapter and the topology do. Nothing here is irreversible, because everything is decided behind a boundary.
3. **Prove the gain after the switch.** Load holds, latency drops, quality rises, cost stays controlled. If the gain is not there, roll back — the boundary makes rollback possible.

## Definition of Done

- Every shipped evolution maps to an observed trigger or a measured gain.
- One locked ADR per switch, including the rollback signal.
- The domain untouched; only adapters and topology moved.
- Post-switch measurement recorded; rollbacks executed where the gain failed.

## Anti-patterns

- Complexifying on principle: memory, multi-agent, or distribution "because serious systems have them".
- Crossing a gate without proof from the previous tier.
- Dressing sequential reasoning up as parallelism to justify multi-agent.
- Paying the distributed-systems entry price blindly — eventual consistency, compensation, causal ordering are the fee, not a footnote.
- Implementing before the ADR is locked.
- Switching without a rollback path.
