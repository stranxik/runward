# ADR-0033: `runward status` reports a mission's real lifecycle position — its state and which decisions to reopen

**Date**: 2026-07-20
**Status**: accepted (ratified 2026-07-29 — see Ratification)
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — a multi-agent audit of the resume-existing / brownfield capability found that `status`, the transmission surface a returning operator reads first, misreports a mission that has passed handover. Reality-checked against the real code (`src/lib/mission.ts`, `src/commands/status.ts`) and reproduced on runward's own dogfooding mission; sourced against the build/run (ITIL/SRE) steady-state distinction and runward's own doctrine (`iterate` as a continuous phase, the mandatory dated reopening trigger every ADR carries).

## Context

`runward status` is the read-only "where the mission stands" a receiving team, or a returning operator (brownfield mode **M1 — resume your own mission**), reads first. On a mission that has passed all gates and entered continuous improvement, that first screen lies, and it lies in the exact situation resume-existing exists to serve: coming back to a delivered, still-living mission.

Observed in the real code, not imagined:

1. **The mission is a one-way arc that terminates at handover.** `analyze()` (`src/lib/mission.ts:147`) sets `currentPhase` to the *first incomplete* phase across a fixed linear list `frame → architect → floor → govern → handover`; `status.ts:31` stamps `← you are here` on it. There is no state for "all gates passed, now iterating." `iterate` — a first-class workflow (`paths.ts:37`, `method.md` phase 4: "add complexity only on an objective trigger … one ADR per switch") and the steady-state where every delivered system lives — appears nowhere in `PHASES`.

2. **Reproduced on runward's own mission** (`node dist/cli.js status`): `Current gate → all gates passed`, `Next → Run runward check --strict … then runward compliance <regime>`. runward is in an active iterate loop (32 product ADRs, roadmap grooming, continuous commits), but `status` freezes it at the moment handover completed and points forward to a gate already crossed. It says nothing about the real open question a returning operator has: **which locked decision should reopen, and on what signal.**

3. **The reopening signal is already a firm, parsable convention, and nothing reads it.** Every ADR carries a mandatory `## Reevaluation trigger` section and a `**Trigger set on**: YYYY-MM-DD` line (the `ADR-0000` template mandates it; 33/33 shipped ADRs conform). This is the encoded answer to "what would make me reopen this decision" — the mission's real backlog once it is in steady-state. `status` never parses it, so "which decision aged / should reopen" is a manual grep of the whole corpus.

4. **`characterize` and `status` do not route between M-modes.** `characterize` (raw code, no `runward/`) and `status` (a governed mission exists) are the two entry points, but neither points at the other: a returning operator on a governed repo gets no nudge toward `status` (M1), and `characterize`'s next-steps never mention it.

Hard constraints: `status` is the transmission surface, so it stays **read-only, deterministic, zero-LLM** (the contract that governs `characterize`, ADR-0014) and it **never moves a gate** — the operator owns the gate (ADR-0001). The decision is taken at the mission-reading boundary (`src/lib/mission.ts`), consumed by the presentation boundary (`src/commands/status.ts`).

## Decision

**`runward status` reports a mission's real lifecycle position: its state (`ÉTAT`), and which locked decisions are due to reopen (`À ROUVRIR`) — as a faithful, deterministic parse of the mission files, never a one-way arc that ends at handover.**

Three moves, all pure parsing of formats already normed, read-only, zero-LLM:

1. **A named steady-state (ÉTAT).** `analyze()` already computes `currentIndex === -1` (every gated deliverable filled). `status` stops rendering this as a finish line and names it the **iterate steady-state**: the gated arc is complete; the mission now advances by locking one ADR per structural switch, on an objective reevaluation trigger. `Next` stops presenting `check --strict` + `compliance` as the forward milestone (that arc is crossed and stays re-runnable, not pending) and instead names the iterate posture, with the evidence gate named as available any time. The `← you are here` marker never claims unfinished linear progress on a mission whose gates are all filled.

