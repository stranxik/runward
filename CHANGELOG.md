# Changelog

## Unreleased

### The release verification demands a GitHub-hosted runner (RWD-2026-0185), and a deploy-time verification recipe

`docs/verifying-a-release.md` Step 2 said the verification proves "a GitHub-hosted runner", and no
documented command demanded one: `gh attestation verify` requires a value of the certificate's
runner-environment extension (Fulcio OID `1.3.6.1.4.1.57264.1.11`) only under
`--deny-self-hosted-runners`. Every `gh attestation verify` of the guide that verifies a runward
release artifact (Steps 2, 2c, 3, 6, 8, 9) now carries the flag, and so do the four of
`.github/workflows/verify-release.yml`, held in lockstep by the documented-commands guard. Re-run with
the flag on 2026-10-28: the examples on v0.33.3, v0.33.4 and v0.33.5, every executed step on the
v0.46.0 assets (31/31 expectations, offline lines with the network cut), Step 9 on
`runward-forge-0.46.0.tgz` and Step 6 on `ratchet-summary-0.45.0.json`, all exit 0.
`docs/interop.md` gains section 4 bis: a fail-closed check in the operator's deploy job, before any
write, that verifies the attestation's signer workflow, OIDC issuer, source commit and ref, and runner
environment (`--deny-self-hosted-runners`, or a `jq` read of
`verificationResult.signature.certificate.runnerEnvironment` when the pipeline must be self-hosted),
then the deployed file's digest; what runward does not do there (its verdict verifies no signature
and reads nothing of where it runs); and the risks of a self-hosted runner, with sources.
`templates/mission/execution-topology.md` points at it, so the `init` golden is regenerated. Section 3
now says the Kosli `--compliant` value is the operator's mapping of runward's exit code. No CLI
behaviour, output shape or verdict changes.

### ADR-0046's trigger reads unfiled survivors and a measured window

The clause "the absolute-survivor list grew" fired by construction when the measured perimeter went
from 11 to 25 modules; it now fires when a survivor reaches a release unfiled (ADR-0059's ratchet, or
ADR-0103's freshness check at the tag). "A release window" is now 16 hours of wall clock, against the
12.6 h and 13.2 h measured on 0.44.1 and 0.45.0. The register's list of measured modules is written by
its generator from `stryker.config.json`. Decided by the maintainer on 2026-10-28.

### The MCP descriptor validates against the schema it declares (RWD-2026-0184), and four ADR links resolve

`packaging/mcp/server.json` declared the 2025-12-11 MCP server schema, whose `description` is limited
to 100 characters, with a 226-character description; it is now 96 characters and says the same thing.
ADR-0060, ADR-0061, ADR-0083 and ADR-0097 linked ADR-0004, ADR-0019 and ADR-0030 under file names
that never existed; the links point at the records. Found by the dated reevaluation pass of
2026-10-28.

### A sealed JUnit report is sealed by its cases and verdicts, not its timings (ADR-0102 B, RWD-2026-0181)

`check --freeze` hashed every sealed file by its bytes, so a JUnit report the next test run rewrote
(`time`, `timestamp`, `hostname`, console output, suite order) broke the seal with no code changed. The
seal now hashes a report a test runner wrote by a canonical projection of what the gate reads: its suites
and cases, sorted, each case's suite path, `classname`, `name` and verdict (`passed`, `skipped`,
`failure`, `error`), and the root failures-and-errors count. Another run of the same suite keeps the
seal; a case renamed, removed, added or changing verdict breaks it. A report that does not parse whole is
sealed by its bytes, and `check --freeze` names it. `evidence-lock.json` gains an additive `hashKinds`
member, written only when an entry is projected (`"junit-projection-v1"`); an entry without a recorded
kind is a bytes entry, so a lock written by an earlier runward is verified exactly as before, and one
`check --freeze` migrates it. The projection is specified in `docs/spec/runward-oscal-mapping.md` §6. The
verdict attestation and the witness keep digesting files by their bytes; no `--json`, SARIF, OSCAL or
witness shape changes. The normaliser recipe in `docs/operator-role.md` and the adapters README is no
longer needed for sealing, only for a byte-stable committed file. Decided by the maintainer on
2026-10-28, the trigger of ADR-0102 having fired (ADR-0098 decided).

### The register records the code each module was measured on, and a stale one refuses the draft (ADR-0103)

ADR-0059 says a stale mutation register blocks a release; it never could. The ratchet starts on
`release: published`, with the npm publish, and answers hours later: on 0.45.0 it signed `refused`
thirteen hours after publication, on an immutable release (RWD-2026-0183). The register now records, per
module, the SHA-256 of the built `dist/lib/<module>.js` its measurement mutated, read from the source the
run's merged report embeds, with the run id and date: `docs/compliance/mutation-measured-sources.json`,
written by `scripts/mutation-record-source.mjs`, which replays the ratchet on the report first and writes
nothing unless the register describes it. `npm run mutation:fresh` (`scripts/mutation-fresh.mjs`) compares
it with the current build: exit 0 when every module is fresh, 1 naming each stale or unknown module with
`gh workflow run mutation-ratchet.yml -f module=<m> -f mode=measure`, 2 when an input is missing. The
release workflow runs it after its build and before it drafts, so a release whose built modules differ
from what the register was measured on gets no draft. Seeded from the reports themselves: the seven
modules measured on 2026-10-28 and the eighteen measured by the 0.45.0 release ratchet, all 25 replayed
as "describes" and fresh on this tree. Not covered, and said in the ADR: a stronger test that retires a
filed survivor without touching the module. Development only: nothing in the package changes.

### Changed: only the latest minor line is supported, and stale public statements corrected

`SECURITY.md` now supports the latest minor line only, with no backport (the maintainer's decision of
2026-10-28, dated notes in ADR-0068 and ADR-0086): the six-month promise on the previous minor was never
kept, so it is withdrawn and said so. A test fails when the table does not name exactly the package's
minor as supported. `ROADMAP.md`, ten other ADRs, `docs/distribution.md`, `docs/compliance/regulated-adoption.md`,
`docs/corpus-authority-brick.md`, the mutation register's preamble and one README sentence (the assurance
line is printed by `check --json` and `report --format md`, not by the terminal `check`) are brought in
line with the tree. No CLI behaviour changes.

## 0.46.0

### Five adopter findings shipped, and what a sealed JUnit report may say

A minor release that ships the five decisions an adopter's reports led to (ADR-0098 to ADR-0102,
accepted on 2026-10-23). **One verdict changes, on purpose:** `check --freeze` now refuses to seal a JUnit
report cited by a `test:` pointer whose root records failures or errors, even when the cited cases are
green (ADR-0102, RWD-2026-0182); every other verdict is unchanged. New output, additive in `--json`: the
count of rows judged on a committed JUnit report, with "freshness not verified by this command"
(ADR-0098, `committedJUnit`), and an advisory line for failures outside the cited cases
(`junitNotGreen`). The EU AI Act pack defaults to the lens `eu-ai-act@2026-1744-r2`, which names the
system's qualification and Articles 4, 5, 14 and 50 as operator-required and prints its dated notes
(ADR-0101); `--regime-version eu-ai-act@2026-1744` keeps the previous output byte for byte. GDPR and
NIS2 documentation crosswalks, and a convention for a system of several repositories (ADR-0099,
ADR-0100). Dev-only dependency fixes (zod, fast-uri, qs) and the example mission on zod 4. The 0.45.0
mutation ratchet summary is committed unchanged
(`docs/compliance/ratchet-summaries/ratchet-summary-0.45.0.json`, verdict `refused`: the register did not
yet carry the survivors of the 0.45.0 code; the register is regenerated in this release).

### The output says how many rows rest on a committed JUnit report (ADR-0098, options B and G)

A `test:` pointer at a committed JUnit report is judged on the case the report records, and the report
carries no commit and no date, so a stale report reads as it was committed. `check --strict` now says so
on every run where it applies: `◌ N row(s) judged on a committed JUnit report (<reports>) — its
freshness is not verified by this command`, followed by where the guard belongs. `check --strict --json`
carries the same reading as `committedJUnit: { rows, reports, freshness: "not verified by this command" }`,
additive and present only when the count is above zero; `runward verify` re-derives it. Nothing new is
read (no git, no clock, no file times, ADR-0054), and the verdict and the exit code do not move. The
guard itself is a recipe, not a new binary: [docs/recipes/junit-freshness-in-ci.md](docs/recipes/junit-freshness-in-ci.md)
regenerates the report in CI and compares cases and verdicts with the committed one, with a GitHub
Actions and a GitLab CI job. runward's own strict run now prints the line for its 11 rows citing
`reports/junit.xml`.

### Changed: the EU AI Act pack names the system's qualification and Articles 4, 5, 14 and 50, and prints its dated notes (ADR-0101)

The default `eu-ai-act` lens is now `eu-ai-act@2026-1744-r2`, a revision of the lens over the same legal
text (Regulation (EU) 2024/1689 as amended by Regulation (EU) 2026/1744). It adds four operator-required
rows in front of the existing ones: the system's qualification (high-risk under Annex III or Annex I? an
Article 50 case? an Article 5 prohibited practice?), Article 4 AI literacy measures, Article 14 human
oversight measures (binding only for a high-risk system) and Article 50 transparency measures, with the
dates the lens already recorded. runward supplies nothing for them; the pack names them so their absence
shows. The draft also prints the lens's dated notes under its header ("Dated notes of this lens"),
switched on by the lens file and printed by the EU AI Act renderer only. To keep a pack assembled before
this change, pin the older lens: `--regime-version 2026-1744` renders the previous draft byte for byte.
The OSCAL `runward-regime-lens` prop of a default pack reads `eu-ai-act@2026-1744-r2`. The
`watch external facts` workflow now picks a regime's live lens by sorting versions, as `loadRegime`
does, instead of filenames, which would have kept watching `2026-1744`.

### Decided: five adopter findings (ADR-0098 to ADR-0102 accepted)

The five records proposed on 2026-10-22 are decided; each implementation is a pull request of its own.
ADR-0098: the output counts the rows judged on a committed JUnit report and says their freshness is not
verified, then a CI freshness guard ships as a recipe. ADR-0099: GDPR and NIS2 get documentation
crosswalks, DORA waits for the D3 period report, the CRA stays out, no regime pack. ADR-0100: one mission
per project stays, with a documented convention for system documents (cite each member by digest, sum
no state). ADR-0101: a new EU AI Act lens file with operator-required rows for the system's qualification
and Articles 4, 5, 14 and 50, and the lens's notes printed. ADR-0102: a documented normaliser for JUnit
drift, `--freeze` refusing a cited report that is not green at its root, and an advisory line for
failures outside the cited cases (the adopter's follow-up, recorded in the ADR).

### Added: GDPR and NIS2 crosswalks, and the convention for a system of several repositories (ADR-0099, ADR-0100)

Documentation only, no command and no pack. `docs/compliance/gdpr-crosswalk.md` and
`docs/compliance/nis2-crosswalk.md` say which runward artefacts an entity may cite as supporting evidence
for which article, and name the articles runward does not touch; article numbers and titles were read on
the Official Journal texts served by the EU Publications Office on 2026-10-23, and each page carries a
review date (2027-04-23). The NIS2 page maps the directive, never a national transposition. Neither page
is a compliance claim. `docs/interop.md` gains "A system of several repositories": one mission per
repository, and a system document, written by the operator and read by no runward command, that cites
each member's `check --json` or witness by repository, commit and SHA-256 digest and never adds their
states into a system verdict. The DORA lens waits for the D3 period report.

### A cited JUnit report that says tests failed is no longer sealed (ADR-0102 A, D and E, RWD-2026-0182)

One behaviour changes: `check --freeze` refuses to seal while a JUnit report cited by a `test:` pointer
records failures or errors at its root, even when every cited case is green (`<failure>` or `<error>`
elements, or declared `failures`/`errors` counts above zero; skipped cases do not block). It names each
report and its count, writes nothing, and exits 1 like every refused seal. An adopter's freeze had sealed a
report holding a flaky failure on an uncited case, and the next CI run broke the seal for a defect
unrelated to the change. Every `check`, lenient or strict, now prints an advisory line when a cited report
is red outside the cases it cites ("the report is not green, even though the cited cases are"); it moves no
verdict and no exit code. `check --json` carries the list as `junitNotGreen`, additive and present only when
non-empty, and `runward verify` re-derives it. `docs/operator-role.md` and the adapters README name what
to strip before sealing a report (`time`, `timestamp`, `hostname`, `<system-out>`, `<system-err>`) and ask
for a stable suite order; runward ships no normaliser. RWD-2026-0181, the byte drift itself, stays
`not-fixed`.

## 0.45.0

### An adopter's frictions closed, an ADR id that two files claim refused, and the 0.44.1 ratchet kept

A minor release, mostly from one adopter running runward on its own product and from an independent
checker of the witness. Two wrong outputs of `runward compliance` are fixed (a superseded decision
counted as not ratified, RWD-2026-0179; one OSCAL file overwritten by every regime, RWD-2026-0180), and
`compliance --out` is new. One behaviour changes: an ADR id claimed by two files of a journal is now
refused, naming them, where the verdict used to depend on directory order (RWD-2026-0178). The Next line
says what to do when only the seal moved. Three questions are recorded as proposed decisions and not
decided here (ADR-0101, ADR-0102, and a dated note on ADR-0099); RWD-2026-0181 (a sealed JUnit report
that drifts) stays open under ADR-0102. The 0.44.1 mutation ratchet summary is committed
(`docs/compliance/ratchet-summaries/ratchet-summary-0.44.1.json`, verdict: the register describes this
tree).

### Changed: when only the seal moved, the Next line says what to do before the commit

An adopter with the `pre-commit` adapter installed found every commit touching sealed evidence refused,
and the re-seal it had planned for later never ran. When the seal is the only thing that moved, the Next
line (terminal and `--json` `next`) now says so, with the count: review the changed files, re-seal with
`runward check --freeze` (the `-p` path carried over), and commit `runward/evidence-lock.json` in the same
commit as the change, or restore the files. When the seal drifted beside another gap, the line names that
gap first and the re-seal last: `--freeze` refuses a red gate, and it used to be offered first anyway.
`next.action` is unchanged (`reseal-evidence` for a seal-only run).

### Fixed: one OSCAL file per regime, and `compliance --out` (RWD-2026-0180)

Every regime wrote `runward/compliance/oscal-component-definition.json`, so running `eu-ai-act`, then
`iso-42001`, then `nist-ai-rmf` kept only the last component. Each regime now also writes
`oscal-component-definition.<regime>.json`; the generic name is still written, for existing readers,
and holds the last regime run. `--json` lists the three files. New: `compliance --out <dir>` writes the
pack outside the working tree, for a CI that publishes it as an artifact without committing it.

### Proposed: what the seal hashes for a JUnit report (ADR-0102, RWD-2026-0181)

The seal hashes bytes, so a JUnit report a test run rewrites (`time`, `timestamp`, `hostname`, console
output, suite order) drifts on every run with no code changed. Not fixed: ADR-0102 lays out three options.
Until then, normalise the report before sealing. `docs/operator-role.md` now also says to ratify before
sealing, since `ratify` rewrites the ADR it ratifies, and, with it and the `pre-commit` adapter's
README, to seal before committing a change to sealed evidence (the hook refuses a drifted seal).

### Changed: an ADR id claimed by two files is refused, naming them (RWD-2026-0178, fixed)

The verdict used to read the first name `readdirSync` returned when two files of one journal matched an
ADR id, so renaming the second file, content unchanged, moved `check --strict` between exit 0 and exit
1, and the other file was ignored without a word. The matches are now sorted by UTF-16 code units and
an id claimed by more than one file is refused: `ADR-0001 matches 2 files in runward/adr/: … — keep one
file per decision`. A mission that held two such files and passed now fails until one is renamed or
moved. The witness specification loses its one exception to determinism (sections 3 and 7.6).

### Fixed: the compliance pack counted a superseded decision as "not ratified" (RWD-2026-0179)

`runward compliance` printed `total - ratified` as "not ratified", so a decision set aside (rejected,
superseded, withdrawn or obsolete) read as still open: an adopter's pack showed 446 ratified and 2 not
ratified for two superseded ADRs. One classification now gives three counts: the console prints
`· N set aside (superseded, rejected, withdrawn or obsolete)` apart from `· N not ratified`, and `--json`
adds `summary.adrs.setAside`, `notRatified` no longer including them. The gate was never affected.

### Proposed: Article 50 transparency and the system's qualification in the EU AI Act pack (ADR-0101)

The same adopter noted that the `eu-ai-act` pack, an Annex IV readiness draft, has no row for Article 50
transparency, the system's qualification, or Articles 4, 5 and 14; Article 50 sits only in the lens's
`notes`, which the draft does not print. The record lays out four options and decides none. ADR-0099
gains a dated note: the adopter asked again for GDPR and NIS2, one request, not the trigger's two.

### Documented: the witness specification, re-read by a first independent checker (RWD-2026-0177, RWD-2026-0178)

An adopter (a product built under runward) wrote a checker of `runward-witness/1` from
`docs/spec/witness.md` alone and ran runward only as a command. It accepts the adopter's own witness,
refuses each of 13 mutations of it by naming the fact that no longer holds, and agrees with 0.44.1 on
45 variants of the example mission. It reported one disagreement and sixteen ambiguities, and the
specification's 2026-10-22 edition, which now describes 0.44.1, states runward's behaviour on each,
read from the code. No member is added and no meaning changes; no runtime code changed.

- **The disagreement, RWD-2026-0177.** Section 9.7 said a `test:` pointer at a document has "its test
  name then not read"; runward witnesses the name's location (`testAt: 16` for
  `test:AGENTS.md::runward` on the example mission) and refuses the row on the extension alone. The
  specification now says so: `testAt` or `junit` stays witnessed, and the refusal ignores the name.
- **A defect of runward, RWD-2026-0178, not fixed here.** When two files of one journal match an ADR
  id, the verdict reads the first name `readdirSync` returns and ignores the other: renaming
  `ADR-0001-bis.md` to `ADR-0001-zz-bis.md`, content unchanged, moves `check --strict` on the example
  mission from exit 1 to exit 0. The lookup is on the verdict path, so its fix is a pull request of
  its own. Until then, keep one file per id.
- **What the specification now states exactly**, each as 0.44.1 does it: a status `proposed: applied`
  (with a space) is examined like `proposed:applied`; path tokens, the drift test and the cover test
  read the evidence cell as section 9.4 reads it, never the line's text; the first cell of a
  conformance-shaped line is trimmed; `&#X…;` decodes like `&#x…;`; when an entry is skipped (an absent
  manifest with nothing expected) and that a skipped entry has no cause; that an entry beyond the
  horizon still carries its rows and facts; one corpus cause per listed file, or one
  `corpus-unrecorded`; how `extra` reads `impact:` and `phases:` (first line only, leading letters);
  that an ADR refused as the template is still read; the directory order an ambiguous ADR id is
  resolved in; that the repository climb starts from real paths and that a `.git` file counts; what a
  checker may check of a pointer without re-implementing the grammar; that a witness of the wrong
  shape is refused like an unreadable one; and two refusals no member of this version marks (an
  unquoted test name cut at `;`, runward's own JUnit), which a checker reports as beyond the witness.
- **ADR-0089** carries a dated note: a first independent checker exists outside this repository; the
  in-repository checker (increment 1, steps 4 and 5) and ADR-0090's M4 stay planned.

### Proposed: three adopter findings recorded as decisions not yet taken (ADR-0098 to ADR-0100)

An adopter re-checked three findings against 0.44.1 on 2026-10-22; each is now a `proposed` record that
lays out its options with their cost, decides nothing, and says what would settle it.
[ADR-0098](docs/adr/ADR-0098-whether-the-gate-says-how-old-a-committed-junit-report-is-and-what-it-may-read-to-say-it.md):
a committed JUnit report carries no commit and no date; what the verdict may read to say how old it is,
under ADR-0054 (no git, no clock, no network in the verdict path).
[ADR-0099](docs/adr/ADR-0099-which-regime-lenses-come-after-the-three-ai-ones-cra-nis2-dora-gdpr-and-where-each-belongs.md):
CRA, NIS2, DORA and GDPR lenses beside the three AI ones, a DORA lens reading the period report of
ADR-0093 D3; a lens is an input to the entity's work, never a compliance claim.
[ADR-0100](docs/adr/ADR-0100-whether-a-mission-can-span-several-repositories-a-system-and-one-aggregated-evidence-file.md):
a system of several repositories and one aggregated evidence file, against the organisation view of
ADR-0093 D4. ROADMAP lines point to each. Nothing in the CLI changes.

## 0.44.1

### A false green closed, the fixes an adopter's report asked for, and the 0.44.0 ratchet closed

A patch release, mostly from one adopter's report on 0.44.0, reproduced on `main` before each fix.
**The security fix (RWD-2026-0168, advisory GHSA-964r-4pc2-xph9):** an unquoted test name was cut at
the first `;`, so a pointer naming a red JUnit case could select a green one and leave `check --strict`
and `spec-check` at exit 0; affected 0.35.0 to 0.44.0. **How a test name is read:** JUnit entities are
decoded, so vitest's `describe > test` names link as printed (RWD-2026-0169), and `check` and
`spec-check` share one test-name verifier at a word boundary (RWD-2026-0170). **Hooks pinned:** every
hook runward writes or ships runs the version that wrote it (RWD-2026-0171). **What the gate did not
count is named:** each ADR set aside with its reason, a `## Reevaluation` heading read as the trigger,
`update` naming the rules it newly gates (RWD-2026-0172 to 0174, ADR-0097 accepted: English headings
only, each missing one named). **Advisory lines that read what they claim** (RWD-2026-0175, 0176; a
note on ADR-0067 ratified), the changelog shipped in the package, and a recipe for repository rules.
**The 0.44.0 mutation ratchet, closed:** its release-event run measured 0 of 164 chunks; three test
harness defects behind that were fixed, the register now describes the tree (599 survivors filed as
not yet instructed, 135 retired), and the signed summary of that refused run is committed unchanged
(`docs/compliance/ratchet-summaries/ratchet-summary-0.44.0.json`, SHA-256
`3099bb9bfc863ee04e9ad8d18397f0953af40e557b3a400fbb0e88e6f75c925e`).

**Compatibility: some verdicts change, on purpose.** A mission that cites an unquoted test name
followed by `;` and text now reddens (quote the name: `::"a; b"`); a one-letter test name, or a name
found only inside a longer word of a source file, no longer links; and a name containing `>`, `<`, `&`,
`'` or `"` now links under the name the test runner prints (the escaped spelling still links). A
mission under the structure contract whose ADRs title the trigger `## Reevaluation` now has them
counted. Every other verdict is unchanged: measured on runward's own mission and `init --example`, the
same exit and the same causes before and after. Hooks written by an earlier `init` keep running the
version they name until `runward update` refreshes them (a file you edited is kept and said so).

### Fixed: the qualification kit runs what an installation can run, and reads every case it ran

The 0.44.1 prepare run stopped in the kit, before any draft or publication, on four cited cases green
in the tree; the `v0.44.1` tag is re-made on this fix, as it was for 0.44.0. **TOR-243:** the
packaged-hooks case lists `plugins/` and `packaging/` files in an array declared inside the case and
reads each through `join(ROOT, rel)`. The builder resolved a loop's array at the file's top level only,
so it saw no list and let the case run in the kit, where those directories are not (ENOENT). An array
is now read from the nearest enclosing block that declares it, then the top level, and the case is
reported `not-run-here` with the paths it needs. **TOR-241:** the three RWD-2026-0169 cases ran and
passed, but the runner reported them "did not run": Node's JUnit reporter writes `>` raw inside
`name="…"`, and the runner ended a `<testcase>` tag at the first `>`, losing that name and taking the
next cases as its body. A tag now ends at the first `>` outside a quoted value. Neither defect could
turn a red case green: a lost case is reported failed. Measured on the rebuilt kit installed in an
empty project: 230 cited cases pass, 0 fail, 108 not run here (was 227, 4 and 107). Every other cited
file was swept for a source-tree read the kit would run: none, by a trace of every read the kit's run
makes under its work directory.

### Fixed: Stryker's sandbox keeps the repository's bytes, so the ratchet's initial run passes again

Stryker's `disableTypeChecks`, at its default, writes `// @ts-nocheck` atop the JavaScript and
TypeScript files of its sandbox copy: `dist/`, `src/`, `test/`, `scripts/` and the shipped example under
`examples/`. `test/unit/recipe-repository-rules.test.js` (#411) fingerprints the example's port kit as
`init --example` copies it, so inside the sandbox it read other bytes and failed Stryker's initial run,
and every measure leg dispatched after #411 failed before mutating anything. Reproduced locally on
`main` at `5867b3d` (the sandbox's `examples/request-triage/code/src/core/ports/*.ts` each gain the
line; the assertion "the fingerprint the recipe prints" fails). `stryker.config.json` now sets
`disableTypeChecks: false`, with its reason beside it: the suite runs the built JavaScript with
`node --test` and no type checker runs in the sandbox. With it, the same dry run passes and the sandbox
differs from the repository only in the mutated file and Stryker's reformatted `tsconfig.json`. The
reports do not move (Stryker records each file's source without the directive), so no survivor key
changes. `test/unit/mutation-perimeter.test.js` requires the setting; removing it turns that test red.
No shipped file changes.

### Fixed: the two freshness lines above the gate read what they claim, and say when they cannot

Both lines are advisory, printed after a green `check --strict`, and neither reaches the verdict. An
adopter's report, reproduced on `main` at `dbcbc7a`.

- **Behavioral proof (RWD-2026-0175).** Freshness was measured against `code/` only: with
  `Behavioral proof: cd app && npm test`, the line showed the artifact and no freshness, with no word
  that none had been computed. The source root is now the directory the command enters (`cd X`, inside
  the tree only), then `code/`, then the artifact's top-level directory; more languages count as
  sources. When no root is found the line says `freshness not computed (no source root found)`.
- **Verify findings (RWD-2026-0176).** Freshness compared modification times, so a bare `touch`
  turned `stale` into `fresh`. That reading stays (ADR-0007, ADR-0067), and the line now names it,
  `fresh by modification time`, with the sentence that a touch defeats it. When the findings header
  records `Manifests digest: sha256:…`, which `check --strict` prints and the verify workflow now asks
  for, freshness compares it with the manifests' content and no mtime enters. A note on ADR-0067 sets
  this reading out; the maintainer ratified it on 2026-10-20.
- **Dates.** Both lines printed a UTC date with no label, a day early for a file written after local
  midnight east of Greenwich. They now read `modified YYYY-MM-DD UTC`.

**What an existing mission sees:** the same verdict and exit code (measured on runward's own mission
and on `init --example`, `check --strict --json` identical). The advisory lines change wording, and
the `no verify findings recorded yet` line now prints the digest to record. `runward update` refreshes
an untouched `runward/workflows/verify.md`.

### Added: the package ships its changelog

`CHANGELOG.md` is now in `files`, so the installed package says what changed (npm ships README and
LICENSE on its own, never a changelog), and `runward update` ends with the changelog's URL at its tag.
The changelog is addressed to the consumer who upgrades, the line ADR-0070 draws for what the tarball
carries.

### Added: a recipe for a repository rule the gate can see

[`docs/recipes/repository-rules-as-junit.md`](docs/recipes/repository-rules-as-junit.md): a rule
written in the repository ("every change to the kit bumps `KIT_VERSION`") vendored with
`update --corpus`, `requires: junit`, a manifest row, and a script whose JUnit case name carries a
fingerprint of the guarded files, so a change without a bump stops the row linking once the report is
regenerated. The worked example runs on `init --example`, and a test runs it as printed. The
qualification kit carries it with the other recipes. No verdict change.

### Fixed: the decision journal names each ADR it set aside, and `update` names the rules it newly gates

An adopter's report, reproduced on `main`. Under the structure contract (the default for new missions
since ADR-0069), an ADR without a `## Reevaluation trigger` section left the count (3 to 2) with the
verdict unchanged and nothing naming the file, and a journal whose ADRs were all written with
localized headings read `Decision journal — raw template` (RWD-2026-0172). The trigger heading was
read as the template's exact words, so `## Reevaluation` alone did not count (RWD-2026-0173). And
`runward update` reported `4 added, 85 refreshed` while the next `check --strict` was red with rows
missing (RWD-2026-0174).

- `check` prints `set aside runward/adr/<file> — <reason>` under the decision journal for each ADR it
  did not count (no `**Date**` line, a status outside the vocabulary, no trigger section, an empty
  trigger, below the character floor), says `no ADR counted, N set aside` instead of `raw template`
  when that is the case, and adds `(N set aside, not counted)` beside the ADR count. `check --json`
  and `report` carry `adrSetAside: [{ adr, reason }]`, only when it is not empty, so every other
  payload keeps its bytes (ADR-0030).
- A heading that starts with `## Reevaluation` (`## Reevaluation`, `## Reevaluation triggers`) is the
  trigger section, for the count and for the reopening watch alike. A heading in another language is
  still not read: ADR-0097 (accepted 2026-10-20, option A) keeps English headings only and names every one it does not find.
- `update` ends with a `Newly gated` section naming each rule the refresh makes `check --strict`
  expect, per deliverable, with whether the manifest already has its row, and its `Next` line says
  `runward manifest --sync` when a row is missing. A dry run (`RUNWARD_DRY_RUN=1`) says the same.
- Under the opt-in, `✓ Port contracts (≥1 filled)` is followed by an advisory line for each other
  contract still missing a section (TOR-247). It does not affect the verdict.

**What an existing mission sees:** on runward's own mission and on `init --example`, `check --strict`
gives the same exit and byte-identical output and JSON before and after. A mission under the structure
contract whose ADRs use `## Reevaluation` as their trigger heading now counts them. Nothing else moves a verdict.

### Fixed: every hook runward writes or ships runs the runward version that wrote it

The pre-commit adapter `init` writes into `runward/adapters/` ran a global `runward` when there was
one, else `npx --yes runward` with no version, so a commit was blocked or let through depending on the
binary the machine happened to have: the same tree exits 0 under 0.31.0 and 1 under 0.44.0 (an
adopter's report, reproduced on `main` at `dbcbc7a`; RWD-2026-0171). The GitHub Actions, BMAD, Kiro
and Claude Code samples were unpinned too, the GitLab, Azure and Bitbucket samples defaulted to
`latest`, and so did the client hooks of every packaging and the entries `wire --install` writes.

- The adapter templates carry a `{{RUNWARD_VERSION}}` placeholder; `init` and `update` replace it with
  their own version when they write the file, and `scaffold-lock.json` records the written bytes. The
  templates still cite no version, so the template-version-pin test is unchanged.
- The pre-commit hook runs `node_modules/.bin/runward` only when its `--version` is the stamped one,
  otherwise `npx --yes "runward@<version>"`, and never a global. A copy left unstamped exits 2. It stays
  POSIX `sh`, which Git for Windows runs with its bundled shell (reasoned, not measured on Windows).
- The forge samples default `RUNWARD_VERSION` to the stamped version; setting it to `latest` still
  warns on every run. The JSON hooks and the BMAD layer run `npx --yes runward@<version>`, which uses a
  project install of exactly that version first (measured with npm 11.16, offline, empty cache).
- The packaged hooks (Claude Code plugin, Codex, Gemini, Cursor, Copilot, Kiro) run
  `runward@<package version>`, and `wire --install` writes `runward@<its version> gate-hook`; `wire
  --uninstall` still recognises the unpinned entries earlier releases wrote.

**What an existing mission sees on `runward update`:** each adapter it never edited is refreshed to
the pinned text, `updated runward/adapters/<file> (changed upstream)`, and every later release does the
same with its own version. An adapter the operator edited is kept, `kept … (you edited it — --force to
take the package version)`. A mission without a lock record for a file gets `kept … (no record)`, as
for any scaffolded file. A copy already installed elsewhere (`.git/hooks/pre-commit`, a workflow) is
not touched: copy it again.

Held by `test/unit/adapter-version-pin.test.js` (TOR-243), whose positive control reddens on each
unpinned shape the adapters shipped; restoring the old pre-commit or the old Codex hook turns it red.
The ROADMAP "Watching" item on version gaps is updated: its trigger, two versions disagreeing on one
tree, is met.

### How a test name is read: a false green closed, vitest names linked, one verifier (RWD-2026-0168 to RWD-2026-0170)

Reported by an adopter citing a vitest JUnit report, and reproduced on 0.44.0.

**A false green (RWD-2026-0168).** An unquoted `::NAME` runs to the end of its segment, and a segment
ends at the first `;`. So `test:reports/x.xml::suite; cas rouge` read the name `suite`, and when the
report held a green case `suite` beside a red `suite; cas rouge`, the pointer linked the green one:
`check --strict` and `spec-check` exit 0 on a red test (measured on the example mission with 0.44.0).
Whether that `;` ends the name or belongs to it cannot be decided from the cell, so such a pointer is
now refused, naming the name read, the text after the `;`, and the two spellings that are not
ambiguous: quote the name (`::"suite; cas rouge"`, the grammar's existing answer), or follow the `;`
with a pointer (`::suite; file:x.ts` still reads two pointers).

**Names with `>`, `<`, `&`, `'` or `"` (RWD-2026-0169).** A JUnit case was matched against the raw
attribute text, so a case vitest names `suite > case` (written `name="suite &gt; case"`) never linked
under that name, and the escaped spelling linked only when quoted. `name` and `classname` are now
decoded before they are compared: the five predefined entities and numeric character references, in
one pass (`&amp;gt;` reads `&gt;`, never `>`), and a `>` inside a quoted value no longer ends the tag.

**One verifier for a test name (RWD-2026-0170).** `spec-check` carried its own copy of the test-name
check: it linked a one-letter name the gate refuses (RWD-2026-0006), and both matched a source file by
bare substring, so `::es` linked over any file containing `describe`. The gate and `spec-check` now
import one function, `testNameProblem` (`src/lib/evidence.ts`): the two-character floor, the
structural JUnit result, and, in any other file, an occurrence whose ends do not extend a word (a
letter, a digit or `_` in any script), `symbolPresent`'s rule carried to prose. The witness's `testAt`
uses the same match (`docs/spec/witness.md` section 9.5, with the decoded JUnit selection).

**Compatibility.** These change verdicts on existing missions, on purpose. A row citing `::NAME; text`
unquoted is now refused, including one whose name was meant to end at the `;`: quote the name. A
criterion or row citing a one-letter name, or a name found only inside a longer word of a source
file, is now refused by `spec-check` and the gate respectively. A pointer that already spelled an
entity, quoted (`::"suite &gt; case"`), **keeps linking**: the pointer's name is tried as written and
decoded, a case selected by either counts, and one red case among them still reddens it. The name is
still matched case-insensitively, as before. Measured: runward's own mission and `init --example` give
the same verdict and causes, and runward's own witness is byte-identical.

This is a change on the verdict path, a pre-merge path under the delegation charter. Pinned by
`test/unit/tool-adapters.test.js` and `test/unit/spec-conformance.test.js` (one case on an excerpt
of the adopter's report) and by attack corpus case `AC-018` (18 cases, 14 refusals), all measured red
against the unfixed build. The register entries are `fixed-in=unreleased`, `advisory=unclassified`;
the requirements register gains TOR-240 to TOR-242, and TOR-205 covers AC-018.
`src/lib/evidence.ts` and `src/lib/tool-adapters.ts` are in the mutation ratchet's perimeter: the
release run re-derives their survivor register.

### Fixed: a test no longer rewrites `test/smoke.js` in place while the suite runs

`the digest moves when a leg's content moves` (`test/unit/mutation-wholenet-provenance.test.js`)
appended a line to the repository's own `test/smoke.js`, then restored it. `node --test` runs files in
parallel, so another file could read `smoke.js` in between and find it empty: one chunk of the 0.44.0
mutation ratchet failed its initial run that way (`net-shrink` read 124 assertion calls, then 0), and a
run killed between the two writes would have left the leg edited. `netDigest()` now takes the tree to
read, and the test edits a copy of the legs in a temporary directory.

### Fixed: the mutation ratchet's cheap-first split is current again, and a test keeps it so

`scripts/mutation-testcmd.sh` runs the cheap unit test files first and the slow ones only when nothing
cheap killed the mutant, reading the split from `test/unit-cost.json`. That file was last written on
2026-08-24: it knew 72 of today's 202 test files and listed no slow one, so every mutant of the 0.44.0
ratchet paid the whole suite (80 to 147 s on a runner, 118 s per mutant at the median). Seven chunks of
109 to 168 mutants hit the five-hour ceiling and the ratchet refused; two of them had already been cut
on 0.43.1. The split is re-measured (203 files, 60 slow), and `test/unit/unit-cost-coverage.test.js`
fails when a test file is missing from it, when it names a file that is gone, or when its slow list is
empty. Ordering never changes a verdict: a mutant is killed iff some test fails. Measured on a loaded
machine (load 4 to 6), which shifts the split, never a result.

### Fixed: a qualification-kit test no longer reads git, which failed the 0.44.0 mutation ratchet

The test added with the kit fix of 0.44.0 listed the fixtures with `git ls-files`. The mutation
ratchet runs the suite in a sandbox copy with no repository, where that list is empty: the test failed
Stryker's initial run on every one of the 189 measure legs of the 0.44.0 ratchet, so nothing was
mutated and the run is red without having measured anything. The test now walks `test/fixtures` on the
disk; it passes with and without a `.git` beside it. No shipped file changes.

### The 0.44.0 mutation ratchet, closed: 599 survivors filed, 135 retired, `witness` filed for the first time

The ratchet the release started (run 38813924888, `7977a05`) measured nothing: 0 of its 164 chunks
came back, and its signed summary refuses all 25 modules. The gate was re-run on `main` at `cf70f2e`
(run 39039832216, `mode=gate`). Its first attempt got 163 of 164 chunks back. It lost `conformance`
lines 661-720 to the test race fixed above (#407), and a re-run of the failed jobs (attempt 2) measured
that chunk. The run refused:

- 16 modules described the tree.
- `check-contract`, `conformance`, `delegation`, `evidence`, `mission`, `sarif`, `tool-adapters` and
  `verdict` were in mismatch.
- `witness`, new in the perimeter, had no register entry (403 survivors).

Most of the new survivors sit in the D1 code of 0.44.0: the `check --json` ratification rows, causes
by kind and assurance mode, the Code Quality and JUnit renderings, and the refusal of runward's own
JUnit as evidence.

Register keys describe one tree, and `main` moved past `cf70f2e`. #408 and #409 changed `evidence`,
`tool-adapters`, `spec-conformance`, `wire-install` and `witness`. #410 and #411 changed
`check-contract`, `conformance`, `mission` and `verify-findings`. So each module is filed from a
measurement of the tree it has now:

- **From run 39039832216**, for the three modules with no source change since `cf70f2e`: `verdict`,
  `delegation` and `sarif`, all from attempt 1. Each merged report was used only after its SHA-256
  matched the one the signed summary (`ratchet-summary-0.44.0.json`) records. The summaries of both
  attempts verify against the attestation `mutation-ratchet.yml` signed for them. The ratchet's merge,
  re-run on the downloaded chunk artifacts, gives the same survivor keys.
- **Re-measured on this branch** in `measure` mode, one module per run, every chunk back:
  - at `4e648ca` (`main` after #409): `evidence` (run 39123669428), `tool-adapters` (39123671373),
    `witness` (39123673637), `spec-conformance` (39123675917) and `wire-install` (39123677908);
  - at `0484d35` (`main` after #412): `mission` (39494804273), `conformance` (39494816126),
    `check-contract` (39494827074) and `verify-findings` (39494838220).

  A single-module run writes no signed summary. For each of these runs, the merge re-run on its chunk
  artifacts gives the same keys, and the source the report embeds is byte-identical to the build of
  the commit measured.

Each key is derived by `scripts/mutation-key.mjs`, the ratchet's own implementation, and joined by
descriptor, never by position. **599 survivors are filed** and **135 filings the tree no longer
produces are retired**:

| Module | Source run | Filed | Retired | Register now |
| --- | --- | ---: | ---: | ---: |
| `witness` (first time) | 39123673637 | 407 | 0 | 407 |
| `sarif` | 39039832216 | 34 | 34 | 50 |
| `evidence` | 39123669428 | 32 | 30 | 334 |
| `mission` | 39494804273 | 30 | 50 | 687 |
| `tool-adapters` | 39123671373 | 25 | 0 | 71 |
| `delegation` | 39039832216 | 21 | 1 | 73 |
| `verdict` | 39039832216 | 20 | 3 | 61 |
| `conformance` | 39494816126 | 18 | 1 | 197 |
| `verify-findings` | 39494838220 | 7 | 0 | 8 |
| `wire-install` | 39123677908 | 3 | 5 | 18 |
| `check-contract` | 39494827074 | 2 | 5 | 28 |
| `spec-conformance` | 39123675917 | 0 | 6 | 32 |

Every new filing is `hole`, and its evidence says what it is: **not yet instructed**. Each survived the
unit suite. None has been through pass 2 (the whole net) or applied to a probe mission, so none is a
measured defect and none is claimed `equivalent`. The register's header says so for `witness` ("whole
net: never run"). No entry is added to `known-defects.md`: nothing measured here showed wrong
behaviour.

**Three equivalence arguments are lost to a key change.** In these three cases the code did not change.
What changed is its enclosing declaration, after 0.44.0 moved it into a new function. The new key is a
new filing, so each is `hole` until instructed again. The earlier argument is in the retired filing's
history, if a later instruction finds it still holds. Keys are written as module, function, mutator,
replacement, original, line:

- `sarif · verdictFindings · ArrayDeclaration · ["Stryker was here"] · [] · const deferred = new Set((verdict.horizon?.deferred ?? []).map((d) => d.relPath));`
  (filed under `buildSarif` before)
- `evidence · outsideManifestLines · BooleanLiteral · false · true · fenced.push(true);`
  (under `textOutsideManifest` before)
- `evidence · outsideManifestLines · EqualityOperator · i <= lines.length · i < lines.length · while (i < lines.length && !heading(i))`
  (under `textOutsideManifest` before)

Seven more retired equivalences no longer survive in any form. Two are in `evidence`
(`parseEvidenceCell` and `splitSegments`), four in `spec-conformance` (the `pointerLinks` branch #408
removed) and one in `mission` (`isRealAdr`).

The register now holds 2,322 filings across 25 modules (1,858 across 24 before). Re-measured on this
branch's final commit by `mutation-ratchet.yml` in `measure` mode, one module per run with every chunk
back, each of the twelve modules answers "the register describes this tree" (exit 0).

**Not done:**

- No survivor is instructed. The 599 new holes, `witness` whole, wait for pass 2 and for tests.
- The 13 modules that described the tree at `cf70f2e` and were not changed since were not re-measured.
- No ratchet summary is committed under `docs/compliance/ratchet-summaries/`. That directory keeps the
  summary of the ratchet a release's publication started (ADR-0079), and the one v0.44.0 started
  measured nothing. Whether the gate run's signed summary takes its place is left to the release pull
  request.

## 0.44.0

### The gate talks on both forges: GitLab at parity with the Action, a summary for the merge request, and the verdict as Code Quality and JUnit

A minor release, the first delivery (D1) of the observability architecture accepted on 2026-10-13
(ADR-0093). **On GitLab**: a CI/CD template that runs the gate the Action runs, attached to every
release pinned to it, for `include: remote` with `integrity:` (ADR-0094); an offline bench runs the
gate on GitLab CE in CI with its network cut (its own job, not yet this template). **For the pull or merge request**: `report --format md`, a summary that says
the verdict, the gaps by kind, the ratification state and the assurance mode the gate reads in force,
with every value from the tree escaped (ADR-0093 D1); `check --codequality` and `check --junit`, the
verdict as a Code Quality report and a JUnit XML beside an unchanged stdout, and a JUnit runward wrote
refused as evidence (ADR-0096); `check --json` carries the ratification row by row, the causes by kind
and the assurance mode (ADR-0095). **A second package**, `runward-forge`, holds every line that talks
to a forge, so `runward` keeps no network code; it ships at runward's version, from the same tag and
the same release chain. **Fixes**: RWD-2026-0166 (a row rewritten after its ratification no longer
counts as ratified) and RWD-2026-0167 (the method workflow no longer says all six phases are gated);
the Actions' `version` input is `x.y.z` exactly. Exit codes and the text output of `check` are
unchanged. Nothing of this has run against a real GitLab instance or a customer pipeline yet: the
bench is GitLab CE in CI, the template itself has run only in tests, and the merge request note posts
nothing until `runward-forge` is on the runner.

### Fixed: the qualification kit ships the golden files a test names through `join()`

The kit carried a fixture only when a test wrote its path as one literal string. A test that names it
the usual way, `join(ROOT, "test", "fixtures", "golden", "renderings")` then the file name, shipped
without it: the 0.44.0 prepare run stopped on TOR-233 in the kit (green in the tree, `green.codequality.json`
missing in the kit), before any draft or publication. Runs of string literals are now also read as one
slash-joined path, and a fixture is carried when a test names its path or the directory that holds it.
Measured on the rebuilt kit: 200 cited cases pass, 0 fail (was 199 and 1).

### runward-forge is released with runward: same version, same tag, same chain (ADR-0094, question 1)

`packages/runward-forge` loses `"private": true` and carries runward's version, bumped with it at
release preparation; a test refuses any other. The isolated builder packs it in its own directory and
attests its provenance; the release workflow packs it again and refuses a tarball that differs by one
byte, and attaches it to the draft as an eighth asset, `runward-forge-X.Y.Z.tgz`. When the maintainer
publishes the release, the publish job publishes `runward`, then downloads the forge tarball from the
release, checks its name and version, verifies its provenance exactly as runward's (the builder, the
tag, the tag's commit) and publishes it with provenance through npm trusted publishing, no token. A
failure on the forge reddens the job and leaves `runward` published; each publish now asks npm what it
already holds at that version, skips an identical file and says so, and fails on any other, so a re-run
of the job finishes the forge without touching `runward`. The tarball holds `src/`, `README.md`,
`package.json` and the repository's `LICENSE`, nothing else, and the `runward` tarball still holds
nothing of `packages/`. npm configures a trusted publisher only on a package that exists, so the runbook
(§3.1) gives the maintainer a one-time bootstrap: a placeholder `runward-forge@0.0.0-bootstrap.0`
(`scripts/runward-forge-bootstrap/`, a README and a `package.json`, no code) published under the
`bootstrap` dist-tag, the trusted publisher configured, the placeholder deprecated. The verification
guide gains Step 9. TOR-238 and TOR-239.

### Added: the verdict as a Code Quality report and a JUnit XML, and runward's own JUnit refused as evidence (ADR-0096, part of D1)

`runward check --codequality <file> --junit <file>` writes the verdict the run computed as two more
files, beside whatever stdout carries (`--json`, `--sarif`, the human render), so every rendering of
one pipeline comes from one verdict computation. Both are spelled from the list the SARIF log is
spelled from (`verdictFindings`), so a cause that reaches one reaches all three, and neither computes
a state. Stdout and the exit code are unchanged; a path inside `runward/`, in a missing directory or
at a file runward did not write is refused before the gate runs, and a write that fails is exit 2.

- **Code Quality** (the CodeClimate shape GitLab's merge-request widget reads on every tier): one
  issue per cause, `check_name` the SARIF rule id, `severity` `blocker` or `info` for a deferred
  deliverable (never derived from a rule's impact), the manifest row's file and line, and a
  `fingerprint` hashed from the cause's identity (`check_name`, path, rule), never its line or its
  index, so a moved row stays the same issue.
- **JUnit**: a `runward gate` case that fails on exit 1, one failing case per cause and one skipped
  case per deferred deliverable, suites named « (no test executed) », and a `runward.rendering`
  property naming the runward version and the digest of the same run's `check --json` payload.
- **The loop closed.** A row citing a JUnit report that carries `runward.rendering` is refused
  (`evidence-refused`, « a JUnit report runward itself wrote … a previous verdict is not evidence for
  this one »), and such a file never satisfies `requires: junit`; the same file without the property
  resolves as before.
- **GitLab.** The template and the mission sample declare `artifacts:reports:codequality` and
  `artifacts:reports:junit`, written by the `check --json` run; SARIF stays a plain artifact and is
  never declared as `artifacts:reports:sarif`, which would file runward's gaps as vulnerabilities
  (docs/gitlab.md, section 1.1).
- **Fixed on the way.** A `--witness` file whose name the file system refused once the temporary
  suffix was added (`ENAMETOOLONG`) crashed the cleanup and exited 1, which reads as a red gate; it is
  now exit 2 with the cause named, like the two new files.

Requirements TOR-233 to TOR-237.

### Fixed: the Actions' `version` input is `x.y.z` exactly, no longer a glob

The gate Action and the verify Action checked `version` with the glob `[0-9]*.[0-9]*.[0-9]*`, which
also admitted a version followed by arbitrary text (`1.0.0; anything`). The value was quoted, so it
injected nothing, but it was not a version and reached `npx` as one. Both now require
`^[0-9]+\.[0-9]+\.[0-9]+$` (or `latest`/`next`), the allowlist of the GitLab template. A test runs the three
version checks, extracted as written, on the same inputs and requires the same answers; on its first
run it caught the GitLab template too, whose line-by-line `grep` admitted a value holding a newline
(`1.0.0` then anything on the next line). The template now refuses any newline first.

### The forge boundary, and runward on GitLab at parity with the GitHub Action (ADR-0094, first part of D1)

- **A second package, `runward-forge`** (`packages/runward-forge`, released with `runward`, see the
  entry above): the forge port written once (`readChangeFacts`,
  `postSummary`, `setExternalStatus`, `identifyChange`, `renderPath`), a GitHub and a GitLab adapter,
  Node built-ins only. The GitLab adapter posts one merge request note, found by its marker and updated
  in place (gap analysis G3); without a token or on an API error it prints `summary not posted:
  <reason>` and exits 0, a 5xx or a timeout retried once. Facts and the external status are named
  refusals on both forges in this delivery: the fact readers ship in D5, and no customer policy maps a
  verdict to a status. Tested against a loopback stub of the notes API, not yet against recorded
  GitLab responses (they come from the offline bench, PR "ci/gitlab-offline-bench").
- **The `runward` package keeps zero network code, and a test says so.** `runtime-boundary.test.js`
  now scans every module of `src/` and `dist/` for a socket or HTTP import, a `fetch` and a WebSocket,
  refuses any import of `runward-forge` or of `packages/`, checks that no verdict ring reaches a forge
  module and that the forge package imports only Node built-ins and spawns nothing; planted files
  redden each check, and the forge package's own `fetch` is detected, so the scan is not blind.
- **The GitLab CI/CD template** `templates/ci/gitlab/runward-gate.yml`: the Action's inputs (`spec`
  and `check` included, with the same refusals and the higher exit code winning), its
  dist-tags, its unpinned warning, the Node 22.12 floor checked in the job, `check --strict`, and the
  reports deposited on a red gate too (`check --json`, SARIF, the unsigned attestation, `verify` on
  it, the HTML report, linked by `expose_as`); a clean gate whose attestation does not re-derive fails
  the job. Its version check is `x.y.z` exactly, the allowlist both GitHub Actions now apply too (see
  below). The release
  workflow attaches it, its `version` pinned to the release, as a seventh asset,
  `runward-gitlab-gate-X.Y.Z.yml`, for `include: remote` with `integrity:` (GitLab 17.9 or later);
  `scripts/gitlab-template-asset.mjs` re-derives its bytes from the tag. The catalogue component
  follows when the maintainer creates the gitlab.com project (ADR-0094 question 2).
- **The mission's GitLab sample** (`runward/adapters/gitlab-ci.yml`) is no longer behind the Action:
  a `RUNWARD_VERSION` to pin, the same warning when it is not, the reports and `verify`.
- **`wire` proposes the GitLab CI sample next to GitHub's**, GitLab first when the repository has a
  `.gitlab-ci.yml` and no `.github/workflows/` (`candidateChannels` gains an additive `forge` field).
- **The delegation charter names `gitlab:<account>`** beside `github:<account>` as an accountable id,
  and `.gitlab-ci.yml` and `.gitlab/**` among its pre-merge path examples; a GitLab charter parses
  like a GitHub one.
- **`docs/gitlab.md`**: install (the release asset by integrity, or a copy on the instance), what each
  GitLab tier can make required, said plainly for Free (the job can be removed by the merge request
  that edits `.gitlab-ci.yml`, approvals do not block a merge, approval independence is detected after
  merge, not prevented), the summary note and its token. The tier statements are GitLab's
  documentation read on 2026-10-13, not a measurement.
- **Azure Pipelines and Bitbucket Pipelines** minimal samples in every mission
  (`runward/adapters/azure-pipelines.yml`, `bitbucket-pipelines.yml`; `doctor` now counts 10
  adapters).
- **Docs sweep (G10)**: README and `docs/distribution.md` name the GitLab channel beside the Action;
  the adapters README describes the aligned sample; the qualification kit README gives a `cosign`
  command beside `gh` (not run when written, and it says so).
- TOR-222 to TOR-227 (section 23e of the requirements register).

### Added: `check --json` carries the ratification row by row, the causes by kind and the assurance mode (ADR-0095)

[ADR-0095](docs/adr/ADR-0095-check-json-carries-ratification-row-by-row-causes-by-kind-and-the-assurance-mode-in-force.md),
accepted on 2026-10-13. Three additive fields, each a pure function of what the verdict already reads,
none counting toward it; exit codes and the text output of `check` are unchanged.

- **`ratification.byRow`** (strict): one element per decided row, `{ deliverable, rule, phaseId, state,
  mode, by, for, date, bound, current, unboundCause }`, in phase then manifest order. `state` and
  `mode` follow the row's latest entry through the same classifier the counts use; names are copied as
  the tree declares them; `unboundCause` only under the regulated tier.
- **`gaps.causesByKind`** (strict): `{ <kind>: { count, indices } }` over `conformance[]`.
- **`delegation.assurance`** (with a charter): `{ declared, inForce, degraded, notInForce, sentence }`.
  The charter gains the optional `mode:` field of ADR-0090 decision 6 (`machine`, `machine+critical`,
  `sampled`, `per-act`; absent reads `sampled`; any other value is `charter-malformed`). This version
  has no reader of the machine floor, so a machine mode is always reported `degraded: true` with all
  eight controls (M1 to M8) named in `notInForce`, never a guess of completeness. The `sample-*` fields
  stay required, and the assurance line is not printed by `check`, SARIF, the report or `doctor` yet.
- **`runward verify`** compares each field on its own, only when present, like `evidence.proseRows`:
  an attestation sealed by 0.43.x keeps verifying, one with an edited field is refused and names it.
- **Measured, said as it is.** The ADR expected the counts to equal the list's. They count ratification
  entries, the list counts rows: on runward's own mission the counts read 48 and the list 46, two rows
  having been ratified twice. The counts keep their meaning (ADR-0030); the relation is pinned both
  ways (TOR-218) and recorded in a dated note on the ADR.
- The witness is unchanged in its members; the `charter` and `disclosures` reasons of `notWitnessed`
  now name the new fields. TOR-217 to TOR-221.

### A GitLab bench, offline: API fixtures and a loopback stub for the tests, GitLab CE in CI with its network cut (G12)

The GitLab work ahead (the component, the merge request note, the Code Quality and JUnit reports, the
approval reads) needs a GitLab to be tested against, and the unit tests must not touch the network.
Layer 1: `test/fixtures/gitlab/`, one JSON file per GitLab API response, each naming its endpoint,
its date and its source, and `test/support/gitlab-stub.js`, a test-only server bound to `127.0.0.1`
that replays them and models merge request notes, so the summary note of D1 (create once, find by
marker, update in place) is tested with no GitLab. The 7 fixtures shipped today are examples copied
from the GitLab API documentation at a pinned commit, marked `"source": "docs-example"` with no
GitLab version, not recordings. Layer 2: `.github/workflows/gitlab-bench.yml` boots GitLab CE 19.4.2
and GitLab Runner 19.4.1, pinned by digest, on a Docker network created with `--internal`, measures
the cut against a positive control, pushes a fixture repository whose pipeline installs runward from
its packed tarball with `npm install --offline` and checks `runward check --strict` exits 0 on a
green mission and 1 on a red one, and records the API responses as fixtures (`update_fixtures`). It
runs on demand and weekly, never on a pull request. It has not run yet: GitHub dispatches a workflow
only once it is on the default branch, so its first run, its duration and its first recorded
fixtures come after the merge. What it proves and does not prove: `docs/gitlab-bench.md`.

### Accepted: the observability architecture (ADR-0093) and the three D0 records (ADR-0094, ADR-0095, ADR-0096)

[ADR-0093](docs/adr/ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md), accepted by the maintainer on 2026-10-13 with its four decisions as recommended, sets
how runward shows its verdicts over time without becoming a runtime: the MIT CLI writes files under
versioned contracts, never raises a cell above `ci-declared`, never signs and never verifies a
signature; a customer-run satellite, `runward-fleet` (MIT, no editor key), verifies and displays; a
vendor-operated hosted product is a separate product with its own repository, record and licence,
built last (D6). The four decisions: two declared populations (the charter sample's, unchanged in the
verdict path, and a new landing population), with a published reconciliation; the hosted product
separate; a mission snapshot as an optional subject of each record, measured before any public sentence
on offline re-derivation; OSCAL kept as a `component-definition`. GitLab ships at parity with GitHub in
every delivery, said per tier: on GitLab Free, approval independence is detected after merge, not
prevented. Nothing in the CLI changes in this release; the plan (D0 to D6, each with its acceptance
test) is in the ROADMAP.

Three records, accepted by the maintainer on 2026-10-13 with the recommended answers, one delivery ahead of their code:
[ADR-0094](docs/adr/ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md)
(the forge adapter boundary: one port, closed behaviours on every failure, the independence rule as one
pure function, GitHub and GitLab at parity, Azure DevOps and Bitbucket minimal);
[ADR-0095](docs/adr/ADR-0095-check-json-carries-ratification-row-by-row-causes-by-kind-and-the-assurance-mode-in-force.md)
(`check --json` carries the ratification row by row, the strict causes grouped by kind with their
list, and ADR-0090's assurance block; `ratification.rows` is already a count, so the list takes another
key, and `verify` compares it on its own so older attestations keep verifying);
[ADR-0096](docs/adr/ADR-0096-code-quality-and-junit-renderings-of-the-verdict-and-why-runward-gaps-are-not-filed-as-vulnerabilities.md)
(Code Quality and JUnit renderings of the verdict for the GitLab merge request on every tier, a
runward-written JUnit refused as evidence, and SARIF not declared as a GitLab security report because
a gap is not a vulnerability). Dated notes, no decision rewritten: ADR-0011 (a file in a standard's
format is a gate output), ADR-0054 (its fleet corollary's "summoned only on a real demand signal" is
stale since ADR-0039's amendment of 2026-08-24), ADR-0064 (the report family; its SARIF sentence on
GitLab narrowed to Ultimate from 19.2), ADR-0090 (a pointer to ADR-0095). The other amendments ADR-0093
names land with the record that needs them.

### The regulated-adoption sheet no longer reads as a description of the current release

Its scope line said "runward 0.33.5, revised 2026-08-12" and that every statement was about that
build, ten minor releases later. It now says it was written against 0.33.5, names the current release
and that the sheet has not been re-measured against it as a whole, and points at the CHANGELOG and
the known-defects register for what changed. Two body sentences that said "the package is at 0.33.5"
now date that figure. `test/unit/doc-version-pin.test.js` holds the named current release to
`package.json`.

### A red `check` ends on why it is red, and the summary says both halves

Measured 2026-10-13 on the renaming demo: the two ✗ lines that turned the gate red were lines 40 and
41 of a 78-line output, and the end of the screen read "Current gate  all deliverables filled
(verdict: gaps)", true and read as a contradiction. A red run now closes with a `Why red` block, one
line per cause (each unfilled deliverable with its file, each refused manifest row with its pointer
and reason, each changed sealed file, unratified ADR, unbound regulated row and charter gap; the
corpus and workflow-contract breaks by kind), capped at ten with a pointer to `--json`, right above
the `Next` command. The label reads `deliverables filled, gate red at <phases>` (or `deliverables
filled, gate red` when no phase's rows are the cause), in the terminal, in `check --json` and
`status --json` `currentGate`, and in the delivery report, from one function. A green run and every
machine mode are otherwise unchanged. `test/unit/check-why-red.test.js` holds the block on the
renaming demo and on a blank mission.

### `spec-check` is documented where a newcomer reads, and the Action can run it

The 2026-10-13 measurement found the fastest useful path on one's own repository, `spec-check`
(a fabricated claim in a spec turns red in minutes, with no mission), described in one table row
with no input format: the format of a criterion had to be guessed. `spec-check` is not hidden (it
is listed by `runward --help`); the README now carries a "Check a spec you already have" section:
the criterion format, the JUnit recipe (`node --test --test-reporter=junit`), what exit 1 and 2
mean, and what a green does not mean (a `test:` pointer at a source file proves the name, not a
pass; runward runs no test, so a committed report can be stale).

The gate Action gains two inputs: `spec` (spec files or bundle directories, one per line or
space-separated, passed as data after `--`, a path starting with `-` refused) runs `spec-check`
after the gate, the higher exit code winning; `check: 'false'` runs `spec-check` alone on a
repository with no mission. Its comment said "Node >= 20 (present on GitHub runners)" while the
package requires Node >= 22.12: the comment now states 22.12, and the step checks it and stops with
exit 2 and the fix (add `actions/setup-node`) instead of running an unsupported Node.
`test/unit/action-spec-input.test.js` runs the Action's script with `npx` replaced by this build.

### `characterize` says what it drafted, names what exists, and reads `scripts.start`

Three findings of the 2026-10-13 newcomer measurement on an ungoverned Node service. Its next steps
sent the reader to `runward/workflows/brownfield.md`, which only `init` writes, and then to
`runward check`, which answered "No runward/ mission found" (exit 2); they now name `runward init`
first and say the workflow is written by it. Without `--mine` no decision record is drafted, and
`docs/first-mission.md` said it drafts them: the tutorial, the README's command row, the terminal
and `characterization.md` now say `--mine` does it. And `"start": "node src/server.js"` read
"Entrypoints 0": the file a `scripts.start` command runs is now inventoried when it exists
(`startScriptFile`, read at rest, never executed; a command naming no file, such as `next start`,
adds nothing). `test/unit/characterize-onboarding.test.js` holds the three.

### `init --example` prints the renaming gestures, not a URL to them

The "First gesture" block that closes `init --example` named the demo and then a URL to the
tutorial, so the red the product exists to show was a page away. It now prints the six commands
(demo, rename, tests, red gate, two-pointer repair, green gate), the gate pinned as
`npx --yes runward@<this version>`, with no trailing `# comment` (zsh, the macOS default shell, pastes
it as arguments). `test/unit/init-example-next.test.js` executes the printed rename and repair against
the scaffold: green, red after the rename, green after the repair. Measured red with the repair line
shortened to one of its two files.

### The README's first screen shows the gate catching something, with a pinned version

Measured on 2026-10-13 from an empty directory: a newcomer who followed the README saw the gate go
green in under three minutes and never saw it go red. The renaming walkthrough (tests green, gate
red, two-line repair, green) was at line 79 of 195. The first screen now carries it as six
copy-paste lines, with a link to `docs/first-mission.md` for the rest.

Every runward command in the README, `docs/first-mission.md` and `docs/distribution.md` is pinned
(`npx --yes runward@0.43.1`, `npm install -g runward@0.43.1`). On the measuring machine a bare
`npx runward` ran a global 0.28.0 without a word; the README and the tutorial now say so, and
`docs/distribution.md` no longer says the client hooks run `runward@latest` (they run a bare
`npx --yes runward`). `test/unit/doc-version-pin.test.js` holds every cited `runward@X.Y.Z` to
`package.json` and refuses an unpinned invocation in the README and the tutorial, so a release that
bumps the version turns it red until the documents move too. Measured red with one pin set to
0.42.0.

### Accepted: a claims layer for the factual sentences of the documents that bind (ADR-0092)

ADR-0090 measured that no machine control catches a false sentence in prose, and M6 pinned the blind
spot: a sentence added to Step 3 of the verification guide saying the trusted root is not needed
offline passes everything. ADR-0092, accepted by the maintainer on 2026-10-13, gives the answer for bounded sentence shapes, with
no model anywhere: an invisible `<!-- claim: <id> -->` tag on factual sentences in declared zones
(the guide, `SECURITY.md`, the `AGENTS.md` boundaries, the README's command table); a closed registry
of claim types, each with a verifier that reads the asserted value from the sentence itself and a
positive control (`file-set`, generalising TOR-212; `not-needed`; `duration`; `count`; `exit-code`;
`version-ref`; `n-of-m`; `flag-present`; and `declared`, displayed « declared, not measured »); the
sentence sealed with the existing `rowDigest`, used to detect and disclose change: a changed typed
sentence is re-checked by its verifier, which is the gate, and a changed `declared` one is printed
« declared, not measured; changed » with its word diff and counted, the declared count published so
that it falls only as declared claims become measured types; and a lexical detector that reports untagged factual-looking
sentences for four weeks, then refuses new ones zone by zone if the measured waiver cost allows (the
research sample: 85 % recall on checkable sentences, 28 % of non-checkable ones flagged). Negation is a
marker, not an exemption, unlike the overclaim guard's `NEGATED` screen. The measurement plan is fixed
before anything is built: 60 prose seeds over four classes (false not-needed, wrong count, stale
version, negated claim) and three placements, the first seed re-planted in both variants, paraphrase
controls expected missed, and the count of human gestures the layer requires by default, against
success and failure criteria written in the record (success: zero, measured; failure: any step that
needs one). The record was revised on 2026-10-13 to the maintainer's principle that runward must frame
AIs in a fully automated way without costing the organisation more time: its first draft had a person
re-ratify every changed sentence within a weekly time budget. No human re-ratification by default;
human ratification of sentences is an option of ADR-0090's `sampled` and `per-act` modes, chosen by
the adopter, and under `machine` and `machine+critical` nothing in the layer asks for a human gesture. The job's summary says what it never checks: prose outside the zones, untagged
prose the detector does not flag, and any meaning beyond a type's template. Nothing is built; the
record awaits the maintainer's three decisions (adoption and class, the phase-in, no human
re-ratification by default).
The ROADMAP's ADR-0090 work order gains, after M3, executing Steps 1, 4, 5 and 6 of the guide, then
this layer.

### The method workflow no longer says all six phases are gated (RWD-2026-0167)

`templates/workflows/method.md`, which `init` writes into every mission, said the method "sequences
six gated phases" and "Run the six phases, each behind a gate"; runward's own mission carried the same
copy, and the README's introduction said "six gated phases". The gate gates five: phase 4, `iterate`,
has none, by decision (ADR-0033), as the README's method heading has said since 0.37.0
(RWD-2026-0062). The three sentences now say six phases, five of them gated, and the workflow says why
phase 4 carries no gate. `runward/workflows/method.md` is the template byte for byte again, so
`update` reads it as up to date; the scaffold lock is not edited (`update` rewrites it).

The guard that should have caught it read only the README's `## The method:` heading and the 1,500
characters after it. `test/unit/phase-count-claims.test.js` now scans every shipped text surface
(README, NOTICE, `templates/**`, `regimes/**`, `docs/**`, `runward/workflows/**`, the example mission)
for a phase-count sentence in a closed grammar and holds it to the gate's phase list (`PHASES`: six
phases numbered, five listed). ADRs and the known-defects register are out of its scope, because they
quote the retracted sentences. Measured red on the original template and, separately, on the original
README; a grammar control re-plants the false sentences (red) and the true ones (green). What it does
not read: a phase count written in a form outside its grammar.

### A pull request that shrinks the test net escalates to the maintainer (ADR-0090, M3)

ADR-0090 makes « the net shrank » an escalation event instead of adding the net's files to the
pre-merge list. A new workflow, `net-shrink.yml`, runs the default branch's copy of
`scripts/net-shrink.mjs` on `pull_request_target` (read-only, the pull request's files read with
`git show`, none of its code run) and compares the pull request's head with its merge base. It fails
on a test file deleted (a move under the same basename is a note), a case removed from the committed
JUnit inventory (a rename is paired, and reported as a note, only when the same file declares a new name
sharing at least half its words; unsure is a removal), an attack corpus identifier retired or no longer
declared, a metamorphic relation no longer checked, a `numRuns`, `RUNS` or RUNWARD_MR_RUNS default
lowered, fewer fast-check properties, a coverage floor lowered or the coverage job no longer measuring,
the mutation perimeter shrunk, a `skip`/`todo` added, or fewer assertion calls in a test file. It passes
once the shrink is acknowledged: the label `net-shrink-acknowledged`, last applied by a non-delegate
admin, and a body line `Net shrink acknowledged: <fingerprint> <kinds>` naming that exact shrink (a
further shrink changes the fingerprint). In stage 1 an agent holding the maintainer's credential can do
both; the acknowledgment is a trace, declared, not proved. Measured as a dry run over the last 150
merges on `main`: one would have escalated (#326, eight test names translated from French, a rename
the guard cannot pair), none of the last 30; two renames were paired as notes. What it does not see:
a test weakened without losing an assertion call. Making `net shrink` and `coverage does not go down`
required checks is the maintainer's setting. TOR-213 to TOR-216 cover it.

### The release verification guide is executed at pull-request time, and held to its workflow (ADR-0090, M6)

ADR-0090 measured that no control executed the commands of `docs/verifying-a-release.md` at
pull-request time: `verify-release.yml` runs copies of them, after a release, and the first sample
period's seed was a false sentence in that guide's Step 3. Two halves now hold the guide. A unit test
in the required suite (`test/unit/documented-commands.test.js`, no network) holds the guide's `gh`
commands and the workflow's in parity in both directions, naming the step that drifted, with positive
controls (Step 3 without `--custom-trusted-root`, Step 2c's flags changed, a workflow-side drift), and
one narrow prose check: a "N files suffice" sentence must match the files the offline command names.
A new workflow, `documented-commands.yml`, extracts the commands of Steps 0, 2, 2c, 3, 7 and 8 from the
guide and runs them against the latest published release, the bundle-based verifications inside
`sudo unshare -n`, each with a positive control (a tampered tarball or kit must fail, Step 3 without the
trusted root must fail offline, a mutable release has no release attestation, the kit's runner exits 3
after one installed byte changes). It runs on pull requests touching the guide, the verify workflows or
the kit, and weekly. What it does not catch, said as it is: a sentence-only change that leaves the
commands and the "files suffice" claim intact passes both halves, and a test pins that blind spot.
TOR-210 to TOR-212 cover the parity.

### Accepted: a row may rest on a kernel-checked proof of a ratified statement, and a recipe to do it today (ADR-0091)

ADR-0091, accepted by the maintainer on 2026-10-12 with the three recommended answers, sets how a
mission row can rest on a machine-checked proof: the kernel checks the proof, a person reviews and
ratifies only the statement, and runward never runs the prover. (1) Increment 0 ships now, with no
change to the verdict path: the recipe `docs/recipes/lean-proofs-as-junit.md`, a script and a
reference GitHub Actions workflow to copy into the adopter's repository (a template, not a workflow of
this repository), and an example Lake project. The job runs Lean FRO's `comparator` with runward's
axiom list (`propext`, `Quot.sound`, `Classical.choice`), a second kernel (`nanoda`), an axiom print
per theorem and a scan for forbidden constructs, and writes one JUnit case per theorem named
`lean-proof <Theorem> statement-sha256=<64 hex> axioms=<list>`; the row cites it with `test:`, so the
statement's digest enters the row's ratification digest. The job re-runs as a required check and
compares its output with the committed report, and attests it, outside the verdict path. Increment 1,
the `proof` nature in the gate, is built only when an adopter or the ADR-0052 pilot has a Lean
statement to carry and the ADR-0089 checker runs in CI. (2) No new `proof:` prefix: the later nature
is spelled `file:<report>#<Theorem>@<sha256>`. (3) A row citing a proof requires a bound ratification
in every tier; until increment 1 the gate counts an unbound ratification only under the regulated
tier, and the recipe says so. The recipe was run once end to end on macOS arm64 (Lean v4.35.0-rc4):
both example cases green, a byte-identical report on a second run, `sorry`, a user axiom,
`native_decide` and an unused `unsafe` each red, and `check --strict` refusing a row whose statement
changed after the cell was written; `landrun` was replaced by comparator's development shim (no
sandbox), and the workflow has not run on a GitHub runner. The qualification kit now carries
`docs/recipes/`. A unit test holds the case-name format, the pointer parse, the digest binding and the
axiom list to what the recipe says.

### A row rewritten after its ratification is no longer counted as ratified, on any mission (RWD-2026-0166)

Since 0.42.3 `ratify` records a digest of each row it ratifies, and only the regulated tier read it.
Outside the tier, a decided row whose status or evidence was rewritten after a person ratified it
stayed counted in its mode: measured on 0.43.1 against `init --example`, one row ratified line by line
and then edited left `ratification` at `{"rows":1,"lineByLine":1,…}`, the delivery report at « 1 row(s)
traced », and nothing anywhere said the ratified content had changed. The ratification ledger now
reads the digest on every mission, like the tier: the latest entry speaks for a row, and a row it no
longer matches is counted in no mode but in `ratification.changed` and `ratification.changedRows`
(additive, present only when non-zero, so an attestation sealed before keeps verifying). `check
--strict` prints « N row(s) changed since their ratification; re-ratify with `runward ratify
--decided` » with the rows, `--sarif` carries `properties.ratificationChanged`, and the delivery
report says the same. **The exit code does not move outside the tier**: it is a disclosure. Under the
tier nothing changes, the row was already a gap (cause `changed`). A ratification written without a
digest (before 0.42.3, or by hand) is counted as before, since nothing in it can be read. runward's
own mission is unchanged (no row changed since its ratification). This touches the verdict path
(`src/lib/conformance.ts`), a pre-merge path under the delegation charter; `conformance` is in the
mutation ratchet's perimeter. Register entry RWD-2026-0166 (`unproven-claim`, `text-only`,
`advisory=none:not-S1-S4`); requirement TOR-209.

### Accepted: a mission chooses its assurance mode, and a machine mode is honest only on a named floor (ADR-0090)

The first sample period of ADR-0088 ended `control missed` (2026-10-02 to 2026-10-09: five drawn acts
and one seed, all accepted), and the maintainer asked for a choice rather than a removal. Two measured
facts about that period: the review list printed one line per item (`printReview` in
`src/commands/sample.ts`), and the seed commit was not on the forge (the API answers 422), so the
control measured the review packet as much as the reviewer. ADR-0090, accepted by the maintainer on
2026-10-12 with the three recommended answers, adopts a ladder of assurance modes for class D acts
(`machine`, `machine+critical`, `sampled`, `per-act`) declared in the charter's `mode:` field; the
weekly sample becomes the opt-in `sampled` mode, and an absent field reads `sampled`, so no existing
charter changes meaning. A machine mode names a floor of machine controls (M1 to M8), prints
« degraded » with the controls not in force while the floor is incomplete, is disclosed rather than
refused, and is a strict gap only under the regulated tier. runward's own mission will run
`machine+critical`, with its critical list narrowed to the verdict path and the trust roots; measured
over the 132 merges since 2026-09-01, that list would have caught 59, against 57 for the current one,
which the record states as it is. The regulated tier leaves runward's own lock (option (b) of ADR-0088
decision 4). ADR-0088 gains a dated note pointing to ADR-0090. Decision record only: no CLI, charter or
lock change in this entry; the work order is in the ROADMAP.

### Two more advisories: RWD-2026-0106 and RWD-2026-0164

The two register entries the `advisory` field left `unclassified` were read against ADR-0086's
criteria by the maintainer on 2026-10-11: RWD-2026-0164 (two agents answering to the same person
passed as independent under the regulated tier, 0.42.3, fixed in 0.43.0) meets S1 and is published as
GHSA-5jmc-j874-hgqg; RWD-2026-0106 (`update` dropped `structureContract: true` from the lock, 0.38.0,
fixed in 0.39.0) meets S2 and S1 and is published as GHSA-qv6v-ww7j-66jh. CVEs requested for both.
runward now has 14 published advisories and no `unclassified` entry.

### The defect register names each entry's security advisory, or why it has none (ADR-0086 decision 2)

Twelve repository security advisories were published on 2026-10-11: the eleven of ADR-0086's
retroactive list and RWD-2026-0165's (fixed in 0.43.1). No CVE has been assigned yet; the requests
were sent on 2026-10-01 and 2026-10-06. Until now only the advisory said which register entry it
describes; the register, which ADR-0086 makes the record of every entry that gets none, could not say
which ones did. Documentation and repository scripts only: nothing in the CLI, the gate or the
published package changes.

- **The `advisory` field.** Every entry of `docs/compliance/known-defects.md` now carries
  `advisory=Z` right after `affected-from`/`fixed-in`: a GHSA identifier, read back from the
  repository's published advisories, or the first of ADR-0086's conditions the entry fails,
  `none:not-shipped`, `none:unsupported-only`, `none:declared-limit`, `none:fix-not-shipped` or
  `none:not-S1-S4`; `unclassified` where nobody has read the entry against the criteria. Over the 165
  entries: 12 GHSA identifiers, 72 `none:unsupported-only`, 17 `none:not-shipped`, 58
  `none:not-S1-S4`, 3 `none:declared-limit`, 1 `none:fix-not-shipped` (RWD-2026-0113) and 2
  `unclassified` (RWD-2026-0106 and RWD-2026-0164, left to the maintainer). The prose of every entry
  is unchanged.
- **Its guard.** `test/unit/known-defects-register.test.js` refuses a missing or out-of-vocabulary
  value, a malformed or repeated GHSA identifier, an advisory on a range that ends before 0.37.0
  (decision 4) or without a published patched version, and `none:not-shipped` or
  `none:unsupported-only` wherever the versions say otherwise, in both directions; a positive control
  plants each of the 21 refusals and twelve accepted forms. `unclassified` is held to five entries
  at most.
- **The open anomalies name the advisory.** `node scripts/open-anomalies.mjs <version>` prints
  `advisory=GHSA-…` beside each listed entry that has one and counts them; `--json` carries
  `advisory` on every entry. A register written before the field still reads, with `advisory: null`.
- **Whether an advisory reaches a dependency scanner: not yet visible on 2026-10-11.** ADR-0086's
  "What would settle it" asks for `npm audit` on a project pinned to an affected version to show an
  advisory. Measured at 17:47 UTC on 2026-10-11, about seven minutes after the advisories were
  published: `npm install runward@0.43.0 --save-exact` then `npm audit --json` reports 0
  vulnerabilities (the same on `runward@0.42.2`, which eleven of the twelve affect), and
  `gh api "/advisories?affects=runward"` on GitHub's global Advisory Database returns an empty list
  (`/advisories/GHSA-38j8-vhh9-vmfw` answers 404). GitHub reviews a repository advisory before the
  Advisory Database, and so `npm audit`, carries it, so this is a reading taken before that review,
  not a failure of the channel; it is read again before the channel is quoted as working.
- **`ROADMAP.md`.** The advisories item of "Security handling" is done, with the measurement above as
  what remains. `SECURITY.md` is unchanged.

## 0.43.1

### A pointer glued to another one is read, and a strict verdict can write its witness

A patch release in three parts. **The fix of RWD-2026-0165** (criterion S1 of ADR-0086): a typed
pointer written right after another one in the same `;`-segment, behind anything but white space or a
comma, was never read, so a dead pointer cited that way left `check --strict` at exit 0; every release
from 0.32.0 to 0.43.0 carries the rule. **ADR-0089, increment 1, steps 1 to 3** (accepted 2026-10-06):
a canonical mission snapshot and eight metamorphic relations checked over generated missions (test
support, nothing of it ships), and `check --strict --witness <file>`, an opt-in option that writes the
facts a strict verdict relied on, specified in `docs/spec/witness.md`; `check`'s output and exit code
are the same with and without it, and the checker that re-checks a witness is not in this release.
**The 0.43.0 mutation ratchet, closed**: its signed summary committed, 541 survivors filed, 371 of them
then killed by direct tests. Also: v0.43.0 measured as the first immutable release, three dependency
updates, and a qualification kit that no longer fails a case on a package it does not carry. A patch rather than a minor: a security fix ships on the maintained line outside
the feature train (ADR-0068, ADR-0086), and the one new option is opt-in and changes nothing a pipeline
that does not pass it sees. The tool operational requirements describe 0.43.1 (TOR-192 to TOR-208
added).

### Three dependency updates, one of them at runtime

`chalk` 6.0.1 is the one runtime update: it reaches every installation. Read against 6.0.0, its
package differs in one line, a style called with two arguments now prints `null` and `undefined` as
empty, as `Array#join` does, instead of as words. `@typescript-eslint/parser`
8.71.0 (merged on its own, #369) and `eslint-plugin-security` 4.1.0 are development only. The plugin's
4.1.0 adds a rule, `security/detect-invisible-characters` (U+3164 and U+FFA0, characters with no glyph
that can hide an identifier from review), and the test that requires every rule the plugin ships to be
decided turned red on it, which is what failed the update's own pull request. The rule is enabled at
`error` in `eslint.security.config.js`, beside `detect-bidi-characters`: measured on `src/`, 0
findings, and a U+3164 planted inside an identifier in a temporary `src/` file was reported, so the zero
is a reading. The committed `reports/eslint-security.sarif` changes only in the plugin version and the
new rule's entry; its results are the same eight `detect-unsafe-regex` warnings. The development range
is raised to `^4.1.0`, since the configuration names a rule older versions do not have.

### The qualification kit no longer fails a case on a package it does not carry

Run against the packed tarball installed in an empty project, the kit of this release, as first built, failed the
nine cases of `test/unit/verdict-metamorphic.test.js` (TOR-192 to TOR-200): the file imports
`fast-check`, a development dependency the kit does not carry, and could not load
(`ERR_MODULE_NOT_FOUND`). The release chain runs the kit under `set -euo pipefail`, so the tag push would
have stopped in the prepare phase; no released kit was affected (0.43.0 cites no such file). The builder
(`scripts/build-qualification-kit.mjs`) now reads the import graph of every cited case: the file's static
imports, the dynamic imports its case reaches, and, transitively, every import of the test support files
it imports. A case that needs a package that is neither a Node built-in nor a runtime dependency of the
installed runward (its `dependencies`) is `not-run-here`, with the package named ("needs the dev
dependency fast-check") and the pointer to the release's committed `reports/junit.xml`, exactly like a
case that reads the source tree, and is never counted as passed. A support file's import into the source
tree now marks the case too. The js-yaml check of `smoke.js` is the same rule applied to the text the
runner executes: the runner still removes that one check and reports it skipped, and the builder
classifies `smoke.js` without it, so any other such import would make the smoke citations
`not-run-here` rather than fail the run. The runner (`scripts/qualification-kit/run.mjs`) now links the
installation's runtime dependencies into its work directory, so a test that imports one, which the rule
says runs, finds the installed copy; before, it could not have. Measured on main's packed tarball in an
empty project: 181 pass, 0 fail, 27 not-run-here (18 source tree, 9 `fast-check`). Pinned by
`test/unit/qualification-kit.test.js` (a dev-dependency case `not-run-here`, a runtime-dependency
positive control that runs, both measured red against the change removed); TOR-189 and TOR-190 say it.

### A pointer written right after another one is read (RWD-2026-0165)

A `;`-segment was cut into pointers only where white space or a comma preceded the next `file:`,
`test:` or `adr:` spelling, and each piece yields one pointer, so a pointer written right after another
one behind anything else, as in `test:r.xml::"a case" (file:x.ts#Y)`, was never read. A dead pointer
cited that way left `check --strict` green: measured on the example mission with 0.43.0, exit 0 behind
`(`, exit 1 behind a space. Every release from 0.32.0 to 0.43.0 carries the rule. `splitPointers`
(`src/lib/evidence.ts`) now also cuts before every spelling not glued to a letter, a digit or `_`,
outside quotes: the spellings the grammar already accepted at the head of a piece, and exactly the ones
the witness's cover test counts (`docs/spec/witness.md` section 9.6). The space-and-comma cut is
unchanged, quoted symbols and test names are still never cut, and a bare-word spelling (`npm run
test:junit`) is still prose, disclosed. A cell that parsed before gains the pointers it was dropping;
the one other change is an unquoted operand the next spelling was glued onto (`#Sym(file:b.ts)`), which
now ends where that pointer starts. runward's own mission now
reads its four such citations, in `hexa-adapter-pattern` and `resilience-fail-open`; all four resolve
and no row was re-spelled.

This is a change on the verdict path, a pre-merge path under the delegation charter. Pinned by
`test/unit/evidence-misc.test.js` and by attack corpus case `AC-017` (17 cases, 13 refusals), both
measured red against the unfixed build. The register entry is `fixed-in=0.43.1`; the requirements
register gains TOR-208, and TOR-205 covers AC-017. `src/lib/evidence.ts` is in the mutation ratchet's
perimeter: the release run re-derives its survivor register.

### The strict verdict can write its witness, specified for a checker that shares no code with it (ADR-0089, increment 1)

The second pull request of ADR-0089's increment 1, step 3 of the record. `runward check --strict
--witness <file>` also writes the **witness** of the verdict: the facts it relied on, as one canonical
JSON file (`runward-witness/1`): each row of the five gated manifests with its line and the digest a
ratification binds to; each typed pointer and bare path token with the base it resolved from, its real
path and, once per file, that file's digest, line count and report natures; where each symbol and JUnit
case was found; each rule file's digest against the lock; the expected rule sets; the cited ADRs with
their status words; the unratified decisions; the counts; and one cause per unit counted against the
verdict. Families this version does not carry (deliverable state against the templates, signatures,
report results, on-disk spelling, scaffold-identical files, the seal, the regulated tier, the charter,
workflow contracts, hooks) are named in the file, under `notWitnessed`. `docs/spec/witness.md` is its
only specification: fields, types, derivations, what a checker re-checks against the tree and what it
re-derives (the expected sets, the sections, the rows, a conservative cover test against dropped
pointers), the canonical encoding, versioning (expand only), and worked examples from the example
mission. The checker itself is not in this pull request: another session writes it from the
specification alone (ADR-0089 decision 2).

Opt-in and inert: `check`'s stdout and exit code are byte-for-byte the same with and without
`--witness`, and a checker's answer never changes them (decision 3). `--witness` needs `--strict` and
refuses `--freeze`; a path inside `runward/`, a directory, a missing or unwritable directory (usage) and
an existing file that is not a witness (refused) exit 2 before the gate runs, with the ADR-0083 error
document under `--json`; the file is written whole through a temporary file; `--dry-run` writes
nothing. The witness is assembled from the verdict object the command rendered, never a second
computation; two functions of the verdict path were split, with no change to what they return, so the
witness can name a location: `textOutsideManifest` now reads its lines from the exported
`outsideManifestLines`, and `junitTestResult` its answer from the exported `junitTestCases`;
`repoRootAbove` is exported. Measured on 0.43.0: 37,100 bytes for the example mission and 59,181 for
runward's own (ADR-0089 had sized a smaller mock at about 20 and 30 KB). `dist/lib/witness.js` joins the
mutation perimeter. The requirements register gains TOR-201 to TOR-207.

Writing the specification's cover test found a wrong verdict before any checker existed: a typed pointer
written after another one in the same sentence, as in `test:r.xml::"a case" (file:x.ts#Y)`, is dropped
in silence, so a dead one leaves `check --strict` at exit 0 (RWD-2026-0165, fixed by a pull request of
its own, below). runward's own mission carries four such citations in two rows, all to files that
exist.

### 371 of the 541 survivors the 0.43.0 ratchet filed are killed by direct tests

The 0.43.0 closing loop filed 541 survivors as `hole`, "not yet instructed". Five new test files
(`identity-direct`, `delegation-charter-direct`, `delegation-sample-direct`, `delegation-gate-direct`,
`ratify-proposer-direct`) observe what those mutants changed, through the exported API or the CLI:
the status of a sample period under every tampering, one problem per ledger defect (each is a strict
gap), the canonical forms of the sample pinned by value (a committed ledger must keep re-performing),
the parser never throwing, the charter's line grammar and window, the first day of a suspension and
of two missed periods, the causes read from `for:` and `proposer-for:`, the `--through` horizon of
the charter's gaps, and the row, line and phase a delegation gap is reported on. No production code
changed, and no defect was found.

Every killed survivor was applied to `dist/` by hand and the new files run against it before the
measure. Re-measured on the branch by `mutation-ratchet.yml` in `measure` mode, then retired from
that run's merged report with keys derived by `scripts/mutation-key.mjs`: `identity` 21 of 30
(9 left), `delegation` 78 of 131 (53), `delegation-sample` 214 of 281 (67), `conformance` 22 of 41,
`verdict` 7 of 16, `check-contract` 17 of 23, `ratify` 6 of 8, `sarif` 6 of 11. The register now holds
1,858 filings; each of the eight modules answers "the register describes this tree" (exit 0).

The 170 survivors left keep their `hole` filing. Most change only a problem's or a label's sentence
(ADR-0046 decision 1: no test pins prose); the others have an argument for `equivalent` that has not
been through the qualification the register requires (a redundant guard, inputs that are null
together, V8's sort reading only a negative comparator result, a branch reachable only through a
48-bit SHA-256 partial preimage), so none is reclassified here.

### The verdict is checked against eight metamorphic relations, over generated missions (ADR-0089, increment 1)

The first pull request of ADR-0089's increment 1: steps 1 and 2 of the record, test support only, with
no change to the verdict path or to any machine output. A canonical mission snapshot
(`test/support/mission-snapshot.js`) writes down what a verdict depends on: every file under the project
root in POSIX spelling, text with CRLF folded to LF as the seal already folds it, the runward version,
the template digests and the repository markers above the root; `materialize` writes it back, and a
canonical rendering of a `Verdict` sorts every list so a relation that holds up to order compares byte
for byte. A generator (`test/support/mission-generator.js`, fast-check) derives missions from the
example by reordering rule rows, deciding `applied` rows otherwise (`n/a` with a reason, `deviated` with
an ADR), citing new evidence files and adding uncited ones. `test/unit/verdict-metamorphic.test.js`
checks the eight relations of the record on them: renaming an uncited file, reversing row order,
re-padding cells, CRLF and an unexpected `n/a` row leave the verdict unchanged (the last moves only the
three counts that disclose the row); deleting a cited file, duplicating a row and emptying an `applied`
cell turn a green mission red, judged only on missions that were green first. Fixed seed, 3 missions
per relation by default (about four seconds for the file); `RUNWARD_MR_RUNS` raises it, and a run at 100
per relation (800 relation cases) found no disagreement. Each relation was shown to fail on a build with
one deliberate break planted for it and then removed. The requirements register gains TOR-192 to
TOR-200. A relation is not an oracle: a green run says the verdict respects these properties on the
generated missions, not that any single verdict is right.

### Accepted: the verdict carries its witness, re-checked by a small program that shares no code with it (ADR-0089)

Wave 3 of the reliability roadmap, investigated and put to the maintainer as a constitutional decision
(class R: it touches the verdict path); accepted by the maintainer on 2026-10-06 with the three
recommended answers. Measured on 0.43.0: `check --strict --json` names what failed
and nothing of what held, so a green verdict can only be re-checked by re-running runward, and `verify`
re-derives with the same `computeVerdict`. Eight metamorphic relations hold on the example mission
(rename an uncited file, reorder rows, re-pad, CRLF, add an unexpected `n/a` row: unchanged; delete a
cited file, duplicate a row, empty an `applied` cell: green to red), three of them untested today. A
111-line prototype checker written for the record agreed with the verdict on 18 missions (the example,
runward's own, AC-001 to AC-016) after two fixes, and both disagreements were defects runward had
already fixed. The record recommends an opt-in witness (`check --strict --witness <file>`), a checker of
at most 600 lines importing nothing from runward, shipped in the qualification kit and run in CI, whose
answer never changes `check`'s exit code; the second implementation and any formal model behind
triggers. The ROADMAP's Cedar sentence is corrected against its sources: "100 million" is the 2023
post's total, and the June 2026 advisory concerns a divergence from the author's intent, not from the
model.

### v0.43.0 is the first immutable release, by measurement

`gh release verify v0.43.0` exits 0 and the release reads `isImmutable: true`, although the repository
setting was enabled after it was published and GitHub's documentation says immutability applies only
to later releases; v0.42.3 stays mutable. `docs/verifying-a-release.md` Step 7 now says so, with what
immutability refuses, measured on a throwaway repository: deleting or adding an asset, moving or
deleting the tag (editing the notes is accepted). ADR-0085 records the first release on the draft-first
chain and these measurements in a dated note; the ROADMAP item is done.

### The 0.43.0 mutation ratchet, closed: 541 survivors filed, three modules instructed for the first time

The ratchet that the 0.43.0 release started (run 37006721244, commit `d04ccaf`) refused, as the pull
requests that changed the code said it would: 16 modules described the tree; `check-contract`,
`conformance`, `ratify`, `sarif` and `verdict` were in mismatch (48/25, 202/167, 39/34, 56/46, 51/35
measured/filed); `identity`, `delegation` and `delegation-sample`, new in the perimeter, had no register
entry and refused (30, 131 and 281 survivors). Its signed summary is now committed byte for byte as
`docs/compliance/ratchet-summaries/ratchet-summary-0.43.0.json` (SHA-256
`330e3ba3e05aa512c68dbeaa49a4974bc8589069eb29ca3f12d36b6e68e95739`), and verifies against the
attestation `mutation-ratchet.yml` signed for it.

The survivors are filed from that run's own merged reports, each report used only after its SHA-256
matched the one the signed summary records, and each key derived by `scripts/mutation-key.mjs`, the
implementation the ratchet itself uses. **541 survivors are filed** (23 in `check-contract`, 41 in
`conformance`, 8 in `ratify`, 11 in `sarif`, 16 in `verdict`, and all 30, 131 and 281 of the three new
modules) and **10 filings the tree no longer produces are retired** (6 in `conformance`, 3 in `ratify`,
1 in `sarif`, among them two `readManifest` holes). Every new filing is `hole`, with the evidence saying
what it is: **not yet instructed**. Each survived the unit suite; none has been through pass 2 (the
whole net) or applied to a probe mission, so none is a measured defect and none is claimed
`equivalent`. The register's own header says so for the three new modules ("whole net: never run").
No register entry is added to `known-defects.md`: nothing measured here showed wrong behaviour.

The register now holds 2,229 filings across 24 modules. Re-measured on this branch by
`mutation-ratchet.yml` in `measure` mode, one module per run with every chunk back, each of the eight
answers "the register describes this tree" (exit 0).

## 0.43.0

### Delegation declared, not proved; a qualification kit the user runs; the first release prepared as a draft

A minor release in four parts. **Delegation, stage 1** (ADR-0088): a mission whose agents act for one
accountable person can declare it in a charter, `runward/delegation.md`, which the gate reads and
every surface prints as « delegation: declared, not proved » while the maintainer's credential is
within agent reach; accountable persons are compared by canonical id, so one person spelled twice or
two agents answering to the same person no longer pass as independent (RWD-2026-0164, the one register
entry fixed in this release); `runward sample` keeps a weekly signed sample the gate re-performs from
the ledger alone; a stop check binds the App and the charter's delegates once it is required. **The
qualification kit** (ADR-0087): a per-version kit, built deterministically from the tagged tree, that runs
the tests the requirements cite against the user's own installation and decides nothing for anyone,
with the attack corpus given stable identifiers and the open anomalies listed per version. **The
release chain** (ADR-0085): a pushed tag prepares a draft holding six assets, and the maintainer
publishes it; 0.43.0 is the first release cut on this chain, with immutable releases still off.
**`SECURITY.md`** (ADR-0086) says what is treated as a vulnerability, a 30-day aim for a fix or a
published decision, and which line a fix ships on. The tool operational requirements describe 0.43.0
(TOR-158 to TOR-191 added, after a third edition that brought them to 0.42.3).

### The qualification kit: its builder, its runner, and its place in the release chain (ADR-0087 decisions 1, 3 and 7)

`runward-qualification-kit-X.Y.Z.tgz` can now be built from a tagged tree. It holds the tests
the requirements document cites (with `smoke.js` and the attack corpus), a runner, that version's
`tool-operational-requirements.md`, its open anomalies (generated by `scripts/open-anomalies.mjs`), a
description of the attack corpus, and `kit-manifest.json`: the SHA-256 of every kit file and of every
file of the npm tarball. The kit decides nothing for anyone; its README opens with that line, and
`no-overclaim.test.js` now scans the README and the runner.

- **`scripts/build-qualification-kit.mjs --tarball <tgz> [--ref <ref>]`** reads the tree through git
  (nothing untracked enters a kit) and writes a deterministic `.tgz` (sorted entries, the commit's
  time, no gzip time or OS): two builds of the same inputs are byte-identical. It derives each cited
  case's kind from the test source: `internal` when anything the case reaches, fixture included, uses
  a `dist/` module; `interface` when it otherwise runs the binary; `static` otherwise. It marks a case
  as needing the source tree when it reads, relative to the repository root, a path the package does
  not ship.
- **`node run.mjs --package <installed runward>`** refuses another version (exit 2), compares every
  installed file with the tarball list and records no result on any difference (exit 3), runs the
  suites in a work directory that links the installation without writing to it (and checks its
  digests again afterwards), reports source-tree cases as `not-run-here` with a pointer to the source
  commit's `reports/junit.xml`, skips `smoke.js`'s one `js-yaml` check and reports it as `skipped`, and
  runs the corpus with `--json`. It writes `qualification-report.json` and `junit.xml`, unsigned
  (decision 7).
- **Measured on `runward@0.42.3` from npm** (Node 24.18.0, macOS arm64, git 2.50.1), with the kit
  built from the tree ADR-0087 measured (`8a18489`, the third edition of the requirements): 202 of
  202 installed files match the tarball; 157 cited cases, 147 pass, 0 fail, 10 `not-run-here`
  (interface 68 of 68 run here, internal 78 of 78, static 1 of 1); the `js-yaml` check skipped; the
  corpus 16/16; the installation unchanged after the run; 86 s. ADR-0087 counted 148 passes: the
  difference is TOR-048, whose scan list includes `docs/`, `runward/` and `src/`; on an installation
  it scans only what is there and passes, which the kit does not count. Built from the `v0.42.3` tag
  itself, the kit carries that tag's second-edition requirements (51): 45 pass, 6 `not-run-here`.
- **Release chain.** The isolated builder (`build-and-attest.yml`) builds the kit after packing the
  tarball and attests its provenance; `release.yml` rebuilds it and refuses a kit that differs, runs it
  against the tarball installed in an empty project, and attaches the kit and its provenance bundle to
  the draft, whose read-back now checks six assets. `docs/verifying-a-release.md` Step 8 says how to
  verify the kit, from the first release that carries it.
- **Requirements.** TOR-185 to TOR-191 (section 23, "The qualification kit"); the section of what has
  no requirement yet becomes 24.

### The interim route to run runward's own suite on an installation, and two qualification templates (ADR-0087 decisions 2 and 5)

- **`docs/compliance/regulated-adoption.md` section 9** gives the commands to run the tests the
  requirements document cites, the smoke test, the attack corpus (`--cli`, `--json`) and the open
  anomaly listing against a runward installed from the npm registry, from a work directory that links
  the installed package beside a copy of the tests, so the installation is never written to. Measured
  on 0.42.3 on 2026-10-02 by running the block as written: 328 cases in the 44 cited unit files, 308
  pass; joined to the 157 requirements, 148 pass, and the 9 others fail only on a repository file the
  package does not ship (they are to be counted as not run there, never as passed); smoke 128 checks
  with `js-yaml` installed beside it; corpus 16/16; one open anomaly and five undetermined; the
  installed files' digests unchanged. The section also states which tree to test from: for 0.42.3 it
  is commit `d3a953c`, not the tag, because the tag carries the requirements document's second edition.
- **`docs/compliance/qualification/`**: a README that opens with ADR-0087's hard line, and two
  skeletons for the user's own documents, a tool qualification plan and accomplishment summary for an
  applicant under DO-178C criteria 3 (DO-330 objectives treated as the applicant's) and a tool
  classification and validation report for ISO 26262-8 clause 11 with method 1c. runward fills its
  description, version, requirement references, the place the report is cited and the anomaly pointer;
  the use case, classification, error-detection argument and conclusion are blank with questions. Every
  clause number, class definition or table content not read at the source is marked "to check against
  your licensed copy". Not in the npm package.
- `test/unit/no-overclaim.test.js` already scanned `docs/` recursively; its reach assertion now also
  names `docs/compliance/qualification/README.md`. `ROADMAP.md` records both items as in progress.

### A qualification kit the user runs on their installation, accepted (ADR-0087)

ADR-0087 (accepted by the maintainer on 2026-10-02, every recommended option) decides how the three
"Evidence a regulated buyer can run" items of the ROADMAP would ship. It measures first: of the 157
requirements in `tool-operational-requirements.md`, 70 cite a test that goes through the `runward`
binary only, 41 a CLI-built fixture checked through an internal function, 38 an internal function only,
and 8 a file read as text; run against `runward@0.42.3` installed from npm, 148 of the 157 cited cases
pass, and the 9 others fail only because they read files the package does not ship. It recommends a
per-version kit attached to the release as an attested asset (tests, a runner that checks the installed
files against the attested tarball and writes a plain report, the requirements, the open anomalies of
that version, and two templates for the user's own documents), the attack corpus given stable
identifiers and a JSON result, and no change to the npm package. The kit never states a level or a class
for anyone: the user does that, in their context of use. Eight decisions are left to the maintainer.
`ROADMAP.md` points to the ADR, and its advisory item now records that the ten CVE requests were sent on
2026-10-01.

### The weekly signed sample, re-performed by the gate from the ledger alone (ADR-0088 decision 6)

The third CLI change of ADR-0088 stage 1. A mission with a delegation charter can now keep its weekly
control in `runward/delegation-samples.jsonl`, one JSON record per line, written by a new command and
read by the gate. The format and the steps are in `docs/delegation-charter.md`.

- **`runward sample`** (outside the verdict path; reads git read-only, like `doctor`): `plant` commits
  a seeded defective item as `H(seed, nonce)` before the sample and keeps the seed in the git directory
  until the reveal; `draw` builds the population from git (first-parent merges on the branch, tags,
  ratification entries since the last sample that counts, the merge count reconciled by a second git
  count), takes the drand quicknet round fixed by the period's end, draws `sample-size` acts
  stratified and risk-weighted, lists every shipped-code merge with its digest (decision 7), and prints
  the items and the one command the maintainer runs; `review` records a verdict per item (refused
  inside an agent session); `reveal` opens the seeds; with no action it says where the period stands,
  what comes next, whether the review commit is signed and whether the commits came in order.
- **The gate re-performs it, offline.** `check` recomputes the round from the period's end, the
  randomness from the round's signature (quicknet: SHA-256 of the signature), the population hash and
  counts, the draw, the shipped-code digest and the seed commitments. It does not verify the round's
  BLS signature (no pairing library enters the verdict path), and says « randomness: declared ». A
  record that does not re-perform is a `sample-malformed` strict gap. Every surface with a ledger prints
  « sample: declared human, not proved »: in stage 1 the signing key is within agent reach.
- **Outcomes.** A seed accepted is `control missed`: the sample does not count. A rejected act counts and
  suspends class D for its delegate from the period's end (`class-suspended` on its later rows).
- **Missed periods, without a clock.** Periods are `effective:` plus multiples of
  `sample-period-days:`; the gate reads them against the latest date a ratification entry in the tree
  declares. One missed: « unsampled since <date> » on `check` (text, JSON `delegation.sample`, SARIF
  `properties.delegation.unsampled`), the delivery report and `doctor`. Two: agent ratifications dated
  since the last sample that counts are `sample-missed` strict gaps, and under the regulated tier they
  stop counting (`agent-unsampled`). `doctor` reads the same periods against today.
- **Single accountable.** Under the regulated tier, the lock's `"singleAccountable"` exception now
  counts a row when a passing sample covers its date; `single-accountable-unsampled` says so otherwise.

The `delegation` block of `check --json` and of the attestation predicate gains `sample` (additive,
present with a charter); `verify` re-derives it. `src/commands/sample.ts` joins `SPAWN_ALLOWED`;
`dist/lib/delegation-sample.js` joins the mutation perimeter. ADR-0088 gains a dated note recording the
clockless readings (expiry and missed periods). TOR-174 to TOR-184 added; `AGENTS.md` keeps the review
the maintainer's. runward's own mission has no charter and no ledger: nothing changes for it.

### The stop, CODEOWNERS on the trust roots, a Dependabot cooldown, and `ratify --agent` bound to the charter (ADR-0088 stage 1, step 4)

The platform pieces of ADR-0088 stage 1, minus the App installation (a web-session gesture, in the
runbook). Stage 1 adds attribution, not protection: an agent that holds the maintainer's credential
can undo each of these, and the surfaces say so.

- **The stop (decision 9).** A new check, `delegation stop` (`.github/workflows/delegation-stop.yml`,
  logic in `scripts/delegation-stop.mjs`), reads the repository variable `RUNWARD_DELEGATION_STOP`.
  When it is on, the check fails on any pull request that `runward-steward[bot]` or a delegate of the
  default branch's `runward/delegation.md` opened, pushed to, or authored a commit of; unset or `off`
  passes, any other value stops. It runs on `pull_request_target`, so a pull request cannot edit the
  stop to pass it, and never checks out the pull request's code; read-only permissions, actions pinned
  by SHA. It binds only once an administrator makes it a required check. The escalation budget is
  published by the charter, not enforced, in stage 1.
- **CODEOWNERS.** `runward/delegation.md`, `runward/scaffold-lock.json`, `.github/` and the pre-merge
  paths of decision 7 are named explicitly, owned by @stranxik. Ownership is unchanged today (`*`
  already names the same owner); the lines keep those paths the maintainer's if `*` gains an owner. A
  code owner is a user or a team, never an App, and code-owner review is not switched on by this file.
- **Dependabot cooldown (class D).** Every ecosystem in `.github/dependabot.yml` waits 7 days after a
  release before proposing it (`cooldown: default-days: 7`); security updates are not delayed, per
  GitHub's options reference. ADR-0084's auto-merge envelope is unchanged.
- **`ratify --agent` reads the charter.** When `runward/delegation.md` exists, the agent path
  (`--list` included) refuses an agent the charter does not list as a delegate: exit 2, class
  `refused` (ADR-0083), naming the charter, nothing written. Compared folded, as the gate's
  `agent-not-delegate` compares it; a charter whose delegates cannot be read refuses every agent.
  Without a charter, unchanged.
- **Runbook.** A "Delegation (stage 1)" section: flipping the stop, the weekly act (to come),
  installing the App from a 2FA web session, and what stays the maintainer's.

### A delegation charter the gate reads, which proves nothing by itself (ADR-0088 decisions 1 and 5)

The second CLI change of ADR-0088 stage 1. A mission whose agents act for one accountable person can
declare that policy in `runward/delegation.md`: the accountable person as a canonical id and its
aliases, the delegates (agent names and the App's forge identity), the four classes of acts (R and H
the maintainer's, I refused in stage 1, D delegated or kept), scopes, the escalation budget, the
sample size, `stage:`, `effective:` and `expires:` (at most 90 days), and the pre-merge list as data.
The format is in `docs/delegation-charter.md`; a template ships as
`templates/delegation/delegation.md`. `init`, `wire` and `update` never write one: the charter is the
accountable person's act (class R).

- **The stage banner.** When a charter exists, `check` (with and without `--strict`), `check --json`
  (`delegation`, additive), the SARIF run properties (`delegation`), the delivery report and `doctor`
  print « delegation: declared, not proved — the maintainer's credential is within agent reach » and
  « charter: declared, not proved ».
- **Strict gaps, named.** Under `--strict`, a malformed charter (`charter-malformed`), a class it may
  not delegate (`charter-class-refused`: R or H at all, I in stage 1), `stage: 2`, which this version
  cannot read (`charter-stage-unread`), an agent ratification by an agent it does not list
  (`agent-not-delegate`) and one dated after `expires:` (`charter-expired`) are each a strict gap, exit
  1, counted in `gaps.charter` (additive) and listed in the `conformance` table with scope
  `delegation`. The Next line names `fix-delegation-charter`. `verify` re-derives the block.
- **No clock in the verdict.** Expiry is read against the dates the ratification entries declare, so
  the same tree gives the same verdict on any day (ADR-0054). `doctor` sets `expires:` beside the
  clock and warns when the charter has expired or expires within 14 days.
- **Identities.** The charter's accountable person and aliases merge over the lock's interim
  `identities` (PR #351): every lock id stays declared, the charter's aliases come first, and an alias
  the charter gives its accountable person is read as theirs alone.

No charter, no change: no section, no JSON key, no SARIF property, no gap. runward's own mission has
no charter yet; committing one is the maintainer's act. TOR-164 to TOR-173 added; `AGENTS.md` and
`docs/operator-role.md` point to the charter.

### Independence is compared by person, and never claimed where one person answers for both sides (ADR-0088 decision 4)

The first CLI change of ADR-0088 stage 1. Under the regulated tier with `"agentRatification": true`, an
agent ratification counted when the person accountable for the agent did not appear, as a whole token,
in the row's `proposer:` text. Two shapes passed that should not have: one person spelled twice
(`--for thibaultsouris` against `proposer: Thibault Souris`), and two agents answering to the same
person, since a proposer segment names the proposing agent and `propose` never recorded who answers for
a proposal (RWD-2026-0164, `wrong-verdict`, `exit-code`, affected 0.42.3).

- **Canonical ids.** Accountable persons are compared by canonical id: names are folded (case,
  spacing and punctuation) and resolved through the lock's new `"identities": { "<canonical id>":
  ["<alias>", …] }`. ADR-0088 decision 5 puts this declaration in the delegation charter,
  `runward/delegation.md`, which a later change reads; until then it lives in `scaffold-lock.json`
  beside the other opt-ins, and `update` keeps it.
- **`propose --for <person>`** records the proposer's accountable person in each row it proposes
  (`; for: <person>`, after the proposer), and `ratify` carries it into the trace as `proposer-for:`.
  A hand-written proposal may carry the same segment. `propose --json` adds `for` to each proposal.
- **`agentCause()`** compares the two accountable persons, not strings. Under the regulated tier,
  three causes are added (additive, ADR-0030): `agent-identity-undeclared` (an accountable person the
  lock does not declare), `single-accountable-refused` and `single-accountable-unsampled`;
  `agent-unattributed` now also covers a proposal that does not say who answers for it.
- **`agent (single accountable)`.** A ratification whose accountable person also answers for the
  proposer is refused, except with `ratify --agent … --for … --single-accountable --accept …`, which
  records `independence: single accountable` in the trace. A default mission counts it, and `check`,
  `check --json` (`ratification.singleAccountable`), the SARIF run properties and the delivery report
  say « single accountable person; agent ratifications are disclosed throughput, not independent
  approval ». The regulated tier refuses it by default; when the lock names the person
  (`"singleAccountable": "<canonical id>"`) it counts only for a period a passing signed sample covers.
  The signed sample is a later change, so today such a row is a named strict gap, "no signed sample
  yet", never silently counted, and every surface adds « not a DORA change-approval control; ADR-0080
  Part 2 unchanged ».
- **`by:` beside the identity that committed it.** `check`, `report` and the JSON keep printing `by:`
  as declared: the verdict path may not spawn a process or read git history (ADR-0054, crossings 1
  and 4). `runward doctor`, which already runs `git` read-only, now reads `git blame` for each
  ratification entry, says whether the declared `by:` names the committing identity (folded,
  alias-resolved, GitHub no-reply addresses read), warns when an agent's entry was committed under
  another identity, and lists the result as `ratifiers` in `doctor --json`. A match is a consistency
  between two declarations, not a signature; commit signatures are not verified (ADR-0088 stage 1).

Nothing changes for a mission with no agent ratification, and an attestation sealed before the field
still verifies (`singleAccountable` is present only when non-zero). A `--strict` attestation made on a
regulated mission holding an agent-ratified row may re-derive a different cause under this version
(`versionSkew`). runward's own mission has no agent-ratified row and its lock is unchanged.
TOR-112 and TOR-117 are reworded and TOR-158 to TOR-163 added; `docs/operator-role.md` and `AGENTS.md`
follow.

### The public claims about runward's own delivery name one accountable person (ADR-0088, decision 10)

ADR-0088 narrows the public claims before any act is delegated. Four documents described a person where
the forge records an account agents also hold: `AGENTS.md` "The maintainer merges", `GOVERNANCE.md` a
maintainer who "reviews and merges changes" (0 reviews on 277 merges), the README "publishing to npm is a
deliberate human gesture" and "the human decides the crossing", and `regulated-adoption.md`
"review-by-default". They now say what is true today: runward has one accountable person, the maintainer;
coding agents do most of the work, today under the maintainer's account, and under the `runward-steward`
App once it is installed; agent ratifications and forge approvals are disclosed throughput, not
independent approval; this is not a DORA change-approval control; delegation is declared, not proved,
while the maintainer's credential is within agent reach; runward's SLSA Source level is not measured yet.
Releases are still published by the maintainer's gesture (ADR-0085 decision 3, unchanged), and the
runbook and `docs/verifying-a-release.md` now say that this gesture is declared, not proved.
`test/unit/one-accountable-person-claim.test.js` keeps the disclosure in place and refuses the five
unqualified sentences, proven on the lines it was written for.

### runward's own delivery under a delegation charter, accepted (ADR-0088)

ADR-0088 (accepted on 2026-10-01) decides how runward's own delivery stops needing the maintainer's hand
on each act. It measures first: all 277 merged pull requests not opened by Dependabot were opened and
merged by the maintainer's account with 0 reviews, and every agent session uses the same token, so the
forge cannot tell the maintainer's acts from an agent's. Five measurements on a throwaway repository
with the GitHub App `runward-steward` (2026-10-01) show that the App's approval satisfies a required
review, that the App key alone can publish a release and fire `release: published`, that a no-bypass tag
ruleset refuses the App and the maintainer alike, and that a workflow token cannot create a repository
advisory while the App can. It decides on agents acting under the App, four classes of acts (trust roots
and third-party judgement stay the maintainer's, irreversible patch releases are delegated only under a
signed prior authorization, reversible acts are delegated), a charter `runward/delegation.md` the gate
reads and prints as declared, not proved, one weekly commit signed by the maintainer carrying a 5 + 1
seeded sample and a digest of shipped-code merges, deterministic pre-merge escalation, and a stop the
App cannot clear. It starts in two stages: stage 1 now, with every surface saying « delegation:
declared, not proved » while the maintainer's credential is within agent reach; stage 2, a separate OS
user and a hardware key, before any irreversible act is delegated. It states that this is not a DORA
change-approval control and that the forge's "approved" is not independent with one accountable person.
It names the sentences of ADR-0080, ADR-0082, ADR-0084 and ADR-0085 it would amend, without editing
them. No CLI change and no charter file ship with it.

### The defect register states each entry's versions in a form a program reads, and lists open anomalies per version (ADR-0087)

Each of the 163 entries of `docs/compliance/known-defects.md` now opens with `affected-from=X`
`fixed-in=Y`. A value is a published version or a word from a closed list (`affected-from`: `unknown`,
`none`; `fixed-in`: `unknown`, `unreleased`, `not-fixed`, `not-applicable`), set from the entry's own
text, the npm version list and the git tags; the prose is unchanged and keeps the detail. 111 entries
carry a version on both sides, 17 say no published release carried them, and 35 have no first version
the text gives exactly (bounds like "0.31.x and earlier" or "at least 0.30.0" read `unknown`), one of
which also has no `fixed-in` the text or the tags settle. `test/unit/known-defects-register.test.js` refuses a
missing or out-of-vocabulary value, a `fixed-in` not after its `affected-from`, and a version later than
the package's, with a positive control for each. `node scripts/open-anomalies.mjs <version> [--json]`
lists, for that version, the entries affected at or before it and not fixed at or before it, with their
workaround where the entry's table has one, and apart from them the entries one of whose bounds is
`unknown`; its boundaries are pinned in `test/unit/open-anomalies.test.js`. The script reads the
repository's register and is not in the npm package.

### The attack corpus has stable case identifiers and a machine-readable result (ADR-0087)

Each of the 16 cases in `test/audit-corpus.js` now declares an identifier, `AC-001` to `AC-016`, and the
register entry or ADR it came from. The identifiers are never derived from position:
`test/fixtures/audit-corpus-ids.json` is an append-only ledger pinning each one to its case name, with a
`retired` list for removed cases, and `test/unit/audit-corpus-ids.test.js` refuses a missing, duplicate,
renumbered or reused identifier (with a positive control for each). `node test/audit-corpus.js --json
<file>` (`-` for stdout) writes, per case, the identifier, name, direction, expected outcome, observed
exit code and verdict, pass or fail, origin and reason, and per run the runward version, the Node
version, the platform, the git version and the totals by direction. `--cli <path>` points the corpus at
another `cli.js`, such as an installed package's. The result states what it measures: regression on
these known vectors, not a detection rate; no score is computed. The human output is unchanged. The
corpus sentence in `docs/compliance/known-defects.md` read 14 cases and 10 refusals while the corpus held
16 and 12; it is corrected and now compared with the corpus by the same test.

### The release chain prepares a draft, the maintainer publishes it (ADR-0085, migration step 2)

`release.yml` now runs in two phases. Pushing an annotated tag `vX.Y.Z` starts the prepare phase
(`workflow_dispatch` on the tag re-runs it): the isolated builder, the SBOM job and the cross-check run
as before, the SBOM attestation runs in a job with no `contents: write`, and a separate `draft` job,
holding only `contents: write`, creates a draft release with `--verify-tag` and attaches the tarball,
both `.intoto.jsonl` bundles and the SBOM, then reads them back by digest. Nothing reaches npm in this
phase, and a prepare run refuses to write to a release that is already published, or to run when the
tag does not name the `package.json` version. The maintainer checks the draft and publishes it from
their own session; that `release: published` event starts the publish job (`contents: read`,
`id-token: write`), which downloads the tarball from the release, verifies it against the isolated
builder's signature, the tag's ref and the tag's commit, checks the SBOM attestation, and only then runs
`npm publish`. `verify-release.yml` verifies the publish run only. `gh release verify` and `gh release
verify-asset` are wired in both workflows behind a guard that reads the release's own `immutable` field
and skips with a notice while releases are mutable; the repository setting is not enabled, and stays off
until one release has run on this chain. The runbook (§3), `docs/verifying-a-release.md` (Step 6, and a
Step 7 for the first immutable release) and ADR-0079 (one sentence) follow. The signed ratchet summary
now lives in `docs/compliance/ratchet-summaries/`, starting with 0.42.3's, which verifies against the
attestation `mutation-ratchet.yml` signed for it.

### `SECURITY.md` says what a vulnerability is, how long a fix should take, and which line it ships on (ADR-0086)

A new section, "What we treat as a vulnerability", states the four criteria ADR-0086 accepted: a verdict
turned green by content the repository can hold (S1), an effect on files the command did not ask for
(S2), a human act recorded that the human did not make (S3), no verdict by crafted input (S4); and what
is not advised and stays in the defect register only. "No fix deadline is promised" is replaced by an
aim: a fix, or a published decision, within 30 days of the report, the same aim for a defect the
maintainer finds, counted from its measurement date, and a missed aim recorded in the advisory with the
number of days. The sentence "they ship when ready, to both supported lines" is narrowed, explicitly: a
security fix reaches an older supported line when it applies there without rework, and otherwise ships
on the maintained line only, with an advisory that says so; the fixes found before 2026-10-01 shipped on
the maintained line only, and their advisories will say so. The 7-day acknowledgement and the single
reporting channel are unchanged. `docs/compliance/regulated-adoption.md` and `docs/distribution.md`,
which quoted the old promises, now say the same. The eleven retroactive advisories exist as private drafts and
are not published; the register's `advisory` field waits for their GHSA identifiers.

### Two decisions accepted: an immutable release chain, and security advisories with a fix-time target (ADR-0085, ADR-0086)

ADR-0085 (accepted) moves the release chain to the order GitHub recommends for immutable releases:
a pushed tag starts a run that builds, attests and attaches every asset to a DRAFT, with no npm publish;
the maintainer looks at the draft and publishes it from their own session, which fires `release:
published`; that event publishes to npm the tarball the release now holds, verified against its
attestation first, and starts the mutation ratchet as before. A job publishing with the `GITHUB_TOKEN`
would fire no `published` run, which is why the one irreversible gesture stays human. The ratchet
summary, signed hours after publication, can no longer be attached to an immutable release; the file is
committed under `docs/compliance/ratchet-summaries/` and its proof stays the attestation. Migration: change
the chain, cut one release on it with the setting off, then enable the setting.

ADR-0086 (accepted) states which register entries warrant a published security advisory: a verdict
turned green by content the audited repository holds, an unasked effect on files, a human act recorded
that the human did not make, or no verdict by crafted input. Eleven past entries whose affected range
reaches a supported line get a retroactive advisory (twelve were listed; an amendment the same day drops
RWD-2026-0113, whose fix never shipped in the package, and lets S2 override the `text-only` exclusion), with a CVE requested for the first two criteria. It
shows that no line older than the maintained one has had a release since its own minor, so the
retroactive advisories name the maintained line as the patched one and say the older lines have no
backport; future fixes are backported when they apply without rework. It sets a 30-day aim for a fix or
a decision, written as an aim, with what happens when it is missed. No workflow, code or mission change.

### The tool operational requirements describe 0.42.3

`docs/compliance/tool-operational-requirements.md` described 0.34.0 and declared, as dated debt, that the
verdict layer had no requirement row. Its third edition adds TOR-052 to TOR-157, each citing the existing
test that exercises it: the declared horizon, the attestation and its re-verification (`verify`, `bundle`,
`--vsa`), `spec-check`, proposals and `ratify` (ADR-0066), the regulated tier (ADR-0080), agent
ratification (ADR-0082), the classes of exit 2 (ADR-0083), the wider `--json` surface, the armed gate
(ADR-0065) and the CLI audit fixes (RWD-2026-0124 to RWD-2026-0162). TOR-001 to TOR-051 are unchanged. The
section that names what has no requirement now lists the forge approval (ADR-0080 part 2, not shipped),
the printed wording, the SARIF document and the corpus pin, and points at the mutation register instead
of quoting a survivor count. The traceability guard also checks that every cited case name is a test case
the committed JUnit report records, whole, so a citation matching only a comment or a fragment of a name
reds the build. `regulated-adoption.md` and the roadmap no longer quote the second edition's count and
version. No test was added for a requirement; no behaviour changed.

### Seven development-only updates, taken together and verified once

The weekly Dependabot run opened seven updates: `@types/node` 26.6.3, `@typescript-eslint/parser` 8.70.1,
`secretlint` and its preset and SARIF formatter 13.0.6, `tsx` 4.23.15 in `floor-ts/`, and
`github/codeql-action/upload-sarif` pinned to the v4.38.2 commit the CodeQL workflow already uses. All
are development or CI only; each pull request's one red check was the high-advisory audit that #339
fixed. Applied on one branch, verified once: 1308 tests, `floor-ts` tests, the committed reports, the
self-gate. `npm install` rewrote the `\u2014` escape in `package.json`'s description; it is restored so
the published manifest keeps its bytes.

### runward's own mission counts three scheduled workflows, not two

The mission row `async-job-guardrails` said the repository runs two scheduled workflows; since CodeQL
there are three. The corrected row loses its ratification, as the regulated tier requires (ADR-0080),
and is ratified again by the maintainer.

### Two development-only advisories published on 2026-09-30 are resolved

`npm audit` reported `brace-expansion` (high, through `@stryker-mutator/core` → `minimatch`) and
`fast-uri` (moderate, through `ajv`), both published on 2026-09-30 and both in the development tree only
(`npm audit --omit=dev` reports nothing: the published package is unaffected). The CI's
`npm audit --audit-level=high` would have failed on every pull request. `npm audit fix` raises both
within their ranges; the lockfile is the only file changed.

### The dependency advisories on `qs` are resolved

Scorecard's Vulnerabilities check counted three advisories on `qs`, a development-only dependency that
arrives through Stryker (`@stryker-mutator/core` → `typed-rest-client`, which pins `qs` 6.15.1). Dependabot
could not update a pin that deep; a package.json `overrides` entry now raises it to a patched version
(6.16.0 at the time of writing), and `npm audit` reports nothing. The override applies to this repository's
own development tree only: npm ignores `overrides` in a package installed as a dependency, so the
published package is unaffected.
### The manifest fuzz is written with fast-check, which Scorecard can see

`test/unit/manifest-fuzz.test.js` was a hand-written seeded fuzz (a mulberry32 PRNG), which OpenSSF
Scorecard's Fuzzing check does not recognise: for JavaScript it looks for a `*.js` file importing
fast-check. The file is now four fast-check properties under a fixed seed and bounded runs (about
1.5 s): the original one over the same cells and line shapes, plus arbitrary unicode cells, keeping
its test name, which the threat model cites (500 malformed manifests never throw and never pass the
expected rule); the same manifest read twice gives the same rows and the same verdict; re-aligning
a row's whitespace never changes the digest a ratification binds to (ADR-0080); rewriting its
evidence does. `fast-check` 4.10.2 is a development dependency; nothing of it ships in the package.
Each property was measured red against a deliberately broken `dist/`.
### Security intake that does not depend on one person's inbox (ADR-0084, accepted)

ADR-0084 (proposed) splits the security intake by what it reads. Reports in triage, code scanning
alerts and Dependabot alerts are private state: an operator agent outside the repository watches them
with a read-only, single-repository fine-grained token that never enters the repository, sends a
notification at the report with day-5 and day-7 reminders, and a weekly digest of counts. Dependabot
pull requests are public state: a workflow in the repository, on the `GITHUB_TOKEN` and no secret, would
auto-merge direct development dependencies at patch or minor once the required checks are green, with
`typescript` on a deny-list. GitHub documents no API that comments on a repository security advisory, so
the 7-day acknowledgment stays the maintainer's comment. Whether a report is a vulnerability, when to
fix it and the advisory's text stay human decisions. No change to the CLI, the gate or the mission.

## 0.42.3

### What the tool prints, records and asks for now holds, and the mission that proves it is ratified

A patch release in three parts. **The regulated tier, part 1** (ADR-0080): under `"regulated": true`, a
decided row counts only when a ratification is bound to its current content, and runward's own
mission now runs under it, its 46 rows ratified by the maintainer. **Agent ratification** (ADR-0082):
an agent may ratify under its own name and the name of the person accountable for it, never under a
person's name, never a row either of them proposed; counted apart everywhere. **An audit of what the
CLI prints**, read as the person and as the agent who act on it: false greens, a skipped row ratified
en bloc, destructive writes, `--dry-run` ignored, jargon, and a Next line that proposed a command
that exited green; each fixed with a test measured red without its fix. Also: exit 2 names its case
in every `--json` error document (ADR-0083); six more commands take `--json`; the published example is
green as the package ships it; one private security channel, acknowledged within 7 days; CodeQL.
45 register entries are fixed in this release (RWD-2026-0119 to 0163). Before release, 311 new
mutation survivors were measured across nine modules: 235 are killed by direct tests, the rest filed
on a measurement, no hole; the full perimeter replays to "the register describes this tree".

### CodeQL scans the repository

A `codeql.yml` workflow runs GitHub CodeQL over the JavaScript/TypeScript sources and over the
workflows themselves, on every push to main, every pull request and once a week, with
`security-events: write` granted to the analysis job only and every action pinned by commit SHA
(`github/codeql-action` v4.38.2). Results go to the code-scanning dashboard; nothing is committed and
no rule of runward's own mission cites them (ADR-0075 still asks for a committed, deterministic scan
about the rule's subject). The vendor sheet's "Continuous posture" row names it, and the drift guard
fails if a trigger, a language or the pinned analysis step is dropped.
### One reporting channel, and it is switched on

`SECURITY.md` offered GitHub's private vulnerability reporting while the setting was off, and the
threat model said Dependabot watched the dependencies while its alerts were off (read through the
GitHub API on 2026-09-28). The maintainer switched on private vulnerability reporting, Dependabot
alerts and Dependabot security updates on 2026-09-29, read back the same day. `SECURITY.md` now names
one channel, https://github.com/stranxik/runward/security/advisories/new, acknowledged within 7
days, with coordinated disclosure and no promised time to fix; the e-mail route is withdrawn. The
threat model and `regulated-adoption.md` say which Dependabot features actually run, and the runbook
reads the three settings back at each release (a manual step: the endpoints need admin access, which
no CI job has). **RWD-2026-0163.**

### The published discovery figures are recounted, not typed

`docs/compliance/what-found-them.md` said "all 87 entries" and the register header gave a mix summing
to 97, while the register held 162 entries. Both now carry the counts of the rows (163 with
RWD-2026-0163), and `test/unit/known-defects-register.test.js` recounts the rows and reddens when a
published figure stops matching them, with a positive control. `regulated-adoption.md` cites the FDA
Computer Software Assurance guidance in its current edition, "Computer Software Assurance for
Production and Quality Management System Software", issued 3 February 2026, which superseded the
24 September 2025 edition the page cited.

### The example is green as the package ships it

From 0.40.0 to 0.42.2, `init --example` from the published package produced a red mission: the
example cites its committed JUnit report and the package did not ship it. The package now carries it,
and a test packs the tarball and runs the example from inside it. **RWD-2026-0156.**
### Exit 2 says which case it was (ADR-0083, option A)

ADR-0083 is accepted, option A, chosen by the maintainer: exit 2 keeps its value for every case, and
the case becomes legible. Every `--json` run that exits 2 now prints one document carrying a stable
`error` field, `no-mission` | `usage` | `refused` | `unreadable-input`, beside the `verdict`/`reason`
a document already carried, which keep their values (`check`, `status`, `manifest`, `propose`,
`report`, `compliance`, `ratify --list` keep `verdict: "no-mission"`; `verify` keeps `reason`;
`spec-check` keeps `verdict`). Where a `--json` run used to print nothing on stdout (an unknown option
or a missing argument caught by Commander, `check --through` with `--freeze`, `rules --phase` on an
unknown phase, `explain` on an unknown rule, `compliance` without a known regime, `report --out`
outside the project or over a file that is not a report, the `ratify --agent --list` refusals,
`wire --install` under an agent or without a terminal) it now prints `{ runward, error, message,
exitCode: 2 }`. `check` with `--json` beside `--sarif`, `--vsa` or `--attest` still prints nothing,
on purpose. Without `--json`, nothing changes. `doctor`'s exit 2 on a critical issue and `gate-hook`'s
exit 2 for its harness are written into `runward/contracts/port-contract.md` as the two exits 2 that
are not "the question could not be asked". The shipped samples (`action.yml`, the adapters in
`templates/adapters/`, `packaging/README.md`, `packaging/kiro/POWER.md`, `docs/distribution.md`) read
"2 no mission, a usage error or a refused gesture: the question could not be asked, never a red gate",
and the BMAD review-layer sample no longer skips itself on a typo (RWD-2026-0157). Schema:
`docs/interop.md`, "Which exit 2". Additive (ADR-0030): no exit code, field or value changes.

### `status`, `doctor`, `manifest`, `propose`, `report` and `compliance` take `--json`

Found by an audit of what the CLI prints (2026-09-27): an agent reading these six commands had to parse
coloured, decorated text. ADR-0030 had deferred their machine output "as the driving loop demands
them"; each now takes `--json`, one JSON document on stdout and nothing else (the human text is
suppressed, errors stay on stderr), the exit code unchanged. `status` publishes the current gate and
phase, every deliverable with its state, the strict verdict it already computes, the ADRs with their
dates, the reopening triggers and the workflow contracts; `doctor` every check with its status
(`ok` | `warning` | `critical`) and its exit code; `manifest` every row of every gated manifest with
its status and evidence, what is missing and, with `--sync`, what was appended; `propose` each proposal
with its pointer and signature, and each row left empty with a stable cause; `report` the file, whether
it was written, the verdict and the same `next` as `check --json`; `compliance` the regime and mapping
version, the files and the strict verdict the pack carries. Fields `check --json` already publishes keep
their name and meaning (`runward`, `mission`, `strict`, `verdict`, `gaps`, `currentGate`, `next`), and
without a mission the five mission commands print its `no-mission` document. `doctor` also takes
`-p <path>`, like every other command. Schemas: `docs/interop.md`. Additive: nothing changes without
`--json`.
### `check --json` says where each refusal lives, and the packagings say what reaches the model

Each row of `check --strict --json`'s `conformance` array now carries `kind` (a stable identifier:
`proposed`, `missing-row`, `unresolved-pointer`, …), `file`, `line` (null when the refusal has no
row) and `phaseId`, from the same locator `--sarif` uses; the armed `gate-hook` refusal names the
file and line too (RWD-2026-0149). `--coverage --json` carries a `coverage` block and
`evidence.proseRows` lists the rows accepted as prose, the numbers and names the terminal prints
(RWD-2026-0150). `deliverables[].phaseId` gives the `--through` id beside the display label, and
`docs/interop.md` publishes the table joining the three phase vocabularies (RWD-2026-0151). All
additive (ADR-0030); `runward verify` re-derives every new field, and an attestation made before them
still verifies. A proposal's refusal no longer says "decide the row yourself": it names the
operator's `runward ratify` and the agent's `ratify --agent <name> --for <person> --list` (ADR-0082,
RWD-2026-0153); a `--strict` attestation made earlier on a mission holding a proposal carries the old
sentence and verifies only with the version that made it. The packaged skill, READMEs and samples stop
saying that the consultative hooks surface the verdict: `packaging/README.md` now tables what each
harness documents about a hook's plain output, and none but Kiro delivers it to the model
(RWD-2026-0152). `init --tools codex` and `gate-hook --harness codex` say why Codex is packaged without
a profile or an armed tier (RWD-2026-0154). The packaged Kiro hook ends in `2>&1 || true`: it blocked
every tool call on a red gate, the fixing edit included, and the Kiro texts now quote Kiro's docs; the
armed Kiro `Stop` sample is marked not verified (RWD-2026-0155). ADR-0083 (proposed) inventories the
uses of exit code 2 and the options, without changing any code.

### The charter and skills runward installs tell agents how they may ratify

The `AGENTS.md` charter and the skills `init` writes into a mission said "you propose; you never
ratify". They now say what ADR-0082 decided: never ratify under a person's name; an agent that ratifies
does it only as itself, naming the person accountable for it (`runward ratify --agent <name> --for
<person>`), never a row it or that person proposed, and under the regulated tier only where the mission
declares `"agentRatification": true`. On an existing mission, `runward update` refreshes the skills;
`AGENTS.md` belongs to the operator and is never rewritten (ADR-0010): edit that sentence by hand.

### An agent may ratify, under its own name, for a named person (ADR-0082)

`runward ratify --agent <name> --for <person>` lets an agent ratify without a terminal and without
prompts: `--list` shows every pending row with the evidence a person would be shown (`--json` for the
machine) and writes nothing; `--accept <deliverable>:<rule>` (repeatable or comma-separated) ratifies
only the rows it names, and refuses the whole call if one is not listed now or was proposed by the agent
or its accountable person (declared names compared, not proof). `--agent` and `--for` go together and are
never empty; `--by`, `--all` and `--attest-blind` are refused beside them; `--dry-run` writes nothing.
The trace reads `by: <name> (declared, agent) · for: <person> (declared, accountable) · … · mode: agent`,
and the rows are counted apart: `check` names how many an agent ratified and for whom, `check --json` and
the attestation carry `ratification.agent` and `ratification.agents` (present only when non-zero, so an
attestation sealed before this change still verifies), the SARIF carries them in the run's properties.
Under the regulated tier an agent ratification binds only if `runward/scaffold-lock.json` declares
`"agentRatification": true` and the accountable person is not the row's proposer; otherwise it is a
strict gap with a named cause. `update` preserves the flag. Without `--agent` nothing changes: `ratify`
still refuses a terminal-less run.

### `ratify` records what you did, and shows what the row cites

Found by an audit of what the CLI prints (2026-09-27). A sampled row you **skip** under `ratify --all`
now cancels the bloc, as a reject does: it was ratified en bloc under your name, and under `--decided`,
where there is no reject, the bloc could not be cancelled at all (**RWD-2026-0124**). The displayed
excerpt is centred on the cited `:LINE`, `#SYMBOL` or signature match instead of the file's first two
lines (**RWD-2026-0125**). The signature alarm reads every `file:` and `test:` pointer the gate reads,
and a row citing no file is flagged as unchecked rather than alarmed (**RWD-2026-0126**). The global
`--dry-run` is honoured: `ratify` says what it would write and writes nothing, where it used to record a
real BLIND ratification (**RWD-2026-0127**). An empty `--by` is refused with exit 2 (**RWD-2026-0128**).
### What the CLI prints around a red verdict no longer reads as green

Five surfaces told their reader the gate had passed while the same run said no; none moved an exit
code of `check`. A red run's "Next" line now names the gate that said no (`runward check --strict`,
`--hooks`, `--through`), where it used to propose the bare `runward check`, which came back green
(**RWD-2026-0129**). `status` computes the strict verdict before calling the delivery arc complete,
prints a "Strict gate" line, and `check` no longer sends its reader to `status` for gaps `status`
cannot see (**RWD-2026-0130**). "Current gate" reads `all deliverables filled (verdict: gaps)` instead
of `all gates passed` under a red verdict, in the terminal, `check --json` and the delivery report;
a clean run keeps its bytes (**RWD-2026-0131**). `verify` keeps exit 0 on an authentic attestation,
but an attested RED gate is said on the result line, and `verify --json` gains `attestedVerdict`
(additive) (**RWD-2026-0132**). A `proposed:applied` row's dead pointer is named in its own refusal,
before anyone is asked to ratify it, without adding a gap (**RWD-2026-0133**).
### The hook seams say what did not run, name what failed, and never block on their own configuration

Under `check --hooks`, a `runward/hooks.json` that does not parse ran no hook and the gate came out
green; it is now said, runs nothing, and counts as a failure. **RWD-2026-0134.** A missing file is now
said (`no hook ran`) instead of printing nothing, and a phase written as a string instead of a list is
refused instead of being run one character at a time (`✗ 5/6 failed`). **RWD-2026-0135.** Each failed
hook is named on its own line, and `--hooks --json` carries an additive `hooks` field with the file's
state and the failed commands. **RWD-2026-0136.** `gate-hook` with an unknown or missing `--harness`
exited 2, which Claude Code and Junie read as a block, before the re-entry guard was read: a typo
trapped the session on every turn. It now fails open, says so on stderr, and appends a line to
`runward/gate-bypass.log`. **RWD-2026-0137.** And `gate-hook` with no mission reachable still allows,
but says on stderr that the gate was not evaluated, instead of printing what a green prints.
**RWD-2026-0138.**
### Four commands no longer write what nobody asked them to

An audit of what the CLI prints found four commands writing past what the operator asked for.
`report -o` removed and replaced any file it was pointed at (a typo replaced `framing.md`), re-rooted
an absolute path and wrote outside the project: it now replaces only a previous delivery report,
refuses anything else without `--force`, and refuses a path outside the project or a directory
(**RWD-2026-0139**). `report` ignored the global `--dry-run`; it now writes and removes nothing and
says what it would write (**RWD-2026-0140**). `characterize --mine` on a governed mission wrote DRAFT
ADRs that turned a green `check --strict` red, under a help that said "read-only": it is now refused
there without `--force`, and the help and output say what is written (**RWD-2026-0141**). `propose` no
longer cites the untouched scaffolded `AGENTS.md` as evidence for the hand-over charter row
(**RWD-2026-0142**), and `init --example --force` keeps the reference's finalized charter instead of
writing the blank one over it (**RWD-2026-0143**).

### What an agent reads: the blank charter is not evidence, `--json` names the next step, `wire` names the armed tier

Found by an audit of what the CLI prints (2026-09-27). `check --strict` refuses an `applied` row whose
cited file is still byte-identical to what runward scaffolded: the blank `AGENTS.md` carried the
hand-over rule's signature by construction and crossed the gate as the finalized charter; the gate
and `propose` now share one list of scaffolded texts (**RWD-2026-0144**). `check --json` gains an
additive `next: { action, command, rerun, text }`, built by the same function as the terminal's Next
line, and `verify` re-derives `next.action` (**RWD-2026-0145**). The contract now says that
`gaps.proposed` and `gaps.unboundRows` are already inside `gaps.conformance` (help, payload, and a
"Reading `check --json`" section in `docs/interop.md`); no number changes (**RWD-2026-0146**).
`gate-hook --harness` accepts the ids `wire --json` prints (`claude-code`, `gemini-cli`), and
`wire --json` gains `gateHookId` (**RWD-2026-0147**). `wire` shows the armed tier
(`runward wire --install`, run by the operator in a terminal) beside the advisory sample, says the
sample never blocks, drops "runward wires nothing", and `wire --json` gains `armed` and
`tier: "advisory"` (**RWD-2026-0148**).

### What the CLI prints says what happens and what to do, once

Found by an audit of what the CLI prints (2026-09-27), lot 3: jargon, repetition, labels. Text only,
no exit code and no JSON field changes, except one sentence inside `conformance[].problem`. The armed
`gate-hook` refusal says each instruction once, after the rows it answers, and folds three rows or
more sharing a diagnosis into one line per deliverable naming every rule (a fresh mission's refusal
goes from 5 919 to 2 798 bytes and names all 46 rules instead of 15); Cursor's variant has one prefix
and a plain label; the release no longer claims the bypass log is already in the diff
(**RWD-2026-0158**). `check --strict` drops "evidence nature", "arming", "bound", "presence gate" and
"an agent-built mission should show zero", names runward's ADRs as `runward ADR-NNNN`, says the
regulated cause once, counts rows and rules apart, and prints a drifted seal as what happened rather
than as a rule named `(seal)`; `init --example` says its ◑ lines are disclosures (**RWD-2026-0159**).
`manifest` never puts a green tick beside a lack and counts the rows still undecided; `propose` says
its instruction once, in a summary by cause (**RWD-2026-0160**). `explain` prints the gate-wide limits
in one line, `rules` has a legend for `·signed`, and `ratify`, `status`, `characterize`, `doctor`,
`wire`, `report` and the help of `propose`, `ratify` and `gate-hook` lose their internal labels
(**RWD-2026-0161**). A dead typed pointer no longer says "remove the row", which only moved the
refusal to a missing row; the prefix `typed pointer does not resolve:` is kept, and a `--strict`
attestation made by 0.42.2 or earlier on a mission holding a dead pointer re-verifies only with the
version that produced it (**RWD-2026-0162**).

### `ratify --decided` no longer cries wolf on rows that cite no file

The signature alarm (the cited file does not carry the rule's signature) was raised on every signed
`n/a` or `deviated` row, which cite a reason or an ADR and no file: 10 of 18 rows in the maintainer's own
ratification printed it, and the mandatory sample grew accordingly. It is now raised on `applied` rows
only. **RWD-2026-0123.**

### runward's own mission is ratified, under the regulated tier

The maintainer ratified the 46 decided rows of this repository's own mission in a terminal, en bloc,
on a mandatory sample of 18 rows shown with their evidence (18 accepted), and the mission now declares
`"regulated": true`: a row rewritten from now on counts against the gate until it is ratified again.
The forge half of the tier does not apply to a single-maintainer project and is not simulated.
**ADR-0080.**

### runward's own mission, re-read before its ratification

Before the maintainer ratifies the 46 decided rows of this repository's own mission (ADR-0080), each
row was re-read against its evidence and the code. 21 rows had a pointer or a reason that was vague,
dated or false (the verdict path is network-free, the whole CLI is not; a credential list that omitted
two; an unsourced timing), and 12 had a decision to revisit. Three rows are now `deviated`, each with a
mission ADR: operator hooks run unsandboxed in a tree an agent can write (mission ADR-0003), and the
gate-hook refusal relays mission text into the agent's loop (mission ADR-0004, two rows). The threat
model, the runbook, the port map and the usage registry now name both paths; `AGENTS.md` gives the
repository the charter it claimed; mission ADR-0002 names the journal (this file) and stops the
deliverables from quoting an ADR count that aged.

### The security scan sees a spawn the way the code writes one, and the bench is no longer said to run in CI

The committed security scan cited `security/detect-child-process` = 0 as proof that no file spawns a
process outside the crossings ADR-0054 names. That rule only sees `require("child_process")`; every file
in `src/` imports `node:child_process`, and two that do passed it silently. The scan now refuses the ESM
import (static and dynamic) everywhere under `src/` except the three files it names, and a test plants
one in a temporary tree to prove the scan sees it. **RWD-2026-0121.** And ADR-0075 said
`test/bench-scale.js` measures the gate's cost in CI; no workflow runs it, and it asserts nothing.
ADR-0081 records it as a local instrument; the `loadtest` declaration is unchanged. **RWD-2026-0122.**

### The regulated tier, part 1: ratification bound to the row

A mission that declares `"regulated": true` in `runward/scaffold-lock.json` now counts, under
`check --strict`, every decided row whose ratification does not bind to the row as written: never
ratified, ratified BLIND, a trace with no content digest, or a row rewritten since. (The digest binds the
row's text, not the file it cites; that stays the seal's job.) `ratify` records the
digest of each row it ratifies (a `bound:` segment, additive), and `ratify --decided` ratifies rows
already decided by hand, which it could not before. `update` preserves the flag; `verify` re-derives the
count; the JSON, SARIF and attestation carry it only when the mission opted in, so every other mission's
output is unchanged. A BLIND ratification is now printed by `check`, with or without the tier. What this
proves is a record, not who made it; the approval by a second person is read on the forge (part 2, not
in this release). **ADR-0080.**

### `verify` agreed with `check` again, and a ratification trace says what it is

With contract hardening on (the default for new missions since ADR-0069), a broken workflow contract
made `check` exit 1 while the verdict every other consumer reads said clean: `verify` rejected an honest
attestation, and the readiness packs printed "clean (exit 0, 1 conformance gap)". The verdict is now
computed last. **RWD-2026-0120.** And the non-scope sentence that travels with every verdict said a
ratification trace "proves a human answered"; a trace typed by hand, or `ratify` driven by a script,
produces the same trace with no one at the keyboard. It now says the trace records that someone
declared answering, and that runward cannot tell who. **RWD-2026-0119.**

### A release keeps a signed summary of its mutation ratchet

Every release re-measures its whole mutation perimeter, and the evidence (about 250 MB) expired after
30 days, the logs after 90: nothing then showed a release had passed its ratchet. The ratchet now ends
with a job that writes a summary of a few kilobytes (per module, what it answered, the survivors
measured and filed, the SHA-256 of each merged report, the verdict, red or green alike) and signs it as
a GitHub artifact attestation. That job only reads artifacts; nothing in the ratchet gains write access
to the repository or the release. `docs/verifying-a-release.md`, step 6. **ADR-0079.**

## 0.42.2

### The lock can only bless what runward published

A patch release for one wrong verdict and four sentences larger than the tool, all found by the
adversarial pass that checked a report on what runward's target expects. Nothing changes for a mission
that never edited its rules; a mission that did now hears about it, even with its lock re-signed.

### A shipped rule made harmless, with its lock re-signed, no longer passes

A reviewer checking one sentence of a report ("the rule corpus is sealed against modification") found
it false. `frontier-deterministic-boundary` changed from CRITICAL to LOW, its line in
`scaffold-lock.json` rewritten in the same commit: `check --strict` exited 0, demanding 44
CRITICAL/HIGH rules instead of 45, and nothing said so. The lock was trusted to say which texts runward
wrote, and the lock lives in the repository it describes. The package now carries
`templates/rule-history.json`, every hash runward has published for each shipped rule, rebuilt from the
release tags; a lock line naming a text runward never published is refused as an edit. A mission one
release behind stays green. **RWD-2026-0117.**

### Four sentences said more than the tool does

`check`, `explain` and the delivery report said a missing evidence nature is "refused at the armed
tier"; it is refused nowhere yet, by decision (ADR-0073). The README said nothing in the tool shells
out; `characterize` and `doctor` run `git`, read-only. `gate-hook --help` printed a template literal
instead of the harness list. The GitHub Action ran an unpinned `latest` silently; it now says so on
every such run. **RWD-2026-0118.**

## 0.42.1

### The file an agent is about to edit, and the rules it answers to

`rules --for` is the question an agent asks before touching a file. In the example mission it answered
**0 rules** for the deterministic guard — the file the mission cites as evidence for four CRITICAL/HIGH
rules — and 0 for any new file in the domain core. Two changes, of two different natures: the mission's
own citations are now shown beside the territory answer, as a reminder; and the domain core becomes a
territory, for the one rule whose text prescribes it. Neither touches the gate.

### `rules --for` shows what the mission already cited

`runward rules --for code/src/core/domain/guard.ts` answered **0 rules** in the example mission, although
the mission cites that file as evidence for four CRITICAL/HIGH rules: each of them declared, in writing,
that it has no file territory, and `--for` matches on territory only. It now lists those rules in a
separate section, **Already cited as evidence by this mission**, with the manifest and line that cite the
file, and says when that evidence no longer resolves (a moved file, a renamed symbol). It is a reminder,
never a match: it is counted nowhere, and its caveat says a new file is never cited. `--json` gains the
additive `citedByMission` field. **ADR-0077** records the decision, the field measurement behind it, and
the question it leaves open.

Found before release, by the tests written to instruct the new module's mutation survivors: the gate
resolves evidence to canonical paths, so a project reached through a symlink (macOS `/var` is
`/private/var`) put every cited file outside itself, and the section stayed **silently empty**. The CLI
escaped it only because its working directory is already canonical. Fixed, and pinned by a test that
builds the symlink, since a Linux runner has none to find.

### The domain core is a territory category

A new file in a mission's domain core surfaced no rule at all, and a citation can never reach it: nobody
has cited a file that does not exist yet. The territory vocabulary gains **`domain-core`**, and
`hexa-architecture` — whose text prescribes the core by name — now governs it instead of declaring it has
no territory. That declaration objected to globs, and was written hours before categories existed; the
six other rules that mention the core keep theirs. A mission binds its core in `runward/territory.md`;
the example mission now carries that map. **ADR-0078** records the reading.

### Candidate organisations are not named in public

The pilot protocol's candidate list and ADR-0052 named organisations that had agreed to nothing. The
names are removed; the pre-registered questions, measures and failure criterion are unchanged. They were also removed from the history: every commit and tag from 2026-08-12 onward was rewritten,
which changes the commit that the provenance of releases 0.34.0 to 0.42.0 names. What changed, the
before/after table, and how to check that no shipped package changed are in
`docs/compliance/history-rewrite-2026-09-24.md`, declared as **RWD-2026-0116**.

## 0.42.0

### What the instruments said that the announcements did not

Three instruments, three findings no announcement contained. Stryker 10 shipped one new mutator and it
found six holes the unit suite never needed to close — one of them, drift, was the very hole ADR-0021
made blocking. NIST called OSCAL 1.2.3 a tooling patch, and the schema diff found a widening. And the
watch that exists to notice the world moving had itself never worked on one of its three checks: it
reported "could not reach" every Monday, and opened a new issue each time instead of refreshing its own.

The one change a user of `runward compliance` sees is the first: the pack now declares OSCAL 1.2.3.

### The external-facts watch works end to end

The ADR-0032 watch, measured before being fixed. It found its tracking issue with a GitHub search that
returns nothing for that title, so it opened **eight identical issues** instead of refreshing one. It
flagged a superseded regime lens every week, although the product never reads it. And it could not read
EUR-Lex at all: EUR-Lex answers any non-browser client with a WAF challenge and an empty body. It now
matches its issue exactly and closes duplicates, applies the product's own rule for which lens is live,
reads the same CELEX identifiers from the EU Publications Office SPARQL endpoint, and **closes its issue
itself** once nothing drifts, citing the run that proves it.

### OSCAL 1.2.3: the notes said tooling, the schema said otherwise

The external-facts watch reported NIST's OSCAL **1.2.3** (2026-08-07) against runward's pinned
1.2.2. The release notes describe build tooling only. The schema was diffed anyway, and it moved:
the component `type` enumeration gains `region`, `zone`, `resource-container` and `network`. It is
a pure widening — nothing removed or tightened — so the bump is safe, and **ADR-0076** records the
measurement rather than the announcement.

- `OSCAL_VERSION` → `1.2.3`, the vendored schema replaced (sha256 `95e76881…`), the golden
  regenerated: **one line changes**, the declared version; no UUID moves.
- The pack validates against **both** the 1.2.3 and the 1.2.2 schemas, and IBM compliance-trestle
  4.2.0 (the CI's ingester) loads it. The ingest script still refuses a wrong version, measured.
- The published mapping spec moves from **1.0 to 1.1**, as its own rule requires ("additive within
  1.x"): its normative example changed by that one field. `CITATION.cff` follows.

### Stryker 10 measures one thing more, and it found six holes

**The instrument moved before the tree did.** Bumping `@stryker-mutator/core` from 9.6.1 to 10.0.0
(Babel 8, Node 22) brings one new mutator, `CallExpression`, which deletes a call statement outright.
It is absent from the 1,694 filed verdicts, so the whole perimeter was re-measured before the bump was
merged: **20 modules, 6 new survivors, all six from the new mutator**. None is a rename and none is
equivalent; each is a statement the unit suite never needed.

Each was applied to the build and the difference read before a test was written; each test is measured
red with its mutant and green without it:

- **Drift never reached the joined verdict** (`judgeGated`). `driftReport` has unit tests and the smoke
  suite drives it through `check --strict`, but nothing in the suite Stryker runs asserted that the
  verdict *joins* it. With `violations.push(...driftReport(…))` gone, an applied row citing a bare path
  to a file that no longer exists left the gate green — the hole ADR-0021 made blocking. The recipe was
  already filed under `PATH_TOKEN`; it is now a unit test on the shipped example.
- **An edit was not a ratification** (`applyDecisions`). The edit branch wrote the operator's status and
  evidence, but dropping its `acceptedRules.push` left the Ratification entry without the row, so
  `ratificationLedger` counted a decided row as *untraced* — the disclosure counter ADR-0066 reserves
  for rows nobody ratified, on a row the operator had just ratified by hand.
- **A finding without its rule, twice** (`buildSarif`). The strict-term results and the
  deliverable-not-filled result still reached the log with `ruleIds.add` deleted; their entry in
  `tool.driver.rules` did not, and that entry is where the non-scope caveat travels. Every result's
  rule is now asserted declared, and every declared rule asserted to carry the caveat.
- **A bare path was not read for a signature** (`evidenceReport`). Prose citing `guard.ts` is banked
  like `file:guard.ts` and a signed rule is satisfied or refused on what that file holds; without the
  bank, the row citing the *right* file read "point the applied evidence at a file".
- **A nested acceptance heading counted twice** (`specConformance`). `## Acceptance criteria` scans past
  a deeper `### Acceptance criteria (edge cases)`, which is also an acceptance heading with its own scan;
  the `seen` set is what keeps three criteria from reading "4 criterion(s)". The existing assertions
  said `>= 2`, which is why the suite could not tell.

**And the six tests killed seven more.** Re-running the ratchet in `gate` mode on the five modules
touched turned up seven filings the register carried and the tree no longer produces — all seven
*killed* by the new tests rather than gone from the code, which is the only direction this instrument
is allowed to move on its own:

- `specConformance` — the exact filing that described the nested-heading double count (`seen.has(i)`
  → `false`): a documented hole, now closed by the test written for its `CallExpression` neighbour.
- `buildSarif` ×5 — the whole `shortDescription` expression (`{}`), its condition (`false`, `!==`),
  and both of its strings (`""`). Asserting the rule's text, not merely its presence, kills the lot.
  The one string on that line that still survives — `"runward/"` in `id.slice("runward/".length)` —
  stays filed, which is what tells us the removal was derived from the measurement rather than typed.
- `applyDecisions` — the empty string in the proposer ternary: the ledger line is now matched whole,
  anchored, so anything injected between its segments reddens.

The register goes from 1,694 filed verdicts to **1,687**, and the ratchet passes on all five modules
(evidence 350, sarif 70, spec-conformance 38, verdict 33, ratify 24 — every one filed). Six tests,
one new file, and the committed JUnit report regenerated to describe the tree (1,089 cases).

## 0.41.0

### The gate stops charging for honesty

Five defects this line fixes share one shape: a surface that made the *truthful* spelling the more
expensive one. A sentence that mentioned `npm run test:junit` manufactured a pointer and reddened an
honest row. A refusal echoed a pointer truncated at the first space, so the operator was shown
something nobody wrote. A real, accepted, on-point decision was reported as absent because the gate
read one directory and the mission's journal lived in another. A committed report vouched for a test
that no longer existed. And renaming a heading turned the machine's own table back into the operator's
work. None of them was a spectacular failure; all of them taxed the person doing the right thing.

What is new, rather than merely fixed: **runward now runs a linter that refuses its own architectural
boundary**, and it commits **two security scans whose sensitivity is proved in the same run** — the
secrets step plants three fake credentials and will not write a clean report unless the scanner sees
all three. Evidence natures runward's own mission could not carry went from **eleven to one**, and the
one that remains is *declared*, with its reason in the journal, rather than left as a gap.


### The mutation register describes the tree again, and one claim is corrected

**The v0.40.0 closing loop.** The ratchet named 84 unfiled survivors and 39 dead filings across
`evidence`, `conformance` and `verdict` — the three modules this wave touched most. After the join:
**28 are renames** (`parseEvidencePointers` → `parseEvidenceCell`, `adrFilename` → `locateAdr`, a scan
that moved from `readManifest` into `manifestSections`), **11 are genuinely dead**, and **56 are
genuinely new**.

Of those 56: **21 change observable behaviour and are now KILLED** by eight tests written after applying
each mutant and reading the difference; **35 are measured equivalent** and filed with their measurement.
One real defect fell out of the qualification: the seal was freezing the **first** ADR in the journal
instead of the one the row cites — invisible for as long as there was only one.

**What this pass mostly taught was about the instrument.** The behaviour probe was wrong six times
before it was right, and its failure mode was always the same: answering *equivalent*. Branches never
reached; messages cut at 200 characters; a kill detector looking for TAP lines Node does not emit; an
applier mutating the first occurrence it found, then the wrong occurrence on a shared line; a serialised
verdict truncated at 4000 characters, hiding exactly the field the last mutant lived in. Every fix
surfaced behaviour-changing mutants that would otherwise have been filed as equivalent.

Two instruments corrected that, and they are why these 35 filings are defensible. **Line-level coverage
of the probe**: all 56 survivors sit on a line the probe executes, measured with `NODE_V8_COVERAGE` and
the innermost range (the first version marked 1540 of 1540 lines and measured nothing). And a
**per-function sensitivity control**: for the six functions where no measured mutant changed anything —
including `declaredUncarriableNatures` and its 13 survivors — a deliberate change was applied and the
probe saw it. Without those, *"the probe sees no difference"* would not have separated an equivalence
from a blindness, which is the distinction this project refuses to blur elsewhere and does not get to
blur for itself.

**Correction.** PR #269 stated that the `conformance` module came back green in the targeted measurement
of 2026-09-12. That claim rested on the run's conclusion — which, in `measure` mode, is success whatever
the verdict — and on a log reader whose default branch was "OK". That run no longer serves its step logs,
so the verdict is unrecoverable and will not be restored. The authoritative measurement is the
whole-perimeter one, where `conformance` was in MISMATCH.

### The hexagon refuses, and a committed report has to be current

**ADR-0075 part 1, ratified 2026-09-12.** `hexa-architecture` and `hexa-adapter-pattern` are HIGH rules
of runward's own manifest and both carry `requires: eslint`, because an architecture rule states a
boundary and a boundary is provable by a lint rule that refuses the forbidden import — not by a sentence
saying the boundary holds. Both were `applied` **with prose**, which is the precise shape of the thing
this product sells against. And the repository had no linter at all while `src/lib/styles.ts` carried an
`eslint-disable` directive addressed to one: it believed it was linted.

`eslint.config.js` now encodes ONE boundary, the one that IS the claim: `src/lib/**` is the pure library,
`src/commands/**` are its adapters, and the dependency runs one way. `scripts/eslint-committable.mjs`
emits `reports/eslint.json` the way the JUnit report is emitted — absolute paths relativised, entries
sorted, exiting with the TOOL's status — and the four rows cite it. Measured: a deliberate
cross-boundary import reddens the rule, exits 1, and reads `findings` through the product's own adapter,
while a clean file reads `clean` and an unlisted one reads `absent`. **The guard was measured red before
it was allowed to pass a clean tree.**

What is deliberately NOT encoded: "no adapter imports another adapter". `src/commands/init.ts` imports
`checkCommand` because init runs a check when it finishes — composition, deliberate and honest. A rule
refusing it would redden a correct design, which is how a team learns to pass `--no-verify`.

**RWD-2026-0113, found while wiring the second committed report.** The gate reads a committed report and
never runs the tool (ADR-0054, correct). Nothing proved the report still described the tree. Measured in
both directions: `reports/junit.xml` was ALREADY stale, missing the 12 cases two PRs had merged the same
day; and renaming a cited case out of the suite left `runward check --strict` at **exit 0** — green on a
test that no longer exists. A false green reached through paperwork, on the product's own mission, which
is the one thing ADR-0045 exists to refuse.

The fix keeps the boundary: **the gate reads, CI proves currency.** `scripts/reports-fresh.mjs`
regenerates both reports and refuses on any difference, naming every case that disappeared, appeared or
changed verdict. Semantic for JUnit and byte-exact for ESLint, because `node --test` emits cases in
completion order and a byte gate there would flap on core count — a gate that flaps is a gate that gets
disabled. Verdicts are read with the product's own `junitTestResult`, never a second implementation.

Its own first CI run taught it one more distinction, which is the best argument for shipping a guard
rather than reasoning about one. Four case-folding cases carry `{ skip: CASE_INSENSITIVE ? false : … }`:
they run and pass on macOS and are `<skipped>` on Linux, deliberately. So the guard separates a case that
turned **failing** — staleness the report hides, and a gate failure — from a case that turned **skipped**,
which is the platform speaking and is disclosed rather than judged. Both branches measured: a control
skip discloses at exit 0, a control failure names the case and exits 1. And a Windows leg caught the
other half of the same lesson: `new URL(import.meta.url).pathname` yields `/C:/…` there, so the four new
guards resolved nothing — fixed with `import.meta.dirname`.

Measured: **7 unmet natures → 3** (only ADR-0075's `sarif` ×2 and `loadtest` ×1 remain). Two moderate
advisories in the tree predate the linter; `npm audit --audit-level=high` stays green.

### A decision the gate could not see

**ADR-0074, option 3, ratified 2026-09-12.** An `adr:` pointer resolved against `<mission>/adr/` and
nowhere else, so a project whose decision journal lives where the ecosystem keeps it — `docs/adr/`
(MADR), `doc/adr/` (adr-tools) — could not satisfy a rule requiring the `adr:` nature by citing the
decision that settles it. On runward's own mission that meant `adr:0011`, `adr:0017` and `adr:0054` all
answered *no matching ADR in runward/adr/* while being the accepted, on-point decisions the three
`topology-*` rules require — and the mission's own ADR-0001 is titled *"the decision journal lives in
docs/adr"*. The mission declared where its journal was and the gate did not read the declaration
(RWD-2026-0112).

`adr:` now resolves against `<mission>/adr/` first, then `docs/adr/`, `doc/adr/`, `adr/`. Mission-first
is precedence, not a merge: a mission ADR still wins over a same-numbered one further out, which is
what keeps `adr:0001` on runward pointing at the bridge decision. `Status` is still read, so a
template, an empty file, a `proposed` or a `superseded` decision is refused in the new locations
exactly as in the old one — measured, because resolving more must not judge less. And a refusal now
names every directory it looked in, separating *no decision journal* from *this journal does not hold
it*.

One trap was live in the change itself and is guarded: the seal joined `<mission>/adr/` by hand, so
resolving an ADR further out while leaving that join would have left `✓ seal intact` over a decision
the lock never covered — reopening the exact hole the seal's ADR loop was added to close.

Measured: **11 unmet natures → 7** on runward's own mission, the shipped example byte-unchanged at 17,
suite 1064/1064, self-gate and example gate `exit 0`. The four rows that left did so by citing
decisions that actually decide them — including `process-adr-and-journal`, whose cell also claimed 32
accepted product ADRs when there are 73.

**ADR-0075 ratified the same day** — install the linter and mechanise the hexagon, commit a scan whose
subject IS the rule, and declare the limit a CLI cannot cross. The seven remaining unmet natures are
exactly its three families; the implementation follows, each part with the positive controls its
"what would settle it" names.

### Prose is free again, and a refusal quotes what was written

Two defects filed against 0.40.0 while writing an honest sentence, both in the pointer tokeniser,
both fixed here and both measured red against the published binary first.

- **RWD-2026-0110** — an ordinary sentence carrying a `file:`/`test:`/`adr:` spelling manufactured a
  pointer nobody wrote, and the gate then refused an honest row: `✗ typed pointer does not resolve:
  test:junit`, on a cell whose only sin was explaining that a report comes from `npm run test:junit`.
  It failed safe — red, never a false green — but it made prose more expensive than silence, which is
  the one thing ADR-0072 ratified against.

  Position looked like the fix and was wrong twice, both times caught by re-parsing the 92 shipped
  manifest rows rather than by reasoning about them. *A pointer run starts its segment* changed 14
  readings and took three rows' only pointer, because the idiomatic cell in this repository states
  the judgment first and cites last. *A pointer touches an edge of its segment* still took two,
  because this repository also cites mid-sentence, in parentheses and as a sentence's subject. What
  separates a citation from a mention is not where it sits but what it names: every pointer in the
  corpus names a path, every phantom is a bare word. The grammar now asks that, from the cell alone —
  no filesystem, no position, so a cell parses the same way in every checkout. Re-measured after the
  fix: **0 of 92 rows changed what they point at, 0 newly disclosed.**

  The boundary is declared rather than discovered: an extension-less path at a repository root
  (`file:Makefile`) cannot be told from a bare word either, so it reads as prose too — and
  `file:./Makefile` is the spelling that works. Nothing is dropped in silence: `check --strict` names
  every spelling it read as prose, and `--json` carries them under `prosePointers`.

  One guard changed hands in the process. The unedited template cell `[file:line, a test, ADR-id, or
  a reason]` under a real rule slug used to be refused *because* `file:line` failed to resolve — a
  real guard with the wrong name, telling the operator about a pointer that was never written. It
  would have vanished with this fix, so it is explicit now and says what it caught.

- **RWD-2026-0111** — a refusal echoed the pointer it read truncated at the first space, so a row
  citing `test:reports/junit.xml::"guard: a fabricated reference never routes"` — the documented form
  for a name with spaces — was shown a pointer nobody wrote, looking malformed, beside a sentence
  saying it was not. Cosmetic, and it cost exactly what this product sells: a refusal the operator
  can trust literally. The `file:` branch had already been repaired for this reason and the `test:`
  branch had not. An unquoted name now echoes back quoted, so what is printed is a form that can be
  pasted.

## 0.40.0

### What a stranger receives, and what a report is about

Five self-directed axes were measured on 2026-09-11 — runward pointed at a foreign repository,
the delivery report read blind, the report against ISO 42001 and Annex IV, the pilot protocol
dry-run, the successor kit — and the axis nobody had ever opened turned out to be the most
consequential: **the package as a consumer receives it.** 196 files, zero under `docs/`, while the
shipped CLI sent its user to five of them.

- **ADR-0070**: the package is the product. Every pointer the CLI prints resolves for someone who
  has only the package, nothing shipped contradicts the package, and the boundary is tested AT the
  boundary — the guard reads `npm pack`, not the repository. Fixes RWD-2026-0108 (the two shipped CI
  adapters pinned Node 20 against `engines >=22.12.0`; the floor is derived from `engines` now) and
  RWD-2026-0109 (dead documentary pointers, README links included).
- **RWD-2026-0107, a false green that was ours**: `manifest --sync` alone crossed a deliverable —
  13 deliverable gaps to 12, `untouched` to `✓ filled`, with no human line written, and the
  assessor's report carried it. The machine's own conformance section is now excluded from the
  divergence comparison; what counts is the prose around it.
- **ADR-0071 (option 2)**: the delivery report names its subject by a digest taken before the write
  and SAID to be, with the re-derivation spelled out — printed and attested digests measured
  identical. The absolute path is gone: it named the generating machine and said nothing about the
  object judged.
- **ADR-0073 (option 1)**: a committed report is how evidence of a required nature reaches a gate
  that never runs your tools. The example ships the step that makes a JUnit report committable
  (absolute path, timings and wall clock removed; verdicts untouched; exits with the tests' own
  status), one floor row cites a real test case, and **runward now satisfies its own junit
  requirement** — unmet natures on its mission go 17 to 11, junit to zero. What remains is stated
  plainly: 4 eslint and 2 sarif rows are a missing TOOL, not a missing pointer.
- **ADR-0072**: an unknown is surfaced, never refused. Two axes proposed to refuse `UNKNOWN`
  contacts; the register already says twice what that does — it makes inventing a name cheaper than
  admitting ignorance.
- **ADR-0069**: new missions are born with the structure contract armed (`update` preserves the
  flag, and wiring that fixed RWD-2026-0106, where a refresh silently disarmed an opted-in mission).
- **`explain` teaches the nature it demands**, with its tier and a citable form per nature — the step
  ADR-0065's arming order puts before refusing.

Also filed and visible: RWD-2026-0110 (prose containing `test:`, `adr:` or `file:` becomes a phantom
pointer and reddens an honest cell — not fixed here, the tokeniser sits in the verdict path and gets
its own change) and RWD-2026-0111 (a refusal echoes a quoted pointer truncated at the first space).

## 0.39.0

### The verdict gets its reader (ADR-0064, ratified)

`runward report` writes ONE self-contained HTML an assessor opens without a terminal, an account
or runward installed: where the mission stands, what is proven and by what, what is deferred,
what the gate does not cover (verbatim), and how to re-derive everything alone. It renders the
same machine payload `check --strict --json` publishes and computes nothing — byte-identical
across runs on one tree, no script, no external asset. Default output:
`runward/governance/delivery-report.html`. Also: ADR-0068 and ADR-0069 ratified (dated support
table, structure contract default for new missions), the requires: arbitration settled (13 posed,
the `loadtest` nature created, `requires: file` retired), and the CLI palette moves to the house
mineral gold.

## 0.38.0

### The consolidated mutation pass (the wave settles its debt)

Every module the 2026-09 wave touched was re-measured, and the four new libs (ratify,
workflow-contract, gate-hook, wire-install) entered the measured perimeter. The numbers, all
derived from committed artifacts: ~1,050 fresh surviving mutants measured after the wave; a
family-test block (985 → 1,036 tests) killed the reachable ones — gate-hook 36→4,
check-contract 35→2, ratify 60→25, verify-findings 6→1 among others; a 1,337-trial whole-net
pass caught 29 more; the 855 that remained were each QUALIFIED individually (applied at exact
offset, replayed on three probe missions, machine payload and rendered text compared byte-for-
byte) and filed with their measurement: 823 hole (37 of them with an exact observable recipe),
16 display-only, and 8 previously-filed survivors REMOVED because the new net now kills them.
`docs/compliance/mutation-register.md` describes the tree again on all 20 modules.

The pass also found and fixed a product defect: RWD-2026-0105 — the structure contract's named
detail (`field "Date" reads "not-a-date" and must be an ISO date`) was computed and read by
nobody, while `check` rendered a false "placeholders remain" for every structure cause.

### The wire contract moves to v2 (ADR-0065)

`runward wire --json` publishes `schemaVersion: 2`: the `wires` field moves from the literal
`false` ("this command never writes") to the policy string `"explicit-install-only"` — detection
still writes nothing, and the new `wire --install` is the one writing gesture: TTY-only, refused
under any agent runtime signal (no flag lifts the lock), file shown in full before a y/N that
defaults to N, atomic write with a read-back probe and announced rollback, every gesture journaled
in `runward/adapters/installed.log`. `wire --uninstall` is the symmetric removal under the same
locks. Consumers reading v1's `wires: false` as a boolean should read the string as "still not
without you".

## 0.37.1

### A machine surface that reordered itself

`check --json` published `corpus.missing` in the order the filesystem returned, not in name order:
`corpusDivergence` sorted its mission-side listing and not its package-side one. A directory reader
walks UTF-8 bytes while `Array#sort` compares UTF-16 code units, and the two disagree above the BMP —
measured on a package holding `\u{1F600}-rule.md` and `\uFFFD-rule.md`, where the reader returned
the second first and the published list followed it. Below the BMP the two orders coincide on APFS
and diverge on ext4, so the same tree published a different document depending on which runner read
it. No verdict, exit code or set membership moves; what moved was a document nobody could compare
across runs, in a project that holds every other emission to determinism. Filed RWD-2026-0091 and
guarded by a fixture whose two rule names separate the two orderings.

`OptionFault` also loses its `flags` field. It named the refused flag combination a second time in a
shorter form, and nothing ever read it — the call site prints `message` and exits 2. The mutation
campaign is what said so out loud: three of this module's four surviving mutants sat on those three
strings, each filed `equivalent`, and they were equivalent for the reason that matters — no test
could distinguish them because no code path could. The three misuse paths still exit 2 with their
sentence, which already names the flags in prose.

### What backs a claim, and how you can tell

Nothing user-facing changed here, but the trust artifacts published with this release say more about
themselves than they did.

The **mutation survivor register** now discloses, per module, which whole net its filings were
measured against. A row filed `hole` asserts that nothing catches the mutant — in the unit suite AND
in the whole net of seven legs — and that second half is a claim about a set of files. Extending one
leg makes every such claim a statement about a net that no longer exists, silently, because nothing
recorded which net a filing had been measured against. The net now has an identity and a pass
records it; the register prints it and says plainly when it has moved. Disclosed, not refused
(ADR-0060) — and the first thing it discloses is that fourteen of fifteen modules have never had
that second pass run at all.

**ADR-0063** is ratified on a measurement rather than an argument: a SARIF finding whose whole
content is that an artifact is ABSENT anchors to the path it names. Uploaded to GitHub code scanning
on a throwaway ref, such a result comes back CREATED and `open`, with the same fields as one whose
path exists, and the upload is accepted with no error and no warning. What a reader loses is the
rendered snippet, not the alert — a smaller cost than moving the annotation onto a file that is
correct.

### The measurement behind the two fixes

Both defects were found by instructing mutation survivors, which reached the whole perimeter for the
first time in this cycle: sixteen modules, every survivor carrying a verdict argued from a
measurement. The register stands at 854 survivors across fifteen modules — the sixteenth carries
none, because a net built from its own campaign killed all seventeen of them.


## 0.37.0

### Every defect says what found it

Each of the register's entries now carries a `found-by` field from a closed vocabulary, guarded by
test and back-filled from headings and first-hand knowledge; two entries say `not-recorded` because
nobody wrote it down and guessing would be the fabrication the register exists to refuse. Read
across all 87 the mix is 59 adversarial-audit, 14 mutation-instruction, 4 while-reproducing,
3 declared, 2 existing-guard, 2 not-recorded, 1 ci-os-leg, 1 conformance-corpus, 1 measurement —
and the derivation, with three worked examples and the answer to "we already do code review", is
[what-found-them.md](docs/compliance/what-found-them.md). The header mix is recomputed from the
rows, never edited by hand.

The author now submits to the constraint the tool sells: the repository's own Stop hook runs
`node dist/cli.js check --strict` from the tree's build, and the only bypass appends to a
committed log.

### `compliance` instructed: 300 verdicts, re-measured to 289

The module entered the mutation perimeter with 300 surviving mutants and a ratchet that REFUSED
("never instructed"). A seven-agent fleet filed every one — each hole with a mission recipe that
was RUN, each equivalence with a sensitivity control, zero contention — and the whole net replayed
all 300: seven died against a leg (six smoke, one audit-corpus), six of which the instruction had
already filed defence-in-depth with the right leg named. One verdict was reclassed, which is the
argument for running the net rather than reasoning about it (ADR-0046 decision 3).

What the concentration taught: the module's only byte-for-byte guard renders `eu-ai-act`, pins the
OSCAL JSON and never the markdown, on a fresh mission whose gate is red — so nothing walked
`clean`, `implemented`, the prose depth, or a single byte of the three readiness drafts. The
instruction found the one-mutant reintroductions of RWD-2026-0058 (prose `implemented`) and
RWD-2026-0061 (two vocabularies for one fact) before any of them could ship.

After the fixes below changed three source lines, the tree was re-measured (8 CI chunks), the
predicted MISMATCH read exactly 1 new survivor and 12 orphan keys — three of them filed holes
retired by the new guards themselves — and the register is fresh again: 289 survivors, every one
filed, 557 across both modules.

### Fixed — two shipped defects the instruction surfaced

- **A Windows checkout reported zero agentic-risk coverage** (RWD-2026-0083). `compliance.ts` kept
  the pre-RWD-2026-0016 frontmatter delimiter while `rules.ts` and `conformance.ts` were fixed, and
  the constant is named `FRONTMATTER` in all three. Measured on a CRLF-rewritten corpus: `runward
  rules --json` reads 10/10 ASI categories, the pack writes 0/10 — same tree, same pass, exit 0.
  Invisible here because this repository's own `.gitattributes` pins every checkout to LF: the fix
  that made the project's measurements honest is what hid the defect from them. The guard compiles
  and runs every `FRONTMATTER` delimiter found in `src/lib` against a CRLF document, so a copy of
  the old pattern under a new name still fails.
- **One ADR status line, four readers, four spellings** (RWD-2026-0084). On `**Status** : accepted`
  — the space French typography requires — the pack printed `accepted` while the same run counted
  the decision not ratified, the ADR-0033 reopening watch skipped it, and a draft rejected with
  that spelling would have been resurrected against ADR-0038. All four readers now go through one
  exported `adrStatusLine` in `mission.ts`, and a recurrence guard asserts no other module in
  `src/lib` spells the pattern at all.

### The trust apparatus records its own defects

Three defects in the measurement layer itself, found the day the second module landed, filed per
the RWD-2026-0060 precedent (RWD-2026-0085..0087): the register generator hard-coded
`## Module: evidence` and filed 300 compliance survivors under the wrong module — the module is now
read off each verdict's stable key, one section per module; the key-shape guard split on the wrong
separator character, compared 1 to 1 and could not fail — pointed at the real `SEP` it failed at
once, for the second reason that its statement was also wrong; and the register test's heading
regex could not parse `(top level)`, so top-level rows were appended to the previous function.
None of the three ever put a false byte in a committed artifact, and the register now says so
with the same evidence discipline it applies to the product.

### The runtime answer, stated as product

`docs/positioning.md` gains the sibling of its release-stage section: runward's runtime product is
**a verification contract, not a process** — the attestation at delivery (ADR-0055 layers 1–5),
any policy engine verifying it at admission (the Kyverno reference, layer 6), the operator-wired
harness hooks in session (ADR-0039) — and the five ADR-0054 boundary crossings stated as a
buyer-facing guarantee rather than a roadmap gap. Nothing new is decided; the page that has the
charge assembles three ratified decisions into one answer.

### The register describes the tree again — and the instruction found three more things

The 2026-08-26 fixes added 148 lines to `evidence.ts`, and the CI ratchet came back MISMATCH with
**75 survivors the register did not carry**. A three-agent fleet instructed all of them in isolated
worktrees: **32 holes, 35 equivalents, 7 defence-in-depth, 1 display-only**, each hole carrying a
mission recipe that was RUN, each equivalence carrying a sensitivity control. The register is
regenerated at 268 survivors across 22 functions (164 hole, 69 equivalent, 26 display-only,
9 defence-in-depth) and the ratchet is green.

The brief carried a new rule, and it held: these survivors were measured on an idle CI runner, so a
local "killed" contradicting that is CONTENTION, not a finding. No agent reported one.

Three things the instruction found that the classification was not looking for:

- **RWD-2026-0082** — an ESCAPED parenthesis (`sand\(box`) was refused as a catastrophic group by
  yesterday's own fix. A false red on correct work, quiet because a balanced pair happens to reduce.
- **The two nets added this week were in NEITHER pass of the mutation harness**, so every mutant they
  catch was reported as surviving. `test/spelling-conformance.js` and `test/sarif-shape.js` join the
  whole net.
- **runward had no macOS leg**, so the two Unicode-folding cases of the ADR-0061 corpus — the ones
  covering RWD-2026-0031 and RWD-2026-0035 — were skipped on every runner the project used. ext4 is
  case-sensitive and NTFS does not fold the sharp s. A `macos-latest` leg now runs the corpus and the
  self-gate. The corpus surfaced this by NAMING its skips, which is what it was built to do.

And one worth recording without an entry: **RWD-2026-0070, the symlink seal, shipped with no test of
its own** — which is why eleven of its mutants survive, and why an agent could name the gap in a
sentence.

### The SARIF is held to the official schema (ADR-0062)

`test/fixtures/sarif_schema.v2.1.0.json` — the OASIS SARIF 2.1.0 schema, vendored offline with its
provenance and sha256 like the OSCAL and in-toto ones — now validates all four mission states.

It needed `ajv-draft-04` (the schema is draft-04; ajv 8 dropped it), which was left as an operator
decision on 2026-08-26 rather than taken silently. Taken now, and the reason is checkable: the
package comes from the same `ajv-validator` organisation as `ajv` and `ajv-formats`, **both already
dev dependencies here**, is dev-only, and was verified to DETECT before being adopted — a wrong
`version`, a missing `runs` and a `level` outside the enumeration are each refused. The structural
checks stay: a schema cannot say that a uri resolves in the checkout, and every uri of
RWD-2026-0041 was schema-valid.

### The spelling brick gets a specification (ADR-0061)

`test/fixtures/spelling-corpus.json` + `test/spelling-conformance.js`: twelve cases, each a triple of
pointer-as-written / layout-on-disk / expected verdict, each citing the defect it was learned from
(fourteen of them belong to this one brick). The harness probes the host filesystem, runs what
applies, and **names what it skipped and why** — ADR-0046's amendment was paid for by a measurement
that was a property of code AND filesystem while claiming to be a property of code.

The harness itself failed its first `windows-latest` run — a dynamic `import()` of a bare `C:\...`
path is read as the URL scheme `c:` — which is the right place for a corpus that claims to be the
portable artifact to be corrected.

- **RWD-2026-0081** — found on the corpus's FIRST run: the walk bound added the previous day was
  passed in the canonical namespace while the walked path is logical, so on macOS (`/var` →
  `/private/var`) it never engaged and the false red it closed was alive again. The verification that
  had accepted that fix used a path where the two namespaces coincide, so it could not have shown it.

### A vacuous green is disclosed, not refused (ADR-0060)

- **RWD-2026-0079** — a mission with no code returned exit 0, `clean`, and `100%` coverage while the
  honest example reads 87%. It stays green (ADR-0054 makes this a documentary gate) and the run now
  SAYS it: `evidenceFiles: {total, external}` is counted, disclosed in the pass, and carried in the
  ADR-0030 contract. The precedent followed is ISA 705's disclaimer of opinion, not pytest's exit 5.
- **RWD-2026-0080** — `verify` compared predicates through `JSON.stringify`, making key order
  load-bearing: an honest attestation with identical contents reported `differing: ["evidence"]`.
  Object keys are canonicalised now; arrays keep their order, where order is meaning.

### The boundary's own paperwork (2026-08-26 audit, tier 5)

- **RWD-2026-0075** — "same working tree, same verdict" omitted the installed runward version, which
  is a real second input by design. Measured: one rule added to the installed corpus flips an
  untouched mission from exit 0 to exit 1. Four documents now say the tree AND the version.
- **RWD-2026-0076** — two of ADR-0054's five crossings had no test, and one test proved crossing 5
  under crossing 3's name. Both gaps are closed, each guard with its own positive control.
- **RWD-2026-0077** — the boundary test called `--hooks` "outside computeVerdict"; `hookFailed` is an
  argument to it. The real mitigations are written down instead of implied, along with the closure's
  package-boundary limit.
- **RWD-2026-0078** — `--corpus @acme/rules@1.2.3` fell to a generic "path not found" because the
  guard's shape stopped at the second `@`, so the sentence explaining the boundary reached only
  someone who had already dropped the version.

### The runtime boundary, and the instrument that guarded it (2026-08-26 audit, tier 5)

- **RWD-2026-0073** — the ADR-0054 boundary test was blind on the path that owns the exit code. Four
  of five planted mutations left all four tests green, including a dynamic import — verbatim the
  reevaluation trigger ADR-0054 wrote for itself, already met when it was written. The boundary did
  not move; the instrument now walks a second, wider ring from `check.js` with exactly one
  enumerated crossing allowed. ADR-0054 carries the amendment and the measurement table.
- **RWD-2026-0074** — `chmod 0111` on the project's PARENT turned an unchanged tree from exit 0 into
  exit 1 with 21 pointers refused, each pointing the operator at a path outside their project. The
  case walk is now bounded to the project root.

Two more findings from the same report were **closed as side effects** of the morning's containment
work and verified: an empty `.git` above the project no longer greens out-of-tree evidence, and the
in-toto mission digest no longer changes when a file outside the project does.

### The machine surfaces (2026-08-26 audit, tier 5)

- **RWD-2026-0067** — `--json --sarif` emitted one document and silently dropped the other, by an
  undocumented precedence chain. Combined emission flags are now refused; a document-typed request
  with no mission writes nothing to stdout instead of a JSON that is not the document asked for.
- **RWD-2026-0068** — `--freeze --json` reported `seal: present false` on the pass that sealed.
- **RWD-2026-0069** — `SOURCE_DATE_EPOCH` reached only the VSA. It now reaches every clock runward
  writes; `interop.md` named the wrong set and the wrong variable, and now names both correctly.
- **RWD-2026-0070** — a cited symlink put its target in the seal and never itself, so re-pointing
  the link left `✓ seal intact` at exit 0. Link and target are both sealed now.
- **RWD-2026-0071** — `runward bundle ../outside.txt` bound a file outside the project into a
  document about that project. ADR-0019's containment now holds one envelope out.
- **RWD-2026-0072** — nothing checked the emitted SARIF. `test/sarif-shape.js` runs four mission
  states through every structural invariant a consumer relies on. It is **not** OASIS-schema
  validation and says so: that needs `ajv-draft-04`, a dependency decision left to the operator.

Two findings from the same report were **closed as side effects** and verified: `--through` +
`--sarif` no longer annotates deferred deliverables with an error level, and an empty `.git`
directory above the project no longer greens out-of-tree evidence (it now refuses with
*"resolves outside the project this mission audits"*).

### The caveat reaches the envelopes that leave the building (2026-08-26 audit, tier 4)

- **RWD-2026-0065** — the SLSA VSA and the bundle predicate were the only two emission surfaces
  without `GATE_NON_SCOPE`, and they are the two a policy engine ingests with no human in the loop.
  The VSA carries it in `policy.annotations`, inside the spec shape.
- **RWD-2026-0066** — the OSCAL mapping spec offered three implementation states, one of which
  cannot occur on a mission using the shipped corpus: all ten ASI categories are mapped, so
  `planned` never fires. The spec says so, and names when it would.

### The run says what actually failed (2026-08-26 audit, tier 4)

- **RWD-2026-0063** — a broken seal printed `1 floor rule-conformance gap(s)` and `Fill the
  deliverable(s) named above`, with none named and every one filled. The verdict now carries
  `strictBreakdown`; the summary names the class and the `Next` gesture matches it.
- **RWD-2026-0064** — the corpus-drift remedy prescribed `runward update` for all three cases.
  Measured: it clears *missing*, is a no-op for *edited* (only `--force` works), and clears
  *extra* not at all. Each line now carries the gesture measured to clear it.

### Two surfaces that disagreed with themselves (2026-08-26 audit, tier 4)

- **RWD-2026-0061** — `compliance` called a governance file *present* in the same pass where `check`
  called it a *raw template*. One used `existsSync`, the other `artifactState`. Same function now,
  and the same words.
- **RWD-2026-0062** — the README said *six phases, gated*; five are gated. Phase 4 carries no gate
  by decision (ADR-0033), and the README now carries the reason.

### The documents catch up with the code (2026-08-26 audit, tier 4)

- **RWD-2026-0058** — the OSCAL pack called a control `implemented` when its only evidence was a
  sentence, and the readiness document never used the word *prose*. Now `partial`, with a
  `runward-evidence-depth` prop naming which rules rest on a sentence.
- **RWD-2026-0059** — README and runward's own port contract claimed it *runs nothing of yours*, in
  a build where `check --hooks` runs your shell commands outside the audited repository. The code was
  precise the whole time; only the prose overstated. Guarded from the code, not from a list.
- **RWD-2026-0060** — the defect register had two duplicate identifiers and a header twelve days and
  three releases stale. Renumbered by first-assignment, with a redirect note, and guarded.

### `spec-check` reads the spec people write (2026-08-26 audit, tier 3)

- **RWD-2026-0054** — `spec-check` said *every criterion is linked* on six ordinary shapes: two
  acceptance sections, a `###` sub-heading inside one, criteria as a table, criteria as prose, an
  empty section, and a decoy heading above the real one. The pointer layer was repaired; the section
  walk was not, while the manifest parser beside it documents these exact shapes as fixed bugs.
- **RWD-2026-0055** — a pointer inside backticks, the way markdown is written, was refused with
  *symbol "login`" not found*. `clean()` now strips a trailing backtick.

### `test:` now means a test (2026-08-26 audit, tier 2)

- **RWD-2026-0053** — a prose deliverable declared as `test:…::of` returned exit 0 on an unsigned
  rule. A document is not a test. Checked on the extension only, because a name convention would
  refuse Rust `#[cfg(test)]` and Go table tests that live in source files.

Two low findings from the same audit closed as a side effect and verified: the coverage counter no
longer reaches 100% on self-citing `#of` pointers (it now reads 0 typed / 23 prose on that mission),
because the counter consults the same circularity rule the verdict does.

### Four missing nets (2026-08-26 audit, tier 2)

Detectors that could not see the one shape where the abuse is free. Each reproduced first, each
fixed with the opposite direction asserted, and each new test measured RED against the unfixed build.

- **RWD-2026-0049** — the seal covered no `adr:` target: 0 of 18 lock keys under `adr/`, so every
  ADR body could be replaced with filler under `✓ seal intact`.
- **RWD-2026-0050** — the duplicate-cell census read `applied` rows only, skipping the two columns
  where copying a cell costs nothing. `duplicated[].rules[]` now carries `status` (additive).
- **RWD-2026-0051** — the ReDoS screen accepted anything past 21 nesting levels, and was blind to
  `a*a*`: eight adjacent repetitions of one atom exceed 20 s on a 40-character subject. An exhausted
  screen now refuses instead of approving.
- **RWD-2026-0052** — the `n/a` reason floor counted keystrokes, so `xxxxxxxx` cleared it. Now a
  degeneracy floor, and **recorded as a limitation rather than closed**: the gate does not read prose.

### The gate's own false greens (2026-08-26 audit, tier 2)

Three ways a green line rested on nothing, all reproduced on the shipped 0.36.2 binary and on this
tree before being closed, each with a sensitivity control proving the fix is not a blanket refusal.

- **RWD-2026-0046** — circularity was tested on the pointer, not the target: dropping `file:` moved
  the rule's own file into a loop that banked it unexamined. Four states of one cell on a CRITICAL
  signed rule: prose → 1, unrelated file → 1, typed self-pointer → 1, **bare self-path → 0**.
- **RWD-2026-0047** — the signature was tested against the whole file, table included, so the row
  declaring a rule satisfied it. 7 of the 9 signed rules ship a signature their own slug matches,
  three CRITICAL. The signature now reads the text outside the manifest.
- **RWD-2026-0048** — `isRealAdr` was a filename test, so a zero-byte ADR read `✓ Decision journal`,
  `all gates passed`, `1 decision(s) traced` and `1 ratified ADR(s)`. Three definitions of "an ADR"
  existed across three layers; they now share one predicate and one threshold, and the compliance
  pack counts as *ratified* only what carries a ratified status.

`test/audit-corpus.js` gains the bare-path vector and reads 15/15 — it read 14/14 while that hole was
live, because it carried only the `file:` spelling of the same attack. A second candidate vector was
written and then REMOVED rather than shipped: it was refused by the unfixed build for an unrelated
reason, so it would have printed `ok` without testing what it names. Its proven detector is
`test/unit/gate-false-greens.test.js`, measured red on the unfixed build and green on the fixed one.

**The version string is part of the fix, not bookkeeping.** `runward verify` derives version skew from
`predicate.runward !== VERSION`, and this tree carries fifteen false-green fixes over the published
0.36.2 while stamping the same string — so no skew could ever be named between a build that has the
defects and one that fixes them, and a compliance pack stamped `0.36.2` may have been produced by
either. That was itself an audit finding.

### Fixed — the adoption path (`update --corpus`)
- **RWD-2026-0038** — vendoring an org corpus erased the lock record of every rule runward wrote,
  turning a green mission red on 31 rules it had scaffolded seconds earlier while reporting success.
- **RWD-2026-0039** — replacing a shipped rule from an org corpus was labelled with the word runward
  uses for its own refreshes, so a fork with one `signature:` line deleted flipped a red gate green
  in silence. It is now named `replaced` and counted as a warning.

### Fixed — the artifacts the gate hands to a machine
- **RWD-2026-0040** — a red gate emitted a SARIF byte-identical to a green one whenever the gap was
  the evidence seal, the rule corpus, an unratified decision or a failed hook.
- **RWD-2026-0041** — half of every SARIF used a mission-relative uri, so those annotations pointed
  at paths no checkout holds.
- **RWD-2026-0042** — `runward verify` re-derived two predicate fields of fifteen; everything a
  regulator would read was unbound free text.
- **RWD-2026-0043** — `verify` took its strictness from the untrusted predicate and never reported
  which gate it had re-derived.
- **RWD-2026-0044** — `--vsa` named `RUNWARD_GATE_STRICT` on a `FAILED` verification, in the one
  field the interop page tells a policy engine to branch on.
- **RWD-2026-0045** — the OSCAL pack was byte-identical between a green gate and one red on eighteen
  unresolvable pointers, and declared controls `implemented` from the manifest status column alone.

### Still open, recorded rather than fixed
The third adversarial audit produced 56 measured findings across five dimensions. Nine of the fifteen
high-severity ones are fixed here; the remainder are filed in
[known-defects.md](docs/compliance/known-defects.md) with their reproductions, and are not closed.

## 0.36.2

**Two more false greens in the spelling ladder, both live since 0.32.0 and 0.34.0 — and neither reachable by reading the code. One needed a permission state nobody creates by accident; the other needed a filesystem the author does not have.**

### The false greens

- **A directory the gate could not list silently cleared the case check** (RWD-2026-0029). `onDiskSpelling` returns `null` for *"the spelling already matches"*, and its `catch` returned `null` too — so *"I could not check"* and *"it is fine"* were the same answer. Measured: `file:./src/Guard.TS` citing a file spelled `guard.ts` is refused with the directory at `0755` and **passes at `0111`**, on a filesystem where it resolves only because the filesystem is forgiving. One permission bit cleared the check for everything beneath it. An unverifiable spelling is now its own answer and a named violation — where the gate cannot verify, it says so in the run ([ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)).
- **On Windows, a redundant `./` defeated the check entirely** (RWD-2026-0030). There `onDiskSpelling` is already defeated by 8.3 short names (`RUNNER~1` against the long name the parent directory lists), which is why `spellingViaRealpath` exists — so it is the **only rung left**, and its failure is the whole ladder's. It compared the operator's raw cell against a canonical suffix: `.\src\Guard.TS` versus `src\guard.ts`. The comparison failed on the *prefix* rather than on the *case*, and "no difference" is what a caller reads as "correctly spelled". Measured on the windows-latest leg: `file:src/Guard.TS` refused, the same pointer written `file:./src/Guard.TS` accepted, same tree. macOS caught both forms all along, which is precisely why nothing before that leg could see it.

Both are a green on the author's machine that turns red on a case-sensitive runner — the surprise that makes people stop trusting a gate.

### The tool-adapter routing is guarded

`tool-adapters.test.js` proved each committed-tool adapter answers correctly **when called**. Nothing proved the gate *calls* it, or *acts* on the answer: 27 mutants sat on that routing and survived the unit suite and the whole net. They **move** a verdict rather than remove it — a coverage report routed to the lint branch still produces a violation, just the wrong one, and a test that only checks "something was raised" passes.

A matrix now covers 4 adapters × every state they can return, each asserting the failure **class** and never the wording, each with the mirror state that must stay silent. Plus the structural cases: the same SARIF body under three filenames routes identically ([ADR-0056](docs/adr/ADR-0056-committed-tool-artifacts-as-evidence.md) recognises shape, never extension), and an ordinary source file still reaches the symbol check. **Measured after: 73 mutants in that range, 73 killed.**

### Also

- The mutation instrument's concurrency is set from a measurement rather than from the core count: the unit suite uses **310 % CPU**, so each worker costs ~3 cores and the ceiling on 8 cores is two. Getting this wrong always errs toward flattery, because a starved run is filed as a caught mutant.
- Tests that depend on filesystem behaviour now **probe** the capability — case-insensitivity, and whether this process can be denied a directory listing — instead of inferring it from `process.platform`. A case-sensitive volume on macOS and a root container on Linux both exist.

## 0.36.1

**Three false greens in the evidence layer, found by instructing the mutants that survive runward's own test net — and the instrument that found them, which was measuring the machine instead of the code.**

### The false greens

None of these needed a mutant to reach. They were exposed by building a mission that would actually exercise each function, which is what instructing a survivor requires ([ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) decision 3).

- **A code fence hid the manifest from the circular-evidence check** (RWD-2026-0025). `textOutsideManifest` removes the conformance table before looking for a self-cited symbol, because column 1 of every row is the rule's own slug and would always match. It took the **first** matching heading, fenced or not, so an example of the format pasted above the real table left the real table inside the text being searched. That is RWD-2026-0002, the universal green key, reopened by a code fence — and `readManifest` had already fixed this exact shape for row parsing. Measured: the same self-citing row exits **1** without the illustration and **0** with it.
- **One invisible character swallowed a typed pointer** (RWD-2026-0026). The pointer pattern ends in `$`, and `.` never matches a line terminator in JavaScript, so a single CR, U+2028 or U+2029 after the prefix made `$` unreachable: the pointer was dropped **in silence**, the row still read as typed, and the cited file was never opened. A paste leaves such characters behind and nobody can see them. Measured on a row citing a file that does not exist: exit **1** with an ordinary cell, exit **0** with a U+2028 in it. Terminators are now folded to a space before parsing, which cannot change a well-formed cell since a space is already a pointer separator.
- **An absent seal said nothing at all** (RWD-2026-0027). The output could not distinguish "never sealed" from "seal deleted": tamper with a sealed evidence file and the gate exits 1, delete `runward/evidence-lock.json` and the same tampered tree exits 0, silently. The strict run now names the regime it is in. The **verdict** is deliberately unchanged, and RWD-2026-0028 records why in a new `known-defects.md` section for constraints that cannot be closed inside the repository: sealing is opt-in, and an in-repository marker declaring "this mission seals" buys nothing against anyone deliberate while costing honest teams a red gate — the reasoning `scaffold-lock.ts` already carries about the corpus lock.

### The instrument, and why its own numbers had to be thrown away

- **The mutation harness is committed** — configuration, resumable passes, the probe, and a survivor register generated from measured verdicts. The ratchet of ADR-0046 decision 2 had existed since 2026-08-05 with **no list to be diffed against**, so "the survivor list does not grow" could not be falsified. That is the shape ADR-0045 refuses from an operator.
- **The raw numbers were fiction.** The harness bounded children with `spawnSync`'s timeout, which signals the direct child only, while `node --test` isolates each test file in its own process — every expired run left about a dozen grandchildren alive, still executing their mutant. Measured: load average **78 on 8 cores**, 32 orphans surviving the driver, and at one point two copies of the verifier racing each other. Stryker counts a `Timeout` as *detected*, so starved survivors vanished into the detected column and the score went **up**: the same module read **98.1 %** contaminated and **77.4 %** clean, with 199 of 269 "timeouts" turning out to be survivors.
- **The instrument now refuses to measure what it cannot measure**: process groups killed whole, hangs reported rather than inferred from an exit code, a lock against a second concurrent copy, the mutant read back from disk before any verdict is taken, and a mutant list bound to the sha256 of the build it was measured on — three fixes moved one function by 47 lines, and a replay would otherwise have spliced into other code with full confidence.
- **[`docs/compliance/mutation-register.md`](docs/compliance/mutation-register.md)** files all 215 survivors of `evidence` as **144 holes, 42 equivalents and 29 display-only**, each carrying what was run and observed rather than what was reasoned, every equivalence argued, guarded on every commit by a test that never runs Stryker.

Nothing here changes the gate's contract: no threshold, no score is a crossing condition, and CI does not run the pass.

## 0.36.0

**The evidence layer reaches the artifacts a factory already produces, and the verdict leaves in the formats its consumers already read. Plus the two false greens the pre-announcement audit found in 0.35.0's own code, and the Windows leg that proved the central invariant on a third OS.**

### The verdict, in formats other tools already read

- **`check --sarif`** emits the gate's own findings as a SARIF 2.1.0 log, each gap annotated on the **manifest row that carries it** — a reviewer reads the verdict in the pull request instead of a CI log. Row located by its first column (never a substring, which would annotate prose above the table), repository-relative URIs, deterministic bytes, and a valid **empty** log on a green mission, which is what clears stale annotations. Emission only: runward writes the file, your CI uploads it.
- **`check --vsa --resource-uri <uri>`** emits the verdict as a **SLSA Verification Summary Attestation** — a neutral port, so a policy engine admits on it without learning runward's vocabulary. It claims **no SLSA level**: `verifiedLevels` carries a custom value (`RUNWARD_GATE_STRICT`, `…_THROUGH_<PHASE>`), because runward verifies a delivery gate and never looked at your build pipeline. `--resource-uri` is required and never guessed. Its `timeVerified` is a clock the spec mandates, making this the one non-byte-idempotent emission — set `SOURCE_DATE_EPOCH` and it is reproducible again.
- **`runward verify` tolerates DSSE envelopes**: it decodes the payload and re-derives, and reports the signature as present and **not verified** — runward anchors no trust root, and checking a signature it cannot anchor would be a stronger claim than the tool is entitled to. A lying predicate inside an envelope still fails.
- **A PR-native `verify` Action** (`stranxik/runward/verify@<sha>`): emits and re-derives, writing the verdict to the job summary. Exercised on runward's own mission in CI, so it cannot rot unnoticed.
- **`runward bundle`** and the [reference Kyverno policy](examples/kyverno/require-runward-verdict.yaml) complete the chain, with [docs/interop.md](docs/interop.md) carrying the recipes: cosign signing, Archivista/Chainloop/OCI deposit, the verdict as external evidence in Kosli and JFrog gates.

### Committed-tool adapters: the evidence a factory already has

A rule row (or a spec criterion) can now rest on an artifact your CI already commits. Same mechanism throughout — recognise the file **structurally**, read what the tool recorded, refuse what the tool itself marked bad:

| Point at | The pointer names | Resolves when | Refused |
|---|---|---|---|
| a **SARIF** scan | `#ruleId` | the scan knows the rule and records no open finding | open findings; a rule never checked |
| a **coverage** report (lcov or Cobertura) | `#path/to/file.ts` | measured **and** something exercised it | measured with zero covered lines |
| an **ESLint** report | `#path/to/file.ts` | linted, no error-severity finding | recorded errors (a warning does not redden) |
| a **CycloneDX SBOM** | `#pkg:npm/name@1.2.3` | the component is declared | a different version; **a bare name**, refused rather than resolved |

Never a threshold, and never a semantic judgment: this is "an empty file is not evidence", declined — **a red test is not evidence, a scan with open findings is not evidence, a file nothing exercises does not prove the rule was applied in it.** SCA deliberately gets no adapter: vulnerability findings are the SARIF adapter's job.

### `spec-check` takes a bundle, and the delta must hold together

Point it at several files or a feature **directory** (`specs/<feature>/`, an OpenSpec change dir) and it adds a second deterministic question: every criterion identifier the bundle **references** must be **declared** by some file of it. `tasks.md` implementing AC7 when the spec declares AC1..AC5 is broken whatever AC7 meant. The identifier pattern is deliberately narrow, so RFC 7231, ISO 42001 and task T3 do not become false reds.

### Two false greens, found by an audit of this project against itself

The 2026-08-14 full-repo audit (thirteen agents, three of them adversarial) found both **inside the evidence layer** — the exact defect class the gate exists to refuse:

1. **The JUnit adapter stopped at the first matching case.** With two homonymous cases in two suites, a **red** case behind a green one was invisible and `test:…::NAME` read "pass". Now every occurrence is scanned and one red reddens; `CLASS::NAME` pins one case among legitimate homonyms.
2. **`spec-check` silently dropped the declared depth.** A criterion linked to an absent `#SYMBOL` or a red `::NAME` read "linked". It now verifies through the gate's own evidence layer, and a criterion links only when **every** one of its pointers verifies.

### Windows, proven rather than assumed

A `windows-latest` CI leg now runs the full suite plus the self-gate. Its first run found seven real defects across three root classes, all fixed: artifact paths are **POSIX by contract at emission** (a bundle made on Windows was not byte-comparable with one made on Linux), the checkout is LF everywhere (`.gitattributes`), and the case-forgiving-filesystem check was silently skipping under 8.3 short names — on the exact platform it exists for. *Same working tree ⇒ same verdict* now holds on three operating systems.

### The run says more, and claims no more

- **The missing-row message names the gesture** (`runward manifest --sync` scaffolds the rows) and hands the decision straight back: sync writes an empty status the gate still refuses.
- **`in-progress` states its true cause** — placeholders left, or content below the divergence floor. `state` is unchanged; `cause` is additive in `--json` and SARIF.
- **Identical Evidence cells are named** in the run, grouped by cell. Counted, never gated: one artifact can legitimately evidence several rules.
- **Every CRITICAL/HIGH rule is ruled on against OWASP ASI** — mapped, or declaring in writing why it has none. Completing all nineteen unmapped rules would have reported agentic-security coverage that does not exist; a test now refuses the third state, silence.
- **`npm run bench`** measures the gate's cost on your machine: burying the reference mission under 10,000 uncited files leaves it flat. The gate is O(cited evidence), not O(repo).

### Migration

Nothing renames and no flag changes meaning. Two populations turn red, both deliberately:

1. **A `test:…::NAME` pointer whose report holds a red homonym.** Fix: pin yours with `test:report.xml::CLASS::NAME`, or accept that the red test was never evidence.
2. **A spec-check criterion whose `#SYMBOL` / `::NAME` does not verify.** Fix: point at the real symbol or case, or drop the depth marker you cannot honour.

Both reference missions are strict-green under this release.

## 0.35.0

**The verdict layer: the verdict becomes a portable, re-checkable, standards-legible object — attested, re-derivable offline, bindable into one provenance — and a full-repo audit hardened it before it shipped. Two false greens found by that audit die in this release; the migration note names who reddens and the one-line fix.**

### `runward check --attest` — the verdict as an attestation ([ADR-0055](docs/adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md) layer 1)

Wraps the `--json` verdict in an **unsigned** in-toto Statement v1 (predicate `https://runward.dev/verdict/v1`) whose subject digest binds it to the exact mission state (the mission tree ∪ the cited evidence files). Byte-idempotent; no signature field — signing stays your gesture, under your key, runward holds none. The envelope is schema-validated in CI against a **vendored** in-toto Statement v1 schema, with the network cut.

### `runward verify` — offline re-check ([ADR-0055](docs/adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md) layer 2)

Re-derives the mission-state digest and the verdict from the current tree and confirms the attestation binds to it: a drifted tree and a tampered predicate both fail, loud; no network, no trust root, no key. A **version skew is named** (`producedBy`/`versionSkew`): when the attestation was produced by an older runward, a re-derivation failure can be verdict-logic evolution rather than tampering, and verify hands over the distinguishing gesture (`npx runward@<producedBy> verify …`) instead of letting the two read the same. A phase-crossing attestation (`check --through --attest`) records its declared horizon and verifies against that prefix — a verified prefix can never be read as a finished mission ([ADR-0053](docs/adr/ADR-0053-the-construction-gate-certifies-a-declared-horizon.md)).

### `runward bundle` — one provenance for an assessor ([ADR-0055](docs/adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md) layer 4)

Binds already-emitted artifacts (the verdict attestation, the evidence seal, an OSCAL pack, an SBOM…) into a single in-toto manifest, each referenced by raw SHA-256 — re-verifiable by `runward verify` or any cosign/in-toto tool.

### `runward spec-check` — deterministic spec conformance ([ADR-0056](docs/adr/ADR-0056-the-evidence-layer-widens.md))

Every acceptance criterion in a spec (Spec Kit, OpenSpec, BMAD — format-agnostic markdown) must be **linked** to a delivered artifact that resolves, at the depth the pointer declares: `#SYMBOL` at an identifier boundary, `::NAME` recorded green in a committed JUnit report, the `:LINE` bound — through the gate's own evidence layer, never a re-implementation. A criterion links only when EVERY one of its pointers verifies: one green path cannot mask a broken `#SYMBOL` beside it. Linkage, never semantic satisfaction — `SPEC_NON_SCOPE` travels with every verdict, and the exit stays the 0/1/2 port.

### Committed-tool evidence: the JUnit adapter ([ADR-0056](docs/adr/ADR-0056-the-evidence-layer-widens.md))

A `test:reports/junit.xml::Name` pointer resolves against the **committed** report structurally — present-and-green, present-and-red, absent — never by running anything. **Every homonymous case is scanned and one red reddens the verdict** (the audit's first blocking finding: the first version stopped at the first match, so a red case behind a green homonym was invisible); `CLASS::NAME` pins one case among legitimate homonyms via the `classname` attribute.

### The shared corpus, pinned without a registry ([ADR-0057](docs/adr/ADR-0057-the-shared-corpus-is-pinned-without-a-registry.md))

An org vendors ONE rule corpus across a fleet with **no registry and no fetch**: `runward update --corpus <path>` vendors `runward/rules/` from an already-vendored local directory — a filesystem path, **never** a registry coordinate (`@org/rules` is refused by name) — and records the pin in the scaffold-lock. The corpus self-describes (`corpus.json` → `corpusPin` in `check --json`); a pin/bytes divergence is reported as `corpusDrift`, **advisory, never a gap** (both stamps are re-signable together — gating them would be ADR-0002's re-signable floor). The corpus's own `migrations.json` merges with the built-in migrations at every reading surface, so a renamed org slug is guided, not guessed at. The no-fetch invariant is proven structurally: the whole flow runs inside CI's network-cut block, where any socket attempt fails the job.

### The gate, hardened and accounted for

- **Three more signed rules** — `config-secrets-boundary`, `async-job-guardrails`, `data-memory-provenance` (9 of 64), each on an idiom its text prescribes, each with a `nonScope`.
- **`rules --for --json` refuses rather than guesses**: a top-level `couldNotRead` names every territory carrier a read step could not fully read, so an orchestrator cannot treat a shortened answer as exhaustive.
- **The runtime boundary is a test, not a promise** ([ADR-0054](docs/adr/ADR-0054-the-runtime-boundary-is-explicit.md), now accepted): the transitive import closure of the verdict path contains no socket module and no process spawner; `check --strict --json` is byte-identical across two runs; no command speaks `--changed`/base-ref. `npm run bench` answers the monorepo objection with a measurement: burying the reference mission under 10,000 uncited files leaves the gate flat — O(cited evidence), not O(repo).
- **The journal caught up with the code**: ADR-0054 and ADR-0056 ratified on their proofs, ADR-0055 amended (the subject is the mission-state digest — stated, no longer silent; layers 3-4 recorded delivered), ADR-0005 amended (a reader of a committed report is not the runner lock-in it refused). The assessor-facing compliance registers were corrected in the uncomfortable direction: they claimed three packs did not carry `GATE_NON_SCOPE` when all four do — the claim now follows the blocking test instead of being maintained by hand.
- **The README says what ships**: the verdict layer is documented from the front door, and the turn-end hooks are labeled what they are — advisory by design (`|| true`), the hard stop is CI.
- **`runward/claims` resolves**: the forbidden-claim list ships as a real package export (with a wildcard passthrough so no existing deep path breaks), and the site build now consumes it as a failing guard — one list, no drift ([ADR-0050](docs/adr/ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md) executed end to end).

### Migration — two false greens die, and three rules gain a signature

1. **A `test:…::NAME` pointer whose report holds a red homonym.** Previously read "pass" off the first match; now one red reddens. **Fix:** if the homonyms are genuinely different tests, pin yours with `test:report.xml::CLASS::NAME`; if not, the red test was never evidence.
2. **A spec-check criterion whose `#SYMBOL` / `::NAME` does not verify.** Previously "linked" on path presence alone; now the declared depth must hold, on every pointer of the criterion. **Fix:** point at the real symbol/case, or drop the depth marker you cannot honor.
3. **A prose `applied` row on `config-secrets-boundary`, `async-job-guardrails` or `data-memory-provenance`.** Same class as 0.34.0's five: a signature makes shape-matching evidence mandatory. **Fix:** point at evidence carrying the idiom, or answer `n/a`/`deviated` with a reason.

Both reference missions are strict-green under this release; every change was validated in both directions.

## 0.34.0

**Three decisions from the 2026-08-12 product review land: the construction gate becomes usable in CI, and the gate is made as strong as its headline. This release deliberately reddens some previously green missions — the migration note below names exactly which, and the one-line fix for each.**

### `runward check --through <phase-id>` — the construction gate ([ADR-0053](docs/adr/ADR-0053-the-construction-gate-certifies-a-declared-horizon.md))

A required `check --strict` exits 1 for the whole build, because later-phase deliverables are unfilled by definition — so it was unusable in CI during construction, and teams hacked a partial-green with `jq` or `|| true`. `--through <phase-id>` certifies a declared PREFIX: every phase up to and including `<phase-id>` is crossed on evidence, nothing past it. It narrows only the phase counters; the 0/1/2 exit contract, the seal and the six phases are untouched, and the phase-global integrity checks (corpus, seal, unratified ADRs, drift) are NOT scoped, so a regression at or below the horizon still reds — the horizon is a floor, not a ceiling. It refuses `--freeze` (a seal certifies a full crossing) and an unknown id, both exit 2; it prints a loud "not a completion verdict" banner and carries additive JSON (`through`, `horizon`, `gaps.deferred`). The wiring contract is in the ADR: the release / merge-to-main gate stays the full `check --strict`; `--through` is a construction progress signal, never the sole required release check.

### The gate is made as strong as its headline ([ADR-0051](docs/adr/ADR-0051-the-gate-is-made-as-strong-as-its-headline.md))

- **Symbols match at an identifier boundary.** `#guardFields` no longer matches a file that contains only `guardFieldsLegacy`. A renamed identifier — the exact "moved or renamed" case the violation message names — now reds instead of silently passing, and a seal can no longer sit on a pointer whose identifier no longer exists. Non-identifier symbols (dotted, quoted) keep their exact-substring semantics.
- **Five more rules carry an evidence signature** (6 of 64, up from 1): `resilience-retry-backoff`, `resilience-multi-provider-fallback`, `security-mcp-server-pinning`, `security-code-execution-sandbox`, `security-tool-change-reapproval` — each a conventional idiom the rule text prescribes, each with a `nonScope` stating what a match does NOT prove. Rules whose idiom is illustrative rather than a code token stay unsigned, and the refusals are named in the commit.
- **The run names the signed share of the verdict**: "N of M `applied` row(s) rest on a signed rule". Counted, never gated; additive JSON (`evidence.signed`).

### Overclaim rules externalized ([ADR-0050](docs/adr/ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md) decision 2, structural part)

The forbidden-claim list moves out of the CLI test into `src/lib/claims-rules.ts`, shipped with the package, so a site-build guard can consume the same list from the pinned dependency — one source, no drift. No behaviour change; the guard's three meta-guards are intact. ADR-0050 stays proposed (its site-copy decisions need the site repo).

### Migration — this release reddens some green missions on purpose

After `runward update` refreshes a mission's rule corpus (or on the next `check --strict` for a mission that judges against the package corpus), two populations turn red. Both are the mechanism working, and each has a one-line fix:

1. **A pointer symbol that was a fragment of the real identifier.** If an `applied` row's `#SYMBOL` passed only because it is a substring of a larger identifier (e.g. `#guardFields` over `guardFieldsLegacy`), it now reads "symbol not found". **Fix:** point at the real identifier, or drop the `#SYMBOL` to keep the bare path.
2. **A prose `applied` row on one of the five newly-signed rules.** A signature makes file-backed evidence mandatory for `applied` rows, so an `applied` row that carried only prose (no `file:`/`test:` pointer whose content matches the idiom) now reds with "cited, not applied". **Fix:** point the row at evidence that carries the rule's shape, or answer `n/a` / `deviated` with a reason — a rule the mission does not implement was never meant to be `applied`.

The two reference missions (runward's own, and the shipped `request-triage` example) are strict-green under this release; every change was validated in both directions on each.

## 0.33.5

**No verdict changes. The canary for [ADR-0049](docs/adr/ADR-0049-the-build-is-isolated-from-the-publish.md): the first release whose provenance is signed by the isolated builder.**

The tarball is built, tested and its provenance signed inside `build-and-attest.yml`, a reusable workflow whose steps `release.yml` cannot reach into; the signing certificate names that file. The publish job packs the same commit itself and refuses to publish a builder tarball that does not byte-match — the reproducibility re-proof, executed at release time rather than promised. `npm publish` stays in `release.yml` under OIDC trusted publishing, unchanged.

Written before the tag, as with the 0.33.4 canary. What this release must establish:

```sh
gh attestation verify runward-0.33.5.tgz --repo stranxik/runward \
  --signer-workflow stranxik/runward/.github/workflows/build-and-attest.yml
```

passing on the published artifact; the determinism cross-check holding; and a local rebuild of the attested commit still reconciling byte for byte. `verify-release.yml` requires the signer identity on this release's run, so the outcome is loud in both directions.

No SLSA level is asserted anywhere. The sentence naming what the mechanism is documented to provide is frozen verbatim in the overclaim guard (`FROZEN_CITATIONS`), and every paraphrase of it faces the rule — the regex accident that used to let it pass became a decision, tested in both directions.

Worth recording: the first CI run of this chain caught a real mistake — the builder wiring was applied, tested green locally, then silently reverted by the restoration step of the very guard-bite checks meant to prove it was guarded, and the stale local run was believed. The extended posture guard reddened on `release calls the isolated builder` at its first outing. The commit message of the fix carries the lesson: restore from a saved copy, never from HEAD, when the working tree holds uncommitted work.

## 0.33.4

**No verdict changes. This is the canary release for [ADR-0048](docs/adr/ADR-0048-the-release-carries-verifiable-proof.md): the first release whose build provenance is attested and attached, and the first the release proves under its own verifier.**

### What this release is the proof of

- **The provenance path.** `release.yml` now attests build provenance for the tarball (`actions/attest-build-provenance`, own SHA pin) and attaches **two** bundles under locked names: `runward-0.33.4.intoto.jsonl` (SBOM attestation) and `runward-0.33.4.provenance.intoto.jsonl` (build provenance). Until now the GitHub attestation store held no provenance for the tarball — `gh attestation verify` with no flag answered HTTP 404, measured 2026-08-11 — because the provenance lived on npm alone, which gh does not read. From this release, `gh attestation verify runward-0.33.4.tgz --repo stranxik/runward --predicate-type https://slsa.dev/provenance/v1` is expected to pass from the release assets, offline included. This changelog entry is written **before** the tag: whether it holds is exactly what the canary establishes, and `verify-release.yml` requires it on this release's run — a missing bundle reds the release (`test -s`), and a failed verification reds the verify run.
- **The verifier.** `.github/workflows/verify-release.yml` replays `docs/verifying-a-release.md` against the published artifacts after every release: cross-store hash, attestation verification with identity, offline verification from the attached bundle, and a negative control (a corrupted tarball must fail). Proven by dispatch against v0.33.3 before this release; this is its first release-triggered run.

### Also in this release (shipped on main since 0.33.3)

- **`docs/verifying-a-release.md`** — the replayable verification an enterprise runs, expected outputs verbatim, offline path (three files suffice), second verifier with pinned identity, negative controls, and the closing paragraph on what none of it proves: a signature establishes who **attested** these bytes, never that the code is sound.
- **ADR-0048** — locked asset names (a rename to `.sigstore.json` would downgrade the Scorecard category from provenance to signature, established at source against ossf/scorecard v5.5.0); slsa-github-generator refused for three sufficient reasons (non-maintenance notice merged 2026-08-07, Node builder never left beta, `NPM_TOKEN` publish path regressing from OIDC trusted publishing); the isolated-builder path deferred with named preconditions, not refused.
- **Backfill** (release assets, not code): v0.32.0 through v0.33.2 now carry their tarball and SBOM attestation bundle, each verified — signature, workflow identity, digest, then re-verified offline from the restored bundle — before attachment, with a dated note in each release. Side effect, measured then confirmed on the public scorecard: Signed-Releases 0 → 10, global score 6.1 → 6.9. The score reads filenames and verifies nothing (its own documentation says so); the deliverable is the procedure, the score is its shadow.

## 0.33.3

**No verdict changes.** The release path now carries its own proof, two claims that were true became enforced, and the gate's requirements are stated one at a time with the test that exercises each.

### The release carried no proof

Until 0.33.3 a GitHub release carried the SBOM and **nothing else** — not the tarball, not a single attestation. The provenance existed (`npm audit signatures` returns it, and deps.dev shows Google verifying it independently) but it lived on the npm registry, and a GitHub release is where most people look.

So OpenSSF Scorecard read the release assets and answered, verbatim: *"Project has not signed or included provenance with any releases"*, scoring Signed-Releases **0/10**. The project's own public scorecard contradicted its strongest claim, across at least three releases.

The real bundle now goes up under the `.intoto.jsonl` name the ecosystem reads, with the tarball beside it — an attestation whose subject the reader cannot fetch from the same place proves nothing they can act on. `test -s` reds the release rather than shipping a silent gap. **This release is the first proof that the path works**; it could not be tested any other way.

### Two lines the compliance sheet could only assert

- **`npm audit --audit-level=high` runs on every pull request.** There was no such job: `grep -rn "npm audit" .github/workflows/` returned nothing, and a HIGH advisory sat green and unmerged while a release was cut. Scoped to high and above on purpose — a floor at `low` reds on advisories nobody would act on, and a guard that cries on the safe case gets switched off.
- **Line coverage is measured and held above a committed floor.** The `coverage` script existed and nothing called it. A **ratchet, not a target**: floor at 78 against a measured 80.41, moved only by a deliberate commit. [ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) refuses a threshold on the *mutation* score for reasons that do not transfer — a mutation score is a property of the tests, whereas line coverage is recomputed from scratch on every run.

### Tool operational requirements

[`docs/compliance/tool-operational-requirements.md`](docs/compliance/tool-operational-requirements.md): **51 requirements** over the verdict surface, each citing a test file and a case name inside it. The substance was already in `runward/contracts/port-contract.md` — in prose, with zero identifiers. Prose cannot be checked off.

Each entry states what a green **leaves open**, per requirement, because `GATE_NON_SCOPE` is too coarse to answer a question about one line.

It is **not a qualification kit**, and says so: a vendor kit's documents are produced under a quality system a third party has assessed, and these are not. Its traceability guard checks that a citation **resolves**, never that the cited test is **relevant** — the same class of limit stated one floor below. Section 10 names what carries no requirement at all.

### Why runward issues no attestation about your application

Section 5.4 of the regulated-adoption sheet answers a recurring question with **no**, in any form, and the reason is measured rather than principled: the machine contract cannot distinguish a substantial mission from one carrying no project code, the corpus belongs to the audited party, the seal date is the mission's word, and issuer, subject and verifier would be the same party. What can be published instead is a **replayable record, by the operator, in their own repository** — with the admission that on a private repository the only level that checks content is unavailable to an outside reader.

### Test suite

**428 → 435**, and 98 mutants that survived the entire net now die. Re-measured before instructing: the derived figure was 199, the measured one 179, because twenty had been killed by tests that never aimed at them. 81 survivors remain, filed as a register rather than a backlog.

## 0.33.2

**No verdict changes. Four places where the output claimed more than it established, or less than it knew.** All four came out of an investigation into whether runward should issue an attestation that an application was built with it. The answer to that was no, and the reasons produced this release.

### The machine surface was quieter than the terminal

`check --strict --json` carried no counters, no corpus status, no seal. An agent driving on `--json` — which is how this tool is meant to be consumed, and how a CI reads it **blind** — could not tell a mission carrying real evidence from one answering `n/a` to every row. Both said `verdict: "clean"`.

That inverts [ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)'s own finding one layer out: the worst case must not be the quietest.

| | reference mission | same mission, every row `n/a` |
|---|---|---|
| before | `verdict: clean` | `verdict: clean`, **identical object** |
| after | `applied 23 · na 13 · typed 20` | `applied 11 · na 25 · typed 8` |

Additive per ADR-0030: `evidence`, `corpus`, `seal`, `criticalScope`, `gateNonScope`, all under `--strict` only. **`gateNonScope` travels with the counters on purpose** — a consumer that keeps the numbers and drops the caveat is the next entry.

### The declared non-scope shipped in one pack out of four

Measured on generated packs: present in the ISO/IEC 42001 draft, **absent** from the NIST AI RMF draft, the EU AI Act draft, and the OSCAL component-definition. The artifact that leaves for a third-party GRC tool was the one carrying no reservation, and the prose around a pack does not travel with it. A caveat that stays home was not made.

All four carry it now, the OSCAL one in its metadata `remarks` so it survives ingestion.

### The gate demands 31 of the 45 CRITICAL/HIGH rules

The conformance section printed *"Architect: 6 rule(s) accounted for … Govern: 12"* and stopped, which reads as though the critical set were covered. It is not: 14 rules are mapped to no gated phase and are never asked about, **five of them CRITICAL**, including `checklist-pre-production-security` and `checklist-pre-production-resilience`.

Reported, never gated. A rule with `phases: []` is documentation the operator may apply without the gate asking, and gating it would red every honest mission on day one. Leaving it unsaid was the defect, because it let a reader believe a sentence the output never supported. The count and the list are printed, and `criticalScope` is in `--json`.

### The seal date is declared, not observed

`runward/evidence-lock.json` carries `sealedAt`, and nothing signs the lock. Editing the field by hand yields `✓ seal intact — sealed 1999-12-31` with exit 0. **Nothing changes for an honest user** — `check --freeze` writes the real date, as it always did — and nothing here is repairable: an unsigned file inside the audited repository cannot testify about itself. What the seal proves is unchanged: the cited files still hash to what they hashed when it was written. The printed line and the machine surface now say the *when* is the mission's word.

Recorded as RWD-2026-0022 and RWD-2026-0023 in `docs/compliance/known-defects.md`, under a section that says plainly these are properties of where the data lives, not bugs awaiting a patch.

### Method note

Every guard added here was checked **by removing the fix**: drop `gateNonScope` from the payload, remove the reservation from the drafts, stop computing `criticalScope` — each one reds. A guard nobody tried to break is a guard nobody has tested.

## 0.33.1

**A false green, in the release published this morning.** One `rm` on a file the audited party owns, and a corpus of 64 rule files reduced to the word `ok` crossed the gate.

```
64 rule files reduced to "ok", scaffold-lock.json present  ->  exit 1
64 rule files reduced to "ok", scaffold-lock.json deleted  ->  exit 0
```

Reproduced against `runward@0.33.0` installed from npm, not against a working tree.

### What was open

`corpusDivergence` answers `unrecorded` when a mission keeps its own rule copy and carries no `scaffold-lock.json`. That is a compatibility path for missions predating the lock, and it printed a warning while contributing **nothing** to the verdict.

The lock lives in the audited repository. So *"this mission predates the lock"* and *"someone deleted the lock"* are the same observation, and the second costs one command. **[ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) class 1 reopens by deleting a file instead of re-signing it** — and `docs/compliance/known-defects.md` called that class closed.

It is also the aggravating form ADR-0045 names, one storey up: the gate said it could not check, in prose, next to a green exit code. **Where the gate cannot verify, it says so in the run, and the run is the exit code.**

### The fix, and what it leaves alone

`unrecorded` is a named line of the verdict from this release. Verified in both directions: the fabricated corpus with the lock deleted goes from exit 0 to exit 1 with a reason; the shipped example, a mission with no local rule copy (`package`), and runward's own mission all stay at exit 0. A legacy mission is one `runward update` away, and the safest configuration — no local copy at all — was never the one punished.

Guarded twice: `test/unit/verdict.test.js` pins both directions and kills two mutants, and `test/audit-corpus.js` replays it end to end. **The first draft of that replay was decorative** — it renamed the rule files, so every manifest row cited a slug that no longer existed and the mission reddened on conformance, which made the case pass with the fix removed. It guts the bodies in place now and fails without the fix.

### How it was found, which belongs in the record

Not by re-running the audit method ADR-0045 says to re-run on any release touching these modules. By an investigation into an unrelated product question, where an analyst asked to build the cheapest mission that would earn a hypothetical attestation built it. **A reevaluation trigger is only as good as whoever remembers to pull it.**

ADR-0045 gains an amendment stating that class 1 was not closed, rather than leaving a ratified decision claiming a closure that did not hold. `known-defects.md` gains RWD-2026-0021 and corrects the RWD-2026-0001 entry.

### Also

- The SBOM round-trip guard shipped yesterday with `workflow_dispatch` only, which was the defect it exists to prevent: a guard someone has to remember is a guard that does not run. It fires on any pull request touching `release.yml`, which is what every Dependabot bump to `download-artifact` or `anchore/sbom-action` does.
- `chalk` 6.0.0. Verified with colours forced, since the suite redirects to files and emits no escape sequence at all: six outputs captured on 5.6.2 and 6.0.0, **byte-identical**.
- Dependency advisories closed (`js-yaml` 5.2.3, `fast-uri` 3.1.5). `npm audit` reports 0 in the repository; an installer already got 0, since both are development dependencies.

## 0.33.0

**0.32.0 fixed what an audit found. This one measures what the net that guards it would catch, and publishes the answer with everything in it that counts against us.** No behaviour of the gate changes: 24 golden outputs across four missions and six flag combinations are byte-identical to 0.32.0, exit codes included.

### How much does this test suite actually detect

A full mutation pass (Stryker 9.6.1) on the seven library modules the verdict is computed from. **Mutation score 60.78 per cent**: 2 973 mutants, 1 769 killed, 38 timeout, 1 166 survived, in 2 h 35.

A survivor count is not a defect count, and treating it as one produces a day of false findings. So: 433 survivors carry mutators able to flip a *decision* and were re-run against the whole net (unit suite, self-gate, OSCAL validation, end to end smoke); **53 died there, 380 survived everything**. Then 246 of those were instructed one function at a time, each by applying the mutant to a real mission and reading the verdict rather than reasoning about the code. **181 now die**, measured centrally rather than claimed.

Three mechanisms were **correct in every shipped release** and guarded by **no test**:

- **Seal tamper detection.** One field returned false in `verifyEvidenceLock` takes a sealed, tampered mission from exit 1 to **exit 0**: `check.ts` gates the whole seal section on it, so the violations were neither printed nor counted. Reproduced by hand on a mission sealed with `check --freeze`.
- **The ReDoS screen** ([ADR-0020](docs/adr/ADR-0020-rule-evidence-signatures.md)). The loop collapsing nested groups was entered by no fixture and could be deleted with the suite still green.
- **Pointer containment.** The repository fallback was dead code under test: every containment test ran in a bare temp directory, where no repository marker exists above the base.

One correction the pass forced on its own reading, and the reason [ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) exists: **a surviving mutant is not automatically a false green**. Forcing `artifactState` to call every ADR directory `filled` survives the unit suite, the self-gate, the smoke run *and* the audit corpus, and the mission is still **refused**, because a typed pointer does not resolve. Defence in depth. What it corrupts is the printed line, and for this tool a proof surface that lies under a correct verdict is a defect of its own.

Mutation testing is adopted as an **instrument, never a gate**. No score is ever a crossing condition: a number in a manifest is a verdict satisfied by a figure nobody re-derived, which is what [ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) forbids, and runward does not do to itself what it refuses from an operator. What is opposable is a **ratchet on a named perimeter**.

### The verdict is now computed where a test can reach it

The largest absence of that measurement was the one that mattered: `src/commands/check.ts`, where the verdict is assembled and the exit code chosen, sat at **8.70 per cent line and 0 per cent function coverage**, no unit test imported it, and the mutation pass could not reach it at all.

`src/lib/verdict.ts` is now a pure reading of the mission: it prints nothing, never touches `process.exitCode`, runs no hook. `check.ts` renders it and exits on it. `verdictFrom()` is the single definition of "clean", exported so the command cannot grow a second copy below the render. **97.79 per cent line, 100 per cent function**, and inside the measured perimeter from now on. 12 hand-written mutants, 11 killed; the survivor is argued rather than assumed ([ADR-0047](docs/adr/ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md)).

### What we publish about ourselves

- **`docs/compliance/known-defects.md`**, 20 entries in four classes, each with the version range it affects and the command that verifies it. It lists **both directions**: the undue passes and the five undue refusals that shipped in 0.31.x. A register that only published false greens describes half a campaign and is falsifiable in one command against this project's own changelog.
- **`docs/compliance/regulated-adoption.md`** gains the axis it was missing. It was written on the shape of a SaaS questionnaire, artifact integrity plus project health; the axis that decides for a tool that renders a verdict, **whether the verdict is right**, was absent from all 82 lines. New section 8 works the tool confidence analysis through for medical device, automotive, rail and airborne software, **adverse case first**, and asserts no level and no class for runward in any scheme.
- Its footer no longer says every verifiable claim on the page is enforced in CI. That was a reassuring count over a set the author chose, which is the exact failure mode ADR-0045 records in the gate itself.
- One published falsehood corrected: `GATE_NON_SCOPE` is **not** printed in every compliance pack. Measured, it appears only in the ISO/IEC 42001 draft. The NIST AI RMF pack, the EU AI Act pack and the OSCAL component-definition carry nothing, and the pack it is missing from is the one that goes to a high-risk provider.

### Guards that had a broken perimeter

The recurring defect of this repository, four instances in one week:

- **The reproducible-build job had never once compared two tarballs.** `npm pack --pack-destination` does not create the directory, so it exited ENOENT on its own output path. The claim it guards is true, verified by hand; the guard simply never reached the comparison.
- **The overclaim guard** saw neither `TQL`, nor `TCL2/3`, nor the rail classes, and nothing refused declaring a normative clause satisfied. Widened *before* the section that produces that risk was written, not after.
- **`CITATION.cff` was pinned at 0.21.0** for eleven releases, while `packaging.test.js` already guarded the roadmap against the same failure mode.
- `docs/compliance/eu-ai-act.md` contradicted itself two lines apart on the high-risk binding date, and the compliance README carried the superseded one.

### Also

- `test/audit-corpus.js`: the adversarial campaign behind ADR-0045 becomes a corpus anyone can replay against the real CLI, 9 refusals and 4 acceptances, with a sanity guard asserting the reference mission is green before any case runs.
- `regimes/eu-ai-act@2026-1744.json`: the expired sheet had missed an amending regulation. The dated-facts watch now detects that the **text** moved instead of waiting for a date we guessed.
- Unit suite **209 → 342**. Whole-project line coverage 74.90 → 79.70 per cent.

## 0.32.0

**The largest correctness release this project has had.** Five adversarial audits, every case executed against the shipped binary rather than reasoned about. Three asked "how do I get a false green"; two asked the opposite, "where does the gate cry on a mission that is telling the truth". Both halves were needed: **of the nine hardening classes written in the morning, four cried on the honest case.**

### The gate could be satisfied by paperwork

`check --strict` exited 0 on missions containing **no evidence at all**. The cheapest cost 2 726 bytes of arbitrary text and zero lines of project code — with the seal applied and the ISO 42001 pack assembled on top. The aggravating form: the emptiest missions produced the most reassuring output. Citing each rule's own file printed `36 of 36 typed pointers the gate opened and checked (100%)`.

- **The corpus is wired to the verdict.** The gate judges a mission against a corpus the mission *owns*. [ADR-0002](docs/adr/ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) closed rule removal; substitution and fabrication passed, because its floor counts *cardinality* over a set the adversary controls — twelve files containing `ok` satisfy `govern: 12`. The authority is now the **installed package**, outside the repository; `scaffold-lock.json` keeps its real job, telling an upstream change from a local edit.
- **Circular evidence is refused.** `file:<manifest>#<slug>` was a universal green key: the slug is column 1 of every row.
- **The ADR layer matches the evidence layer.** A 0-byte file, `ADR-0000-template.md`, a rejected or unratified decision each satisfied a deviation. Refused by name.
- **Containment actually runs.** `resolveFile` was purely lexical: a symlink to `/etc/hosts` passed and was read, turning the seal into an arbitrary-file read oracle.
- **The seal covers the claim**, not only the files it cites; sealing zero files is refused; an unknown lock `version` is refused.
- **The counter no longer goes quiet at the worst moment.** It printed only when `applied > 0`, so answering `n/a` to all 36 rules removed the only vacuity signal. It now always prints `N applied · N deviated · N n/a`.
- **The grammar is read before anything rewrites it.** Quotes honoured before the `;` split; the apostrophe is not a delimiter (`#'l'invariant tient'` made the gate look for `l`, true of every file); every pointer in a cell parsed, not just the first; duplicate `Rule conformance` sections refused rather than arbitrated; fenced tables are illustrations.
- **A signature cannot hang the gate.** `unsafeSignature` excluded `(?:...)`, so `(?:a+)+b` ran over 20 s on 38 characters.

### The gate refused honest missions

- **A Windows checkout turned the corpus into a fabrication.** `core.autocrlf` rewrites every file and `/^---
/` does not match `---
`, so all 64 rules read as empty and the gate announced *"the mapping may have been stripped"*. Git doing its documented job accused the operator.
- **npm/pnpm workspaces broke** under the containment hardening: `packages/api/src/shared -> ../../shared` stopped resolving, with no spelling that worked. Containment now accepts a target inside the enclosing repository, found by a marker on disk — never by reading git configuration ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)).
- **An unreadable file was a crash, not a verdict**, and `--json` stopped being JSON.
- **The gate punished precision**: a path outside the project passed as prose and failed as a typed pointer.
- **A documentary rule could not be proven.** The usage registry and the named successor have no evidence but the section stating the fact. A pointer may now cite a fact stated *outside* the manifest table.
- **House rules are welcome again.** Only an extension that would count toward the non-vacuity floor is refused.
- **A green here is a green in CI.** `file:SRC/Guard.TS` resolved on macOS and failed on Linux; it is refused here, with the on-disk spelling resolved segment by segment.

### What this changes for you

**Missions that were green may go red** — a hand-edited rule, a deviation resting on an unratified ADR, a circular pointer. Those verdicts were about something other than what they claimed. **Missions that were red may go green** — every Windows checkout, every workspace.

Nothing changes in the exit-code contract, the machine surface, or the six phases. And none of this makes the gate judge whether evidence *implements* a rule: `GATE_NON_SCOPE` is unchanged and remains the honest statement of depth. See [ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md).

## 0.31.0

An adversarial fact-check on [the v0.30.0 article](https://runward.dev/news/2026-08-01-six-tests-that-could-not-fail/) re-tested every claim it made. **Two of the three mutations published as harmless were live defects**, and the corrected figure in the same article was itself wrong. Both fixes are here; the article is corrected on the site.

- **`territory.ts` bracket balance.** A `#` two characters past an opening quote was taken for a comment, the line truncated, an inline array lost its `]`, and the balance loop swallowed the rest of the file. The `#` need not sit on a line runward reads: a documentation URL with an anchor inside `[vars]`, a table never consulted, destroyed the `[triggers]` below it and a HIGH rule silently stopped surfacing. The published reasoning argued line by line about an automaton that carries state **across** lines.
- **`territory.ts` derivation notes.** The binding-source check could mean *"no other manifest produced anything"* instead of *"this one produced nothing"*: a false note beside a cron just derived from that same file, a real absence silenced, and a note naming **the wrong manifest**. No exit code moved, which is why it was first filed as "an informational message" — but evidence pointing at the wrong file is not classified by its output channel.
- **`gatedPhases` is published in the rules envelope** (`rules --json`, `--for`, `explain`), read from `GATED_DELIVERABLES` rather than restated. The site's catalog had computed "rules the gate can require" from a hand-written literal missing `handover`, understating the gate by four rules, one of them CRITICAL. Additive field per [ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md); `port-contract.md` updated.
- **The one survivor that really is equivalent is now guarded on its reason, not its symptom.** `mission.ts`'s line filter is equivalent across 3267 comparisons, but only while every shipped template ends with a newline. Strip one and a deliverable flips `in-progress` to `filled`, opening a phase. A test now pins the invariant; it deliberately does not kill the mutation.

Every guard proven able to fail: each mutation reddens its own test and only it, removing a template's trailing newline reddens the invariant guard, and reintroducing the old `BUILD_PHASES` literal verbatim reddens the contract guard.

## 0.30.0

An internal-validity pass: instead of adding surface, mutate the source and see whether the tests notice. **42 valid mutations, 36 killed or type-caught, 6 survivors** — three of them real holes. Everything below was found by measurement, not by reading.

- **`AGENTS.md` now carries the gesture its own obligation needs.** It already told the agent to *"confront them at the point of action, not from memory"*, then named only `runward explain <rule>` — which reads a rule whose **name you already know**. It never said how to find out **which** rules govern the file being touched. `runward rules --for <paths>` is now in the same sentence, with the honesty clause that must travel with it (rules declaring no territory are counted, never matched). This is not an extension of [ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md), which deliberately kept the step out of the non-building workflows: `AGENTS.md` is not a workflow, it is the contract handed to the agent every session, and it already carried the obligation. **`update` does not refresh `AGENTS.md`** and is right not to — it is a mission deliverable ([ADR-0010](docs/adr/ADR-0010-agents-md-as-a-first-class-handover-deliverable.md)), so existing missions do not receive this; new ones do.
- **The traversal guard on evidence pointers had no test.** Collapsing the containment check in `resolveFile` survived the whole suite — on the path **every `applied` row goes through**. `verifyEvidenceLock` had its traversal test; pointer resolution did not. Now pinned: a `../` climbing out of every base is refused even when the file really exists, and a sibling directory sharing the base's prefix (`/a/project-evil` vs `/a/project`) is not inside it.
- **Nothing pinned that runward works from inside a repo.** Stopping the `findMissionRoot` climb on its first iteration survived — and climbing to the mission root is the one behaviour that makes `runward check` usable from anywhere, which is how it is actually run. Pinned from three levels down, from the root, and an orphan directory resolving to nothing rather than adopting a mission above it.
- **A `*` that crossed a path separator went unnoticed, and a block comment that ate its line too.** The first would make a declared territory silently **wider** than declared, surfacing rules on files they do not govern; the second would drop whatever follows `/*` on the same line of a `wrangler.jsonc`. Both are red under mutation now.
- **When NOT to seal, measured and written down** ([ADR-0021 amendment](docs/adr/ADR-0021-blocking-drift-and-evidence-sealing.md)). Sealing this repository would seal 25 files, and **25 of 25 changed within 30 days** — a committed lock here would turn `check --strict` red on the first commit after every seal. The opt-in was right; the boundary was written nowhere, and an operator in a regulated setting is exactly the one who would seal everything on principle. **Seal what has stopped moving**: a handover, a release, a version entering operation.
- **The release stamp guard sweeps instead of listing.** It stopped at the first stale manifest, read one stamp per file (missing `marketplace.json`'s second), and checked a hand-kept list a new packaging could be forgotten from. Stamps are now found by walking `packaging/`, `plugins/` and `.claude-plugin/`; every stale one is named at once; the set of stamped files must equal the declared inventory exactly.

**Three survivors were not holes, and saying so is part of the result.** A `readToml` mutation is near-equivalent on well-formed TOML; the other two affect a line count and an informational note, not a verdict. **107 candidate mutations were not tried** — the bench is bounded per file. This is a sample, not a proof of coverage.

## 0.29.0

Two defects found on the **first field use** of v0.28.0's territory map, by the mission that asked for it. Both of the same species: a mechanism that is correct and unreachable is not a mechanism. [ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md) amended.

- **`runward/territory.md` is now read under `#`, `##` or `###`.** The mission titled theirs `# Territory` and the map was silently voided. The diagnostic existed and said the right thing — at line 16 of a 28-line output nobody scrolls. A map the operator believes is active and runward ignores is exactly the state v0.28.0's "every refused row is named with its line" rule exists to prevent; counting `#` reintroduced it one level up, at the file. A heading of any level still ends the section, so a following `# Notes` table is never eaten.
- **A map that could not be read now says so first**, under its own `This map was not read` heading, above every match: *"Everything below is derivation only — your declarations had no effect."*
- **`Territory coverage` moves from `characterize` to `status`.** v0.28.0 put the anti-rot instrument in the one command a governed mission has no reason to run: `characterize` announces it targets ungoverned repositories, and writes a `characterization.md` that is not a mission deliverable — the reporting mission deleted the file after reading it. `runward status` is the governed-mission read, at the same groom cadence, and it writes nothing. Files walked, files carrying a category, and map rows that matched no walked file with their line numbers — unchanged, reachable.

- **The release stamp guard now sweeps instead of listing.** Bumping 0.28.0 → 0.29.0 exposed three defects in the guard itself, all of the same species as the two above. It stopped at the *first* stale manifest, turning a release bump into a guess-and-retry loop when it already knew the whole answer. It read one stamp per file, so `.claude-plugin/marketplace.json`'s second stamp (`plugins[].version`, beside `metadata.version`) was never verified. And it checked a hand-kept list, so a future packaging carrying a product version and forgotten there would have shipped mislabelled, green. Stamps are now found by walking `packaging/`, `plugins/` and `.claude-plugin/` for any `"version": "x.y.z"` at any depth; every stale one is named at once; and the set of stamped files must equal the declared inventory exactly, which fails on a new manifest *and* on a vanished one. A host's own schema version (kiro's `"v1"`, copilot's `1`) stays out of scope by shape rather than by an exception someone must remember.

An ungoverned repository no longer gets the measure. That is correct: with no `runward/` there is no map and nothing to be inert.

All notable changes to the Runward tooling. Newest first. What is ahead lives in [ROADMAP.md](ROADMAP.md).

## v0.28.0 — the mission says what a manifest cannot — 2026-07-31

[ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md) complete. A deployment manifest declares an **execution topology** — an entry module, a schedule — never the nature of the code behind it. v0.27.0 derived the first half; this ships the second, and the mission that reported the gap now sees **both** rules it violated in July, not one.

- **`runward/territory.md` — the mission declares which of its files carry which category.** Four columns (pattern · category · effect · why), and precedence **named in three places rather than inferred**: the last matching row wins per (path, category); derivation < map < a rule's own `appliesTo`, **which the map may never narrow**. The map may remove what runward *guessed*; it may never remove what the maintainer *decided* — a mission able to silently shrink its own coverage would be the weak verifier [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md) refuses.
- **Markdown by necessity, not taste.** The match reason must carry `<source>:<linenum>`, and `JSON.parse` destroys positions. `remove` is a column rather than a `!` prefix, because the glob dialect declares "no negation" and a character that inverts a line disappears in a diff.
- **Every refused row is named with its line.** An unknown category, an empty `why`, a bad effect, a path escaping the project, a short row — each is reported, never dropped. A row the operator believes is working, that runward ignored, is the worst state of all. Rows inert *by construction* are found too: a category no rule governs can never surface one, and a `remove` for a category nothing derives removes nothing.
- **`characterize` gains `## Territory coverage`** — files walked, files carrying a category, and **map rows that matched no walked file, with their line numbers**. `rules --for` structurally cannot measure this: it only ever sees the paths its caller passed. Without this section, ADR-0043's own reopening condition on inert rows would have been a trigger nothing observes.
- **The vocabulary grew by one, on field evidence.** Ratification named seven categories; a mission showed `configuration` was too coarse — two rules shared the word with different subjects, so declaring a file "configuration" would have surfaced the typed-config rule as a **false positive beside the secret boundary it was meant to reach**. `secret-boundary` is now its own category, and the rule is stated: a category is split when missions must be able to declare its parts separately, never by quota.

The gate is unchanged, no project code is read, and `runward` never writes the map: `init` does not scaffold it and `update` does not refresh it — a file the tool rewrites is a file the operator stops owning, and that ownership is what makes a stale row visible in a diff. Self-gate green: 152 unit tests, smoke OK, OSCAL schema OK.

## v0.27.0 — the nature was declared twice, and nobody read it — 2026-07-31

A rule can now declare the **category** of artifact it governs instead of guessing everyone's directory names, and runward derives which files are in that category from a manifest **the project already wrote**. First increment of [ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md). The deterministic, zero-network gate is unchanged, and no project code is ever read.

On the layout that reported the gap — three Cloudflare Workers as entry files, no `cron/` directory anywhere — `rules --for src/entry.serve.ts` returned nothing in v0.26.0. It now returns the HIGH rule on background-job guardrails, with both levels of the reason: `governs=background-work ← wrangler.serve.jsonc triggers.crons`.

- **`governs:` on the nine rules whose territory reaches the client's tree**, using the seven-category vocabulary named at ratification. They **keep** their `appliesTo`: a category adds reach, it does not replace it. Dropping the globs in the same release would have made `--for src/cron/runner.ts` return nothing on a mission with no manifest — a coverage regression in the release that fixes coverage.
- **A Cloudflare Workers derivation adapter** reading `wrangler.jsonc` / `.json` / `.toml`: `main`, plus `triggers.crons` and `queues.consumers`. It reads a declaration the operator wrote, never the code behind it, and it derives an **intention** rather than a deployed state — the docs are explicit that commenting the `crons` key does not disable a trigger. A queue *producer* is not background work in that Worker, and Durable Object alarms live in code, so both stay out.
- **JSONC by a two-state scanner, then `JSON.parse` — not by regex.** Cloudflare's own canonical example carries `//` comments and trailing commas, so `JSON.parse` fails on the *nominal* case; and a regex would eat the `//` inside `"https://example.com//v2"`. What does not parse throws, so refusing is free.
- **TOML by a table-path automaton — not a line-scan.** Table headers are absolute paths, so a cron declared under `[env.production.triggers]` is named as such, and order-independence comes for free. A line-scan was measured reporting a production cron as the root schedule, and reading a `[triggers]` block inside a `"""` string as a declaration.
- **Several named manifests are several Workers**, each authoritative for its own entry — `wrangler -c` is how one repository holds a fleet, which is the shape that reported the gap. The genuine ambiguity is narrower: two manifests claiming the *same* entry, where nothing is derived and the conflict is named.
- **A new state, `unresolved`.** A rule declaring a category nothing binds here has not been evaluated — that is neither a scope nor a backlog, it is a missing binding, and `--for` says so under "Could not be asked". Resolution is mission-wide, matching is per-path: a category is unresolved only when no file anywhere carries it, never merely because the paths asked about fall outside it.
- **`unscoped.count` keeps its arithmetic**, and therefore its extensional meaning (no territory in *any* carrier). Its old gloss — "rules `--for` could not evaluate" — is now false, and `port-contract.md` says which. **A consumer reading it as a completeness denominator under-counts**: named here rather than left to be discovered.

Two defects fixed before they could bite: `explain` fell through to "not ruled on yet — an omission, not a scope" for a `governs:`-only rule, describing the best-decided rule in the corpus as an omission; and the partition test was a **tautology** whose three predicates were exhaustive by construction, so it could never fail and would have stayed green while the thing it guards became false. Self-gate green: 139 unit tests (+18), smoke OK, OSCAL schema OK.

## Ratification — territory declared in two parts — 2026-07-31

[ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md) is ratified, ahead of its 2026-12-01 deadline. **Nothing is built yet**, and the ADR says so plainly: ratify, then the vocabulary and the first derivation adapter, then the mission tier. **No CLI behaviour changes.**

- **The initial category vocabulary, named at ratification as the trigger required: seven**, derived from the nine shipped rules whose territory reaches the client's tree, none speculative — `background-work`, `scheduled-work`, `configuration`, `schema-migration`, `port-adapter`, `model-provider`, `startup`. Closed and small on purpose: a category is added when a shipped rule needs one, never in anticipation. The five rules whose paths runward scaffolds itself (`AGENTS.md`, the four `topology-*`) keep `appliesTo:` and gain no category — their paths really are invariant, which is the case the ADR preserves.
- **The first derivation adapter, named: the Cloudflare Workers deployment manifest.** `wrangler.jsonc`/`wrangler.toml` already declares the entry module (`main`) and its triggers (`triggers.crons`, queue consumers) — a normed file the operator wrote. runward derives the category from that declaration, never from the code behind it. Chosen first because it serves the population that reported the gap, and because it is the cleanest instance of the principle: the nature was declared twice already and nobody read it.
- **The two prior-art warnings are accepted, not dismissed.** A hand-typed taxonomy goes empty, so derivation stays the default gesture rather than the fallback. Any map the repository maintains rots, so the bidirectional report (files no rule governs, **and** rules that govern nothing) and the pruning of inert entries ship **with** the mission tier, not after it.

## An empty answer, made readable — and the carrier's premise corrected — 2026-07-31

A second field report ran `rules --for` on an entry-file layout (Cloudflare Workers) and got almost nothing back. Measurement corrected its headline — that layout matches three rules, one CRITICAL, through `adapters/` — and confirmed the substance with a number [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) should have computed before ratifying: **six of the 45 CRITICAL/HIGH rules declare a territory that reaches the client's tree.** That is the ceiling under the current carrier, not a plateau. **No CLI behaviour changes beyond the output below.**

- **An empty answer now renders what was looked for.** `--for` prints the declared territories verbatim, and `--json` carries them as an additive `territories` field. A repo whose layout uses none of these conventions can now *see* that, instead of reading a silence. This is ADR-0041's own trigger (a) remedy — "the output shape must change" — in the only form it permits: runward states the patterns it evaluated and says nothing about a tree it has not read. The field report asked for the line "your layout follows no anchored convention"; that is a hypothesis about the client's tree, and it is refused.
- **The gap that caused the report, closed.** `appliesTo` appeared nowhere in `docs/`, the README or the shipped workflows: the six folder conventions carrying that coverage were **implicit and unprescribed**, so no mission could know what layout would make it match. The rendered vocabulary closes it at the point of use.
- **The singular `worker` territory, restored.** `services/worker/index.ts` returned zero while `services/workers/index.ts` returned one — an `s` decided the match on a HIGH rule. The editorial pass had dropped `**/worker/**` as "a redundant singular variant"; it was not. The corpus doubles elsewhere (`migrations`/`migration`, `providers`/`provider`), and a test now pins the three pairs. Deliberately not widened to `jobs`/`job` or `ports`/`port`: those singular forms are rare, and adding them by symmetry rather than on evidence is the by-quota error the discipline forbids.
- **ADR-0041 amended: its premise for the carrier was false.** It argued "territory is a property of the rule, identical across missions", transposing [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md)'s reasoning for a different object — a non-scope really is invariant, a territory is the product of the rule's *subject* (invariant) and the mission's *layout* (variable). The corpus contradicts the premise on its own: the editorial pass anchored two rules to `execution-topology.md` **because runward scaffolds that deliverable itself**, and refused another because it "would have dictated the client's tree". The untouched half stands, though — a per-mission map does get restated and does rot.
- **[ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md), candidate: territory declared in two parts.** The rule names the category it governs and no path; which files are in that category is derived from what the project already declares (a deployment manifest, an ecosystem manifest — declarations, never code) and completed by the mission where derivation cannot reach. Nothing is built until it is ratified.

## v0.26.0 — no rule is silent about its territory any more — 2026-07-31

v0.25.0 left seven rules unruled: each targeted a real artifact while its own text prescribed no path, so a glob would have been inference presented as an auditable fact. A second pass ruled on all seven, weighing one question per rule — *does the rule already imply a location a sentence could make explicit, or would anchoring add a prescription it does not carry?* — with refusal as the default. **All 64 rules are now ruled on: 14 declare a territory, 50 declare, with a reason, that they have none, and none stays silent.** The deterministic, zero-network gate is unchanged.

- **Five refusals, each a distinct failure mode**, kept on the record because they are the reason the answer is trustworthy. `scaling-db-connection-pooling` would have dictated the client's tree, and its one literal path (`prisma/schema.prisma`) contradicts its own prescription — in that variant pooling lives in the connection URL, not the file. `contracts-governance` would have **under-declared** on `**/ports/**`, letting a DTO or SQL change read as out of scope — the false negative [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)'s own trigger names. `data-orphan-cleanup` says "cron" five times, but as a *cadence*, not a place: the glob would match every scheduled job and miss the orphan condition. `async-post-turn-pipeline` would have matched the code that is already correct and stayed silent on the turn handler where the violation lives. `observability-alert-configuration` shows its own alerts realised three ways, one of them outside the repository.
- **Two anchors, on a deliverable runward scaffolds itself.** `topology-sovereignty-by-data-class` and `topology-usage-registry-present` now name `execution-topology.md` in their text and declare it as their territory. Naming it prescribes nothing to the client: the shipped mission template already carries the very columns each rule demands — `Sovereignty level` for one, and a `## Usage registry` table matching the other term for term.
- **A premise corrected along the way.** The usage registry was thought to be missing from the mission layout; it has lived in `execution-topology.md` all along, and runward's own dogfooded mission fills it. The rule's closing sentence is also sharpened: it feeds `runward compliance` **through its conformance row**, never a compliance declaration in itself — the flow was real but indirect, and the text now says which.
- **Silence can no longer come back.** A test asserts that no shipped rule declares neither `appliesTo:` nor `noTerritory:`, so a rule added later must be ruled on rather than quietly reopening the ambiguity v0.25.0 closed.

Self-gate green: 119 unit tests, smoke OK, OSCAL schema OK.

## v0.25.0 — every rule now says whether it has a territory, or why it has none — 2026-07-31

v0.24.0 shipped `rules --for` with four rules declaring a territory and sixty saying nothing. Saying nothing turned out to be the flaw: a rule nobody had ruled on and a rule that deliberately governs no class of files read exactly alike. That is [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md)'s own lesson — an *undeclared* scope is a weak verifier — applied one level down. This release closes it, and completes the editorial pass over all 64 rules. The deterministic, zero-network gate is unchanged.

- **A declared absence of territory ([ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md), amended).** `noTerritory: <reason>` states that a rule governs no class of files **and why** — the exact mirror of `nonScope:`, per-rule, optional, prose, with the reason as the valuable part. There are three states now, reported as three: a declared territory · a declared absence, with its reason · not ruled on yet. `runward explain` prints whichever applies, including the third ("an omission, not a scope"). Only the last is a backlog, and only it is meant to reach zero.
- **The editorial pass, over all 64 rules.** Five parallel readers classified every rule against **its own text**, with the negative decisions treated as first-class results: **12 declare a territory · 45 declare they have none, with a reason · 7 remain unreviewed.** The unreviewed count went from 60 to 7.
- **It corrected the seeds it inherited.** `config-secrets-boundary` carried `**/secrets/**` and `**/env/**` — conventional patterns appearing **nowhere** in the rule's text; replaced by `**/config.ts`, which the text names. `data-migrations-forward-only` carried `**/migrate/**`, which does not match `scripts/migrate.ts` — the runner the rule itself cites; now `**/migrate.*`.
- **It refused territories that would have been inferred from a slug.** `process-adr-and-journal` names no ADR directory; `tools-registry-pattern` names no location; `cache-three-tier-architecture` is misleadingly named and governs prompt-prefix stability, not an architecture. Each stays unscoped **by declaration**, with the reason readable.
- **The seven left unreviewed are a named state, not a remainder.** Each targets a real artifact while its own text prescribes no path, so a glob would be inference presented as an auditable fact. The fix is a sentence anchoring the rule's text — rule authoring, not matching. A test pins the list so it cannot grow in silence, and the ROADMAP carries it.

`unscoped.count` keeps its v0.24.0 meaning; `declaredNoTerritory` and `unreviewed` are additive beside it ([ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md)), and `noTerritory` joins the per-rule contract. Self-gate green: 119 unit tests, smoke OK, OSCAL schema OK.

## v0.24.0 — ask which rules govern this file, and see why — 2026-07-31

`AGENTS.md` has always prescribed confronting the craft rules "at the point of action, not from memory". Until now nothing made that mechanisable: `rules` filtered by phase, and `govern` alone returns twelve. This release ships the primitive the 2026-07-31 field report asked for, and ratifies the two decisions behind it. The deterministic, zero-network gate is unchanged — `--for` is a reading, never a verdict.

- **`runward rules --for <paths>` ([ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md), ratified and implemented).** Returns the rules whose declared territory covers the given project-relative paths, **with the pattern that retained each one** — the `git check-ignore -v` model, so the answer is auditable rather than magical. Matching is on an optional `appliesTo:` glob list the rule declares, never on `tags:` (thematic, and inferring territory from them would be a heuristic with no reason to render). Paths come from the caller: runward never computes the change set, so the composition is yours — `git diff --name-only "$BASE...HEAD" | xargs runward rules --for`.
- **A declared glob dialect, and no new dependency.** Five constructs — leading `**/`, trailing `/**`, `**`, `*`, `?` — stated in the machine surface and echoed in `--json`. No braces, no ranges, no negation: a rule author reads the whole grammar in five lines, rather than inheriting semantics nobody in the mission could state. `**/cron/**` matches `cron/x`, `src/cron/x` and `cron`, never `src/cronjob.ts`.
- **It never pretends to be exhaustive.** Every run reports how many rules declare no territory and were therefore not evaluated, with the standing caveat *surfacing, never masking*. On a fresh rule set that count is most of them, and saying so is the point: a primitive answering "nothing" where it means "I was never told" would be the weak verifier [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md) warns about. **Always exits 0**; exit 2 only when the question cannot be asked (an absolute path, or one escaping the project).
- **No filesystem access, no git, no model.** Pure string matching, so a path need not exist yet — you can ask *before* writing the file — and nothing depends on the caller's working directory. Windows separators give the same answer as POSIX ones.
- **Four territories seeded**, on the [ADR-0020](docs/adr/ADR-0020-rule-evidence-signatures.md) "never wholesale" discipline: `async-job-guardrails`, `async-scheduled-maintenance`, `config-secrets-boundary`, `data-migrations-forward-only` — each because the rule's own text is about a specific artifact class. `security-mcp-server-pinning` was considered and left unscoped: its text prescribes no path, so a territory would have been invented. **4 of 64 rules declare a territory**: the primitive is complete, its coverage is not, and the editorial pass is the remaining work.
- **[ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md) ratified**, and `iterate.md` now names `--for` as the precise gesture (its own reopening trigger, followed through), paired with `--phase` since `--for` is not exhaustive.

`rules --json` gains `appliesTo` per rule and, under `--for`, the `selector`, `unscoped` and `matchedBy` fields — additive per [ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md); `port-contract.md` documents the new surface. A regression test pins the case that motivated all of it: the cron and the secret relay that passed a green gate with both rules unread now surface with their patterns. Self-gate green: 116 unit tests, smoke OK, OSCAL schema OK.

## Ratification — the two field-report candidates, decided — 2026-07-31

[ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) and [ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md) shipped as candidates in v0.23.0, each with a dated trigger governing its ratification. Both are ratified, ahead of their deadlines. **No CLI behaviour changes.**

- **[ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md) — accepted, with its implementation already shipped.** The method change (`iterate.md` carries the craft-rule confrontation step) went out in v0.23.0; this ratifies the position behind it: rule confrontation is a continuous obligation of building, not a gate-crossing ritual. The Ratification section records what shipped, what was deliberately left silent (the non-building workflows), and the honest limit — the gesture is coarse until ADR-0041 lands.
- **[ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) — accepted as a direction; nothing is built.** Unlike [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md), which shipped its implementation the day it was ratified, this one commits to work that does not exist yet, and its Ratification section says so plainly. It settles the design so the implementation re-litigates nothing (the rule file is the carrier; matching is on declared territory only, never on thematic tags; the match reason is rendered; unscoped rules are counted; always exit 0; runward never computes the change set) and names what stays open (which rules get `appliesTo` first, the glob dialect, the monorepo resolution base).
- **ROADMAP re-groomed**: `Next` now carries the implementation of ADR-0041 rather than the choice to make.

## v0.23.0 — a green row does not travel forward in time — 2026-07-31

A field report from a mission built with runward: two mapped craft rules — `async-job-guardrails` (HIGH) and `config-secrets-boundary` (CRITICAL) — violated in one afternoon, on code the agent had just written itself, with `check --strict` green from start to finish. The gate behaved exactly as declared. What the report exposed is that the declaration was incomplete, and that the method stops talking about the craft rules precisely where most of a product's code gets written. Investigated by a four-agent read (adversarial fact-checking against the code, ADR-corpus constraint analysis, external prior-art survey, feasibility mapping). The deterministic, zero-network gate is unchanged.

- **The gate's temporal blind zone, declared.** `GATE_NON_SCOPE` ([ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md)) named the *depth* blind zone — a green row never proves the evidence implements the rule — and was silent on the *temporal* one: the operator's judgment was made about the code that existed when the row was written, and nothing re-judges code added later under an already-accounted-for rule. Every run still re-verifies that cited pointers resolve and that sealed evidence has not drifted; the semantic judgment is what does not travel. ADR-0040 was in default of its own standard ("every gate names what it cannot verify"); it no longer is. Read it in full with `runward explain <rule>`.
- **Craft-rule confrontation is continuous, not a crossing ritual ([ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md), candidate).** The coupling was empirical, not assumed: across the eleven shipped workflows the craft rules were named in `architect`/`floor`/`govern`/`handover` — the manifest-bearing ones — plus `verify`, and nowhere else, while `AGENTS.md` prescribes confronting them "while building, at the point of action, not from memory". `iterate.md` now carries the step in the gated workflows' own form, with the gesture available today (`runward rules --phase <phase>`) and no wait on the matcher below. Accounting rides the artifact `iterate` already mandates — the ADR that locks a switch names the rules confronted; ordinary maintenance is a reading discipline with no artifact, and the step says so, as it says that `check --strict` verifies none of it. Missions pick it up with `runward update`.
- **`rules --phase <unknown>` is misuse now, not an empty answer.** It returned zero rules and exit 0 — in a CI step, indistinguishable from "nothing applies here". It exits 2 and names the gated phases, derived from `GATED_DELIVERABLES`. The `--phase` help was stale too (it omitted `handover`, gated since [ADR-0026](docs/adr/ADR-0026-handover-as-a-gated-conformance-phase.md)); it is derived from the same single source, so a new gated phase can never be missing from it again.
- **A matching primitive, decided but not built ([ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md), candidate).** `runward rules --for <paths>` would make "confront at the point of action" mechanisable, matching on an optional `appliesTo:` glob list — a territory the rule *declares* — never on `tags:`, which are thematic and would make the correspondence an implicit heuristic. The matched pattern is rendered on the `git check-ignore -v` model, unscoped rules are counted and reported, and it always exits 0. Nothing ships until it is ratified.
- **Two refusals, on the record with their citations.** A gated Iterate deliverable is rejected by name in [ADR-0033](docs/adr/ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md) (permanent red on every mature mission, or false completion). `check --changed <base>` would put a mutable, third-party-writable git ref in the exit-code path against the port contract's "same working tree ⇒ same verdict", is neutralisable by a `fetch-depth: 1`, and would be the second gate the doctrine denies. runward never computes the change set itself: paths come from the caller ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)). The operator composes — `runward rules --for $(git diff --name-only)` to inform, `check --hooks` to block ([ADR-0008](docs/adr/ADR-0008-opt-in-hook-seam-around-check.md)).
- **Also carries the 2026-07-29 ratification below** — the six brownfield/characterize ADRs (0033–0038) moved to `accepted` with typed evidence pointers, plus the test hardening that preceded them. That work was committed as governance, without a release; this is the release it reaches.

`port-contract.md` is realigned with the code (`rules --json` carries `tags`, `nonScope`, and the `gateNonScope` envelope field). Guards: +1 unit, +2 smoke. Self-gate green: 110 unit tests, smoke OK, OSCAL schema OK.

## Ratification — the brownfield/characterize ADRs, status catches up to code — 2026-07-29

Six ADRs from the 2026-07-20 resume-existing (brownfield) audit — [ADR-0033](docs/adr/ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md) (`status` names the iterate steady-state and the reopening watch) and [ADR-0034](docs/adr/ADR-0034-characterize-sees-the-whole-tree-monorepos-and-deterministic-ordering.md)–[ADR-0038](docs/adr/ADR-0038-mine-across-languages-groups-by-family-and-never-resurrects-a-ratified-draft.md) (`characterize` sees the whole tree, extracts pinned versions offline, reports churn/bus-factor, detects infra & framework/DB signals, mines dependency families) — shipped across past releases and have run under test on `main`, yet their status stayed `proposed`. That is the doc↔code drift the gate condemns, inverted: the code was ahead of its own decision record. This entry closes it. **No CLI behaviour changes.**

- **Ratified, with evidence.** Each of the six ADRs moves to `accepted (ratified 2026-07-29 — see Ratification)` and gains a `## Ratification` section carrying typed evidence pointers (`file:…#symbol`, `test:…`) to the shipped implementation and its tests, on the [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md) model.
- **Proof hardened first.** Three status/mission unit tests added (byte-stable trigger sort across ADRs; the `**Trigger set on**` line never taken as preview prose; `analyze().steadyState` false on an incomplete mission) and two `characterize` smoke assertions (a nested sub-package surfaced end-to-end, ADR-0034; pinned versions extracted from the lockfile offline, ADR-0035) — the two ADRs that had unit coverage only. Self-gate green; 109 unit tests.
- **Honest scope note.** Ratifying the product ADRs under `docs/adr/` does not change `runward status` output: its reopening watch reads the *mission's* decision journal (`runward/adr/`), not the product ADRs. This is a governance act, not a behavioural one.

## v0.22.0 — every gate names what it cannot verify — 2026-07-21

An adversarial confrontation of the repo against the field survey on code-as-harness (arXiv 2605.18747 — a v1 preprint; a survey describes a landscape, it does not validate a product) produced one candidate ADR in the morning, its sizing note in the afternoon, and this release in the evening. The survey named the missing abstraction verbatim: "a verification stack with explicit scope […] Each artifact should declare what it verifies, what it cannot verify." The deterministic, zero-network gate is unchanged — it now travels with its declared blind zone.

- **Per-rule non-scope declaration ([ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md), proposed → sized → ratified the same day).** Generalises [ADR-0005](docs/adr/ADR-0005-baseline-worktree-test-validation-out-of-scope.md)'s honesty into a first-class property: `GATE_NON_SCOPE` — what NO green row proves — stated once in the machine surface (`rules --json` / `explain --json`, additive fields per [ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md)), printed by `explain` (Non-scope / Gate-wide lines), and as a banner in the ISO readiness draft: an assessor reading green also reads what green does not prove. Per-rule `nonScope:` frontmatter only where a rule's blind zone is narrower — four rules seeded, the flagship signed rule included; the rest is written when practice reveals a blind zone, not by quota. Gate path, manifest shape and the [ADR-0003](docs/adr/ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md) lint untouched.
- **Survey-grounded documentation pass, skeptic-audited.** A third durable guardrail talking point in `positioning.md` (the SWE-bench "solved-correctly" oracle-adequacy study — with the mandatory rule never to cite the survey's "signals that cannot hallucinate" without its §3.4 fast-path context, which runward refuses by [ADR-0001](docs/adr/ADR-0001-enforce-declared-rule-conformance-at-the-gate.md)/[ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md)); [ADR-0006](docs/adr/ADR-0006-rule-set-evolution-as-tracked-migrations.md) amended — every future rule-set migration entry is a change contract (invariants, falsifier, rollback); a distillation-surface section in `regulated-adoption.md` (traces stay yours by dated ADR, not promise); the AHE loop recorded as the operator-satellite's citable frame in the ROADMAP — a frame, not a demand signal.
- **Release workflow: `actions/attest-sbom` → `actions/attest`** (deprecated upstream; same inputs, SHA-pinned, least-privilege layout unchanged). This release run is its first live proof.

## v0.21.1 — the three tiers, named — 2026-07-21

A maintainer dogfooding pass (operating runward from a well-kept coding harness) surfaced that the verification architecture was fully built but never named — and that everything beyond it belongs to the operator, not the CLI. This release names the boundary and locks it by ADR. The deterministic, zero-network gate is unchanged; no CLI change.

- **The operator layer stays outside the CLI ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)).** Adoption audits over harness transcripts, operator-side cost telemetry and machine-wide instruction files are the operator's own tooling — never the MIT CLI, which reads the mission repo and nothing else ("local with no data flow", [ADR-0031](docs/adr/ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md)). A voluntary satellite is deferred behind an explicit demand trigger (the [ADR-0028](docs/adr/ADR-0028-distributable-packagings-across-harness-channels.md) channel-signal watch).
- **The three-tier verification doctrine, named.** A concepts page on the documentation site maps a name onto what the ADRs already implement: Tier 1 — the deterministic gate (unforgeable, decides phases); Tier 2 — the operator's mechanical hooks (inform and correct, never gate — the [ADR-0008](docs/adr/ADR-0008-opt-in-hook-seam-around-check.md) seam); Tier 3 — advisory review (findings in, operator decides — [ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md)). One partition question: *must this check be unforgeable?* Zero new mechanics: [runward.dev/docs/concepts/three-tiers](https://runward.dev/docs/concepts/three-tiers/).
- **"Wire your harness" — an operating guide in the honest per-channel format.** Extends the gate-wiring doc with what each harness can carry beyond the turn-end hook, tier by tier, no channel privileged, nothing auto-wired ([ADR-0012](docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md) holds in full): [runward.dev/docs/operating/wire-your-harness](https://runward.dev/docs/operating/wire-your-harness/).
- **Roadmap groomed.** Next carried the naming work (shipped with this release); Later gains the official plugin-directory submission for the Claude Code plugin (discoverability — the third-party marketplace channel already works); Someday parks the operator-layer satellite behind the demand trigger.

## v0.21.0 — one command, the whole chain green — 2026-07-19

A launch-review pass (multi-agent, adversarially verified) found the first-contact story promised more than one command delivered. The fix is in the product, not the copy: the demo path now *is* one command.

- **`init --example` ends by running the gate itself.** After scaffolding the filled `request-triage` reference, `init --example` chains `check --strict` on the fresh mission — the whole chain goes green in front of you, in one command, exactly as advertised. Deterministic, zero-network, skipped under `--dry-run`. The example's next-steps now point at the guard demo (`cd code && npm install && npm run demo` — req-005 carries a fabricated account reference the deterministic guard refuses, fail-closed) instead of asking you to run a check that already ran.
- **README accuracy pass (the HN landing).** The hand-over uniqueness claim is aligned with the project's own sourced comparison (Spec Kitty *does* carry the mission past tested code; runward's difference is a plain-code succession check and standardized OSCAL evidence, not bespoke YAML). "FDE" is expanded on first use (Forward Deployed Engineer), the Why section leads with what runward does, and the sourced comparison + dropyour case study are linked from the Documentation list.
- **Example docs.** The reference floor's README now counts all five demo requests, including the guard-refused fabrication.

## v0.20.0 — regulated-adoption evidence, current OSCAL, audit-hardened — 2026-07-19

Sharpening the wedge for regulated adoption, tracking the current OSCAL release, and closing a security audit — the deterministic, zero-network gate unchanged.

- **Sovereign engineering evidence for regulated environments ([ADR-0031](docs/adr/ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md)).** A CycloneDX SBOM and OIDC provenance on every release, a `regulated-adoption` sheet (what standard vendor due-diligence does *not* apply to a local, no-data-flow CLI, and what does), and honest licence framing — runward *feeds* an ISO/IEC 42001 · NIST AI RMF · EU AI Act programme, never claims to satisfy one. A drift guard over `positioning.md` and the adoption sheet keeps the copy from out-running the code.
- **Track the current OSCAL release ([ADR-0032](docs/adr/ADR-0032-track-current-oscal-and-watch-dated-external-facts.md)).** The evidence pack now emits **OSCAL 1.2.2** (was 1.1.2), proven by a third-party tool (IBM compliance-trestle) ingesting it in CI, not only our vendored schema check. Future OSCAL/regime drift is watched out-of-band by a scheduled, non-blocking workflow that opens an issue — never the gate.
- **Security hardening (from a multi-agent audit).** SBOM generation moved out of the OIDC-privileged publish job into a `contents: read` job; every CI checkout sets `persist-credentials: false`; the rule-signature ReDoS screen now also rejects overlapping-alternation patterns (`(a|a)+`); the Node floor is `>=22.12` (Node 20 is EOL, dropped from the CI matrix). No behaviour change to the gate.
- **TypeScript 7 forward-compat, without adopting it yet.** `tsconfig` declares `types: ["node"]` so the build no longer relies on TypeScript's implicit `@types` auto-inclusion — a behaviour the TS 7 native (Go) compiler drops (it was failing the build with 102 errors). Backward-compatible with TS 5.x; Dependabot **ignores `typescript` major bumps** until TS 7 is GA-stable.
- **Docs & README.** The hosted documentation ([runward.dev/docs](https://runward.dev/docs)) is surfaced from the README with a plain, direct entry, a sourced comparison vs Spec Kit / BMAD / Kiro / OpenSpec / Spec Kitty, and a *built with runward* case study. Evergreen, version-less OG banner; broken-image fixes (absolute banner URL, static npm badge).

## v0.19.0 — agent-operable baseline + harness detection — 2026-07-17

Making "an AI agent can discover, install and operate runward with no human at the keyboard" true — without leaning on a detection layer that can only ever be partial ([ADR-0030](docs/adr/ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md)).

- **Neutral baseline by default.** `init` with no explicit `--tools` writes only the vendor-neutral core (`AGENTS.md` + `.agents/skills/`); `--yes` no longer defaults to the `claude` profile and the wizard pre-checks nothing. No harness is privileged — a channel is an opt-in the operator adds afterward. Closes a standing vendor-neutrality breach.
- **`runward wire` — best-effort harness detection.** Detects the AI harness running the command via a verified runtime signal (`CLAUDECODE` for Claude Code and Cowork, `GEMINI_CLI`, `CURSOR_AGENT`), falling back to a config-file marker, then `undetermined`. It recommends the matching auto-trigger channel and points at the inert sample — it never wires anything (`wires:false` invariant, [ADR-0012](docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md)) and never prompts, so an agent run never hangs. On `undetermined`, the doctrine (AGENTS.md + the plugin SKILL.md) tells the agent to *ask* the operator which tool they use rather than guess.
- **`check --json` — a machine contract.** A stable, deterministic JSON verdict (current gate, deliverable states, conformance gaps) so an agent drives on data, not scraped text. Hook output is routed to stderr under `--json` so a subprocess can't corrupt the object.
- **Hardened non-interactivity.** `isNonInteractive()` also returns true when stdin is not a TTY or `CI` is set — an autonomous run never hangs on a prompt it cannot answer.
- **Guards.** New unit tests for detection (signal precedence, per-family config detection, `undetermined`, the `wires:false` invariant) and smoke assertions for `wire --json` and `check --json[ --strict]`. Self-gate strict green; 65 unit tests.

## v0.18.1 — pre-marketplace hardening (a 5-agent audit, closed) — 2026-07-16

A five-agent adversarial audit before public marketplace submission (security, compliance, code coherence, packagings, architecture). The verdict was sound — self-gate honestly green, no cited-not-applied, architecture faithful to its own doctrine — with two real security holes to close and some polish. All fixed here.

- **Seal traversal closed (security).** The evidence-seal *writer* confined paths to the project (v0.17), but the *verifier* did not — a forged `evidence-lock.json` with a `../` or absolute key made `check --strict` read and hash a file outside the project (an arbitrary-file-read oracle, plus a DoS via `/dev/zero` or a huge file). The verifier now contains lock keys exactly like the writer.
- **Command injection closed in the GitHub Action (security, CWE-78).** `action.yml` interpolated `${{ inputs.version }}`/`${{ inputs.path }}` into the `run:` script. They now pass through the environment, and `version` is allowlisted (semver or a dist-tag) — a malicious input can no longer inject shell (the pattern marketplace review blocks).
- **ReDoS screen bypass closed (security).** A nested quantifier hidden in a character class (`([^()]+)+`) slipped past `unsafeSignature` and hung V8 >8s (a CI DoS). The screen now normalizes character classes first, catching `([^()]+)+` and `([a-z]+)*` while leaving real signatures safe.
- **`runward rules` no longer mislabels the gated hand-over rules.** The four `handover` rules (one CRITICAL) showed as "Unmapped (advisory)" because of a stale hardcoded phase list; the gated phases now derive from `GATED_DELIVERABLES`, so a new gated phase can never be mislabelled again.
- **Packaging polish before submission.** Four `packaging/*` manifests stuck at `0.17.0` are bumped; the Codex `marketplace.json` is rewritten to the documented schema (`interface.displayName`, `source` object, `policy`, `category`); the Cursor tier in `docs/distribution.md` is corrected to *advisory `stop`* (not per-tool); the `npx --yes` supply-chain posture is documented with how to pin.
- **Guards so it can't regress.** New unit tests for the seal-traversal rejection, the ReDoS screen, and a packaging version/hook check that would have caught the `0.17.0` drift. The repo mission's ADR count is harmonized to 28.

## v0.18.0 — install runward from where you already work — 2026-07-16

Turning the lead into distribution. A channel benchmark confirmed the "install channel + deterministic gate" pattern is not proprietary to Claude Code — it's replicated across at least four harnesses, plus the canonical CI channel. So runward now publishes a **family of distributable packagings** ([ADR-0028](docs/adr/ADR-0028-distributable-packagings-across-harness-channels.md)), each honestly tiered by how hard its gate can block. Same one line everywhere: `runward check --strict`.

- **GitHub Action (the hard governance gate).** `action.yml` at the repo root: `uses: stranxik/runward@<sha>` as a required status check blocks the *merge* on a gap. Open, no secrets. The highest-leverage channel and the one aligned 1:1 with governance.
- **Claude Code plugin + marketplace.** `/plugin marketplace add stranxik/runward` → `/plugin install runward-gate@runward`: a `Stop` hook that surfaces `runward check --strict` at turn end, plus an orientation skill.
- **Siblings for every hard-Stop harness.** `packaging/` ships Gemini CLI (`AfterAgent`), OpenAI Codex (`Stop`), and GitHub Copilot / VS Code Agent hooks (Claude-compatible JSON) — the same one line at turn end.
- **Soft-gate packagings, labelled soft.** Cursor and a Kiro Power bundle a per-tool hook, documented explicitly as *per-tool, not end-of-turn* — because Cursor's `stop` and Kiro's IDE Stop/save cannot hard-block. No operator is misled.
- **MCP descriptor — discovery only.** `packaging/mcp/server.json` for findability, with a README that hammers the honest line: an MCP tool is model-controlled — findable, never obeyed. It would expose read-only surfaces at most, never the enforcement path. Positioning runward-as-MCP as a gate would be the exact "soft judge dressed as hard" the product rejects.
- **One honest map.** [`docs/distribution.md`](docs/distribution.md) tiers every channel: hard-at-merge (CI), hard-at-turn-end (client hooks), soft-per-tool (Cursor/Kiro), discovery-only (MCP). The tiering is itself a credibility signal in a market that overclaims.

**Invariants preserved**: the operator installs (runward auto-wires nothing — `/plugin install`, `uses:`, `gemini extensions install` are your gesture); never a runtime (every packaging is a thin shell around the exit-code port); vendor-neutral (a family published together, no agent privileged; the canonical surface stays `AGENTS.md` + `.agents/skills/`). Publishing to the marketplaces is the maintainer's outward-facing gesture, like the npm publish — the packages are prepared, not auto-submitted.

Also: the message pass — the README leads its differentiators with the four grounds a code-level benchmark confirmed nobody else pairs (rule-level gate with sealed evidence, gated hand-over, published OSCAL spec), and the OSCAL mapping is presented as the citable reference implementation.

## v0.17.0 — a second audit, honestly closed; the gate reaches into BMAD — 2026-07-16

We ran our own method on ourselves again: a factual multi-agent audit (adversarial internal + a fresh code-level competitive benchmark). It confirmed the four exclusive grounds hold — nobody else pairs a rule-level gate with verified evidence, signed-and-sealed evidence, a gated hand-over, and a deterministic OSCAL mapping — and it broke five things shipped in v0.15/v0.16. Closing your own defects in daylight is the doctrine, not an embarrassment.

- **Path traversal closed.** `file:/etc/hosts` and `file:../../etc/hosts` passed the gate green, contradicting ADR-0019's promise that evidence resolves under the three project bases. Resolution is now confined: absolute paths are rejected, `../` cannot climb out of a base. Evidence must be **in your project**.
- **ReDoS closed.** A rule signature with nested quantifiers (`(a+)+`) hung the gate on adversarial content — a self-inflicted CI freeze. A deterministic screen rejects the known-dangerous shape before the regex is compiled; a signed rule with such a pattern fails fast, never hangs.
- **OSCAL reconciled with its own spec.** `renderOscal` took the first manifest row (`.find()`), so a multi-phase rule's `implementation-status` depended on deliverable order — `implemented` where a later `deviated` row means `partial`. It now aggregates every row of every mapped rule (spec §3), order-independent. The readiness link is derived from the pack's regime (no dangling `./iso-42001-readiness.md` in an `eu-ai-act` pack); `description`/prefix/`links` are now normative in the spec. The "implementable independently, byte-for-byte" promise holds off the nominal path.
- **The seal's scope stated plainly.** ADR-0021 and the spec §6 now say it: the content-addressed seal detects drift and deletion, not falsification by a writer who recomputes the hash — the trust anchor is the signed git history. A repo-resident, zero-secret gate holds no signing key by design.
- **`RUNWARD_NOW` validated; `doctor`'s adapter count fixed; doc regressions fixed.** A malformed date now falls back to today instead of emitting schema-invalid OSCAL; `doctor` counts real adapters, not the README (substituting an adapter for a stray file no longer passes); `first-mission.md` documents the five wizard prompts (was four) with current counts; the README lists Kiro and `execution-topology.md`.
- **EU AI Act date corrected (2 August 2026 → 2 December 2027).** The Digital Omnibus on AI (Council final green light, 29 June 2026) postponed the Annex III/IV high-risk obligations; our regime data and docs carried the stale deadline, which the OSCAL readiness draft printed. Corrected as a factual fix (the date was already postponed before v0.16). The 2 August 2026 milestone stays real for Article 50 transparency, governance and GPAI enforcement. `positioning.md` retires the stale deadline talking point for two durable ones: **FedRAMP RFC-0024 forbids GenAI-produced evidence** (a federal validation of the zero-LLM gate) and the **Delve affair** (AI-prefilled SOC 2 audits) — both arguing AI-produced evidence is not trusted.
- **The gate reaches into BMAD (ADR-0027).** BMAD's `bmad-code-review` exposes a review-layers seam whose instruction may "run anything (e.g. an external reviewer via bash)". `templates/adapters/bmad-review-layer.toml` adds runward's deterministic gate as one review layer beside BMAD's LLM reviewers — a complement running on their distribution, same inert exit-code port as every adapter (adapters 5 → 6), no orchestrator privileged.

## v0.16.0 — the hand-over is gated, the mapping is citable — 2026-07-16

The whitespace phase: the three grounds the audit told us to own, shipped as product.

- **Hand-over becomes a gated conformance phase ([ADR-0026](docs/adr/ADR-0026-handover-as-a-gated-conformance-phase.md)).** "The hand-over is proven by a real task redone without you" was Definition-of-Done prose no gate verified — the flagship differentiator was the least backed claim in the chain. Now `runward/handover.md` is a gated deliverable (the kit index, the **redone-task proof record**, the **named succession**, the provider-swap drill) verified by four new handover rules (`handover-redone-task-proof` CRITICAL, `handover-runbook-executable`, `handover-agents-charter-final`, `handover-succession-named`); rules 60 → 64, a fifth phase skill surfaces the craft at the point of succession. The reference mission ships a filled note **and its finalized `AGENTS.md`** — `init --example` now lays down the leave-behind charter, not the scaffold. The repo's own mission records the honest state: no succession has occurred (single maintainer), the redone-task row is a reasoned `n/a` with the mechanical half (pristine CI reproduces build, tests and the strict gate) pointed at, and the flip condition named.
- **The OSCAL mapping is a published, citable mini-spec ([ADR-0025](docs/adr/ADR-0025-oscal-mapping-published-as-a-citable-spec.md)).** [`docs/spec/runward-oscal-mapping.md`](docs/spec/runward-oscal-mapping.md) v1.0, implementation-independent: the decision → ADR → manifest → OSCAL chain, the implementation-status derivation rules (with the paper-coverage asymmetry stated: mapping a rule without accounting for it never upgrades the status), the deterministic UUID seed grammar, the regime-lens stamp, byte-identity conditions, the evidence-lock v1 format, and conformance criteria for independent implementations. The golden fixture is the normative example — where prose and fixture disagree, the fixture wins. `CITATION.cff` makes citing mechanical.
- **Kiro joins the adapter family ([ADR-0018](docs/adr/ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) amended).** `--tools kiro` mirrors the phase skills as steering files (`.kiro/steering/`, `inclusion: auto` — Kiro's relevance idiom, same semantics as the SKILL.md trigger; `AGENTS.md` is read natively, so the charter needs no extra file), and `templates/adapters/kiro-hooks.json` ships the turn-end gate (`Stop` trigger, the same inert one line as the Claude Code hook; adapters 5 → 6). The mission's traced decisions inform in-session enforcement in one more harness — as a complement riding the harness's own seams, never a runtime of ours.

## v0.15.0 — the gate verifies the evidence, and runward gates itself — 2026-07-16

A factual multi-agent audit confirmed the one honest gap the ADRs had already named: the gate proved a decision was *traced*, never that the trace pointed at anything real — a pointer at an existing-but-empty file passed green. This release executes the tightenings the ADRs pre-authorized (ADR-0001 trigger b, ADR-0004's promotion trigger), still bytes, never judgment, zero-LLM:

- **Typed evidence pointers, verified ([ADR-0019](docs/adr/ADR-0019-typed-evidence-pointers-verified-at-the-gate.md)).** Evidence can declare its nature — `file:PATH[:LINE][#SYMBOL]`, `test:PATH[::NAME]`, `adr:NNNN`, several per cell — and `check --strict` verifies each: resolution, non-empty content, line count, symbol/test-name presence. For every `applied` row, typed or prose, a resolvable path must point at a **non-empty** file: the hollow-evidence pass is closed. Free prose stays valid — it is the operator's judgment.
- **Rule signatures ([ADR-0020](docs/adr/ADR-0020-rule-evidence-signatures.md)).** A rule can declare a `signature:` regex its applied evidence must contain. `frontier-deterministic-boundary` ships signed (`assertGrounded|GroundingError|fail-closed`): the founding cited-not-applied incident is now caught deterministically end to end. Shipped conservatively — one flagship signature; a wrong signature is a false red, and false reds erode the gate.
- **Drift blocks; a green gate can be sealed ([ADR-0021](docs/adr/ADR-0021-blocking-drift-and-evidence-sealing.md)).** A stale `applied` pointer now fails `--strict` (ADR-0004's own promotion trigger, executed). `check --freeze` seals a green gate: every resolvable evidence file hashed (SHA-256) into `runward/evidence-lock.json`; a sealed file that later changes or disappears fails the gate until re-verified and re-sealed. `--freeze` replaces the old seal (re-sealing always possible) and refuses to seal a red gate.
- **`runward manifest --sync` ([ADR-0023](docs/adr/ADR-0023-manifest-sync-scaffolds-form-never-content.md)).** The table plumbing stops feeding rubber-stamps: missing expected rows scaffolded with an **empty status** (the gate refuses them until the operator decides), renamed slugs migrated in place with status and evidence preserved, template placeholders retired, duplicates/unknowns reported and never deleted. Form only, never content.
- **`runward rules --json` and `runward explain <rule>` ([ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md)).** The rule set becomes a supported machine contract (`{ runward, source, count, rules }`, sorted, versioned-additive) for dashboards, editor extensions and CI; `explain` prints a rule's contract (impact, phases, ASI, signature, why) and full body inline — the rationale one command away instead of a doctrine excavation.
- **Regime mappings as versioned data ([ADR-0022](docs/adr/ADR-0022-regime-mappings-as-versioned-data.md)).** The ISO 42001 clauses, EU AI Act Annex IV rows and NIST crosswalk move out of the code into `regimes/<regime>@<version>.json`; `compliance --regime-version` pins the lens, and every draft plus the OSCAL stamp which mapping version produced them. A regulatory change becomes a data-file addition. Real-ingest testing was evaluated and honestly declined — no credible maintained OSS OSCAL ingester exists today (dated rejection table + manual GRC ingest procedure in `docs/compliance/oscal-ingest.md`); the offline proof remains NIST-schema validation with negative controls.
- **The verify pass leaves a trace ([ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md), amended).** The advisory cite-vs-apply workflow now writes `runward/governance/verify-findings.md`; a green `check --strict` reports its presence and freshness (stale once a gated manifest changes) — deterministically, never parsing a verdict, never blocking. The semantic layer becomes visible in a pipeline without any LLM entering runward.
- **runward gates itself.** The repository now carries its own `runward/` mission — framing, architecture, execution topology, floor, governance, runbook, all four conformance manifests filled with typed pointers into runward's own source — and CI requires `runward check --strict` green on runward, including under network isolation (`unshare -n`). Dogfooding as a required check, not a claim.
- **A real unit harness under the core.** 50 `node:test` unit tests (zero new dependencies) importing `conformance`/`compliance`/`evidence`/`regimes` directly — ~99% line coverage on the gate core — plus a seeded fuzz pass over the manifest parser (never crashes, never false-passes) and a **golden byte-identical OSCAL test** (`RUNWARD_NOW` pinned): the byte-for-byte promise is now tested, not asserted. `npm run coverage` reports via `--experimental-test-coverage`.
- **ADR-0017 closed for real.** Move 2 re-scoped (the produced, gated placement role was delivered by `execution-topology.md`; `shared-bricks.md` stays the non-gated reference grid — gating a copied reference text would be paperwork theater), move 4 executed (the reference mission gains `ADR-0003 port placement and sovereignty`, first member of the infra ADR family, cited by its topology rows).
- **Also:** a GitLab CI gate adapter joins pre-commit / GitHub Actions / Claude Code (adapters 4 → 5); `init --example` now ships the reference `code/` with the mission, so the example is green because its typed evidence actually resolves; the empty-status gate message names the expected gesture.

## v0.14.2 — every command names the next gesture — 2026-07-13

runward's own principle, applied to its CLI: a command that does work but names no next step breaks the transmission chain — the operating agent can't hand the human "what to decide next". `check`, `doctor` and `update` were doing work and then stopping silent. Each now closes with a **Next** section, matching `status`, `characterize` and `compliance`.

- **`runward check`** names the next gesture: on green, assemble the evidence pack (`runward compliance <regime>`) or take a handover snapshot (`runward status`); on gaps, fill the named deliverables and re-run, with `runward status` pointing at exactly what is open at the current gate.
- **`runward doctor`** closes on the next move: `runward init` to scaffold a mission, or `runward check` inside one.
- **`runward update`** points back to `runward check`, to re-verify the gate against the refreshed rules and workflows.
- Smoke covers all four next-gesture surfaces.

## v0.14.1 — valid YAML in the emitted skills — 2026-07-13

A follow-up audit found one real issue behind the v0.14.0 hardening: the phase-skill frontmatter runward emits (`.agents/skills/runward-<phase>/SKILL.md` and the Continue.dev mirror) was not strict-YAML valid. The `description` embeds the skill's relevance trigger, which carries a colon (and an apostrophe, `port's`); left unquoted, a spec-conformant parser (PyYAML `safe_load`, js-yaml) rejects the frontmatter. Today's harness readers are lenient line-based and still load the skill, but a strict-parsing harness would drop it — a crack in the vendor-neutral promise.

- **The `description` scalar is now double-quoted** (colons and apostrophes need no escaping there), so every emitted `SKILL.md` and the `.continue/rules/` mirror parse under a conformant YAML parser. A new smoke regression parses all four skills for real (`js-yaml`, dev-only, never shipped).

## v0.14.0 — gate integrity: a green you can trust — 2026-07-13

A multi-agent functional audit of the toolchain (build, tests, `init`, the full `check --strict` chain, `compliance`, the example floor) confirmed the core runs green end to end with no blocker, but surfaced gate-integrity defects: paths by which a mission could look done when it wasn't, or an operator typo could read as a real failure. This release closes them, so a green `check` is trustworthy ground truth.

- **CLI misuse now exits `2`, distinct from `1` "the gate has gaps".** An unknown command, unknown option, or missing/excess argument (`runward frobnicate`, `runward check --typo`, `runward init --tools`) all exited `1`, indistinguishable in CI from a legitimate gate failure. Commander's own errors are now mapped onto runward's exit-code contract via `exitOverride`, applied to the root **and every subcommand**: misuse → `2`, help/version → `0`, gate gaps stay `1`.
- **The "filled" heuristic no longer passes a one-byte edit.** Deliverables with few template placeholders (`decision-matrix.md`, `execution-topology.md`) could close their Architect gate on any interior one-character change, since only exact-template equality guarded them. A divergence guard now requires several lines of genuinely new content beyond the scaffold (calibrated against the reference mission, whose lightest fill adds 5 lines / 215 words). The reference stays green; a trivial edit reads `in-progress`.
- **Non-vacuity holds at exactly zero.** If a phase's rule mapping was stripped to empty (`phases:` removed from every rule), `check --strict` skipped the deliverable and stayed green — bypassing the very floor (ADR-0002) meant to catch a stripped mapping. The `(mapping)` violation now surfaces even when the mapped set is empty.
- **One ADR-counting rule, shared.** The mission, status, and conformance paths disagreed on what counts as an ADR: two used `!name.includes("0000")`, which wrongly dropped a real `ADR-0021-…-10000-ms.md`, while conformance excluded only the exact template. A single `isRealAdr` helper (`ADR-<n>-*.md`, excluding `ADR-0000-template.md`) is now the one source of truth.
- **The Frame and Architect workflows name every gate artifact.** `frame.md` never mentioned the steering contract (`mission-contract.md`) and `architect.md` never mentioned the decision matrix (`decision-matrix.md`), so an agent following the workflow text left an uncloseable gate gap. Both are now in the workflows' Outputs and Definition of Done.
- **Minor hardening.** `--tools` help now lists all eight profiles (derived from the profile set, not a stale literal); a `deviated` row citing `ADR-1` no longer matches `ADR-10` (anchored on a digit boundary); an Evidence cell containing a pipe (a TS union `a | b`) is no longer truncated into a false `n/a` failure. New `smoke.js` regressions cover every fix above.

## v0.13.3 — the two proofs, made legible — 2026-07-12

- **`runward check --strict` now names the two proofs.** On a green gate, an advisory section states the boundary: this gate is the *documentary* proof (the decisions are traced); runward never ran your code (it is not a runtime); the *behavioral* proof is your test suite. `floor.md §2` can declare `Behavioral proof: <command>` and an optional `Proof artifact: <path>`; runward reports the pointer and, if an artifact is named, its presence and freshness (artifact mtime vs the newest source under `code/`) — strictly read-only, never executed, never parsed for pass/fail. Advisory, never gates the verdict.
- **The reference demo shows the guard's climax.** `examples/request-triage`'s `npm run demo` now includes a request whose plausible account reference the model proposed (`ACC-7777`) is not in the registry: the deterministic guard refuses to route on it, fail-closed (ADR-0002) — "unverified account reference, not in registry", escalated to human review. The "catch" the whole design exists for, reproducible in one command.

## v0.13.2 — phase skills: surface the craft by relevance — 2026-07-12

runward now emits **phase skills** — the CRITICAL/HIGH craft rules of each build phase, packaged so a skill-capable agent surfaces them *by relevance* at the point of action (progressive disclosure), a layer above the gated core and always subordinate to it. Honest framing: native skills are table stakes (BMAD, Spec Kit and OpenSpec all ship them) — this is parity, not a moat; the edge stays the doctrine content and the deterministic gate underneath. A skill loaded but not applied still fails `runward check --strict`.

- **Vendor-neutral by construction.** A single canonical set — `.agents/skills/runward-<phase>/SKILL.md` (architect, topology, floor, govern) — is written **always, like `AGENTS.md`**. It is the converged SKILL.md alias read by **14+ harnesses in one write** (Codex, Cursor, Copilot, Gemini, Windsurf, Cline, Zed, Amp, opencode, Roo, Kilo, Warp, Devin, Augment), no agent privileged.
- **Per-harness mirrors**, selected via `--tools`, for harnesses that read their own path: Claude Code (`.claude/skills/`), JetBrains Junie (`.junie/skills/`), Trae (`.trae/skills/`), and Continue.dev (`.continue/rules/`, `alwaysApply:false` + `description`). Aider and goose have no relevance surface, so their craft rides the always-written `AGENTS.md` (honest ceiling, not forced into always-on prose).
- **[ADR-0018](docs/adr/ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) (amended twice)** by a top-20 harness scan: `SKILL.md` is a converged open standard and `.agents/skills/` is the vendor-neutral seam. Content single-sourced; every skill subordinate to the gate. Smoke covers emission, subordination and the absence of per-harness duplication.

## v0.13.1 — a transmission-ready status, agent-assisted gate wiring — 2026-07-12

- **`runward status` becomes a handoff snapshot.** It reads the mission files into a "where the mission stands": the six-phase arc with per-phase fill counts, the current gate marked with its open deliverables named, the dated decision journal with a total, the last-touched deliverable, and a **Next** block that names the exact next gesture. Read-only and deterministic.
- **The agent offers to wire the gate, on the operator's approval.** `AGENTS.md` now directs the operating agent to proactively offer to wire the gate at the harness seam (git `pre-commit` / CI required check / turn-end hook) from the inert `runward/adapters/` samples, acting only on explicit operator approval and never silently. runward still installs nothing and touches no `.git/` — the operator's wiring gesture, agent-assisted and approval-gated. Recorded as an amendment to [ADR-0012](docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md).
- **[ADR-0018](docs/adr/ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) (accepted).** Native skill packagings (Claude Code Agent Skills and equivalents) will ship as opt-in, non-privileged application adapters **above** the gated core — a small set of phase-scoped skills that surface the right rules at the point of action, with the deterministic gate remaining the sole authority (a skill without the gate is just advice). Decision recorded; implementation deferred to the roadmap.

## v0.13.0 — see the whole chain green in one command — 2026-07-12

`npx runward init --example` scaffolds the `request-triage` reference mission already filled, so a newcomer sees the entire gated chain pass green and can emit audit-ready evidence without writing a line. The fastest way to understand what runward does.

- **`runward init --example`** lays down the filled reference deliverables (framing, architecture, two ADRs, four port contracts, execution-topology, floor, governance threat-model / eval / observability, runbook) alongside the usual rules, workflows, adapters, `AGENTS.md` and tool profiles. `runward check --strict` passes green out of the box, and `runward compliance iso-42001` emits the OSCAL evidence pack derived from the traced decisions. It skips the idea / entry-mode / stopping-tier prompts (the reference is fixed) and adds the three non-gated scaffolding notes as blank templates so the scaffold stays complete. The reference mission now ships in the package (`examples/request-triage/runward`); the reference `code/` is not bundled. Then `runward init` (without `--example`) starts a real mission from blank templates. Covered by the smoke suite.

## v0.12.2 — audit remediation, full OWASP ASI coverage — 2026-07-11

A multi-agent audit of runward, then a confrontation against competitor repos, surfaced internal inconsistencies, one genuine coverage gap, and a positioning that had stopped discriminating. All three are closed here, with no change to the invariants (deterministic, zero-LLM, read-only, never a runtime).

- **Full OWASP ASI coverage (10/10).** Two new govern-phase craft rules close the two previously-uncovered categories: `security-code-execution-sandbox` (ASI05, ASI02, CRITICAL — unexpected code execution runs sandboxed, never in-process) and `security-human-agent-trust` (ASI09, HIGH — provenance on every field, so the human never reads a model-proposed value as verified). Rules: 58 → 60; the govern non-vacuity floor rises 10 → 12; the shipped `examples/request-triage` threat-model manifest accounts for both; the smoke suite now asserts all ten ASI controls are covered and the `compliance` output leaves none `planned`.
- **Audit remediation.** Internal inconsistencies surfaced by the audit fixed: stale rule counts, a dead compliance branch, an ADR amendment note, the CI Node matrix and the zero-network import guard.
- **Framing corrected.** runward packages the FDE method: it no longer cites "the doctrine" or "the method" as external documents, and the companion "LLM Boundary Principle" annex is no longer presented as the method's founding thesis. The guiding principle (the architecture frames the model) is stated directly, and the deterministic-boundary pattern is named for what it does. Purged across README, workflows, NOTICE, the two craft rules, `floor-ts` and the agent charter.
- **Positioning sharpened (`docs/positioning.md`).** "Deterministic zero-LLM" no longer discriminates (the Microsoft Agent Governance Toolkit and runtime policy engines have it too). The durable distinction, now the lead: runward gates a *traced decision* (not an action, not an output), at *delivery* (not runtime, not test time), and derives audit-ready evidence from a *ratified ADR journal*. Rationale in `docs/positioning-note-object-moment-lineage.md`.

## v0.12.1 — surface the advisory verify layer — 2026-07-11

The `verify` workflow (ADR-0007, cite-vs-apply semantic review above the gate) shipped since v0.7.0 but nothing surfaced it — an operator crossing a green gate never learned the semantic layer existed. Now it does, without touching the zero-LLM gate or vendor-neutrality.

- **[ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md) (amended)** — discoverability wired. `runward check --strict`, when green, prints an advisory "Semantic check" pointer to `runward/workflows/verify.md`: the deterministic gate proved every rule was *traced*, not that the code *applies* it; the verify workflow judges that, adversarially, ideally on a different model, and never blocks. `AGENTS.md` now tells any agent to run `verify` before crossing a green gate. Both are zero-LLM, vendor-neutral prose. The `/rw-verify` slash command is deliberately left as a per-harness example (not a privileged default) to hold the vendor-neutral line.

## v0.12.0 — the application/infrastructure double vision — 2026-07-11

runward now packages **both visions of the doctrine as one gated path**: the application domain (what the system does) and the execution topology (where, and under which sovereignty, each port's adapter runs). The doctrine's section 15 (shared building blocks) was present only as an orphaned `shared-bricks.md` template — scaffolded but produced by no workflow and verified by no gate. It is now cabled into the method and made executable, without runward ever becoming a runtime: it **traces and governs** the placement decision, it deploys nothing.

- **[ADR-0017](docs/adr/ADR-0017-application-infrastructure-double-vision-gated.md)** — operationalize doctrine §15 into the gated flow. **(1)** Name the double vision in `docs/positioning.md` (a fifth messaging pillar) and the `method`/`architect` workflows. **(2)** Cable the orphaned `shared-bricks.md` into the `architect` (produce) and `iterate` (reopen on a placement switch) workflows' Definition of Done. **(3)** A new mission deliverable, **`execution-topology.md`** — the port→placement bridge: per domain port, its adapter, location family (the five of §15), data class(es), sovereignty level, ADR and re-evaluation trigger, plus a **usage registry** (per deployment: risk class, data classes, owner) since "risk is classified per deployment, not per platform." **(4)** An infra ADR family (placement, sovereignty by data class, agent-identity location, multi-region, trace export). **(5)** `execution-topology.md` becomes a **first-class gated deliverable** with its own `topology` conformance phase (decided over folding into `architect`, which would split rule and deliverable across files — debt): `check --strict` now verifies four deterministic `phases: [topology]` rules — `topology-port-placement-mapped`, `topology-sovereignty-by-data-class` (CRITICAL), `topology-trace-export-decision`, `topology-usage-registry-present` — each proving a *traced placement decision*, never a real infra state. The secrets-boundary concern reuses the existing `config-secrets-boundary` rule rather than duplicating it. The shipped `examples/request-triage` gains a filled `execution-topology.md` (four ports, two reaching beyond the process) so it still passes `--strict`. Rules: 54 → 58. Covered by the smoke suite.

## v0.11.0 — compliance evidence packs — 2026-07-10

A new command turns the mission's conformance work into a hand-ready, regime-framed **evidence pack** — and makes the previously-inert `docs/compliance/*` references operational. Deterministic, read-only, zero-LLM, outside the gate; never a compliance claim. This is a provenance layer upstream of the auditor: evidence traceable to ratified engineering decisions, emitted as OSCAL so it flows into GRC/auditor tooling.

- **[ADR-0016](docs/adr/ADR-0016-runward-compliance-evidence-pack-assembler.md)** — `runward compliance <regime>`, a deterministic, read-only, zero-LLM evidence-pack **assembler** (outside the gate): reads the mission's real artifacts (conformance manifest → OWASP ASI coverage, ADR journal, threat model, eval rubric) and assembles a regime-framed **assessment-readiness draft** (ISO 42001 / NIST AI RMF / EU AI Act Annex IV), explicitly flagging the sections only the operator/organization can supply, and emits **OSCAL-compatible** output so the evidence flows into GRC/auditor workflows. A provenance layer upstream of the auditor — never "compliant/certified", never LLM-drafted, never live-scraped. Makes the inert `docs/compliance/*` references operational. *Implemented (piece 1):* the **ISO/IEC 42001** readiness-draft assembler — `runward compliance iso-42001` reads the mission's rule→ASI mapping, conformance manifests, ADR journal and governance-doc presence and writes `runward/compliance/iso-42001-readiness.md` (the technical-evidence layer + its index, with the operator/organization-only sections explicitly flagged). Deterministic, read-only, zero-LLM, outside the gate. *(piece 2)* the **OSCAL export** — every `compliance` run also writes `runward/compliance/oscal-component-definition.json`, an OSCAL 1.1.2 component-definition mapping ASI01–ASI10 to implementation-status derived from the conformance manifest, with **deterministic (SHA-256-seeded) UUIDs** so re-runs are byte-identical; this is the machine-readable interop layer that flows into GRC/auditor tooling. *(piece 3)* the **NIST AI RMF** and **EU AI Act (Annex IV)** lenses — for NIST, an ASI↔AI-RMF crosswalk and the MEASURE/TEVV documentation; for the EU, an Annex IV coverage map with the ADR journal as the near-verbatim Point 2 design-rationale. The compliance surface (ADR-0016) is now **complete**: ISO 42001 / NIST AI RMF / EU AI Act readiness drafts + the OSCAL export, all deterministic, read-only, zero-LLM, and never a compliance claim.

## v0.10.0 — retro-documentation & regional compliance — 2026-07-10

Two feature lines, both holding the invariants — the gate stays deterministic, zero-LLM and read-only. **Retro-documentation** (ADR-0013/0014): runward reconstructs the transmission kit for an existing, undocumented system — the transmission phase pointed backward. **Regional compliance** (ADR-0015): the OWASP ASI security mapping is the universal core; the named regulation becomes a swappable regional lens, security-only by default. Plus path-resolution fixes.

- **[ADR-0013](docs/adr/ADR-0013-retro-documentation-as-transmission-pointed-backward.md)** — retro-documentation as the transmission phase pointed backward: reconstruct the phase-6 kit (ADRs, architecture, threat model, runbook, handover) for an existing system that skipped it, as a structured elicitation-and-validation pipeline. runward reconstructs the transmission **kit**; it does not *realize* transmission (proven autonomy needs humans) — never "transmits / certifies / auto-documents". Brief and matrices in [docs/retro-documentation.md](docs/retro-documentation.md).
- **[ADR-0014](docs/adr/ADR-0014-the-characterize-command-contract.md)** — the `runward characterize` command contract: a read-only command emitting a deterministic `characterization.md` inventory (zero-LLM) plus, under an opt-in `--mine` flag, advisory `DRAFT-*.md` ADR candidates (`status: hypothesis`, `why: UNKNOWN`) written outside the gate. Read-only, never a runtime; nothing it emits can pass the gate until the operator ratifies it. *Implemented:* **(piece 1)** the **deterministic inventory** and the `runward characterize` command — parses dependency manifests + lockfiles, entrypoints, CI, tests and git-log shape into `runward/characterization.md` (facts, `confidence: high`), writing only into `runward/`; ends with operator next-steps. **(piece 2)** the ADR **`hypothesis → accepted` lifecycle**: `check --strict` now fails while any `runward/adr/` entry is an unratified reconstruction (a `DRAFT-` file, `Status: hypothesis`, or a leftover `why: UNKNOWN`), with an actionable ratify-or-remove message — the red gate is what forces the operator to own each reconstructed decision. **(piece 3)** `check --coverage` — an advisory report of deliverable and decision-ratification ratios (lists what remains to ratify; never gates), plus the scaffolded `mission/gap-analysis.md` template (the section-by-section brownfield audit that was prescribed by the workflow but had no template). **(piece 4)** `characterize --mine` — **deterministic git archaeology, no model call** (per an ADR-0014 amendment reconciling `--mine` with the zero-LLM-tool invariant and ADR-0007): proposes candidate structural decisions (the stack/language choice, containerization, the CI pipeline, notable dependency families) as `runward/adr/DRAFT-*.md` hypotheses with evidence pointers and `why: UNKNOWN`; the operating agent refines and the operator ratifies. The retro-documentation surface (ADR-0013/0014) is now **complete**, covered end-to-end by the smoke suite.
- **[ADR-0015](docs/adr/ADR-0015-regulatory-conformance-as-a-regional-profile.md)** — regulatory conformance as a **regional profile**: the OWASP ASI mapping and the deterministic manifest are the universal core; the named regulation is a swappable lens, **security-only by default**. Ships framing references (not gate logic) under [`docs/compliance/`](docs/compliance/) — ISO/IEC 42001 (global anchor), NIST AI RMF (US), EU AI Act (EU). Copy de-EU-first'd (README, positioning) — lead with the universal security posture, map to the buyer's regime. The gate stays regulation-agnostic.
- **Fixes:** `-p <absolute-path>` on `init`/`check`/`update`/`status` resolved to the wrong directory (`join(cwd, absPath)` → `resolve`), so an absolute project path works everywhere; the `characterize --mine` help text no longer says "not yet implemented".

## v0.9.1 — 2026-07-09

Docs-only patch. No change to the gate, the adapters, or any behavior.

- Reframe the gate adapters as **agent-agnostic**, holding runward's vendor-neutral line: the git `pre-commit` and CI adapters gate whatever agent produced the code (Codex, Claude, Cursor, Copilot, Gemini); the Claude Code `Stop`-hook is the first shipped example of a per-harness turn-end hook, not a privileged one. Corrects the adapters `README.md`, the root README, ADR-0012, and the v0.9.0 notes — the shipped `templates/adapters/README.md` now leads with the agnostic seams.

## v0.9.0 — audit-ready alignment: OWASP ASI, ports & harness adapters — 2026-07-09

Ecosystem and doctrine alignment from the 2026 veille — each decision locked as an ADR first, then implemented (doctrine before code, per the method). Together they make the conformance manifest read as audit-ready supporting evidence and wire the deterministic gate into every harness, without adding any runtime surface. The gate stays zero-LLM and zero-run.

- **[ADR-0009](docs/adr/ADR-0009-owasp-agentic-top-10-as-the-gate-risk-grammar.md)** — OWASP Top 10 for Agentic Applications (ASI01–10) as the gate's risk grammar. *Implemented:* 20 security/governance craft rules gain an `asi:` mapping (verified against the official OWASP taxonomy) so the conformance manifest reads as audit-ready supporting evidence that feeds an ISO 42001 / EU AI Act technical file; **3 new CVE-derived deterministic rules** (`security-mcp-server-pinning` [ASI04/10], `security-tool-change-reapproval` [ASI02/04], `data-memory-provenance` [ASI06]) — 51 → **54 rules**; floors updated (architect 6, govern 10); example migrated.
- **[ADR-0010](docs/adr/ADR-0010-agents-md-as-a-first-class-handover-deliverable.md)** — `AGENTS.md` as a first-class handover deliverable. *Implemented:* the `handover` workflow finalizes the `AGENTS.md` written at `init` as the receiving team's charter — the craft rules, the judgment boundaries (operator vs agent), the verification commands (including `runward check --strict`), and the never/PR rules — in the harness-neutral format every agent reads (Codex, Copilot, Cursor, Gemini, Amp, Claude Code).
- **[ADR-0011](docs/adr/ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md)** — neutral ecosystem standards as versioned ports. *Implemented:* `reference-stack.md` names MCP (pinned by spec version + server hash), OTel GenAI semantic conventions, agent identity (OAuth 2.1/PKCE, SPIFFE, Entra Agent ID) and A2A (deferred, distributed-topology trigger) as the pinned port contracts — referenced and re-tested behind the port, never implemented in the core.
- **[ADR-0012](docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md)** — the gate as a port (its exit code is the contract), with **harness adapters** (the 2026 veille P0). *Implemented:* `init` emits 4 inert sample adapters under `runward/adapters/` — a `pre-commit` git hook, a `github-actions.yml` CI job, a `claude-code-settings.json` `Stop`-hook snippet, and a `README.md` pinning the exit-code port contract — so the deterministic gate runs at each harness's lifecycle seam. The git and CI adapters are **agent-agnostic** — they gate whatever agent produced the code (Codex, Claude, Cursor, Copilot, Gemini); the Claude Code `Stop`-hook is the first shipped example of a per-harness turn-end hook, not a privileged one. Opt-in and inert until the operator wires them (runward writes nothing into `.git/`, never a runtime); refreshed by `update`, verified by `doctor` (`EXPECTED_ADAPTERS`). Closes the opening incident at its root: the agent-agnostic seams re-run the gate regardless of harness.

## v0.8.0 — conformance-gate hardening — 2026-07-07

Hardening of the `--strict` conformance gate, from a code-level benchmark of the spec-driven competitors (BMAD, Spec Kit, OpenSpec, Spec Kitty). Each structural item is locked in an ADR first; the deterministic gate stays zero-LLM and zero-run — the LLM verification (P7) and the hook seam (P8) sit beside it, subordinate and opt-in.

- **P1 — harden `--strict` against vacuous passing** ([ADR-0002](docs/adr/ADR-0002-harden-the-strict-gate-against-vacuous-passing.md)): a routed-count floor per phase (`EXPECTED_MAPPED`, enforced by `check --strict` and `doctor`) so the `phases:` mapping cannot be silently stripped; `n/a` reasons must be real, not empty or a `[placeholder]` token; the smoke suite plants a violation and asserts the gate catches it. Deterministic, zero-LLM.
- **P2 — deterministic form-lint of the manifest** ([ADR-0003](docs/adr/ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md)): before the semantic check, `check --strict` flags a rule listed more than once and a row whose slug is not a real rule (a typo that would otherwise silently hide a gap). Well-formedness before presence-of-decision.
- **P3 — advisory drift detection** ([ADR-0004](docs/adr/ADR-0004-advisory-drift-detection-of-applied-pointers.md)): `check --strict` reports (advisory, non-blocking) any `applied` pointer whose file path no longer resolves — the manifest snapshot stops silently rotting as the code moves. Existence only, deterministic, zero-LLM; pure-prose evidence is skipped.
- **P4 — baseline-worktree test validation: considered, not adopted** ([ADR-0005](docs/adr/ADR-0005-baseline-worktree-test-validation-out-of-scope.md)): running the project's tests in a worktree would violate the gate's zero-run, language-neutral invariant. Test-evidence honesty stays the project CI's job; P3 already catches a vanished test; an operator who wants baseline validation plugs it via the hook seam (P8).
- **P5 — rule-set evolution as tracked migrations** ([ADR-0006](docs/adr/ADR-0006-rule-set-evolution-as-tracked-migrations.md)): a machine-readable migration record (`rule-migrations`) turns a renamed or removed rule into a guided migration — a manifest citing an old slug now reads `renamed to '<new>' in <version> (<reason>)` instead of a bare "unknown rule". The rule set evolves by tracked delta, never by silent rewrite.
- **P6 — actionable `--strict` messages** (DX, no ADR — not a structural change): every conformance violation now carries a targeted fix hint (`add a row: applied with a file:line/test…`, `put a file:line or a test in the Evidence column`, `keep a single row per rule`, `restore the phases: [...] frontmatter`…), so the fix is in the message.
- **P7 — advisory LLM conformance verification** ([ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md)): a new `verify` workflow (`/rw-verify`) — an agent-executed, adversarial cite-vs-apply pass over the manifest ("does this code apply the rule, or only cite it?"). Advisory only: it emits findings, never an exit code, never blocks; `check --strict` stays the deterministic gate. Vendor-neutral (nothing bundled), strictly subordinate to the gate. Closes the one benchmarked weakness without touching the zero-LLM invariant.
- **P8 — opt-in hook seam around `check`** ([ADR-0008](docs/adr/ADR-0008-opt-in-hook-seam-around-check.md)): `check --hooks` runs operator-supplied `before`/`after` commands from `runward/hooks.json` around the audit; a failing hook fails the gate. Opt-in only — plain `check` never runs hooks, so a clone cannot execute anything by surprise. The extension point for language-specific proofs runward will not run itself (the P4 residual); runward's own gate stays deterministic and zero-run.

## v0.7.0 — rule-conformance gate — 2026-07-07

Implements [ADR-0001](docs/adr/ADR-0001-enforce-declared-rule-conformance-at-the-gate.md): craft rules become active at the gate, deterministically, across the architect, floor and govern phases. Motivated by a field test where an agent cited a rule (`frontier-deterministic-boundary`) without applying it and the floor still passed `runward check` green.

- **`runward check --strict`** (opt-in): verifies each phase's `Rule conformance` manifest — every CRITICAL/HIGH rule mapped to the phase must be `applied` (with a `file:line`/test pointer), `deviated` (with an existing ADR), or `n/a` (with a reason). Deterministic: it checks that a decision was traced, never the quality of the code; no LLM in the gate path. Default `check` is unchanged (non-breaking).
- Rule frontmatter gains an additive `phases:` field; 18 CRITICAL/HIGH rules mapped — architect (5), floor (10), govern (7). The expected set reads from the mission's `runward/rules/`, or the package rules as a fallback.
- `architecture.md`, `floor.md` and `governance/threat-model.md` gain a `Rule conformance` section; the `architect`, `floor` and `govern` workflows and the `AGENTS.md` charter direct the agent to confront the routed rules at the point of building and account for each.
- The `examples/request-triage` mission is migrated: it carries filled manifests and passes `runward check --strict` across all three phases (a worked mix of `applied` and reasoned `n/a`).
- The incident scenario now turns `check --strict` red. 3 smoke tests (incident → red, unbacked `applied` → red, migrated example → green across architect/floor/govern).
- Deferred, named with trigger (per ADR-0001): finer per-task `appliesWhen` routing — added on evidence.

## v0.6.0 — first public release — 2026-07-06

The first version published to npm (`npx runward init`); the repository goes public at `stranxik/runward`, the site at `runward.dev`, and the doctrine ships separately at `stranxik/designing-and-running-agentic-systems`. Bundles the feature work developed 2026-07-03 through the public-release wiring.

- Public release: live on npm; repository and site public; `repository`/`homepage`/`bugs` metadata point at them; README npm version badge; first public landing surface for `runward.dev`.
- Rule rename: `hexa-move-deterministic-out` normalized to its canonical id across the craft-rule set and the workflows that reference it (no rule added or removed by the rename).
- Rule-count reconciliation: `EXPECTED_RULES` pinned to the exact craft-rule count so `doctor` and the smoke test gate on the real number rather than a hand-kept figure.
- Runnable example: `examples/request-triage/code/` — the mission's floor implemented (deterministic guard on extracted fields, fail-closed compliance routing with suspension, abstention; 14 tests).
- Reference floor: two deferrals implemented — suspend & rehydrate on human approval (run serialized, process freed, exact resume) and prompt provenance (SHA-256 of the prompt actually sent, per call, re-read never replayed). 53 tests.
- 3 new async rules (post-turn pipeline, scheduled maintenance, job guardrails) — 51 rules total; `govern` workflow extended accordingly.
- New reference `shared-bricks.md` (placement families, brick matrix, sovereignty by data class, usage registry); tutorial `docs/first-mission.md` (first mission in 15 minutes, flow verified by execution).
- Language framing corrected everywhere: one single language in the core, which one is an adapter decision; TypeScript is the reference-stack sober default, sidecars on proven triggers.

---

_Pre-public development history — the versions below were never published to npm (the package starts at 0.6.0). Kept for provenance._

## v0.5.0 — 2026-07-03

- Example mission `examples/request-triage/` filled end to end: steering contract, decision matrix, four port contracts, threat model, evaluation rubric, observability schema, recovery runbook — `runward check -p examples/request-triage` passes clean and the smoke test asserts it
- `runward check` gates on more of the chain: the steering contract at Frame; the decision matrix and at least one filled port contract at Architect
- Placeholder detection no longer counts markdown links (`[floor note](floor.md)` is a cross-reference, not a gap)
- `runward status` dates each ADR from its own `**Date**:` line (file mtime as fallback)
- Craft-rule set at 48 rules; `doctor` and the smoke test verify the new count
- Framing rebalanced across README, docs, workflows and the agent charter: the guiding principle (the architecture frames the model) is the method's opening posture; the six phases, five gestures, decision matrix and craft rules carry the whole
- "Operator" terminology propagated where the role was still called "the engineer"
- Packaging: `repository` / `homepage` / `bugs` metadata, `prepublishOnly` guard, `CONTRIBUTING.md`, `SECURITY.md`, this changelog

## v0.4.0

- Reference floor `floor-ts/`: clonable hexagonal TypeScript scaffold (23 tests, zero keys by default, provider profiles, day-zero cost cap) + its craft companion `floor-ts/AGENTS.md`
- New templates: `mission-contract.md` (one-page steering contract, 4 engagements with DoD, decision gates) and `reference-stack.md` (default adapter kit per layer with triggers)
- Fidelity audit of all 10 workflows against their sources — 10 major losses fixed (mentor posture, 8 DoR conditions, boundary-principle rooting, 2-of-3 window rule, hardened handover DoD, the five review hats…)

## v0.3.0

- The craft rules shipped with the mission (`runward/rules/`) — memory, state, resilience, observability, security, scaling depth
- Full 22-arbitration decision matrix (`runward/decision-matrix.md`)
- `runward update` covers rules; `doctor` verifies rule completeness
- README reflects the four broken assumptions and five gestures, not just the guiding principle

## v0.2.0

- CLI rebuilt on commander/chalk/@inquirer: interactive wizard, `--yes`, `--dry-run`, `--no-color`, exit codes, error handlers
- `runward check`: gate audit (which expected deliverable is missing at the current phase)
- `runward status`, `runward doctor`, `runward update` (drift-aware, mission state never touched)
- Tool profiles: GitHub Copilot, Gemini CLI, Windsurf (AGENTS.md always written)
- Example mission (end-to-end, anonymized)

## v0.1.0

- Mission structure (`runward/`) with gates per phase
- Missing templates created: `framing.md`, `architecture.md` (structure existed only in prose before)
- Workflows in English, executable by an agent
- `runward init` CLI
- Tool profiles: Claude Code, Cursor
- License split: tooling MIT, doctrine CC BY-ND canon (see NOTICE.md)
