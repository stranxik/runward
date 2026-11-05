// RWD-2026-0191: a cited symlink sealed through a path that crosses a symlinked directory (macOS
// $TMPDIR under /var is /private/var) wrote a lock key outside the project, and the mission refused
// its own lock once checked from its real directory. Found on 2026-11-05 while writing the tests that
// kill the holes filed in docs/compliance/mutation-survivors. The mission is reached here through a
// symlink made on purpose, so the test holds on every OS that has symlinks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "cli.js");
const dirs = [];
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

function rw(cwd, ...args) {
  try { return { out: execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } }), code: 0 }; }
  catch (e) { return { out: `${e.stdout ?? ""}${e.stderr ?? ""}`, code: e.status }; }
}

test("RWD-2026-0191: a cited symlink sealed through a symlinked path keeps a project-relative lock key", { skip: process.platform === "win32" && "symlinks need privileges on Windows" }, () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "rw-linkkey-")));
  dirs.push(base);
  const real = join(base, "real");
  execFileSync("git", ["init", "-q", real]);
  assert.equal(rw(real, "--yes", "init", "--example").code, 0);
  const alias = join(base, "alias");
  symlinkSync(real, alias, "dir");
  symlinkSync("src/core/domain/guard.ts", join(real, "code", "evidence-alias.ts"));
  const floor = join(real, "runward", "floor.md");
  const text = readFileSync(floor, "utf8");
  assert.ok(text.includes("file:code/src/core/domain/guard.ts#parseDeadline"), "the example cites parseDeadline");
  writeFileSync(floor, text.replace("file:code/src/core/domain/guard.ts#parseDeadline", "file:code/evidence-alias.ts#parseDeadline"));

  // Freeze through the symlinked directory, the way a macOS $TMPDIR path reaches a mission.
  assert.equal(rw(base, "check", "--strict", "--freeze", "--path", alias).code, 0);
  const keys = Object.keys(JSON.parse(readFileSync(join(real, "runward", "evidence-lock.json"), "utf8")).files);
  assert.ok(keys.includes("code/evidence-alias.ts"), `the link is sealed under its own path: ${keys.filter((k) => k.includes("alias")).join(", ")}`);
  assert.ok(keys.every((k) => !k.startsWith("..")), "no lock key escapes the project");

  // The lock reads back whichever way the mission is reached.
  for (const [cwd, args] of [[real, []], [base, ["--path", alias]], [base, ["--path", real]]]) {
    const r = rw(cwd, "check", "--strict", ...args);
    assert.doesNotMatch(r.out, /sealed path escapes the project/);
    assert.match(r.out, /seal intact/);
    assert.equal(r.code, 0);
  }

  // Positive control: the link is still sealed by what it points at, so re-pointing it breaks the seal.
  rmSync(join(real, "code", "evidence-alias.ts"));
  symlinkSync("src/core/domain/triage.ts", join(real, "code", "evidence-alias.ts"));
  const moved = rw(real, "check", "--strict");
  assert.equal(moved.code, 1);
  assert.match(moved.out, /sealed evidence changed: code\/evidence-alias\.ts/);
});
