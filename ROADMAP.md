# Roadmap

## v0.1
- [x] Mission structure (`runward/`) with gates per phase
- [x] Missing templates created: `framing.md`, `architecture.md` (structure existed only in prose before)
- [x] Workflows in English, executable by a coding agent
- [x] `runward init` CLI
- [x] Tool profiles: Claude Code, Cursor

## v0.4 (this repository)
- [x] Reference floor `floor-ts/`: clonable hexagonal TypeScript scaffold (23 tests, zero keys by default, provider profiles, day-zero cost cap) + its craft companion `floor-ts/AGENTS.md`
- [x] New templates: `mission-contract.md` (one-page steering contract, 4 engagements with DoD, decision gates) and `reference-stack.md` (default adapter kit per layer with triggers)
- [x] Fidelity audit of all 10 workflows against their sources — 10 major losses fixed (mentor posture, 8 DoR conditions, boundary principle rooting, 2-of-3 window rule, hardened handover DoD, the five review hats…)

## v0.3
- [x] 46 craft rules shipped with the mission (`runward/rules/`) — memory, state, resilience, observability, security, scaling depth
- [x] Full 22-arbitration decision matrix (`runward/decision-matrix.md`)
- [x] `runward update` covers rules; `doctor` verifies rule completeness
- [x] README reflects the four novelties and five gestures, not just the boundary principle

## v0.2
- [x] CLI rebuilt on commander/chalk/@inquirer: interactive wizard, `--yes`, `--dry-run`, `--no-color`, exit codes, error handlers
- [x] `runward check`: gate audit (which expected deliverable is missing at the current phase)
- [x] `runward status`, `runward doctor`, `runward update` (drift-aware, mission state never touched)
- [x] Tool profiles: GitHub Copilot, Gemini CLI, Windsurf (AGENTS.md always written)
- [x] Example mission (end-to-end, anonymized)
- [ ] Publish doctrine repository (canon, separate)
- [ ] npm publish + GitHub repository public

## v0.3+
- [ ] Reference floor: clonable hexagonal TypeScript scaffold (port of the existing socle, EN)
- [ ] `runward status`: phase tracking from the mission files
- [ ] Community workflow extensions
- [ ] Brownfield entry mode as first-class flow
- [ ] Certification / training track (separate, commercial)

## Standing backlog (from the gap analysis, 2026-07-03)
| ID | Item | Status |
|---|---|---|
| D1 | License split: tooling MIT, doctrine ND canon | Done in v0.1 (lawyer review pending) |
| D2 | English as framework language | Done for workflows/templates; socle README pending |
| D3 | CLI + packaging + releases | v0.1 CLI done; npm publish pending |
| D4 | Missing templates (framing, architecture) | Done in v0.1 |
| D5 | Decouple from Claude-only vehicle | Done: plain markdown + per-tool profiles |
| D6 | Scope hygiene (no client/brand references) | Enforced in v0.1 content review |
| D7 | Distribution (docs site, content, cadence) | Not started — recurring cost |
