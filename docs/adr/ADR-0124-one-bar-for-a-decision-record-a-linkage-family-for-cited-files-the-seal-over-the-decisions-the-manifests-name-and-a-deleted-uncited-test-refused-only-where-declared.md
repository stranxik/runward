# ADR-0124 — What still passes after the integration train: one bar for a decision record, a linkage family for the files a mission cites, the seal over the decisions the manifests name, and a deleted uncited test refused only where it was declared

**Date**: 2026-11-06
**Status**: accepted (2026-11-06). Accepted on the maintainer's instruction in chat (2026-11-05), on the
agent's recommendation; deciders: delegate agent, class D (non-constitutional ADR) of
`runward/delegation.md`
**Deciders**: the delegate agent, under class D of `runward/delegation.md` (`scope-D`: non-constitutional
ADRs), on the maintainer's instruction in chat of 2026-11-05 (« carry it out each time instead of
asking me », relayed by the session that received it). As ADR-0088 decision 3 asks, the act is recorded
by an agent session (agent), for `github:stranxik` (accountable); under ADR-0088 decision 4 the
maintainer is the single accountable person, and the agent's writing is disclosed throughput, not
independent review. Decisions 1 and 4 change `src/lib/conformance*` and `src/lib/evidence*`, pre-merge
paths of the charter: their pull request waits for the maintainer before merge (ADR-0088 decision 7).
The number was checked free against the file names of every open pull request on 2026-11-06
**Method**: designed and measured on 2026-11-06, first on a prototype in a local clone of the rehearsal
branch `integration/2026-11-06-rehearsal` at `63e8a09` (runward 0.46.0 with pull requests #480 to #487
stacked), then implemented on the integration train `integration/2026-11-06` at `1f4e8d5`; Node.js
24.22.1, macOS. The saboteur corpus of 2026-11-05 (inv-D: `case.sh` and its payloads) replayed on
`init --example` built by each clone, each case on a fresh copy, `check --strict` with no seal (N), with
a seal taken before the sabotage (S), and with `--hooks` (H). The prototype carried each decision behind
its own switch so each was measured alone: on the same corpus; on seven variants written for this record
(b3, b4, f3, g5, g6, a decision kept in another tool's format, and the example with every case cited); on
runward's own repository as it stands, on a copy of it opted into the structure contract and on a copy
with the analysis policy pinned; on six published packages of runward's own dependency tree; on the
attack corpus (`test/audit-corpus.js`); and the full test suite, run on a separate machine. The figures
under Consequences are the prototype's unless a paragraph says it measured the implementation. Read:
ADR-0004, 0021 (with its amendments), 0051, 0069, 0074, 0080, 0088, 0089 (with `docs/spec/witness.md`
§7.6), 0090, 0097, 0098, 0114, 0117, 0118, 0119, 0120
**Relates to**: [ADR-0117](ADR-0117-the-verdict-measures-what-the-accountable-people-declared-against-what-the-agent-delivered-decisions-code-and-execution-each-at-a-named-level.md)
(the perimeter: decisions, code, execution),
[ADR-0118](ADR-0118-built-in-analyzers-read-the-delivered-code-against-what-the-mission-declares-under-a-policy-it-pins.md)
(the policy this record adds a family to, before its first release),
[ADR-0119](ADR-0119-three-levels-of-proof-and-one-required-level-each-row-says-whether-its-evidence-is-re-derived-attested-or-declared.md)
(the levels), [ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) (the seal),
[ADR-0069](ADR-0069-the-structure-contract-is-the-default-for-new-missions.md) (the structure contract as
the default of new missions), ADR-0090 item 6 (a deleted test outside the citations)

## Context

**What the train left green.** On the rehearsal stack, the analyzers of ADR-0118, the evidence layer and
the `mechanical` level of ADR-0114 refuse eleven cases of the corpus (a, b2, d, d2, e1, e2, f2, g1, g3 and
c3b at exit 1, c4 at exit 5). Four still exit 0 under `check --strict` with no seal:

| Case | What the sabotage changes | N | S | H |
|---|---|---|---|---|
| b | `code/src/core/domain/triage.ts` replaced by one word: the 10 names that 8 files import from it (16 imports) disappear; no report is regenerated | 0 | 1 | 1 |
| f1 | the case "sales request: classified and routed to the sales queue", which no row cites, deleted from the test file; the JUnit report regenerated (13 cases) | 0 | 1 | 0 |
| g2 | `ADR-0001` replaced by a 47-character stub: a title, `**Status**: accepted`, "Nothing here." | 0 | 1 | 0 |
| g4 | `ADR-0002` replaced by the same stub | 0 | 0 | 0 |

**Why each layer misses them** (line numbers at `63e8a09`).

- *b.* The example cites the file bare: `file:code/src/core/domain/triage.ts`, in the `hexa-architecture`
  row (`examples/request-triage/runward/floor.md`, line 27). The evidence layer checks that a bare pointer
  resolves to a non-empty regular file (`src/lib/evidence.ts:1357`) and checks a symbol only when one is
  named (`:1372`); the row's lint pointer reads the committed report's record for the file (`:1381`), not
  the file. The boundary family reads the core's imports (`src/lib/analyze.ts:803`), and the word imports
  nothing; the cited-symbol family reads `#SYMBOL` pointers only (`:979`); the test-integrity census
  compares the test sources with the committed report (`:926` to `:956`), both unchanged. The one signal
  the reading has, an allowance that now sets nothing aside, is named and not counted (`:1033`; the
  verdict counts findings, `src/lib/verdict.ts:550`). The report still records fourteen green cases, and
  `check` does not verify its freshness (ADR-0098; `src/commands/check.ts:382`).
- *f1.* Seven of the fourteen cases are cited; the deleted one is not, though the row that cites one of
  them says "every case of the suite runs the keyword adapter end to end" (`floor.md`, line 29). The
  evidence layer checks the cases it is given by name (`src/lib/evidence.ts:365` to `:383`); the census
  finds the sources and the report in agreement; without a lock nothing is compared with a previous state
  (`:1695`); `--hooks` regenerates the report from the same tree and finds the same thirteen cases.
- *g2.* `adr:0001` (`architecture.md`, line 43) is read by `adrDecision`, which refuses a file under 40
  characters (`src/lib/conformance.ts:402`, `src/lib/constants.ts:11`) and a status other than accepted
  (`:408` to `:410`). The stub passes both. The example opts into the structure contract
  (`structureContract: true`), whose bar is stronger: a `**Date**` line, a status from the closed list, a
  non-empty reevaluation trigger (`src/lib/mission.ts:176` to `:186`). That bar sets the stub aside in the
  same run and prints "set aside, not counted" (`src/commands/check.ts:179`, `:651`). Two readings of "is
  this a decision?" disagree on one file in one run, the defect class `src/lib/constants.ts:7` to `:10`
  names (RWD-2026-0004).
- *g4.* No `adr:` pointer names ADR-0002; the manifests cite it in prose and by link. The architecture
  note's §8 table cites it, and the structure contract reads that table through `adrIdExists`, which is
  `adrDecision` (`src/lib/mission.ts:405` to `:413`): the stub passes. The journal count sets it aside
  and needs one ADR. The seal covers `adr:` targets, the paths of applied rows and the manifests
  (`src/lib/evidence.ts:1611` to `:1666`); ADR-0002 is none of them, so a seal taken before the sabotage
  stays intact.

**Two kinds of case.** b, g2 and g4 leave the tree inconsistent with what the mission declares: a file the
mission cites no longer provides what the delivered code imports from it; a decision the mission points
at is not a decision record by the mission's own bar. A reading of the tree can see that. f1 cannot be
seen that way: the tree it leaves is the tree an honest maintainer produces by deleting an obsolete test
and regenerating the report, and a deterministic verdict of the tree gives both the same answer. What
tells them apart is a declaration (the case was cited) or a baseline (a seal, an earlier record), never
the code, the tests and the reports alone. ADR-0117 already places "a deleted test outside the citations" in ADR-0090's item 6;
this record says how far that item narrows, and where it cannot.

## Decision

Four parts, ordered by what each closes for what it costs.

**1. One bar for a decision record.** `adrDecision` asks of the file it found what the journal count
asks of it: it calls `adrSetAsideReason` on that file, the same function on the same journal, so the bar
applies exactly where the structure contract applies it today, the mission's own `adr/` under the
mission's opt-in (its lock's `structureContract: true`). An `adr:` pointer, a deviated row's ADR, a
declared uncarriable nature, and every structure-contract table that cites an ADR (§8 of the
architecture note, the ADR cell of the port placement map, the switched positions of the decision matrix)
then refuse a record the journal sets aside, with the bar's reason rather than "no decision journal
holds". The journals ADR-0074 reads outside the mission (`docs/adr/`, `doc/adr/`, `adr/`) keep today's
reading: they are often kept in another tool's format, with no bold `**Date**` label. Without the opt-in
nothing moves (ADR-0069's terms). This is the check "an ADR cited as a decision whose required parts are
missing or placeholders", where "cited" means the structured citations the gate already reads and
"required" means the parts the structure contract already requires. Level: `re-derived`. The witness
(`docs/spec/witness.md` §7.6) gains the condition in a new edition, and its checker re-derives it from the
lock and the record.

**2. A linkage family in the analysis policy, before its first release.** A name an analysed file imports
by a relative path from a file an applied row cites (outside `runward/`), or from a file of the declared
domain core, must be exported by that file. The export set is read from the target's source text with
comments and literals masked: declarations, export lists, `export default`, and relative star re-exports
followed; a JavaScript file shipped with its declaration file (`.d.ts` beside `.js`, `.d.mts`, `.d.cts`)
exports what either declares. A form the reading does not settle (a `.cjs` or `.cts` file, any file that
names `exports` or `module.exports`, `export =`, a destructured export, a name written as a string, a star
re-export of a package) never refuses and is listed under `notAnalyzed`. The
finding names the importing file, its line, the name and the target: as delivered, the code does not
link (a value) or does not type-check (a type), and the finding says which. It is the cited-file counterpart of ADR-0118's cited-symbol family: the mission declared the
invariant when it cited the file and bound the core, and the language says what linking means. Level:
`re-derived`. `runward-analysis/1` has not shipped in a release on 2026-11-06 (it sits under
`## Unreleased` in the CHANGELOG): the family joins it if it ships in the same release, and becomes
`runward-analysis/2` otherwise (ADR-0118 decision 3, a released entry is never edited).

**3. A deleted uncited test is refused only where it was declared.** No re-derived check is added for
f1, because none can tell it from an honest deletion. The shipped example makes its declaration: the row
whose evidence says "every case of the suite runs the keyword adapter end to end" cites every case of the
suite by name, so a deleted case becomes a cited case absent from the report, which the evidence layer
already refuses. Level: `declared` for the citation, checked at `re-derived` against the report, itself
an execution piece that reads `declared` until it is attested (ADR-0119).

*Deferred, decided here, not shipped with the citations:* every strict run will disclose the share no
pointer covers, « N of M cases recorded by a cited JUnit report are cited by no row: deleting one, with
the report regenerated, is refused only under a seal », counted and never gated, on ADR-0051 decision
3's model. It ships in a later release, in its own pull request; until then the share is said by this
record only.

**4. The seal covers the decisions the manifests name.** `check --freeze` also seals every ADR a gated
manifest names by its id, in a row, a table or a sentence, found by the lookup `adr:` uses (ADR-0074's
journals). The manifests are sealed because a seal must cover the claim (`src/lib/evidence.ts:1662` to
`:1666`), and the decisions the claim names are part of it. A name in prose stays outside the checked
layer (ADR-0004): it only decides what the seal freezes. A lock written before keeps verifying exactly the
keys it lists, so no existing seal turns red, and the next `--freeze` widens. This closes the case the
first three cannot see: a decision rewritten into a well-formed record that says something else. Level:
`re-derived` against a declared baseline (the seal, a class R anchor under ADR-0117 note G).

### What this does not change

- ADR-0119's rule that the decision itself is not graded: decision 1 grades the link from a citation to a
  record, by its shape, never what the record decides.
- ADR-0021's « seal what has stopped moving »: decision 4 makes the seal cover more, not apply more often.
- ADR-0090 item 6, except where decision 3 narrows it by a declaration.
- ADR-0118's non-scope: a linkage finding says the code does not link as delivered, never that it is
  wrong.

## Alternatives discarded

- **For g4, a check that an accepted ADR's content has not changed since its acceptance without a new
  ratification.** It needs the content at acceptance. In the tree that is the seal (decision 4) or a
  ratification bound to the ADR's digest; ADR-0080 part 1 binds ratifications to rows, not to ADRs, so it
  would take a new ledger kind, a `ratify` path, and one ratification per accepted ADR before the check
  could run. runward's own practice also appends dated notes to accepted records (ADR-0021 carries two;
  ADR-0117 asks for one per amended record), so a digest of the bytes would refuse every legitimate
  amendment, and a digest of "the decision" would need a reading of where the decision ends. Kept for the
  regulated tier, where a ratification already binds a digest.
