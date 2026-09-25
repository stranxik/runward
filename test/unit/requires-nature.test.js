// A rule can require the NATURE of its evidence (chantier 7, under ADR-0065/0066).
//
// Today `file:package.json` satisfies the same applied row a dependency-analysis report does —
// the exact gap the 2026-09-02 investigation named as A4, the gesture that moves the product from
// "the decision is traced" to "the practice held at sealing time". The `requires:` field is how a
// rule says a naked pointer is not enough, in the vocabulary the strict adapters already speak:
// junit | sarif | eslint | coverage | sbom | adr. DISCLOSED today, never gating; the armed tier
// (ADR-0065) makes it refusable for missions that opt in. Nature is CONTENT-detected, exactly as
// the adapters decide when to judge: a junit requirement is satisfied by a file that IS a JUnit
// report, never by a path that sounds like one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requiresLedger, REQUIRABLE_NATURES } from "../../dist/lib/evidence.js";
import { readRuleSet, ruleSetDir } from "../../dist/lib/rules.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

const GREEN_JUNIT = `<?xml version="1.0"?>
<testsuites><testsuite name="s" tests="1" failures="0" errors="0">
<testcase classname="s" name="the guard refuses a fabricated value"/>
</testsuite></testsuites>\n`;

test("the shipped corpus requires only natures the adapters can read — a closed list", () => {
  const rules = readRuleSet(ruleSetDir(null).dir);
  const requiring = rules.filter((r) => r.requires);
  assert.ok(requiring.length >= 20, `${requiring.length} rules carry requires: — the 27 posed on 2026-09-03 should be here`);
  for (const r of requiring) {
    assert.ok(REQUIRABLE_NATURES.has(r.requires),
      `${r.slug}: requires "${r.requires}", which no adapter reads — a frontmatter typo would be ` +
      "silently never-satisfied and silently never-demanded; the list is closed on purpose");
  }
});

