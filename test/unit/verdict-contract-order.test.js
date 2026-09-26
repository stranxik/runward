// RWD-2026-0120: one verdict, read by every consumer. `computeVerdict` computed clean/exitCode before
// the workflow-contract term reached strictGaps, so on a mission opted into contract hardening a
// broken contract made `check` exit 1 while the verdict object read clean: `verify` re-derived
// "clean" and rejected the honest attestation, and the readiness packs printed "clean (exit 0,
// 1 conformance gap)". Pinned on the real example mission, in both directions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-contract-order-"));
  execFileSync(process.execPath, [CLI, "--yes", "init", "--example", "-p", "."], { cwd: dir, stdio: "pipe" });
  return dir;
}

test("RWD-2026-0120: a broken workflow contract under the opt-in is a gap in the verdict itself", () => {
  const dir = example();
  try {
    const wf = join(dir, "runward", "workflows", "floor.md");
    writeFileSync(wf, readFileSync(wf, "utf8").replace(/^gate: strict$/m, "gate: sometimes"));
    const v = computeVerdict(join(dir, "runward"), { strict: true });
    assert.equal(v.workflowContract.gating, true, "init --example opts into contract hardening (ADR-0069)");
    assert.ok(v.workflowContract.malformed.length > 0, "the contract is broken");
    assert.equal(v.clean, false, "the verdict every consumer reads is not clean");
    assert.equal(v.exitCode, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0120, the other direction: an intact contract leaves the example clean", () => {
  const dir = example();
  try {
    const v = computeVerdict(join(dir, "runward"), { strict: true });
    assert.equal(v.clean, true);
    assert.equal(v.exitCode, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
