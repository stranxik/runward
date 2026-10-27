# Recipe: prove a committed JUnit report is fresh, in your CI

**Status.** Option G of [ADR-0098](../adr/ADR-0098-whether-the-gate-says-how-old-a-committed-junit-report-is-and-what-it-may-read-to-say-it.md).
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
import { junitTestResult } from "runward/dist/lib/tool-adapters.js";

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
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const names = (xml) => new Set([...xml.matchAll(/<testcase\b[^>]*?\bname\s*=\s*"([^"]*)"/gi)].map((m) => decode(m[1])));
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

Two cases deserve a word:

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
