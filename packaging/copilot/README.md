# GitHub Copilot CLI / VS Code Agent hook — `runward-gate`

Runs the runward gate at end of turn and surfaces the verdict. This is the same
Claude-compatible `Stop` hook, in Copilot's flavor.

- **Format:** Copilot hooks JSON (`version: 1`, `bash`/`powershell` command fields).
- **Seam:** `Stop` (PascalCase — the "VS Code compatible" naming; Copilot also accepts the
  camelCase `agentStop`).
- **Gate tier:** *advisory end-of-turn.* `|| true` (and `exit 0` on PowerShell) keeps it
  non-blocking; the **hard gate is CI**.

## Install

Copy `hooks/runward-gate.json` to one of Copilot's hook locations:

- **Per-repo:** `.github/hooks/runward-gate.json`
- **Per-user:** `~/.copilot/hooks/runward-gate.json` (macOS/Linux) or
  `%USERPROFILE%\.copilot\hooks\runward-gate.json` (Windows)

Or merge the `hooks` block inline into `.github/copilot/settings.json`.

## Claude-compatible, Copilot flavor

Copilot's hooks are close to Claude Code's `settings.json` hooks: same idea, same `Stop`
event, same "run a command at turn-end" contract. The differences this file reflects, per
the official reference:

- Copilot wraps commands in `bash` / `powershell` fields (not a single `command` string),
  and uses `timeoutSec` (not `timeout`), under a top-level `"version": 1`.
- Event names accept both PascalCase (`Stop`, `PreToolUse` — VS Code compatible) and
  camelCase (`agentStop`, `preToolUse`).

If your Copilot build rejects `Stop`, switch the key to `agentStop` — same hook.

## Format notes / verification

- The exact field set (`bash`/`powershell`/`timeoutSec`) is from the Copilot CLI reference.
- VS Code Agent hooks are documented as PascalCase-compatible with this shape; this file
  was validated against the Copilot CLI reference and is expected to load in the VS Code
  Agent hooks surface, but the VS Code page was not separately retrieved at check time —
  reconcile the exact field names there if it differs.
- Source verified July 2026:
  - `docs.github.com/en/copilot/reference/hooks-reference`
  - `code.visualstudio.com/docs/agent-customization/hooks` (referenced, not re-fetched)
