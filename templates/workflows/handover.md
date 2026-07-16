# Handover — Leave Autonomy, Not Dependency

## When to use

Use this workflow when a delivery approaches its end or a team must become self-sufficient: "how do we hand this off?", "we need to document for the team", "how do they run this without us?". This is phase 6 of `method`. What the operator leaves behind counts as much as what was delivered: a deliverable that creates lasting dependency on its author is a failure of this phase.

## Inputs

- The artifacts of prior phases: architecture note, floor, ADR journal, threat model, evaluation rubric, observability schema.
- A receiving team with time allocated for transfer sessions.
- The `mission/runbook.md` and `mission/handover.md` templates.

## Outputs

- A handover kit (below).
- A demonstrated proof of autonomy.
- The hand-over note (`mission/handover.md`): the kit indexed, the redone-task proof recorded, the succession named, the provider-swap drill logged — the gated deliverable of this phase.

## Procedure

**Enforce the entry rule.** You transfer autonomy, not documents. Handover is not a folder delivered; it is proven by the team repeating a task alone. Until that proof exists, this phase is open.

**Assemble the handover kit.** Six components:

1. **Reusable assets.** The populated scaffold, the adapters, the versioned contract schemas, the evaluation sets. Things that replay and get reused, not just things that get read.
2. **The architecture note.** Boundaries, ports, integration protocol, the named target, and the default topology with its triggers. The map that says why the system is shaped this way.
3. **The ADR journal.** Every structuring decision locked in Context / Decision / Consequences form, with the discarded alternative and the reevaluation trigger. The team learns not only what was decided, but under which signal to reopen it.
4. **The operations runbook.** How to start, observe, debug, resume from a checkpoint, switch a model provider, rerun the evaluation bench, process a suspended approval. Operating gestures, not theory. Use `mission/runbook.md`.
5. **Proof in the code.** Unit and contract tests, evaluation scenarios, replayable traces — the demonstration that the principles are not speculative; they live in the code.
6. **The agent charter (`AGENTS.md`), finalized as the leave-behind.** The `AGENTS.md` written at `init` becomes the receiving team's charter, in the standard format every harness already reads (Codex, Copilot, Cursor, Gemini, Amp, and Claude Code via `@AGENTS.md`): the craft rules that govern the system, the **judgment boundaries** (what the operator decides versus what an agent may do), the verification commands (including `runward check --strict`), and the never/PR rules. Finalize it so any harness the team later adopts is productive from day one — the leave-behind is portable, not tied to your tool.

**Run the transfer, don't just deliver it.**

1. **Transfer sessions.** Walk the team through the architecture, the decisions, and the runbook — hands on the keyboard, not eyes on slides. Make them operate, not watch.
2. **Readable notes.** Short, decided, accessible to whoever inherits the system.
3. **Progressive withdrawal.** The team repeats a task first with you present, then alone. Step back as autonomy is proven, not on a calendar date.

**Capitalize upward.** What repeats deserves standardizing. Escalate recurring patterns to whoever can industrialize them: an evolution trigger observed several times, an adapter rewritten identically across missions, a recurring guardrail. Feed proven arbitrations back into the decision matrix and the workflow files — the corpus hardens mission after mission. What gets capitalized is never the prototype (replaceable); it is the architecture and the method (owned).

**Record the succession in the hand-over note.** Fill `mission/handover.md` as the succession happens: the kit index with honest states, the redone-task proof (task, date, doer, evidence, gaps folded back), the named owner with escalation path and review cadence, the provider-swap drill. Confront the CRITICAL/HIGH rules mapped to the handover phase (`runward/rules/`, `phases: [handover]`) and account for each in the note's `Rule conformance` manifest — `runward check --strict` verifies it, down to the typed evidence pointers.

**Verify the Definition of Done explicitly.** The phase is done when the receiving team redoes a task alone, end to end, demonstrated — a sign-off or a training session does not count. The team, without you: starts the system, observes it, debugs an incident, adds an evaluation scenario, and decides a switch by leaning on the ADRs. All of it demonstrated, not promised — and recorded in the hand-over note, where the gate reads it.

## Definition of Done

- Handover kit complete: assets, architecture note, ADR journal, runbook, proof in code, and the finalized `AGENTS.md` charter (the harness-neutral leave-behind).
- Hand-over note produced (`mission/handover.md`): kit indexed, redone-task proof recorded, succession named, provider-swap drill logged.
- Every handover CRITICAL/HIGH rule accounted for in the note's conformance manifest (`runward check --strict`).
- Transfer sessions held with the team operating, not observing.
- The team has repeated at least one real task end to end, alone — demonstrated, witnessed, recorded.
- Recurring patterns escalated and fed back into the framework's templates.
- Deliverable form matched: presented notes carry an expected delivery form (a readable PDF or HTML); ADR journal, runbook and code proofs stay as repository markdown.

## Anti-patterns

- Creating lasting dependency on the operator — if the team can do nothing without them, handover failed.
- Handing over only the prototype: the prototype is replaceable; the architecture and method are what transfer.
- Delivering a document without walking it through — a note handed over is not a skill transferred.
- Closing the phase on a signed deliverable instead of a task repeated alone.
- Keeping recurring patterns to yourself instead of feeding them back.
- Padding the kit with theory the team will never operate from — runbooks carry gestures, not lectures.
