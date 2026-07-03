# Brownfield — Enter a Mission That Already Has a Past

## When to use

Use this workflow whenever the mission does not start on green grass: "resume the mission in progress", "we inherited a half-built project", "this system ignores our principles, audit it", "rebuild a clean one from the old one", "where were we?". The default chain in `method` starts from framing on greenfield; most real missions start elsewhere. Establish the entry point with the sponsor, reconstruct what is missing, then re-enter the chain at the right phase — never by instinct.

## Inputs

- Access to the existing system: code, deployments, data, and whatever artifacts exist.
- The sponsor's intent: resume, join, rebuild, or derive.
- The framework's templates for retrofitted artifacts (`mission/framing.md`, `mission/architecture.md`, `mission/adr/`).

## Outputs

- The entry mode identified and agreed.
- The missing upstream artifacts reconstructed.
- Re-entry into the `method` chain at the correct phase.

## Procedure

**Enforce the entry rule.** Characterize before you touch; never rewrite in one block. On an existing system the first move is not to propose a target — it is to understand what is there, what works, and why it is the way it is. Value is reconquered tier by tier, exactly as on greenfield; a mass rewrite destroys the value already in place and postpones all proof.

**Identify the entry mode.** Four modes; when they overlap, calibrate on the most demanding one.

- **M1 — Resume your own mission.** Artifacts exist: framing note, ADRs, journal, code. Opening move: reread them, rebuild the state, locate the phase reached, spot what has aged, and pick the chain back up where it stopped. The state of a mission is its persisted artifacts, never anyone's memory.
- **M2 — Join a project in flight.** The project exists, usually without (or with partial) upstream artifacts. Opening move: inventory the existing system, then produce the missing upstream deliverables — a light retro-framing, an architecture note reconstituted by observation, and retroactive ADRs that record the structuring choices already made and the signal under which to reopen them. With the map drawn, enter the chain at the current tier.
- **M3 — Audit then rebuild.** The system was not built on these principles. Opening move: a principled audit, a gap analysis section by section, then a rebuild plan. The rebuild is never one block; it follows the brownfield procedure below.
- **M4 — Derive a new system from an old one.** The existing system is an input and a legacy constraint, not a base to copy. Opening move: frame the new system using the old one as a source of requirements and constraints, then enter the chain as greenfield from `frame`.

**Apply the brownfield procedure (M3 and M4).** On legacy, the boundary is not given and is never free — integration cost concentrates exactly there. Three moves, in order, never skipped:

1. **Characterize before touching.** Capture the real behavior of the existing system, quirks included, with characterization tests before any modification. Find the seams — the points where behavior can be altered without rewriting. Until behavior is captured, do not rebuild: you would silently break what worked.
2. **Install an anticorruption layer.** An adapter at the boundary translates the legacy dialect into the clean domain language and stops the old model from contaminating the new. The new domain stays pure behind that boundary.
3. **Replace progressively, strangler-style.** Build the new around the old, unplug it feature by feature on proof, until the old retires naturally. Never a single-shot cutover. Each replacement is guarded, measured, and reversible behind the boundary.

**Lock and re-enter.** Every structuring choice discovered or taken on the existing system — what is kept, what is rebuilt, where the anticorruption boundary runs — is locked as an ADR via `decision-loop`, retroactive ADRs included. Then re-enter the `method` chain at the right phase: usually `architect` for M2 and M3, `frame` for M4, the current phase for M1. Governance, iteration, and handover proceed unchanged.

## Definition of Done

- Entry mode chosen explicitly with the sponsor.
- Missing upstream artifacts produced (retro-framing, reconstituted architecture note, retroactive ADRs).
- For rebuilds: behavior characterized, anticorruption layer in place, replacement plan staged feature by feature.
- Chain re-entered at a named phase, with the same gates as greenfield.

## Anti-patterns

- Rewriting in one block — the mass cutover is forbidden.
- Modifying behavior that has not been captured.
- Confusing audit with rebuild: the audit establishes the gap, factual and sourced; the rebuild is a separate, guarded, progressive decision.
- Resuming a mission from memory instead of its artifacts.
- Pretending the boundary is free on legacy — name the translation cost and budget it.
- Copying the old system instead of treating it as requirements and constraints.
