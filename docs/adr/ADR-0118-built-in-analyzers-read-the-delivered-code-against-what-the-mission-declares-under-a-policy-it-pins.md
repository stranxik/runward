# ADR-0118 — Built-in analyzers read the delivered code against what the mission declares, under a policy it pins

**Date**: 2026-11-05
**Status**: accepted (2026-11-05)
**Deciders**: the maintainer, by delegation in chat on 2026-11-05: "runward should perhaps cover more than we
imagined. Everything has evolved." and "I trust you; carry it out each time instead of asking me." On the
recommendation of the agent sessions that investigated (scratchpad inv-S2); the maintainer did not review this
text before acceptance. Written by an agent session; under ADR-0088 decision 4 the maintainer is the single
accountable person, and the agent's writing is disclosed throughput, not independent review
**Method**: read on a fresh clone of `stranxik/runward` at `main@61d5041` (0.46.0): `src/lib/verdict.ts`,
`src/commands/check.ts`, `src/lib/check-contract.ts`, `src/lib/territory-map.ts`, `src/lib/evidence.ts`,
`src/lib/witness.ts`, `src/lib/sarif.ts`, `test/unit/runtime-boundary.test.js`,
`test/unit/positioning-drift.test.js`, ADR-0001, 0005, 0041, 0043, 0052, 0054, 0069, 0078. Measured on
2026-11-05, before writing: a 124-line prototype run on the bench of the same day (the seven sabotages planted
in the example mission and pushed through the CI the docs recommend, which 0.46.0 judged green by default);
then the module this record decides, on the same plantings, on two renamings, on a weakened suite, and on a
copy of this repository with the policy pinned
**Relates to**: ADR-0117 (the widened perimeter this record works inside; written in its own pull request),
[ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md),
[ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md),
[ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md),
[ADR-0043](ADR-0043-territory-is-declared-in-two-parts.md) (amended below);
[ADR-0052](ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md),
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (untouched, said below);
[ADR-0069](ADR-0069-the-structure-contract-is-the-default-for-new-missions.md) (the opt-in precedent),
[ADR-0078](ADR-0078-the-domain-core-is-a-category-and-one-written-absence-is-reopened.md) (the declared
domain core), RWD-2026-0194 in [known-defects.md](../compliance/known-defects.md)

## Context

**What the gate cannot see today.** `check --strict` verifies that a decision is traced to evidence that
resolves: a file, a symbol, a green case, a scan. It never opens the code it does not cite. The bench of
2026-11-05 planted seven sabotages in the shipped example, sealed, each leaving the cited names in place: the
domain core talking to Postgres with a hard-coded key (a), every cited symbol a constant `0` (c3b), a core
file that asks a model for a shell command and runs it (d, and d2 where the use case imports it), every
assertion removed (e1, and e2 with the JUnit report regenerated), and both at once (ae2). Pushed as is, six
were refused, each by the evidence seal alone, and d was green. Re-sealed first by the agent
(`check --strict --freeze`, a command it can run), six of the seven read green under 0.46.0. Only a job that
regenerated the reports out of the agent's reach, then ran the gate, refused all seven. A renaming that
leaves the old name in a comment is green too (RWD-2026-0194). The investigation's summary: the gate links,
and an agent that keeps the links can rewrite the domain under them.

**What the mission already declares.** The invariants a reading of the code would check are not invented by
runward: the mission writes them. `runward/territory.md` binds files to `domain-core` (ADR-0078), the
category whose rule says the core "never imports from adapters"; the manifests cite symbols and committed
JUnit reports; the example's architecture states that the core holds no I/O. What was missing is a reader of
the code that confronts it with those declarations, inside the gate, without a model, without running
anything, and without the adopter's own tooling (the bench showed that reports committed by the agent can
be forged; ADR-0073 option 3, a live CI reference, stays refused under ADR-0054 crossing 4).

**Measured before deciding.** A prototype reading only the tree (`runward/territory.md`, the manifests'
pointers, the sources, the committed JUnit report) raised findings on all seven sabotages, none on the
healthy mission nor on an honest renaming, in 0.08 s. Its measured limit: a dangerous file placed outside the
declared territory escaped it, and a rule "code execution refused everywhere" caught it with no new finding
on the healthy trees. It missed SQL built by concatenation in one file of three: that check is a heuristic.

## Options considered

