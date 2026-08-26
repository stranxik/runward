# Port Contract: the gate port

## Port: Gate port (process contract)

**Contract version**: v1 — stable; evolves additively only
**Port type**: primary (drives the domain: every harness, CI and human consumes the gate through it)
**Known adapters**: GitHub Actions / GitLab CI / pre-commit samples in `templates/adapters/` (inert — the operator wires them, docs/adr/ADR-0012); any agent harness that can run a process

## Business intent

An operator — human, CI job, or agent harness — asks one question: *can this phase gate be crossed?* The port answers deterministically from the working tree, with no model, no network, and no side effects beyond requested writes. "Gate" here means the documentary check (every CRITICAL/HIGH rule accounted for with verified evidence), never a judgment of code quality — that boundary is part of the contract's meaning.

## Signature

```
runward check [--strict] [--hooks] [--coverage] [--freeze] [--json] [-p PATH]   -> exit code + report (stdout)
runward rules --json [-p PATH]                                          -> versioned JSON (stdout)
runward compliance <regime> [-p PATH]                                   -> files under runward/compliance/
```

All operations are read-only on the operator's code; idempotent (`--freeze` rewrites the seal deterministically); synchronous. **One exception, named because this contract is offered to an evaluator**: `check --hooks` executes the shell commands the operator's own `runward/hooks.json` carries, so it acts on the world exactly as far as those commands do — including outside the audited repository. It is opt-in and inert without the flag (runward's own gate never runs them, so a clone cannot run anything by surprise), and the run reports how many ran and how many failed. Every other operation acts on nothing, which is why none requires approval.

## Output schema

**Exit codes — the load-bearing contract** (consumed blind by CIs):

| Value | Meaning | Consumer reaction |
|---|---|---|
| 0 | gate clean (with `--strict`: every expected rule accounted for, every typed pointer verified, seal intact) | cross the gate / merge |
| 1 | gaps — deliverables unfilled, conformance violations, drift, broken seal, failed hooks | block; the report names each violation and the fix gesture |
| 2 | no mission found, or CLI misuse (unknown command/flag) | configuration error — distinct from a gate failure by design, so a typo never reads as "gate red" |

**`rules --json`** (docs/adr/ADR-0024): `{ runward, source, count, gateNonScope, gatedPhases[], rules[] }`, rules sorted by slug, each carrying `slug, title, impact, phases, asi, tags, appliesTo, governs, noTerritory?, signature?, why?, nonScope?`. `gateNonScope` is what NO green row proves (docs/adr/ADR-0040), stated once; a rule's own `nonScope` narrows it, never replaces it. `gatedPhases` is the sorted set of phases a gate can require a rule on, read from `GATED_DELIVERABLES`: a consumer computing "how many rules can the gate require" must read it rather than restate it (the published catalog restated four of five and understated the gate by four rules, 2026-08-01). **Versioned and additive**: fields are added, never renamed, repurposed or removed; consumers are tolerant readers.

**`rules --for <paths> [--json]`** (docs/adr/ADR-0041): which rules declare a territory covering these project-relative paths. Adds `selector: { for[], globDialect }`, `territories: { declaring, patterns[] }` (what was looked for, as declared — so an empty answer reads as a fact, never a silence), `unscoped: { count, declaredNoTerritory, unreviewed, total, note }`, and `matchedBy[]` per rule — each entry `{ kind: "appliesTo", pattern, path }`, the pattern that retained the path, on the `git check-ignore -v` model. **Always exit 0**: an empty match is a reading, never a verdict; exit 2 only when the question cannot be asked (a path that is absolute or escapes the project). Pure string matching — no filesystem access, no git, no model; runward never computes the change set, the caller supplies the paths. **A rule carries no territory for two opposite reasons, and they are counted apart**: it declares it has none (`noTerritory:`, a decision with its reason) or nobody has ruled on it yet (`unreviewed`, the only one that is a backlog). `count` stays the sum, unchanged since v0.24.0 — but note its meaning is **extensional**: rules declaring no territory in **any** carrier. Since v0.27.0 a rule may declare a `governs:` category that nothing in this mission binds to a file; such a rule *has* a territory yet could not be evaluated, and is counted in `territoryStates.unresolved`, never in `unscoped.count`. A consumer reading `unscoped.count` as "everything `--for` could not evaluate" now under-counts.

**`territoryStates`** (docs/adr/ADR-0043): the full partition beside `unscoped`, additive — `{ matched, evaluated, unresolved, declaredNoTerritory, unreviewed, total }`, summing to `total`. `evaluated` = territory fully resolvable here, no path matched. `unresolved` = a declared category nothing binds — the question could not be asked; it is neither a scope nor a backlog. Resolution is mission-wide, matching is per-path: a category is unresolved only when **no** file carries it, never merely because the paths asked about fall outside it.

**`map`** (docs/adr/ADR-0043, tier 3): `runward/territory.md` — the mission declares which of ITS files carry which category, completing derivation where a deployment manifest cannot reach (a manifest declares an execution topology, never the nature of the code behind it). Markdown by necessity, not taste: the match reason must carry a line number, and `JSON.parse` destroys positions. Four columns — pattern (the same glob dialect) · category (the closed vocabulary) · effect (`declare` | `remove`) · why (mandatory, and a placeholder is refused). **Precedence, named never inferred: the last matching row wins per (path, category); derivation < map < a rule's own `appliesTo`, which the map may never narrow** — a mission able to silently shrink its own coverage would be the weak verifier ADR-0040 refuses. Every refused row is reported with its line; a row whose category no rule governs, or a `remove` for a category nothing derives, is reported as inert. runward never writes this file: init does not scaffold it and update does not refresh it.

**`derivation`** (docs/adr/ADR-0043): `{ bindings, categoriesResolved[], notes[] }` — what bound files to categories, read from deployment manifests the operator already wrote (never from project code), and what each adapter could not do (`read | unread | absent | ambiguous`, each with a detail). An unparseable or unmodelled manifest derives **nothing** and says which; "nothing is declared" and "I could not read it" are never collapsed. `matchedBy` gains a `{ kind: "category", category, path, via: { source, adapter, file, line, declaration } }` member carrying both levels of the reason; it has no `pattern` (a pattern is a glob), and a glob match stays at `matchedBy[0]` when a rule matches through both carriers.

**Compliance pack** (docs/adr/ADR-0016): regime-framed markdown plus an OSCAL **1.2.2** component-definition, schema-valid against the official NIST schema, deterministic for a given tree and date, always labelled a readiness draft — never a compliance claim.

**`runward/evidence-lock.json`** (docs/adr/ADR-0021): `{ version: 1, sealedAt, files: { <root-relative path>: <sha256> } }`, keys sorted, byte-idempotent on unchanged evidence.

## Invariants

- Same working tree ⇒ same verdict and same machine outputs (report dates aside). Determinism is the contract.
- No network I/O, no model call, no telemetry — structurally enforced in CI.
- Reads never mutate; writes are confined to `runward/` and explicitly requested paths.
- Exit code 2 is reserved for "the question could not be asked"; a red gate is always 1.

## Errors

| Error | Type | Meaning for the consumer |
|---|---|---|
| exit 2, "No runward/ mission found" | business | run `runward init` first; not a gate failure |
| exit 2 on unknown command/option | validation | fix the invocation; CI should fail loudly, not retry |
| exit 1 with named violations | business | the gate is red; fix the named rows/pointers, re-run |

## Evolution rule

- **Versioned**: the JSON surface carries the runward version; the OSCAL output pins its schema version; the lock file carries `version: 1`.
- **Additive by default**: new commands, flags, JSON fields and report sections may appear; existing exit-code semantics, JSON fields and file shapes never change meaning.
- **Expand then contract**: a genuinely breaking change (none so far) would ship alongside the old shape for a deprecation window and land in the changelog as a major bump.
- **Consumer-driven verification**: the smoke suite plays the consumers — it asserts exit codes, JSON shape and pack layout exactly as a CI adapter would consume them, so a producer change that would break an adapter fails the build first.
- **Provenance**: consumers are the shipped adapters and downstream CIs; the changelog and docs/adr/ record every surface change.

## References

- [../architecture.md](../architecture.md) §3 — the port map this contract belongs to.
- docs/adr/ADR-0012 (port + inert adapters), ADR-0016 (compliance pack), ADR-0021 (seal), ADR-0024 (machine rule surface).
