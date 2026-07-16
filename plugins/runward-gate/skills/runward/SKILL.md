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
- **To place the gate at your harness's seam**, run `runward wire`: it names the channel for the tool running you and points at the inert sample to wire — it never wires anything itself (ADR-0012). If it reports `status: undetermined`, ask the operator which AI tool they use, then wire the matching sample on their approval.

If there is no `runward/` directory, scaffold one with `npx runward init` (or `npx runward init --example` for a filled reference), then point the work at `runward/workflows/method.md`.
