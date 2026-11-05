// ADR-0118: the analyzers in the gate — the opt-in, the refusal under --strict, and every surface that
// carries the verdict (terminal, --json, SARIF, the witness, the delivery report).
//
// The contract, measured end to end on the command a CI runs: a new mission and the example are born
// with the policy pinned; a planted capability turns `check --strict` red and is named, with its file
// and line, on every surface; the counts add up the way the payload says they do; a mission without
// the pin is judged exactly as before, and `update` never adds nor drops the pin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-11-05", COLUMNS: "400" };
const run = (cwd, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd, encoding: "utf8", env: ENV });

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-analyze-gate-"));
assert.equal(run(REFERENCE, "init", "--yes", "--example").status, 0, "the example is green out of the box, analyzers on");

const PLANT = [
  'import { execSync } from "node:child_process";',
  "export async function autopilot(request: string): Promise<string> {",
  '  const res = await fetch("https://api.example-llm.invalid/v1/complete", { method: "POST", body: request });',
  "  const { text } = (await res.json()) as { text: string };",
  "  eval(text);",
  "  return execSync(text).toString();",
  "}",
  "",
].join("\n");
const PLANTED = "code/src/core/application/autopilot.ts";

function copy(edit) {
  const dir = mkdtempSync(join(tmpdir(), "rw-analyze-gate-case-"));
  cpSync(REFERENCE, dir, { recursive: true });
  edit?.(dir);
  return dir;
}
const lockOf = (dir) => JSON.parse(readFileSync(join(dir, "runward", "scaffold-lock.json"), "utf8"));
const json = (r) => JSON.parse(r.stdout);

