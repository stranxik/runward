---
name: "runward-gate"
displayName: "runward gate"
description: "runward's deterministic, zero-LLM gate. Verifies that every gated deliverable is filled and every CRITICAL/HIGH rule is accounted for, via `runward check --strict`. In Kiro the hook is advisory and per-tool (PreToolUse); the hard gate is CI."
keywords: ["gate", "runward", "compliance", "audit", "governance", "check", "zero-llm", "conformance"]
author: "runward"
---

# Onboarding

## Step 1: Validate the gate is available

runward is a CLI (`runward`, distributed on npm). Confirm it runs in this workspace:

```sh
runward check --strict
```

Exit codes are the whole contract: `0` clean, `1` gaps, `2` no `runward/` mission found
here or above, a usage error or a refused gesture: the question could not be asked, never a
red gate. If the command is missing, install runward (`npm i -g runward` or run it
with `npx --yes runward ...`).

## Step 2: Wire the gate hook (operator action — never automatic)

Copy `hooks/runward-gate.kiro.hook` into `.kiro/hooks/` in your workspace. runward never
wires this for you; it is an inert sample you install in a repo you trust.

# Steering Instructions

## What this gate is

runward frames and verifies agent-generated work; it does not generate code. `runward
check --strict` is a deterministic, zero-LLM check: it reads the traced decisions
(`runward/` mission) and their evidence and returns a verdict. Same one line as every other
runward packaging.

## Honest gate tier in Kiro: per-tool, not end-of-turn

This is the key limitation to respect. Kiro's docs (checked 2026-09-28) say **Stop / Agent
Stop and the file events cannot block**, in the IDE and in the CLI; only **`PreToolUse`,
pre-task-execution and prompt submit** can. So the packaged hook uses `PreToolUse` and ends in
`2>&1 || true`: at exit 0 Kiro adds the hook's stdout to the agent's context, so the verdict
reaches the agent before each tool call, and nothing is blocked. It is an **advisory, per-tool**
reminder, not an end-of-turn gate.

For an un-bypassable gate, rely on **CI** (`runward check --strict` as a required check).
The Kiro hook informs the agent; the CI check is the authority.

## Install as a custom Power

Kiro requires `POWER.md` at the repo root, so this Power is published from a thin dedicated
repo. In Kiro: **Add Custom Power → Import power from GitHub**, then paste
`https://github.com/stranxik/runward-kiro` (a public mirror of this folder, kept in sync).
Kiro also reads `AGENTS.md` natively, and `runward init --tools kiro` mirrors the phase
skills as steering files under `.kiro/steering/` — the traced decisions inform the session;
the gate stays the only authority.
