# Floor Note: runward

**Date**: 2026-07-16 · **Version**: v0.18.1 · **Architecture note**: [architecture.md](architecture.md) · **Success criterion**: `runward check --strict` gives a deterministic, replayable verdict — same working tree, same exit code, every violation named — with the full CI chain green and the package installable from npm with provenance

## 1. Scope shipped

The floor is the complete CLI at v0.18.1. The six generic floor components map onto it honestly — a deterministic gate has no orchestrator-and-model shape, so the table names what actually stands in each slot:

| Component | Status | Notes |
|---|---|---|
| Entry point (CLI, `commander`) | shipped | `init`, `check`, `status`, `doctor`, `update`, `characterize`, `manifest`, `rules`, `explain`, `compliance` — exit codes 0/1/2 as the machine contract |
| Orchestration | shipped | thin command handlers in `src/commands/` compose pure functions from `src/lib/`; no business logic in the handlers |
| Model port | none, by invariant | the verdict is zero-LLM (docs/adr/ADR-0001); there is deliberately no model anywhere in this system |
| Persistence | shipped | the operator's own files under version control: `runward/` markdown, `evidence-lock.json` seals; runward holds no state of its own between runs |
| Deterministic guardrails | shipped | the gate itself: form lint, non-vacuity floors, typed-pointer resolution, signature matching, seal verification — all bytes, no judgment |
| Baseline observability | shipped | public CI chain (3 Node versions, offline job), exit-code contract, `--verbose` local logging; no telemetry by decision |

## Rule conformance

> Account for every CRITICAL/HIGH craft rule mapped to the floor phase (`runward/rules/`, frontmatter `phases: [floor]`). Status: `applied` needs an evidence pointer; `deviated` needs an ADR reference; `n/a` needs a one-line reason. `runward check --strict` verifies this table.

| Rule | Status | Evidence |
|---|---|---|
| config-secrets-boundary | n/a | the CLI reads no secret at runtime: no provider key, no token, no required environment variable. The product's lifecycle holds no stored secret either (no secrets.* in any workflow): the npm publish credential is OIDC-minted in the release workflow, and CI uses only ephemeral platform credentials (github.token, Sigstore OIDC), all outside the codebase |
| frontier-deterministic-boundary | n/a | there is no model whose boundary could be drawn — zero model calls by invariant (docs/adr/ADR-0001); the entire program stands on the deterministic side of the frontier |
| hexa-adapter-pattern | applied | file:reports/eslint.json#src/lib/manifest-sync.ts; test:reports/junit.xml::"the library may not import a command, and the linter says so" — the library cannot import its own adapters, and the linter's refusal is proven live; new consumer surfaces enter as adapters: file:src/commands/manifest.ts#manifestCommand adapts the sync library to the CLI; file:templates/adapters/gitlab-ci.yml is inert adapter data the operator wires (docs/adr/ADR-0012) |
| hexa-architecture | applied | file:reports/eslint.json#src/lib/evidence.ts; file:reports/eslint.json#src/lib/verdict.ts; test:reports/junit.xml::"ADR-0054 crossing 1: the verdict path imports no socket and no process spawner, transitively"; test:reports/junit.xml::"the library may not import a command, and the linter says so" — the verdict path imports no socket and no spawner, and the library imports no command, both refused by tests (the linter's refusal is planted and seen; the import walk is backed by the CI grep guard and core-offline); the logic under src/lib/ sits behind thin command adapters — file:src/lib/conformance.ts#conformance; file:src/lib/evidence.ts#evidenceReport |
| hexa-move-deterministic-out | applied | test:reports/junit.xml::"ADR-0054 crossing 4: same working tree, same verdict — byte-identical across two runs"; the founding decision — conformance verification is deterministic code, never a model judgment, and the LLM pass stays advisory above the gate: file:docs/adr/ADR-0001-enforce-declared-rule-conformance-at-the-gate.md; file:docs/adr/ADR-0007-advisory-llm-conformance-verification.md; file:src/lib/conformance.ts#conformance |
| provider-llm-auto-detection | n/a | no model port exists, so there is no provider to detect or hardcode (zero-LLM invariant, docs/adr/ADR-0001) |
| provider-no-crash-missing-env | n/a | the CLI requires no environment configuration: no provider, no store, no required variable. Verified by running check --strict under env -i (exit 0, 2026-09-27). The variables it reads are optional toggles with a default: display (NO_COLOR, VERBOSE), behaviour (RUNWARD_YES, RUNWARD_DRY_RUN, CI), reproducible dating (RUNWARD_NOW, SOURCE_DATE_EPOCH) and harness detection for wire |
| security-prompt-injection | deviated | ADR-0004 (adr:0004) — runward calls no model and parses mission files as data, but its gate-hook refusal (ADR-0065) relays evidence text into the coding agent's loop with the authority of a harness block. Accepted as bounded: no private data and no outbound channel are added, so no trifecta path is completed; the relay is named in the threat model §1 and §2 |
| state-event-sourcing | n/a | runward is not an agent and holds no state between invocations: each run is a pure function of the working tree. What must be auditable is journaled in that tree, appended by their writers and versioned by git: gate-bypass.log (ADR-0065), adapters/installed.log (wire), the Ratification blocks (ADR-0066), and the opt-in evidence seal (ADR-0021) |
| tools-scope-atomicity | n/a | runward declares no tool schema for a model to call. Agents do invoke its subcommands through the shell, guided by the shipped skills (ADR-0018), but each subcommand is a CLI verb with a single documented purpose, not a model tool whose description competes for selection |
| async-post-turn-pipeline | n/a | the CLI has no conversational turn and no post-turn work: every command is one synchronous process that computes, prints and exits — a process living between invocations is an ADR-0054 crossing |
| checklist-day-zero-project | applied | test:reports/junit.xml::"CI runs the boundary and proves the committed reports are current (RWD-2026-0113)"; file:.github/workflows/ci.yml#lint-and-reports — the day-zero items as they stand today, each run on every push: structure, lockfile, tests, the self-judging gate, the lint of the architecture boundary and the freshness of the committed reports. They did not all exist on day zero: CI and a smoke test did (2026-07-03); the mission and the self-gate came on 2026-07-16, the lint and the freshness check on 2026-09-12 |
| data-migrations-forward-only | n/a | the product owns no database, so there is no schema migration: its persistent artifacts are files in the audited repository, versioned and reverted by git. The one migration it does ship, rule renames and removals, follows the rule's spirit: an additive, never-rewritten table (src/lib/rule-migrations.ts, ADR-0006) |
| scaling-state-externalization | n/a | no service instance and no in-memory session state to externalise: each invocation reads the working tree and exits — the tree itself is the externalised state |
| tools-registry-pattern | n/a | the CLI exposes no agent tools and no tool registry: it is the judged surface, not an agent harness; its own subcommands are declared once in src/cli.ts |

