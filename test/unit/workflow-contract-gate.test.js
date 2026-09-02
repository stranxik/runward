// The gate reads the workflow contracts (ADR-0067, W3).
//
// What is pinned: the reading is ALWAYS surfaced and only COUNTS under the mission's hardening
// opt-in (the same scaffold-lock flag as the deliverable structure — one switch, one posture);
// a contract's `requires` are judged only once its own gated produce is filled (a floor contract
// does not demand framing from a mission still framing); and the verify procedure's coordinates
// are DERIVED from its contract instead of hard-coded (RWD-2026-0103: the old advice named
// runward/workflows/verify.md on a mission that held no workflows/ directory at all).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyFindingsPath, VERIFY_FINDINGS } from "../../dist/lib/verify-findings.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};
const fresh = (...initArgs) => {
  const dir = mkdtempSync(join(tmpdir(), "rw-wc-gate-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "init", "--yes", ...initArgs);
  return dir;
};
const optIn = (dir) => {
  const p = join(dir, "runward", "scaffold-lock.json");
  const lock = JSON.parse(readFileSync(p, "utf8"));
  lock.structureContract = true;
  writeFileSync(p, JSON.stringify(lock, null, 2) + "\n");
};

test("a fresh mission's contracts hold: the reading is empty, and it does not gate", () => {
  const dir = fresh();
  try {
    const v = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.deepEqual(v.workflowContract, { gating: false, malformed: [], joinBreaks: [], unmetRequires: [] },
      "eleven posed contracts, a held join, no opt-in — the machine contract says exactly that");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a malformed contract is disclosed without the opt-in, and counts with it", () => {
  const dir = fresh();
  try {
    const wf = join(dir, "runward", "workflows", "floor.md");
    writeFileSync(wf, readFileSync(wf, "utf8").replace("gate: strict", "gate: sometimes"));
    const before = run(dir, "check", "--strict");
    assert.match(before.out, /workflow-contract break\(s\).*disclosed, not counted/,
      "no opt-in: the break is said, never counted");
    const vBefore = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.equal(vBefore.workflowContract.gating, false);
    assert.ok(vBefore.workflowContract.malformed.some((m) => m.startsWith("floor.md")),
      "the malformed list names the file");

    optIn(dir);
    const after = run(dir, "check", "--strict");
    assert.match(after.out, /workflow-contract break\(s\).*counted against the verdict \(mission opt-in\)/);
    assert.match(after.out, /\d+ workflow-contract break\(s\)/, "the summary NAMES what failed");
    const vAfter = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.equal(vAfter.workflowContract.gating, true);
    // gaps.conformance is the payload's spelling of the raw strict count (ADR-0030's names hold)
    assert.ok(vAfter.gaps.conformance > vBefore.gaps.conformance,
      "under the opt-in the same break moves the verdict's arithmetic");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("requires are judged only when the contract's own produce is filled — and then they bite", () => {
  const dir = fresh("--example");
  try {
    // The example mission is complete: every contract's requires read filled, nothing is unmet.
    const whole = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.deepEqual(whole.workflowContract.unmetRequires, [], "a complete mission owes nothing");

    // Push framing back to the raw template: floor.md stays filled — the floor contract still
    // CLAIMS its produce — but its declared precondition now reads `untouched`.
    writeFileSync(join(dir, "runward", "framing.md"),
      readFileSync(join(ROOT, "templates", "mission", "framing.md"), "utf8"));
    const v = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.ok(v.workflowContract.unmetRequires.some((u) => u.includes("runward/framing.md")),
      "the floor contract's own precondition, unmet, is named");
    assert.equal(v.workflowContract.gating, false, "still disclosure — the example never opted in");

    // A mission still framing owes nothing: unclaim the produce by pushing floor back too.
    writeFileSync(join(dir, "runward", "floor.md"),
      readFileSync(join(ROOT, "templates", "mission", "floor.md"), "utf8"));
    const early = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.ok(!early.workflowContract.unmetRequires.some((u) => u.startsWith("floor.md")),
      "no claimed produce, no judged requires — the floor contract stays quiet while the mission frames");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the verify coordinates derive from the contract, not from a constant (RWD-2026-0103)", () => {
  const dir = fresh("--example");
  try {
    const mission = join(dir, "runward");
    assert.equal(verifyFindingsPath(mission), VERIFY_FINDINGS,
      "the shipped contract and the fallback constant agree — one path, two spellings");

    // A mission that renames the artifact in ITS contract copy is read, not overridden.
    const wf = join(mission, "workflows", "verify.md");
    writeFileSync(wf, readFileSync(wf, "utf8").replace(
      "produces: [runward/governance/verify-findings.md]",
      "produces: [runward/governance/renamed-findings.md]"));
    assert.equal(verifyFindingsPath(mission), "governance/renamed-findings.md");
    const renamed = run(dir, "check", "--strict");
    assert.match(renamed.out, /runward\/governance\/renamed-findings\.md/,
      "the advice sends the operator where the contract says, character for character");

    // The measured mission shape: no workflows/ at all. The package copy answers, and the
    // advice says where the procedure lives instead of naming a file that is not there.
    rmSync(join(mission, "workflows"), { recursive: true, force: true });
    assert.equal(verifyFindingsPath(mission), VERIFY_FINDINGS, "package fallback");
    const absent = run(dir, "check", "--strict");
    assert.match(absent.out, /shipped with the package — `runward update` lays runward\/workflows\/ down/,
      "the gate no longer sends the operator to a void");
    assert.doesNotMatch(absent.out, /run the verify workflow \(runward\/workflows\/verify\.md\)/,
      "the old hard-coded claim is gone from the mission that disproved it");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
