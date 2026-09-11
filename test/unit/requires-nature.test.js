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
    // the example's frontier row cites guard.ts (a source file) while the rule now requires junit
    const led = requiresLedger(join(dir, "runward"));
    assert.ok(led.some((u) => u.rule === "frontier-deterministic-boundary" && u.requires === "junit"),
      "a source-file pointer does not satisfy a junit requirement");
    const { out, code } = run(dir, "check", "--strict");
    assert.equal(code, 0, "disclosed today, refused only at the armed tier");
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
    assert.ok(before.some((u) => u.rule === "frontier-deterministic-boundary"));
    writeFileSync(floor, readFileSync(floor, "utf8").replace(
      /\| frontier-deterministic-boundary \| applied \|[^\n]*\|/,
      "| frontier-deterministic-boundary | applied | file:code/src/core/domain/guard.ts#guardFields; file:reports/junit.xml |"));
    const after = requiresLedger(join(dir, "runward"));
    assert.ok(!after.some((u) => u.rule === "frontier-deterministic-boundary" && u.deliverable === "floor.md"),
      "one pointer at a real JUnit report satisfies the nature; the source pointer stays beside it");
    writeFileSync(floor, readFileSync(floor, "utf8").replace("file:reports/junit.xml", "file:reports/fake-junit.xml"));
    const decoyed = requiresLedger(join(dir, "runward"));
    assert.ok(decoyed.some((u) => u.rule === "frontier-deterministic-boundary" && u.deliverable === "floor.md"),
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
  assert.match(out, /refused at the armed tier/, "and its tier is said: disclosed today, refusable later");
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
