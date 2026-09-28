// `wire` recommended the consultative sample (`runward check --strict 2>&1 || true`, which never
// blocks) without saying so, never named the armed tier `wire --install`, and closed on "runward
// wires nothing" — which its own --install contradicts (RWD-2026-0148).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const BASE_ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
delete BASE_ENV.CLAUDECODE; delete BASE_ENV.GEMINI_CLI; delete BASE_ENV.CURSOR_AGENT;
const run = (cwd, env, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: { ...BASE_ENV, ...env }, input: "" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-armed-tier-"));
  assert.equal(run(dir, {}, "init", "--yes").status, 0);
  return dir;
}

test("armed tier: wire names wire --install beside the advisory sample, and says the sample never blocks", () => {
  const dir = mission();
  try {
    const out = run(dir, { CLAUDECODE: "1" }, "wire").stdout;
    assert.match(out, /turn-end-hook \(armed\)\s+runward wire --install/);
    assert.match(out, /turn-end-hook \(advisory\)\s+runward\/adapters\/claude-code-settings\.json\s+reports the verdict, never blocks/);
    assert.match(out, /Arm the gate: the operator runs runward wire --install in their own terminal/);
    assert.doesNotMatch(out, /runward wires nothing/, "the sentence --install contradicts is gone");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("armed tier: wire --json carries the armed gesture and tags the sample advisory", () => {
  const dir = mission();
  try {
    const j = JSON.parse(run(dir, { CLAUDECODE: "1" }, "wire", "--json").stdout);
    assert.equal(j.recommendedChannel.tier, "advisory");
    assert.deepEqual(j.armed, {
      command: "runward wire --install", preview: "runward --dry-run wire --install",
      target: ".claude/settings.json", gateHook: "runward gate-hook --harness claude", by: "operator-in-terminal",
    });
    const g = JSON.parse(run(dir, { GEMINI_CLI: "1" }, "wire", "--json").stdout);
    assert.equal(g.armed, null, "no native install for gemini: nothing promised");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
