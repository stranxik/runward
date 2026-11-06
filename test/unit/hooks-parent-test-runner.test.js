// RWD-2026-0204: `check --hooks` handed the hooks it runs the NODE_TEST_CONTEXT of a parent `node --test`.
//
// A parent `node --test` sets NODE_TEST_CONTEXT for each child it spawns: the variable is the protocol by
// which a child reports to it. runward ran its hooks with its whole environment, so when runward itself ran
// under a test runner (a suite that spawns `runward check --hooks`, as this repository's saboteur corpus
// does), a hook's own `node --test` read the variable as its own, skipped every file it was given and
// exited 0. Measured on 2026-11-06 with 0.46.0 on `init --example`: a hook running a failing test file
// fails, `check --strict --hooks` exits 1; the same run with NODE_TEST_CONTEXT=child-v8 in runward's
// environment exits 0. The hooks now run without that one variable, and with every other.
//
// The first test is the positive control: in this environment, a `node --test` under the variable does
// skip its files and exit 0, so the case below would pass vacuously if it did not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hookEnvironment } from "../../dist/lib/hooks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const FAILING = 'import { test } from "node:test";\nimport assert from "node:assert";\ntest("a failing case", () => { assert.equal(1, 2); });\n';

// The failing suite lives outside the mission, so the analyzers never read it: only the hook decides.
const outside = mkdtempSync(join(tmpdir(), "rw-hook-suite-"));
writeFileSync(join(outside, "failing.test.mjs"), FAILING);
test.after(() => rmSync(outside, { recursive: true, force: true }));
const SUITE = JSON.stringify(join(outside, "failing.test.mjs"));

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-hook-context-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir, stdio: "ignore" });
  const init = spawnSync(process.execPath, [CLI, "--yes", "init", "--example"], { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return dir;
}
// The example's floor row cites `runward/hooks.json#reports:fresh`: a hooks file written here keeps the
// name, beside the hooks the case runs, so the example stays green and only the hooks decide the exit.
const hooks = (dir, before) => writeFileSync(join(dir, "runward", "hooks.json"), JSON.stringify({ before, cites: "reports:fresh" }));
const check = (dir, extra) => spawnSync(process.execPath, [CLI, "check", "--strict", "--hooks"], {
  cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", ...extra },
});

test("positive control: a node --test under a parent's NODE_TEST_CONTEXT skips its files and exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-hook-context-"));
  try {
    writeFileSync(join(dir, "failing.test.mjs"), FAILING);
    const { NODE_TEST_CONTEXT: _none, ...clean } = process.env;
    const plain = spawnSync(process.execPath, ["--test", "failing.test.mjs"], { cwd: dir, encoding: "utf8", env: clean });
    const nested = spawnSync(process.execPath, ["--test", "failing.test.mjs"], { cwd: dir, encoding: "utf8", env: { ...clean, NODE_TEST_CONTEXT: "child-v8" } });
    assert.equal(plain.status, 1, "the failing case fails on its own");
    assert.equal(nested.status, 0, "under the variable the nested run reports nothing and exits 0: the mechanism this entry is about");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a hook running a failing node --test fails, whether or not runward runs under a parent test runner", () => {
  const dir = example();
  try {
    hooks(dir, [`node --test ${SUITE}`]);
    const { NODE_TEST_CONTEXT: _none, ...clean } = process.env;
    const alone = spawnSync(process.execPath, [CLI, "check", "--strict", "--hooks"], { cwd: dir, encoding: "utf8", env: { ...clean, NO_COLOR: "1" } });
    assert.equal(alone.status, 1, `${alone.stdout}${alone.stderr}`);
    for (const context of ["child-v8", "child"]) {
      const r = check(dir, { NODE_TEST_CONTEXT: context });
      assert.equal(r.status, 1, `under NODE_TEST_CONTEXT=${context}, the failing hook still fails:\n${r.stdout}${r.stderr}`);
      assert.match(r.stdout + r.stderr, /1\/1 failed/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the hook sees no NODE_TEST_CONTEXT, and every other variable of runward's environment", () => {
  const dir = example();
  try {
    const probe = 'node -e "console.log(JSON.stringify([process.env.NODE_TEST_CONTEXT ?? null, process.env.RW_HOOK_PROBE ?? null]))"';
    hooks(dir, [probe]);
    const r = check(dir, { NODE_TEST_CONTEXT: "child-v8", RW_HOOK_PROBE: "kept" });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /\[null,"kept"\]/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const env = { PATH: "/bin", NODE_TEST_CONTEXT: "child-v8", NODE_OPTIONS: "--x" };
  assert.deepEqual(hookEnvironment(env), { PATH: "/bin", NODE_OPTIONS: "--x" });
  assert.equal(env.NODE_TEST_CONTEXT, "child-v8", "runward's own environment is left as it was");
});