- **For g2 and g4, the bar applied to every journal the lookup reaches** (prototyped). It refuses the same
  sabotages, and it reddens an honest mission: a record kept in `docs/adr/` in another tool's format
  (`Date:` and a `## Status` section, no bold labels), cited by a deviated row, exits 0 today and 1 under
  that variant, and 0 under decision 1.
- **For g4, prose mentions read as citations** (`ADR-0002` in a sentence). ADR-0004 keeps prose out of the
  checked layer, and the structured citations already reach every ADR of the example: the §8 table names
  all three.
- **A non-empty `## Decision` section added to the bar.** Measured: every ADR of runward and of the
  example has one, so it would refuse nothing today; decision 1 reuses the bar as it is, and this stays a
  candidate for a later edition of the structure contract.
- **An accepted record the bar sets aside, counted as a strict gap of its own** (prototyped: it refuses g2
  and g4 too). On the example, decision 1 reaches every ADR through the structure contract's tables, so it
  adds nothing measured, and it would add a cause to the verdict and to the witness's `unratified`
  section. Left for a journal that holds accepted records nothing structured cites.
- **For b, « a cited source file declares nothing »** (prototyped). It refuses b and nothing on the two
  trees measured, and misses `export const x = 1` (b3), which the linkage family refuses.
- **For b, a coverage report read against the file** (an LCOV record naming lines past the file's end).
  It depends on how the coverage tool maps lines, and on the files a report happens to name; binding
  reports to source digests is ADR-0120's run Statement, at `attested`.
- **For g6, the seal over every accepted ADR of every journal** (prototyped). The same effect on the
  example, but on runward's mission the sealable set would grow from 50 files to 159 (122 ADRs, most of
  them named by no manifest), and it reverses a pinned property: `test/unit/evidence.test.js:419` (the
  seal freezes the ADR a row cites, « and not another one that happened to be there »).
