# ADR-0087 — A qualification kit the user runs: runward ships the evidence, the user decides what it is worth

**Date**: 2026-10-01
**Status**: proposed — the recommendation below waits for the maintainer's decisions 1 to 8
**Deciders**: the maintainer
**Method**: `ROADMAP.md` ("Evidence a regulated buyer can run, not only read"),
`docs/compliance/tool-operational-requirements.md` (third edition, 157 requirements, describes 0.42.3),
`test/unit/tor-traceability.test.js`, `test/audit-corpus.js`, `test/smoke.js`, `reports/junit.xml`,
`package.json` (`files`, `scripts`, `dependencies`), `docs/compliance/regulated-adoption.md` §8,
`docs/compliance/known-defects.md`, `docs/verifying-a-release.md`, ADR-0001, ADR-0039, ADR-0054,
ADR-0079, ADR-0080 and ADR-0085 read on the branch of this ADR (base `main` after #345). Every
requirement's cited test classified by reading the case body; the 44 cited unit-test files, the smoke
test and the attack corpus run against `runward@0.42.3` installed from the npm registry; `npm pack
--dry-run` measured for each packaging option. Public regulator texts, official standard previews and
vendor pages read on 2026-10-01 and quoted below, each with what was and was not readable at the
source.
**Relates to**: [ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md)
(the regulated tier: what the repository disciplines),
[ADR-0085](ADR-0085-the-release-chain-publishes-a-draft-first-then-makes-it-immutable.md) (the release
chain a kit would ride), [ADR-0079](ADR-0079-a-release-keeps-a-signed-summary-of-its-mutation-ratchet.md)
(the signed ratchet summary, the other published measure),
[ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) (what stays outside
the CLI), [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) (the corpus's origin)

## Context

**The ROADMAP items.** Three, under "Evidence a regulated buyer can run, not only read": a qualification
suite the user runs on their own installation; qualification-plan templates for DO-330 TQL-5 and
ISO 26262 TCL2 method 1c, plus the open anomalies per version; and the attack corpus and requirements
"packaged so a third party can re-run them and read the result". The ROADMAP says why: "runward's own
test suite is not in the npm package. In regulated sectors the user qualifies the tool; the vendor
supplies what makes that feasible."

**What exists, measured.**

- *Requirements.* `docs/compliance/tool-operational-requirements.md` holds TOR-001 to TOR-157, one cited
  test per requirement, in 45 distinct files (44 under `test/unit/`, plus `test/smoke.js`).
  `tor-traceability.test.js` checks that each citation exists in the file and in the committed
  `reports/junit.xml`; it says itself that it checks "that a LINK EXISTS, never that the test is
  RELEVANT". The document says it "is **not a qualification kit**".
- *What ships.* `package.json` `files` ships `dist`, `templates`, `regimes`, the request-triage example,
  `README.md`, `NOTICE.md` and `LICENSE`. No test, no requirement document, no defect register. `npm pack
  --dry-run`: 449,587 bytes packed, 1,385,709 unpacked, 202 entries. Runtime dependencies: three
  (`@inquirer/prompts`, `chalk`, `commander`).
- *The attack corpus.* `test/audit-corpus.js`, 16 cases (12 `attack`, 4 `honest`), each a mission built
  by `init --example` and altered, judged by the exit code of `check --strict`. It spawns the CLI and
  `git`, imports nothing from `dist/lib`, and prints `16/16 as expected`. Cases are named, not numbered,
  and the output is text only.
- *The defect register.* 163 entries (register date 2026-09-30), each with `affected-from` and `fixed-in`
  written inside the entry's prose; there is no per-version list of what is still open.
- *The release chain.* ADR-0085 (accepted): a draft release carrying the tarball, two `.intoto.jsonl`
  bundles and the SBOM, published by the maintainer, then immutable once the setting is on.

**Which cited tests could run against an installed package.** Each of the 157 cited cases was read and
placed by what its body does (a helper that only builds a fixture counts as fixture, not as assertion):

| Kind | Cases | What the assertion goes through |
|---|---|---|
| Interface (black box) | 70 | the `runward` binary only: exit code, stdout, stderr, `--json`, files written |
| CLI-built fixture, internal assertion | 41 | a mission built by the CLI, then a function imported from `dist/lib/` (for example `computeVerdict`, `verifyEvidenceLock`) |
| Internal (white box) | 38 | functions imported from `dist/lib/` only |
| Static reading | 8 | files read as text, no CLI run and no function imported: 6 of them exist only in the source tree (workflows, `docs/`, `action.yml`), 2 ship in the package |

Two of the 70 interface cases still need the source tree: TOR-152 packs the tarball from the checkout,
and TOR-156 reads `src/lib/hooks.ts` as its negative control; one fixture case (TOR-128) also reads
`docs/interop.md`. So 68 requirements can be evidenced on an installation through the interface a user
consumes, 78 through compiled internals, which do ship (`dist/lib/` is in the package) but are not a
public interface, and 2 by reading shipped files.

**What actually ran on an installation (2026-10-01).** `npm install runward@0.42.3` from the registry
into an empty project (its `dist/` is byte-identical to this branch's build), the repository's `test/`
copied into the installed package directory, the 44 cited unit files run with `node --test`
(Node 24.18.0, macOS 26.2 arm64, git 2.50.1): 328 cases, 308 pass, 20 fail, 53.9 s wall clock. Joined
to the register: **148 of the 157 cited cases pass on the installed package** (145 named unit cases, the
file-level citation TOR-142, and the two `test/smoke.js` citations TOR-005 and TOR-031). The 9 that fail
all fail on a missing repository file, never on a verdict: TOR-044 to TOR-047 (`.github/workflows/`),
TOR-049 (the overclaim guard scanned one file), TOR-123 (`action.yml`), TOR-128 (`docs/interop.md`),
TOR-152 (packs the checkout), TOR-156 (`src/`). `test/audit-corpus.js` ran 16/16 on the installed
package. Dependencies beyond Node's built-ins: none in the 44 unit files or the corpus;
`test/smoke.js` imports `js-yaml` (a development dependency; 5.4.2 is 1,571,291 bytes unpacked) for
one check and fails to start without it; it passed once `js-yaml` 5.4.2 was installed beside it. 17 of
the 44 files and the corpus call `git`.

**Package cost of shipping the suite inside `runward`** (`npm pack --dry-run`, `files` extended, the
change reverted):

| Added to `files` | Packed | Unpacked | Entries |
|---|---|---|---|
| nothing (today) | 449,587 | 1,385,709 | 202 |
| `test/audit-corpus.js` alone | 456,299 (+1.5%) | 1,402,833 | 203 |
| the interface-case files, smoke and corpus | 530,691 (+18%) | 1,701,426 | 234 |
| the same, plus the requirements and the register | 630,847 (+40%) | 2,023,486 | 237 |
| every cited file, plus the requirements and the register | 676,800 (+51%) | 2,172,674 | 251 |
| the whole `test/` tree | 979,022 (+118%) | 3,571,187 | 399 |

Every adopter would download it; the register alone is 243,221 bytes.

**What the standards say, and what could be read at the source (2026-10-01).** These texts are sold;
nothing below paraphrases a paywalled clause as if read.

- *Airborne, read at the source.* FAA AC 20-115D (21 July 2017, faa.gov), §10: "Section 12.2 of
  ED-12C/DO-178C, and ED-215/DO-330 provide an acceptable method for tool qualification", and DO-330
  "contains its own complete set of objectives, activities, and life cycle data for tool qualification";
  §10.c(1): DO-178C "establishes five levels of tool qualification based on the tool use and its
  potential impact". Its Table 2 maps a verification tool under criteria 3, at all software levels, to
  TQL-5 (a transition table for tools qualified under DO-178B, not DO-178C's own table). EASA AMC
  20-115D §10 carries the same sentence on DO-330. FAA Order 8110.49A (2018), definition 7.n: "Tool
  qualification is the process necessary to obtain certification credit for a software tool within the
  context of a specific airborne system". *Not read at the source*: DO-178C §12.2 and its table, and the
  DO-330 body (criteria wording, TQL objectives, the split between tool developer and tool user data).
  The criteria 3 wording ("could fail to detect an error") is taken from an LDRA briefing reproducing
  it, which also states: "Under the terms of DO-330, tool qualification is required for every project."
- *Automotive, secondary only.* ISO 26262-8:2018 clause 11 could not be read: the ISO Online Browsing
  Platform refused the request, and its previews stop before clause 11. The classes (TI1/TI2, TD1 to
  TD3, TCL1 to TCL3) and the method table for TCL2 come from an LDRA briefing reproducing the tables:
  for TCL2, method 1c (validation of the software tool) is marked "+" at ASIL A to C and "++" at ASIL D,
  while 1a (increased confidence from use) and 1b (evaluation of the tool development process) are "++"
  at A to C. `regulated-adoption.md` §8.3 already argues why 1c is the method a supplier without an
  organisation can support. Re-read the tables in a licensed copy before relying on them.
- *Functional safety, partly at the source.* The official IEC 61508-3:2010 preview (25 pages) gives the
  scope, "specific requirements applicable to support tools used to develop and configure a
  safety-related system", and lists 7.4.4 in its contents; it stops at clause 6. The IEC 61508-4 preview
  stops before the T1/T2/T3 definitions. The 7.4.4 wording used here comes from a third-party tool
  qualification plan that reproduces it (Validas for Verifysoft, 2014): 7.4.4.5, "An assessment shall
  be carried out for offline support tools in classes T2 and T3 to determine the level of reliance placed
  on the tools"; 7.4.4.7 lists validation records, among them the "test cases and their results"; and
  7.4.4.18, "Each new version of off-line support tool shall be qualified."
- *Rail, the preview only.* The official EN 50716:2023 preview: "This document supersedes EN 50128:2011
  and EN 50657:2017", date of withdrawal 2026-10-30, and a clause 6.7 "Support tools and languages" with a
  table relating tool class to subclauses. The T1/T2/T3 definitions and clause 6.7 are not in the
  preview.
- *Medical, read at the source for FDA only.* FDA's *Computer Software Assurance for Production and
  Quality Management System Software* (final, 3 February 2026, docket FDA-2022-D-0795): "a risk-based
  approach for establishing and maintaining confidence that software is fit for its intended use", a
  burden "no more than necessary to address the risk", and leave to leverage "validation activities
  performed by other entities (e.g., developers, suppliers, cloud service providers)". The text was
  read from a copy downloaded on 2026-09-29 (fda.gov refused the PDF on 2026-10-01; the guidance page
  confirmed the edition). ISO 13485:2016 clause 4.1.6 was not read at the source.

Every scheme above leaves the determination with the user of the tool, in their context, and asks the
supplier for material: requirements, test cases with expected results, results per version, known
defects.

**How comparable vendors describe their kits (vendor pages, 2026-10-01).** AbsInt: "Each QSK is always
specific to a particular build of the tool"; an automated suite whose results are "saved to a report
file specified by you", and "If all test cases pass, compliance with the TOR has been demonstrated".
LDRA: a Tool Accomplishment Summary that is "generic … for customization by the user", and "the
responsibility for showing the suitability of any tools falls on to the organization developing the
application". Vector (VectorCAST): a "Python-driven test suite", the package customised "to your
specific operational environment", with the user's steps including "Provide the Certification
Authorities with a Tool Qualification Plan". MathWorks: the kit "does not 'prequalify' tools" and "Tool
qualification must be performed in the context of each specific project and operational environment."
Ferrocene, an open source compiler: "fully open source under the MIT OR Apache-2.0 license, including
the full qualification documents"; its known-problems database is for "customers with an active
subscription". AbsInt's kit also carries the tool's own development, configuration management, quality
assurance and verification plans and records; MathWorks' IEC kit and Ferrocene carry certificates from
an assessment body (TÜV SÜD). runward has neither, and `tool-operational-requirements.md` says so.

## Decision

**runward ships a qualification kit as a release asset, built from the tagged tree and attested by the
release chain; the user runs it on their installation and keeps the report. runward supplies evidence;
it never states a class, a level or a result of qualification for anyone.** Option C below, with a
small repository change that also makes option D available at once.

**1. The kit: `runward-qualification-kit-X.Y.Z.tgz`, one per release.**

- `tests/`: the cited test files of that tag (44 unit files, `smoke.js`) and `audit-corpus.js`,
  unchanged.
- `run.mjs`: `node run.mjs --package <path to the installed runward>`. It refuses when the installed
  `package.json` version is not the kit's, compares every installed file's sha256 with the list of the
  attested tarball the kit carries, then runs the suites from a work directory that links the
  installed `dist/`, `templates/`, `regimes/`, `examples/` and `package.json` beside the copied tests,
  so the installation itself is never written to (measured above by copying into the package; the
  linked layout is measured in the implementing pull request).
- The report: `qualification-report.json` and `junit.xml`. Per requirement: id, cited test, kind
  (`interface`, `internal`, `static`), result, duration. Per run: runward version, Node version,
  OS and architecture, `git` version, the result of the digest comparison. The 9 cases that need the
  source tree are listed as `not-run-here`, with a pointer to the release's committed
  `reports/junit.xml` that recorded them, never counted as passed. The report is plain and unsigned:
  runward holds no key (ADR-0054, crossing 3). A user who needs it signed signs it with their own
  identity.
- `docs/`: that version's requirements document, its open anomalies (decision 6), the corpus
  description, and the templates (decision 5).
- Built in the release chain's prepare phase from the tag, attached to the draft with the other assets,
  and attested like the tarball (ADR-0085), so `gh attestation verify` answers for it, and offline as
  `docs/verifying-a-release.md` Step 3 describes.

**2. Interim, available from the next pull request: running the repository's suite on an
installation (option D).** A section of `regulated-adoption.md` gives the commands: clone at the tag,
`npm install runward@X.Y.Z` elsewhere, run the cited files against it as above. It costs no release
work, and is what the kit's runner automates.

**3. Ground truth: the attack corpus becomes addressable and machine-read.** Each case gets a stable
identifier (`AC-001` …), the register entry or ADR it came from, and its direction (`REFUSE` or
`ACCEPT`). `node audit-corpus.js --cli <path> --json <file>` writes, per case: identifier, name,
direction, expected outcome, the exit code observed, pass or fail, and the reason the case exists; per
run: the runward version and the totals by direction. A third party re-runs it from the kit against
any installed version and compares JSON. What it measures is stated in the result: regression on 16
known vectors, 12 in one direction and 4 in the other, not a detection rate on unknown ones. No
accuracy target is published: a percentage over 16 hand-picked cases would read as a rate it is not.
The rate-like figure runward does publish, the mutation ratchet summary (ADR-0079), is referenced from
the kit as it already is from Step 6 of `docs/verifying-a-release.md`.

**4. The hard line, in every document of the kit.** The kit's README opens with: the material helps the
user produce their own tool qualification or tool confidence work, in their context of use; runward
does not determine a TQL, a TCL, a tool class or a validation outcome, and no body has assessed runward
or this kit. The overclaim guard (`test/unit/no-overclaim.test.js`) already scans `docs/`, where the
templates are authored; its scan list gains the kit's README and runner output strings.

**5. Templates, authored in the repository under `docs/compliance/qualification/`, shipped in the kit,
never in the npm package.** Two first, as the ROADMAP names them: a plan and accomplishment-summary
skeleton for an applicant using runward under DO-178C criteria 3, and a tool classification and
validation report skeleton for ISO 26262-8 clause 11 with method 1c. Each is a skeleton for the user's
document: runward fills the tool description, the requirement references and the place where the kit
report is cited; the classification, the use case, the error-detection argument and the conclusion are
blank, with the questions to answer. IEC 61508-3 7.4.4 and EN 50716 6.7 templates are added on a first
request, not before. Clause numbers and table contents that could not be read at the source stay marked
"to check against your licensed copy".

**6. Open anomalies per version, generated, not written.** A script reads the register and lists, for
version X.Y.Z, every entry whose affected range includes it and whose `fixed-in` is later or absent,
with the entry's workaround; the kit carries the result. This needs `affected-from` and `fixed-in` as
fields a parser can read, which is a change to the register's guarded vocabulary, made in its own pull
request (as ADR-0086 did for `advisory`).

**Decisions for the maintainer.**

1. The channel: C (recommended), A, B or D alone (Alternatives below).
2. The scope of the suite: every runnable cited case (148 on 0.42.3), each result labelled with its
   kind (recommended), or the 68 interface cases only. The first gives more evidence; the second gives
   evidence only through the interface a user's process consumes.
3. `test/smoke.js` in the kit: skip its one `js-yaml` check with a `skipped` line in the report
   (recommended), rewrite that check without `js-yaml`, or have the runner install `js-yaml`.
4. The corpus identifiers and its `--json` output (decision 3), in a pull request before the kit.
5. The two first templates and where they live (decision 5).
6. Machine-readable `affected-from` and `fixed-in` in the register (decision 6), its own pull request.
7. The report stays unsigned (recommended), or the runner emits an unsigned in-toto statement the user
   signs with their own tooling.
8. Which release first carries the kit; until then decision 2 (option D) is the documented route.

## Alternatives discarded

- **(A) A `runward qualify` command inside the package.** The most convenient for the user: one
  command, no download. It ships the suite to every adopter, regulated or not (+18% packed for the
  interface cases with smoke and the corpus, +40% with the documents, +51% with every cited file), and
  it puts a test runner, a process spawner and a report writer into the CLI being judged, beside the
  verdict path ADR-0054 keeps free of spawning. It cannot sign what it writes (runward holds no key).
  And a test suite shipped inside the tool cannot be fetched or verified apart from the tool; a kit
  that is a separate, attested file can. Kept open for one case: if the kit is shown to be used and
  users ask for it in the package, the corpus alone (+1.5%) is the cheap first step.
- **(B) A separate npm package, `runward-qualification`, versioned with the CLI.** It gives `npm
  install` and npm provenance, and costs a second package to publish, pin, attest and keep in lockstep
  on every release and every supported line, which is the "second product to govern" ADR-0039 defers
  behind demand. npm would also resolve its tests against whatever `runward` the user's tree holds,
  while the kit must refuse any version but its own.
- **(D) Only document how to run the repository's suite on an installation.** Cheapest, and adopted as
  the interim (decision 2). Alone, it leaves each user to rebuild the runner, the digest check and the
  report, from a tree that is not attested as a kit; the evidence they produce is not comparable between
  users or versions.
- **Publish an accuracy target, as Sonar does for its security analysis.** A target needs a benchmark
  of cases the tool was not written against. The corpus is the opposite: every case is a defect that
  was found and fixed. The result is published as what it is (decision 3).
- **Templates in the npm package (`templates/`).** `templates/` is what `init` scaffolds into a mission;
  a tool qualification plan is the applicant's document, not a mission deliverable, and most adopters
  would never open it.

## Consequences

- **Positive.** A regulated user downloads one attested file per version, runs it on the installation
  they will use, and keeps a report that names each requirement, the test that exercised it, how that
  test reached the code, and the environment. The defect register and the requirements reach them in
  the version they run. The npm package does not grow.
- **Negative, accepted.** One more asset in every release, built and attested by the chain, and one more
  thing to check in the draft before publishing. The runner, the corpus `--json`, the anomaly script
  and two templates are new code and documents to maintain. The internal and CLI-fixture cases (78 of
  148) tie the kit to compiled module paths of that version; the kit is per version for that reason. A
  test renamed between versions changes the report; `tor-traceability.test.js` already reddens on it.
- **On the documents.** `regulated-adoption.md` §8.4 says runward lacks "a numbered and individually
  verifiable set of tool requirements" and "trace data linking requirement to test case"; the
  requirements document and its traceability guard have existed since 2026-08-11, and the paragraph is
  corrected when the kit lands. `docs/verifying-a-release.md` gains the kit among the assets it
  verifies. No change to the gate or the mission.

## What would settle it

- **For C over A and B**: the kit built once from a tag, attached to a draft, run by someone other than
  the maintainer on a machine that never held the repository, from the attested asset to the report,
  following only the kit's README. If they need anything else, the README or the runner is wrong.
- **For the scope (decision 2)**: an assessor, or a user preparing a tool classification, reads one
  report and says whether the `internal` results are usable to them. If they discard them, the kit
  ships the interface cases only.
- **For the linked work directory**: the runner's layout run against an installed package without
  writing into it, on Linux, macOS and Windows (the CI legs), with the same 148 results.
- **For the ground truth**: a third party re-runs the corpus from the kit against two published
  versions and gets the same JSON the release recorded, case by case.

## Reevaluation trigger (mandatory, dated)

Reopen when a user or assessor states what they need from a kit that this one does not supply; when
the npm package's `files` changes in a way that moves a repository case into the package or out of it;
when DO-330, ISO 26262-8 clause 11 or EN 50716 is read in a licensed copy and a statement above proves
wrong; when a body assesses runward or the kit (the wording ceiling of decision 4 changes then, and only
then); or when a second maintainer makes option B's lockstep affordable.

**Trigger set on**: 2026-10-01 · **Watched via**: the security and support intake (ADR-0084), the
`files` field at each release's runbook step, and `regulated-adoption.md` §8's sourcing note.

## References

- `docs/compliance/tool-operational-requirements.md`; `test/unit/tor-traceability.test.js`;
  `test/audit-corpus.js`; `test/smoke.js`; `docs/compliance/known-defects.md`;
  `docs/compliance/regulated-adoption.md` §8; `docs/verifying-a-release.md`; `ROADMAP.md`.
- FAA AC 20-115D, faa.gov/documentLibrary/media/Advisory_Circular/AC_20-115D.pdf, read 2026-10-01.
- EASA AMC-20, Easy Access Rules, amendment 21 (AMC 20-115D §10), easa.europa.eu, read 2026-10-01.
- FAA Order 8110.49A, faa.gov/documentLibrary/media/Order/FAA_Order_8110.49A.pdf, read 2026-10-01.
- IEC 61508-3:2010 and IEC 61508-4:2010 official previews (webstore.ansi.org preview pages), read
  2026-10-01; clause 7.4.4 wording from Validas, *Tool Qualification Plan for Testwell CTC++* v0.8 (2014),
  verifysoft.com, read 2026-10-01 (secondary).
- EN 50716:2023 official preview (NSAI, via i2.saiglobal.com), read 2026-10-01.
- ISO 26262-8:2018 clause 11 tables as reproduced in LDRA, *ISO 26262 Test Tool Qualification Technical
  Briefing* v2.0, and DO-330 criteria as reproduced in LDRA, *DO-330 Test Tool Qualification Technical
  Briefing* v2.0, ldra.com, read 2026-10-01 (secondary).
- FDA, *Computer Software Assurance for Production and Quality Management System Software* (final,
  3 February 2026), fda.gov guidance page read 2026-10-01; text from fda.gov/media/188844 as downloaded
  on 2026-09-29.
- AbsInt, absint.com/qualification; Vector, vector.com (VectorCAST DO-178 tool qualification);
  MathWorks, mathworks.com/products/do-178.html; Ferrocene, ferrocene.dev and public-docs.ferrocene.dev;
  all read 2026-10-01.
