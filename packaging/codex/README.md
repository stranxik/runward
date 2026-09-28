# OpenAI Codex plugin — `runward-gate`

Runs the runward gate when the agent finishes a turn. Codex documents plain text as "invalid
for this event" on `Stop`, so the verdict does **not** reach the model. See [`../README.md`](../README.md#what-the-consultative-hooks-actually-deliver-checked-2026-09-28) for what each harness does with a hook's plain output.

**Why Codex is packaged but unknown to the CLI.** Codex reads `AGENTS.md` natively, so
`runward init --tools codex` needs no profile, and no armed tier speaks Codex yet, so
`runward gate-hook --harness codex` refuses (fail-open). Both now say so. Wiring an armed Codex
tier waits on a measured run against the `Stop` contract below; until then this plugin is the
advisory tier only.

- **Format:** Codex plugin (`.codex-plugin/plugin.json` + `marketplace.json` + `hooks/hooks.json`).
- **Seam:** `Stop` — end of turn.
- **Gate tier:** *advisory end-of-turn.* The command ends in `|| true`; Codex can block via
  exit code 2 or `{"decision":"block"}`, but we stay advisory on purpose. The **hard gate is CI**.

## Install

The runward Codex marketplace lives under `packaging/codex/` (the repo root carries the
*Claude* marketplace). Use the git-backed `--sparse` form so Codex reads it directly — no
copying, no dedicated repo:

```sh
codex plugin marketplace add https://github.com/stranxik/runward.git --sparse packaging/codex
```

Then open the plugin picker and install `runward-gate`:

```
/plugins
```

The plugin requires a `runward/` mission in your project (`npx runward init`).

## Format notes / verification

- Hook JSON mirrors the Claude/Codex convention: `{"hooks":{"Stop":[{"hooks":[{"type":"command", ...}]}]}}`.
  Confirmed event names include `Stop` and `SubagentStop`; `timeout` is in **seconds**
  (default 600).
- Blocking (not used here) is exit code 2 + stderr reason, or `{"decision":"block","reason":...}`.
- `marketplace.json` follows the documented Codex schema (`learn.chatgpt.com/codex/build-plugins`):
  `name`, `interface.displayName`, and per-plugin `source` **object** (`{"source":"local","path":"./.codex-plugin"}`),
  `policy.installation`/`policy.authentication`, and `category`.
- `plugin.json`: `.codex-plugin/plugin.json` carries `name`, `version`, `description`, `author`
  and a `hooks` pointer; `hooks/hooks.json` is auto-discovered. Run `codex plugin validate`
  against the current build/submit docs before a curated-directory submission (the curated
  directory is partners-only today; the git-backed `--sparse` install above needs no submission).
- Source verified July 2026 (redirects to `learn.chatgpt.com`):
  - `learn.chatgpt.com/codex/build-plugins`
  - `developers.openai.com/codex/hooks`
