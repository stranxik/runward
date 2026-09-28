# Kiro Power — `runward-gate`

Packages the runward gate as a Kiro Power, with a per-tool hook.

- **Format:** Kiro Power (`POWER.md`, frontmatter + instructions) + `.kiro/hooks/` JSON hook.
- **Seam:** `PreToolUse` — fires before a tool runs.
- **Gate tier:** *advisory — per-tool.*

## What Kiro documents (checked 2026-09-28)

- **Only `PreToolUse`, `PreTaskExec` and `UserPromptSubmit` can block**; `Stop` / Agent Stop
  and the file events "Can block? No". The table is the same for the Kiro IDE and the Kiro
  CLI (kiro.dev/docs/hooks, kiro.dev/docs/cli/v3/hooks-migration).
- **A command hook's exit code decides what the agent sees**: at exit 0 "the stdout output of
  the command is added to the agent's context"; at any other exit "the stderr output of the
  command is sent to the agent", and a `PreToolUse` hook blocks the tool (kiro.dev/docs/hooks/actions).

So the packaged hook (`hooks/runward-gate.kiro.hook`) uses `PreToolUse` and runs
`runward check --strict 2>&1 || true`: before each tool call the verdict lands in the agent's
context, and nothing is blocked. Until 0.42.3 it ran without `|| true`: on a red gate every
tool call exited 1 and was blocked, including the edit that would close the gap, and the agent
received runward's empty stderr instead of the verdict, which runward writes on stdout. It is
noisier than an end-of-turn hook (it fires before every tool call). The **hard gate is CI**.

**Not verified**: the armed sample (`runward/adapters/kiro-hooks.armed.json`, written by
`runward wire --install`) triggers on `Stop` and emits `{"decision":"block","reason"}`, on a
2026-09-02 measurement of the Kiro CLI. Kiro's current docs neither document that shape nor let
`Stop` block, so treat that sample as unconfirmed until it is re-measured on your Kiro build.

## Install

- **As a Power:** in Kiro, **Add Custom Power → Import power from GitHub**, provide this
  repo URL (must be public). See `POWER.md`.
- **The hook:** copy `hooks/runward-gate.kiro.hook` into `.kiro/hooks/` in your workspace.
  runward never installs it for you.

## Format notes / verification

- `POWER.md` frontmatter fields (`name`, `displayName`, `description`, `keywords`, `author`)
  and the "Import power from GitHub" flow are from the official Kiro powers docs.
- The hook JSON (`version: "v1"`, `hooks[]`, `trigger`, `action.type: "command"`, `timeout`,
  `enabled`) matches the repo's existing Kiro adapter (`templates/adapters/kiro-hooks.json`),
  changed from `Stop` to `PreToolUse` because Stop cannot block in Kiro, and ending in
  `2>&1 || true` so the verdict reaches the agent's context instead of blocking every tool.
- Source verified July 2026: `kiro.dev/docs/powers/create`.
