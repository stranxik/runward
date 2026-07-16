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
| config-secrets-boundary | n/a | the CLI reads no secret at runtime: no provider key, no token, no required env; the only credential in the product's lifecycle (npm publish) is OIDC-minted inside the release workflow, outside the codebase |
| frontier-deterministic-boundary | n/a | there is no model whose boundary could be drawn — zero model calls by invariant (docs/adr/ADR-0001); the entire program stands on the deterministic side of the frontier |
| hexa-adapter-pattern | applied | new consumer surfaces enter as adapters: file:src/commands/manifest.ts#manifestCommand adapts the sync library to the CLI; file:templates/adapters/gitlab-ci.yml is inert adapter data the operator wires (docs/adr/ADR-0012) |
| hexa-architecture | applied | pure, filesystem-only logic under src/lib/ behind thin command adapters — file:src/lib/conformance.ts#conformance; file:src/lib/evidence.ts#evidenceReport; file:src/commands/check.ts#checkCommand |
| hexa-move-deterministic-out | applied | the founding decision — conformance verification is deterministic code, never a model judgment, and the LLM pass stays advisory above the gate: file:docs/adr/ADR-0001-enforce-declared-rule-conformance-at-the-gate.md; file:docs/adr/ADR-0007-advisory-llm-conformance-verification.md; file:src/lib/conformance.ts#conformance |
| provider-llm-auto-detection | n/a | no model port exists, so there is no provider to detect or hardcode (zero-LLM invariant, docs/adr/ADR-0001) |
| provider-no-crash-missing-env | n/a | the CLI requires no environment configuration at all — no provider, no store; it runs identically with an empty environment (NO_COLOR and VERBOSE are cosmetic toggles) |
| security-prompt-injection | n/a | no model ingests anything: mission files are parsed by deterministic code as data and can never become instructions; the injection surface belongs to the operator's harness, above the gate (threat model §2) |
| state-event-sourcing | n/a | runward holds no runtime state to journal — each run is a pure function of the working tree; history and audit live in the operator's git, plus the opt-in evidence seal (docs/adr/ADR-0021) |
| tools-scope-atomicity | n/a | no tool surface is exposed to a model; the subcommands are consumed by humans and CI scripts, not selected by an LLM |

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
