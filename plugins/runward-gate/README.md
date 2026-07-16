# runward-gate (Claude Code plugin)

Installs the runward deterministic gate at your agent's turn end, plus an orientation skill.

## Install

```
/plugin marketplace add stranxik/runward
/plugin install runward-gate@runward
```

Then, in a project you trust, scaffold a mission if you don't have one:

```
npx runward init          # or: npx runward init --example
```

## What it does

- **`Stop` hook** — when the agent finishes a turn, it runs `npx runward check --strict` and surfaces the verdict in the loop, so a turn can no longer close with the gate never run.
- **`runward` skill** — orients any agent in a runward-governed repo (the charter, the workflows, the gate).

## Advisory in session, hard in CI (by design)

The session hook is **advisory**: it shows the verdict, it does not force the agent to keep working (the command ends with `|| true`). That is deliberate — the operator owns the gate and crosses it on evidence; runward does not block you at every turn (ADR-0012, ADR-0028).

The **hard** governance gate belongs in CI, where it blocks the *merge*:

```yaml
# .github/workflows/gate.yml
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: stranxik/runward@<sha>       # runward check --strict as a required check
        with:
          strict: 'true'
```

To make the session hook block hard too, remove the `|| true` in `hooks/hooks.json` — the operator's choice, not a default.

## Not a runtime, not privileged

runward installs nothing on its own; you ran `/plugin install`. This Claude Code plugin is one packaging among several (Gemini CLI, Codex, Copilot, Cursor, Kiro, the GitHub Action) — see [`docs/distribution.md`](https://github.com/stranxik/runward/blob/main/docs/distribution.md). The canonical, vendor-neutral surface stays `AGENTS.md` + `.agents/skills/`.
