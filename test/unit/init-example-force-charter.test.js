// `init --example --force` wrote AGENTS.md twice: the reference's finalized charter, then the blank
// template over it — and `check --strict` stayed green, the blank text matching the hand-over row's
// signature too (RWD-2026-0143). The example must end with the charter it demonstrates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-27" };
const run = (cwd, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV });
const FINALIZED = readFileSync(join(ROOT, "examples", "request-triage", "AGENTS.md"), "utf8");

test("init --example --force keeps the reference's finalized charter, and says it keeps it", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-init-force-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    const r = run(dir, "init", "--yes", "--example", "--force");
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), FINALIZED, "the finalized charter, not the blank template");
    assert.equal((r.stdout.match(/write AGENTS\.md/g) ?? []).length, 1, "one writer for the file");
    assert.match(r.stdout, /keep\s+AGENTS\.md \(the reference mission's finalized charter/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
