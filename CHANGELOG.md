# Changelog

All notable changes to the Runward tooling. Newest first. What is ahead lives in [ROADMAP.md](ROADMAP.md).

## v0.7.0 — rule-conformance gate — 2026-07-07

Implements [ADR-0001](docs/adr/ADR-0001-enforce-declared-rule-conformance-at-the-gate.md): craft rules become active at the gate, deterministically, across the architect, floor and govern phases. Motivated by a field test where an agent cited a rule (`frontier-deterministic-boundary`) without applying it and the floor still passed `runward check` green.

- **`runward check --strict`** (opt-in): verifies each phase's `Rule conformance` manifest — every CRITICAL/HIGH rule mapped to the phase must be `applied` (with a `file:line`/test pointer), `deviated` (with an existing ADR), or `n/a` (with a reason). Deterministic: it checks that a decision was traced, never the quality of the code; no LLM in the gate path. Default `check` is unchanged (non-breaking).
- Rule frontmatter gains an additive `phases:` field; 18 CRITICAL/HIGH rules mapped — architect (5), floor (10), govern (7). The expected set reads from the mission's `runward/rules/`, or the package rules as a fallback.
- `architecture.md`, `floor.md` and `governance/threat-model.md` gain a `Rule conformance` section; the `architect`, `floor` and `govern` workflows and the `AGENTS.md` charter direct the agent to confront the routed rules at the point of building and account for each.
- The `examples/request-triage` mission is migrated: it carries filled manifests and passes `runward check --strict` across all three phases (a worked mix of `applied` and reasoned `n/a`).
- The incident scenario now turns `check --strict` red. 3 smoke tests (incident → red, unbacked `applied` → red, migrated example → green across architect/floor/govern).
- Deferred, named with trigger (per ADR-0001): finer per-task `appliesWhen` routing — added on evidence.

## v0.6.0 — published — 2026-07-06

- First public release. The tooling is live on npm — `npx runward init` — and the repository is public at `stranxik/runward`. The doctrine ships separately at `stranxik/designing-and-running-agentic-systems`.
- README: npm version badge added.

## v0.6.0 — release prep — 2026-07-06

- Public release wiring: the tooling repository goes public at `stranxik/runward`, with the site on `runward.dev`; `homepage` metadata points at it.
- Rule rename: `hexa-move-deterministic-out` normalized to its canonical id across the craft-rule set and the workflows that reference it (no rule added or removed by the rename).
- Rule-count reconciliation: `EXPECTED_RULES` is now pinned to the exact craft-rule count so `doctor` and the smoke test gate on the real number rather than a hand-kept figure. The published per-version deltas below are unchanged; this only makes the guard exact.
- Homepage: first public landing surface prepared for `runward.dev`.

## v0.6.0 — 2026-07-03

- Runnable example: `examples/request-triage/code/` — the mission's floor implemented (deterministic guard on extracted fields, fail-closed compliance routing with suspension, abstention; 14 tests).
- Reference floor: two deferrals implemented — suspend & rehydrate on human approval (run serialized, process freed, exact resume) and prompt provenance (SHA-256 of the prompt actually sent, per call, re-read never replayed). 53 tests.
- 3 new async rules (post-turn pipeline, scheduled maintenance, job guardrails) — 51 rules total; `govern` workflow extended accordingly.
- New reference: `shared-bricks.md` (placement families, brick matrix, sovereignty by data class, usage registry).
- Tutorial: `docs/first-mission.md` (first mission in 15 minutes, flow verified by execution).
- Language framing corrected everywhere: one single language in the core, which one is an adapter decision; TypeScript is the reference-stack sober default, sidecars on proven triggers.

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
- Workflows in English, executable by an agent
- `runward init` CLI
- Tool profiles: Claude Code, Cursor
- License split: tooling MIT, doctrine CC BY-ND canon (see NOTICE.md)
