# ADR-0054: the runtime boundary is explicit

**Date**: 2026-08-14
**Status**: accepted 2026-08-14 (the consolidated boundary test exists and passes on the built binary; record below; this document crosses nothing)

## Context

A technical-roadmap investigation on 2026-08-14 (six agents, counter-expertised) asked what runward
would need to BE, in code and infrastructure, to become a credible enterprise-grade governance base
for an agentic factory — without becoming a runtime. It produced a set of buildable objectives
(a verdict attestation, committed-tool evidence adapters, a pinnable rule corpus, a fleet rollup)
and one recurring finding: **every one of them is one design slip away from turning runward from a
frame into a runtime, and that slip destroys the moat.**

The moat is four properties, and each is a direct consequence of runward NOT running: independent
(the judged party does not manufacture the judge), survivable (a verdict re-runs months later on the
repo alone), agent-agnostic, and deterministic (no LLM, no network in the verdict path). A hosted
service, a daemon, a held key, a live cross-repo read — each dissolves one of the four.

The boundary already exists, but scattered across a dozen decisions, never stated as one line:

- **No HTTP/registry endpoint.** "runward is never a runtime; the CLI is the seam, scripts compose
  it" ([ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md):23).
- **No daemon, watcher, or auto-installer.** "the cure for 'the gate doesn't run automatically' is
  not for runward to become the thing that runs it. A daemon, a file-watcher, a runward-managed hook
  runtime … would each turn runward from a frame into a runtime — the one thing the doctrine forbids
  it to become" ([ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md):14,40).
- **No reading beyond the mission tree.** "runward never computes the change set … the CLI reads
  your mission repo, never your behavior — the moment runward runs git against a base ref, it stops
  reading its own data and starts reading the state of the harness"
  ([ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md):29), backed
  by the load-bearing contract "Same working tree ⇒ same verdict and same machine outputs".
- **No LLM or network in the verdict path** ([ADR-0007](ADR-0007-advisory-llm-conformance-verification.md),
  [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md)).
- **No key or identity the operator does not hold** ([ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md)
  threat model; ADR-0011 no identity broker).
- **The operator layer stays outside the CLI** ([ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md)).

A reader assembling the roadmap has to reconstruct the boundary from six ADRs. The three
thesis-risk objectives (opt-in signing, a shared corpus, a fleet rollup) each need it stated as a
single testable invariant BEFORE they are built, not litigated one PR at a time. This ADR writes
the line down and makes it the check every future objective passes.

## Decision

**The invariant, in one sentence.** runward stays a delivery gate — never a runtime or hosted
service — for exactly as long as the verdict, the rules, and any fleet rollup are **computed
in-repo, on demand, and carried as artifacts the operator owns**, never **produced, held, watched,
served, or aggregated by a process runward operates**. Emitting a deterministic file is a gate
output; operating a process that stores, serves, watches, or aggregates it is a runtime.

**The crossings, enumerated.** The boundary is crossed by ANY one of:

1. **A network-reachable endpoint** that serves rules, verdicts, or aggregated outcomes — an
   HTTP/rules-registry API or a hosted compliance portal (ADR-0024).
2. **A long-lived process between gate invocations** — a daemon, a file-watcher, an auto-installer,
   a drift monitor (ADR-0012).
3. **runward holding state, a key, or an identity the operator does not** — signing on the
   operator's behalf, brokering agent identity, or storing fleet state (ADR-0011/0021).
4. **Reading beyond the single mission tree it judges** — a second repo's working tree, git history,
   a base ref, or the harness's behaviour — which also breaks "same working tree ⇒ same verdict"
   (ADR-0039/0041).
5. **Any data flow, telemetry export, LLM call, or network call in the verdict path** (ADR-0007/0011).

**The corollary for the fleet.** Everything beyond the per-repo gate — cross-repo aggregation,
adoption metrics, an org-wide dashboard — lives in the deferred operator satellite
([ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md)), outside the MIT CLI, summoned
only on a real demand signal, and even there it is **assembled from artifacts each repo already
emitted, never from a live pipe into the repos**. Distribute governance into each repo; the moment
it is centralized into something that runs, the four-way moat is gone.

**How new objectives use this.** Every objective on the technical roadmap declares which side of the
line it sits on — *thesis-consistent CLI+artifacts*, *operator satellite (ADR-0039)*, or *not code*.
The two objectives that touch the boundary most (opt-in signing, a shared corpus) ship ONLY with a
blocking test of the specific invariant they risk: the key stays the operator's, the corpus resolves
with no live fetch. This ADR is the reference those tests cite.

