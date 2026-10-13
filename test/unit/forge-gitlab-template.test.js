// The GitLab CI/CD template (templates/ci/gitlab/runward-gate.yml), at parity with the GitHub
// Action (ADR-0094 decision 6, gap analysis G1 and G10).
//
// What runs here: the template's own script, extracted from the YAML with its inputs interpolated
// the way GitLab interpolates `$[[ inputs.x ]]`, executed by bash in a temporary mission, with `npx`
// replaced on the PATH by this tree's dist/cli.js. What does not run here: GitLab. Whether a GitLab
// instance parses the `spec:` header, honours `integrity:` and shows `expose_as` is the offline
// bench's measurement (PR "ci/gitlab-offline-bench"), not this file's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { assetFor, assetName, integrityOf } from "../../scripts/gitlab-template-asset.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const FILE = join(ROOT, "templates", "ci", "gitlab", "runward-gate.yml");
const TEXT = readFileSync(FILE, "utf8");
const [SPEC, JOBS] = yaml.loadAll(TEXT);
const INPUTS = SPEC.spec.inputs;
const JOB = JOBS["runward-gate"];

function interpolate(value, given = {}) {
  return JSON.parse(JSON.stringify(value).replace(/\$\[\[ inputs\.([a-z-]+) \]\]/g, (_m, k) => {
    assert.ok(k in INPUTS, `the job uses an undeclared input ${k}`);
    return String(k in given ? given[k] : INPUTS[k].default);
  }));
}