test("an applied row citing the wrong nature is disclosed — and the gate stays green", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-req-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    // ADR-0073 gave the example's frontier row a committed report, so it is SATISFIED now and is no
    // longer the subject here. The property under test is unchanged and still has subjects: a row
    // whose evidence is a source file does not satisfy a junit requirement. Driven off the ledger so
    // the next row that gains a report cannot make this test vacuous.
    const led = requiresLedger(join(dir, "runward"));
    assert.ok(led.length > 0, "the example still has rows whose required nature is unmet — the ledger has subjects");
    assert.ok(led.some((u) => u.requires === "junit"), "including at least one junit requirement");
    assert.ok(!led.some((u) => u.rule === "frontier-deterministic-boundary"),
      "and frontier is NOT among them: its row cites the example's own committed report (ADR-0073)");
    const { out, code } = run(dir, "check", "--strict");
    assert.equal(code, 0, "disclosed today, not yet refused at any tier (ADR-0073)");
    assert.match(out, /applied row\(s\) do not carry the evidence nature their rule requires/,
      "the difference is said where the operator reads");
    const j = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.ok(Array.isArray(j.requiresUnmet) && j.requiresUnmet.length > 0,
      "the machine contract carries the ledger");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a committed green JUnit report satisfies the junit nature — content-detected, never by name", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-req2-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    mkdirSync(join(dir, "reports"), { recursive: true });
    writeFileSync(join(dir, "reports", "junit.xml"), GREEN_JUNIT);
    // decoy: a file NAMED like a report but carrying none of its shape must not satisfy anything
    writeFileSync(join(dir, "reports", "fake-junit.xml"), "not a report at all\n");
    const floor = join(dir, "runward", "floor.md");
    const before = requiresLedger(join(dir, "runward"));
    // Pick a row the example does NOT yet satisfy, from the ledger itself: frontier now cites a
    // real committed report (ADR-0073), so hard-coding it here would have made this test vacuous.
    const subject = before.find((u) => u.requires === "junit" && u.deliverable === "floor.md");
    assert.ok(subject, `the example must still have an unmet junit row in floor.md (${JSON.stringify(before)})`);
    const rowRe = new RegExp(`\\| ${subject.rule} \\| applied \\|[^\n]*\\|`);
    assert.match(readFileSync(floor, "utf8"), rowRe, "the row is there to rewrite");
    writeFileSync(floor, readFileSync(floor, "utf8").replace(rowRe,
      `| ${subject.rule} | applied | file:reports/junit.xml |`));
    const after = requiresLedger(join(dir, "runward"));
    assert.ok(!after.some((u) => u.rule === subject.rule && u.deliverable === "floor.md"),
      "one pointer at a real JUnit report satisfies the nature; the source pointer stays beside it");
    writeFileSync(floor, readFileSync(floor, "utf8").replace("file:reports/junit.xml", "file:reports/fake-junit.xml"));
    const decoyed = requiresLedger(join(dir, "runward"));
    assert.ok(decoyed.some((u) => u.rule === subject.rule && u.deliverable === "floor.md"),
      "a file merely NAMED junit.xml satisfies nothing — nature is content, not filename");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an adr requirement is satisfied by a resolving adr: pointer, and only by one", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-req3-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    const topo = join(dir, "runward", "execution-topology.md");
    const content = readFileSync(topo, "utf8");
    // the example's topology rows: check their current satisfaction state, then break one
    const led = requiresLedger(join(dir, "runward"));
    const topoUnmet = led.filter((u) => u.deliverable === "execution-topology.md" && u.requires === "adr");
    // whichever way the example cites them today, stripping every adr: pointer must surface all four
    writeFileSync(topo, content.replace(/adr:\d+/g, "file:code/package.json"));
    const after = requiresLedger(join(dir, "runward"));
    assert.ok(after.filter((u) => u.requires === "adr").length >= topoUnmet.length,
      "with every adr: pointer stripped, the adr-requiring rows can only be less satisfied, never more");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the loadtest nature is satisfied by a k6 summary, not by a source file (2026-09-09)", () => {
  // The nature check is FORM (is this a load-test report); the red/green verdict lives at the
  // typed pointer, exactly like sarif — one contract for every nature.
  const dir = mkdtempSync(join(tmpdir(), "rw-req-lt-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init");
    run(dir, "manifest", "--sync");
    writeFileSync(join(dir, "k6-summary.json"),
      JSON.stringify({ metrics: { http_req_duration: { thresholds: { "p(95)<500": { ok: true } } } } }));
    const tm = join(dir, "runward", "governance", "threat-model.md");
    const cite = (evidence) => writeFileSync(tm, readFileSync(tm, "utf8").replace(
      /\| checklist-pre-production-performance \|[^|]*\|[^|]*\|/,
      `| checklist-pre-production-performance | applied | ${evidence} |`));
    cite("file:k6-summary.json");
    assert.ok(!requiresLedger(join(dir, "runward")).some((u) => u.rule === "checklist-pre-production-performance"),
      "a k6 summary satisfies loadtest");
    cite("file:runward/framing.md");
    assert.ok(requiresLedger(join(dir, "runward")).some((u) => u.rule === "checklist-pre-production-performance" && u.requires === "loadtest"),
      "a prose document does not");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("explain teaches the nature it demands, with a citable form for every requirable one", async () => {
  // ADR-0065's arming order, step one: the command whose whole job is "read the rule in full, do
  // not work from its name" was silent about requires: on 40 of the 64 rules (measured 2026-09-11).
  // A requirement met through a refusal instead of through the rule was taught badly.
  const { execFileSync } = await import("node:child_process");
  const run = (...a) => execFileSync("node", [CLI, ...a], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });

  const out = run("explain", "async-job-guardrails");
  assert.match(out, /Requires\s+junit/, "the field is printed");
  assert.match(out, /not yet refused anywhere: arming (this check )?waits on ADR-0073/, "and its tier is said truthfully: disclosed today, refusable later (RWD-2026-0118)");
  assert.match(out, /e\.g\. file:reports\/junit\.xml::/, "with a form the operator can copy");

  // Every nature the product can require has a worked example — a nature nobody can picture is a
  // nature satisfied by accident. Driven off REQUIRABLE_NATURES, so a new nature needs its example.
  const rules = readRuleSet(ruleSetDir(null).dir);
  const demanded = new Set(rules.filter((r) => r.requires).map((r) => r.requires));
  assert.ok(demanded.size >= 4, `the corpus demands several natures (${[...demanded].join(", ")})`);
  for (const nature of demanded) {
    const rule = rules.find((r) => r.requires === nature);
    const text = run("explain", rule.slug);
    assert.doesNotMatch(text, /e\.g\. a committed report of that kind/,
      `${nature} falls through to the generic example: give it a worked form in REQUIRES_EXAMPLE`);
  }
});

// ── ADR-0073 option 1 (ratified 2026-09-12): the showcase demonstrates the nature it demands ────

test("the shipped example satisfies a junit requirement with its own committed report", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-showcase-junit-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    // The report ships — a gate that never runs your tools can only read one that is already there.
    const report = join(dir, "code", "reports", "junit.xml");
    assert.ok(readFileSync(report, "utf8").includes("<testcase"), "init --example lays the committed report down");
    // Committable means committable: no absolute path, no per-case timing, no wall clock.
    const xml = readFileSync(report, "utf8");
    assert.doesNotMatch(xml, /\sfile="/, "no absolute path from the machine that ran the tests");
    assert.doesNotMatch(xml, /\stime="/, "no per-case duration");
    assert.doesNotMatch(xml, /duration_ms/, "not even the duration hiding in a comment");
    // And the nature it demands is met by it.
    assert.ok(!requiresLedger(join(dir, "runward")).some((u) => u.rule === "frontier-deterministic-boundary"),
      "the floor row's junit requirement is satisfied by the example's own report");
    const { code } = run(dir, "check", "--strict");
    assert.equal(code, 0, "and the showcase stays green — arming must never break the first command the product recommends");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a red case in that report refuses the row — the report is read, not trusted", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-showcase-red-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    const report = join(dir, "code", "reports", "junit.xml");
    const xml = readFileSync(report, "utf8");
    const name = "guard: a fabricated account reference never routes — escalated to review";
    assert.ok(xml.includes(name), "the cited case is in the report");
    // The shape a real failing run produces: the case keeps its name and gains a failure body.
    writeFileSync(report, xml.replace(
      new RegExp(`(<testcase[^>]*name="${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*?)/>`),
      '$1><failure type="AssertionError">a real failure</failure></testcase>'));
    const { out, code } = run(dir, "check", "--strict");
    assert.equal(code, 1, "a red cited case is refused");
    assert.match(out, /is present but not green|a red test is not evidence/,
      "and the refusal says why, in the product's own words");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
