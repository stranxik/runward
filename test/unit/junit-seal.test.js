// ADR-0102 D and E: a cited JUnit report is read whole before it is sealed (RWD-2026-0182).
//
// An adopter's report, 2026-10-23: the gate judges a JUnit report by the cases its pointers cite
// (ADR-0056), so `check --strict --freeze` sealed a report holding a `<failure>` on a case no
// pointer cited (a flaky test). The next CI run regenerated the report without that failure, the
// seal drifted, and the gate reddened for a defect unrelated to the change.
//
// D: `--freeze` refuses to seal while a cited report records failures or errors at its root.
// E: every `check` prints an advisory when a cited report is red outside the cited cases, and its
// verdict and exit code do not move. Each refusal is paired with the acceptance that forbids a guard
// refusing everything from passing: an all-green report seals, a skipped uncited case seals.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { junitRootFailures } from "../../dist/lib/tool-adapters.js";
import { citedJUnitNotGreen } from "../../dist/lib/evidence.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const check = (dir, ...a) => spawnSync("node", [CLI, "check", ...a], { cwd: dir, encoding: "utf8", env });

// ── The reading: junitRootFailures ─────────────────────────────────────────────────────────────

test("junitRootFailures counts failure and error elements, and not skipped ones", () => {
  const green = `<testsuites><testsuite name="s" tests="2"><testcase name="a"/><testcase name="b"></testcase></testsuite></testsuites>`;
  assert.equal(junitRootFailures(green), 0, "an all-green report records nothing");
  assert.equal(junitRootFailures(`<testsuite><testcase name="a"><skipped/></testcase></testsuite>`), 0,
    "a skipped case is not a failure for the seal");
  assert.equal(junitRootFailures(`<testsuite><testcase name="a"><failure message="x"/></testcase><testcase name="b"><error type="E">t</error></testcase></testsuite>`), 2);
  assert.equal(junitRootFailures(`<testsuite errors="0" failures="0"><testcase name="a"><failure/></testcase></testsuite>`), 1,
    "an element counts even when the declared counts say zero");
});

test("junitRootFailures reads the declared counts, and ignores what comments and CDATA quote", () => {
  assert.equal(junitRootFailures(`<testsuites failures="3" errors="1"><testsuite name="s"><testcase name="a"/></testsuite></testsuites>`), 4,
    "the root's declared failures and errors count without an element");
  assert.equal(junitRootFailures(`<testsuite failures="2"><testcase name="a"/></testsuite>`), 2, "a suite's declared count too");
  assert.equal(junitRootFailures(`<testsuites failures="0" errors="0"><testsuite failures="0" errors="0" skipped="3"><testcase name="a"/></testsuite></testsuites>`), 0,
    "zero declared and skipped declared: green");
  assert.equal(junitRootFailures(`<testsuite><testcase name="a"><system-out><![CDATA[expected <failure> here]]></system-out></testcase><!-- <error> --></testsuite>`), 0,
    "a console capture or a comment quoting the tag is not a failure");
});

// ── The ledger: citedJUnitNotGreen ─────────────────────────────────────────────────────────────

function fixture(report, evidence = 'test:reports/junit.xml::"cited case"') {
  const root = mkdtempSync(join(tmpdir(), "rw-junit-seal-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  mkdirSync(join(root, "reports"));
  writeFileSync(join(root, "reports", "junit.xml"), report);
  writeFileSync(join(mission, "floor.md"),
    `# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| r1 | applied | ${evidence} |\n`);
  return { root, mission };
}
const suite = (...cases) => `<testsuites><testsuite name="s">${cases.join("")}</testsuite></testsuites>\n`;

test("the ledger names a cited report red outside its cited cases, and nothing on a green one", () => {
  const red = fixture(suite(`<testcase name="cited case"/>`, `<testcase name="flaky"><failure/></testcase>`));
  const green = fixture(suite(`<testcase name="cited case"/>`, `<testcase name="other"/>`));
  const skipped = fixture(suite(`<testcase name="cited case"/>`, `<testcase name="later"><skipped/></testcase>`));
  try {
    assert.deepEqual(citedJUnitNotGreen(red.mission), [{
      report: "reports/junit.xml", failures: 1, citedCasesGreen: true, pointers: ['test:reports/junit.xml::"cited case"'],
    }]);
    assert.deepEqual(citedJUnitNotGreen(green.mission), [], "an all-green report is not listed");
    assert.deepEqual(citedJUnitNotGreen(skipped.mission), [], "a skipped uncited case is not listed");
  } finally { for (const f of [red, green, skipped]) rmSync(f.root, { recursive: true, force: true }); }
});

test("the ledger says when the cited case is itself red, and reads only test: pointers of applied rows", () => {
  const citedRed = fixture(suite(`<testcase name="cited case"><error/></testcase>`));
  const fileOnly = fixture(suite(`<testcase name="cited case"/>`, `<testcase name="flaky"><failure/></testcase>`), "file:reports/junit.xml");
  try {
    const [entry] = citedJUnitNotGreen(citedRed.mission);
    assert.equal(entry.citedCasesGreen, false, "the gate already refuses this row; the advisory sentence would be false");
    assert.equal(entry.failures, 1);
    assert.deepEqual(citedJUnitNotGreen(fileOnly.mission), [], "a report cited by file: is not read as a test result");
  } finally { for (const f of [citedRed, fileOnly]) rmSync(f.root, { recursive: true, force: true }); }
});

// ── End to end on `init --example`, whose floor cites code/reports/junit.xml ───────────────────

const UNCITED = '<testcase name="input boundary: a malformed payload is rejected, unknown keys included" classname="test"/>';
const withChild = (child) => `<testcase name="input boundary: a malformed payload is rejected, unknown keys included" classname="test">${child}</testcase>`;

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-junit-seal-ex-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: dir, env });
  const report = join(dir, "code", "reports", "junit.xml");
  const original = readFileSync(report, "utf8");
  assert.ok(original.includes(UNCITED), "the example's report carries the uncited case this test edits");
  return { dir, report, original, lock: join(dir, "runward", "evidence-lock.json") };
}

