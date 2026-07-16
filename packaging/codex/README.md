# OpenAI Codex plugin — `runward-gate`

Runs the runward gate when the agent finishes a turn and surfaces the verdict in Codex.

- **Format:** Codex plugin (`.codex-plugin/plugin.json` + `marketplace.json` + `hooks/hooks.json`).
- **Seam:** `Stop` — end of turn.
- **Gate tier:** *advisory end-of-turn.* The command ends in `|| true`; Codex can block via
  exit code 2 or `{"decision":"block"}`, but we stay advisory on purpose. The **hard gate is CI**.

## Install

```sh
codex plugin marketplace add stranxik/runward
```

Then open the plugin picker:

```
/plugins
```

### Repo-root limitation (honest)

`codex plugin marketplace add <owner>/<repo>` reads `marketplace.json` from the **repo
root**. This packaging keeps it under `packaging/codex/`. To make the marketplace command
resolve directly, copy `marketplace.json` and `.codex-plugin/` to the repo root (or point
the marketplace at a repo whose root is this folder). Until then, install by pointing Codex
at this local path per the `/plugins` local-install flow.

## Format notes / verification

- Hook JSON mirrors the Claude/Codex convention: `{"hooks":{"Stop":[{"hooks":[{"type":"command", ...}]}]}}`.
  Confirmed event names include `Stop` and `SubagentStop`; `timeout` is in **seconds**
  (default 600).
- Blocking (not used here) is exit code 2 + stderr reason, or `{"decision":"block","reason":...}`.
- `plugin.json`: the manifest's exact schema for `.codex-plugin/plugin.json` is **not fully
  published** in the Codex docs (the build/submit pages were not retrievable at check time).
  Fields here (`name`, `version`, `description`, `author`, `hooks` path) follow the
  Claude-plugin shape Codex adopted; `hooks/hooks.json` is auto-discovered regardless of the
  `hooks` pointer. Treat `plugin.json` as best-effort and reconcile with `/codex/build-plugins`
  when it is reachable.
- Source verified July 2026 (redirects to `learn.chatgpt.com`):
  - `developers.openai.com/codex/hooks`
  - `developers.openai.com/codex/plugins`