- **For f1, a census count declared in a manifest** (a JUnit report with at least fourteen cases). A
  grammar change for a weaker declaration than a name: a count survives the swap of one case for another.
- **For f1, the example shipped sealed.** The example is a mission at handover, where ADR-0021 says to
  seal; but `init` prints a walkthrough that edits the manifests, and every edit would also break the
  seal. Not for this release.
- **The default level raised to `attested`.** It would refuse b, and b4 below, through `runward-run`, and
  every mission that has no executor (ADR-0119 decision 4).

## Consequences

- **Measured on the prototype at `63e8a09`**, each decision alone and all together:
  - the control: exit 0, sealed and not;
  - b: exit 1, sealed and not: 16 linkage findings in 8 importing files (4 names imported as values, 12
    as types); b3 (`export const x = 1`): exit 1; b4 (every imported name kept, as `0` or `any`): exit 0,
    refused by `--hooks` (exit 1);
  - g2, g4 and g5 (the third ADR as the same stub): exit 1, sealed and not, by decision 1 alone;
  - g6 (ADR-0002 rewritten as a dated, accepted, well-formed record that reverses the decision): exit 0
    with no seal, exit 1 sealed, by decision 4;
  - f1 and f3 (the uncited case "routing port is idempotent on requestId: no duplicate tickets" deleted):
    exit 1 with no seal, on the example whose row cites its fourteen cases, with the build of `63e8a09`
    unchanged (decision 3's citation needs no code); the control on that example: exit 0;
  - the eleven cases refused before stay refused with the same exit codes.
- **False reds measured on the design as decided: none.**
  - Decision 1: runward's 123 ADRs (`runward/adr/` and `docs/adr/`; 122 accepted, 1 proposed) all meet
    the bar, and so do the example's 3. runward's mission has no opt-in and exits 0 as before; on a copy
    opted into the structure contract, the red lines are identical with and without the prototype (11
    lines, all pre-existing deliverable shapes). A record in another tool's format in `docs/adr/`, cited
    by a deviated row of the example: exit 0 before and after.
  - Decision 2: on a copy of runward with the policy pinned (445 files read), no new finding, in the scope
    above (70 import statements, 219 names, 7 target files) and on every relative import of the tree (517
    statements, 1,352 names, 142 target files, 3 export sets not settled); on the example, 31 statements,
    50 names, 11 target files, no finding. Positive control: renaming one exported function of
    `src/lib/conformance.ts` on that copy is named at its two importers and nowhere else. On code runward
    did not write: six published packages of its own dependency tree, copied and read on every relative
    import (1,633 files, 2,500 statements, 3,273 names, 839 target files), no finding. The first reading
    of that probe found 72, on one package and all of one shape: a declaration file importing a type
    through the `.js` path of its JavaScript sibling, read from the JavaScript file, plus CommonJS files
    the reading took for modules that export nothing. The two rules of decision 2 on declaration files
    and CommonJS come from that probe; a tree that holds only runward's own layout would not have shown
    them.
  - Decision 4: existing locks verify by their own keys; the example sealed before any sabotage exits 0,
    and its seal grows from 28 files to 29: ADR-0002, the one decision it did not cover. On runward's
    mission, which is not sealed, the sealable set would grow from 50 files to 68 (13 ADRs to 31).
  runward's repository and the example are trees runward wrote, and the six packages are code, not
  missions (no territory, no citation: they were read on every relative import, a wider scope than
  decision 2's). ADR-0117's criterion 2 (three repositories runward did not write, every finding
  classified by a reviewer who did not write the analyzer) still applies to the linkage family before it
  joins the default of new missions, as it does to every family of ADR-0118.
- **runward's own suite**, the four decisions together, on a separate machine: 1,963 tests, 11 failing.
  Every test the four decisions move was read, and none
  is a false red on a tree: a pinned count of findings on a planted sabotage, which the linkage family
  raises with true findings (`test/unit/analyze-bench.test.js`, 3 tests); a golden of a reddened example
  whose renamed symbol is still imported, now named at its importer (`test/unit/report-summary-md.test.js`,
  1); fixtures that write an ADR with no `**Date**` line under the structure contract
  (`test/unit/requires-nature.test.js`, 3) and AC-016 through the witness test
  (`test/unit/verdict-witness.test.js`, 1); tests that need an uncited case of the example, which
  decision 3 no longer leaves (`test/unit/junit-seal.test.js`, 2), and the readiness golden that quotes
  the example's floor row (`test/unit/readiness-golden.test.js`, 1). Each moves in the pull request of
  its decision. The stages after the unit tests, which the chain does not reach past a failure, were run
  apart: `test/smoke.js`, the schema checks and the SARIF shape pass, and the attack corpus reads 17 of
  18 (AC-016, below). The suite of `63e8a09` passes whole (1,963 tests, 0 failure, the corpus 18 of 18).
- **The deferred disclosure of decision 3 will be loud on runward itself**: its mission cites 12 of the
  1,838 cases its committed report records (counted by a script on the tree; the line itself was not
  prototyped). It is true, and runward's own protection lies elsewhere: the report regenerated and
  compared in CI, and review.
- **One honest case of the attack corpus has the stub's shape.** AC-016 (`test/audit-corpus.js`, « an
  accepted ADR whose line merely names another one ») writes a record with a status line and a context,
  no date and no trigger, in the example's own journal, and a deviated row rests on it. The g2 and g4 stub
  is the same shape: a deterministic bar cannot tell « Something was decided and this records it. » from
  « Nothing here. » without reading what the record says. Under decision 1 the corpus reads 17 of 18 as
  expected; with the two lines the structure contract requires added to AC-016's fixture, 18 of 18, on
  the prototype and on `63e8a09` alike, and the case keeps testing what it tests (the status is the first
  word). Accepting decision 1 is accepting that change of the fixture: under the structure contract, a
  record with no dated trigger is not a decision a row may rest on, which is what the template already
  says (« an ADR without a reopening signal hardens into dogma »).
- **Negative, accepted.**
  - A mission under the structure contract whose cited ADR lacks its date or its trigger turns red where
    it was green; the reason names the line to add. One population is named in the migration note: a
    journal whose trigger headings are written in another language, which ADR-0097 (option A) already
    sets aside and which decision 1 now refuses where it is cited, as ADR-0097 already reads every
    deliverable of such a mission in progress. ADR-0097's option E (a missing trigger as a strict gap
    outside the opt-in) stays undecided.
  - The linkage family reads the export forms of every cited and core file: on the pinned copy of runward,
    `check --strict` took 1,179 ms without the prototype and 1,203 ms with it (median of 3), on the example
    379 ms and 404 ms (median of 5), on a machine whose load average fell from 6 to 2 during the runs: an
    order of magnitude, not a benchmark.
  - The witness's §7.6 gets a new edition and its checker the bar; `verify` must re-derive it.
  - The example's floor row carries seven more pointers, and every golden output that counts the
    example's pointers moves.
  - A sealed mission turns red on each dated amendment of a decision its manifests name: the cost
    ADR-0021 accepted for every sealed file, and the reason it says to seal what has stopped moving.
  - `test/unit/analyze-bench.test.js` pins the findings of each planted sabotage, and the linkage family
    adds true findings to three of them (7 to a, 1 to c3b, 6 to ae2: their payloads drop names other files
    import); the counts move in the pull request that ships the family.
