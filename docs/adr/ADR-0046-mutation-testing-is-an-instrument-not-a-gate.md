# ADR-0046: mutation testing is an instrument, not a gate

**Date**: 2026-08-05
**Status**: accepted (ratified 2026-08-05 — see Ratification)

## Context

runward asks operators to prove that a step happened. It had never asked the same of its own test
suite. Two hundred and some tests were green; nothing said what they would catch if the code moved
under them.

A full Stryker pass was run on 2026-08-05 against the seven library modules the verdict is computed
*from* (`evidence`, `conformance`, `mission`, `rules`, `scaffold-lock`, `territory`, `territory-map`).

The wording matters, and the first draft of this ADR got it wrong in the direction that flatters. It
called these "the seven modules that produce a verdict". They do not. The verdict is **assembled** in
`src/commands/check.ts`, which no unit test imports and which this pass did not mutate. The measured
perimeter is therefore everything the verdict is computed from, and not the place where it is
decided. That gap is stated again in the Decision (point 5) and is the single most consequential
absence of this measurement.
**2 973 mutants, 2 h 35, mutation score 60.78 %**: 1 769 killed, 38 timeout, **1 166 survived**,
0 without coverage.

A raw survivor count is not a defect count, and treating it as one would have produced a day of
false findings. The survivors were therefore filtered before being judged:

1. **By stake.** 433 of the 1 166 carry mutators that can flip a *decision* (equality, conditional,
   logical, boolean, unary, optional chaining). The rest are mostly string literals and regexes,
   many of them inside printed prose. No test should pin prose.
2. **Against the whole net.** The unit suite is not runward's safety net. The 433 were re-run against
   the self-gate, the OSCAL schema validation and the end-to-end smoke. **53 died there. 380
   survived everything.** Reporting the other 53 as holes would have been false.
3. **By instruction, case by case.** Thirteen analysts, one per function, each in an isolated copy of
   the repository, each required to apply the mutant to a real mission and read the verdict rather
   than reason about the code.

**What that instruction found, and what it corrected.**

The first reading was wrong, and the correction is the substance of this ADR. A surviving mutant is
not automatically a false green. Forcing `artifactState` to report every ADR directory as `filled`
survives the unit suite, the self-gate, the smoke run **and** the audit corpus — yet a mission with
no ADR is still **refused**, because the typed pointer `adr:0001` does not resolve. Defence in
depth, not a hole in the verdict. What it does corrupt is the printed line: `✓ Decision journal`
where the truth is `○ raw template`. For this tool that remains a defect, because a proof surface
that lies under a correct verdict is still a proof surface that lies.

**The structural result.** `check.ts` imports neither `territory` nor `characterize`. The territory
derivation reaches only `runward rules --for` (which exits 0 by design) and `runward status`. The
125 survivors in `territory.js`, a third of the 380, **cannot turn a refusal into a pass**. Measured,
not deduced: 42 mutants applied one at a time to a green mission left `check --strict` at exit 0
every time, while 4 of them already corrupted `rules --for --json`. That command is a machine
contract an agent drives on, and a mis-scan does not answer "I could not read it" — it answers a
wrong list, plausibly.

**The three findings that mattered.** Each is a mechanism that was *correct* and that *nothing
protected against regression*:

- **The seal.** One field flipped in `verifyEvidenceLock` (`present: true` → `false` on the
  unparseable-lock path) turns a tampered, sealed mission from exit 1 into **exit 0**. `check.ts`
  gates the entire seal section on that field, so the violations are neither printed nor counted.
  Verified by hand on a real mission sealed with `check --freeze`.
- **The ReDoS screen (ADR-0020).** The loop in `unsafeSignature` that collapses nested groups is
  entered by no existing fixture. It could be deleted outright and the suite stayed green.
- **Containment.** The repository fallback in `resolvePointer` was dead code under test: every
  containment test ran in a bare temp directory, where no repository marker exists above the base.

**Why the suite could not see them.** The reference mission shipped by `init --example` writes
`file:PATH#SYMBOL` and bare `test:PATH` — the robust forms, and the right choice for an example,
since a symbol anchor survives a refactor and a line number does not. The consequence is that the
`:LINE` and `::NAME` branches of the grammar are unreachable by the self-gate whatever they do. The
answer is unit coverage, not a more fragile example.

**What was closed.** 246 of the 380 were instructed and **181 now die** (measured centrally against
the full suite, not claimed by the analysts, whose own count was 183): `territory.js` 101/125,
`evidence.js` 80/121. Fourteen test files, 113 cases. Separately, `artifactState` — 101 survivors in
one function, the lowest-scoring module at 40 % — was pinned by 13 cases killing 7 threshold mutants.

