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

- **`Stop` hook** — when the agent finishes a turn, it runs `npx runward check --strict`. The verdict does **not** reach the model: Claude Code writes a `Stop` hook's plain stdout to its debug log, not to the model's context nor to the transcript (Claude Code hooks reference, checked 2026-09-28). The skill therefore tells the agent to run the gate itself before ending a turn.
- **`runward` skill** — orients any agent in a runward-governed repo (the charter, the workflows, the gate).

## Advisory in session, hard in CI (by design)

The session hook is **advisory**: it runs the gate, it neither shows the verdict to the model nor forces the agent to keep working (the command ends with `|| true`). That is deliberate — the operator owns the gate and crosses it on evidence; runward does not block you at every turn (ADR-0012, ADR-0028).

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

Removing the `|| true` does **not** make it block: a red gate exits 1, which Claude Code treats as a non-blocking hook error; only exit 2 or a JSON decision blocks. To put a red gate in front of the model as a refusal, arm it with `runward wire --install` (TTY-only, the operator's gesture): it wires `runward gate-hook --harness claude`, which blocks once and traces every release to `runward/gate-bypass.log` (ADR-0065).

## Not a runtime, not privileged

runward installs nothing on its own; you ran `/plugin install`. This Claude Code plugin is one packaging among several (Gemini CLI, Codex, Copilot, Cursor, Kiro, the GitHub Action) — see [`docs/distribution.md`](https://github.com/stranxik/runward/blob/main/docs/distribution.md). The canonical, vendor-neutral surface stays `AGENTS.md` + `.agents/skills/`.
