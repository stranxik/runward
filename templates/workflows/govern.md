# Govern — Trust Through Instrumentation, From Day Zero

## When to use

Use this workflow whenever a system must be made reliable, auditable, or safe: "how do we secure this?", "we need observability", "how do you test an agent?", "do we add human approval?", "how do we stop prompt injection?". This is phase 5 of `method` and it is transversal: it starts at day zero of phase 3, wired onto the floor and maintained at every tier — never after the incident. Trust is built by instrumentation; retrofitting always costs more.

## Inputs

- A floor (or later tier) with its middleware chain and tool registry.
- The `mission/threat-model.md`, `mission/evaluation-rubric.md`, and `mission/observability-schema.md` templates.

## Outputs

- A single instrumented middleware chain.
- A threat model, an evaluation rubric with hold-out, an observability schema.
- Cost ceilings and approval points live in production.

## Procedure

**Route all transversal concerns through one middleware chain** on the tool registry — never scatter them.

- **Structured logging**: one line per event, typed context, plus persisted lifecycle events and per-model-call metrics (tokens, tier, duration, status).
- **Propagated request ID**: from entry to every tool and model call, and down to sub-agents through parent/child lineage — the thread that reconstructs a full trajectory.
- **Provenance**: per inference, keep a fingerprint of what was actually injected, so you can replay what the model saw even after working memory is gone.
- **Cost control**: the model boundary (deterministic work pays no model call), tier routing, caching, and explicit ceilings per root task and per time window — from day zero. On overrun the orchestrator stops and returns a synthesis instead of running open-ended.
- **Approval point**: tools with impact declare in their contract that they require approval. The guard is enforced by infrastructure, never by the model's discipline.

The chain carries transversal concerns only — no orchestration, no business logic. Keep the channel thin and the registry an index. One trace stream feeds provenance, observability, and evaluation separately.

**Keep the interactive turn thin — and govern the background like the foreground.** The turn does only what the answer needs; everything else (fact extraction, memory consolidation, episode summaries, context pre-warming) leaves the turn for an event-driven post-turn pipeline: each step isolated with its own bounded retry, one step's failure never failing the others, the provenance fingerprint deposited at emission. Periodic upkeep — score decay, pruning derived links past retention, cold-archiving old journal segments, trend detection, reminders, enforced erasure — belongs to a scheduled cron that updates and cools but never destroys the truth. Every background job carries four non-negotiable guardrails: bounded retry per step; idempotency (keys plus atomic deduplication, including under concurrency); bounded concurrency (a global cap and a per-user partition); and job observability — queue lag and failure rate are first-class metrics. The craft rules `async-post-turn-pipeline`, `async-scheduled-maintenance` and `async-job-guardrails` carry the detail.

**Make resilience the default.** Qualify every failure first, because the response depends on the type: transient — bounded exponential-backoff retry; validation — one retry with the diagnostic fed back; business — diagnosis or human escalation; model provider down — automatic fallback behind the same port; non-critical service down — a signaled degraded mode. Then apply the rule: **fail-open on reads, fail-closed on actions.** Cache, observability, enrichment degrade silently; a sensitive action (mutation, write, external push) fails closed and explicit rather than executing in doubt. Degrade reading, never acting. Add feature detection at startup: a minimal mode that runs on the strict necessary, a full mode when all dependencies are present, and an interface that says what is active instead of failing silently.

**Constrain security by architecture, not detection.** Prompt injection is the first-rank threat, intrinsic to any memory or retrieval; detection is unreliable, so defend structurally: retrieved content is data, never instruction; least privilege on tools (registry filtered by role before the model sees it); ownership guards before mutations; schema validation on outputs; an immutable log that keeps every injected action traceable. Apply the **lethal trifecta** rule: while untrusted content is in the context window, allow at most **two of three** — private data access, untrusted content, external communication; if all three are needed, the action runs under human supervision. The window opens at ingestion and closes only when the content is purged. For high-privilege agents, add dedicated patterns: pre-approved action sets, a plan frozen before exposure to tool outputs, quarantine of untrusted content, or a privileged planner split from a read-only model. Approval summaries are deterministic and faithful to the tool's real arguments — never a model paraphrase. An awaiting-approval agent suspends: state serialized durably, resources freed, rehydrated when the decision arrives.

**Test and evaluate — both.** Build the test pyramid: unit tests without network (pure domain, mocked model adapter); consumer-driven contract tests that catch drift between schema and real data; integration through the injection container with mock adapters; behavioral evaluations at the top. Then run the continuous evaluation loop: sample the trace stream off the hot path; score hybrid — deterministic checks wherever a guarantee exists, an anchored judge model (pinned version or replayed anchor set) only for the irreducibly behavioral, abstention first. The loop is valid only under a **hold-out the optimizer never sees**; self-tuning stays inside a pre-approved, audited envelope or goes through human validation — never autonomous self-rewriting. The hard floor — safety, security, authorization, audit — stays deterministic; never assemble it from soft judgments. Promote a new model via shadow deployment: same port, real traffic, silent; measure divergence with the same evaluation; roll out in stages with instant rollback.

**Confront the govern craft rules.** Open the CRITICAL/HIGH rules mapped to the govern phase (`runward/rules/`, `phases: [govern]`): the evaluation loop, prompt-injection defense, the secrets boundary, fail-open/fail-closed resilience, provider fallback, retry-with-backoff, background-job guardrails. Account for each in the `Rule conformance` manifest of the threat model: `applied` with a pointer, `deviated` with an ADR, or `n/a` with a reason. `runward check --strict` verifies that manifest.

## Definition of Done

- All transversal concerns pass through the single middleware chain; a trajectory replays from one request ID.
- Every govern CRITICAL/HIGH rule accounted for in the conformance manifest (`runward check --strict`).
- Cost ceilings enforced with stop-and-synthesize behavior.
- Threat model written; two-of-three trifecta rule enforced while untrusted content is in the context window.
- Test pyramid in place; evaluation loop running with anchored judge and hold-out.
- Background work guarded: pipeline steps isolated and idempotent, the maintenance cron never deletes truth, queue lag and failure rate alerting in place.

## Anti-patterns

- Postponing instrumentation until after the first incident.
- Treating the model as a trust boundary — once untrusted content is ingested, the action space must narrow.
- Letting the model write its own approval summaries.
- Closing the evaluation loop without a hold-out: it drifts toward flattering the judge.
- Handing the hard floor to a judge model.
- Failing open on a sensitive action.
- Running consolidation, extraction or summarization inside the interactive turn — the user pays latency for work the answer does not need.
- A cleanup cron that deletes from the immutable journal.