test("end to end: an uncited failure is advised on every check, verdict and exit unchanged, and refused at --freeze", () => {
  const ex = example();
  try {
    // Positive control: the example seals as shipped, and prints no advisory.
    const sealed = check(ex.dir, "--freeze");
    assert.equal(sealed.status, 0, sealed.stdout);
    assert.match(sealed.stdout, /sealed \d+ evidence file\(s\)/);
    assert.doesNotMatch(sealed.stdout, /Cited test reports|not green, even though/);
    const sealedLock = readFileSync(ex.lock, "utf8");
    rmSync(ex.lock);

    writeFileSync(ex.report, ex.original.replace(UNCITED, withChild('<failure message="flaky">timeout</failure>')));
    // E: advisory on the strict and on the lenient run; the exit code and the verdict do not move.
    for (const flags of [["--strict"], []]) {
      const r = check(ex.dir, ...flags);
      assert.equal(r.status, 0, `${flags.join(" ") || "check"}: an advisory never changes the exit code`);
      assert.match(r.stdout, /advisory code\/reports\/junit\.xml — the report is not green, even though the cited cases are: it records 1 failure\(s\) or error\(s\) outside the cases cited \(ADR-0102\)/);
    }
    const json = JSON.parse(check(ex.dir, "--strict", "--json").stdout);
    assert.equal(json.verdict, "clean");
    assert.equal(json.exitCode, 0);
    assert.deepEqual(json.junitNotGreen.map((j) => [j.report, j.failures, j.citedCasesGreen]), [["code/reports/junit.xml", 1, true]]);

    // D: the seal is refused, the report and the count are named, nothing is written.
    const refused = check(ex.dir, "--freeze");
    assert.equal(refused.status, 1, "a refused seal exits 1, as for a red gate");
    assert.match(refused.stdout, /refusing to seal: 1 JUnit report\(s\) cited by a `test:` pointer record failures or errors — a seal certifies a crossing; a report that says tests failed is not one \(ADR-0102\)\. Nothing was written\./);
    assert.match(refused.stdout, /✗ code\/reports\/junit\.xml — 1 failure\(s\) or error\(s\) at its root, even though the cited cases are green/);
    assert.equal(existsSync(ex.lock), false, "no lock was written");

    // An existing seal is not overwritten by a refused freeze either.
    writeFileSync(ex.lock, sealedLock);
    writeFileSync(ex.report, ex.original.replace(UNCITED, withChild('<error message="boom"/>')));
    assert.equal(check(ex.dir, "--freeze").status, 1);
    assert.equal(readFileSync(ex.lock, "utf8"), sealedLock, "the previous seal keeps its bytes");
  } finally { rmSync(ex.dir, { recursive: true, force: true }); }
});

test("end to end: a skipped uncited case neither advises nor blocks the seal", () => {
  const ex = example();
  try {
    writeFileSync(ex.report, ex.original.replace(UNCITED, withChild("<skipped/>")));
    const r = check(ex.dir, "--freeze");
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /sealed \d+ evidence file\(s\)/);
    assert.doesNotMatch(r.stdout, /Cited test reports|refusing to seal/);
    assert.equal(JSON.parse(check(ex.dir, "--strict", "--json").stdout).junitNotGreen, undefined,
      "the key is absent when nothing is listed: every other payload keeps its bytes");
  } finally { rmSync(ex.dir, { recursive: true, force: true }); }
});
