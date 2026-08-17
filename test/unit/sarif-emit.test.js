// The gate's verdict as SARIF (ADR-0056 widening, emission half — Vague 2).
//
// runward already READS a committed SARIF scan as evidence; this is the other direction. A gap stops
// being a line in a CI log nobody opens and becomes an annotation on the manifest ROW that carries
// it, in the pull request, where the person who wrote the row is looking. Emission only: runward
// writes the file, the operator's CI uploads it (ADR-0054 — no API call, no token).
//
// The load-bearing case is the round trip: runward's own SARIF adapter reads the log runward emits.
// If the two ever disagree about what a SARIF document is, one of them is wrong, and this test says
// which — a self-consistency the emitter could not otherwise claim.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildSarif, ruleRowLine, SARIF_VERSION } from "../../dist/lib/sarif.js";
import { computeVerdict } from "../../dist/lib/verdict.js";
import { isSarifReport, sarifRuleResult } from "../../dist/lib/tool-adapters.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-sarif-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });
function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-sarif-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}
function breakRule(missionDir, rule, evidence) {
  const p = join(missionDir, "architecture.md");
  const content = readFileSync(p, "utf8");
  const re = new RegExp(`^\\|\\s*${rule}\\s*\\|[^\\n]*$`, "m");
  assert.ok(re.test(content), `${rule} has a row in architecture.md`);
  writeFileSync(p, content.replace(re, `| ${rule} | applied | ${evidence} |`));
}
const emit = (cwd, args = ["check", "--strict", "--sarif", "-p", "."]) => {
  try { return JSON.parse(execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" })); }
  catch (e) { return JSON.parse(e.stdout); }  // a red gate exits 1 and still emits the log
};

test("sarif: a green mission emits a valid, EMPTY log — not an absent one", () => {
  const m = mission();
  const log = emit(m.dir);
  assert.equal(log.version, SARIF_VERSION);
  assert.equal(log.runs[0].tool.driver.name, "runward");
  assert.deepEqual(log.runs[0].results, [], "no findings, and the document still exists — a forge clears stale annotations from an empty run");
  m.drop();
});

test("sarif: a violation is annotated on the manifest ROW that carries it, not the top of the file", () => {
  const m = mission();
  breakRule(m.mission, "hexa-architecture", "file:code/src/nope.ts#absent");
  const log = emit(m.dir);
  const r = log.runs[0].results.find((x) => x.ruleId === "runward/hexa-architecture");
  assert.ok(r, "the violation is emitted under its craft-rule id");
  const loc = r.locations[0].physicalLocation;
  assert.equal(loc.artifactLocation.uri, "runward/architecture.md", "a repository-RELATIVE uri: an absolute one leaks the runner path and no forge resolves it");
  const expected = readFileSync(join(m.mission, "architecture.md"), "utf8").split("\n").findIndex((l) => l.trim().startsWith("| hexa-architecture ")) + 1;
  assert.equal(loc.region.startLine, expected, "the annotation lands on the row, so the operator reads it where the answer is written");
  assert.equal(r.level, "error");
  m.drop();
});

test("sarif: the non-scope travels with the findings — dropping it has to be deliberate", () => {
  const m = mission();
  breakRule(m.mission, "hexa-architecture", "file:code/src/nope.ts#absent");
  const log = emit(m.dir);
  const rule = log.runs[0].tool.driver.rules.find((x) => x.id === "runward/hexa-architecture");
  assert.match(rule.fullDescription.text, /never judges code quality/i);
  assert.match(rule.fullDescription.text, /gap in the delivery record, not a defect in the code/i);
  m.drop();
});

test("sarif: deterministic — same tree, byte-identical log", () => {
  const m = mission();
  breakRule(m.mission, "hexa-architecture", "file:code/src/nope.ts#absent");
  const run = () => { try { return execFileSync(process.execPath, [CLI, "check", "--strict", "--sarif", "-p", "."], { cwd: m.dir, encoding: "utf8" }); } catch (e) { return e.stdout; } };
  assert.equal(run(), run(), "no timestamp, no host, no absolute path enters the document");
  m.drop();
});

test("sarif: THE ROUND TRIP — runward's own adapter reads the log runward emits", () => {
  // The emitter and the reader are two halves of ADR-0056 written days apart. If they disagree about
  // what a SARIF document is, the widening is incoherent — and nothing else would have caught it.
  const m = mission();
  breakRule(m.mission, "hexa-architecture", "file:code/src/nope.ts#absent");
  const text = JSON.stringify(emit(m.dir));
  assert.equal(isSarifReport(text), true, "the reader recognizes the emitter's document as SARIF");
  assert.equal(sarifRuleResult(text, "runward/hexa-architecture"), "findings", "and reads the open finding it carries");
  assert.equal(sarifRuleResult(text, "runward/never-emitted"), "absent", "a rule the log never mentions stays absent");
  m.drop();
});

test("sarif: without --strict the log carries the deliverable gaps, and says which file", () => {
  const m = mission();
  writeFileSync(join(m.mission, "floor.md"), "raw template\n");
  const log = emit(m.dir, ["check", "--sarif", "-p", "."]);
  const r = log.runs[0].results.find((x) => x.ruleId === "runward/deliverable-not-filled");
  assert.ok(r, "an unfilled deliverable is a finding even without --strict");
  assert.match(r.locations[0].physicalLocation.artifactLocation.uri, /floor\.md$/);
  m.drop();
});

test("sarif: ruleRowLine finds the row by its FIRST column, never by prose above the table", () => {
  const md = ["# Doc", "", "Prose mentioning hexa-architecture in a sentence.", "", "| Rule | Status | Evidence |", "|---|---|---|", "| other-rule | n/a | x |", "| hexa-architecture | applied | y |"].join("\n");
  assert.equal(ruleRowLine(md, "hexa-architecture"), 8, "the row, not the sentence");
  assert.equal(ruleRowLine(md, "not-in-the-table"), 1, "an unlocatable rule falls back to the file, never to a wrong line");
});
