// A rule can require the NATURE of its evidence (chantier 7, under ADR-0065/0066).
//
// Today `file:package.json` satisfies the same applied row a dependency-analysis report does —
// the exact gap the 2026-09-02 investigation named as A4, the gesture that moves the product from
// "the decision is traced" to "the practice held at sealing time". The `requires:` field is how a
// rule says a naked pointer is not enough, in the vocabulary the strict adapters already speak:
// junit | sarif | eslint | coverage | sbom | adr. REFUSED under --strict since ADR-0115, once the
// shipped example carried its own evidence (ADR-0073 blocked the arming until then), unless the row
// is deviated with its ADR or the mission declares the nature uncarriable (ADR-0075). Nature is
// CONTENT-detected, exactly as the adapters decide when to judge: a junit requirement is satisfied by
// a file that IS a JUnit report, never by a path that sounds like one.
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

/** Since ADR-0115 the shipped example satisfies every nature its rules require (requiresUnmet: []).
 *  A subject is made by hand: one floor row that requires junit, its evidence cut back to the source
 *  file it named before the example cited its reports. */
const SUBJECT = { deliverable: "floor.md", rule: "provider-no-crash-missing-env", requires: "junit" };
function withUnmetRow(dir) {
  const floor = join(dir, "runward", "floor.md");
  const row = new RegExp(`\\| ${SUBJECT.rule} \\| applied \\|[^\n]*\\|`);
  assert.match(readFileSync(floor, "utf8"), row, "the row is there to rewrite");
  writeFileSync(floor, readFileSync(floor, "utf8").replace(row,
    `| ${SUBJECT.rule} | applied | file:code/src/adapters/keyword-model.adapter.ts — deterministic fallback runs with no key |`));
  return floor;
}

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

