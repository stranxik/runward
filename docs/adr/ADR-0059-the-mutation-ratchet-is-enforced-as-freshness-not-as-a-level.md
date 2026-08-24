# ADR-0059: the mutation ratchet is enforced as freshness, not as a level

**Status**: proposed — criteria 3, 4 and 5 demonstrated; 1 and 2 owe a CI run
**Date**: 2026-08-24
**Supersedes**: nothing. Completes [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) decision 2.

## Context

ADR-0046 decision 2 set a ratchet on 2026-08-05: on the named perimeter the score does not go down
and the absolute-survivor list does not grow. **For sixteen days nothing enforced it, and nothing
could.** There was no committed list, so "the list does not grow" had nothing to be compared against
and could not be falsified. That is the shape
[ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) refuses from an operator, standing
unexamined inside runward's own doctrine.

0.36.1 shipped the missing artifact: `docs/compliance/mutation-register.md`, generated from measured
verdicts in `docs/compliance/mutation-survivors/`, guarded on shape by a test that never runs
Stryker. The list now exists. Nothing re-derives it.

This ADR decides what enforcement looks like, and it has to resolve a real tension between two
statements this project already holds:

- **ADR-0046 decision 2**: *"A drop is a finding to instruct, not an automatic refusal."*
- **ADR-0045, as quoted in `src/lib/verdict.ts`**: *where the gate cannot verify, it says so IN THE
  RUN — and the run is the exit code, not the prose beside it.*

Read carelessly, the first says warn and the second says fail. Sixteen days of an unenforceable
ratchet is the empirical argument that warning is not enough. But decision 1 forbids a mutation
score from being a crossing condition, and it is right: a number placed high blocks honest work,
placed low it certifies nothing.

The way out is that **the two statements are about different objects.** Decision 2 is about the
survivor COUNT — a level, which legitimately moves when a module enters the perimeter or a fix lands.
ADR-0045 is about a CLAIM that nobody re-derived. The register is such a claim. Enforcing its
freshness is not enforcing a level.

## Decision

### 1. What CI enforces is that the register describes this tree — never that a number is good enough

The release-time job re-runs the pass and compares the result against the committed register. It
fails when they disagree. It has **no threshold, and reads no score**: a module may sit at 60 % or at
99 % and pass, and a survivor list may GROW and pass, provided the register says so and each new
survivor is filed.

This is the same shape as `runward verify` — re-derive and compare, never trust the document — turned
on runward's own compliance material. It is not the threshold decision 1 forbids, because nothing is
compared to an invented number; the comparison is between an artifact in the repository and what the
code actually produces. Clearing a failure is the work decision 4 already prescribes: re-run,
regenerate, instruct what is new, commit.

Decision 2 survives intact. A drop is not automatically refused. **An UNINSTRUCTED drop is**, and so
is a register that has stopped describing the code — because a stale register is a claim satisfied by
paperwork.

### 2. The ratchet compares on a position-independent key

A survivor's Stryker identity is `line|column|endLine|endColumn|mutator|replacement`. Every one of
those offsets moves when anything above it moves: three fixes in 0.36.1 shifted `evidenceReport` by
47 lines. A ratchet keyed on offsets would report a hundred "new" survivors after a one-line fix, and
a signal that cries on every honest change is a signal that gets switched off.

The comparison key is therefore **(module, function, mutator, replacement, the TEXT of the mutated
source line)**, normalised for whitespace. It survives code moving above it, and it changes exactly
when the mutated code changes — which is when a human should look. `scripts/mutation-survivors.mjs`
already derives that key for the register; the ratchet consumes the same one, so the artifact and its
check cannot key on different things.

The offset-based key stays in the per-function verdict files, where it identifies a mutant WITHIN one
measured build. It is never the ratchet's key. The build's own sha256 already guards that use
(`scripts/mutation-probe.mjs` refuses a list from another build).

### 3. Release time and on demand — never the pull-request path

