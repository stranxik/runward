# Architecture Note: runward

**Date**: 2026-07-16 · **Version**: v0.18.0 · **Framing note**: [framing.md](framing.md) · **ADR journal**: [../docs/adr/](../docs/adr/) (see [adr/ADR-0001](adr/ADR-0001-decision-journal-lives-in-docs-adr.md))

## 1. Context

runward is a deterministic CLI that traces and verifies delivery decisions for agent-built systems. The success criterion is a replayable verdict: same working tree, same exit code, every violation named. The architecture must therefore carry two invariants above all: no model call and no network call can ever reach the verdict path, and the tool must remain a gate, never a runtime — it reads the operator's files and writes only into `runward/`. See [framing.md](framing.md).

## 2. Boundaries

- **The gate is a port.** runward's primary port is a process contract, not an API: argv in; exit code out (0 green, 1 gaps, 2 no mission or CLI misuse); human-readable report on stdout. Anything that can run a process and read an exit code — GitHub Actions, GitLab CI, a pre-commit hook, an agent harness — is an adapter of this port (ADR-0012). The adapters shipped in `templates/adapters/` are inert samples the operator copies and wires; runward never installs them, never writes into `.git/` or a CI config.
- **Commands are adapters; the logic is a library.** `src/commands/` holds thin commander action handlers (parse options, format output, set the exit code). `src/lib/` holds the pure logic: manifest parsing, rule reading, evidence resolution, compliance rendering. Dependencies point inward — `commands` imports `lib`, never the reverse — so every check is testable without a terminal.
- **The rule set is versioned data, not code.** `templates/rules/*.md` carries the rules (impact, phases, OWASP ASI mapping, optional evidence signature) as markdown with frontmatter; `templates/mission/` and `templates/workflows/` carry the scaffolds. Changing the gate's demands is a data change under maintainer review, with renames tracked as migrations (ADR-0006).

## 3. Ports

| Port | Direction | Intent | Contract version | Spec |
|---|---|---|---|---|
| Gate port (process contract) | primary | run a gate audit; verdict as exit code 0/1/2 | v1 (stable since 0.9) | [contracts/port-contract.md](contracts/port-contract.md) |
| Machine rule surface (`rules --json`) | primary | expose the effective rule set as versioned, additive JSON (ADR-0024) | v1 (additive) | [contracts/port-contract.md](contracts/port-contract.md) |
| Compliance pack output (OSCAL) | primary | emit an OSCAL 1.1.2 component-definition plus regime-framed markdown (ADR-0016) | OSCAL 1.1.2 | [contracts/port-contract.md](contracts/port-contract.md) |
| Filesystem | secondary | read the working tree; write `runward/` and explicitly requested files only | — | write layer: `src/lib/write.ts` |
| Local git (`characterize --mine`) | secondary | read-only commit archaeology for retro-ADR hypotheses (ADR-0013/0014) | — | `src/lib/characterize.ts` |

There is deliberately no model port and no network port: the verdict must stay deterministic (docs/adr/ADR-0001), and any LLM judgment lives above the gate in the operator's harness (docs/adr/ADR-0007).

## 4. Default topology and triggers

| Default | Rationale | Evolution trigger |
|---|---|---|
| Single-process CLI monolith | a gate audit is a short, local, read-mostly computation; distribution would add failure modes for nothing | none foreseen — a hosted service would be a separate product behind the same contracts |
| TypeScript strict, ESM, Node ≥ 20 | one typed language for the whole tool; the ecosystem the target users already run | a capability that genuinely needs another runtime — none identified |
| Three runtime dependencies (commander, chalk, inquirer) | every dependency is attack surface for a security tool; parsing, color, prompts are the only things not worth owning | a dependency becomes unmaintained or a vulnerability window opens — replace or vendor |
| Rules and templates as in-package data | reviewable diffs, versioned with the code, no fetch at runtime | rule sets grow past what a package should carry — a versioned data package, still no runtime fetch |

## Rule conformance

> Account for every CRITICAL/HIGH craft rule mapped to the architect phase (`runward/rules/`, frontmatter `phases: [architect]`). `applied` needs a pointer; `deviated` needs an ADR; `n/a` needs a reason. `runward check --strict` verifies this table.

| Rule | Status | Evidence |
|---|---|---|
| contracts-governance | applied | the outward contracts are versioned and additive — exit codes, the rules --json shape, the OSCAL pack: file:runward/contracts/port-contract.md; file:src/commands/rules.ts#rulesCommand; file:docs/adr/ADR-0024-machine-surface-of-the-rule-set.md |
| hexa-adapter-pattern | applied | consumer surfaces stay adapters: command handlers adapt the library (file:src/commands/check.ts#checkCommand), and CI/harness integrations are inert adapter samples behind the process contract (file:templates/adapters/README.md; file:docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md) |
| hexa-architecture | applied | dependencies point inward: thin CLI adapters in src/commands/ over pure logic in src/lib/ — file:src/cli.ts; file:src/lib/conformance.ts#conformance; file:src/lib/mission.ts#analyze |
| hexa-typescript-native | n/a | the rule bounds a model abstraction; runward makes no model call by invariant (docs/adr/ADR-0001) — there is no chain framework to avoid and no model SDK to keep thin |
| process-adr-and-journal | applied | 24 accepted product ADRs, each dated with a trigger to revisit — file:docs/adr/ADR-0001-enforce-declared-rule-conformance-at-the-gate.md; file:docs/adr/ADR-0024-machine-surface-of-the-rule-set.md; mission bridge: file:runward/adr/ADR-0001-decision-journal-lives-in-docs-adr.md |
| security-mcp-server-pinning | n/a | runward consumes no MCP server or remote tool endpoint (structurally zero-network); the analogous supply-chain pins exist — SHA-pinned actions and a lockfile (threat model §3) |

## 5. What stays open

The output formats above the contract (report layout, section wording) evolve freely — only exit codes, the `rules --json` shape, and the OSCAL output are governed. The internal split of `src/lib/` is refactored at will behind the command surface. Nothing else is open: language, topology and dependency policy are locked in the decision matrix with named triggers.

## 6. Legacy integration

None. runward is greenfield; the brownfield concern it serves (existing codebases without traced decisions) is a product feature (`characterize`, ADR-0013/0014), not a constraint on its own architecture.

## 7. Target, named

Per the framing note: a broader curated rule set, additional regime lenses kept as versioned data (ADR-0022), more inert harness adapters, and a deeper brownfield reconstruction path. All of it enters behind the existing contracts; none of it may touch the two invariants (deterministic verdict, never a runtime).

## 8. Decisions

Structural decisions are locked in the product journal at `docs/adr/` — 24 accepted ADRs at this note's version ([adr/ADR-0001](adr/ADR-0001-decision-journal-lives-in-docs-adr.md) records why the journal lives there). The load-bearing ones for this note:

| Decision | ADR |
|---|---|
| Deterministic per-rule gate; no model in the verdict | docs/adr/ADR-0001 |
| Strict gate hardened against vacuous passing | docs/adr/ADR-0002 |
| The gate as a port; adapters inert, operator-wired | docs/adr/ADR-0012 |
| Typed evidence pointers verified at the gate | docs/adr/ADR-0019 |
| Rule evidence signatures | docs/adr/ADR-0020 |
| Machine surface of the rule set (`rules --json`) | docs/adr/ADR-0024 |