## Decision

**Mutation testing is an instrument runward runs on itself. It is never a gate, and no mutation
score is ever a crossing condition.**

1. **No absolute threshold.** A number placed high blocks honest work; placed low it certifies
   nothing. Either way, a mutation score written into a manifest is a verdict satisfied by a figure
   nobody re-derived, which is what [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)
   forbids. runward does not do to itself what it refuses from an operator.

2. **A ratchet, on a named perimeter.** What is opposable is a direction, not a level. On the seven
   core modules, the score does not go down and the absolute-survivor list does not grow. A drop is a
   finding to instruct, not an automatic refusal — the criterion is falsifiable, and it invents no
   number.

3. **Out of the pull-request path.** 2 h 35 for the core alone. It runs on demand and before a
   release, never per commit. An instrument that makes every change wait gets switched off, and a
   guard that is switched off guards nothing.

4. **Survivors are a register, not a backlog to zero.** Each one is filed with what it is: hole,
   defence in depth, equivalent, or display-only — and equivalence is *argued*, never assumed. Three
   survivors were declared harmless on an earlier bench of four; two were live defects.

5. **The perimeter is published with its absences, starting with the one that hurts.** The
   measurement covers seven library modules. It does **not** cover `src/commands/check.ts`, where the
   verdict is actually assembled and where the exit code is chosen — no unit test imports any command,
   so mutating them would have produced 100 % survivors, which is noise and not a measurement. It
   does not cover the nine other commands, the five `lib/` modules nothing reaches even transitively
   (`behavioral-proof`, `hooks`, `styles`, `verify-findings`, `write`), nor the nine other modules
   outside the core.

   This absence must be stated first and not last, because it is the one an assessor finds by
   crossing this ADR with the source tree: the least-tested path in the project is the one that
   returns the exit code, and it is the same region the 22 false positives of ADR-0045 lived in.
   Until that path is extracted into something a unit test can import, "we measured what our net
   catches" reads, correctly, as "everywhere except where the verdict is decided". A score quoted
   without its perimeter is an overclaim; this perimeter quoted without this sentence is one too.

6. **The adverse reading is published too.** These results are an input an assessor uses to classify
   runward *higher* on a tool-confidence scale, not lower: they document a verification tool whose
   own net had unguarded load-bearing mechanisms. That belongs in the qualification material
   alongside the improvement, per the rule already in force in `test/unit/no-overclaim.test.js`.
   Publishing the strengthening while burying the finding would be the overclaim that file forbids.

## Alternatives discarded

- **A blocking threshold in CI.** Rejected on 1 and 3. It would also invite the one behaviour this
  project exists to refuse: raising a score by writing tests that assert nothing hard.
- **Mutating the whole codebase.** Rejected on 5. Mutating code no test reaches measures the absence
  of tests, which `npm run coverage` already states more cheaply and more honestly.
- **Zeroing the survivor list.** Rejected on 4. 380 survive everything; a third of them cannot reach
  a verdict at all. Treating them as equal defects would spend the project's attention on the wrong
  two hundred.
- **Enriching `init --example` with `:LINE` pointers** so the self-gate exercises those branches.
  Rejected: it trades a real property of the example (it survives a refactor) for coverage a unit
  test gives without the fragility.

## Consequences

- Fourteen test files enter the suite (322 unit tests, up from 209). They pin decisions, not
  implementations: private scanners are reached through their public entry points.
- Every guard is pinned in **both** directions. A fixture that only ever expects a refusal is
  satisfied by a function that refuses everything.
- Cost accepted: a periodic run of some hours, and the discipline of instructing survivors rather
  than counting them.
- The known-defects material gains three entries whose *fix* is a test, and the seal finding is
  named in the regulated-adoption documentation rather than only here.

## Ratification — 2026-08-05

Measured on the shipped build, every figure re-derived rather than quoted:

- Stryker 9.6.1, `command` runner, mutating `dist/` — 2 973 mutants, 60.78 %, 2 h 35.
- Stage 2 against the full net: 433 tested, 53 killed, 380 alive.
- Central kill verification over the 246 instructed mutants: **181 killed** by the augmented suite.
- Full net green with the new files: unit 322/322, smoke, OSCAL, audit corpus, `check --strict` — all
  exit 0.
- The seal false green reproduced by hand: sealed mission exit 0, lock corrupted exit 1, same case
  with one mutant applied exit 0.

