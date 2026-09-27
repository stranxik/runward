// What the CLI PRINTS around a red verdict must not read as green.
//
// Found 2026-09-27 by an adversarial audit of what the CLI prints (RWD-2026-0129 to 0128). None of
// these moved an exit code of `check`: each was a sentence, a label or a field that, read alone,
// told a human or an agent the gate had passed while the same run said no. Every case below runs
// the built CLI on a throwaway copy of `init --example` with ONE defect planted, and asserts on the
// words a reader acts on.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rerunCommand, currentGateLabel } from "../../dist/lib/check-contract.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const GOOD = "| hexa-adapter-pattern | applied | file:code/src/adapters/keyword-model.adapter.ts#";
const DEAD = "| hexa-adapter-pattern | applied | file:code/src/adapters/missing.ts#";

let base;
before(() => {
  base = mkdtempSync(join(tmpdir(), "rw-falsegreen-base-"));
  execFileSync("git", ["init", "-q", "."], { cwd: base });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: base, env: ENV, stdio: "ignore" });
});
after(() => rmSync(base, { recursive: true, force: true }));

/** A fresh copy of the example; `plant` edits runward/architecture.md. */
function mission(plant) {
  const dir = mkdtempSync(join(tmpdir(), "rw-falsegreen-"));
  cpSync(base, dir, { recursive: true });
  if (plant) {
    const p = join(dir, "runward", "architecture.md");
    const text = readFileSync(p, "utf8");
    const next = plant(text);
    assert.notEqual(next, text, "the plant must change the manifest, or the test proves nothing");
    writeFileSync(p, next);
  }
  return dir;
}
const run = (dir, ...args) => spawnSync("node", [CLI, ...args], { cwd: dir, env: ENV, encoding: "utf8" });
const deadPointer = (t) => t.replace(GOOD, DEAD);

