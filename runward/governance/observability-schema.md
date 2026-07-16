# Observability Schema: runward

**Version**: v0.18.1 · **Last review**: 2026-07-16

The honest schema for runward is short: **the CLI emits no telemetry, by decision, and that decision is the point.** A gate that inspects an operator's codebase must not be a channel out of it. Execution traces of a gate run would describe the operator's source tree and mission — their data, not ours — so runward writes them nowhere and sends them nowhere. There is no metrics endpoint, no crash reporter, no usage ping, no "anonymous statistics". The sovereignty constraint from [framing.md](../framing.md) §7 is absolute here, and the `core-offline` CI job makes it structural: the core test suites run inside a network namespace with no external interfaces, so an accidental network call fails the build rather than shipping.

## 1. What the operator observes, locally

| Level | What | Where |
|---|---|---|
| The verdict | exit code 0/1/2 — the machine-readable contract every CI consumes | process exit status |
| The report | per-phase, per-rule findings with the fix gesture named | stdout, human-readable; `NO_COLOR` honored |
| Machine surfaces | `rules --json` (versioned, additive), the OSCAL component-definition, `evidence-lock.json` | stdout / files under `runward/` |
| Diagnostics | `--verbose` stack traces and detail; `doctor` environment checks | stdout/stderr, on demand |

Every observable output is local and inspectable by the operator; nothing is buffered for later transmission because there is nowhere to transmit to.

## 2. What the maintainer observes (the product's own observability)

Since no telemetry flows back, the product is observed through public, external instruments:

- **The CI chain** on every commit: unit + fuzz + golden + smoke + schema validation on Node 20/22/24, plus the network-isolated core run. A regression is visible to anyone, not just the maintainer.
- **OSSF Scorecard**, continuously scoring the supply-chain posture from the outside.
- **npm provenance**: each release carries a SLSA attestation linking the tarball to the exact workflow run and commit — operators can verify what they installed, which is observability pointed the right way.
- **GitHub signals**: issues, Dependabot alerts, download counts — the adoption indicator named at framing, observed without instrumenting users.

## 3. Provenance and audit

The audit trail of a runward-governed project is the operator's own repository: mission files, the ADR journal, manifest history in git, and the opt-in `evidence-lock.json` seal (SHA-256 of every evidence file a green gate crossed on, docs/adr/ADR-0021). Reconstructing "what did the gate see when it went green" is `git checkout` plus re-running `check --strict` — determinism is the replay mechanism, which is why no separate trace store needs to exist.

## 4. Cost ceilings

Not applicable as a steered quantity: a gate run costs milliseconds of local CPU and no tokens — there is no model call to meter and no per-run budget to enforce.

## References

- [../execution-topology.md](../execution-topology.md) — the trace-export decision this schema records.
- [evaluation-rubric.md](evaluation-rubric.md) — the CI chain as the product's evaluation.
