# Decision Matrix

**Mission state (2026-05-12, Architect gate)** — matrix adopted as the arbitration reference for this mission. Positions taken so far, all on the sober default: number of agents → single orchestrator, locked in [ADR-0001](adr/ADR-0001-single-orchestrator.md); untrusted input and deterministic frontier → guard on extracted fields, locked in [ADR-0002](adr/ADR-0002-deterministic-guard-on-extracted-fields.md); port placement and sovereignty → the two non-in-app placements locked in [ADR-0003](adr/ADR-0003-port-placement-and-sovereignty.md); core language → open, to be locked at floor kickoff (ADR-0004, pending). No trigger has fired; watched signals are tracked in [floor.md](floor.md) §4.

How to use this file: every structural decision below carries **one sober default and one explicit trigger**. You start on the default. You only move when the trigger fires — measured, observed, named. **No trigger, no change. Every switch is an ADR** (`runward/adr/`), with the evidence that fired the trigger and a date to re-evaluate. Fill the matrix during the Architect phase; reopen it at every Iterate gate.

| Decision | Sober default | Switch when |
|---|---|---|
| Core language | One typed language for the whole core, chosen for team fluency and ecosystem depth | A capability genuinely requires another runtime, and the need is measured and isolated |
| Specialized capability | Implement it in the core language | A mature library exists only in another ecosystem (OCR, NLP, scientific computing) — wrap it as a sidecar behind a contract |
| Hot-path component | Same runtime as the rest of the core | Profiling shows this component dominates latency or cost, and a faster runtime demonstrably fixes it |
| Service split | Modular monolith, single process, boundaries enforced by ports | A module needs its own scaling profile, release cycle, or failure isolation — observed, not predicted |
| Legacy integration | A thin adapter wrapping direct calls to the legacy system | Legacy concepts start leaking into your domain — install a full anticorruption layer that translates and validates at the boundary |
| Number of agents | One agent, one loop | The task decomposes into parallelizable subtasks of real complexity, or context isolation is required — several agents under a single orchestrator |
| Model abstraction | Every model call goes through a single port, one default model | Measured cost or quality spread justifies tiered routing behind the same port; bypassing the port for a direct SDK call requires an ADR of its own |
| State | Stateless reducer: state in, decision out, nothing hidden inside the process | Audit, replay, or debugging needs history — immutable journal of events plus derived views |
| Crossing the process boundary | In-process function calls behind ports | A consumer moves to another process — promote the port contract to a versioned network API; nothing else changes |
| Contract evolution | Versioned contracts, additive changes only, consumers read tolerantly (unknown fields ignored) | A breaking change is unavoidable — expand-then-contract: serve both shapes, migrate every consumer, then retire the old one |
| Memory & forgetting | Score each memory for value and decay; invalidate rather than delete, so nothing silently disappears | Memory grows past useful recall — consolidate into summaries that keep pointers back to their sources |
| Evaluation | Deterministic tests for deterministic code, plus a guarded continuous evaluation loop for model behavior | The loop is stable and trusted — allow bounded auto-tuning: parameters only, inside hard limits, owned by a human |
| Budget & discovery (multi-agent) | One central counter caps total spend across all agents | Contention on the counter slows the fleet — hand out lease blocks of budget that agents consume locally and return |
| Model unavailable | Retry with backoff against the primary provider | The outage persists — fall back to a second provider behind the same port; the domain never notices the swap |
| Model change | Current model pinned; no silent upgrades | A candidate beats the incumbent in shadow deployment on your own rubric — staged rollout with rollback ready |
| Waiting on human approval | Suspend the run, persist its state, rehydrate when the decision lands — never hold a process open | Approvals become a chronic bottleneck — do not start blocking; revisit the autonomy boundary instead |
| Non-critical vs sensitive | Non-critical dependencies fail open: the feature degrades, the system continues | The action touches money, private data leaving the system, or anything irreversible — fail closed: no guard response, no action |
| Delegation autonomy | Bounded autonomy: the agent acts within templates, budgets, and pre-approved action lists | Evidence of consistent reliability on a class of actions — widen the bounds for that class, one ADR at a time |
| Untrusted input | Least privilege everywhere, human approval on consequential actions, and never all three of: private data, untrusted content, external egress (2-of-3 rule) | A workflow claims to need all three — re-architect to break the triad: isolate, sanitize, or gate the exfiltration channel |
| Agent identity | Each agent runs as its own principal, with its own permissions and audit trail | The agent must act on behalf of a user — explicit, bounded, revocable delegation; never shared credentials |
| Execution secrets | The agent holds only a proxy token; real keys are injected at the network boundary, outside the model's reach | A target system cannot sit behind the proxy — isolate that call in a dedicated adapter the agent cannot introspect |
| Shared brick | Consumed through a port; discovered through an index — and the index stays an index, not a brain | A brick gains multiple consumers — version its contract and run it as a product, still behind the port |

## Express decision tree

Four questions, in order. If none fires, stay on the sober default.

1. **Does the task need a specialized library from another ecosystem?** → Sidecar behind a contract.
2. **Does a component have its own load profile, release cycle, or isolation requirement?** → Split that service.
3. **Is the work parallelizable, with real complexity in each branch?** → Multiple agents under one orchestrator.
4. **Does the load require more than one instance?** → Externalize state first, then replicate.