## Alternatives considered

- **Leave the boundary implicit, as it is today.** It held for 53 ADRs because the surface was
  small. The roadmap's attestation, corpus and fleet work each proposes something that *emits*
  toward a standard (in-toto, cosign, a registry-shaped corpus), and the distance from "emit a file"
  to "operate a service" is one design decision. An implicit boundary is re-argued every time; an
  explicit one is checked once.
- **Enforce the whole boundary with one linter/test.** Parts are already mechanized and stay so —
  the CI zero-LLM / zero-network guard, the no-exec offline test, the "same working tree ⇒ same
  verdict" contract. But "a decision to serve rules over HTTP" is an architecture choice a test
  cannot pre-empt; the boundary is doctrine first, with tests enforcing the mechanizable crossings
  (network, exec, cross-tree reads, verdict-path purity). This ADR names both halves.
- **Fold the line into ADR-0039.** ADR-0039 is about the operator LAYER (adoption self-audit, cost
  recipes) staying out of the CLI. The runtime boundary is broader — it governs the CLI's own
  surface too (no daemon, no key, no cross-tree read), not only the satellite. It deserves its own
  statement that ADR-0039 becomes one instance of.

## Consequences

- **The roadmap gets a single gate.** Each new objective is checked against five enumerated
  crossings before it is built, not after it ships. A proposal that needs runward to host, watch, or
  hold state is rejected on this ADR by name, the way ADR-0041 rejected `--changed`.
- **The mechanizable crossings become a named test surface.** The existing guards (CI zero-network /
  zero-LLM, offline no-exec, same-tree determinism, the ADR-0045 audit corpus) are consolidated as
  the boundary's enforcement floor, so a future PR that adds a socket, a spawn, or a base-ref read to
  the verdict path reddens.
- **The satellite is quarantined by construction.** A fleet rollup that reads emitted artifacts in
  the operator's own infra is inside the line; the same rollup as a hosted always-on dashboard, or
  one that reads a repo's working tree, is outside it. The category label does load-bearing work, and
  this ADR is what makes the label checkable.
- **Nothing ships or changes for a user.** This ADR consolidates existing doctrine and adds a test
  surface; `node dist/cli.js check --strict` on this repository must read exit 0 before and after.

## What this does not claim

- It does not forbid the OPERATOR from building a service around runward's emitted artifacts — a
  dashboard over `check --json`, a registry that vendors the rule package. That is the operator's
  runtime, on the operator's side of the seam; the boundary is about what *runward* operates.
- It does not add a command, a flag, or a behaviour. It is doctrine plus a consolidated test.
- It does not make the boundary un-crossable by a future decision; it makes crossing it a *visible,
  named* decision — a superseding ADR, argued in the open — rather than a silent slide.

## Ratification

**Accepted 2026-08-14.** The consolidated boundary test is `test/unit/runtime-boundary.test.js`,
green on the built binary. The audit of 2026-08-14 named the debt this ratification closes: this
ADR — the anchor of the thesis — sat `proposed` under two accepted dependents (ADR-0055, ADR-0057)
while its consolidated tests did not exist. Evidence against each criterion:

1. **No network / no exec in the verdict path** — proven structurally: the TRANSITIVE import closure
   of `dist/lib/verdict.js` contains no socket module and no process spawner (http/https/net/tls/
   dgram/child_process/worker_threads/cluster/repl), with a `require()`-blindness guard on every
   closure file, and a negative control asserting the crossing modules DO exist elsewhere in the CLI
   (`hooks.ts` — the operator's own checks, outside `computeVerdict`; `characterize.ts` — local git
   archaeology) so the boundary test cannot pass vacuously. The CI `unshare -n` block remains the
   dynamic network half (`.github/workflows/ci.yml`), consolidated by citation.