- **On other boundaries.** No crossing of ADR-0054 moves: the bar, the linkage reading and the seal read
  the working tree, offline, with no execution. Decisions 1 and 4 wait for the maintainer (pre-merge
  paths); decision 2 is in `src/lib/analyze.ts`, on no pre-merge path until the charter's next renewal
  names it (ADR-0117, consequences).

### What this does not catch

- **A placeholder that keeps every name** (b4): the code links and does nothing. Behaviour needs an
  execution: `--hooks` today, `attested` with `runward-run` (ADR-0120).
- **A deleted case nothing cites, on a mission with no seal.** Refused by none of the four; disclosed by
  decision 3's line once it ships.
- **A well-formed decision rewritten with no seal**, or re-sealed by the agent: the forge protects the
  seal (ADR-0117 note G).
- **A record that meets the bar and decides nothing useful**: the bar reads shape, never content.

## What would settle it

**For**, each published with its commands:

1. The corpus of 2026-11-05 and the variants of this record, replayed with the release that ships
   it, on `init --example` as shipped: b, b3, g2, g4, g5, f1 and f3 exit non-zero with no seal; g6 exits
   non-zero sealed; the control exits 0, sealed and not; the eleven cases refused before keep their exit
   codes; the attack corpus (`test/audit-corpus.js`) reads 18 of 18 as expected, AC-016's fixture
   completed with its date and its trigger.
