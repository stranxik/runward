---
name: "runward-gate"
displayName: "runward gate"
description: "runward's deterministic, zero-LLM gate. Verifies that every gated deliverable is filled and every CRITICAL/HIGH rule is accounted for, via `runward check --strict`. Enforcement in Kiro is per-tool (PreToolUse); the hard gate is CI."
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
here or above. If the command is missing, install runward (`npm i -g runward` or run it
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

This is the key limitation to respect. In the Kiro IDE, **Stop / on-save events do not
block** — they cannot deny an action. The only events that can gate are **`PreToolUse` /
pre-task-execution**, which fire before a tool runs. So the packaged hook uses `PreToolUse`:
it is a **soft, per-tool** gate (it runs before tool calls), not a clean end-of-turn gate.

For an un-bypassable gate, rely on **CI** (`runward check --strict` as a required check).
The Kiro hook surfaces and can gate per tool; the CI check is the authority.

## Install as a custom Power

In Kiro: **Add Custom Power → Import power from GitHub**, then provide this repository URL.
The repository must be public. Kiro also reads `AGENTS.md` natively, and
`runward init --tools kiro` mirrors the phase skills as steering files under
`.kiro/steering/` — the traced decisions inform the session; the gate stays the only
authority.
