# Cursor plugin — `runward-gate`

Surfaces the runward gate verdict when the agent finishes a turn.

- **Format:** Cursor plugin (`.cursor-plugin/plugin.json`) + `hooks.json`.
- **Seam:** `stop` — **observational** (fire-and-forget).
- **Gate tier:** *soft — per-tool only.*

## Honest limit: `stop` does not block in Cursor

This is the key honesty note for this channel. Per Cursor's own docs, `stop` is an
**observational** event: it can print context or trigger an auto-follow-up, but it
**cannot deny or block** the turn. So the `stop` hook shipped here is purely advisory — it
runs `runward check --strict` and surfaces the verdict, nothing more.

The **only** events in Cursor that can actually block are **per-tool**:
`beforeShellExecution`, `preToolUse`, `beforeMCPExecution`, `beforeReadFile`,
`beforeSubmitPrompt`, `subagentStart` (a hook there returns `permission: "deny"` or exits
`2`). That means, in Cursor, an enforcing runward gate would have to fire **on every tool
call** — a soft, noisy, per-tool gate, not a clean end-of-turn one. We deliberately do
**not** wire that here (blocking every shell/tool on the full gate is disruptive). If you
want enforcement inside Cursor, add a `beforeShellExecution` hook yourself and accept the
per-tool cost. Otherwise: **the hard gate is CI.**

## Install

Copy `hooks.json` to a Cursor hooks location:

- **Per-project:** `<project-root>/.cursor/hooks.json`
- **Per-user:** `~/.cursor/hooks.json`

Merge the `stop` block if the file already exists.

## Format notes / verification

- `hooks.json` shape (`"version": 1`, `hooks` map, `type: "command"`, `timeout` seconds)
  and the blocking-vs-observational split are from the official Cursor hooks reference.
- `.cursor-plugin/plugin.json`: Cursor's plugin **manifest** is **not documented** in the
  hooks reference (plugins are referenced as external; only `hooks.json` is fully specified).
  The manifest here is best-effort (`name`, `version`, `description`) — reconcile with the
  Cursor plugin docs if/when the schema is published. The `hooks.json` file is the
  load-bearing part and matches the reference.
- Source verified July 2026: `cursor.com/docs/hooks`.
