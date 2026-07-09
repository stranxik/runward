# Changelog

All notable changes to the Runward tooling. Newest first. What is ahead lives in [ROADMAP.md](ROADMAP.md).

## v0.9.1 — 2026-07-09

Docs-only patch. No change to the gate, the adapters, or any behavior.

- Reframe the gate adapters as **agent-agnostic**, holding runward's vendor-neutral line: the git `pre-commit` and CI adapters gate whatever agent produced the code (Codex, Claude, Cursor, Copilot, Gemini); the Claude Code `Stop`-hook is the first shipped example of a per-harness turn-end hook, not a privileged one. Corrects the adapters `README.md`, the root README, ADR-0012, and the v0.9.0 notes — the shipped `templates/adapters/README.md` now leads with the agnostic seams.

## v0.9.0 — audit-grade alignment: OWASP ASI, ports & harness adapters — 2026-07-09

Ecosystem and doctrine alignment from the 2026 veille — each decision locked as an ADR first, then implemented (doctrine before code, per the method). Together they make the conformance manifest read as an audit artifact and wire the deterministic gate into every harness, without adding any runtime surface. The gate stays zero-LLM and zero-run.

- **[ADR-0009](docs/adr/ADR-0009-owasp-agentic-top-10-as-the-gate-risk-grammar.md)** — OWASP Top 10 for Agentic Applications (ASI01–10) as the gate's risk grammar. *Implemented:* 20 security/governance craft rules gain an `asi:` mapping (verified against the official OWASP taxonomy) so the conformance manifest reads as an audit artifact (ISO 42001 / EU AI Act); **3 new CVE-derived deterministic rules** (`security-mcp-server-pinning` [ASI04/10], `security-tool-change-reapproval` [ASI02/04], `data-memory-provenance` [ASI06]) — 51 → **54 rules**; floors updated (architect 6, govern 10); example migrated.
- **[ADR-0010](docs/adr/ADR-0010-agents-md-as-a-first-class-handover-deliverable.md)** — `AGENTS.md` as a first-class handover deliverable. *Implemented:* the `handover` workflow finalizes the `AGENTS.md` written at `init` as the receiving team's charter — the craft rules, the judgment boundaries (operator vs agent), the verification commands (including `runward check --strict`), and the never/PR rules — in the harness-neutral format every agent reads (Codex, Copilot, Cursor, Gemini, Amp, Claude Code).
- **[ADR-0011](docs/adr/ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md)** — neutral ecosystem standards as versioned ports. *Implemented:* `reference-stack.md` names MCP (pinned by spec version + server hash), OTel GenAI semantic conventions, agent identity (OAuth 2.1/PKCE, SPIFFE, Entra Agent ID) and A2A (deferred, distributed-topology trigger) as the pinned port contracts — referenced and re-tested behind the port, never implemented in the core.
- **[ADR-0012](docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md)** — the gate as a port (its exit code is the contract), with **harness adapters** (the 2026 veille P0). *Implemented:* `init` emits 4 inert sample adapters under `runward/adapters/` — a `pre-commit` git hook, a `github-actions.yml` CI job, a `claude-code-settings.json` `Stop`-hook snippet, and a `README.md` pinning the exit-code port contract — so the deterministic gate runs at each harness's lifecycle seam. The git and CI adapters are **agent-agnostic** — they gate whatever agent produced the code (Codex, Claude, Cursor, Copilot, Gemini); the Claude Code `Stop`-hook is the first shipped example of a per-harness turn-end hook, not a privileged one. Opt-in and inert until the operator wires them (runward writes nothing into `.git/`, never a runtime); refreshed by `update`, verified by `doctor` (`EXPECTED_ADAPTERS`). Closes the opening incident at its root: the agent-agnostic seams re-run the gate regardless of harness.

## v0.8.0 — conformance-gate hardening — 2026-07-07

Hardening of the `--strict` conformance gate, from a code-level benchmark of the spec-driven competitors (BMAD, Spec Kit, OpenSpec, Spec Kitty). Each structural item is locked in an ADR first; the deterministic gate stays zero-LLM and zero-run — the LLM verification (P7) and the hook seam (P8) sit beside it, subordinate and opt-in.

