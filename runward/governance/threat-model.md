# Threat Model: runward

**Version**: v0.18.1 · **Last review**: 2026-07-16 · **Agent privilege level**: not applicable — runward is not an agent; it is a deterministic CLI with no model, no network, and no autonomy

runward's threat picture is unusual and worth stating plainly: the classic agentic surfaces (context window, tool registry, memory) do not exist here, because there is no model in the system. What remains is what any security-relevant developer tool faces — the supply chain, malicious contributions, and the ways an operator can be lied to — plus one threat specific to runward's purpose: a manifest that games the gate.

## 1. Attack surfaces

| Surface | Description | Trust | Primary risk |
|---|---|---|---|
| npm supply chain (inbound) | the three runtime dependencies and the dev toolchain | third-party | a compromised dependency executing in the operator's CI |
| npm supply chain (outbound) | the published `runward` package | maintainer-controlled | a tampered or impersonated release reaching operators |
| Contributed rules and templates | PRs touching `templates/rules/`, workflows, adapters | untrusted until reviewed | a malicious or subtly weakened rule lowering every adopter's gate |
| The operator's mission files | manifests, ADRs, evidence pointers read by the gate | untrusted input to the gate | a manifest crafted to pass without the underlying work existing |
| The gate's own code (`src/`) | a change that silently adds network, model calls, or weakens a check | maintainer-reviewed | the zero-LLM/zero-network invariant eroding unnoticed |
| Opt-in operator hooks (`runward/hooks.json`) | commands the operator wires around `check --hooks` (docs/adr/ADR-0008) | operator-authored | the operator running a command they did not write — same class as any make target |

## 2. Lethal trifecta

Not applicable in its original sense — there is no context window in which private data, untrusted content and egress could meet, because no model ingests anything. The structural equivalents are still assessed:

| Path | Private data | Untrusted content ingested | Outbound communication | Verdict |
|---|---|---|---|---|
| `check` / `manifest` / `rules` / `compliance` | reads the operator's tree | yes — mission files are parsed as data by deterministic regex/JSON code, never executed, never interpreted as instructions | none — structurally no network | safe |
| `characterize --mine` | reads local git history | yes — commit messages, as data | none | safe |
| `check --hooks` (opt-in) | whatever the hook touches | no — hooks come from the operator's own `hooks.json`, never from the checked content | whatever the hook does | operator-owned; runward never writes or suggests hook content |

## 3. Guardrails

- **Zero network, structurally.** No network or model-SDK import can land in `src/`: a CI grep guard blocks the obvious routes (HTTP clients, model SDKs, dynamic imports, `eval`, network shell-outs), and the `core-offline` job runs the core suites inside a network namespace with no external interfaces — a network call anywhere in the core fails the build.
- **Supply chain, inbound.** Three runtime dependencies, lockfile-pinned; Dependabot watches them; every GitHub Action is pinned by commit SHA; OSSF Scorecard runs continuously.
- **Supply chain, outbound.** Releases are published only by the release workflow with `npm publish --provenance` (SLSA attestation minted via OIDC); no maintainer laptop publishes.
- **Contribution surface.** CODEOWNERS routes every change to rules, templates, workflows and CI through maintainer review; a rule change is a reviewable markdown diff, and renames/removals go through tracked migrations rather than silent edits.
- **The lying manifest.** An operator (or their agent) can claim `applied` with a fabricated pointer. The gate makes this expensive rather than impossible: rows must exist for every expected rule (docs/adr/ADR-0001), the mapping cannot be vacuously stripped (ADR-0002), typed pointers must resolve to non-empty files with the named line, symbol or test present (ADR-0019), signed rules must point at content matching the rule's signature (ADR-0020), stale pointers block, and sealed evidence is hash-verified (ADR-0021). **The honest limit:** a pointer to real code that does not actually implement the rule — or a signature token pasted in a comment — passes the deterministic layer. The gate verifies bytes; the operator reading the pointers, and the advisory semantic pass (ADR-0007), carry the judgment. runward raises the cost of the lie; it does not abolish it, and its output never claims otherwise.
- **Blast radius on write.** runward writes only inside `runward/` and files the operator explicitly requests; it never touches `.git/`, CI config, or the operator's source (docs/adr/ADR-0012).

