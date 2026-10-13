# ADR-0096: Code Quality and JUnit renderings of the verdict, and why runward's gaps are not filed as vulnerabilities

**Date**: 2026-10-13
**Status**: accepted (2026-10-13) — class R under ADR-0088 decision 2; the maintainer accepted the
record with the recommended answers: `--codequality <file>` and `--junit <file>` are written to files in a single run, like `--witness`; SARIF is never declared as `artifacts:reports:sarif` in the GitLab packaging, only kept as an artefact. An agent wrote this record; the maintainer decided (ADR-0088
decision 4, applied to decisions as to rows)
**Deciders**: the maintainer
**Method**: a fresh clone of `stranxik/runward` at `main@958d068` (runward 0.43.1), read on
2026-10-13: `src/lib/sarif.ts` (levels, `GATE_NON_SCOPE_SARIF`), `src/lib/check-contract.ts`
(`optionFault`, "one document per stdout", `conformanceRowsLocated`), `src/lib/evidence.ts` and
`src/lib/tool-adapters.ts` (the JUnit evidence adapter, `isJUnitReport`), ADR-0056, 0062, 0063, 0064,
0089, 0093, 0094. The GitLab documentation on Code Quality, JUnit reports and SARIF reports, as read
on 2026-10-13 by a gap analysis written for the maintainer outside this repository, in French
**Relates to**: [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md) (decisions 2 and 11),
[ADR-0094](ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md),
[ADR-0056](ADR-0056-the-evidence-layer-widens.md),
[ADR-0062](ADR-0062-the-sarif-schema-is-validated-against-the-official-one.md),
[ADR-0063](ADR-0063-what-a-sarif-finding-about-a-missing-file-anchors-to.md),
[ADR-0064](ADR-0064-the-verdict-gets-a-report-an-auditor-reads-alone.md)
**Would amend, by name, once accepted**: none. ADR-0064 carries a dated note (2026-10-13) narrowing its
sentence on GitLab and SARIF; this record argues the position that note points to.

## Context

**What GitLab shows in a merge request, by tier** (read 2026-10-13).

| Channel | Format | Tier | Needs a token |
|---|---|---|---|
| Code Quality widget in the merge request | JSON, CodeClimate-shaped: `description`, `check_name`, `fingerprint`, `severity`, `location.path`, `location.lines.begin` | Free (pipeline report: Premium; inline annotations in the diff: Ultimate) | no |
| Test summary panel in the merge request, Tests tab of the pipeline | JUnit XML (`artifacts:reports:junit`) | Free | no |
| Security tab, security dashboard, vulnerability report | SARIF 2.1.0 (`artifacts:reports:sarif`) | Ultimate, generally available from 19.2, ingested only when the job succeeds | no |

**What runward emits today.** `check --sarif` writes SARIF 2.1.0 to stdout, every strict term reaching
it, each rule carrying the non-scope in `fullDescription`, validated against the official schema
(ADR-0062). On GitHub it renders as code-scanning annotations. There is no Code Quality and no JUnit
rendering. `optionFault` enforces one document per stdout: `--json`, `--sarif`, `--vsa` and `--attest`
are mutually exclusive, so a CI that wants two documents runs `check` twice. `--witness <file>` is the
one output written to a file beside another.

**Why SARIF is the wrong channel on GitLab.** On Free and Premium it is not read at all. On Ultimate it
is read only from 19.2, so a self-managed instance a few versions behind does not have it. It is read
only when the job succeeds, so a red gate, the case that matters, files nothing unless the job is made
`allow_failure` or split. And it files each result in the vulnerability report, where it gets a
vulnerability's lifecycle (triage, dismissal, counts on the security dashboard, input to security
approval policies). A runward gap is a missing deliverable, an unresolved pointer or an unratified
decision: `GATE_NON_SCOPE` says the gate judges presence, pointers and integrity, never code quality or
security. Filing it as a vulnerability would make GitLab say something runward does not. ADR-0064
wrote "GitLab does ingest SARIF"; true on Ultimate from 19.2, and incomplete.

**A loop to close before it opens.** runward reads JUnit as evidence (ADR-0056: a row may cite a
committed `junit.xml` test case). A JUnit file runward itself wrote, committed and cited by a row,
would let the verdict rest on a previous verdict.

## Decision

**runward renders its verdict in two more open formats, Code Quality JSON and JUnit XML, from the same
payload as SARIF, computing nothing; the GitLab packaging uses them and never declares SARIF as a
security report; a JUnit file runward wrote is refused as evidence.**

1. **Code Quality JSON.** One issue per strict cause (`conformance[]` row), and one per deferred row
   beyond the declared horizon.
   - `check_name`: the SARIF `ruleId` of the same cause, so the two renderings name it alike.
   - `description`: the cause's problem text, ending « (runward gate: presence, pointers, integrity; not
     a code-quality or security judgement) ».
   - `severity`: `blocker` for a cause that makes the gate red, `info` for a deferred row. Fixed, never
     derived from a rule's `impact`: a second scale would be a view computing a state (ADR-0093 R1).
   - `location.path` and `location.lines.begin`: the manifest line where the row is located; a finding
     about an absent file anchors to the path it is about, as ADR-0063 ratified for SARIF, with line 1,
     so both renderings anchor it the same way.
   - `fingerprint`: SHA-256 over the canonical encoding (`docs/spec/witness.md` §3) of `check_name`,
     `location.path` and the row's rule identifier, never the line, so a moved row stays the same issue
     and the widget's new/resolved reading is right.
