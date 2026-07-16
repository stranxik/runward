# Execution Topology: runward

The domain (`architecture.md`) says what each port does; this note records where each port's adapter actually runs and under which sovereignty. For runward the answer is short and deliberate: **everything runs in-app, in one local process, on the operator's machine**. The only things that cross a machine boundary are the package being distributed to the operator and the source being versioned — both named below, because a distribution channel is a placement decision like any other.

## The port → placement map

| Port | Adapter (what runs) | Location family | Data class(es) crossing it | Sovereignty level | ADR | Re-evaluation trigger |
|---|---|---|---|---|---|---|
| Gate port (process contract) | the CLI process itself, invoked by the operator or their CI | In-app | the operator's mission files and source tree (read-only) | sovereign — never leaves the machine | docs/adr/ADR-0012 | none — a hosted gate would be a separate product |
| Machine rule surface (`rules --json`) | same process, stdout | In-app | rule metadata (public, ships with the package) | public | docs/adr/ADR-0024 | — |
| Compliance pack output | same process, writes `runward/compliance/` locally | In-app | mission artifacts reframed per regime | sovereign — written locally, operator decides any sharing | docs/adr/ADR-0016 | — |
| Filesystem port | Node `fs`, local disk | In-app | working tree (read), `runward/` (write) | sovereign | — | — |
| Local git port | `git log` via child_process, local repository only | In-app (existing local tooling) | commit metadata (read-only) | sovereign | docs/adr/ADR-0014 | — |
| Distribution: npm registry | `npm publish --provenance` from the release workflow | Managed infrastructure service | the package tarball (public code + templates; never operator data) | public artifact, SLSA provenance attached | docs/adr/ADR-0016 §supply-chain posture, `.github/workflows/release.yml` | registry trust incident → mirror or alternate registry |
| Source of record: GitHub | git remote, Actions CI | Managed infrastructure service | source, CI logs (public repo; never operator data) | public | — | — |

**What never exists in this topology:** a model endpoint (no model port — the verdict is deterministic, docs/adr/ADR-0001), a telemetry sink (the CLI emits nothing), and any write outside `runward/` and operator-requested files. The zero-network claim is structural, not aspirational: CI runs the core test suite inside a network namespace with no external interfaces (`core-offline` job), so any network call in the core fails the build.

## Trace export

None, by decision. Execution traces of the operator's gate runs would be data about their codebase; runward writes them nowhere and sends them nowhere. The observability that exists is the product's own public CI — see [governance/observability-schema.md](governance/observability-schema.md).

## Usage registry

Risk is classed by deployment, not by platform. runward has exactly one deployment shape:

| Deployment | Risk class | Data classes touched | Action scopes | Owner / responsible | Last review |
|---|---|---|---|---|---|
| The CLI on an operator's machine or CI runner | low — read-mostly local tool | operator's source tree (read), `runward/` (write) | read working tree; write `runward/` + explicitly requested files; local `git log` (read); no network | the operator of each installation; the maintainer for the shipped code | 2026-07-16 |

## Rule conformance

> Account for every CRITICAL/HIGH craft rule mapped to the topology phase (`runward/rules/`, frontmatter `phases: [topology]`). `applied` needs a pointer; `deviated` needs an ADR; `n/a` needs a reason. `runward check --strict` verifies this table.

| Rule | Status | Evidence |
|---|---|---|
| topology-port-placement-mapped | applied | the port → placement map above — one row per port from architecture.md, everything in-app in one local process; the distribution channels are named with their location family |
| topology-sovereignty-by-data-class | applied | sovereignty column per data class in the map: operator data never leaves the machine — structurally, file:.github/workflows/ci.yml#core-offline; only public package artifacts cross to npm and GitHub |
| topology-trace-export-decision | applied | the decision is recorded and is `none`: the CLI emits no telemetry and exports no traces — § Trace export above; file:runward/governance/observability-schema.md |
| topology-usage-registry-present | applied | § Usage registry above — the single deployment shape (the CLI at the operator's) with risk class, data classes touched, action scopes, owner and review date |

## Cross-references

- [architecture.md](architecture.md) — the ports this note places.
- [governance/threat-model.md](governance/threat-model.md) — the supply chain is the real attack surface of this topology.
- [governance/observability-schema.md](governance/observability-schema.md) — why there is no telemetry to place.