/** Run the job's script as GitLab would: bash, its variables in the environment, inside a mission. */
function runJob(cwd, given = {}, job = interpolate(JOB, given)) {
  const bin = mkdtempSync(join(tmpdir(), "rw-gl-bin-"));
  // `npx --yes runward@<v> ...` → this tree's CLI. The version is recorded so a test can read it.
  writeFileSync(join(bin, "npx"), `#!/bin/sh\nshift\necho "$1" >> "${join(bin, "versions")}"\nshift\nexec "${process.execPath}" "${CLI}" "$@"\n`);
  chmodSync(join(bin, "npx"), 0o755);
  const r = spawnSync("bash", ["-eo", "pipefail", "-c", job.script.join("\n")], {
    cwd, encoding: "utf8", env: { ...process.env, ...job.variables, PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH}` },
  });
  const versions = existsSync(join(bin, "versions")) ? readFileSync(join(bin, "versions"), "utf8") : "";
  rmSync(bin, { recursive: true, force: true });
  return { ...r, versions, job };
}

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-gl-"));
  execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: dir, stdio: "pipe" });
  return dir;
}

test("GitLab template: declares the Action's inputs, and the job reads only declared inputs", () => {
  const action = yaml.load(readFileSync(join(ROOT, "action.yml"), "utf8"));
  for (const k of Object.keys(action.inputs)) assert.ok(k in INPUTS, `the Action's input ${k} exists in the GitLab template`);
  assert.equal(INPUTS.version.default, "latest", "the tree's template follows latest, as the Action does; the release asset pins it");
  assert.equal(INPUTS.strict.default, true);
  assert.equal(INPUTS.path.default, ".");
  interpolate(JOB);
  assert.equal(JOB.artifacts.when, "always", "reports are deposited on a red gate too");
  assert.ok(JOB.artifacts.expose_as, "the reports are linked from the merge request");
});

test("GitLab template: the same dist-tags, the same unpinned warning and the same refusal as action.yml", () => {
  const action = readFileSync(join(ROOT, "action.yml"), "utf8");
  for (const piece of ["latest|next)", "is not pinned: the verdict can change when a new runward is published",
    "invalid runward version '$RUNWARD_VERSION' (use a semver or 'latest')"]) {
    assert.ok(action.includes(piece), `action.yml still carries ${piece}`);
    assert.ok(TEXT.includes(piece), `the GitLab template carries ${piece}`);
  }
});

test("GitLab template, run: a clean mission exits 0, deposits the five reports, and verify re-derives the attestation", () => {
  const dir = example();
  try {
    const r = runJob(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /WARNING: runward@latest is not pinned/);
    for (const f of ["check.json", "check.sarif", "verdict.intoto.json", "verify.json", "delivery-report.html"]) {
      assert.ok(existsSync(join(dir, "runward-reports", f)), `${f} deposited`);
    }
    assert.equal(JSON.parse(readFileSync(join(dir, "runward-reports", "verify.json"), "utf8")).verified, true);
    assert.equal(JSON.parse(readFileSync(join(dir, "runward-reports", "check.json"), "utf8")).verdict, "clean");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("GitLab template, run: a gap exits 1 with its reports; a pinned version runs that version, silently", () => {
  const dir = example();
  try {
    rmSync(join(dir, "runward", "handover.md"));
    const r = runJob(dir, { version: "0.43.1" });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /not pinned/);
    assert.ok(r.versions.trim().split("\n").every((v) => v === "runward@0.43.1"), r.versions);
    assert.ok(existsSync(join(dir, "runward-reports", "check.json")), "a red gate still deposits");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("GitLab template, run: a malformed version or path is refused with exit 2 before anything runs", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-gl-bad-")); // refused before any mission is read
  try {
    for (const given of [{ version: "1.0.0; curl evil" }, { version: "$(id)" }, { path: "../elsewhere" }, { path: "/etc" }]) {
      const r = runJob(dir, given);
      assert.equal(r.status, 2, JSON.stringify(given) + r.stdout);
      assert.equal(r.versions, "", "runward was never invoked");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("GitLab template: the image carries runward's Node floor, and the job checks the floor itself", () => {
  const engines = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).engines.node;
  const [maj, min] = engines.match(/(\d+)\.(\d+)/).slice(1).map(Number);
  assert.ok(Number(INPUTS.image.default.match(/node:(\d+)/)[1]) >= maj);
  assert.ok(TEXT.includes(`a<${maj}||(a===${maj}&&b<${min})`), `the script refuses Node below ${engines}`);
});

test("GitLab release asset: the template with only the version pinned, deterministic, and its integrity value", () => {
  const a = assetFor("0.43.1");
  assert.equal(a, assetFor("0.43.1"), "two builds, the same bytes");
  const diff = TEXT.split("\n").map((l, i) => [l, a.split("\n")[i]]).filter(([x, y]) => x !== y);
  assert.deepEqual(diff, [['      default: "latest"', '      default: "0.43.1"']], "one line differs: the version default");
  assert.equal(yaml.loadAll(a)[0].spec.inputs.version.default, "0.43.1");
  assert.equal(assetName("0.43.1"), "runward-gitlab-gate-0.43.1.yml");
  assert.match(integrityOf(a), /^sha256-[A-Za-z0-9+/]{43}=$/);
  assert.throws(() => assetFor("latest"), /x\.y\.z/);
  assert.throws(() => assetFor("1.2.3", TEXT.replace('default: "latest"', 'default: "next"')), /found 0 times/);
});

test("GitLab adapter sample (templates/adapters/gitlab-ci.yml): warns unpinned, deposits and verifies, keeps the port's exit codes", () => {
  const sample = yaml.load(readFileSync(join(ROOT, "templates", "adapters", "gitlab-ci.yml"), "utf8"))["runward-gate"];
  assert.equal(sample.artifacts.when, "always");
  const dir = example();
  const empty = mkdtempSync(join(tmpdir(), "rw-gl-empty-"));
  try {
    const clean = runJob(dir, {}, sample);
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /WARNING: runward@latest is not pinned/);
    assert.equal(JSON.parse(readFileSync(join(dir, "runward-reports", "verify.json"), "utf8")).verified, true);
    rmSync(join(dir, "runward", "handover.md"));
    const gap = runJob(dir, {}, { ...sample, variables: { RUNWARD_VERSION: "0.43.1" } });
    assert.equal(gap.status, 1, gap.stdout);
    assert.doesNotMatch(gap.stdout, /not pinned/);
    assert.equal(runJob(empty, {}, sample).status, 2, "no mission stays exit 2, never read as a red gate");
    assert.equal(runJob(dir, {}, { ...sample, variables: { RUNWARD_VERSION: "1.0.0; id" } }).status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(empty, { recursive: true, force: true }); }
});

test("GitLab template, run: the spec and check inputs behave as the Action's (spec-check alone, higher code wins, refusals)", () => {
  const repo = mkdtempSync(join(tmpdir(), "rw-gl-spec-"));
  try {
    mkdirSync(join(repo, "specs", "f"), { recursive: true });
    mkdirSync(join(repo, "src"));
    writeFileSync(join(repo, "src", "a.js"), "export function approve() { return 1; }\n");
    const spec = (extra) => writeFileSync(join(repo, "specs", "f", "spec.md"), `# F\n\n## Acceptance criteria\n\n- AC1: approves. Evidence: file:src/a.js#approve\n${extra}`);
    spec("");
    assert.equal(runJob(repo, { spec: "specs/f", check: false, version: "0.43.1" }).status, 0, "a linked spec, no mission, check off: green");
    spec("- AC2: refuses. Evidence: test:test/a.test.js::refuses\n");
    assert.equal(runJob(repo, { spec: "specs/f", check: false, version: "0.43.1" }).status, 1, "an unlinked criterion: red");
    assert.equal(runJob(repo, { spec: "specs/f", version: "0.43.1" }).status, 2, "with the gate on and no mission, the higher code (2) wins");
    assert.equal(runJob(repo, { check: false, version: "0.43.1" }).status, 2, "check off and no spec: refused");
    const opt = runJob(repo, { spec: "--json", check: false, version: "0.43.1" });
    assert.equal(opt.status, 2);
    assert.match(opt.stdout, /cannot start with '-'/);
    assert.equal(runJob(repo, { spec: "specs/*", check: false, version: "0.43.1" }).status, 2, "a glob is not expanded: specs/* is read as one missing path");
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