## Amendment (2026-08-18) — the instrument is committed, because a ratchet you cannot re-run is not a ratchet

Decision 2 sets a ratchet: on the named perimeter the score does not go down and the
absolute-survivor list does not grow. Measured on 2026-08-18: **nothing in this repository could
re-run the measurement.** No Stryker dependency, no configuration, no script — the pass of
2026-08-05 (Stryker 9.6.1, 2 973 mutants, 60.78 %, 2 h 35) existed as a number in this ADR and as a
command someone had typed once. A ratchet nobody can re-run is a ratchet in name only, and a
measurement whose configuration lives nowhere is exactly the unreproducible claim this project
refuses everywhere else. The finding is the same shape as the one this ADR itself documents: an
instrument with an unguarded mechanism.

So `stryker.config.json` and `npm run mutation` are now committed, with three properties that are
the decision as much as the file:

- **The perimeter is DATA, not prose.** It was readable only by crossing this ADR's sentences with
  the source tree; it is now a `mutate` array anyone can diff. That also makes decision 5's absence
  auditable: `src/commands/*` is not in it, and its being missing is visible rather than argued.
- **It mutates `dist/`, not `src/`** — the tests import `dist/`, which is the build the package
  ships, so a killed mutant is one killed in what users actually run.
- **No threshold, `break: null`, and CI does not run it** (decisions 1 and 3, made mechanical). A
  score written into a manifest would be a verdict nobody re-derived, which ADR-0045 forbids.

**The cost is now the constraint, and it is measured.** 4 250 mutants over the eleven modules, and
the unit suite takes **47 s** per run — the command runner re-runs it whole for every mutant. At the
old concurrency that is **~14 hours**, against 2 h 35 in August. Both terms grew: the perimeter
(2 973 → 4 250 mutants) and the suite (322 → 573 tests, many of which spawn the CLI). Decision 3
says an instrument that makes every change wait gets switched off, so the answer cannot be "run it
anyway"; it has to be structural. Three levers, and one that was tried and does not work:

- **Incremental (now on).** Stryker keeps a report and re-tests only the mutants a change can reach.
  The first pass is the expensive one; every later pass costs roughly what the diff costs. This is
  the answer to *"and when the perimeter is bigger"* — the cost stops tracking the size of the code
  and starts tracking the size of the change.
- **Concurrency, raised to 7** on an 8-core machine. Linear and free, and the knob to re-check
  elsewhere.
- **Per-module runs** (`npx stryker run --mutate dist/lib/<module>.js`). The same total work, but
  finishable in one sitting and resumable — and the register is built module by module, which is
  what decision 4 asks for anyway. The full net still judges every mutant, so nothing is falsely
  reported as a survivor.
- **NOT a lever, and this was measured rather than assumed.** Stryker's normal answer to cost is
  `coverageAnalysis: "perTest"`, which runs only the tests covering the mutated line — worth 10 to
  50×. It needs a runner Stryker can instrument, and `@stryker-mutator/tap-runner@9.6.1` looked like
  the fit since `node --test` emits TAP. It reported **106 of 106 mutants as "no coverage"** on a
  module the suite genuinely exercises: `node --test` runs each test file in its own process, so the
  per-test counters never come back. The resulting score would have been a fiction, and a fast wrong
  number is worse than a slow right one. Revisit if Stryker gains a `node:test` runner.

One dry-run incompatibility was fixed rather than worked around: the no-overclaim scope meta-guard
asserts a property of the REPOSITORY (how many files the claims guard reaches) and measured the
partial sandbox instead, reporting one file where the checkout has hundreds. It now skips under a
mutation sandbox — it tests no behaviour of the mutated code, so the net loses nothing, while
leaving it red would have failed every dry run and made the instrument unusable.

**The perimeter grew, and the ADR must say why.** It was seven modules; it is eleven. `verdict.js`
entered because [ADR-0047](ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md) moved the
verdict out of `check.ts` into a module a unit test can import — the direct answer to decision 5's
"the least-tested path is the one that returns the exit code". `tool-adapters.js`,
`spec-conformance.js` and `attestation.js` entered because 0.35.0 and 0.36.0 put load-bearing
verdict logic in them (the committed-tool adapters, spec linkage, the attestation subject digest).
**The next pass will therefore report a different score, and that is not a regression** — the
denominator changed on purpose. Comparing it to 60.78 % without this paragraph would be comparing
two different measurements.

## Amendment (2026-08-20) — a measurement that depends on the machine is not a measurement