test("ADR-0115: an applied row citing the wrong nature is refused under --strict, on its row, with the ways out", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-req-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    // ADR-0115: the example satisfies every requirement, so the subject is made: a row whose evidence
    // is a source file does not satisfy a junit requirement.
    assert.deepEqual(requiresLedger(join(dir, "runward")), [], "the shipped example requires nothing it does not cite");
    withUnmetRow(dir);
    const led = requiresLedger(join(dir, "runward"));
    assert.deepEqual(led, [SUBJECT], "the ledger names the row, and only it");
    const { out, code } = run(dir, "check", "--strict");
    assert.equal(code, 1, "refused under --strict (ADR-0115)");
    assert.match(out, /✗ Floor · provider-no-crash-missing-env — the rule requires junit evidence, and no pointer in this row resolves to a JUnit report/,
      "the refusal is on the row, and names the nature");
    assert.match(out, /mark the row deviated with the ADR that decides it, or, if this delivery cannot produce that kind at all, declare it in an accepted ADR \(`\*\*Nature not carried\*\*: junit — why`\) \(runward ADR-0115\)/,
      "with the three ways out");
    assert.doesNotMatch(out, /does not refuse this yet/, "the line that said it was not refused is gone");
    assert.equal(run(dir, "check").code, 0, "a strict reading: the deliverables gate does not judge it");
    const j = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.deepEqual(j.requiresUnmet, [SUBJECT], "the machine contract still carries the ledger");
    assert.deepEqual(j.conformance.filter((c) => c.kind === "requires-unmet").map((c) => [c.file, c.rule, c.phaseId]),
      [["runward/floor.md", SUBJECT.rule, "floor"]], "and one conformance gap of kind requires-unmet, on its row");
    assert.equal(j.gaps.conformance, 1);
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
    const floor = withUnmetRow(dir);
    const before = requiresLedger(join(dir, "runward"));
    const subject = before.find((u) => u.requires === "junit" && u.deliverable === "floor.md");
    assert.deepEqual(subject, SUBJECT, "the row made unmet is the subject");
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
  assert.match(out, /Refused under --strict, unless the row is deviated with its ADR or the mission declares in an accepted ADR that it cannot carry this kind \(runward ADR-0115\)/,
    "and its tier is said truthfully: refused under --strict, with the two decisions that lift it (RWD-2026-0118)");
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

// ── ADR-0115 decision 4: the ways out are decisions the tree carries ─────────────────────────────────

const DECLARATION = (status, nature = "junit") => `# ADR-0004: this delivery produces no ${nature} report\n\n**Status**: ${status}\n**Nature not carried**: ${nature} — a fixture of runward's own test suite, with no test runner to cite\n\n## Decision\n\nDeclared.\n\n## Reevaluation trigger\n\nA test runner is added.\n`;

test("ADR-0115: a nature declared uncarriable in an accepted ADR is not refused, and is said; a proposed declaration declares nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-req-declared-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    withUnmetRow(dir);
    const adr = join(dir, "runward", "adr", "ADR-0004-no-junit-report.md");
    writeFileSync(adr, DECLARATION("proposed"));
    assert.equal(run(dir, "check", "--strict").code, 1, "a proposed decision declares nothing (ADR-0075): still refused");
    writeFileSync(adr, DECLARATION("accepted"));
    const { out, code } = run(dir, "check", "--strict");
    assert.equal(code, 0, "an accepted declaration is a decision the tree carries: not refused");
    assert.match(out, /◑ 1 required kind\(s\) of evidence this delivery has DECLARED it cannot provide/);
    assert.match(out, /provider-no-crash-missing-env requires junit — declared in ADR-0004 \(floor\.md\)/);
    const j = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.deepEqual(j.requiresUnmet, [{ ...SUBJECT, declaredIn: "ADR-0004" }], "still unmet, still listed, with the decision");
    assert.equal(j.conformance.filter((c) => c.kind === "requires-unmet").length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0115: a deviated row with its ADR is not judged for its nature; a declared horizon folds the refusal", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-req-deviated-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    const floor = withUnmetRow(dir);
    assert.equal(run(dir, "check", "--strict", "--through", "architect").code, 0,
      "the floor is deferred by the declared horizon, so is its refusal (ADR-0053)");
    assert.equal(run(dir, "check", "--strict", "--through", "floor").code, 1, "and judged once the horizon reaches it");
    writeFileSync(floor, readFileSync(floor, "utf8").replace(
      `| ${SUBJECT.rule} | applied | file:code/src/adapters/keyword-model.adapter.ts — deterministic fallback runs with no key |`,
      `| ${SUBJECT.rule} | deviated | ADR-0002 — the fallback is the only adapter this floor ships |`));
    assert.equal(run(dir, "check", "--strict").code, 0, "a deviated row cites its decision, and its rule's nature is not demanded of it");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0115: verify re-derives the refusal, and an attestation that drops it does not verify", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-req-verify-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    withUnmetRow(dir);
    const att = run(dir, "check", "--strict", "--attest").out;
    writeFileSync(join(dir, "att.json"), att);
    const honest = JSON.parse(run(dir, "verify", "att.json", "--json").out);
    assert.equal(honest.verified, true, JSON.stringify(honest.predicate?.differing));
    assert.equal(JSON.parse(att).predicate.verdict, "gaps");
    const forged = JSON.parse(att);
    forged.predicate.conformance = forged.predicate.conformance.filter((c) => c.kind !== "requires-unmet");
    forged.predicate.gaps.conformance -= 1;
    forged.predicate.verdict = "clean"; forged.predicate.exitCode = 0;
    writeFileSync(join(dir, "forged.json"), JSON.stringify(forged, null, 2));
    const v = JSON.parse(run(dir, "verify", "forged.json", "--json").out);
    assert.equal(v.verified, false, "a verdict that drops the refusal is not this tree's");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0115: runward's own mission requires nothing it does not carry, but the load test its journal declares uncarriable", () => {
  const led = requiresLedger(join(ROOT, "runward"));
  assert.deepEqual(led.map((u) => [u.requires, u.declaredIn ?? null]), [["loadtest", "ADR-0075"]],
    "the second consequence of ADR-0073: the journal says which nature this delivery cannot carry, and why");
});
