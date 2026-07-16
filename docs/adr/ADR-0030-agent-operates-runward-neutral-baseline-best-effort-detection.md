# ADR-0030: the agent operates runward — neutral baseline, best-effort harness detection, machine-readable surface

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — grounded in a runtime-signal survey across 11 harnesses and a full CLI-operability audit, cross-read against the vendor-neutral and operator-installs invariants, challenged against the "just detect the harness and wire it" reflex, durable position

## Context

runward is installed and operated almost entirely by an AI agent, not by a human typing at a prompt. The honest test of the product is therefore: *can an agent discover runward, stand it up correctly, and run the whole chain with no human at the keyboard?* Three findings, each verified against the code, frame the answer.

1. **Harness detection cannot be the load-bearing mechanism.** Identifying the harness a CLI runs inside — without assuming its config files are already in the repo — depends on runtime signals (environment variables the harness injects into the child process). The survey found reliable signals for only Claude Code (`CLAUDECODE`, plus `CLAUDE_CODE_ENTRYPOINT`, which also covers Claude Cowork) and Gemini CLI (`GEMINI_CLI`); a usable-but-observed signal for Cursor (`CURSOR_TRACE_ID`); an unreliable one for Codex (`CODEX_SANDBOX`, present only in sandbox mode); and *nothing* for Copilot CLI, Windsurf, Kiro, Continue, Aider, and Trae. There is no cross-harness convention (no standard `AI_AGENT=1`). A detection-first design would silently privilege the two harnesses it can see.

2. **The universal baseline already carries agent operability.** `init` writes, unconditionally and before any tool profile, `AGENTS.md` and the vendor-neutral phase skills under `.agents/skills/` (`src/commands/init.ts:134,138`). These are the converged surfaces read by 14+ harnesses. From the end of `init`, `runward check` is fully runnable in any harness with no channel installed. A per-harness channel (a turn-end hook, the CI Action) only *triggers* that same `check` automatically; it adds no capability (confirmed against ADR-0028 and the packaging manifests, all of which invoke `runward check --strict` verbatim).

3. **The CLI is already ~95% agent-operable, with two real gaps.** Every command is non-interactive except `init`, whose prompts are guarded by `isNonInteractive()`. The gaps that actually bite an autonomous agent are (a) the interactive guard keyed on `stdout.isTTY` only, so an agent in an allocated pty without `--yes` can hang on `init`; and (b) the absence of `--json` on `check`/`status`/`doctor`, forcing the agent to parse coloured human text instead of a stable contract.

A fourth, pre-existing defect surfaced alongside: `init` defaults to the `claude` profile — `["claude"]` under `--yes`, pre-checked in the wizard (`init.ts:51,54`) — which contradicts the vendor-neutral invariant every other surface upholds.

## Decision

**The agent operates runward from a strictly neutral, machine-readable baseline; harness detection is a best-effort convenience layered on top, never a prerequisite, and it never installs anything itself.**

Four concrete positions:

- **Neutral baseline.** `init` with no explicit `--tools` writes only the vendor-neutral core (`AGENTS.md` + `.agents/skills/`) — under `--yes` the tool-profile list is empty, and the interactive wizard pre-checks nothing. No harness is privileged by default. A channel is an opt-in the operator (or the agent, on the operator's approval) adds afterward.
- **Detection is best-effort and read-only.** Where a runtime signal exists (Claude Code / Cowork, Gemini CLI, Cursor) or a config file is already present, runward may *recognise* the harness and *recommend* the matching channel — but recognition prints a suggestion, it never writes a hook, a `.git/` entry, or a settings file. Where no signal exists, runward says so plainly and asks; it does not guess. This preserves ADR-0012 ("the operator installs") exactly: detection informs, the operator's approved gesture wires.
- **Machine-readable surface.** `check` (and, over time, the other read paths) gains `--json`: a stable, deterministic contract carrying the verdict, current gate, deliverable states, and conformance gaps — so an agent drives on data, not on scraped text. The exit-code contract (0/1/2) is unchanged and remains the primary signal.
- **Hardened non-interactivity.** `isNonInteractive()` also returns true when `stdin` is not a TTY or when `CI` is set, so an autonomous run never hangs on a prompt it cannot answer.

Claude Cowork is treated as a member of the Claude family: same `.claude/` adapter, same `CLAUDECODE` runtime signal. It is named explicitly because it was verified to run the plugin to a green verdict, not assumed.

## Alternatives discarded

- **Detection-first (`init` auto-selects the profile for the detected harness).** Reliable for two harnesses, blind for six. It would dress a partial capability as a general one and privilege Claude/Gemini by accident — the opposite of the neutral invariant.
- **Ship a cross-harness marker and rely on it.** No such standard exists; inventing one runward-side helps nobody, since the harnesses would have to adopt it.
- **runward wires the channel once detected.** Violates ADR-0012. The write stays the operator's gesture; runward at most prints the exact command.
- **Full `--json` on every command in one move.** Deferred by need: `check --json` is the load-bearing one for autonomous operation; `status`/`doctor`/`manifest`/`compliance` follow as the driving loop demands them, additively, without breaking the text default.

## Consequences

- **Positive.** The agent-operability story becomes *true* rather than aspirational, and true without depending on a detection layer that can only ever be partial. The neutral default closes a standing vendor-neutrality breach. `check --json` gives the operating agent a contract to branch on. The framing — "runward runs in every harness through the baseline, and *suggests* automation where it can recognise the tool" — is both honest and stronger than "runward detects your tool."
- **Negative, accepted.** An agent in a harness with no runtime signal must be *told* which channel it is in (a one-line question), or it simply runs the baseline `check` itself. That is the correct degradation, not a failure. The best-effort detection surface (a `wire`/recommendation path) and the wider `--json` coverage are follow-on work, not shipped whole here.
- **On other boundaries.** Reinforces ADR-0012 (operator installs), ADR-0018 (vendor-neutral skills as the baseline), ADR-0028 (channels as convenience triggers of one exit-code port). No conflict; this ADR names the operating model those three imply.

## Reevaluation trigger (mandatory, dated)

Reopen if a cross-harness runtime convention for agent identity emerges (a standard environment marker adopted by more than two major harnesses), or if the autonomous driving loop needs a read path that has no `--json` yet — then extend detection and machine output accordingly, still without runward writing a channel itself.

**Trigger set on**: 2026-07-16 · **Watched via**: harness environment-variable documentation across versions, and the agent-operability audit rerun each minor release.

## References

- [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) — the operator-installs invariant this preserves.
- [ADR-0018](ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) — the vendor-neutral baseline this makes the default.
- [ADR-0028](ADR-0028-distributable-packagings-across-harness-channels.md) — the channels this reframes as convenience triggers of one port.
- The harness runtime-signal survey and CLI-operability audit (2026-07-16) — the two findings this rests on.
