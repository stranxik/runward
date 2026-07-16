# Kiro Power — `runward-gate`

Packages the runward gate as a Kiro Power, with a per-tool hook.

- **Format:** Kiro Power (`POWER.md`, frontmatter + instructions) + `.kiro/hooks/` JSON hook.
- **Seam:** `PreToolUse` — fires before a tool runs.
- **Gate tier:** *soft — per-tool.*

## Honest limit: Stop / save do not block in Kiro

In the Kiro IDE, **Stop and on-save events cannot block** an action. The only blocking
seam is **`PreToolUse` / pre-task-execution**, so the packaged hook
(`hooks/runward-gate.kiro.hook`) uses `PreToolUse`. That makes it a **soft, per-tool** gate:
it runs `runward check --strict` before tool calls, not once cleanly at end of turn. It is
also noisier than an end-of-turn hook (it can fire often). The **hard gate is CI**.

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
  changed from `Stop` to `PreToolUse` because Stop cannot block in Kiro.
- Source verified July 2026: `kiro.dev/docs/powers/create`.
