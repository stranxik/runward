// The example is judged as the package ships it, not as the repository holds it (RWD-2026-0156).
//
// `init --example` is the first command runward recommends, and from 0.40.0 to 0.42.2 the published
// package answered it red: the example's manifest cites `code/reports/junit.xml`, the repository
// holds it, and `package.json` `files` did not ship it. Every other test ran the example from this
// working tree, where the file exists, so nothing here could see it. This one packs the tarball the
// registry would receive, runs the CLI inside it, and asks the question a new user asks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };

test("RWD-2026-0156: the packed example is green out of the box — init --example then check --strict exits 0", () => {
  const work = mkdtempSync(join(tmpdir(), "rw-packed-"));
  try {
    // --ignore-scripts: pack what is built, never re-run the suite from inside the suite.
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    execFileSync(npm, ["pack", "--ignore-scripts", "--pack-destination", work], { cwd: ROOT, stdio: "pipe", shell: process.platform === "win32" });
    const tgz = readdirSync(work).find((f) => f.endsWith(".tgz"));
    assert.ok(tgz, "npm pack produced a tarball");
    execFileSync("tar", ["-xzf", tgz], { cwd: work, stdio: "pipe" });
    // The tarball carries no dependencies (npm installs them); lend it this checkout's, which the
    // lockfile pins to the same versions an install would resolve.
    symlinkSync(join(ROOT, "node_modules"), join(work, "package", "node_modules"), process.platform === "win32" ? "junction" : "dir");
    const cli = join(work, "package", "dist", "cli.js");
    const mission = join(work, "mission");
    execFileSync("git", ["init", "-q", mission], { stdio: "pipe" });
    execFileSync(process.execPath, [cli, "--yes", "init", "--example"], { cwd: mission, env: ENV, stdio: "pipe" });
    let code = 0, out = "";
    try { out = execFileSync(process.execPath, [cli, "check", "--strict"], { cwd: mission, env: ENV, encoding: "utf8", stdio: "pipe" }); }
    catch (e) { code = e.status; out = (e.stdout ?? "") + (e.stderr ?? ""); }
    assert.equal(code, 0, `the example, as the package ships it, must be green:\n${out.split("\n").filter((l) => l.includes("✗")).join("\n")}`);
  } finally { rmSync(work, { recursive: true, force: true }); }
});
