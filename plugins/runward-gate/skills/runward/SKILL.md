---
name: runward
description: "Use in a repository governed by runward (a runward/ directory is present). Explains the gate, the mission structure, and how to cross a phase on evidence."
---

# Runward — the deterministic delivery gate

This repository is governed by **runward**: the agent builds the real system inside guardrails, and every load-bearing decision must be made, written down, and verified as plain code before a phase closes.

- **The charter is `AGENTS.md`** — its boundaries are non-negotiable. Read it first.
- **The method lives in `runward/workflows/`** (start with `method.md`); the mission state lives in `runward/`.
- **The gate is `runward check --strict`** — deterministic, zero-LLM. It verifies that every CRITICAL/HIGH craft rule mapped to the phase is accounted for with real, resolving evidence (a typed pointer, an ADR, or a reasoned `n/a`). No prompt can talk it into passing; a rule cited but not applied still fails.
- This plugin runs the gate when you finish a turn and surfaces the verdict. It is advisory in session — the load-bearing hard gate is CI (`stranxik/runward` as a required status check). Before crossing a green gate, run `runward/workflows/verify.md` (an adversarial cite-vs-apply pass).

If there is no `runward/` directory, scaffold one with `npx runward init` (or `npx runward init --example` for a filled reference), then point the work at `runward/workflows/method.md`.
