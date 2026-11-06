# ADR-0123 — The repeatable assessment grid lives outside the verdict path and outside the evaluated tool

**Date**: 2026-11-06
**Status**: accepted (2026-11-05) — by the maintainer's delegation, given in the chat of 2026-11-05
(« je te fais confiance, réalise à chaque fois au lieu de me demander »: "I trust you, carry it out
each time instead of asking me"), on the recommendation of the agent session that wrote this record.
**The maintainer has not read this text.** Non-constitutional, class D under ADR-0088 decision 2: it
adds a package beside the product and changes no line of `src/`, no verdict, no output and no
trust root. Under ADR-0088 decision 4 the maintainer is the single accountable person, and the
agent's writing is disclosed throughput, not independent review
**Deciders**: the maintainer, by delegation. Written by an agent session
**Method**: read on a fresh clone of `stranxik/runward` at `main@32d8425` (0.46.0): ADR-0039, ADR-0046,
ADR-0054, ADR-0092, ADR-0093, ADR-0094, `docs/spec/witness.md` section 3, `packages/runward-forge`,
`test/unit/runtime-boundary.test.js`, `scripts/reports-fresh.mjs`, the delegation charter's pre-merge
list. Built and measured on 2026-11-06: `packages/runward-assess` 0.1.0, its 92 tests, and a trial on
three repositories of the maintainer at three commits each (runward's records are under
`packages/runward-assess/trials/runward/`)
**Relates to**: [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) (the operator layer stays
outside the CLI), [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (the runtime boundary),
[ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(what runward shows is assembled from files it writes; the satellite in its own repository),
[ADR-0094](ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md)
(a second package of this repository, imported by nothing), [ADR-0092](ADR-0092-a-claims-layer-factual-sentences-are-tagged-typed-and-sealed-the-rest-is-said-unchecked.md)
(a detector alerts, it does not judge), [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md)
(an instrument, never a tier), RWD-2026-0187 and RWD-2026-0192 in [known-defects.md](../compliance/known-defects.md)

## Context

**An assessment that cannot be repeated cannot be compared.** The investigation of 2026-11-05 measured
part of what it said by script (statuses of the ADRs, Scorecard, a sabotage table, npm downloads,
advisories with a positive control, a reproducible build) and judged the rest ("about 45 false greens,
plus or minus 5", NIST SSDF practices "held, partial, absent", competitive threat "strong, medium").
The judged half is worth reading and impossible to re-run: two passes on the same commit would not
give the same words, so a later pass could not say what changed. A design of the same day turned the
mechanical half into a grid (35 criteria, seven axes, cumulative tiers, no global score), and a
prototype showed the mechanics hold: one stage on the network, one offline, a pure score, and a record
whose bytes do not move with the machine.

**Where such a grid lives is not neutral.** It does three things runward's verdict path refuses. It
reads the network (forge settings, registries, vulnerability databases, a public site), which ADR-0054
forbids the verdict. It reads beyond one tree (the git history for secrets and contributors, a second
repository when it assesses another project), also a crossing of ADR-0054. And it executes code: the
gate a repository pins, against a catalogue of sabotaged copies. ADR-0039 keeps operator layers outside
the CLI for that kind of reason, and ADR-0093 already placed the satellite `runward-fleet` in its own
repository, with no runward import, rebuilt from what the CLI exports.

**A grid kept by the tool it evaluates evaluates itself.** If the assessment were a runward command,
runward's own release would change the instrument that rates runward, and a rating of runward by
`runward assess` would be the product vouching for itself. The grid has to read runward's outputs the
way it reads any other evidence, and to rate runward with the same procedure it applies to a
repository runward has never seen.

## Options considered

**A. A runward command (`runward assess`).** One install, one release chain. It puts the network, the
history and code execution inside the binary whose selling point is that its verdict has none, and it
makes runward the judge of runward.

**B. A rule pack or a regime lens inside runward.** Data rather than code, read by the existing gate.
The gate's boundary would then have to grow every read the grid needs; and a pack shipped in the
package is versioned with the product it rates.

**C. A separate tool, in this repository's `packages/` first, extracted later.** The same shape as
`runward-forge` (ADR-0094): a second package that runward imports nothing from and that imports nothing
from runward, built and tested beside the code it reads, with a boundary a test checks in both
directions.

**D. A separate repository now.** The cleanest boundary. It starts without the trial, without the
history of the decision and without a second reader of the package's first records, at the moment the
grid most needs them.

## Decision

1. **The grid is a separate tool, `runward-assess`, in `packages/runward-assess` until its extraction
   (option C, then D).** It imports nothing from runward, not the package, not a sibling package, not
   a file of the repository it sits in: `packages/runward-assess/test/no-runward-import.test.js` checks
   it, with planted controls (a static import, a dynamic one, a `require`, a sibling package, a path out
   of the package, a loader), and checks that runward neither imports nor ships it. It reads what
   runward writes (manifests, ADRs, the defect register, committed reports) as text, with its own
   readers, and runs runward's CLI as a program when PRV-03 tests the gate a repository declares. It is
   `private` in its `package.json`: nothing publishes it from this repository.
2. **Three stages, and only the first reads the network.** `snapshot` reads the forge with
   `gh api --method GET` and nothing else, the npm registry, OSV, the Scorecard API and the declared
   public pages, installs the gate the commit pins, and writes a directory whose manifest names every
   file with its sha256. `measure` reads one commit from the object store, offline: it re-runs itself
   under a sandbox that denies the network and refuses when a probe still connects. `score` is a pure
   function of the measure, the snapshot, the declared profile and the grid: no clock (the as-of date
   is a label in the manifest), no environment, no randomness, no model, no file of its own
   (`test/purity.test.js`).
3. **The record is canonical and has two scored parts.** The encoding is runward's witness's
   (docs/spec/witness.md section 3), restated in the package so it depends on no runward code. The
   internal part holds the criteria that read the commit alone and is valid for that commit for ever;
   the external part holds those that read the snapshot and is valid at its date; a setting read today
   is never applied to a past commit. The same inputs give the same bytes under two time zones, two
   locales and two Node.js releases (`runward-assess selftest`).
4. **The grid is versioned data, and nothing is scored by vacuity or by inference.** Criteria carry
   stable `AXE-NN` identifiers and a `rev`; thresholds live in the conditions of
   `grid/grille-1.json`, never in code; a criterion whose normative content changes without its `rev`
   is refused by the lock. A fact the version does not collect is "not observed" and blocks its tier,
   counted apart from "not met"; n/a needs a fact that proves it. There is no global score, no average
   and no composite percentage. The judged annex is a separate section that no tier reads.
5. **The package is extracted into a repository of its own** when the first of these happens: a
   second project adopts it, the grid reaches `grille@2`, or its records start to be kept (decision 6).
   The extraction moves the package as it is: no runward import to cut, its tests travel with it.
6. **The records are kept by an identity out of the agents' reach.** A record an agent can rewrite
   after the fact is a claim. Records are kept append-only, each with its snapshot's manifest and the
   index line that names it, in a store written by an identity no agent session holds (a CI identity of
   a dedicated repository, or the maintainer's own key), and attested there. Until that store exists,
   the trial's records in this repository are illustrations of the method, not kept records.

## Alternatives discarded

A (a runward command) and B (a pack in runward), because they put the network, the history and the
execution of code on the side of the product whose verdict refuses them, and make the tool the judge of
its own rating. D now, because the grid's first records and its trial are better read beside the code
they describe, while the boundary test already makes the later move a copy.

## Consequences

- runward's verdict path, outputs and package are unchanged; `src/` is not touched, and `packages/` is
  not in the runward tarball.
- runward's own suite is unchanged: the package's tests run with the package
  (`node --test packages/runward-assess/test/*.test.js`), so `reports/junit.xml` keeps its census. No
  CI job runs them yet: wiring one touches `.github/**`, a pre-merge path, and is left to the maintainer.
- The first record of runward (`main@32d8425`) reads every axis at P0 except GOU at P1, and blocks on
  facts 0.1.0 does not collect as often as on facts it does: the record says which. That is the grid
  working as decided, not a rating of the project.
- The sabotage catalogue becomes saboteur@1, versioned with what each gate version did when it was
  frozen, including two cases the audit filed as defects: T14 (`verify` accepts fields written by hand,
  RWD-2026-0192, still missed on `main`) and T15 (the verdict that depended on the Node.js release that
  wrote a JUnit report, RWD-2026-0187, invariant on `main`, divergent on 0.46.0).

### What this does not do

It does not run a project's own test suite, coverage, builds or installs: those criteria read not
observed until a later version collects them in a sandbox, and the record lists them. It does not judge:
the annex has fixed questions and no judge yet. It does not prove a record was not rewritten before
decision 6 holds. A lexical detector (secrets, overpromise words, factual sentences) raises flags; a
flag on honest text is answered by a motivated exception in the project's profile, never by changing
the detector for one project.

## What would settle it

The grid is right where it lives if a project that is not runward is assessed with it unchanged and its
maintainer can re-derive the record; if `grille@2` re-scores the kept snapshots of `grille@1` without a
line of runward changing; and if no rating of runward ever needs a runward release. It is wrong if the
grid needs runward's code to read runward (the boundary test reddens), or if a record cannot be
reproduced from its snapshot and measure on another machine.

## Reevaluation trigger (mandatory, dated)

Reopen at the first of: the boundary test reddening; a second project adopting the package; the grid
reaching `grille@2`; the records store of decision 6 existing; or on 2027-02-05, whichever comes first.

**Trigger set on**: 2026-11-06 · **Watched via**: `packages/runward-assess/test/no-runward-import.test.js`
and the package's self-test.

## References

- `packages/runward-assess/README.md`: the stages, the record, the profile, what 0.1.0 collects.
- `packages/runward-assess/grid/grille-1.json`, `facts-1.json`, `grille-1.lock.json`: the grid as data.
- `packages/runward-assess/corpus/saboteur-1/`: the catalogue and its frozen observations.
- OpenSSF Scorecard (checks and risk levels), OpenSSF Best Practices criteria, CHAOSS absence and
  elephant factors, OSV: the external references the criteria cite, read on 2026-11-05.
