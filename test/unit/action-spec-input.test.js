// The gate Action's `spec:` and `check:` inputs, and its Node floor (2026-10-13 newcomer measurement).
//
// The Action ran `check` only, so `spec-check`, the command that turns a fabricated claim in a spec
// red without a mission, had no CI seam. And its comment said "Node >= 20 (present on GitHub
// runners)" while the package's engines field says >= 22.12. The run script is executed here with
// `npx` replaced by this build (no network), in a scratch repository with a spec and no mission.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ACTION = readFileSync(join(ROOT, "action.yml"), "utf8");
const ENGINES = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).engines.node;

test("the Action states the package's Node floor and checks it, never an older one", () => {
  assert.equal(ENGINES, ">=22.12.0", "the floor this test holds the Action to; move both together");
  assert.doesNotMatch(ACTION, /Node >= 20\b/, "the Action no longer claims Node 20 suffices");
  assert.match(ACTION, /Node >= 22\.12/);
  assert.match(ACTION, /a > 22 \|\| \(a === 22 && b >= 12\)/, "the run script checks the floor before npx");
});

test("the spec input travels through env, as data, after `--`", () => {
  assert.match(ACTION, /RUNWARD_SPEC:\s*\$\{\{\s*inputs\.spec\s*\}\}/);
  assert.match(ACTION, /RUNWARD_CHECK:\s*\$\{\{\s*inputs\.check\s*\}\}/);
  assert.ok(!/run: \|[\s\S]*\$\{\{/.test(ACTION.slice(ACTION.indexOf("run: |"))), "no `${{ }}` inside the run script (CWE-78)");
  assert.match(ACTION, /spec-check -p "\$RUNWARD_PATH" -- "\$\{specs\[@\]\}"/);
});

test("the run script: spec-check alone on a repo with no mission, red on an unlinked criterion, refusals on misuse", { skip: process.platform === "win32" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-action-spec-"));
  try {
    const shim = join(dir, "shim");
    mkdirSync(shim);
    writeFileSync(join(shim, "npx"), `#!/bin/sh\nshift; shift; exec node ${JSON.stringify(CLI)} --no-color "$@"\n`);
    chmodSync(join(shim, "npx"), 0o755);
    const body = ACTION.slice(ACTION.indexOf("      run: |\n") + "      run: |\n".length).split("\n").map((l) => l.slice(8)).join("\n");
    writeFileSync(join(dir, "run.sh"), body);
    const repo = join(dir, "repo");
    mkdirSync(join(repo, "specs", "f"), { recursive: true });
    mkdirSync(join(repo, "src"));
    writeFileSync(join(repo, "src", "a.js"), "export function approve() { return 1; }\n");
    const spec = (extra) => writeFileSync(join(repo, "specs", "f", "spec.md"), `# F\n\n## Acceptance criteria\n\n- AC1: approves. Evidence: file:src/a.js#approve\n${extra}`);
    const run = (env) => spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", join(dir, "run.sh")], {
      cwd: repo, encoding: "utf8",
      env: { ...process.env, PATH: `${shim}:${process.env.PATH}`, RUNWARD_VERSION: "0.0.0", RUNWARD_PATH: ".", RUNWARD_STRICT: "true", RUNWARD_SPEC: "", RUNWARD_CHECK: "true", ...env },
    });
    spec("");
    assert.equal(run({ RUNWARD_SPEC: "specs/f", RUNWARD_CHECK: "false" }).status, 0, "a linked spec, no mission, check off: green");
    spec("- AC2: refuses. Evidence: test:test/a.test.js::refuses\n");
    assert.equal(run({ RUNWARD_SPEC: "specs/f", RUNWARD_CHECK: "false" }).status, 1, "an unlinked criterion: red");
    assert.equal(run({ RUNWARD_SPEC: "specs/f" }).status, 2, "with the gate on and no mission, the higher code (2) wins");
    assert.equal(run({ RUNWARD_CHECK: "false" }).status, 2, "check off and no spec: nothing to run, refused");
    const opt = run({ RUNWARD_SPEC: "--json", RUNWARD_CHECK: "false" });
    assert.equal(opt.status, 2, "a spec path starting with '-' is refused, never read as an option");
    assert.match(opt.stdout + opt.stderr, /cannot start with '-'/);
    assert.equal(run({ RUNWARD_CHECK: "maybe", RUNWARD_SPEC: "specs/f" }).status, 2, "check accepts true or false only");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