- **P1 — harden `--strict` against vacuous passing** ([ADR-0002](docs/adr/ADR-0002-harden-the-strict-gate-against-vacuous-passing.md)): a routed-count floor per phase (`EXPECTED_MAPPED`, enforced by `check --strict` and `doctor`) so the `phases:` mapping cannot be silently stripped; `n/a` reasons must be real, not empty or a `[placeholder]` token; the smoke suite plants a violation and asserts the gate catches it. Deterministic, zero-LLM.
- **P2 — deterministic form-lint of the manifest** ([ADR-0003](docs/adr/ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md)): before the semantic check, `check --strict` flags a rule listed more than once and a row whose slug is not a real rule (a typo that would otherwise silently hide a gap). Well-formedness before presence-of-decision.
- **P3 — advisory drift detection** ([ADR-0004](docs/adr/ADR-0004-advisory-drift-detection-of-applied-pointers.md)): `check --strict` reports (advisory, non-blocking) any `applied` pointer whose file path no longer resolves — the manifest snapshot stops silently rotting as the code moves. Existence only, deterministic, zero-LLM; pure-prose evidence is skipped.
- **P4 — baseline-worktree test validation: considered, not adopted** ([ADR-0005](docs/adr/ADR-0005-baseline-worktree-test-validation-out-of-scope.md)): running the project's tests in a worktree would violate the gate's zero-run, language-neutral invariant. Test-evidence honesty stays the project CI's job; P3 already catches a vanished test; an operator who wants baseline validation plugs it via the hook seam (P8).
- **P5 — rule-set evolution as tracked migrations** ([ADR-0006](docs/adr/ADR-0006-rule-set-evolution-as-tracked-migrations.md)): a machine-readable migration record (`rule-migrations`) turns a renamed or removed rule into a guided migration — a manifest citing an old slug now reads `renamed to '<new>' in <version> (<reason>)` instead of a bare "unknown rule". The rule set evolves by tracked delta, never by silent rewrite.
- **P6 — actionable `--strict` messages** (DX, no ADR — not a structural change): every conformance violation now carries a targeted fix hint (`add a row: applied with a file:line/test…`, `put a file:line or a test in the Evidence column`, `keep a single row per rule`, `restore the phases: [...] frontmatter`…), so the fix is in the message.
- **P7 — advisory LLM conformance verification** ([ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md)): a new `verify` workflow (`/rw-verify`) — an agent-executed, adversarial cite-vs-apply pass over the manifest ("does this code apply the rule, or only cite it?"). Advisory only: it emits findings, never an exit code, never blocks; `check --strict` stays the deterministic gate. Vendor-neutral (nothing bundled), strictly subordinate to the gate. Closes the one benchmarked weakness without touching the zero-LLM invariant.
- **P8 — opt-in hook seam around `check`** ([ADR-0008](docs/adr/ADR-0008-opt-in-hook-seam-around-check.md)): `check --hooks` runs operator-supplied `before`/`after` commands from `runward/hooks.json` around the audit; a failing hook fails the gate. Opt-in only — plain `check` never runs hooks, so a clone cannot execute anything by surprise. The extension point for language-specific proofs runward will not run itself (the P4 residual); runward's own gate stays deterministic and zero-run.

## v0.7.0 — rule-conformance gate — 2026-07-07

Implements [ADR-0001](docs/adr/ADR-0001-enforce-declared-rule-conformance-at-the-gate.md): craft rules become active at the gate, deterministically, across the architect, floor and govern phases. Motivated by a field test where an agent cited a rule (`frontier-deterministic-boundary`) without applying it and the floor still passed `runward check` green.

- **`runward check --strict`** (opt-in): verifies each phase's `Rule conformance` manifest — every CRITICAL/HIGH rule mapped to the phase must be `applied` (with a `file:line`/test pointer), `deviated` (with an existing ADR), or `n/a` (with a reason). Deterministic: it checks that a decision was traced, never the quality of the code; no LLM in the gate path. Default `check` is unchanged (non-breaking).
- Rule frontmatter gains an additive `phases:` field; 18 CRITICAL/HIGH rules mapped — architect (5), floor (10), govern (7). The expected set reads from the mission's `runward/rules/`, or the package rules as a fallback.
- `architecture.md`, `floor.md` and `governance/threat-model.md` gain a `Rule conformance` section; the `architect`, `floor` and `govern` workflows and the `AGENTS.md` charter direct the agent to confront the routed rules at the point of building and account for each.
- The `examples/request-triage` mission is migrated: it carries filled manifests and passes `runward check --strict` across all three phases (a worked mix of `applied` and reasoned `n/a`).
- The incident scenario now turns `check --strict` red. 3 smoke tests (incident → red, unbacked `applied` → red, migrated example → green across architect/floor/govern).
- Deferred, named with trigger (per ADR-0001): finer per-task `appliesWhen` routing — added on evidence.

## v0.6.0 — first public release — 2026-07-06

The first version published to npm (`npx runward init`); the repository goes public at `stranxik/runward`, the site at `runward.dev`, and the doctrine ships separately at `stranxik/designing-and-running-agentic-systems`. Bundles the feature work developed 2026-07-03 through the public-release wiring.

- Public release: live on npm; repository and site public; `repository`/`homepage`/`bugs` metadata point at them; README npm version badge; first public landing surface for `runward.dev`.
- Rule rename: `hexa-move-deterministic-out` normalized to its canonical id across the craft-rule set and the workflows that reference it (no rule added or removed by the rename).
- Rule-count reconciliation: `EXPECTED_RULES` pinned to the exact craft-rule count so `doctor` and the smoke test gate on the real number rather than a hand-kept figure.
- Runnable example: `examples/request-triage/code/` — the mission's floor implemented (deterministic guard on extracted fields, fail-closed compliance routing with suspension, abstention; 14 tests).
- Reference floor: two deferrals implemented — suspend & rehydrate on human approval (run serialized, process freed, exact resume) and prompt provenance (SHA-256 of the prompt actually sent, per call, re-read never replayed). 53 tests.
- 3 new async rules (post-turn pipeline, scheduled maintenance, job guardrails) — 51 rules total; `govern` workflow extended accordingly.
- New reference `shared-bricks.md` (placement families, brick matrix, sovereignty by data class, usage registry); tutorial `docs/first-mission.md` (first mission in 15 minutes, flow verified by execution).
- Language framing corrected everywhere: one single language in the core, which one is an adapter decision; TypeScript is the reference-stack sober default, sidecars on proven triggers.

---

_Pre-public development history — the versions below were never published to npm (the package starts at 0.6.0). Kept for provenance._

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