2. **JUnit XML.** `<testsuites name="runward gate verdict">` with a `runward.rendering` property naming
   the payload digest and the runward version; one `<testsuite>` per scope; one `<testcase>` per strict
   cause, failing, with the problem text; one `<skipped>` per deferred row; and one testcase, `runward
   gate`, failing when the exit code is 1 and passing when it is 0. No passing testcase is invented per
   green row: the panel's "tests" count must not read as tests runward executed, and the suite's name
   says « no test executed ».
3. **Shape on the command line** (question 1): written to files, `check --strict --codequality <file>
   --junit <file>`, beside `--json`, `--sarif` or `--witness` in the same run, so every rendering of
   one pipeline comes from one verdict computation. Both work without `--strict`; the document records
   which.
4. **The loop closed.** The evidence layer refuses a JUnit report carrying the `runward.rendering`
   property as evidence for a row, with a named violation kind, tested with a positive control (the same
   file without the property resolves as before).
5. **SARIF on GitLab** (question 2): the GitLab component and the integrity-pinned file (ADR-0094) do not
   declare `artifacts:reports:sarif`. The SARIF file is still produced and kept as a plain artifact for
   an adopter's own tooling. The adapters README and the per-tier guide say why, in the terms above. An
   adopter who wires it into the vulnerability report does so in their own pipeline, as their own
   mapping.
6. **Tests.** Golden files for both renderings on the example missions (green, red, deferred, missing
   file); a schema check of the Code Quality required fields and of JUnit's structure; the "every
   strict term reaches the rendering" test of SARIF (`sarif-verdict-terms.test.js`) extended to both;
   the claims guard applied to the rendered text.

## Alternatives discarded

- **SARIF as the GitLab channel.** Ultimate only, 19.2 and later, silent on a red job, and a gap filed
  as a vulnerability.
- **SARIF declared with the non-scope in every result.** The non-scope would sit inside a record GitLab
  already classes as a vulnerability; the classification is what misleads, not the missing sentence.
- **One passing testcase per green row.** Hundreds of "passed tests" a reader takes for executed tests.
- **Severity from the rule's `impact`.** A second severity scale inside a code-quality widget; readers
  would compare it with their scanners'.
- **Stdout, one document per run, like `--sarif`.** Consistent with today, but three runs of `check` in
  one pipeline can straddle a tree change and disagree; question 1.
- **Accept runward's own JUnit as evidence.** A verdict resting on a previous verdict.

## Consequences

- **Positive.** On GitLab Free, with no token, a merge request shows the gate's causes at file and line
  in the Code Quality widget and the test panel; the same files work on any forge that reads either
  format; GitHub is unchanged.
- **Negative, accepted.** Two more renderings to keep byte-stable; a JUnit panel whose vocabulary
  ("tests") runward cannot change, mitigated by the suite's name; one more evidence refusal to
  explain.
- **On other boundaries.** ADR-0011 as noted on 2026-10-13: writing a file in a standard's format is a
  gate output. The verdict and its exit code do not change.

## What would settle it

**Questions for the maintainer** (each with the recommendation):

1. **Files or stdout.** (a) `--codequality <file>` and `--junit <file>`, combinable in one run with any
   stdout document; (b) stdout, joining the one-document-per-stdout rule. **Recommended: (a)**: one
   verdict computation feeds every rendering of a pipeline, and the precedent is `--witness <file>`.
   `--sarif` keeps its stdout form; a file form for it can follow on the same pattern.
2. **SARIF in the GitLab packaging.** (a) Never declared as `artifacts:reports:sarif`, kept as a plain
   artifact; (b) an opt-in input of the component. **Recommended: (a)**: an input would put runward's
   name on the choice to file gaps as vulnerabilities; an adopter who wants it writes the line
   themselves.

**Evidence that would ratify or reverse it:**

- On the offline GitLab CE bench (ADR-0094), a red merge request shows each cause in the Code Quality
  widget and the test panel without a token, and the same tree's green run resolves them by
  fingerprint.
- A moved manifest row keeps its fingerprint; a planted strict term missing from either rendering
  reddens the extended verdict-terms test.
- A row citing a runward-written JUnit file is refused; the same file without the property resolves.
- Reversal: a reader taking the JUnit panel's counts as executed tests despite the suite's name, or an
  Ultimate adopter showing that Code Quality annotations cannot carry what the gate needs.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-01-13, or earlier when: GitLab ingests SARIF outside the vulnerability report (a
findings channel that is not a vulnerability); GitLab changes the Code Quality or JUnit report formats;
or an adopter shows GitHub code-scanning alerts from runward being counted as vulnerabilities in their
security reporting, which would reopen the GitHub side of the same question.

**Trigger set on**: 2026-10-13 · **Watched via**: the rendering golden tests, the verdict-terms test,
the offline GitLab CE bench.

## References

- `src/lib/sarif.ts`, `src/lib/check-contract.ts`, `src/lib/evidence.ts`, `src/lib/tool-adapters.ts`,
  `test/unit/sarif-verdict-terms.test.js` at `main@958d068`.
- GitLab documentation: Code Quality (report format and tiers), `artifacts:reports:junit`,
  `artifacts:reports:sarif` (read 2026-10-13, outside this repository).
- ADR-0011 (note of 2026-10-13), ADR-0056, ADR-0062, ADR-0063, ADR-0064 (note of 2026-10-13), ADR-0093
  decisions 2 and 11, ADR-0094.
