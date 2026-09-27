# Threat Model: runward

**Version**: v0.42.2 · **Last review**: 2026-09-27 · **Agent privilege level**: not applicable — runward is not an agent; it is a deterministic CLI with no model, no network on the verdict path, and no autonomy. Since ADR-0065 one of its outputs is read by a model: the gate-hook refusal (§1, §2)

runward's threat picture is unusual and worth stating plainly: the classic agentic surfaces (context window, tool registry, memory) do not exist here, because there is no model in the system. One output does reach a model: `runward gate-hook` returns its refusal into the coding agent's loop (docs/adr/ADR-0065-the-gate-can-be-armed-only-by-the-operators-hand.md), and that refusal quotes text from the mission files. What remains is what any security-relevant developer tool faces — the supply chain, malicious contributions, and the ways an operator can be lied to — plus one threat specific to runward's purpose: a manifest that games the gate.

## 1. Attack surfaces

| Surface | Description | Trust | Primary risk |
|---|---|---|---|
| npm supply chain (inbound) | the three runtime dependencies and the dev toolchain | third-party | a compromised dependency executing in the operator's CI |
| npm supply chain (outbound) | the published `runward` package | maintainer-controlled | a tampered or impersonated release reaching operators |
| Contributed rules and templates | PRs touching `templates/rules/`, workflows, adapters | untrusted until reviewed | a malicious or subtly weakened rule lowering every adopter's gate |
| The operator's mission files | manifests, ADRs, evidence pointers read by the gate | untrusted input to the gate | a manifest crafted to pass without the underlying work existing |
| The gate's own code (`src/`) | a change that silently adds network, model calls, or weakens a check | maintainer-reviewed | the zero-LLM/zero-network invariant eroding unnoticed |
| Opt-in operator hooks (`runward/hooks.json`) | commands run unsandboxed, without a timeout, under `check --hooks` (docs/adr/ADR-0008) | operator-authored, in a tree an agent can also write | a command the operator did not write, run by an operator or a CI that passes `--hooks` — deviation recorded in runward/adr/ADR-0003 |
| The gate-hook refusal (ADR-0065) | the refusal returned into the coding agent's loop, blocking its turn; it quotes rule ids, paths and evidence text from the manifests, truncated, not escaped | runward-generated from untrusted mission text | evidence text crafted to read as an instruction, relayed with the authority of a harness block — deviation recorded in runward/adr/ADR-0004 |
| Shipped adapters (`plugins/`, `wire`) | the harness hooks run `npx --yes runward …` at every turn end, not version-pinned | npm registry | an unpinned fetch of the latest release on every run |

## 2. Lethal trifecta

runward has no context window of its own: it calls no model. The structural equivalents are assessed, including the one path where its output enters a model's context (gate-hook):

| Path | Private data | Untrusted content ingested | Outbound communication | Verdict |
|---|---|---|---|---|
| `check` / `manifest` / `rules` / `compliance` | reads the operator's tree | yes — mission files are parsed as data by deterministic regex/JSON code, never executed, never interpreted as instructions | none — structurally no network | safe |
| `characterize --mine` | reads local git history | yes — commit messages, as data | none | safe |
| `check --hooks` (opt-in) | whatever the hook touches | possibly — `hooks.json` lives in the tree the agent edits, and runward cannot tell who wrote it | whatever the hook does | deviation accepted (runward/adr/ADR-0003): never run by plain `check` nor by the shipped actions |
| `gate-hook` (armed tier, ADR-0065) | none added — it relays what the agent can already read in the tree | yes — manifest evidence text, quoted in the refusal | none — the refusal goes back to the same agent, not outward | bounded, accepted (runward/adr/ADR-0004): no private data and no egress are added, but the relay raises the text's authority |

## 3. Guardrails

