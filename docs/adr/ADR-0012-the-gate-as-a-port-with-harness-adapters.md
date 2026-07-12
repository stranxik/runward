# ADR-0012: The gate as a port, with harness adapters

**Date**: 2026-07-09
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — 2026 ecosystem veille (P0), filtered through the FDE angle, challenged against the never-a-runtime invariant, durable position

## Context

The deterministic gate (`runward check`, and `--strict` for rule conformance) already exposes a stable, minimal contract: an **exit code** — `0` current gate clean, `1` gaps, `2` no mission found — and a human-readable report on stdout. That is a port in the ADR-0011 sense: a versioned, additive boundary whose implementation (the zero-LLM audit) can change behind a fixed shape.

What the ecosystem veille surfaced (P0) is that nothing makes the gate **run at the moment it matters**. Every harness a team actually uses has a lifecycle seam — git has `pre-commit`/`pre-push`, CI has a required-check step, Claude Code has `Stop`/`PostToolUse` hooks — but runward ships no wiring for any of them. So the gate runs only when a human remembers to type it. This is exactly the shape of the incident that opened this whole line of work: an agent finished a turn, the gate was never invoked, and nothing surfaced the gap. A gate that is not called is not a gate.

The trap is obvious and must be named up front: the cure for "the gate doesn't run automatically" is *not* for runward to become the thing that runs it. A daemon, a file-watcher, a runward-managed hook runtime, or silent installation into `.git/hooks/` would each turn runward from a frame into a runtime — the one thing the doctrine forbids it to become.

## Decision

Treat the gate as a **port** and ship **harness adapters** as inert, copy-in leave-behinds under `runward/adapters/`. Each adapter is a thin shim that invokes `runward check` at its harness's natural lifecycle point and translates the exit code into that harness's convention. runward emits them; the **operator wires them**. Four files, one per surface plus its contract:

- `README.md` — pins the **port contract** (the exit codes, as a versioned boundary) and documents how to activate each adapter, with the explicit posture that runward never installs or activates any of them for you.
- `pre-commit` — a git hook sample that runs the gate and blocks the commit on a non-zero exit. The operator copies it into `.git/hooks/` or points `core.hooksPath` at it.
- `github-actions.yml` — a CI job sample that runs `npx runward check --strict` as a required check — the audit-evidence seam for a regulated pipeline.
- `claude-code-settings.json` — a `.claude/settings.json` `Stop`-hook snippet that runs the gate when the agent finishes a turn, surfacing the verdict in the loop. It is the **first shipped example** of a per-harness turn-end hook, not a privileged one: any harness that can run a command at turn-end wires the same one line, and where none exists the git and CI adapters already cover any agent.

The discipline that keeps this from crossing the line:

- **Inert until the operator wires them.** Adapters are sample text under `runward/adapters/`. Nothing executes on `init`, on clone, or on `check`. runward writes no file into `.git/`, edits no `.claude/settings.json`, registers no CI. Same opt-in trust posture as ADR-0008 — but stronger, because runward does not even run these; it hands them over.
- **The gate is unchanged.** Adapters only *call* `runward check`. The audit stays deterministic, zero-LLM, zero-run (ADR-0001); no adapter adds gate logic or influences the verdict. The exit code they read is the same one a human reads.
- **Vendor-neutral by construction.** The port contract is the exit code and nothing else. Each adapter is its harness's own idiom; no harness is privileged, and a new one is a new sample file, not a core change. The adapter set grows additively, like a port (ADR-0011).
- **Runward invokes runward.** Unlike the ADR-0008 hooks — which run the *operator's* arbitrary shell — the command inside every adapter is runward's own deterministic gate, fixed and safe. The adapters carry no third-party command surface of their own.

Adapters are runward-owned templates, so they are treated like `workflows/` and `rules/`: emitted by `init`, refreshed by `update`, verified by `doctor`. They are never mission state and `update` may overwrite them.

## Amendment (2026-07-12)

`AGENTS.md` now directs the operating agent to proactively **offer** to wire the gate at the harness seam (git `pre-commit`, a CI required check, or a turn-end hook, from the inert `runward/adapters/` samples), acting **only on the operator's explicit approval** and never silently. This does not weaken the invariant: runward still installs nothing and writes nothing into `.git/`. It operationalizes "the operator wires them" for an agentic workflow — the operator's wiring gesture, agent-assisted and approval-gated. The rejected "auto-install on `init`" (below) stays rejected; the difference is **consent**: the agent proposes and the operator decides, versus runward acting without the operator's act.

## Alternatives discarded

- **A runward daemon / file-watcher that runs the gate itself.** Turns the frame into a runtime; violates the founding invariant. Rejected outright.
- **Auto-install the git hook into `.git/hooks/` (or edit `.claude/settings.json`) on `init`.** Surprise execution wired into a repo without the operator's act; the ADR-0008 foot-gun, one level deeper. Rejected on the same security grounds.
- **Only document the exit codes, ship no adapters.** Leaves every team to re-derive the same three shims; the P0 gap stays open in practice. Transmission-as-deliverable means shipping the wiring, not describing it.
- **Fold the adapters into the tool profiles (`tools.ts`).** Couples gate-invocation with instruction-pointer emission, and git/CI are not tool profiles. Keeping adapters as harness-agnostic samples in one place is more honest and easier to extend.

## Consequences

- **Positive.** The gate runs where and when it matters, in each team's existing harness, with no new runward surface at runtime. The opening incident is closed at its root by the **agent-agnostic** seams — the git `pre-commit` and CI adapters gate whatever agent produced the code (Codex, Claude, Cursor, Copilot, Gemini); a per-harness turn-end hook (Claude Code's `Stop` is the first example) adds the same check in the loop where a harness exposes one. The CI adapter is the EU AI Act audit-evidence seam. The set extends additively.
- **Negative, accepted.** The adapters are samples the operator must wire; an un-wired adapter does nothing (by design). Documented as such in the adapters README, with the same "enable only in repos you trust" posture as ADR-0008.
- **On other boundaries.** A new `runward/adapters/` directory (emitted, updated, doctored like workflows/rules); the deterministic audit, its exit-code contract, and the zero-LLM invariant are untouched.

## Reevaluation trigger (mandatory, dated)

Reopen if a harness the community actually uses cannot be wired by a static sample — i.e. if wiring it would require runward to run, watch, or install something itself. At that point, re-examine whether a thin adapter *library* (still invoked by the harness, never a daemon) is warranted, rather than expanding runward's runtime surface.

**Trigger set on**: 2026-07-09 · **Watched via**: adapter-request issues and the ecosystem veille on harness lifecycle seams.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the deterministic gate whose exit code is the port contract.
- [ADR-0008](ADR-0008-opt-in-hook-seam-around-check.md) — the opt-in trust posture the adapters inherit and strengthen.
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) — the versioned-port framing applied here to the gate itself.
- `templates/adapters/`, `src/commands/init.ts`, `src/commands/update.ts`, `src/commands/doctor.ts` — the surfaces this ADR touches.