2. **Which decisions to reopen (À ROUVRIR).** `status` parses the accepted ADRs' `## Reevaluation trigger` section and `**Trigger set on**` date and surfaces a compact "reopening watch": each decision, the date its trigger was set, and the (verbatim, untruncated-enough) trigger text. It **presents**; it never decides a trigger has fired — the operator judges. Deterministic (sorted, byte-stable), read-only, no model call. This is the block that turns "reread 84 ADRs" into a glance, and it is the real backlog of a steady-state mission.

3. **M-mode routing (aiguillage).** When `characterize` runs on a repo that already has a governed mission (`runward/framing.md` exists), it prints that this is M1 and to run `runward status`. Symmetrically, `status`'s "no mission found" error names `characterize` for a raw codebase. A fact (`existsSync`) picks the mode, never instinct — exactly the brownfield rule "re-enter at the right phase, never by instinct."

**Explicitly out of scope**, named so they are not silently dropped:
- **Reading a `JOURNAL.md` for a free-text `Next:` / `Blocked` backlog.** `JOURNAL.md` is *not* a runward primitive (not in `MISSION_LAYOUT`, not template-mandated — the "journal" in the doctrine is the *decision* journal, i.e. the ADR dir). Surfacing it would mean inventing a convention; the faithful, already-normed backlog of a governed mission is `À ROUVRIR` above. If a durable journal convention is later adopted, that is its own decision.
- **The partially-filled-but-shipped case** (a downstream gate the fill-heuristic marks incomplete though v1 shipped) — needs a deterministic "delivered" signal; its own decision.
- **A separate `resume` command.** For now the enriched `status` *is* the M1 gesture; extracting a `resume` verb that shares a mission-reading primitive is deferred (see trigger).

## Alternatives discarded

