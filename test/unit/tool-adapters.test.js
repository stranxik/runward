// Wave B obj 4 (ADR-0056): committed-tool evidence adapters — JUnit first.
//
// A `test:reports/junit.xml::Case` pointer used to resolve by substring: the case's name is in the
// XML whether it passed or FAILED, so a red test passed the gate. The adapter reads the committed
// report STRUCTURALLY — present and green, present-not-green, or absent — and never runs the tool
// (reading a committed file is a gate output; spawning the runner is the ADR-0054 crossing). Still
// presence/integrity, never semantic satisfaction: a green case is proof it is recorded green, not
// that it tests the right thing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { junitTestResult, isJUnitReport } from "../../dist/lib/tool-adapters.js";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

test("obj 4: junitTestResult reads present-green, present-not-green, and absent — never runs anything", () => {
  const xml = `<testsuite><testcase name="ok"/><testcase name="body"></testcase>` +
    `<testcase name="bad"><failure>x</failure></testcase><testcase name="err"><error/></testcase>` +
    `<testcase name="skip"><skipped/></testcase></testsuite>`;
  assert.equal(junitTestResult(xml, "ok"), "pass", "a self-closing case is green");
  assert.equal(junitTestResult(xml, "body"), "pass", "an empty-body case is green");
  assert.equal(junitTestResult(xml, "bad"), "fail");
  assert.equal(junitTestResult(xml, "err"), "fail");
  assert.equal(junitTestResult(xml, "skip"), "fail", "a skipped test is not evidence");
  assert.equal(junitTestResult(xml, "missing"), "absent");
  assert.equal(junitTestResult(`<testcase name="okLonger"/>`, "ok"), "absent", "exact name — no substring collision");
});

test("audit 2026-08-14: HOMONYMS — every occurrence is scanned, one red reddens the verdict", () => {
  // The founding false green: two suites, the same test name, green first and red second. The
  // first version stopped at the first match and read "pass" — a false green inside the evidence
  // layer itself. Order must not matter.
  const greenThenRed = `<testsuite name="a"><testcase name="t" classname="A"/></testsuite>` +
    `<testsuite name="b"><testcase name="t" classname="B"><failure>x</failure></testcase></testsuite>`;
  const redThenGreen = `<testsuite name="b"><testcase name="t" classname="B"><failure>x</failure></testcase></testsuite>` +
    `<testsuite name="a"><testcase name="t" classname="A"/></testsuite>`;
  assert.equal(junitTestResult(greenThenRed, "t"), "fail", "a red homonym BEHIND a green one is seen");
  assert.equal(junitTestResult(redThenGreen, "t"), "fail", "order does not matter");
  const allGreen = `<testcase name="t" classname="A"/><testcase name="t" classname="B"></testcase>`;
  assert.equal(junitTestResult(allGreen, "t"), "pass", "every homonym green — pass");
});

test("audit 2026-08-14: CLASS::NAME pins one case among legitimate homonyms", () => {
  const xml = `<testsuite><testcase name="t" classname="A"/>` +
    `<testcase name="t" classname="B"><failure>x</failure></testcase></testsuite>`;
  assert.equal(junitTestResult(xml, "A::t"), "pass", "pinned to A — B's red is a different test");
  assert.equal(junitTestResult(xml, "B::t"), "fail", "pinned to B — the red one");
  assert.equal(junitTestResult(xml, "C::t"), "absent", "an unknown class matches nothing — never a guess");
  assert.equal(junitTestResult(xml, "t"), "fail", "unpinned, the ambiguity stays conservative: one red reddens");
});

test("obj 4: isJUnitReport recognizes a report, and leaves a test source alone", () => {
  assert.equal(isJUnitReport(`<testsuite><testcase name="x"/></testsuite>`), true);
  assert.equal(isJUnitReport(`describe("x", () => it("passes", () => {}))`), false, "a .ts test source is not a report");
});

// ── Integration: the gate resolves a test: pointer to a committed JUnit report ────────────────────
const REFERENCE = mkdtempSync(join(tmpdir(), "rw-junit-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });
function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-junit-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}
const GATED = ["architecture.md", "execution-topology.md", "floor.md", "governance/threat-model.md", "handover.md"];
function setRuleApplied(missionDir, rule, evidence) {
  for (const f of GATED) {
    const p = join(missionDir, f);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, "utf8");
    const re = new RegExp(`^\\|\\s*${rule}\\s*\\|[^\\n]*$`, "m");
    if (re.test(content)) { writeFileSync(p, content.replace(re, `| ${rule} | applied | ${evidence} |`)); return true; }
  }
  return false;
}
function writeJUnit(m, body) {
  const dir = join(m.dir, "code", "reports");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "junit.xml"), `<?xml version="1.0"?><testsuite>${body}</testsuite>\n`);
}
function junitViolation(v, rule) {
  return v.gated.flatMap((g) => g.violations).find((x) => x.rule === rule && /JUnit/i.test(x.problem));
}
// An unsigned gated rule the example answers n/a — flipping it isolates the JUnit adapter from the
// signature layer.
const RULE = "hexa-typescript-native";

test("obj 4: a committed JUnit case that passes resolves the pointer green", () => {
  const m = mission();
  writeJUnit(m, `<testcase name="portsAreTyped"/>`);
  assert.ok(setRuleApplied(m.mission, RULE, "test:code/reports/junit.xml::portsAreTyped"));
  assert.ok(!junitViolation(computeVerdict(m.mission, { strict: true }), RULE), "a green committed case is evidence");
  m.drop();
});

test("obj 4: a FAILED committed case is caught — where the old substring check passed", () => {
  const m = mission();
  writeJUnit(m, `<testcase name="portsAreTyped"><failure>a regression</failure></testcase>`);
  assert.ok(setRuleApplied(m.mission, RULE, "test:code/reports/junit.xml::portsAreTyped"));
  const viol = junitViolation(computeVerdict(m.mission, { strict: true }), RULE);
  assert.ok(viol, "the case name is in the XML, but it FAILED — a red test is not evidence");
  assert.match(viol.problem, /not green/i);
  m.drop();
});

test("obj 4: an absent case in the report reds the pointer", () => {
  const m = mission();
  writeJUnit(m, `<testcase name="somethingElse"/>`);
  assert.ok(setRuleApplied(m.mission, RULE, "test:code/reports/junit.xml::portsAreTyped"));
  assert.ok(junitViolation(computeVerdict(m.mission, { strict: true }), RULE), "a case not in the report is not evidence");
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