2. Zero new refusal on runward's own repository at the release commit, as it stands and on the two copies
   (structure contract, pinned policy), and, for the linkage family, on the three repositories of ADR-0117
   criterion 2, every finding classified.
3. The positive controls as tests: a renamed export named at each importer and nowhere else; a stub
   record cited by `adr:` and by the §8 table refused with the bar's reason; a lock written before
   decision 4 verifying unchanged; a deleted cited case refused on the example.
4. The witness checker re-derives decision 1's refusal, and `verify` stays green on an unchanged tree.

**Against**:

- One honest mission under the structure contract reddened by decision 1 on a record its accountable
  people stand by as a decision: the bar is drawn in the wrong place, and decision 1 moves behind an
  opt-in of its own.
- One linkage finding on code that compiles and loads: the export reading is wrong; filed as an undue
  refusal under ADR-0118, and the family stays out of the default until it is fixed.
- A reader who takes the disclosure of decision 3 for a measure of test quality.

## Reevaluation trigger (mandatory, dated)

Reopen on 2026-11-15, ADR-0117's dated reading, then on 2027-02-05. Earlier: the first undue refusal
attributed to decision 1 or 2; a release that ships `runward-analysis/1` without the linkage family; the
change record of ADR-0093 (D2) reaching a release, which gives f1 a baseline outside the tree.

**Trigger set on**: 2026-11-06 · **Watched via**: the saboteur corpus once it joins `test/audit-corpus.js`
(ADR-0117), the undue-refusal entries of `docs/compliance/known-defects.md`, and the classification of
ADR-0117 criterion 2.

## References

- ADR-0004, ADR-0021, ADR-0051, ADR-0069, ADR-0074, ADR-0080, ADR-0088, ADR-0089, ADR-0090, ADR-0093,
  ADR-0098, ADR-0114, ADR-0117, ADR-0118, ADR-0119, ADR-0120.
- `src/lib/conformance.ts` (`adrDecision`), `src/lib/mission.ts` (`adrSetAsideReason`),
  `src/lib/analyze.ts`, `src/lib/evidence.ts` (`sealableEvidencePaths`, `verifyEvidenceLock`),
  `docs/spec/witness.md` §7.6, `examples/request-triage/runward/floor.md`.
- The saboteur corpus of 2026-11-05 and the measurements of this record, outside this repository.