- **Zero network on the verdict path, structurally.** No network or model-SDK import can land in `src/`: a CI grep guard blocks the obvious routes (HTTP clients, model SDKs, dynamic imports, `eval`, network shell-outs), and the `core-offline` job runs the core suites inside a network namespace with no external interfaces — a network call anywhere in the core fails the build. Outside the verdict path the CLI runs local `git` (characterize, doctor) and, under `--hooks`, operator commands (ADR-0054 lists these crossings).
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
| async-job-guardrails | n/a | the CLI runs no background job: every run is a synchronous, operator-invoked process. The repository's two scheduled workflows (watch-external-facts, scorecard) are lifecycle tooling outside the product; the first already runs under a concurrency group and refreshes a single tracking issue instead of duplicating it |
| config-secrets-boundary | applied | file:reports/secretlint.sarif; file:reports/secretlint-control.json#rulesProvenLive — a committed secrets scan of src, scripts, docs, templates, workflows and root files, zero findings, and its SENSITIVITY proved in the same run: the step plants three fake credentials (AWS, GitHub, npm) and refuses to write the clean report unless the scanner sees all three. The only publish credential is attached by infrastructure at the CI boundary, OIDC-minted per release, never present in the repo, the package or the CLI: file:.github/workflows/release.yml#id-token |
| data-memory-provenance | applied | test:reports/junit.xml::"a proposal is never counted as its underlying status — the 0.38 half of fail-closed"; file:src/lib/ratify.ts; adr:0066 — the one persisted input an agent can write, a proposed manifest row, carries declared provenance (the proposer segment), stays quarantined (a proposal never crosses the gate) and becomes a decision only by human ratification, which the regulated tier binds to the row's content (docs/adr/ADR-0080) |
| eval-loop | n/a | no non-deterministic behavior exists to evaluate: the verdict is a pure function, tested (unit, fuzz, golden, smoke) rather than scored — governance/evaluation-rubric.md records what replaces each instrument |
| resilience-fail-open | applied | test:reports/junit.xml::"fuzz: 500 malformed manifests never throw and never pass the expected rule"; test:reports/junit.xml::"conformance: an unknown rule is a violation, a [placeholder] row is not"; test:reports/junit.xml::"obj 11: the verdict is identical whether verify-findings is present, empty, or adversarial" — the verdict fails closed on malformed rows, unknown rules and unresolvable pointers (file:src/lib/conformance.ts#conformance), while the advisory layer degrades open without touching the verdict |
| resilience-multi-provider-fallback | n/a | no model provider exists to fall back from: the verdict path makes no network call (ADR-0054, core-offline CI job). The CLI's only external processes are local git and, under the opt-in --hooks, operator-authored commands; neither is a provider with an alternative |
| resilience-retry-backoff | n/a | nothing to retry: no model call, no network call, no rate limit on the verdict path. The only I/O beyond the local filesystem is local git and the opt-in operator hooks, whose failures are reported as such, not retried |
| security-code-execution-sandbox | deviated | ADR-0003 (adr:0003) — under the opt-in --hooks flag, runward runs the commands in runward/hooks.json unsandboxed, in a tree an agent can write; accepted on product ADR-0008's npm-scripts trust model: never run by plain check nor by the shipped actions and adapters, reopened toward an allowlist or signed hooks |
| security-human-agent-trust | applied | test:reports/junit.xml::"non-TTY ratify refuses; --attest-blind ratifies, records BLIND, and every later check discloses it"; every figure the gate prints is computed, and what remains judgment is labeled as such — advisory sections never claim verification: file:src/commands/check.ts#checkCommand; the compliance pack is stamped a readiness draft, never a claim: file:src/lib/compliance.ts#renderOscal |
| security-mcp-server-pinning | n/a | runward consumes no MCP server, plugin or remote tool endpoint: the verdict path is network-free by construction (ADR-0054, core-offline CI job under unshare -n). The analogous pins exist on the real supply chain: every GitHub Action pinned by commit SHA, a lockfile for the three runtime dependencies (§3 guardrails) |
| security-prompt-injection | deviated | ADR-0004 (adr:0004) — no model runs inside runward, but the gate-hook refusal (ADR-0065) relays mission evidence text into the agent's loop, where it reads with a harness block's authority (§1, §2). Accepted as bounded: it adds no private data and no egress; the product change that would quote the relayed text as data is the ADR's reopening trigger |
| security-tool-change-reapproval | n/a | no model-facing tool registry to re-approve. The discipline exists where definitions change: the mission's rule corpus is hashed in scaffold-lock.json and any edited rule fails check --strict until re-recorded, a ratification is bound to its row's digest and unbinds when the row changes (ADR-0080), and rule renames are tracked migrations (ADR-0006) |
| checklist-pre-production-observability | n/a | a short-lived process (about 0.3 s for check --strict on this repository, measured 2026-09-27) emits no runtime telemetry by invariant (ADR-0054: no export in the verdict path). Its observability is its exit codes, the machine payloads (--json, SARIF) and the committed traces it appends (gate-bypass.log, adapters/installed.log); observing a mission over time is the operator's CI |
| checklist-pre-production-performance | n/a | a local CLI with no endpoint, no session and no concurrency surface: load, latency percentiles and saturation have no object. test/bench-scale.js measures the gate on the reference mission and under 10,000 uncited files when run by hand; it runs in no CI job and asserts no threshold (product ADR-0081 refines ADR-0075 on that point) |
| checklist-pre-production-resilience | n/a | a single-process CLI with no uptime, no network dependency and no model: healthchecks, retries, fallbacks and load have no object; the failure mode is an exit code. Its only downstream processes are local git and the opt-in operator hooks, run without a timeout by design: a hung hook is the operator's command, bounded by their CI or harness timeout |
| checklist-pre-production-security | applied | test:reports/junit.xml::"ADR-0054 crossing 1: the verdict path imports no socket and no process spawner, transitively" — the property that matters most here (no spawn, no socket on the verdict path) is proven by a test that walks the import graph. file:reports/eslint-security.sarif is the committed static security scan (its exclusions named with their measured counts in eslint.security.config.js). file:.github/workflows/ci.yml#vulnerabilities; file:SECURITY.md — the dependency audit, the zero-network guard and the network-isolated test leg run on every push, the security policy is published |
| routing-confidence-upgrade | n/a | no model, no router: nothing routes by confidence in a deterministic CLI (zero-LLM invariant, docs/adr/ADR-0001) |

## References

- [evaluation-rubric.md](evaluation-rubric.md) — the test suite as the product's rubric.
- [observability-schema.md](observability-schema.md) — why there is no telemetry surface to defend.
- docs/adr/ADR-0009 — OWASP Agentic Top 10 as the gate's risk grammar (the rules map to ASI classes; this file models runward itself).
