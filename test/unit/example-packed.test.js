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
import { copyFileSync, existsSync, lstatSync, mkdtempSync, rmSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };

// Packed where its `node_modules` really is, as package-sbom.test.js packs (7d1846b). In a mutation
// sandbox, Stryker copies the tree into `.stryker-tmp/` and links `node_modules` back to the checkout's;
// once the hidden lockfile (`node_modules/.package-lock.json`) is older than one package folder, npm
// reads the bundled dependencies through that link and writes their dependencies under
// `package/../../node_modules/`, and `tar -xzf` refuses those members. The failure does not depend on
// the mutant. In mutation-ratchet.yml run 43208428078 (`mission` alone, at e5ff5f2) this test failed so
// for every mutant that ran it, and was the only failing test of 596 of them, each counted Killed; runs
// at 7d1846b show the same for 65 mutants of `attestation`, 61 of `verdict`, 16 of `check-contract`, 6
// of `rules` and 1 of `paths`.
//
// Unlike the SBOM tests, this one runs the CLI the tarball ships, so in a sandbox it must run the
// sandbox's code, where the mutant is: packing the checkout alone would run unmutated code and turn
// every mutant this test catches into a survivor. So the checkout is packed for the tarball's shape
// (its file list and its bundled dependencies: same package.json, same lockfile), and each file the
// package itself ships is then taken from this tree. Outside a sandbox `packRoot()` is this tree and
// nothing is replaced.
function packRoot() {
  const nm = join(ROOT, "node_modules");
  try {
    if (!lstatSync(nm).isSymbolicLink()) return ROOT;
    const checkout = dirname(realpathSync(nm));
    return existsSync(join(checkout, "package.json")) ? checkout : ROOT;
  } catch { return ROOT; }
}
/** Every file of the extracted package outside its bundled `node_modules`, overwritten by this tree's. */
function shipThisTree(pkg) {
  let replaced = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (p !== join(pkg, "node_modules")) walk(p); continue; }
      const own = join(ROOT, relative(pkg, p));
      assert.ok(existsSync(own), `the packed file ${relative(pkg, p)} exists in the tree under test`);
      copyFileSync(own, p);
      replaced++;
    }
  };
  walk(pkg);
  return replaced;
}

test("RWD-2026-0156: the packed example is green out of the box — init --example then check --strict exits 0", () => {
  const work = mkdtempSync(join(tmpdir(), "rw-packed-"));
  try {
    // --ignore-scripts: pack what is built, never re-run the suite from inside the suite.
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const from = packRoot();
    execFileSync(npm, ["pack", "--ignore-scripts", "--pack-destination", work], { cwd: from, stdio: "pipe", shell: process.platform === "win32" });
    const tgz = readdirSync(work).find((f) => f.endsWith(".tgz"));
    assert.ok(tgz, "npm pack produced a tarball");
    execFileSync("tar", ["-xzf", tgz], { cwd: work, stdio: "pipe" });
    if (from !== ROOT) assert.ok(shipThisTree(join(work, "package")) > 100, "the package ships this tree's files, not the checkout's");
    // The tarball carries its runtime dependencies (`bundleDependencies`, ADR-0116), at the lockfile's
    // versions: the CLI below runs on the packages it bundles, as an installation does, and on nothing
    // of this checkout. Reading the lockfile also says what this test is: it packs a source tree.
    const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
    const bundled = JSON.parse(readFileSync(join(work, "package", "node_modules", "commander", "package.json"), "utf8"));
    assert.equal(bundled.version, lock.packages["node_modules/commander"].version, "the tarball bundles its runtime dependencies, at the lockfile's versions");
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