- **Add `iterate` as a sixth gated phase in `PHASES`.** Rejected: `iterate` has no deliverable that is "filled once and done" — it is a recurring posture (one ADR per switch, indefinitely). As a gate it would either never complete (permanent red on every mature mission) or complete falsely. The steady-state is a *mode entered after the arc*, not a rung on it.
- **Infer "delivered/reopened" from file mtimes.** Rejected: mtimes are noisy and non-reproducible across clones — a determinism smell. `currentIndex === -1` is exact and already computed; `À ROUVRIR` reads ADR *content* (dated trigger lines), not timestamps.
- **Let an LLM summarise the real position.** Rejected: `status` is deterministic and zero-LLM by contract (ADR-0014, ADR-0001). The position must be a reproducible parse of the files, never a generated narrative.
- **Rank / flag which trigger has "probably fired".** Rejected as an overclaim: judging a trigger reached is interpretation, which would put `status` on the operator-owns-the-gate line. `status` surfaces the triggers verbatim; the operator decides. (Same discipline the audit imposed on borrowing Aider's repo-map: expose facts, never a ranking.)
- **Leave `status` as is and document the caveat.** Rejected: the transmission surface lying to a returning operator is the precise failure resume-existing exists to prevent. An accepted framework whose own `status` misreports its own mission is the doc↔code drift runward's doctrine condemns.

## Consequences

- **Positive.** The first transmission screen tells the truth on the most common resume case. `Next` names the iterate posture instead of an already-crossed gate. `À ROUVRIR` makes "which decision should reopen" a glance instead of a corpus grep — directly serving M1. The `characterize`/`status` aiguillage removes the "which mode am I in" guess. All three respect read-only / deterministic / zero-LLM / operator-owns-the-gate by construction.
- **Negative, accepted.** `status` gains conditional prose (steady-state vs in-delivery) and a new section (`À ROUVRIR`), a marginal rise in surface. The reopening watch lists triggers but never judges them fired — an honest under-statement, never an overclaim. On a mission with many ADRs the watch is long; it is sorted and can be capped with an explicit "+N more" (never silently truncated).
- **On other boundaries.** No change to the gate (`check`), to `compliance`, to determinism, or to the zero-LLM contract — `status` stays a read-only projection. `analyze()` grows an explicit steady-state flag and (optionally) a parsed-triggers list; any future consumer (e.g. a `resume` command) reads the same signal, so they never diverge. No ADR superseded; ADR-0013 (transmission) and ADR-0014 (the read-only/deterministic contract) are reinforced, not touched.

## Ratification — 2026-07-29

Ratified by the maintainer. This ADR is the inverse of the drift runward's own doctrine condemns: the decision shipped *before* its status caught up — the three moves have lived on `main`, under test, while the ADR sat at `proposed`. Ratifying it closes that doc↔code gap on the framework's own mission.

Delivered and in force, with the evidence:

- **ÉTAT — the named steady-state.** `analyze()` returns an explicit `steadyState` flag (`file:src/lib/mission.ts#analyze`); `status` renders the iterate posture instead of a finish line — the `iterate — steady-state` label, the `Iterate — continuous improvement ← you are here` marker, the steady-state `Next` (`file:src/commands/status.ts#statusCommand`). Proof: `test:test/smoke.js` ("status names the iterate steady-state"; "the real 'you are here' is the iterate posture") and `test:test/unit/mission.test.js` ("analyze names the steady-state explicitly: false while any gated phase is incomplete").
- **À ROUVRIR — the reopening watch.** `readReopeningTriggers()` parses each accepted ADR's `## Reevaluation trigger` + `**Trigger set on**` deterministically, presents them verbatim (bounded), and names accepted ADRs missing the section rather than counting them (`file:src/lib/mission.ts#readReopeningTriggers`; rendered under "Reopening watch" in `file:src/commands/status.ts`). Proof: `test:test/unit/mission.test.js` (nine cases, incl. byte-stable sort across ADRs, `missingSection` fail-honest, and the `**Trigger set on**` line never taken as preview prose) and `test:test/smoke.js` ("the Reopening watch renders on a mission with accepted ADRs").
- **Aiguillage M-mode.** `characterize` on a repo that already has `runward/framing.md` prints "Already a governed mission (M1)" and routes to `runward status` (`file:src/commands/characterize.ts`); symmetrically `status`'s no-mission path names `characterize`.

Invariants held: read-only, deterministic, zero-LLM, gate never moved — no change to `check`, `compliance`, or the exit-code contract.

**Scope note, honest.** Flipping this ADR to `accepted` in `docs/adr/` does not change `runward status` output: the reopening watch reads the *mission's* decision journal (`runward/adr/`), not the product ADRs. This ratification is a governance act closing the drift, not a behavioural change.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) a `resume` command is introduced and the steady-state + `À ROUVRIR` signals must move from `status`-presentation into a shared mission-reading primitive both commands consume; (b) a durable `JOURNAL.md`/backlog convention is adopted, making the free-text `RESTE` volet groundable rather than invented; or (c) real missions show `currentIndex === -1` is too coarse a steady-state signal — e.g. a mission legitimately sits at all-gates-passed while still in first delivery, making the "iterating" label wrong.

**Trigger set on**: 2026-07-20 · **Watched via**: the resume-existing audit follow-ups (a `resume` command, the delivered-signal decision) and dogfooding `runward status` on runward and Dropyour.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — operator-owns-the-gate / the deterministic gate `status` stays read-only against.
- [ADR-0013](ADR-0013-retro-documentation-as-transmission-pointed-backward.md) — the transmission phase; `status` is its live counterpart.
- [ADR-0014](ADR-0014-the-characterize-command-contract.md) — the read-only / deterministic / zero-LLM command contract this mirrors.
- `src/lib/mission.ts` (`analyze`, `PHASES`), `src/commands/status.ts` — the mission-reading and presentation boundaries edited.
- `templates/workflows/method.md` (phase 4 `iterate`), `templates/workflows/brownfield.md` (M1), `runward/adr/ADR-0000-template.md` (the mandatory dated reopening trigger `À ROUVRIR` parses) — the doctrine this brings `status` into line with.
- The resume-existing / brownfield audit (2026-07-20): the multi-agent investigation that surfaced the finding.