Decision 2 sets a ratchet. Two things were found on 2026-08-20 that made it unenforceable, and both
are the same defect this ADR was written about, turned against this ADR.

### The finding: the instrument was measuring the machine, not the code

Stryker files a mutant as `Timeout` when its run exceeds a deadline, and **counts that as detected**.
That verdict is the only one in a mutation run that depends on something other than the source tree.
A mutant that loops forever and a mutant that merely runs a slow suite are separated by CPU
contention, not by kind.

The harness made that far worse. It bounded child processes with `spawnSync`'s `timeout`, which
signals the **direct child only**, while `node --test` isolates each test file in its own process. So
every expired run left roughly a dozen grandchildren alive, still executing their mutant. They
accumulated across iterations. Measured: **load average 78 on 8 cores, 32 orphans still running after
the driver had been killed**, and at one point two copies of the verifier racing each other.

What that produced, in both directions:

| Reading | Reality | Consequence |
| --- | --- | --- |
| chunk 1 of `evidence.js`: 100 %, zero survivors | 89 %, nine survivors | a false green |
| whole module: 98.1 %, 18 survivors | 269 `Timeout` mutants re-run alone: the large majority are **survivors**, not hangs | ~180 survivors hidden in the detected column |
| one mutant filed as a survivor in 27 s | hangs for over 400 s | a genuine hang read as ordinary |
| suite baseline recorded as 105 s, then 84 s, then 38 s | idle and alone: **20 s** | three figures written into `stryker.config.json` as measurements were wrong |

The direction that matters is the first two rows. A starved survivor is filed as detected and
**disappears**, and the score goes up. An instrument whose error mode is to flatter itself is worse
than no instrument.

### Decision A — the verdict may not depend on the state of the machine

[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) requires that the same working tree yield the same
verdict. A mutation score that moves with CPU load fails that test, and runward does not get to hold
its own instruments to a lower standard than the gate it sells. The fix is not to reproduce the
environment but to **remove the dependence on it**:

1. **No verdict is taken from a deadline alone.** Every `Timeout` is re-run on its own by
   `scripts/mutation-timeouts.mjs`, and enters the register as detected only if it reproduces.
   Machine state then affects the **cost** of the pass and never its **result**.
2. **Bounded children run in their own process group**, killed whole
   (`scripts/bounded-run.mjs`), so an expired run cannot leave workers behind to corrupt the next
   one. A hang is reported as a hang, never inferred from an exit code: node installs its own
   SIGTERM handler and exits with an ordinary status when killed.
3. **The harness refuses to run twice.** A second copy does not make a measuring instrument slower,
   it makes it wrong.
4. **Conditions are recorded with the measurement** — cores, load, node version, the suite's own
   baseline. A measurement without its conditions is not reproducible by definition, and every
   number this ADR carried before today lacked them.

A container would fix the resource envelope but not the dependence, and the dependence is the defect.
It stays available for the CI leg below, where it buys a stable cost model, not a stable verdict.

### Decision B — the ratchet gets a mechanism, because a policy nobody enforces is paperwork

Decision 2 has been in force since 2026-08-05 with **nothing checking it**. There was no committed
list for a later run to be compared against, so "the survivor list does not grow" could not be
falsified. [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) refuses exactly this
shape from an operator.

- **The survivor register is committed** — `docs/compliance/mutation-register.md`, derived from a real
  report by `scripts/mutation-survivors.mjs` and never typed by hand. It is the artifact a later run
  is diffed against.
- **Its shape is guarded on every commit** by `test/unit/mutation-register.test.js`: every survivor
  carries one of the four filings, an equivalence carries its argument, and a hole names an `RWD-`
  entry that exists. Cheap, and it never runs Stryker.
- **The ratchet runs in CI at release time**, per module, off the pull-request path. Decision 3
  stands unchanged and is the reason for the timing: an instrument that makes every change wait gets
  switched off. "Not on every pull request" was never "not in CI", and reading it that way left the
  ratchet unenforced for two weeks.

### What this costs

The pass stays a release-window job, not a per-commit one. Its cost is now dominated by mutants that
genuinely hang, since each is bounded rather than left to run — which is the intended trade: a real
hang is cheap to bound and expensive to tolerate.

## Amendment (2026-08-24) — decision 5's published absence rested on a premise that is now measured false

Decision 5 excludes `src/commands/*` from the perimeter and gives its reason: *no unit test imports
any command, so mutating them would have produced 100 % survivors, which is noise and not a
measurement.* Publishing that absence was right. The reason has stopped being true, and it stopped
being true because of work done in this repository rather than by anything upstream.

