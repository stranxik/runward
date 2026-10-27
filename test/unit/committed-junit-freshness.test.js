// ADR-0098, options B and G, held both ways.
//
// B: a `test:` pointer at a committed JUnit report is judged on the case the report RECORDS, and the
// report carries no commit and no date. `check --strict` now counts the rows that rest on one and says
// their freshness is not verified by this command; `--json` carries the count as `committedJUnit`.
// Pinned here: the line and the field are present when such a row exists, absent when none does,
// absent without --strict, and the exit code is the same either way (a disclosure, never a gap).
//
// G: the recipe's comparator (docs/recipes/junit-freshness-in-ci.md) is documentation an adopter
// copies. The script is extracted from the page itself and run, so the page cannot drift from what it
// claims: same census in another order is fresh, a case gone, a case added or a verdict changed is
// refused, a missing input is exit 2.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { machinePayload } from "../../dist/lib/check-contract.js";
import { committedJUnitLedger } from "../../dist/lib/evidence.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", COLUMNS: "400" };
const run = (cwd, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd, encoding: "utf8", env: ENV });
const dirs = [];
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const tmp = (p) => { const d = mkdtempSync(join(tmpdir(), p)); dirs.push(d); return d; };

const CITED = 'test:code/reports/junit.xml::"guard: a fabricated account reference never routes — escalated to review"';
const LINE = /◌ (\d+) row\(s\) judged on a committed JUnit report \(([^)]*)\) — its freshness is not verified by this command/;

// One `init --example`, copied per test: each test edits its own copy.
let template;
function example() {
  if (!template) {
    template = tmp("rw-junit-fresh-template-");
    assert.equal(run(template, "--yes", "init", "--example").status, 0);
  }
  const dir = tmp("rw-junit-fresh-");
  cpSync(template, dir, { recursive: true });
  const floor = readFileSync(join(dir, "runward", "floor.md"), "utf8");
  assert.ok(floor.includes(CITED), "the shipped example cites its committed JUnit report; this fixture depends on it");
  return dir;
}

test("B: a row judged on a committed JUnit report is counted in the output and in --json, and the verdict does not move", () => {
  const dir = example();
  const text = run(dir, "check", "--strict");
  const m = text.stdout.match(LINE);
  assert.ok(m, `the line must be printed:\n${text.stdout}`);
  assert.equal(m[1], "1");
  assert.equal(m[2], "code/reports/junit.xml");
  assert.match(text.stdout, /docs\/recipes\/junit-freshness-in-ci\.md/, "the line names where the guard belongs");
  const json = run(dir, "check", "--strict", "--json");
  const j = JSON.parse(json.stdout);
  assert.deepEqual(j.committedJUnit, { rows: 1, reports: ["code/reports/junit.xml"], freshness: "not verified by this command" });
  assert.equal(text.status, 0, "a disclosure is not a gap");
  assert.equal(json.status, 0);
  assert.equal(j.exitCode, 0);
  assert.equal(j.verdict, "clean");
  // Without --strict nothing was judged, so nothing is said.
  const lenient = run(dir, "check", "--json");
  assert.equal(JSON.parse(lenient.stdout).committedJUnit, undefined, "absent without --strict: no row was judged");
});