test("RWD-2026-0129: a red run's Next line names the gate that said no, and that command stays red", () => {
  // Pure half: the flags that shaped the verdict are echoed, the output-only ones are not.
  assert.equal(rerunCommand({}), "runward check");
  assert.equal(rerunCommand({ strict: true, json: true, coverage: true }), "runward check --strict");
  assert.equal(rerunCommand({ freeze: true }), "runward check --strict");
  assert.equal(rerunCommand({ hooks: true, through: "floor", strict: true }), "runward check --strict --through floor --hooks");

  const dir = mission(deadPointer);
  try {
    const strict = run(dir, "check", "--strict");
    assert.equal(strict.status, 1, "the planted dead pointer must make --strict red");
    const next = strict.stdout.slice(strict.stdout.lastIndexOf("Next"));
    assert.match(next, /re-run runward check --strict\./, "the gesture must re-run the strict gate");
    // Follow the advice to the letter: it must reproduce the red, not a green.
    assert.equal(run(dir, "check", "--strict").status, 1);

    writeFileSync(join(dir, "runward", "architecture.md"), readFileSync(join(base, "runward", "architecture.md"), "utf8"));
    writeFileSync(join(dir, "runward", "hooks.json"), JSON.stringify({ after: ["exit 3"] }));
    const hooks = run(dir, "check", "--hooks");
    assert.equal(hooks.status, 1, "a failing after-hook makes the run red");
    assert.match(hooks.stdout.slice(hooks.stdout.lastIndexOf("Next")), /re-run runward check --hooks\./,
      "after a failed hook the gesture must re-run the hooks");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0130: status never calls the arc complete while check --strict refuses it, and check no longer sends there", () => {
  const dir = mission(deadPointer);
  try {
    const check = run(dir, "check", "--strict");
    assert.doesNotMatch(check.stdout, /runward status names exactly what is open/,
      "status cannot see a strict gap, so check must not send the reader there for it");
    const status = run(dir, "status");
    assert.equal(status.status, 0);
    assert.doesNotMatch(status.stdout, /delivery arc complete/);
    assert.match(status.stdout, /check --strict refuses the crossing/);
    assert.match(status.stdout, /The delivery arc is not complete: 1 rule-conformance gap\(s\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }

  // The clean example keeps its steady-state wording.
  const clean = run(base, "status");
  assert.match(clean.stdout, /delivery arc complete/);
  assert.match(clean.stdout, /Strict gate\s+clean/);
});

test("RWD-2026-0131: Current gate never reads 'all gates passed' under a red verdict (terminal, JSON, report)", () => {
  assert.equal(currentGateLabel({ currentPhase: "all gates passed", steadyState: true }, true), "all gates passed");
  assert.equal(currentGateLabel({ currentPhase: "all gates passed", steadyState: true }, false), "all deliverables filled (verdict: gaps)");
  assert.equal(currentGateLabel({ currentPhase: "3 · Floor", steadyState: false }, false), "3 · Floor");

  const dir = mission(deadPointer);
  try {
    const human = run(dir, "check", "--strict");
    assert.doesNotMatch(human.stdout, /all gates passed/);
    assert.match(human.stdout, /Current gate\s+all deliverables filled \(verdict: gaps\)/);
    const json = JSON.parse(run(dir, "check", "--strict", "--json").stdout);
    assert.equal(json.verdict, "gaps");
    assert.notEqual(json.currentGate, "all gates passed");
    assert.equal(run(dir, "report").status, 0);
    const html = readFileSync(join(dir, "runward", "governance", "delivery-report.html"), "utf8");
    assert.doesNotMatch(html, /Current gate: <strong>all gates passed/);
  } finally { rmSync(dir, { recursive: true, force: true }); }

  const green = JSON.parse(run(base, "check", "--strict", "--json").stdout);
  assert.equal(green.currentGate, "all gates passed", "the green keeps its bytes");
});

test("RWD-2026-0132: verify of an honest RED attestation says RED on its result line and at the top of its JSON", () => {
  const dir = mission(deadPointer);
  try {
    const att = run(dir, "check", "--strict", "--attest");
    assert.equal(att.status, 1);
    const path = join(dir, "att.json");
    writeFileSync(path, att.stdout);
    const human = run(dir, "verify", path);
    assert.equal(human.status, 0, "an authentic attestation still verifies: exit 0 is about authenticity");
    const result = human.stdout.slice(human.stdout.lastIndexOf("Result")).split("\n").filter((l) => l.trim())[2];
    assert.match(result, /honestly records a RED gate \(verdict: gaps\)\. The delivery did not cross\./);
    const json = JSON.parse(run(dir, "verify", "--json", path).stdout);
    assert.equal(json.verified, true);
    assert.equal(json.attestedVerdict, "gaps");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0133: a proposed row's dead pointer is named in its refusal, without a second gap", () => {
  const dir = mission((t) => t.replace(GOOD, "| hexa-adapter-pattern | proposed:applied | file:code/src/adapters/missing.ts#"));
  try {
    const out = run(dir, "check", "--strict");
    const line = out.stdout.split("\n").find((l) => l.includes("hexa-adapter-pattern"));
    assert.match(line, /awaits ratification/);
    assert.match(line, /typed pointer does not resolve: file:code\/src\/adapters\/missing\.ts/,
      "the agent that wrote the pointer must read that it is dead before anyone is asked to ratify");
    const json = JSON.parse(run(dir, "check", "--strict", "--json").stdout);
    assert.equal(json.gaps.proposed, 1);
    assert.equal(json.gaps.conformance, 1, "one row, one violation: the total does not move");
  } finally { rmSync(dir, { recursive: true, force: true }); }

  // A proposal whose pointer resolves keeps its refusal unchanged.
  const ok = mission((t) => t.replace(GOOD, GOOD.replace("| applied |", "| proposed:applied |")));
  try {
    const line = run(ok, "check", "--strict").stdout.split("\n").find((l) => l.includes("hexa-adapter-pattern"));
    assert.match(line, /awaits ratification/);
    assert.doesNotMatch(line, /does not hold/);
  } finally { rmSync(ok, { recursive: true, force: true }); }
});
