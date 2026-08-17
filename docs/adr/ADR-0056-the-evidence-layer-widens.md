# ADR-0056: the evidence layer widens, and never leaves GATE_NON_SCOPE

**Date**: 2026-08-14
**Status**: accepted 2026-08-14 (the three widenings are delivered with their proofs; record below; this document crosses nothing)

## Context

The 2026-08-14 technical-roadmap investigation found that runward's evidence layer — typed pointers
verified for presence, resolution, integrity and identifier-boundary shape
([ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md),
[ADR-0020](ADR-0020-rule-evidence-signatures.md)) — covers only a slice of the evidence a real
agentic factory already produces. A factory's deliveries carry committed test reports (JUnit), scan
results (SARIF), and, increasingly, spec-driven-development artifacts (a constitution, a spec, a
task list). The gate can rest a rule row on those artifacts **as files**, widening its reach across
the factory's real tooling — Kosli/JFrog's typed-attestation idea without the hosted vault — while
staying exactly inside its declared non-scope.

That non-scope is the load-bearing constraint, and every widening below sharpens the reason to keep
stating it: `GATE_NON_SCOPE` means a green row proves an evidence pointer is present, resolving,
non-vacuous and shape-matched — **never** that the code implements the rule or that a criterion is
semantically met. The more evidence types the gate admits, the more tempting it is to slide from
"the evidence has the rule's shape" to "the evidence satisfies the rule", and the instant it does,
an LLM enters the verdict and the moat ([ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (5),
[ADR-0007](ADR-0007-advisory-llm-conformance-verification.md)) is gone.

## Decision

Three widenings, each a shape/presence check, none a semantic judgment.

**1. Sign the CRITICAL/HIGH rules whose text prescribes a token.** 0.34.0 signed 5 rules (6 of 64)
on the ADR-0020 machinery; continue the adjudication rule by rule so a CRITICAL row can rest on a
signed rule far more often. This is **editorial authoring** (a `signature:` regex justified by tokens
the rule text prescribes, plus a `nonScope`), not new code — the shape-match machinery is complete
and tested. A rule whose idiom is illustrative rather than a code token stays unsigned, and each
refusal is named (ADR-0020's own discipline: a forced signature manufactures a false red, which
erodes the gate faster than a gap). A signature remains a SHAPE match — does the evidence look like
the rule — never a judgment that it works.

**2. Committed-tool evidence adapters (JUnit, SARIF first).** Deterministic, read-only adapters that
resolve a rule row's pointer against a **committed** `junit.xml` / SARIF file — a named test case, a
scan result — so the row rests on a real, resolving artifact the factory already produces. The
boundary is exact and blocking: **the adapter reads the committed file; it never spawns the scanner
or the test runner.** Executing the tool would make runward run the delivery's code — the ADR-0054
runtime crossing — so the input is always a committed artifact, never a live invocation. Later
adapters (SCA output, a committed PR-review record) follow the same rule; the moment an adapter
reaches a live API or a base ref, it has crossed the line.

**3. A deterministic spec/constitution-conformance evidence type.** A `GATE_NON_SCOPE`-safe evidence
type that checks **presence + integrity + pointer-linkage** between a spec-driven bundle
(constitution / spec / plan / tasks) and the delivered artifacts: does each declared acceptance
criterion carry a resolving pointer to a present test or file; is the spec-delta internally
consistent. "Coverage" here means **pointer-presence**, never satisfaction. This is the hard,
re-verifiable verdict the LLM-prose-gated SDD ecosystem (spec-kit, OpenSpec, BMAD) structurally
cannot produce — a deterministic yes/no where their gate gives an advisory opinion. It ships with an
explicit non-scope assertion, tested as a blocking case: the type reddens when a declared criterion
has no resolving pointer, and **never** claims the criterion is semantically met. The instant it
would judge meaning, it is an LLM judge, and this decision forbids that by construction.

These widen what the verdict attests to ([ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md)):
a richer, still-deterministic evidence base, wrapped in the same standards-legible attestation.

## Alternatives considered

- **Judge whether the evidence implements the rule (real semantic conformance).** The obvious "make
  the gate mean more" move, and the one that ends runward: semantic judgment needs a model, and a
  model in the verdict path breaks determinism, independence and reproducibility at once. That
  judgment stays the operator's, with the advisory adversarial `verify` workflow above the gate
  (ADR-0007), never in the exit code.
- **Sign every CRITICAL/HIGH rule at once.** Rejected by ADR-0020 in its own alternatives: most rules
  have no canonical token, and a forced signature manufactures false reds. The slice is adjudicated,
  not a quota.
- **Run the scanner / test runner to freshen the evidence.** Convenient, and the runtime crossing
  (ADR-0054). runward reads what the factory committed; the factory runs its own tools.
- **A full spec-conformance judge that scores acceptance criteria.** That is the LLM judge again,
  dressed as a feature. The type checks linkage and presence; scoring meaning is out of scope, and
  the blocking non-scope test is what keeps it out.

## Consequences

- **The gate reaches more of the factory's real evidence** — test reports, scans, spec bundles —
  without leaving presence/pointer/integrity/shape, and without running anything.
- **Signed coverage rises**, so "N of M applied rows rest on a signed rule" (0.34.0) becomes a
  meaningful, growing number, and a dogfood applied row can finally rest on a signed rule.
- **The SDD gap is filled with a hard verdict**, the one differentiator the prose-gated tools cannot
  match — provided the non-scope line ships as a blocking test beside it.
- **The honesty layer becomes more important, not less.** Every adapter and signature added is one
  more place a reader could mistake shape for satisfaction; the known-defects register and the "what
  this gate verified" line are the credibility floor, and this ADR strengthens the obligation to keep
  them loud.
- **Cost, stated.** Signatures 4-6 days (editorial); JUnit/SARIF adapters 6-9; spec-conformance type
  5-8. Realistic for one maintainer + an agent, each reusing the ADR-0019 pointer layer.
- Crosses no phase; `check --strict` exits 0 before and after.

## What this does not claim

- It does not make a green row mean the code meets the standard. `GATE_NON_SCOPE` is unchanged and
  reasserted: presence, resolution, non-vacuity, shape — never satisfaction. This is the ceiling no
  amount of evidence widening lifts, and the widening makes saying so more necessary.
- It does not run, execute, or invoke any delivery tool; it reads committed artifacts.
- It does not put a model in the verdict path; semantic judgment stays advisory (ADR-0007).
- It crosses no phase: cited by no manifest (ADR-0045 decision 4).

## Ratification

**Accepted 2026-08-14.** All three widenings are on the built binary with their proofs — the audit
of that day noted the inverse drift (a `proposed` header over delivered, tested code: the exact
status-code gap the 0033-0038 ratifications existed to close), and this record closes it:

1. **Signatures** — the signed count grew to 9 of 64 (`rules --json` reports it); each newly signed
   rule carries its both-directions case in `test/unit/rule-signature-slice.test.js` (an unrelated
   file reds, the idiom file passes); both reference missions strict-green.
2. **Adapters** — `test/unit/tool-adapters.test.js`: a committed `junit.xml` with a named case makes
   `test:reports/junit.xml::Name` resolve, and reddens when the case is absent OR recorded red (a
   red test is not evidence). The adapter spawns no process — proven structurally by the transitive
   import-closure test (`test/unit/runtime-boundary.test.js`, the ADR-0054 boundary test: the
   adapter sits inside the verdict path's closure, which imports no spawner). Hardened the same day
   on the audit's finding: every homonymous case is scanned, one red reddens, and `CLASS::NAME`
   pins one case among legitimate homonyms.
3. **Spec-conformance** — `test/unit/spec-conformance.test.js`: a criterion linked to a present
   pointer resolves green, reddens when the pointer is dead, and the non-scope line
   (`SPEC_NON_SCOPE`: linkage, never satisfaction) is asserted present on the machine and human
   surfaces. Hardened the same day on the audit's finding: the declared depth (`#SYMBOL`,
   `::NAME`, `:LINE`) is verified through the gate's own evidence layer, never silently dropped.
4. **Global invariant** — `check --strict` exits 0; `no-overclaim` green.

The criteria as originally set, kept as the record of the bar:

1. **Signatures.** `rules --json` reports the grown signed count; for each newly signed rule, a
   both-directions case (unrelated file reds, idiom file passes) in the signature-slice test; both
   reference missions strict-green.
2. **Adapters.** An adapter test: a committed `junit.xml` with a named case makes `test:reports/junit.xml::Name`
   resolve to non-vacuous content and reddens when the case is absent; the adapter spawns no process,
   asserted under the offline no-exec guard (the ADR-0054 boundary test).
3. **Spec-conformance.** A test where a declared criterion linked to a present pointer resolves green
   and reddens when the pointer is absent, plus a **blocking** assertion that the type never judges
   semantic satisfaction (the non-scope line is present and enforced).
4. **Global invariant.** `check --strict` exits 0 before and after; `no-overclaim` green.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2026-11-05.

The decision is wrong and must be revisited if any holds: an adapter is read as judging semantic satisfaction rather than recording a committed result (the slide this ADR exists to prevent); a committed-artifact adapter is found to green a case its tool recorded red, in any shape (the class of RWD-2026-0022 and RWD-2026-0023); or a signature added under decision 1 manufactures a false red on an honest mission.

**Watched via**: the conformance-gate incident log, and the adapter tests in both directions.

## References

- [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md) — the typed-pointer layer each widening reuses
- [ADR-0020](ADR-0020-rule-evidence-signatures.md) — the signature machinery; shape, never satisfaction; the false-red trigger
- [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) — GATE_NON_SCOPE and the anti-paperwork doctrine the widening must not erode
- [ADR-0007](ADR-0007-advisory-llm-conformance-verification.md) — where semantic judgment lives: advisory, never the exit code
- [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) — adapters read committed files, never run the tool
- [ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md) — the attestation the widened evidence is carried in