ADR-0046 decision 3 stands and is the reason: an instrument that makes every change wait gets
switched off, and a guard that is switched off guards nothing. The job runs on the release workflow
and on manual dispatch. It does not run per commit, and it is not a required check on pull requests.

Failing a release is the intended consequence. A release that ships a register no longer describing
its own code ships exactly the unre-derived claim ADR-0045 exists to refuse — and 0.36.0 is the
worked example of the adjacent failure: it shipped documentation for a capability the tarball did not
contain.

### 4. Per module, because the whole pass does not fit in one job

The measured perimeter is 4 250 mutants over eleven modules, and only one of them is fully
instructed. A single job would exceed the runner's ceiling, so the ratchet is a matrix keyed on the
`mutate` array of `stryker.config.json` — the perimeter is data, so the matrix cannot silently drift
from it. A module absent from the register is reported as absent, never as passing: **the ratchet
reports coverage of itself.** Ten of the eleven modules are in that state today, and the job says so
rather than reporting green on the one that is done.

### 5. The harness preconditions apply in CI, and a refusal to measure is not a pass

The amendment of 2026-08-20 makes the instrument refuse to measure what it cannot measure: process
groups killed whole, hangs reported rather than inferred, one harness at a time, the mutant read back
from disk, the mutant list bound to its build. A CI runner is quieter than a laptop but not immune —
the contaminated pass that read 98.1 % instead of 77.4 % was caused by the harness, not by the
machine being busy in some exotic way.

So a run that refuses to measure exits non-zero like a mismatch does. "The instrument declined" and
"the register is fresh" must not share an outcome, because the first silently becomes the second the
moment anyone stops reading logs.

## Alternatives considered

**A warning that never fails.** Rejected on evidence rather than on principle: the ratchet was
already a warning nobody could act on for sixteen days, and the register it needed did not exist for
the same reason. A signal in the prose is not a signal.

**An absolute score floor in CI.** Refused by ADR-0046 decision 1, and this ADR does not reopen it.
A floor high enough to mean anything on `evidence` today would fail the build at 77.4 %, and the
honest reading of 77.4 % is a list of 144 filed holes, not a failure.

**Blocking pull requests.** Cost, per decision 3. Also wrong in kind: a PR that changes one function
would re-measure a perimeter of 4 250 mutants to learn something about one of them.

**Keying the ratchet on offsets.** Measured as unusable: a one-line fix moved 84 mutants by 47 lines.

**Committing the raw Stryker report as the baseline.** 13 MB per module, unreadable, and it would put
the machine-generated artifact in the position of the reviewed one. The register is a document a
human reads; that is the point of it.

## Consequences

- A release can be blocked by a stale register. That is the intended cost, and it is cheap to clear:
  re-run, regenerate, instruct what is new.
- Ten of eleven modules will report as unmeasured until they are instructed. The job will look
  mostly-red for as long as that is true, and it should — the alternative is a green that means
  "one module out of eleven".
- Adding a module to `stryker.config.json` adds a matrix leg with no register behind it, so the
  perimeter cannot be widened silently for appearances.
- The comparison key must be produced by exactly one implementation. Two would drift, and a ratchet
  whose two sides key differently reports noise.

## What this does not claim

- **Not a quality gate.** No score is a crossing condition, here or in `runward check`. The gate's
  own contract (`GATE_NON_SCOPE`) is untouched: this governs runward's development, ships in no
  package, and runs for no user.
- **Not a claim that 144 holes are acceptable or unacceptable.** That is a judgement the register
  exists to support, not to make.
