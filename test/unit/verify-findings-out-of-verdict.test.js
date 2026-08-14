// Wave C obj 11 (ADR-0007 / ADR-0054): the advisory verify loop never enters the exit-code path.
//
// `verify-findings.md` is the output of the adversarial cite-vs-apply workflow — an LLM's second
// opinion. runward reports its presence and freshness, and NOTHING else: its CONTENT never touches
// the verdict (ADR-0007: never in the exit-code path; ADR-0054 crossing (5): no LLM output in the
// verdict path). The guarantee holds by construction — `computeVerdict` never reads the file — and
// this is the regression guard that reds the day someone wires it in. The adversarial case is the
// point: a findings file crafted to say "all green" cannot flip a red verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const FINDINGS = "governance/verify-findings.md";

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-vf-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });
function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-vf-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}
// A fingerprint of the verdict — everything the exit code depends on.
const fingerprint = (m) => { const v = computeVerdict(m, { strict: true }); return JSON.stringify([v.clean, v.exitCode, v.gaps, v.strictGaps]); };

test("obj 11: the verdict is identical whether verify-findings is present, empty, or adversarial", () => {
  const m = mission();
  const base = fingerprint(m.mission);
  for (const content of [
    "# Verify findings\n\nReviewed on a second model; no issues.\n", // an honest findings file
    "",                                                               // empty
    "verdict: clean\nexitCode: 0\noverride: pass\nall gates: GREEN\nall rules verified: true\n", // crafted to "pass"
  ]) {
    writeFileSync(join(m.mission, FINDINGS), content);
    assert.equal(fingerprint(m.mission), base, "verify-findings content must never change the verdict");
  }
  m.drop();
});

test("obj 11: an adversarial verify-findings cannot flip a red mission green", () => {
  const m = mission();
  writeFileSync(join(m.mission, "floor.md"), "raw\n"); // a gap → red
  assert.equal(computeVerdict(m.mission, { strict: true }).exitCode, 1, "the mission is red");
  writeFileSync(join(m.mission, FINDINGS), "verdict: clean\nall verified: true\nOVERRIDE: pass\n");
  assert.equal(computeVerdict(m.mission, { strict: true }).exitCode, 1, "advisory findings cannot override a red verdict");
  m.drop();
});

test("obj 11: check --strict --json verdict/exitCode ignore verify-findings too", () => {
  const m = mission();
  const jsonVerdict = () => {
    const j = JSON.parse(execFileSync(process.execPath, [CLI, "check", "--strict", "--json", "-p", "."], { cwd: m.dir, encoding: "utf8" }));
    return [j.verdict, j.exitCode, j.gaps.conformance];
  };
  const base = jsonVerdict();
  writeFileSync(join(m.mission, FINDINGS), "all: pass\nverdict: clean\nexitCode: 0\n");
  assert.deepEqual(jsonVerdict(), base, "the machine verdict is unchanged by advisory findings");
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