## 4. Approval points

runward executes no consequential actions autonomously — every run is operator-invoked and read-mostly. The approval points are human process, enforced where they live:

| Action | Approval trigger | Presentation to the human | If no response |
|---|---|---|---|
| Merging a change to rules/templates/CI | always — CODEOWNERS review | the markdown/YAML diff itself | PR stays open |
| Publishing a release | maintainer creates the GitHub release that triggers the provenance workflow | the tagged diff and changelog | nothing publishes |
| Crossing a gate on evidence | the operator reads the strict-gate report and the pointers it verified | per-rule verdict with named problems | exit 1; the phase stays open |

## Rule conformance

> Account for every CRITICAL/HIGH craft rule mapped to the govern phase (`runward/rules/`, frontmatter `phases: [govern]`). `applied` needs a pointer; `deviated` needs an ADR; `n/a` needs a reason. `runward check --strict` verifies this table.

| Rule | Status | Evidence |
|---|---|---|
| async-job-guardrails | n/a | there are no background jobs: every run is a synchronous, short-lived, operator-invoked process; nothing queues, retries or runs unattended |
| config-secrets-boundary | applied | the only secret in the product's lifecycle (npm publish credential) is attached by infrastructure at the CI boundary — OIDC-minted per release, never present in the repo, the package or the CLI: file:.github/workflows/release.yml#id-token |
| data-memory-provenance | n/a | there is no memory store: nothing written from untrusted content persists to influence later runs — each gate run reads the working tree fresh |
| eval-loop | n/a | no non-deterministic behavior exists to evaluate: the verdict is a pure function, tested (unit, fuzz, golden, smoke) rather than scored — governance/evaluation-rubric.md records what replaces each instrument |
| resilience-fail-open | applied | the verdict fails closed — malformed rows, unknown rules, unresolvable pointers and stripped mappings are violations, never skips: file:src/lib/conformance.ts#conformance; advisory layers (coverage, proof freshness) degrade open without touching the verdict: file:src/commands/check.ts#checkCommand |
| resilience-multi-provider-fallback | n/a | no provider exists to fall back from: the CLI makes no external call of any kind (structural zero-network) |
| resilience-retry-backoff | n/a | nothing to retry: no network call, no rate limit, no transient dependency — the only I/O is the local filesystem |
| security-code-execution-sandbox | n/a | runward executes no model-produced code, ever; the single execution seam is the opt-in, operator-authored hooks file run only under --hooks (docs/adr/ADR-0008), and evidence checks read bytes, never execute |
| security-human-agent-trust | applied | every figure the gate prints is computed, and what remains judgment is labeled as such — advisory sections never claim verification: file:src/commands/check.ts#checkCommand; the compliance pack is stamped a readiness draft, never a claim: file:src/lib/compliance.ts#renderOscal |
| security-mcp-server-pinning | n/a | no MCP server or remote tool is consumed (structurally zero-network); the analogous pins exist on the real supply chain — SHA-pinned actions and a lockfile (§3 guardrails) |
| security-prompt-injection | n/a | no model, no context window: hostile text in a mission file is parsed as data by deterministic code and cannot become an instruction (§2); harness-side injection belongs to the operator's harness, above the gate |
| security-tool-change-reapproval | n/a | no model-facing tool registry to re-approve; the adjacent discipline exists where change actually happens — rules and templates change only through CODEOWNERS review, with renames as tracked migrations (docs/adr/ADR-0006) |

## References

- [evaluation-rubric.md](evaluation-rubric.md) — the test suite as the product's rubric.
- [observability-schema.md](observability-schema.md) — why there is no telemetry surface to defend.
- docs/adr/ADR-0009 — OWASP Agentic Top 10 as the gate's risk grammar (the rules map to ASI classes; this file models runward itself).
