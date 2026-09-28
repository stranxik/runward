// `wire --json` names harnesses by their detection id (`claude-code`, `gemini-cli`) and
// `gate-hook --harness` only knew its own (`claude`, `gemini`): an agent that copied one into the
// other got "unknown harness" and a gate never evaluated (RWD-2026-0147). gate-hook now accepts
// the detection id as an alias, and `wire --json` carries `gateHookId`, the exact id it expects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const BASE_ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-28" };
delete BASE_ENV.CLAUDECODE; delete BASE_ENV.GEMINI_CLI; delete BASE_ENV.CURSOR_AGENT;
const run = (cwd, env, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: { ...BASE_ENV, ...env }, input: "" });

/** A red mission: the shipped example with one decided row emptied. */
function redMission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-hook-ids-"));
  assert.equal(run(dir, {}, "--yes", "init", "--example").status, 0);
  const f = join(dir, "runward", "handover.md");
  writeFileSync(f, readFileSync(f, "utf8").replace(/^(\| handover-agents-charter-final \| )applied( \|)/m, "$1$2"));
  assert.equal(run(dir, {}, "check", "--strict").status, 1);
  return dir;
}

for (const [signal, detectionId, hookId] of [["CLAUDECODE", "claude-code", "claude"], ["GEMINI_CLI", "gemini-cli", "gemini"], ["CURSOR_AGENT", "cursor", "cursor"]]) {
  test(`hook ids: wire's ${detectionId} and its gateHookId both run the gate, never "unknown harness"`, () => {
    const dir = redMission();
    try {
      const j = JSON.parse(run(dir, { [signal]: "1" }, "wire", "--json").stdout);
      assert.equal(j.harness, detectionId);
      assert.equal(j.gateHookId, hookId);
      for (const id of [j.harness, j.gateHookId]) {
        const r = run(dir, {}, "gate-hook", "--harness", id);
        assert.doesNotMatch(r.stderr, /misconfigured|unknown harness/, `--harness ${id}`);
        assert.match(r.stdout + r.stderr, /handover-agents-charter-final/, `--harness ${id} judged the tree and named the red row`);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test("hook ids: a harness gate-hook does not speak stays a misconfiguration, and wire says null", () => {
  const dir = redMission();
  try {
    const r = run(dir, {}, "gate-hook", "--harness", "windsurf");
    assert.equal(r.status, 0, "fail-open on configuration (RWD-2026-0137)");
    assert.match(r.stderr, /unknown harness "windsurf"/);
    const j = JSON.parse(run(dir, {}, "wire", "--json").stdout);
    assert.equal(j.gateHookId, null, "undetermined harness: no id to hand gate-hook");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
