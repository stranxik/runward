# ADR-0098 — Whether the gate says how old a committed JUnit report is, and what it may read to say it

**Date**: 2026-10-22
**Status**: accepted (2026-10-23) — the maintainer chose B now and G next: the output counts the rows judged on a committed JUnit report and says their freshness is not verified by this command; runward then ships the regenerate-and-compare guard as a recipe adopters run in CI. C, D and E are discarded; F stays written down for a second adopter
**Deciders**: the maintainer
**Method**: an adopter's finding, re-checked by the adopter against runward 0.44.1 on 2026-10-22; read
against a fresh clone of `stranxik/runward` at `main@de61beb` (0.44.1): `src/lib/tool-adapters.ts`
(`isJUnitReport`, `isRunwardJUnit`, `junitTestResult`, `junitTestCases`), `src/lib/evidence.ts` (the
JUnit evidence adapter), `src/lib/verify-findings.ts` and `src/lib/behavioral-proof.ts` (the two
freshness readings the tree already has), `scripts/junit-committable.mjs`, `scripts/reports-fresh.mjs`,
`reports/junit.xml`, the README's `spec-check` paragraph, ADR-0054, 0067, 0069, 0073, 0091, 0096 and
RWD-2026-0113
**Relates to**: [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (the runtime boundary),
[ADR-0067](ADR-0067-the-workflow-carries-a-contract-the-gate-reads.md) (a surfaced date, never in the
verdict), [ADR-0091](ADR-0091-machine-checked-proofs-as-evidence-a-ratified-statement-a-kernel-checked-proof-read-and-never-run.md)
(source digests make a proof report's freshness checkable by reading),
[ADR-0096](ADR-0096-code-quality-and-junit-renderings-of-the-verdict-and-why-runward-gaps-are-not-filed-as-vulnerabilities.md)
(the gate already reads a JUnit `<property>`), RWD-2026-0113 in
[known-defects.md](../compliance/known-defects.md)

## Context

**What was reported.** An adopter's rows cite committed JUnit reports (`test:reports/junit.xml::name`).
The report carries no commit and no date, so the gate judges a case green without knowing which state
of the code produced it. The README already says so in its `spec-check` paragraph: "runward runs no
test, so a stale report reads as it was committed". The adopter asks for the next step: read a commit or
a timestamp from the report's `<properties>` when it is there, and print how many rows were judged on a
report older than the sources it cites.

**What the tree does.** `junitTestResult` reads the `<testcase>` elements the pointer's name selects and
answers `pass`, `fail` or `absent`; nothing about when the report was written enters the answer. The
gate already reads one JUnit property: `isRunwardJUnit` refuses a report that carries
`runward.rendering`, because a previous verdict is not evidence for this one (ADR-0096 decision 4). So
reading a `<property>` is a read the verdict path already makes; what is open is which property, and
what it is compared against.

**What runward does for its own reports.** RWD-2026-0113 measured the failure this finding describes on
runward's own mission: a cited case renamed out of the suite, the report left untouched, and
`check --strict` returned exit 0. The fix sits outside the verdict path: `scripts/reports-fresh.mjs`,
run in CI, regenerates the committed reports and refuses on any semantic difference. And
`scripts/junit-committable.mjs` removes the suite's wall clock and per-case times before the report is
committed, so that a deterministic tree can carry it: runward's own reports carry no date on purpose.
ADR-0091 states the same split for proof reports at increment 0 ("freshness is the required re-run
job's, not the gate's") and makes freshness checkable by reading at increment 1, through source digests
(AC-025).

**What the verdict may read, and what it may not (ADR-0054).** The contract is "same working tree ⇒
same verdict and same machine outputs".

- **May read:** the bytes of files in the mission tree, including every attribute and `<property>` of a
  committed report, and the bytes of the files a report names, recomputed into digests.
- **May not read in the verdict path:** git history, a base ref or the state of `.git/` (crossing 4: the
  same tree at two commits would give two answers); the clock (two runs on the same tree, a day apart,
  would disagree); the network (crossing 5).
- **Not the tree either:** file modification times. A fresh clone sets every mtime to the checkout time,
  so a comparison of mtimes gives one answer on the author's machine and another in CI. The tree already
  uses mtimes in two advisory places (`verify-findings.ts`, `behavioral-proof.ts`), surfaced and never
  in the verdict, under ADR-0067, and `verify-findings.ts` prefers a digest when it has one ("a bare
  `touch` moves nothing").

**What "older than the sources it cites" can mean.** A pointer cites the report, not the sources the
report was produced from. A date in the report can only be compared with another date, which the tree
does not hold (mtimes are not the tree, the clock is not allowed). A commit in the report can only be
compared with a commit, which only git holds. What the tree can compare deterministically is content: a
digest the report declares for a file against the digest of that file now.

## Decision

**Decided (2026-10-23).** B, then G. B costs a count and a line, reads nothing new, and names the
blind spot on every run, which is what this record found missing: a stale report was green with the
only warning in a README paragraph. G keeps freshness where the tests run (the adopter's CI) and out of
the verdict path. C is discarded because a date written by the party the gate judges reads as verified;
D because it needs git in the verdict path (ADR-0054 crossing 4); E because it depends on the checkout.
F is not discarded: it is the option a second adopter asking for verified freshness would reopen.
Implementation is a pull request of its own (B touches the verdict's output contract, additive).

The options as proposed on 2026-10-22: **one of the options below, or a combination**, chosen by the maintainer on the
evidence under "What would settle it". Until then the tree keeps A: the report is read as it was
committed, the README says so, and runward's own reports are kept fresh by its CI.

- **A. Read the report as it was committed, and say so (the tree today).** Cost: zero code. A stale
  report is green until something outside the gate regenerates it; the README sentence is the only
  warning, and it sits in the `spec-check` paragraph, not in the output of `check`.
- **B. Count, in the output, the rows judged on a committed JUnit report, with the sentence "freshness
  not verified by this command".** No new read. Cost: small (a count and a line, additive in
  `check --json`); it names the blind spot on every run and dates nothing.
- **C. Print the provenance a report declares, verbatim, never compared.** When a report carries a
  `timestamp` attribute on `<testsuite>` or a commit in a `<property>`, the gate prints it beside the
  rows it judged, labelled "declared by the report". It reads only bytes in the tree. Cost: a label
  written by the party the gate judges, which a reader can take for a verified date unless the wording
  forbids it; a timestamp or a commit in a committed report changes on every regeneration, against
  `junit-committable.mjs`'s choice to strip the clock; and the property names are not a standard, so
  runward would document the ones it reads.
- **D. Compare the declared commit with the checked-out one.** Cost: a git read (or a read of `.git/`)
  in the verdict path, which is ADR-0054 crossing 4, so it needs a superseding ADR; or the comparison
  lives outside the verdict path, beside `ledger` (ADR-0093 names it a git reader outside the verdict),
  as a separate disclosure. Even then, a report generated at commit X and committed in commit X+1 always
  reads one commit old, so "older" needs a rule of its own.
- **E. Compare declared dates with file modification times, advisory only.** Cost: the answer depends on
  the checkout, not the tree, so it cannot enter `check --json` without breaking "same working tree ⇒
  same machine outputs"; it could only be a human-readable line, the reading ADR-0067 keeps for findings
  files. In CI, where every mtime is the checkout time, it says nothing useful.
- **F. Source digests declared by the report, recomputed by the gate.** A writer runward ships (as
  `junit-committable.mjs` is for runward itself) adds a `<property>` listing each file the run was
  produced from, with its SHA-256; the gate recomputes those digests from the tree and counts the rows
  judged on a report whose digests no longer match, or that declares none. No git, no clock, no network:
  the precedent is ADR-0091's AC-025. Cost: a writer per test runner or one post-processor, and a
  documented property; the writer chooses the source set, so a report can declare a narrow one, which
  the output must print; every source change churns the report, which is the point and also a merge
  conflict generator; and under ADR-0069 a mission opts into what moves its verdict, so this is a count
  first (F1) and a strict gap only under an opt-in or the regulated tier (F2), each a release of its own.
- **G. Freshness stays in CI, and runward ships the guard.** The `reports-fresh.mjs` approach (regenerate,
  compare cases semantically, refuse on a difference) packaged as a recipe or an Action input the
  adopter runs after their own test command. Outside the verdict path. Cost: the adopter's CI runs the
  tests, which it does anyway; runward ships and maintains a comparator per report format; the verdict
  itself still says nothing about age, so it combines with B.

## Alternatives discarded

- **Run the tests in the gate.** runward runs no test (ADR-0054 crossing 5 and the moat); refused.
- **Compare a declared timestamp with the clock** ("older than N days"). A clock read in the verdict path
  makes two runs on the same tree disagree; refused under the same-tree contract.
- **Trust a declared commit without comparing it.** That is C presented as verification; C is kept only
  with the label that it is declared.

## Consequences

- Each option except A and B adds a read or a writer, and F and G add a contract (a property name and its
  grammar, or a recipe interface) the machine surface then keeps additive (ADR-0024).
- F2, and any option that turns a stale report red, changes the verdict of missions that cite unstamped
  reports, so it needs an opt-in, a migration notice and a `wrong-verdict` audit of the new refusal.
- Whatever is chosen, runward's own mission is the first adopter: its committed reports are cited by its
  manifest, and its CI already proves they are fresh by regeneration.

## What would settle it

- **For A**: adopters, once told, keep reports fresh in their own CI, and no stale-report false green is
  reported within the trigger period.
- **For B**: it is the cheapest honest step whichever else is chosen; it is settled by the maintainer
  accepting the wording.
- **For C**: an adopter whose test runner already writes a timestamp or a commit, and who needs it shown
  beside the verdict for an auditor, with the "declared" label accepted as enough.
- **For D**: a measured case where content digests could not tell a stale report apart and a commit
  could, and a decision to place the read outside the verdict path.
- **For E**: none in CI; only a local workflow where mtimes are meaningful, and the human line would have
  to be shown worth its non-determinism.
- **For F**: a stale-report false green measured on an adopter's mission that the digests would have
  caught, and a writer that works for at least two test runners (the Node reporter and one other).
- **For G**: two or more adopters asking for the guard runward runs on itself, rather than writing their
  own.

## Reevaluation trigger (mandatory, dated)

Reopen when an adopter reports a false green reached through a stale committed report, when a test runner
in common use starts writing a commit or a source digest into its JUnit output, or on 2027-01-22,
whichever comes first.

**Trigger set on**: 2026-10-22 · **Watched via**: issues and the defect register (`found-by` =
`operator-report`) mentioning a committed report, a JUnit pointer or freshness.

## References

- `src/lib/tool-adapters.ts`: `isRunwardJUnit` (the property the gate already reads), `junitTestResult`.
- `scripts/junit-committable.mjs` (strips the clock), `scripts/reports-fresh.mjs` (the CI freshness guard).
- `src/lib/verify-findings.ts`: the digest basis preferred over mtime for findings files.
- README, `spec-check`: "a stale report reads as it was committed".
- RWD-2026-0113 in [known-defects.md](../compliance/known-defects.md).
