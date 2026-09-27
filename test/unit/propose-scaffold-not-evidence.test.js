// On a fresh mission, `propose` offered handover-agents-charter-final as "signature-corroborated",
// citing the generic AGENTS.md that `init` had just written — its text holds "--strict" and
// "Never" by construction (RWD-2026-0142). runward's own template is not the project's evidence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-27" };
const run = (cwd, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV });
const ROW = /^\| handover-agents-charter-final \|.*$/m;

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), "rw-propose-scaffold-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  assert.equal(run(dir, "init", "--yes").status, 0);
  assert.equal(run(dir, "manifest", "--sync").status, 0);
  return dir;
}
const handoverRow = (dir) => readFileSync(join(dir, "runward", "handover.md"), "utf8").match(ROW)?.[0] ?? "";

test("propose does not cite the untouched scaffolded AGENTS.md as evidence, and says why", () => {
  const dir = fresh();
  try {
    const r = run(dir, "propose");
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /handover-agents-charter-final — proposed:applied/);
    assert.match(r.stdout, /handover-agents-charter-final — AGENTS\.md is still the file runward scaffolded; nothing proposed/);
    assert.doesNotMatch(handoverRow(dir), /proposed:applied/, "the row stays empty");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("propose still proposes once the operator has written the charter", () => {
  const dir = fresh();
  try {
    appendFileSync(join(dir, "AGENTS.md"), "\n## Mission boundaries\nNever write to the registry.\n");
    const r = run(dir, "propose");
    assert.equal(r.status, 0, r.stderr);
    assert.match(handoverRow(dir), /proposed:applied \| file:AGENTS\.md/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
