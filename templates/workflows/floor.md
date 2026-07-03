# Floor — Ship the Smallest System That Proves Value

## When to use

Use this workflow once the architecture is fixed and building must start: "what do we code first?", "we need an MVP", "should we add memory / multi-agent now?" (answer: not without a trigger). This is phase 3 of `method`. It delivers the floor: the smallest system that proves value on real traffic — a running system, not a demo.

## Inputs

- The architecture note, port list, and integration protocol from `architect`.
- The observable success criterion from `frame`.
- Real model access, real inputs, and a hook into the existing infrastructure.

## Outputs

- A running floor wired to real traffic.
- A floor note (use `mission/floor.md`): scope, measured proof, gaps, next tier.

## Procedure

**Enforce the entry rule.** The floor plugs into real traffic and existing infrastructure. Anything not required to prove value is deferred and attached to an explicit trigger. A component without a trigger does not enter the floor.

**Build exactly these six pieces, and nothing more.**

1. **An entry point matched to actual use.** A minimal interface when a human operates the system (submit, review, approve, decide); an API or tool protocol when another system drives it. It is a primary adapter — plain, replaceable, never touching the domain, and never a demo showcase.
2. **A single orchestrator.** It runs the loop: plans, delegates, synthesizes. It composes; it carries no business logic.
3. **A model port behind a direct SDK.** Thin abstraction, one balanced tier, no heavy chain framework. The model port is the heart of the floor, not a deferred item: ship a real, provider-agnostic adapter that activates as soon as a key is configured, with a deterministic fallback when none is. The app must run for real by filling in configuration — never stay in simulation by default. The adapter names no provider; provider quirks (headers, required fields) resolve at assembly time through a profile, never inside the domain.
4. **Persistence.** An immutable interaction log as the source of truth, attached to a business entity. The agent is a reducer with no hidden state: each turn acts on explicit context and produces explicit state.
5. **Guardrails in code.** Everything that can be deterministic — classification, validation, access control on mutations — leaves the model for testable code. The model only reasons.
6. **Baseline observability.** Structured logs (one line per event, typed context), persisted lifecycle events, and a request ID propagated from the entry point to every tool and model call. This is what makes a trajectory replayable and auditable later.

**Resist everything else.** Until an objective trigger fires, the floor has no elaborate memory (default: explicit per-turn context, minimal retrieval), no multi-agent (default: one orchestrator, specialists in-process), no externalized state (default: in-memory, single instance), and no crossed process boundary (a sidecar only when a mature library in another ecosystem demands it). These deferrals are not omissions: each is named with its trigger and handled in `iterate` when the signal arrives.

**Never defer two things.** The working model adapter, and baseline governance — observability, guardrails, and a simple per-run cost ceiling that stops and synthesizes on overrun. These are floor components, not later tiers. Deferral applies to memory, multi-agent, external state, and distribution — never to the fact that the app runs and is governed.

**Prove the floor before declaring it done.**

1. Wire it to real traffic or a representative sample — not to cases picked to impress.
2. Measure against the success criterion fixed at framing. Without this measurement you cannot decide the next tier.
3. Verify observability holds: a full trajectory reconstructs after the fact from its request ID. Without that, the system is ungovernable.

Lock any structuring decision met during the build through `decision-loop`. Write the floor note and pass it through `review`.

## Definition of Done

- The floor runs on real traffic through the existing infrastructure.
- Value measured against the observable success criterion.
- A complete trajectory replays from a single request ID.
- Every deferral named with its trigger.
- Floor note produced and reviewed.

## Anti-patterns

- Shipping a demo and calling it a floor — a system that never touches real traffic proves nothing.
- Leaving the model port in simulation mode by default.
- Letting the model perform work that deterministic code can do.
- Retrofitting observability after the fact — it always costs more.
- Adding memory, agents, or distribution "while we're at it".
- Freezing the target: its richness is earned tier by tier, never built in one block.