2. **Same working tree ⇒ same verdict** — `check --strict --json` is byte-identical across two runs
   on an unchanged tree, and a grep-level guard asserts no command source speaks
   `--changed`/base-ref (mirroring ADR-0041's own guard). Both in `runtime-boundary.test.js`.
3. **The verdict ignores advisory LLM output** — the existing
   `test/unit/verify-findings-out-of-verdict.test.js` (verdict byte-identical whether the
   verify-findings file is present, absent, empty, or adversarial) is the proof; the boundary test
   pins the citation so it cannot be silently deleted while this ADR stays accepted.
4. **Global invariant** — `node dist/cli.js check --strict` exits 0 before and after;
   `no-overclaim` green.

The criteria as originally set, kept as the record of the bar:

1. **No network / no exec in the verdict path.** A test (consolidating the CI `ci.yml` zero-LLM /
   zero-network guard and the offline no-exec guard) asserts that `check` and `check --strict` open
   no socket and spawn no process while computing the verdict.
2. **Same working tree ⇒ same verdict.** A test asserts `check --strict --json` is byte-identical
   across two runs on an unchanged tree (extending the port-contract invariant), and that no command
   accepts a `--changed`/base-ref argument (grep-level, mirroring ADR-0041's own guard).
3. **The verdict ignores advisory LLM output.** The existing "verdict byte-identical whether the
   verify-findings file is present, absent, empty, or adversarial" test is cited here as the
   verdict-path-purity proof (ADR-0007).
4. **Global invariant.** `node dist/cli.js check --strict` on this repository exits 0 before and
   after, and `no-overclaim` stays green (this ADR argues the boundary, it asserts no capability).

Every objective ADR that follows (ADR-0055, ADR-0056, ADR-0057) cites this one for the side of the
line it is on.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2026-11-05.

The decision is wrong and must be revisited if any holds: a capability operators genuinely need turns out to require a crossing, and refusing it costs more than the boundary buys (the honest form of "the thesis was too strict"); the boundary test starts passing vacuously (a crossing enters through a path the import closure does not see, e.g. a dynamic import or a spawned helper); or the seam to the satellite proves unusable in practice, which would mean the line is drawn in the wrong place rather than that there should be no line.

**Watched via**: `runtime-boundary.test.js`, the CI network-cut run, and any capability request.

## Amendment, 2026-08-26 — the trigger fired, and the answer is a wider ring, not a wider boundary

**The condition this ADR wrote for itself was already met when it was written.** The trigger names
*"the boundary test starts passing vacuously … e.g. a dynamic import"*. An adversarial audit planted
five mutations on a copy of the built tree and measured what `runtime-boundary.test.js` said:

| mutation | before | after |
|---|---|---|
| a spawner imported into `dist/commands/check.js` | **4 tests green** | 3 failures |
| `await import("node:https")` in `verdict.js` | **4 tests green** | 5 failures |
| `createRequire(...)("net")` in `verdict.js` | **4 tests green** | 5 failures |
| control: `import __net from "node:net"` | 1 failure | 5 failures |
| `baseRef` in `src/lib/verdict.ts` | **4 tests green** | 3 failures |

Four causes, all in the instrument and none in the boundary:

1. The closure started at `dist/lib/verdict.js`. `check.js` imports `verdict.js`, never the reverse,
   so **the module that owns the exit code was never walked**.
2. The import regex required whitespace after `import`, so a dynamic `import("…")` was invisible.
3. The blindness guard matched `require(` and not `createRequire(`.
4. The `--changed`/base-ref grep covered `src/cli.ts` and `src/commands` and never `src/lib`, which
   is where the verdict lives.

**The decision is unchanged and is not weakened.** The boundary still runs through the verdict, and
the five enumerated crossings are the same five. What changes is that the instrument now walks a
second, wider ring from `dist/commands/check.js` — 18 modules instead of 10 — where exactly one
crossing is allowed, `node:child_process`, from exactly one importer, `hooks.js`, which this ADR
already enumerates as operator-triggered. Everything else is refused by name. The allowance is
asserted to still be USED, so the wide ring cannot silently collapse into the narrow one.

Filed as RWD-2026-0073. The lesson is not about sockets: a boundary is worth what its instrument
detects, and this instrument had never been shown a mutation it was supposed to catch.

## References

- [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) — no daemon/watcher; the frame does not become the thing that runs it
- [ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md) — no HTTP/registry endpoint; the CLI is the seam
- [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) — the operator layer (and the fleet satellite) stays outside the MIT CLI
- [ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) — no `--changed`; reads the mission tree, never the harness's behaviour; same working tree ⇒ same verdict
- [ADR-0007](ADR-0007-advisory-llm-conformance-verification.md) — no LLM in the exit-code path
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) — no identity broker; versioned ports, not a service
- [ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) — the threat model: never a key the operator does not hold
