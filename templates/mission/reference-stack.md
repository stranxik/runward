# Reference Stack

This note is a **kit of default adapters**: enough to ship a first increment fast, without reopening every arbitration from scratch. Read it for what it is — and for what it is not.

> **Framing warning.** These choices are **reversible adapter decisions**, not dogma. The boundary is the domain ports and the inter-process tool protocol; behind it, an adapter's language and a store's technology are implementation details you replace without touching the business. A default holds until an objective trigger commands a change. The transverse rule is constant: start simple, isolate by contract, add complexity only on evidence.

The runnable implementation of these defaults lives in the reference floor (`floor-ts/` in this repo). This note decides; the floor shows.

---

## Summary table

| Layer | Recommended default | Evolution trigger |
|---|---|---|
| Core language | One typed language for orchestration and interface (e.g. TypeScript) | Never without a technical reason; polyglot goes through a sidecar or a service, never a mix inside the core. |
| Specialized capability | Sidecar in the library's language, exposed through the tool protocol | As soon as a capability depends on a mature ecosystem in another language (browser automation, scientific computing, specialized models). |
| Hot-path component | Stay in the core; compiled service behind a contract only on evidence | Latency or throughput proven insufficient on the hot path. |
| Model gateway | Single port, direct SDK, three tiers (fast / balanced / deep), governance and routing centralized | Never a heavy chain framework by default; refine routing when a task's measured quality demands it. |
| Persistence | Local first, in-memory single-instance state, immutable journal plus derived working view | Shared store as soon as a multi-instance trigger appears (load, availability, state shared across processes). |
| Observability | Structured logs, cycle events, per-call metrics, propagated request id | Active from the first increment; it gets completed, never retrofitted. |
| Tests & evaluation | Pyramid: unit without network, schema contract, integration through the DI container, behavioral evaluation at the top, as a continuous loop | Re-run the evaluation bench on any change touching memory, prompt or routing. |

---

## Layer by layer

### Core language

One typed language for the agentic core (orchestrator, tool registry, use cases) and the interface avoids doubling the stack. Types are shared between back and front. The model abstraction stays thin — a direct SDK, not a heavy chain framework — to keep control of prompts, events and token cost. **Trigger:** never by habit; polyglot is justified by a library or a performance constraint, and then goes through a sidecar or a service.

### Specialized capability

When a capability depends on a mature ecosystem elsewhere, isolate it in its own process, consumed by the core as a tool provider through the tool protocol. The cross-language boundary stays sharp and stable. **Trigger:** a mature library lives in another ecosystem and no acceptable equivalent exists in the core language.

### Hot-path component

Stay in the core by default. When a component on the hot path (high-throughput gateway, heavy parallel processing, tight latency) genuinely needs a compiled language, expose it as an adapter or a service behind a contract, without contaminating the rest. **Trigger:** latency or throughput proven insufficient, measured on the real path, not anticipated.

### Model gateway

The model is one adapter among others, behind the model port. The gateway centralizes governance and routing: a task's estimated complexity picks the fast, balanced or deep tier, and on doubt you go one tier up rather than risk a bad answer. Multi-provider fallback behind the same port covers unavailability, without rewrite.

**Default real adapter, agnostic by provider profiles.** The floor ships an OpenAI-compatible adapter that works out of the box: fill in the configuration and the app runs. The adapter stays neutral — it names no provider; a provider's quirks (required headers or fields) are resolved at assembly time by a **profile keyed on the base URL**. Adding a demanding provider is one table line, not an adapter change. A **deterministic no-key fallback** keeps development and tests off the network. And a **per-run cost cap, set from day zero**, stops and synthesizes on overrun.

**Trigger:** never a heavy chain framework by default. Refine routing when a task's measured quality demands it; route deterministic tasks down to cheaper tiers. Promote a new model through shadow deployment then staged rollout, never in one move.

### Persistence

The agent is a stateless reducer; **state lives outside, in three layers**: an immutable interaction journal (truth, audit, replay), a derived working memory (which forgets), and prompt provenance (which reconciles). Single-instance, in-memory structures are enough for rate limits, idempotency, sessions, cache and progress. **Trigger:** move to a shared store when a multi-instance signal appears (load, availability, state shared across processes). That move changes the semantics — eventual consistency, compensation instead of a single transaction, explicit causal order, idempotency under concurrency — so you pay for it knowingly, on signal, never by default.

### Observability

Structured logs, cycle events, per-model-call metrics, and a request id propagated everywhere, including to sub-agents through parent/child lineage. **The same trace feeds the dashboard, the continuous behavioral evaluation, and provenance.** Explicit cost caps per root task, stop-and-synthesize on overrun. **Trigger:** observability gets completed, never retrofitted; unfolding a consolidated memory back to its raw facts becomes necessary as soon as a regulated audit demands it.

### Tests & evaluation

**Test the deterministic, evaluate the non-deterministic.** The pyramid: unit tests on the pure domain without network (mock model adapter), schema contract tests (valid / invalid, consumer-driven), integration through the DI container with mock adapters, behavioral evaluation at the top. Evaluation is not a final gate but a continuous loop, sampled off the hot path. Hybrid scoring: deterministic for whatever admits a guarantee, a grounded judge model only for the irreducibly behavioral, on a non-gameable hold-out. **Trigger:** re-run the bench on any change touching memory, prompt or routing; widen any self-tuning envelope only on real improvement, and never past the deterministic floor (safety, security, authorization, audit).

---

## What the stack does not decide

- It does not decide the **problem** or the **floor** — framing does (`frame` workflow), upstream.
- It does not make a **structural decision** without the ADR lock (`decision-loop` workflow): options, preference order, re-evaluation trigger.
- It fixes no **behavioral boundary**: the port covers the typed contract; behavior is validated separately, by evaluation.

## References

- Implementation: the reference floor, `floor-ts/`.
- Related templates: `port-contract.md`, `runbook.md`, `observability-schema.md`, `evaluation-rubric.md` (this directory).
