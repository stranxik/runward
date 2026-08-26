// A FAILED verification reaches no level, and must not name one.
//
// Measured 2026-08-26: a mission with a conformance gap emitted `verificationResult: "FAILED"` beside
// `verifiedLevels: ["RUNWARD_GATE_STRICT"]`. The level was computed from `strict`/`through` alone;
// the pass/fail reached only the result. docs/interop.md §4 singles that field out — "Read the level,
// not just the result: RUNWARD_GATE_PRESENCE is a weaker statement than RUNWARD_GATE_STRICT" — so a
// Kyverno or OPA rule written to that instruction admitted an artifact whose gate had refused it.
//
// The SLSA VSA v1 spec's SlsaResult carries `FAILED` for exactly this ("Indicates policy evaluation
// failed"), and it is not an `SLSA_`-prefixed value, so emitting it breaks no rule the emitter's own
// comment states.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CLI = join(process.cwd(), "dist/cli.js");
const run = (cwd, ...a) => spawnSync(process.execPath, [CLI, ...a],
  { cwd, encoding: "utf8", env: { ...process.env, SOURCE_DATE_EPOCH: "1700000000" } });

function mission() {
  const root = mkdtempSync(join(tmpdir(), "rw-vsa-"));
  spawnSync("git", ["init", "-q", "."], { cwd: root });
  run(root, "init", "--yes", "--example");
  assert.equal(run(root, "check", "--strict").status, 0, "the fixture must start green");
  return root;
}
const vsa = (root, ...extra) => JSON.parse(
  run(root, "check", "--strict", ...extra, "--vsa", "--resource-uri", "pkg:generic/probe@1").stdout).predicate;

test("a PASSED verification names the level it reached", () => {
  const root = mission();
  try {
    const p = vsa(root);
    assert.equal(p.verificationResult, "PASSED");
    assert.deepEqual(p.verifiedLevels, ["RUNWARD_GATE_STRICT"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a FAILED verification says FAILED in both fields", () => {
  const root = mission();
  try {
    const floor = join(root, "runward/floor.md");
    writeFileSync(floor, readFileSync(floor, "utf8")
      .replace("file:code/src/core/domain/guard.ts#guardFields", "file:code/src/does-not-exist.ts#nope"));
    assert.equal(run(root, "check", "--strict").status, 1, "the gate must actually refuse this tree");
    const p = vsa(root);
    assert.equal(p.verificationResult, "FAILED");
    assert.deepEqual(p.verifiedLevels, ["FAILED"],
      "the one field the interop page tells a policy engine to branch on must carry the failure");
    assert.ok(!JSON.stringify(p.verifiedLevels).includes("RUNWARD_GATE"),
      "a refused gate may not name a runward level anywhere in that array");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("no emitted level ever starts with SLSA_, passed or failed", () => {
  // The emitter's own comment: runward evaluates no SLSA build level, and the spec is explicit that
  // custom values MUST NOT start with SLSA_. The fix must not have traded one spec violation for
  // another.
  const root = mission();
  try {
    for (const p of [vsa(root), vsa(root, "--through", "floor")]) {
      for (const level of p.verifiedLevels) {
        assert.ok(!level.startsWith("SLSA_"), `${level} claims a SLSA build level runward never looked at`);
      }
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