- **Not a proof that the perimeter is right.** Decision 5 of ADR-0046 publishes its absences, and one
  of them is under revision (see that ADR's amendment of 2026-08-24).
- **Not protection against a deliberate maintainer.** Anyone who can commit can regenerate the
  register from a weakened suite. The trust anchor stays the reviewed commit (ADR-0021), as it does
  for the corpus lock, and for the same reason `src/lib/scaffold-lock.ts` already records: the lock is
  not the authority.

## Ratification

This ADR is ratified when all of the following are demonstrated, not asserted:

1. The workflow exists, runs on the release event and on manual dispatch, and is **not** a required
   check on pull requests.
2. It is **proven red**: a deliberately edited register (one row removed, one count changed) fails the
   job, and restoring it passes. Recorded in the run log, the way the Windows leg was.
3. A module absent from the register is reported as absent by the job, and that outcome is
   non-passing.
4. A refused measurement (a harness precondition failing) exits non-zero and is distinguishable in
   the log from a mismatch.
5. The comparison key has ONE implementation, consumed by both the register generator and the
   ratchet, with a test that fails if they diverge.

## Ratification progress — 2026-08-24

Demonstrated locally, on this tree, with the outcome recorded rather than asserted:

| Criterion | Status | Evidence |
| --- | --- | --- |
| 1. workflow exists, release + dispatch, not required on PRs | **partly** | `.github/workflows/mutation-ratchet.yml`: triggers are `release: published` and `workflow_dispatch`, with no `pull_request`. The matrix is derived from `stryker.config.json`, so it cannot drift from the perimeter. **Owed**: confirming it is not added to branch protection. |
| 2. proven red on a falsified register | **partly** | Two falsifications, each reverted: a verdict row removed → exit 1; a `stableKey` altered → exit 1; restored → exit 0 both times. **Owed**: the same recorded in a CI run log, the way the Windows leg was. |
| 3. an absent module is reported absent and does not pass | **yes** | `--module check` against a verified 50-mutant sample: *"check has no entries in docs/compliance/mutation-survivors: it has never been instructed"*, exit 2. |
| 4. a refused measurement is non-zero and distinguishable | **yes** | Exit 2 with `REFUSED — nothing was compared. This is not a passing outcome.`, separate from the exit 1 of a mismatch. Reached on an unverified-timeout report and on an uninstructed module. |
| 5. one key implementation, guarded | **yes** | `scripts/mutation-key.mjs` is the only one; `test/unit/mutation-key.test.js` (8 cases) proven red three ways: dropping the mutated text from the key, dropping whitespace normalisation, and adding a second implementation under `scripts/`. |

**What building it changed in the artifact.** The ratchet's first run against its own register failed,
and it was right to. Two mutants caught by the whole net were excluded from the register by a prose
exception, though `defence-in-depth` is one of the four filings ADR-0046 decision 4 defines. They are
now filed, and the register carries 217 rows instead of 215. A prose exception is a row the ratchet
reports as new on every run, forever.

**A defect it found in the verification step.** `scripts/mutation-timeouts.mjs` ran the module's own
tests as its cheap first phase. `check` has none, and `node --test` with no files discovers and runs
the whole suite — so the phase expired every time and confirmed all four timeouts of the `check`
sample as real hangs. Verified properly, none of them was: three are survivors and one an ordinary
kill. The comment in that script asserted the opposite and nobody had run it.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2026-11-05 — the next pass due under ADR-0046 — or at the first release blocked by
this job.

The decision is wrong and must be revisited if any of these holds: the job blocked a release for a
reason no human agreed with; clearing a legitimate failure took longer than instructing the survivors
it named; the matrix stopped tracking the `mutate` array; or the ratchet reported new survivors after
a change that touched no measured code, which would mean the position-independent key is not.

## References

- [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) — the instrument, its four
  filings, and decision 2, whose ratchet this enforces.
- [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) — a verdict may not rest on what
  the audited party writes; the ground for enforcing freshness rather than a level.
- [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) — same working tree, same verdict; the rule
  the harness preconditions apply to runward's own instruments.
- [ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) — why this is not protection against
  a deliberate maintainer.
- `docs/compliance/mutation-register.md` — the artifact this job re-derives.
