# Frame — Decide the Perimeter Before Writing Code

## When to use

Use this workflow at the start of any agentic-system mission, or whenever the perimeter is fuzzy: "we'd like an agent that…", "what do we build first?", "do we need multi-agent / long-term memory?", "which language, which stack?" (answer: not yet). This is phase 1 of `method`. It turns a vague intent into a decided perimeter: what gets built first, what is explicitly deferred, and under which conditions complexity will be added.

## Inputs

- A sponsor and a real business problem.
- Access to the people who run the process today.
- The Definition of Ready checklist below.

## Outputs

- A framing note (use the `mission/framing.md` template).
- The floor/target split with named deferrals.
- Presumed architecture boundaries — ports and integration protocol, stack left open.

## Procedure

**Refuse stack questions.** If the conversation opens with framework, language, or provider, push it back: those are adapter decisions, reversible, taken later behind stable contracts. Framing decides the problem and the floor, not the technology.

**Check the Definition of Ready.** Eight conditions in three families.

- **Mandate**: a real problem with an identified sponsor; an observable success criterion; acceptance of the floor-first principle.
- **Access**: to the real process and its people; to usable data or a path to it; to the technical infrastructure.
- **Constraints**: hard constraints known (sovereignty, regulation, legacy integration); a human available to decide and approve sensitive actions.

Treat these as a floor, not a barrier: a missing condition becomes a named risk, owned by the sponsor, and often the first object of discovery — it is not a compliance turnstile.

**Establish entry mode and stopping tier first.** Present both as explicit choices to the sponsor: where the work starts (greenfield, or an existing system — in which case route through `brownfield` first) and how far it goes (framing, floor, full chain). Detail lives in `method`.

**Run discovery in five question families, in order.**

1. **The real process.** How does it actually happen today — frictions, manual rework, waiting? Hunt the observed process, not the idealized one.
2. **The value.** Where is value created if this works? Time saved, errors avoided, quality raised, new service? Who benefits, how often?
3. **The success criterion.** What observable, measurable fact would say "it works" on real traffic? Reject impressions.
4. **The data.** What comes in, what goes out, from where, to where? Sensitive data, expected traceability.
5. **The hard constraints.** Sovereignty, regulated sector, legacy integration, confidentiality, mandatory human approval. These bound the solution space; tool preferences do not.

**Split floor from target.** The floor is the smallest system that proves value on real traffic — typically a single orchestrator, a model port, persistence, a few guardrails, baseline observability, nothing more without a trigger. The target is the full architecture you are heading toward — elaborate memory, multi-agent, externalized state, distribution, continuous evaluation. Name the target to set direction; do not build it up front. Every deferral is written down with the trigger that will reactivate it.

**Apply the upstream decision matrix.** For each structuring choice, record a lean default and the objective trigger that commands a switch. Apply the default; switch only on signal.

- **Topology**: default single agent; trigger — genuinely independent, parallelizable subtasks.
- **Memory**: default explicit per-turn context; trigger — a measured need for cross-session continuity.
- **State**: default in-memory, single instance; trigger — replication or cross-process sharing.
- **Process boundary**: default one process; trigger — a capability whose lifecycle, ecosystem, or scale truly differs.
- **Model tier**: default one balanced tier; trigger up — measured quality demands it; trigger down — deterministic tasks routed cheaper.
- **Determinism**: default — everything that can be deterministic (classification, validation, guardrails) leaves the model for testable code; the model only reasons.
- **Untrusted input and privilege**: default — retrieved content is data, never instruction; least privilege; human approval on sensitive actions. In regulated sectors this is a framing constraint, not a late add-on.

Lock any truly structuring decision through `decision-loop` before committing it to the note.

## Definition of Done

- Framing note produced: problem, value, observable success criterion, hard constraints — one page.
- Floor perimeter listed, every deferral named with its trigger.
- Presumed boundaries stated; language and topology explicitly left open.
- Note reviewed via `review` before circulation.

## Anti-patterns

- Deciding the stack during framing.
- Accepting a fuzzy success criterion — without it, the floor can never be proven.
- Padding the floor with untriggered features.
- Discovering a sovereignty or compliance constraint after the floor is built.
- Declaring the phase done without its artifact, silently.
