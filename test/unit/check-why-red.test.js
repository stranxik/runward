// A red `check` ends on why it is red (the 2026-10-13 newcomer measurement).
//
// On the renaming demo the two ✗ lines that turned the gate red sat at lines 40 and 41 of 78; the
// end of the screen gave a count, "Current gate  all deliverables filled (verdict: gaps)", and a
// Next line pointing "above". The closing block now repeats each cause, one line each, right above
// the next command, and the summary label says both halves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const check = (dir, ...a) => spawnSync("node", [CLI, "check", ...a], { cwd: dir, encoding: "utf8", env });

test("the renaming demo: the red output ends on the two causes, then the next command", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-whyred-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: dir, env });
    const green = check(dir, "--strict");
    assert.equal(green.status, 0);
    assert.doesNotMatch(green.stdout, /Why red/, "a green run prints no Why red block");
    execFileSync("sh", ["-c", "grep -rl guardFields code/src | xargs sed -i.bak 's/guardFields/validateFields/g'"], { cwd: dir });
    const red = check(dir, "--strict");
    assert.equal(red.status, 1);
    const lines = red.stdout.trimEnd().split("\n");
    const at = lines.findIndex((l) => l === "Why red");
    assert.ok(at > 0, "a Why red section is printed");
    assert.ok(at > lines.findIndex((l) => l === "Summary"), "after the summary");
    const block = lines.slice(at + 2, lines.findIndex((l, i) => i > at && l === "Next"));
    const causes = block.filter((l) => l.startsWith("  ✗ "));
    assert.equal(causes.length, 2, "one line per cause: " + block.join(" | "));
    assert.match(causes[0], /Floor · frontier-deterministic-boundary — typed pointer file:code\/src\/core\/domain\/guard\.ts#guardFields — symbol "guardFields" not found/);
    assert.match(causes[1], /Govern · security-prompt-injection — /);
    assert.match(lines.slice(-1)[0], /re-run runward check --strict\.$/, "the screen ends on the next command");
    assert.match(red.stdout, /Current gate\s+deliverables filled, gate red at \S*Floor, \S*Govern/);
    assert.doesNotMatch(red.stdout, /verdict: gaps\)/);
    // Every machine mode is unchanged: one document, no human block inside it.
    const json = check(dir, "--strict", "--json");
    assert.doesNotMatch(json.stdout, /Why red/);
    assert.match(JSON.parse(json.stdout).currentGate, /^deliverables filled, gate red at /);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a deliverable gap is named in the block with its file", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-whyred-blank-"));
  try {
    execFileSync("node", [CLI, "--yes", "init"], { cwd: dir, env });
    const red = check(dir);
    assert.equal(red.status, 1);
    const tail = red.stdout.slice(red.stdout.indexOf("Why red"));
    assert.match(tail, /✗ .*\(runward\/framing\.md\) — /, "the unfilled framing note is named with its path");
    assert.match(tail, /… and \d+ more above \(`runward check --json` lists every one\)\./, "a long list is capped and says where the rest is");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
