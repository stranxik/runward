# ADR-0065 — The gate can be armed, only by the operator's hand

**Date**: 2026-09-02
**Status**: accepted 2026-09-03 (ratified by the maintainer on the 2026-09-02 investigation's measurements, unamended)
**Deciders**: Thibault Souris (maintainer)
**Method**: measured on the author's own harness transcripts and repository history (2026-09-02,
fully replayable — method stated inline per number), then checked against current harness
documentation, sourced. Amends [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md).

## Context

ADR-0012 welded two statements together. **(a)** runward is never a runtime: no daemon, no watcher,
no silent installation — the cure for "the gate doesn't run automatically" is not for runward to
become the thing that runs it. **(b)** Therefore every shipped adapter is inert sample text, and the
shipped end-of-turn hook is advisory: `templates/adapters/claude-code-settings.json` and the
`runward-gate` plugin both end their command in `|| true`, with the stated purpose of "surfacing the
verdict in the loop". (a) is doctrine, restated as the consolidated boundary in
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md). (b) was presented as its consequence.
The measurement below shows (b) is neither a consequence of (a) nor a protection anyone has enjoyed.

**The armed tier has zero hours of flight — as execution, not as configuration.** The only armed
end-of-turn hook in existence is the author's own `.claude/hooks/runward-gate.sh` (exit 2 on a red
gate, refusal on stderr), installed on 2026-08-27 (method: `git log --format='%h %ad' --
.claude/settings.json .claude/hooks/`, commit `4457bce`). Every Stop-hook execution leaves a
`stop_hook_summary` event in the harness transcripts; grepping all 1,460 transcript files under
`~/.claude/projects` for the hook's path finds **zero events**. Not zero refusals over N passes:
zero passes. The cause is measured, not guessed: `~/.claude/history.jsonl` filtered on this
repository's path shows the last session whose working directory fell inside the hook's perimeter
on **2026-07-21** — before the hook existed. The author's workflow (orchestration from a sibling
repository, edits in `/tmp` worktrees) never ends a turn where the hook listens.

**Meanwhile the work went around it.** Since the installation, the repository received **67
commits** (`git log --since='2026-08-27 15:06'`), all produced from sessions outside the perimeter.
The only blocking tier that judged that work is CI: 47 runs of the workflow carrying
`check --strict`, 1 red caught (`gh run list`).

**The advisory tier delivered nothing to the agent.** The shipped `|| true` tier ran **1,668**
end-of-turn executions across the author's other projects (jq aggregation of `stop_hook_summary`
events in the transcripts): `preventedContinuation` false 1,668/1,668, `hookAdditionalContext`
empty **1,668/1,668**. In six weeks, not one verdict entered the agent's loop. Worse: 755 of those
executions ran in a directory holding no mission at all — exit 2, "no mission found", swallowed by
`|| true`, invisible. ADR-0012's sentence about the Claude Code sample, "surfacing the verdict in
the loop", is true of the intention and false of the delivery: as shipped, nothing reaches the
model. One nuance stands: the git `pre-commit` and CI adapters DO block (a non-zero exit refuses
the commit, fails the check). What has never shipped blocking is the end-of-turn tier specifically.

