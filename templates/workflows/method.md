# Method — Orchestrate the Six Phases

## When to use

Use this workflow whenever an agentic-system mission needs to be planned, advanced, or unblocked: "where do we start?", "what do we do next?", "are we ready for the next step?". This is the conductor. It sequences six gated phases and delegates the detail of each to its dedicated workflow (`frame`, `architect`, `floor`, `iterate`, `govern`, `handover`, plus `brownfield` for non-greenfield entries). Every design decision inside any phase runs through `decision-loop`; every document that matters runs through `review`.

## Inputs

- A sponsor with a real business problem.
- Access to the process the system will serve.
- The workflow files of this framework.

## Procedure

**Hold the posture before any phase.** Three rules outrank every tooling preference. Mentor as much as engineer — listening outranks solving: understand the process as it actually runs, not as it is described. Prove with a running system, not a deck. Decide architecture before models: the model and the infrastructure are adapter choices, reversible, made behind stable ports. The principle underneath — the architecture constrains the model, never the reverse — opens the method; what carries it is the six phases, the **five architecture gestures** — boundaries before stack; isolate by contract and complexify on proof; take determinism out of the model; keep state explicit and memory governed; govern, trace and evaluate from day zero — and the decision matrix. These architecture gestures shape the system, and are not to be confused with the opening moves that start the mission (below).

**Open the chain with four opening moves, in order, with the sponsor** — the mission's opening ritual, distinct from the five architecture gestures above. Together with show-before-you-build, they form four opening moves plus a standing show-before-you-build discipline.

1. **Establish the entry mode.** Greenfield runs the chain below from the top. Anything else — resuming your own mission, joining a project in flight, auditing then rebuilding, or deriving a new system from an old one — goes through `brownfield` first, which reconstructs what is missing and re-enters the chain at the right phase. Never start on an existing system by instinct.
2. **Establish the stopping tier.** How far does this engagement go: framing only, an executable floor, or the full chain through handover? Present each tier with what it produces and what it demands. The sponsor decides. Never pick the stopping point for them.
3. **Derive the required inputs.** For framing: process access and an observable success criterion. For a proven floor: add real model access, real inputs, and a hook into existing infrastructure. For iteration and governance: sustained real traffic, traces, ground truth. For handover: a team to receive.
4. **Challenge the gaps.** A missing input does not automatically block the start; it becomes a named risk, owned by the sponsor, and usually the first object of discovery. Say it out loud — never route around it silently.

**Show before you build.** The standing companion to the four opening moves — repeated at every major gate, not a one-time step. Before committing work, show the sponsor a concrete preview of what they will receive: a sample deliverable, the artifact plan per phase, and — when the entry point is a user interface — an openable, working HTML first cut rather than a static mockup, functional even in deterministic mode. Repeat the preview at every major gate so the sponsor decides with open eyes.

**Run the six phases, each behind a gate.**

1. **Frame.** Light immersion in the real process. Output: the floor/target split and an observable success criterion. Delegate to `frame`.
2. **Architect.** Boundaries before stack: domain ports, model port, integration protocol. Language and topology stay open. Two visions live behind the same ports — the application domain (what the system does) and the execution topology (where, and under which sovereignty, each port's adapter runs); runward traces and governs both, deploys neither. Delegate to `architect`.
3. **Floor.** The smallest system that proves value on real traffic: one orchestrator, a model port, persistence, guardrails, baseline observability. Delegate to `floor`.
4. **Iterate.** Add complexity only on an objective trigger or a measured gain, one ADR per switch. Delegate to `iterate`.
5. **Govern.** Transversal, wired from day zero: single middleware chain, cost ceilings, human approval on sensitive actions, continuous evaluation. Delegate to `govern`.
6. **Handover.** Leave autonomy, not dependency. Done when the team repeats a task alone. Delegate to `handover`.

**Enforce the gate rule.** No phase closes without its prescribed artifact, and no gate is crossed without proof from the phase before it — value measured against the success criterion. Any deviation is stated explicitly and agreed with the sponsor, never assumed.

**Match each deliverable to its form.** What is presented to a committee has an expected delivery form (a readable PDF or HTML); what is maintained stays as repository markdown, versioned with the code.

## Definition of Done

- Entry mode and stopping tier chosen explicitly by the sponsor, gaps named as owned risks.
- A concrete preview shown before build and at each major gate.
- Each phase closed with its artifact, or the deviation recorded and agreed.
- No gate crossed without measured proof from the previous phase.

## Anti-patterns

- Starting with "which framework?" — that question belongs to an adapter decision, after boundaries. Return to phase 1.
- Choosing the entry point or the stopping tier on the sponsor's behalf.
- Building the full target in one block "to be serious about agents".
- Deferring governance to a later phase; retrofitting always costs more.
- Delivering a recommendation document instead of a running system.
- Leaving the sponsor blind until delivery instead of showing before building.