test("B: with no row citing a committed JUnit report, the line and the field are absent, and the exit code is the same", () => {
  const dir = example();
  const f = join(dir, "runward", "floor.md");
  // The same row, pointed at the test SOURCE file that carries the name: judged by name, not on a report.
  writeFileSync(f, readFileSync(f, "utf8").replace(CITED, CITED.replace("code/reports/junit.xml", "code/test/triage.test.ts")));
  const text = run(dir, "check", "--strict");
  assert.doesNotMatch(text.stdout, LINE, "nothing rests on a committed report: nothing to say");
  assert.doesNotMatch(text.stdout, /committed JUnit report \(/);
  const json = run(dir, "check", "--strict", "--json");
  const j = JSON.parse(json.stdout);
  assert.equal("committedJUnit" in j, false, "absent, so every other payload keeps its bytes");
  assert.equal(json.status, 0, "the same exit code as with the row citing the report (the test above)");
  assert.equal(text.status, 0);
});

test("B: a bare path at the report, with no case named, is not counted (no case was judged on it)", () => {
  const dir = example();
  const f = join(dir, "runward", "floor.md");
  writeFileSync(f, readFileSync(f, "utf8").replace(CITED, "test:code/reports/junit.xml"));
  assert.deepEqual(committedJUnitLedger(join(dir, "runward")), { rows: [], reports: [] });
});

test("B: a red cited case is still counted (it was judged on the report) and the gap is the evidence layer's, not this line's", () => {
  const dir = example();
  const f = join(dir, "runward", "floor.md");
  writeFileSync(f, readFileSync(f, "utf8").replace(CITED, 'test:code/reports/junit.xml::"a case the report never recorded"'));
  const led = committedJUnitLedger(join(dir, "runward"));
  assert.equal(led.rows.length, 1);
  assert.deepEqual(led.rows[0], { deliverable: "floor.md", rule: "frontier-deterministic-boundary", reports: ["code/reports/junit.xml"] });
  const r = run(dir, "check", "--strict", "--json");
  const j = JSON.parse(r.stdout);
  assert.equal(r.status, 1, "the absent case reddens the gate, as before");
  assert.equal(j.committedJUnit.rows, 1);
});

test("B: the payload carries the block only when the count is above zero, inside the strict block", () => {
  const base = {
    deferredGaps: 0, through: null, horizon: null,
    breakdown: { rows: 0, applied: 0, deviated: 0, na: 0, typed: 0, prose: 0, signed: 0, duplicated: [], evidenceFiles: { total: 0, external: 0 }, proseRows: [] },
    corpus: { status: "package", missing: [], edited: [], extra: [] },
    seal: { present: false, count: 0, violations: [] },
    criticalScope: { total: 0, mapped: 0, unmapped: [] },
    strictBreakdown: { conformance: 0, corpus: 0, seal: 0, unratified: 0, proposed: 0, unboundRows: 0, charter: 0 },
    ratification: { rows: 0, lineByLine: 0, enBloc: 0, blind: 0, untraced: 0 }, ratificationRows: [],
    regulated: { on: false, unbound: [] }, requiresUnmet: [], prosePointers: [],
    workflowContract: { gating: false, malformed: [], joinBreaks: [], unmetRequires: [] }, delegation: null,
  };
  const ctx = (strict) => ({ version: "x", missionRoot: "/m", currentGate: "floor", adrCount: 0, clean: true, strict, gaps: 0, strictGaps: 0, hookFailed: 0, deliverables: [], conformance: [], corpusPin: null, corpusDrift: null, gateNonScope: [] });
  const two = { ...base, committedJUnit: { rows: [{ deliverable: "floor.md", rule: "a", reports: ["r/j.xml"] }, { deliverable: "floor.md", rule: "b", reports: ["r/j.xml"] }], reports: ["r/j.xml"] } };
  const none = { ...base, committedJUnit: { rows: [], reports: [] } };
  assert.deepEqual(machinePayload(two, ctx(true)).committedJUnit, { rows: 2, reports: ["r/j.xml"], freshness: "not verified by this command" });
  assert.equal("committedJUnit" in machinePayload(none, ctx(true)), false);
  assert.equal("committedJUnit" in machinePayload(two, ctx(false)), false, "a strict reading: absent without --strict");
  assert.equal(machinePayload(two, ctx(true)).exitCode, machinePayload(none, ctx(true)).exitCode);
  const keys = Object.keys(machinePayload(two, ctx(true)));
  assert.equal(keys.indexOf("committedJUnit"), keys.indexOf("gateNonScope") + 1, "last in the strict block: every key before it keeps its place");
});

test("B: an attestation re-derives the block, and a forged count does not verify", () => {
  const dir = example();
  const att = run(dir, "check", "--strict", "--attest").stdout;
  writeFileSync(join(dir, "att.json"), att);
  const honest = JSON.parse(run(dir, "verify", "att.json", "--json").stdout);
  assert.equal(honest.verified, true, JSON.stringify(honest.predicate));
  const j = JSON.parse(att);
  j.predicate.committedJUnit.rows = 0;
  writeFileSync(join(dir, "forged.json"), JSON.stringify(j, null, 2));
  const forged = JSON.parse(run(dir, "verify", "forged.json", "--json").stdout);
  assert.equal(forged.verified, false);
  assert.ok(forged.predicate.differing.includes("committedJUnit"), JSON.stringify(forged.predicate.differing));
});

// ── G: the recipe's comparator, extracted from the page and run ────────────────────────────────────

const RECIPE = readFileSync(join(ROOT, "docs", "recipes", "junit-freshness-in-ci.md"), "utf8");
function comparator() {
  const m = RECIPE.match(/<!-- recipe:junit-fresh\.mjs -->\n```js\n([\s\S]*?)```/);
  assert.ok(m, "the recipe carries the script under its marker");
  const dir = tmp("rw-junit-fresh-recipe-");
  // The adopter installs runward as a development dependency; here the package is this tree.
  mkdirSync(join(dir, "node_modules"));
  symlinkSync(ROOT, join(dir, "node_modules", "runward"), "dir");
  writeFileSync(join(dir, "junit-fresh.mjs"), m[1]);
  return dir;
}
const report = (cases) => `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n<testsuite name="s">\n${cases.join("\n")}\n</testsuite>\n</testsuites>\n`;
const pass = (n) => `<testcase name="${n}" classname="s" time="0.1"/>`;
const fail = (n) => `<testcase name="${n}" classname="s"><failure message="x"/></testcase>`;

test("G: the recipe's comparator accepts the same cases in another order, and refuses each kind of staleness", () => {
  const dir = comparator();
  const cmp = (a, b) => {
    writeFileSync(join(dir, "a.xml"), a);
    writeFileSync(join(dir, "b.xml"), b);
    return spawnSync(process.execPath, ["junit-fresh.mjs", "a.xml", "b.xml"], { cwd: dir, encoding: "utf8" });
  };
  const committed = report([pass("one"), pass("two &gt; x"), fail("three")]);
  const fresh = cmp(committed, report([fail("three"), `<testcase name="two &gt; x" classname="s" time="9.9"></testcase>`, pass("one")]));
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.match(fresh.stdout, /records the 3 case\(s\) this tree produces/);
  const gone = cmp(committed, report([pass("two &gt; x"), fail("three")]));
  assert.equal(gone.status, 1);
  assert.match(gone.stderr, /no longer in the suite[\s\S]*"one"/);
  const added = cmp(committed, report([pass("one"), pass("two &gt; x"), fail("three"), pass("four")]));
  assert.equal(added.status, 1);
  assert.match(added.stderr, /not in the committed report[\s\S]*"four"/);
  const changed = cmp(committed, report([pass("one"), fail("two &gt; x"), fail("three")]));
  assert.equal(changed.status, 1);
  assert.match(changed.stderr, /verdict differs[\s\S]*"two > x"/);
  const missing = spawnSync(process.execPath, ["junit-fresh.mjs", "a.xml", "nowhere.xml"], { cwd: dir, encoding: "utf8" });
  assert.equal(missing.status, 2);
  writeFileSync(join(dir, "c.txt"), "not a report\n");
  assert.equal(spawnSync(process.execPath, ["junit-fresh.mjs", "a.xml", "c.txt"], { cwd: dir, encoding: "utf8" }).status, 2);
});

test("G: the recipe is linked from the README sentence about committed reports and from interop.md", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  assert.match(readme, /a stale report reads as it was committed[^\n]*docs\/recipes\/junit-freshness-in-ci\.md/);
  const interop = readFileSync(join(ROOT, "docs", "interop.md"), "utf8");
  assert.match(interop, /`committedJUnit`[\s\S]*recipes\/junit-freshness-in-ci\.md/);
});