- **A. Built-in analyzers, deterministic, behind a policy the mission pins.** runward ships the reading; the
  mission pins a policy id and writes its allowances; findings count under `--strict`, heuristics never do.
- **B. Cite the adopter's own analyzers** (ESLint, Semgrep, CodeQL reports). Already possible (`requires:`,
  ADR-0056), and kept: it is the stronger evidence when the reports are produced out of the agent's reach. It
  does not answer the bench: the agent that writes the code writes the committed report.
- **C. A model reviewing the diff.** Refused by ADR-0001 and ADR-0007 for the verdict path, and refused here:
  the verdict must re-derive offline from the tree.
- **D. Do nothing; document the limit.** RWD-2026-0194 and the investigation already document it. The
  maintainer's call of 2026-11-05 is that runward should cover more than was imagined.

## Decision

**A**, on these terms.

1. **What the analyzers verify: the gap between what the mission declares and what it delivers, never that
   the code is good.** Five families, read from source text at rest (`src/lib/analyze.ts`):
   - *boundary*: a file `runward/territory.md` binds to `domain-core` imports nothing outside the core: no
     module outside it by a relative path, no package and no Node.js built-in that `runward/analysis.md` does
     not allow;
   - *capability*: no analysed file outside the tests executes code built at run time (`eval`, the Function
     constructor, `node:vm`), imports `child_process`, or loads a module whose name is computed; in the domain
     core, no network (`fetch`, socket and HTTP modules) and no environment (`process.env`, `import.meta.env`);
   - *secret*: no file holds a credential of a known format (ten formats with fixed prefixes, and a URL
     carrying a user name and a password that is not a placeholder nor a local or documentation host); the
     value is never printed;
   - *test integrity*, without running a test: every case asserts something (an assertion, an asserting
     helper of the same file, a subtest, a throw); a file named as a test declares a case or imports
     something; a test file reaches more than its framework (an import of the code, a process, a request);
     a cited JUnit report records no case the test sources do not declare. A test co-located in the core is
     a test, not core code;
   - *cited symbol*: a `file:PATH#SYMBOL` pointer of an applied row names a symbol carried by code, not only
     by a comment or a string, and not declared as a placeholder constant (`= 0`, `null`, `{}`, `[]`, `""`).
2. **What they never verify, and never say.** That the code is correct, secure or good; that a test asserts
   the right thing; anything in a language the policy does not read. The reading's own non-scope travels with
   it (`ANALYSIS_NON_SCOPE`), and `GATE_NON_SCOPE` gains one sentence: under a pinned policy the gate also
   reads the delivered source text, without running it, for the invariants the mission declares, and that
   reading can say a declared invariant is broken, never that the code is good.
3. **The policy is data, versioned, and pinned by the mission.** `src/lib/analysis-policy.ts` holds one frozen
   entry per policy id: the extensions read, the directories set aside (dependencies at any depth, build
   output only beside a `package.json`), the module classes, the secret formats, the test-file conventions.
   The mission pins an id in `runward/scaffold-lock.json` (`"analysis": "runward-analysis/1"`). A released
   entry is never edited: a change to what a policy refuses is a new id beside the old one, and a mission
   moves by changing its pin, in a diff. A pin this version does not ship (or one that is not an id) is one
   finding and nothing is read: the gate refuses rather than read the code under a policy the mission did not
   pin. A defect in the reading code is fixed and filed like any verdict defect.
4. **The opt-in, and the default.** An existing mission opts in by adding the line to its lock; `update`
   never writes it and never drops it (the RWD-2026-0106 lesson, carried as a parameter of the lock writer).
   A new mission (`runward init`) and the example are born with the current policy pinned, on ADR-0069's terms
   for the structure contract. Disarming stays one honest edit away: delete the line, in a diff a reviewer
   reads.