**(a) does not imply (b) — the proof is by construction, in this repository.** The author's hook is
62 lines of bash that block a turn without crossing any line of ADR-0054: same port (the exit code,
ADR-0012's own contract), the HARNESS blocks, runward only renders the verdict. Its four inventions
are the failsafes an armed tier needs: block once, then release with a dated line appended to a
committed file (the bypass exists only as a readable diff); show the refusal lines, not the tail of
the output; fail open on infrastructure (no payload, no mission, missing binary), never on a
verdict; no silent escape hatch anywhere.

**The harness landscape has moved under the "no" column.** `packaging/README.md`'s capability table
(verified "July 2026") says most harnesses cannot block end-of-turn. Measured against current
documentation (2026-09): **six of the nine** families `init --tools` targets now document an
end-of-turn refusal whose reason returns into the model's context — Claude Code (exit 2 / deny),
Copilot CLI and cloud agent (`decision: block`, native cap of 8 consecutive blocks), Gemini CLI
(`decision: deny` plus `stop_hook_active`), Kiro CLI (`decision: block`), Junie CLI (Stop, exit 2)—
and Cursor offers a re-prompt tier (`followup_message`, with `loop_count` as guard). The loop guard
the author had to hand-build is now native in three of them. The "no" in the table describes the
files runward ships, not the harnesses.

## Decision

**1. (a) stands, untouched.** runward never runs, watches, or holds the harness; nothing executes
on `init`, clone, or `check`; the verdict path stays deterministic and offline (ADR-0054). This ADR
spends none of that.

**2. The weld is cut.** "Never a runtime" no longer implies "never ships a blocking tier". Blocking
at end-of-turn is the harness's act upon runward's exit code — the exact port ADR-0012 defined. What
ADR-0012's amendment already allowed the agent to OFFER, this ADR lets the operator DO with the
product's help, under conditions that make self-arming by an agent structurally impossible.

**3. `runward wire --install [--armed]` — the operator's installing gesture, mediated:**

- **Explicit opt-in, interactive only.** Refuses without a TTY, and refuses when an agent runtime
  signal (the existing `RUNTIME_SIGNALS` table in `harness.ts`) is present in the environment. The
  global `--yes` does not lift this refusal. An agent can propose the command; it can never run it
  to completion. This is the mechanical form of "the operator owns the gate".
- **The file is shown before it is written.** Full content for a new file, a unified diff for a
  merge into an existing settings file (never clobbering a foreign hooks array; an existing runward
  entry means "already wired, nothing to do"). Confirmation defaults to No; `--dry-run` stops at
  the preview. Never silent — the ADR-0012 amendment's consent rule, now enforced by the tool
  instead of the charter alone.
- **Honest tier per channel**, from the measured matrix: where a harness cannot block end-of-turn,
  `--armed` says so and offers the tiers that exist (Cursor: a re-prompt loop, labeled as such;
  Windsurf: refused with the honest line, pre-commit/CI offered instead).
- **One engine, `runward gate-hook --harness <id>`**, instead of N diverging shell scripts: reads
  the harness payload on stdin, runs `check --strict`, and on red emits that harness's NATIVE
  refusal (exit 2 + stderr, or the documented `decision: block|deny` JSON). It blocks **once**,
  using the harness's native loop guard, then releases and appends a dated line to a committed
  `runward/gate-bypass.log`. It fails open on infrastructure, never on a verdict. It transports an
  exit code; it interprets nothing — no new gate logic, no LLM, no network.
- **The act is journaled and symmetric.** A dated line in a committed `runward/adapters/`
  install log; a version marker in the written file so `update` refreshes and `doctor` flags drift;
  `wire --uninstall` removes and journals.
- **The contract is revised, not broken silently**: `wire --json` moves to `schemaVersion: 2`, and
  the machine-checked invariant `wires: false` (harness.ts:41) becomes
  `wires: "explicit-install-only"` — runward installs only under the operator's hand, in an
  interactive session, file shown before writing, act journaled.

**4. The advisory tier stops overstating itself.** Either the shipped samples are corrected so the
verdict actually reaches the agent where the harness supports it (the additional-context channel —
0/1,668 today), or the words "surfacing the verdict in the loop" are withdrawn everywhere they
appear. One or the other, verified by the same transcript measurement, not asserted.

## Alternatives discarded

- **Keep (b) as is.** The measurement says the only enforcement anyone experiences is CI, while the
  shipped end-of-turn sample claims a feedback loop that delivered 0 of 1,668. Keeping (b) means
  keeping a documented falsehood in the product's own ADR journal.
- **Ship the armed tier as the default.** Zero hours of real flight on the armed path (the
  denominator above is null, not small). Flipping a default on an unmeasured mechanism is how
  foot-guns ship. The numbers authorize an option; they do not authorize a default.
- **Auto-arm on `init` when a harness is detected.** ADR-0012's rejected alternative, still
  rejected: surprise execution wired into a repository without the operator's act.
- **A runward daemon or watcher that enforces.** Still the founding violation; rejected outright,
  again.
- **Per-harness bespoke scripts instead of one `gate-hook` engine.** Six shell dialects drifting
  independently; the author's prototype already shows the whole per-harness delta is the refusal's
  output format, which is a table, not six programs.

## Consequences

- **Positive.** The gap this measurement exposed — the strictest tier existing only as
  configuration — becomes closable by any operator at the price of one confirmed command. The
  failsafes are not designed fresh; they are the prototype's, which are the conservative ones
  (block once, bypass visible only in a diff). Six harness families get a real armed tier;
  three get an honest refusal instead of a false promise.
- **Negative, accepted.** `wire` gains a write path: the flat invariant "wire never writes" becomes
  the narrower "wire writes only under the operator's confirmed, interactive, journaled hand" —
  more surface to test (TTY refusal, runtime-signal refusal, preview-before-write, atomic write
  with post-write probe and rollback). A simpler invariant is traded for a truer one.
- **On other boundaries.** The verdict path is untouched. `gate-hook` adds no gate logic. MCP stays
  a discovery boundary (ADR-0029). The packaging capability table must be re-verified and dated,
  since this ADR's context shows it two months stale.

## What would settle it

The armed tier accumulating real executions — the author opening sessions inside his own perimeter,
or the ADR-0052 pilot activating it — and the counters that are unmeasurable today becoming
measurable: refusals, spontaneous agent corrections, human interventions, false blocks. The method
is written and replayable: `stop_hook_summary` events with `preventedContinuation` in
`~/.claude/projects/**/*.jsonl`, `history.jsonl` for the perimeter, `gate-bypass.log` for traced
releases, `gh run list` for the CI floor. The decision is settled the day the denominator stops
being zero and the false-block rate is known.

## Reevaluation trigger (mandatory, dated)

Reopen if the first twenty real armed executions show false blocks the block-once release does not
absorb (the tier then costs more than it protects), or if a harness the community uses cannot be
armed through a static file plus `gate-hook` — i.e. arming it would require runward to run, watch,
or install something itself, which is ADR-0012's original trigger, inherited.

**Trigger set on**: 2026-09-02 · **Watched via**: `runward/gate-bypass.log` diffs, the transcript
aggregation above re-run when sessions enter the perimeter, and the ADR-0052 pilot's reports.

## References

- [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) — the weld this ADR cuts; its
  exit-code port and its amendment's consent rule are both kept.
- [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) — the boundary (a) that stands.
- [ADR-0008](ADR-0008-opt-in-hook-seam-around-check.md) — the opt-in trust posture, inherited.
- [ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md) — the
  `wire --json` contract this revises to schemaVersion 2.
- `.claude/hooks/runward-gate.sh` — the 62-line proof that (a) does not imply (b).
- Harness documentation, retrieved 2026-09: code.claude.com/docs/en/hooks ·
  docs.github.com/en/copilot/reference/hooks-reference · geminicli.com/docs/hooks/reference ·
  kiro.dev/docs/cli/hooks · junie.jetbrains.com/docs/junie-cli-hooks.html ·
  cursor.com/docs/agent/hooks · docs.devin.ai/desktop/cascade/hooks.