test("a new mission and the example are born with the analysis policy pinned; an existing mission keeps what its lock says", () => {
  assert.equal(lockOf(REFERENCE).analysis, "runward-analysis/1");
  const blank = mkdtempSync(join(tmpdir(), "rw-analyze-new-"));
  try {
    run(blank, "init", "--yes");
    assert.equal(lockOf(blank).analysis, "runward-analysis/1", "ADR-0118: on by default for a new mission, like the structure contract (ADR-0069)");
  } finally { rmSync(blank, { recursive: true, force: true }); }
  const dir = copy((d) => {
    const lock = lockOf(d);
    delete lock.analysis;
    writeFileSync(join(d, "runward", "scaffold-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  });
  try {
    assert.equal(run(dir, "update").status, 0);
    assert.equal(lockOf(dir).analysis, undefined, "update never writes the pin on its own");
    const lock = lockOf(dir);
    lock.analysis = "runward-analysis/1";
    writeFileSync(join(dir, "runward", "scaffold-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
    assert.equal(run(dir, "update").status, 0);
    assert.equal(lockOf(dir).analysis, "runward-analysis/1", "and never drops it (the RWD-2026-0106 lesson)");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the green example: the payload carries the reading, and adds nothing to a payload whose mission has no pin", () => {
  const j = json(run(REFERENCE, "check", "--strict", "--json"));
  assert.equal(j.exitCode, 0);
  assert.equal(j.gaps.analysis, 0);
  assert.equal(j.analysis.policy, "runward-analysis/1");
  assert.deepEqual(j.analysis.findings, []);
  assert.equal(j.analysis.files.core, 7);
  assert.match(j.analysis.nonScope, /not a judgment that the code is good/);
  assert.match(j.gateNonScope, /never that the code is good/, "the gate-wide non-scope says it too");
  const lenient = json(run(REFERENCE, "check", "--json"));
  assert.ok(!("analysis" in lenient), "a presence check reads no code: the reading is strict only");
  const dir = copy((d) => {
    const lock = lockOf(d);
    delete lock.analysis;
    writeFileSync(join(d, "runward", "scaffold-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  });
  try {
    const off = json(run(dir, "check", "--strict", "--json"));
    assert.ok(!("analysis" in off) && !("analysis" in off.gaps), "no pin: the payload keeps the keys it had");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a planted capability: refused under --strict, and named with its file and line on every surface", () => {
  const dir = copy((d) => writeFileSync(join(d, PLANTED), PLANT));
  try {
    assert.equal(run(dir, "check").status, 0, "the presence gate does not read code");
    const text = run(dir, "check", "--strict");
    assert.equal(text.status, 1);
    assert.match(text.stdout, /Delivered code \(--strict, built-in analyzers\)/);
    assert.match(text.stdout, new RegExp(`✗ ${PLANTED}:5 — calls eval`));
    assert.match(text.stdout, /3 delivered-code finding\(s\) \(built-in analyzers\)/, "the summary names what failed");
    assert.match(text.stdout, /Why red[\s\S]*autopilot\.ts:1 — imports `node:child_process`/);
    assert.match(text.stdout, /Change the code the analyzers named above, or allow it in runward\/analysis\.md/);

    const j = json(run(dir, "check", "--strict", "--json"));
    assert.equal(j.gaps.analysis, 3);
    assert.equal(j.conformance.length, j.gaps.conformance, "the array holds exactly what gaps.conformance counts");
    const rows = j.conformance.filter((r) => r.scope === "analysis");
    assert.deepEqual(rows.map((r) => [r.kind, r.rule, r.file, r.line]), [
      ["analysis-capability", "process-execution", PLANTED, 1],
      ["analysis-capability", "network", PLANTED, 3],
      ["analysis-capability", "code-execution", PLANTED, 5],
    ]);
    assert.equal(j.gaps.causesByKind["analysis-capability"].count, 3);
    assert.equal(j.next.action, "fix-analysis-findings");

    const sarif = json(run(dir, "check", "--strict", "--sarif"));
    const results = sarif.runs[0].results.filter((r) => r.ruleId.startsWith("runward/analysis-"));
    assert.deepEqual(results.map((r) => [r.ruleId, r.locations[0].physicalLocation.artifactLocation.uri, r.locations[0].physicalLocation.region.startLine]), [
      ["runward/analysis-process-execution", PLANTED, 1], ["runward/analysis-network", PLANTED, 3], ["runward/analysis-code-execution", PLANTED, 5],
    ]);
    const rule = sarif.runs[0].tool.driver.rules.find((r) => r.id === "runward/analysis-code-execution");
    assert.match(rule.fullDescription.text, /not a judgment that the code is good/);

    const out = join(dir, "witness.json");
    assert.equal(run(dir, "check", "--strict", "--witness", out).status, 1);
    const w = JSON.parse(readFileSync(out, "utf8"));
    const v = w.verdict;
    assert.equal(v.strictBreakdown.analysis, 3);
    assert.equal(w.causes.filter((c) => c.family === "analysis").length, 3);
    assert.equal(w.causes.length, v.gaps + v.strictGaps + v.hookFailed, "one cause per counted gap");
    assert.equal(v.strictGaps, Object.values(v.strictBreakdown).reduce((x, y) => x + y, 0), "the breakdown sums to the strict count");
    assert.ok(w.notWitnessed.some((x) => x.family === "analysis" && x.causes === 3), "and the family is named as not witnessed");

    assert.equal(run(dir, "report").status, 0);
    const html = readFileSync(join(dir, "runward", "governance", "delivery-report.html"), "utf8");
    assert.match(html, /Delivered code, read under the analysis policy <code>runward-analysis\/1<\/code>/);
    assert.match(html, /<strong>3 finding\(s\)<\/strong>/);
    assert.match(html, /<td>analysis<\/td><td><code>code-execution<\/code><\/td>/, "each finding is a row of the conformance table");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the opt-in, measured on the same planted tree: without the pin the strict gate is green, as it was before", () => {
  const dir = copy((d) => {
    writeFileSync(join(d, PLANTED), PLANT);
    const lock = lockOf(d);
    delete lock.analysis;
    writeFileSync(join(d, "runward", "scaffold-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  });
  try {
    const r = run(dir, "check", "--strict");
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stdout, /Delivered code/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test.after(() => rmSync(REFERENCE, { recursive: true, force: true }));