## 2. Proof against the success criterion

- **Traffic used**: the gate's real inputs — this repository's own mission (the file you are reading), the shipped reference mission (`examples/request-triage/`), and adversarial inputs: a seeded fuzz corpus for the manifest parser and mutation-based negative controls for the OSCAL output.
- **Measured result**: the unit harness (node:test) covers the gate core — conformance, evidence, manifest sync, rules surface, compliance rendering — including a fuzz suite asserting the parser never throws and never false-passes, and a byte-identical golden OSCAL test with negative controls. The smoke suite drives every command end to end, including drift-blocking and seal-tampering scenarios. The `core-offline` CI job re-runs the core suites inside a no-network namespace, proving the zero-network invariant structurally. Determinism is asserted where it is load-bearing, not assumed: the OSCAL render, the evidence-lock render and the rule-set read are each tested byte-identical across repeated calls.
- **Verdict**: criterion met — the chain is green on Node 20/22/24 and this repository passes its own strict gate.
- **Observability check**: a red gate names each violating rule with the deliverable, the problem, and the fix gesture; `--verbose` traces the run locally.

**Behavioral proof**: `npm test`

> The gate above is the *documentary* proof (the decisions are traced). The line above is the *behavioral* proof (the code actually runs). runward never executes it — it is not a runtime.

## 3. Gaps and deviations

| Gap / deviation | Impact | Agreed with sponsor |
|---|---|---|
| The evidence layer verifies bytes, never meaning — a plausible pointer to real-but-irrelevant code passes | bounded: the gate raises the cost of lying, the operator's read of the pointers closes the loop; the advisory verify workflow (docs/adr/ADR-0007) exists for a semantic pass | by design, docs/adr/ADR-0001 and ADR-0019 |
| `characterize --mine` output is a hypothesis until ratified | none at the gate — unratified DRAFTs block `--strict` by construction | by design, docs/adr/ADR-0013 |

## 4. Deferrals confirmed

| Deferred capability | Trigger being watched | Signal observed so far |
|---|---|---|
| LLM-assisted semantic verification in the verdict | none — permanently out; the advisory workflow is the ceiling | — |
| Hosted/dashboard surface | sustained operator demand | none |
| Rule set as a separately versioned data package | rule count outgrowing the npm package | none — the set is curated, not crowdsourced |

## 5. Next tier

Hold the floor. The current tier (typed evidence, signatures, sealing, manifest sync, machine rule surface — docs/adr/ADR-0019 through ADR-0024) shipped recently; the evidence to gather next is real-world friction from operators using those seams, not new complexity. The closest trigger is rule-set growth, and its response (a data package) is already named.

### Ratification
- 2026-09-27 · rows: config-secrets-boundary, frontier-deterministic-boundary, hexa-adapter-pattern, provider-llm-auto-detection, data-migrations-forward-only, hexa-architecture, hexa-move-deterministic-out, provider-no-crash-missing-env, security-prompt-injection, state-event-sourcing, tools-scope-atomicity, async-post-turn-pipeline, checklist-day-zero-project, scaling-state-externalization, tools-registry-pattern · by: Thibault Souris (declared) · bound: config-secrets-boundary@dac699e6001082a6, frontier-deterministic-boundary@eda9c2eb22cc04e2, hexa-adapter-pattern@77fe0f8aed942c01, provider-llm-auto-detection@e4b89ea7d1ce371f, data-migrations-forward-only@c7eb663a06549411, hexa-architecture@6d4d2e33dc9404db, hexa-move-deterministic-out@c692d5fbb3bdd6c5, provider-no-crash-missing-env@0e81f7ffe944dd53, security-prompt-injection@518ef2f0d29139ce, state-event-sourcing@bba65bb95141b3c1, tools-scope-atomicity@ea2e192136789e04, async-post-turn-pipeline@ddfce1e68c680425, checklist-day-zero-project@d585342484092924, scaling-state-externalization@0d3125b998b6e481, tools-registry-pattern@0b7154808879598c · mode: en bloc (sample 18/46, sampled rows accepted 18/18)