**Two things changed.** The verdict moved into `src/lib/verdict.ts`
([ADR-0047](ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md)), which made the
computation reachable and left the command as the shell around it. And the instruction method built
for the 2026-08-21 campaign judges a mutant by running `check --strict --json` on a real mission — it
EXECUTES the command on every mutant, where a unit test that imports a library does not.

**Measured 2026-08-24, on `dist/commands/check.js` lines 340-380 — the slice where the exit code is
chosen — with every Timeout verified alone per the amendment of 2026-08-20:**

| | |
| --- | --- |
| mutants | 50 |
| detected | **13**, all killed outright |
| survived | 37 |
| **no coverage** | **0** |
| score | 26.0 % |

Zero mutants report "no coverage". The prediction was 100 % survivors; the measurement is 74 %, with
nothing uncovered. A 26 % score is low, and low is a finding — `evidence.js` measures 77.4 % and
nobody calls that noise. What decision 5 refused was measuring something no test could reach. That is
no longer the situation.

The first reading of this same slice said 16 detected and 32 %, because Stryker filed four mutants
as Timeout and a Timeout counts as detected. Verified alone, **none of the four was a hang**: three
are survivors and one is an ordinary kill. The verification itself had to be repaired first — its
cheap first phase ran the module's own tests, `check` has none, and `node --test` with no files
discovers and runs the whole suite, so the phase expired every time and confirmed all four as hangs.
A fabricated result, in the flattering direction, from a comment asserting what nobody had run. It is
recorded here because the corrected figure is only trustworthy alongside the reason the first one was
not.

### What this amendment decides

1. **`src/commands/*` is a candidate for the perimeter, and its exclusion is no longer argued from
   coverage.** It stays out today for one honest reason and it is stated as such: the perimeter is
   already 4 250 mutants of which exactly one module is instructed, and widening it before the
   register catches up would buy a bigger number and no more knowledge.
2. **Every timeout was verified alone before being counted**, per the amendment of 2026-08-20, and
   the caution paid for itself immediately: all four turned out not to be hangs. Nothing in the
   figures above rests on a Stryker Timeout.
3. **This is a slice, not the file and not the directory.** Forty-one lines of one command were
   measured. Extrapolating 26 % to `src/commands/*` would be exactly the assertion-instead-of-
   measurement this ADR exists to refuse. The number quoted here is the number that was measured.

### The lesson, which outlives the perimeter question

A published absence has a REASON, and a reason can expire without anyone touching the sentence that
carries it. Decision 5 was written in good faith on 2026-08-05 and was already stale by 2026-08-21,
falsified by the campaign this same ADR prescribes. A register of absences needs its reasons
re-tested on the same clock as its measurements, or it becomes a list of things that were true once.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2026-11-05, or at the first release that adds a module to the verdict core.

Re-run the pass on the named perimeter. The decision is wrong and must be revisited if any holds:
the score dropped without a named cause; the absolute-survivor list grew; the run no longer fits in
a release window; an instructed survivor turns out to have been a live defect filed as equivalent;
or **a pass has to be discarded again because the harness measured the machine** (amendment of
2026-08-20), which would mean environment-independence was asserted rather than achieved; or **a
published absence is found resting on an expired reason** for a second time (amendment of
2026-08-24), which would mean decision 5's absences are not being re-tested on the same clock as its
measurements.

## References

- [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) — a verdict may not rest on what
  the audited party writes; the reason no score is ever a crossing condition.
- [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) — the non-vacuity floors
  whose thresholds `test/unit/artifact-state.test.js` now pins.
- [ADR-0020](ADR-0020-rule-evidence-signatures.md) — the ReDoS screen whose nested-group loop no
  fixture entered.
- [ADR-0043](ADR-0043-territory-is-declared-in-two-parts.md) — the derivation the territory tests
  pin; the reason its mutants corrupt evidence and not a verdict.
- [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) — "same working tree, same verdict", the rule the
  amendment of 2026-08-20 applies to runward's own instruments.
- `docs/compliance/mutation-register.md` — the committed survivor register, which is what makes the
  ratchet of decision 2 falsifiable.
- [ADR-0059](ADR-0059-the-mutation-ratchet-is-enforced-as-freshness-not-as-a-level.md) — how that
  ratchet is enforced: by re-deriving the register, never by reading a score.
- `docs/compliance/regulated-adoption.md` — where the adverse reading of this pass is published.
