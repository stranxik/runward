# Changelog

All notable changes to the Runward tooling. Newest first. What is ahead lives in [ROADMAP.md](ROADMAP.md).

## v0.5.0 — 2026-07-03

- Example mission `examples/request-triage/` filled end to end: steering contract, decision matrix, four port contracts, threat model, evaluation rubric, observability schema, recovery runbook — `runward check -p examples/request-triage` passes clean and the smoke test asserts it
- `runward check` gates on more of the chain: the steering contract at Frame; the decision matrix and at least one filled port contract at Architect
- Placeholder detection no longer counts markdown links (`[floor note](floor.md)` is a cross-reference, not a gap)
- `runward status` dates each ADR from its own `**Date**:` line (file mtime as fallback)
- Craft-rule set at 48 rules; `doctor` and the smoke test verify the new count
- Founding-inversion framing rebalanced across README, docs, workflows and the agent charter: the LLM Boundary Principle is the method's opening posture; the six phases, five gestures, decision matrix and craft rules carry the whole
- "Operator" terminology propagated where the role was still called "the engineer"
- Packaging: `repository` / `homepage` / `bugs` metadata, `prepublishOnly` guard, `CONTRIBUTING.md`, `SECURITY.md`, this changelog

## v0.4.0

- Reference floor `floor-ts/`: clonable hexagonal TypeScript scaffold (23 tests, zero keys by default, provider profiles, day-zero cost cap) + its craft companion `floor-ts/AGENTS.md`
- New templates: `mission-contract.md` (one-page steering contract, 4 engagements with DoD, decision gates) and `reference-stack.md` (default adapter kit per layer with triggers)
- Fidelity audit of all 10 workflows against their sources — 10 major losses fixed (mentor posture, 8 DoR conditions, boundary-principle rooting, 2-of-3 window rule, hardened handover DoD, the five review hats…)

## v0.3.0

- The craft rules shipped with the mission (`runward/rules/`) — memory, state, resilience, observability, security, scaling depth
- Full 22-arbitration decision matrix (`runward/decision-matrix.md`)
- `runward update` covers rules; `doctor` verifies rule completeness
- README reflects the four broken assumptions and five gestures, not just the boundary principle

## v0.2.0

- CLI rebuilt on commander/chalk/@inquirer: interactive wizard, `--yes`, `--dry-run`, `--no-color`, exit codes, error handlers
- `runward check`: gate audit (which expected deliverable is missing at the current phase)
- `runward status`, `runward doctor`, `runward update` (drift-aware, mission state never touched)
- Tool profiles: GitHub Copilot, Gemini CLI, Windsurf (AGENTS.md always written)
- Example mission (end-to-end, anonymized)

## v0.1.0

- Mission structure (`runward/`) with gates per phase
- Missing templates created: `framing.md`, `architecture.md` (structure existed only in prose before)
- Workflows in English, executable by a coding agent
- `runward init` CLI
- Tool profiles: Claude Code, Cursor
- License split: tooling MIT, doctrine CC BY-ND canon (see NOTICE.md)