5. **The mission's half of the declaration.** `runward/analysis.md`, never written by runward, holds the
   allowances, each with its reason: the modules the domain core may import, the capabilities a path may use
   (`code-execution`, `process-execution`, `computed-import`, `network`, `environment`), the paths not
   analysed. It is ADR-0043's split applied to the reading: runward names what is checked, the mission names
   its exceptions. Every allowance in use is counted, an allowance that sets nothing aside is named (a stale
   allowance hides the next real finding, ADR-0043's rot rule), a row that cannot be read is named.
6. **`notAnalyzed` and `hypothesis`, outside the exit code.** What the policy does not read is said: the files
   of each other language by count, files over the size limit, symbolic links (never followed: the reading
   stays inside the tree), a family with nothing declared to check (no `domain-core` bound), cited symbols in
   an unread language. What the reading cannot settle is a `hypothesis`, ADR-0041's labelled class, built
   here behind this opt-in and never counted: SQL text joined to a value, a case that asserts only on
   literals (`assert.ok(true)`, which a does-not-throw case may use by design), a test file whose cases the
   reader cannot see, a census the tree cannot complete (cases named at run time, `test.each`), an empty
   cited function, a path alias imported by the core (`@/x`, `#x`: the project's own resolution, unread).
7. **Where it lands.** Under `--strict` only: a presence check reads no code. `computeVerdict` adds the
   findings to `strictGaps` as `strictBreakdown.analysis`; `check` renders its own section and the Why red
   lines; `--json` carries `gaps.analysis` (inside `gaps.conformance`, like `proposed`), one `conformance` row
   per finding (kind `analysis-<family>`, the code file and line) and an `analysis` block; SARIF, Code
   Quality and JUnit renderings annotate the code at its line; the witness carries one cause per finding
   (family `analysis`, not witnessed: it holds the facts, not the source text); `report` renders the reading.
   A mission without the pin keeps every field it had; only the gate-wide non-scope sentence of decision 2
   changes for every mission.

### What this amends

- **ADR-0001.** "It never opens project code": under a pinned policy, the strict gate opens the delivered
  source text to check what the mission declares. The rest holds: it runs nothing, no model sits in the gate
  path, the operator owns the gate (the operator pins the policy and writes the allowances). The discarded
  "auto-blocking quality gate (an LLM or heuristic that fails the build on a bad artifact)" stays discarded:
  a finding is a declared invariant broken, never a judgment of quality, and a heuristic never fails a build.
- **ADR-0005.** "The gate RUNS nothing" stands untouched. Its language neutrality is amended: policy 1 reads
  TypeScript and JavaScript, and no other language is judged as if it were covered; it is listed under
  `notAnalyzed`. Test honesty stops being only the CI's job for one narrow question that needs no execution:
  whether a case can fail at all.
- **ADR-0041.** Content signals (reading code to infer that an obligation applies) stay refused: the analyzers
  read code to check obligations the mission declared. The `hypothesis` class it deferred "behind its own
  opt-in flag, never mixed with declared matches and never counted" is the one built here.
- **ADR-0043.** "The gate never reads the map": under a pinned policy, `check --strict` reads
  `runward/territory.md` to know the declared domain core. Inference from project code stays out: no category
  is derived from what the code contains.
- **`GATE_NON_SCOPE`**, by the sentence in decision 2, wherever it travels (attestation, SARIF, packs, report).
- **The scale bench's sentence**, "the gate's cost follows what you cite, never your repo": true with the
  analyzers off; with them on, the strict gate also reads the delivered source, so that part of its cost
  follows the size of the code read. `test/bench-scale.js` prints both, and the README says so.

### What this does not touch

- **ADR-0052's locked thesis.** Independence: the analyzers ship with runward; the judged party writes
  allowances, in its tree, in review, and never the reading. Survival: the reading re-derives offline months
  later on the repository alone, under the policy the tree pins. Agent-agnosticism: nothing depends on which
  agent wrote the code. `test/unit/positioning-drift.test.js` stays green, and "never that the code is good"
  is now said by the reading itself.
- **ADR-0054's five crossings.** No endpoint, no process between invocations, no key or identity, nothing read
  outside the judged tree (links are not followed), no network, model or spawn: `src/lib/analyze.ts` imports
  `node:fs` and `node:path` only, and `test/unit/runtime-boundary.test.js` walks it inside the verdict ring.

## Alternatives discarded

- **The adopter's analyzers only (B).** Kept as evidence, not as the answer: a committed report is written by
  whoever writes the code, and in the bench a hand-written ESLint report of 93 bytes satisfied `requires:`.
- **A model in the loop (C).** The verdict would stop re-deriving offline and stop being the same twice.
- **A rule set the mission writes in code (an executable rules file beside each ADR).** It moves the reading
  into the judged party's hands: the agent that writes the code would write the check.
- **Infer the boundary from imports alone (no territory).** Which files are the core is a declaration; a
  guess would be the content signal ADR-0041 refused.
- **Counting heuristics.** A SQL motif, a tautology or an incomplete census would turn a doubt into a red
  build; reported, they inform the reviewer without deciding for them.

## Consequences

- **Measured on the bench**, the same plantings as tests (`test/unit/analyze-bench.test.js`): (a) 8
  findings, plus the five SQL concatenations as hypotheses, guard.ts included; (c3b) 9; (d) and (d2) 4; (e1)
  and (e2) 15; (ae2) 23; the sabotage moved outside the territory, 2. The healthy example, the honest renaming
  and the weakened suite (`assert.ok(true)` everywhere: 14 hypotheses) have no finding; the renaming with the
  old name in a comment has one.
- **Measured on this repository**, the policy pinned on a copy: 387 source files and 334 configuration files
  read, 22 findings, every one a real capability site the mission would have to allow (the four files of
  `SPAWN_ALLOWED`, sixteen build and maintenance scripts, the example's JUnit script, a documentation recipe,
  and one computed import), no secret, no test-integrity and no symbol finding across 250 test files (this pull request's included), three
  hypotheses. runward's own lock is not changed by this record: opting in is a lock change, a pre-merge event
  of `runward/delegation.md`.
- **Cost**, measured on the maintainer's machine under load (median of 5 to 7 runs, Node.js 24.22.1): the
  example's `check --strict` went from 250 ms to 271 ms; this repository's from 470 ms to 801 ms (the reading
  alone, 320 to 430 ms for about 9 MB). `test/bench-scale.js` on a Linux runner (Node.js 24.22.1, median of
  5): the example 583 ms off, 628 ms on; buried under 10,000 uncited files (about 20 MB), 609 ms off (1.05×,
  flat) and 1,765 ms on (2.81×: every one of those files is read).
- **Every new mission reads its code.** A mission that keeps scripts spawning processes, or a core importing
  a library, writes one allowance per site, with its reason; the example carries two.
- **The witness, the attestation and `verify`.** The witness names the family as not witnessed. The
  attestation's subject (`runward/` and the cited evidence) does not bind the analysed files, and `verify`
  neither compares `gaps.analysis` nor the `analysis` block: an uncited code change re-derives a different
  verdict under an unchanged subject. Binding the analysed files is the attestation's next subject, studied in
  its own pull request; until then the field is one more that `verify` neither re-derives nor names
  (RWD-2026-0192's class).

### What this does not catch

- **An adversary who obfuscates.** `const run = eval; run(x)`, `globalThis["ev" + "al"]`,
  `process.binding`, a module loaded through a variable the reading cannot follow beyond the computed call it
  refuses. The families check declared invariants in the plain spellings code is written in, not malware.
- **What the allowances and exclusions hide.** An agent can write an allowance row or a path not analysed; the
  row is in the tree, counted and shown, and review is the control. A file under a test directory or named as a
  test is outside the capability family; a directory named `node_modules` is set aside anywhere.
- **A test that asserts the wrong thing**, a tautology (a hypothesis only), a credential of an unknown format or
  in a dotenv file (not read: on disk it is usually ignored by version control, which the gate does not read),
  a file over 1 MB, and every language but TypeScript and JavaScript.

## Amendment (2026-11-06) — the reading after the false reds of three repositories runward did not write

ADR-0117 (What would settle it, criterion 2) ran the analyzers on express, fastify and hono at pinned
commits; two reviewer sessions that wrote neither the analyzers nor the harness classified the 221 findings,
129 false and 92 true. The reading is corrected on evidence the tree carries, never narrowed to silence: every
true finding still fires, the bench's sabotages keep their exit codes, and the evasions a second review built
against the first version of this correction read red again (`test/unit/analyze-false-reds.test.js`, one
test per pattern, each beside a case classified true and those evasions).

- *Test integrity*: the code under test is what a test file imports from a module that is not a test, and
  every name it assigns from it. A TypeScript case asserts at compile time when its project runs a
  type-checker (a `package.json` script on its path) and the assertion is about that code: an assertion type
  constrained `extends true` instantiated on it (`type verify = Expect<Equal<Expected, Actual>>`), or a
  `@ts-expect-error` over a line that uses it; an asserting helper may spread its parameters over lines. A
  case that only checks that the code under test completes without error (its `done` handed to that code,
  under a runner that passes one; an object of it set up and awaited as a statement, `await
  fastify.ready()`; a promise of its own that can still reject on a failure path) is no finding: it is the
  hypothesis `case-asserts-completion`, decision 6's labelled class, beside `case-asserts-literals`. A value
  awaited and never read keeps the case a finding. Decided on 2026-11-06 with the classification: a case with
  no assertion at all stays a finding, a bare call awaited or not and a type case with no type assertion
  alike; the case asserting only on literals stays a hypothesis, which no longer says it is by design.
- *Capability*: a loader whose argument is a `const` initialised with a literal alone in a scope that holds
  the call, or the parameter of a local function only ever called with literals, loads that module when the
  name occurs nowhere else; it is judged as a literal import, by the boundary in a declared core. The network
  is judged by what an import binds and reads, its type-only form read from the statement's syntax: a table
  of constants (`METHODS`, `STATUS_CODES`, `isIP`) or a type-only import is a `core-import-builtin` finding,
  the module still refused in the core, and a `network` allowance of the file still covers it.
- *Secret*: a PEM private key block is a finding when a base64 run of key length sits before its END line
  (or right after the armour, with none), whatever carries the lines; a body holding an interpolation or a
  placeholder holds no key.
- *Cited symbol*: a name resolves to the module's declaration (through a function that wraps the module,
  never into a named function's local); an empty constant the code reads as a value is the hypothesis
  `symbol-sentinel-constant`, never counted; a stub that is only called, exported or typed stays a finding.

What the corrected reading lets through, said: a case whose assertions were deleted while it still hands
its `done` to the code under test, or still sets up an object of it and awaits it without binding the
result (`app.get(…)` then `await app.request('/')`), reads as the completion hypothesis, not as a finding;
a type-checker declared by the project is taken as running on the tests. These false reds were found before
any release carried the analyzers, and none is filed in the defect register.

## What would settle it

- **For A**: over the next ten pull requests of this repository and the first pilot mission, every sabotage of
  the bench re-run on each release is refused, and fewer than three `undue-refusal` entries of the defect
  register are caused by the analyzers.
- **Against A**: three such undue refusals under policy 1 (a finding on code later judged legitimate, not an
  allowance the mission forgot), or a planted sabotage of the bench that a release reads green.

## Reevaluation trigger (mandatory, dated)

Reopen at the third `undue-refusal` caused by the analyzers, at the first bench sabotage a release reads green,
when a pilot asks for a second language, when the attestation's subject binds the analysed files (the
`verify` half of decision 7), or on 2027-02-05, whichever comes first.

**Trigger set on**: 2026-11-05 · **Watched via**: `test/unit/analyze-bench.test.js` on every pull request, and
the `undue-refusal` entries of `docs/compliance/known-defects.md` that name ADR-0118.

## Note, 2026-11-06: a sixth family before the policy's first release (ADR-0124)

[ADR-0124](ADR-0124-one-bar-for-a-decision-record-a-linkage-family-for-cited-files-the-seal-over-the-decisions-the-manifests-name-and-a-deleted-uncited-test-refused-only-where-declared.md)
decision 2 adds the *linkage* family to `runward-analysis/1`: a name the delivered code imports, by a
relative path, from a file an applied row cites or from the declared domain core, is exported by that
file, and a form the reading does not settle (CommonJS, `export =`, a destructured export, a re-export it
cannot follow) never refuses and is listed under `notAnalyzed`. It reads the delivered tree only, like
every family since ADR-0113 decision 5. The policy has not shipped in a release on this date, so decision
3 holds: had it shipped, the family would have been `runward-analysis/2`. Decision 1's list reads six
families from this note. On the bench of this record, the family adds true findings to three plantings,
whose payloads drop names other files of the example import: 7 to (a), 1 to (c3b), 6 to (ae2).

## References

- `src/lib/analyze.ts`, `src/lib/analysis-policy.ts`, `src/lib/analysis-render.ts`.
- `test/unit/analyze-bench.test.js`, `test/unit/analyze-scanner.test.js`, `test/unit/analyze-gate.test.js`.
- `examples/request-triage/runward/analysis.md`, `test/bench-scale.js`, `docs/spec/witness.md`.
- ADR-0001, 0005, 0041, 0043 (amended); 0052, 0054 (untouched); 0069, 0078, 0088 decision 4; ADR-0117.
