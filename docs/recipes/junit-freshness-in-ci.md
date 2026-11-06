# Recipe: prove a committed JUnit report is fresh, in your CI

**Status.** Option G of [ADR-0098](../adr/ADR-0098-whether-the-gate-says-how-old-a-committed-junit-report-is-and-what-it-may-read-to-say-it.md),
extended to every report a mission cites by [ADR-0115](../adr/ADR-0115-the-shipped-example-cites-machine-evidence-the-ci-regenerates-it-before-the-gate-and-a-required-nature-refuses-under-strict.md)
([below](#every-report-a-mission-cites-not-only-junit)), and taken out of the agent's reach by
[ADR-0122](../adr/ADR-0122-runward-integrations-mit-recipes-outside-the-verdict-each-regenerates-its-report-out-of-the-agents-reach-and-counts-only-while-its-control-passes.md)
([below](#out-of-the-agents-reach-runward-integrations)).
Documentation and a script to copy into **your** repository. Nothing here changes how the gate judges a
row, and the gate never runs the script: freshness is proved where the tests run, outside the verdict
path (ADR-0054).

## The problem

A row that cites `test:reports/junit.xml::a case name` is judged on the case the committed report
**records**: present and green. The report carries no commit and no date, so the gate cannot tell
which state of the code produced it, and a stale report reads as it was committed. Rename a cited case
out of the suite, leave the report untouched, and `runward check --strict` stays green on a test that
no longer exists. runward measured exactly that on its own mission (RWD-2026-0113).

The gate does not try to date the report: that would need git or the clock in the verdict, which
ADR-0054 refuses, or file modification times, which a fresh clone resets. What it does instead, on
every strict run where at least one row rests on a committed JUnit report, is say so:

```text
  ◌ 11 row(s) judged on a committed JUnit report (reports/junit.xml) — its freshness is not verified by this command: the gate reads the cases the report records, never when it was produced. Regenerate it in your CI and compare: https://github.com/stranxik/runward/blob/main/docs/recipes/junit-freshness-in-ci.md
```

`check --strict --json` carries the same count as `committedJUnit` (see
[interop.md](../interop.md#reading-check---json)). That line is a disclosure: the verdict and the exit
code do not move. This recipe is the guard that closes the gap: a CI job that regenerates the report
from the tree under review and refuses when it records different cases, or different verdicts, from
the committed one.

## What the guard compares, and why not bytes

It compares the **census of cases and the verdict of each case**, never the bytes:

- a case in the committed report and no longer in the suite: refused (a row citing it is green on a
  test that does not exist);
- a case in the suite and not in the committed report: refused (the report is behind the suite);
- a case whose verdict differs (pass in one report; failed, errored or skipped in the other): refused.

Order, durations, timestamps, host names and absolute paths are ignored. Test runners that run files in
parallel write cases in completion order, so two honest runs on different machines differ byte for
byte; a byte comparison would flap, and a guard that flaps gets switched off. The verdict of each case
is read with runward's own reader (`junitTestResult`), the one the gate uses, so the guard and the gate
cannot disagree about what "green" means.

This is what [scripts/reports-fresh.mjs](../../scripts/reports-fresh.mjs) does for runward's own
reports, reduced to the JUnit part.

## The script

Save it as `scripts/junit-fresh.mjs`. It needs Node 22.12 or later (runward's own floor) and
`runward` installed in the project as a development dependency, pinned to the version your CI runs
the gate with.

<!-- recipe:junit-fresh.mjs -->
```js
// junit-fresh.mjs: is the committed JUnit report the one this tree produces?
//   node junit-fresh.mjs <committed.xml> <regenerated.xml>
// Exit 0 when both reports record the same cases with the same verdicts, 1 on any difference,
// 2 when an input is missing or is not a JUnit report.
import { readFileSync, existsSync } from "node:fs";
import * as runward from "runward/dist/lib/tool-adapters.js";
const { junitTestResult } = runward;

const [committedPath, regeneratedPath] = process.argv.slice(2);
const load = (p) => {
  if (!p || !existsSync(p)) { console.error(`junit-fresh: no file at ${p ?? "(missing argument)"}`); process.exit(2); }
  const xml = readFileSync(p, "utf8");
  if (!/<testsuites?\b/.test(xml)) { console.error(`junit-fresh: ${p} is not a JUnit report`); process.exit(2); }
  return xml;
};
const committed = load(committedPath), regenerated = load(regeneratedPath);

// Every case name a report records (decoded as the gate decodes it). Order is ignored on purpose:
// parallel runners write cases in completion order, so two honest runs differ byte for byte.
// A runward that has `decodeJUnitValue` (after 0.46.0) reads a `"` the same whichever Node.js wrote the
// report (Node.js up to 24.21.x writes it `&amp;quot;`, nodejs/node#65971); an older one decodes once.
const decodeOnce = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const names = (xml) => {
  const decode = runward.decodeJUnitValue
    ? ((legacy) => (s) => runward.decodeJUnitValue(s, legacy))(runward.junitWritesQuotesTwice(xml))
    : decodeOnce;
  return new Set([...xml.matchAll(/<testcase\b[^>]*?\bname\s*=\s*"([^"]*)"/gi)].map((m) => decode(m[1])));
};
const before = names(committed), after = names(regenerated);

const gone = [...before].filter((n) => !after.has(n));
const added = [...after].filter((n) => !before.has(n));
// The verdict of each case is read with runward's own reader, the one the gate uses.
const changed = [...after].filter((n) => before.has(n) && junitTestResult(committed, n) !== junitTestResult(regenerated, n));

const show = (label, list) => {
  if (list.length === 0) return;
  console.error(`  ${list.length} case(s) ${label}:`);
  for (const n of list.slice(0, 10)) console.error(`    ${JSON.stringify(n)}`);
  if (list.length > 10) console.error(`    … and ${list.length - 10} more`);
};
if (gone.length + added.length + changed.length === 0) {
  console.log(`junit-fresh: ${committedPath} records the ${before.size} case(s) this tree produces, with the same verdicts`);
  process.exit(0);
}
console.error(`junit-fresh: ${committedPath} is not the report this tree produces`);
show("in the committed report and no longer in the suite (a row citing one is green on a test that does not exist)", gone);
show("in the suite and not in the committed report", added);
show("whose verdict differs (pass in one report, not green in the other)", changed);
console.error("  Regenerate the report, commit it, and push again.");
process.exit(1);
```

Usage: `node scripts/junit-fresh.mjs <committed.xml> <regenerated.xml>`. Exit 0 when the two reports
record the same cases with the same verdicts, 1 on any difference (each one named), 2 when an input is
missing or is not a JUnit report.

## The CI job

Three steps, in this order: keep a copy of the committed report, run the command that wrote it,
compare. Run the **same** command that produced the committed report (the same test runner, reporter
and post-processing), so the guard compares like with like. If the suite itself fails, the job fails at
that step, which is the right answer too.

### GitHub Actions

```yaml
  junit-fresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: cp reports/junit.xml "$RUNNER_TEMP/committed.xml"
      # Your command that writes reports/junit.xml, the one whose output you commit.
      - run: npm run test:junit
      - run: node scripts/junit-fresh.mjs "$RUNNER_TEMP/committed.xml" reports/junit.xml
```

Make the job a required status check on the default branch (branch protection or a ruleset).

### GitLab CI

```yaml
junit-fresh:
  image: node:22
  script:
    - npm ci
    - cp reports/junit.xml /tmp/committed.xml
    # Your command that writes reports/junit.xml, the one whose output you commit.
    - npm run test:junit
    - node scripts/junit-fresh.mjs /tmp/committed.xml reports/junit.xml
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Turn on "Pipelines must succeed" for merge requests, so a stale report cannot be merged.

A project whose tests are not in Node (pytest, Maven, Go) keeps its own test command in the middle
step and adds a Node setup for the comparison: the script reads any JUnit XML.

## What a green job says, and what it does not

A green `junit-fresh` job says: **in this pipeline, on this tree, the test command produced a report
that records the same cases, with the same verdicts, as the committed one.** Every row the gate judged
on that report was judged on cases this tree still produces.

It does not say:

- that the tests are good tests. That is review, and the rows that cite them;
- anything to the gate. The gate still reads the committed report and still prints the `◌` line; the
  job runs beside `runward check --strict`, it does not feed it;
- anything on a branch where the job is not required. Without the required check a stale report can
  still be merged, and the gate reads it as committed.

Three cases deserve a word:

- **A report written by another Node.js.** `node --test`'s junit reporter writes a `"` of a test name
  as `&amp;quot;` up to Node.js 24.21.x (and in 20.x, 22.x and 25.x), and as `&quot;` from 24.22.0
  (nodejs/node#65971). With a runward after 0.46.0 the script reads both as the same name, as the gate
  does; with an older one, every case whose name carries a `"` shows as gone and added. Pin the Node.js
  of the CI job to the one that wrote the committed report (`node-version-file: .nvmrc`) either way.
- **A case skipped on one platform and run on another** (a test that needs a case-insensitive
  filesystem, say) shows as "verdict differs". Generate the committed report on the same platform as
  the CI job, or keep such cases out of the rows that cite the report. runward's own guard tells this
  case apart and only reports it; this recipe stays strict.
- **A report that records a failing case.** A red case is not evidence to the gate, and the comparison
  holds the regenerated report to the same verdict: commit a report regenerated after the fix.

## When this recipe changes

When the gate's JUnit reader changes (how it decodes names, what counts as green), the script follows
it: it imports that reader. When a test runner in common use starts writing a commit or a source digest
into its JUnit output, ADR-0098's reevaluation trigger reopens the question of reading it in the gate
(option F).

## Every report a mission cites, not only JUnit

A JUnit report is one kind of evidence a row can cite. A lint report (ESLint JSON per file, SARIF per
rule) and a coverage report (LCOV) have the same gap: the gate reads what the committed file records and
never runs the tool, so a report written by hand reads as the tool's. Measured on 2026-11-05, a JSON file of
93 bytes satisfied the `eslint` nature of a row. And they catch what JUnit cannot: empty every test body and
keep the names, and the JUnit report is green case for case while the coverage report shows that the domain
no longer runs; add a file that executes a model's output, and no cited file changes while the SARIF log
records the rule it breaks.

### The worked case: the shipped example

`runward init --example` lays down a mission that does this end to end (ADR-0115):

- `code/eslint.config.mjs` encodes the floor's boundaries as lint rules;
- `code/scripts/` holds one script per report (`junit-committable.mjs`, `coverage-committable.mjs`,
  `lint-committable.mjs`), each removing only what ties the output to the machine that ran it;
- `npm run reports` writes `code/reports/` (JUnit, LCOV, ESLint JSON, SARIF), committed;
- `npm run reports:fresh` (`scripts/reports.mjs --check`) regenerates the four into a scratch directory and
  compares them with the committed ones; it never writes `reports/`;
- `runward/hooks.json` runs it before the gate: `{ "before": ["cd code && npm install --no-audit --no-fund
  --loglevel=error && npm run --silent reports:fresh"] }`.

Copy what fits your stack. A project that already runs a linter, a coverage tool and a test runner adds the
normalising step and the comparison; the scripts are short on purpose.

### What the comparison reads, and why not bytes

For each report: what the gate reads of it, and what else it records that does not depend on the machine.

| Report | Compared | Not compared |
|---|---|---|
| JUnit | every case (suite, classname, name) and its verdict; failures anywhere | order, durations, host names, output |
| LCOV | every file measured, and whether anything executed it | hit counts, function and branch detail |
| ESLint JSON | every file linted, its error and warning counts, the rule and line of each message | message text, columns, order |
| SARIF | every rule in force; the rule, level, file and line of each result | message text, order |

Measured on the example: Node.js 22 and 24 write the same coverage with different hit counts on two lines.
A byte comparison would refuse an honest pipeline the first time its Node.js differs from the one that
wrote the committed report, and a guard that fails honest pipelines is switched off.

### The CI job

Run the gate with `--hooks`: the `before` commands of `runward/hooks.json` run first, a hook that fails
fails the gate, and with no `hooks.json` nothing runs and the run says so. The samples `runward init` writes
into `runward/adapters/` (GitHub Actions, GitLab CI) do it, and so do the GitHub Action and the GitLab
template, whose `hooks` input defaults to `true`:

```yaml
      - uses: stranxik/runward@<sha>
        with:
          version: <x.y.z>
          hooks: 'true'        # the default: runward/hooks.json `before` commands run, then the gate
```

```yaml
include:
  - remote: "https://github.com/stranxik/runward/releases/download/vX.Y.Z/runward-gitlab-gate-X.Y.Z.yml"
    integrity: "sha256-<base64>"
    inputs:
      hooks: true            # the default
```

A plain `runward check` never runs a hook (ADR-0008); only `--hooks` does, and the CI integrations pass it.
The commands are your repository's, run with the trust you give `npm test`: never run them under
`pull_request_target` on an untrusted head.

### What a green job says, and what it does not

A green `check --strict --hooks` says: **on this tree, the tools produced reports that say what the committed
ones say, and the gate judged the rows on them.** It does not say:

- that the instrument was not changed. The scripts, the lint configuration, `hooks.json`, the `package.json`
  scripts and the CI workflow are files in the tree under review. Measured: a domain rewritten around a
  database driver, pushed with `reports.mjs` reduced to `process.exit(0)` and the token its pointer names
  kept in a comment, is green. Put those paths and
  `runward/` under CODEOWNERS (or a ruleset requiring review), and cite them from a row so that a sealed
  mission's seal covers them (the example cites `file:code/eslint.config.mjs#no-restricted-imports`,
  `file:code/scripts/reports.mjs#--check` and `file:runward/hooks.json#reports:fresh`); or take the
  regeneration out of the tree altogether, [below](#out-of-the-agents-reach-runward-integrations);
- that the code is right. A lint rule refuses the shapes it names; a coverage report says a file ran, never
  that it was tested well.

## Out of the agent's reach: runward-integrations

The comparison above runs scripts the tree carries, from a hook the tree carries, so the agent whose work
it checks can rewrite it. [`runward-integrations`](../../packages/runward-integrations/README.md)
(ADR-0122) moves the regeneration out of the tree: each recipe is a CI step taken from runward's
repository at a pinned commit (a composite action on GitHub, an included template on GitLab) that runs the
project's own command, normalises the report as above, and replaces the report the rows cite before the
gate reads it. Its command lives in a workflow the agent cannot write (a reusable workflow of yours on
GitHub, the pipeline of a protected project on GitLab), and the mission's workflow only calls it by commit.

What stays the agent's is what the tools exist to read: the tests, the sources, the lint configuration. And
a report regenerated by a plain CI step is still `declared` (ADR-0119): to bind it to the tree, run the
same command as a leg of a `runward-run` policy (ADR-0120), which reaches `attested` once your CI signs the
run.

A recipe is counted only while its control passes: the shipped example, a planted sabotage the gate lets
through on the committed reports, refused once the recipe's step regenerated them, and the healthy tree
accepted. What each control plants, and what each recipe does not catch, is in the package's README.

<!-- runward-integrations:count — generated from the recipes' manifests by `node packages/runward-integrations/src/cli.js count --write`; CI refuses a text that counts a recipe whose control does not pass on the tree (runward ADR-0122 decision 3) -->
| Recipe | Report | `requires:` | Steps | Level of its report | Maintainer | Count |
|---|---|---|---|---|---|---|
| [`sarif`](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/recipes/sarif/manifest.json) | SARIF 2.1.0 | `sarif` | GitHub Actions, GitLab CI | `declared` as a CI step; `attested` as a runward-run leg, once the run is signed | stranxik | counted: its control passed on 2026-11-06, with runward 0.46.0 |
| [`junit`](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/recipes/junit/manifest.json) | JUnit XML | `junit` | GitHub Actions, GitLab CI | `declared` as a CI step; `attested` as a runward-run leg, once the run is signed | stranxik | counted: its control passed on 2026-11-06, with runward 0.46.0 |
| [`coverage`](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/recipes/coverage/manifest.json) | LCOV | `coverage` | GitHub Actions, GitLab CI | `declared` as a CI step; `attested` as a runward-run leg, once the run is signed | stranxik | counted: its control passed on 2026-11-06, with runward 0.46.0 |

**Counted: 3** (`sarif`, `junit`, `coverage`). **Not counted: 0**.
<!-- /runward-integrations:count -->
