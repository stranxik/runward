// ADR-0115: the shipped example cites machine evidence, and the recommended CI regenerates it.
//
// Measured on 0.46.0 (2026-11-05): with no machine evidence, `check --strict` on the example stayed
// green after the domain was rewritten around a database driver with a key in it, after a file that
// executes a model's output was added, after the tests were emptied, and after stub files were
// committed with a forged JUnit report. The example now cites four reports a tool writes (JUnit,
// LCOV, ESLint JSON, SARIF) and ships the script that regenerates and compares them. Held here:
//
//   1. the lint configuration refuses each shape the mission forbids, and passes the example as is;
//   2. the committed lint reports are what the example's script writes on this tree (the JUnit and
//      coverage reports need the example's own dependencies: `check --strict --hooks` on the example
//      regenerates and compares all four, ADR-0115);
//   3. the example's requiresUnmet is empty, and the gate still reads a hand-written report as the
//      report it claims to be (it reads, it never runs: the regeneration is what catches it);
//   4. `reports.mjs --check` compares what each report says, never its bytes, and refuses a
//      committed report the tree does not produce;
//   5. the CI the product ships runs the gate as `check --strict --hooks`, and the example's hook is
//      that comparison.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { ESLint } from "eslint";
import * as yaml from "js-yaml";

const ROOT = join(import.meta.dirname, "..", "..");
const CODE = join(ROOT, "examples", "request-triage", "code");
const CONFIG = join(CODE, "eslint.config.mjs");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", COLUMNS: "400" };
const dirs = [];
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const tmp = (p) => { const d = realpathSync(mkdtempSync(join(tmpdir(), p))); dirs.push(d); return d; };
const rw = (cwd, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd, encoding: "utf8", env: ENV });

// Credential shapes, assembled at run time so that no scanner reads one in this file.
const KEY = "sk-" + "live-" + "x".repeat(24);
const URL_WITH_PASSWORD = "postgres://" + "admin:" + "not-a-password" + "@db:5432/triage";
const BEARER = "Bearer " + "a".repeat(24);

async function lint(files) {
  const dir = tmp("rw-example-lint-");
  cpSync(join(CODE, "src"), join(dir, "src"), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  const eslint = new ESLint({ cwd: dir, overrideConfigFile: CONFIG });
  const out = {};
  for (const r of await eslint.lintFiles(["src"])) {
    out[relative(dir, r.filePath).split("\\").join("/")] = r.messages.map((m) => `${m.line}:${m.ruleId}:${m.severity}`);
  }
  return out;
}

test("1. the lint configuration passes the example as it ships", async () => {
  const found = await lint({});
  assert.equal(Object.keys(found).length, 12, "every source file is linted");
  for (const [file, messages] of Object.entries(found)) assert.deepEqual(messages, [], `${file} is clean`);
});

test("1. the lint refuses an infrastructure import, a spawn, an adapter, the network and run-time loading in the core", async () => {
  const found = await lint({
    "src/core/domain/probe.ts": [
      'import { Client } from "pg";',
      'import { execSync } from "node:child_process";',
      'import * as fs from "fs";',
      'import { KeywordModelAdapter } from "../../adapters/keyword-model.adapter.js";',
      'export const probe = async () => [Client, execSync, fs, KeywordModelAdapter, await fetch("https://x.invalid")];',
      'export const load = () => import("node:child_process");',
      'export const req = () => require("pg");',
      "",
    ].join("\n"),
    // The same imports in an adapter are an adapter's business: the boundary is the core's.
    "src/adapters/probe.adapter.ts": 'import { execSync } from "node:child_process";\nexport const run = () => execSync("true");\n',
  });
  assert.deepEqual(found["src/core/domain/probe.ts"], [
    "1:no-restricted-imports:2", "2:no-restricted-imports:2", "3:no-restricted-imports:2", "4:no-restricted-imports:2",
    "5:no-restricted-globals:2", "6:no-restricted-syntax:2", "7:no-restricted-syntax:2",
  ]);
  assert.deepEqual(found["src/adapters/probe.adapter.ts"], [], "an adapter may spawn: the hexagon constrains the core");
});

test("1. the lint refuses a string run as code and a credential literal anywhere, and an inline disable does not silence it", async () => {
  const found = await lint({
    "src/adapters/exec.adapter.ts": [
      "export const a = (t: string) => eval(t);",
      "export const b = (t: string) => new Function(t);",
      'export const c = () => setTimeout("alert(1)", 1);',
      `export const d = "${KEY}";`,
      `export const e = "${URL_WITH_PASSWORD}";`,
      "export const f = `" + BEARER + "`;",
      "// eslint-disable-next-line no-eval",
      "export const g = (t: string) => eval(t);",
      "",
    ].join("\n"),
  });
  assert.deepEqual(found["src/adapters/exec.adapter.ts"], [
    "1:no-eval:2", "2:no-new-func:2", "3:no-implied-eval:2", "4:no-restricted-syntax:2", "5:no-restricted-syntax:2",
    "6:no-restricted-syntax:2", "7:null:1", "8:no-eval:2",
  ], "the disable comment is reported as having no effect, and the eval under it is still an error");
});

test("2. the committed lint reports are what scripts/lint-committable.mjs writes on this tree", () => {
  const out = tmp("rw-example-lint-reports-");
  const r = spawnSync(process.execPath, [join(CODE, "scripts", "lint-committable.mjs"), out], { cwd: CODE, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const name of ["eslint.json", "eslint.sarif"]) {
    assert.equal(readFileSync(join(out, name), "utf8"), readFileSync(join(CODE, "reports", name), "utf8"),
      `reports/${name} is stale: run \`npm run reports\` in examples/request-triage/code and commit it`);
  }
  const sarif = JSON.parse(readFileSync(join(out, "eslint.sarif"), "utf8"));
  assert.deepEqual(sarif.runs[0].tool.driver.rules.map((x) => x.id),
    ["no-eval", "no-implied-eval", "no-new-func", "no-restricted-globals", "no-restricted-imports", "no-restricted-syntax"],
    "the rule list is the configuration in force, read from ESLint");
  for (const name of ["eslint.json", "eslint.sarif", "junit.xml", "lcov.info"]) {
    const text = readFileSync(join(CODE, "reports", name), "utf8");
    assert.doesNotMatch(text, /\/(Users|home|private|tmp)\/|[A-Za-z]:\\\\/, `${name} carries no absolute path`);
    assert.doesNotMatch(text, /\btime="|duration_ms|"timestamp"/, `${name} carries no timing`);
  }
});

function example() {
  const dir = tmp("rw-example-evidence-");
  assert.equal(rw(dir, "--yes", "init", "--example").status, 0);
  return dir;
}

test("3. the shipped example requires nothing it does not cite, and the gate reads a hand-written report as what it claims", () => {
  const dir = example();
  const j = JSON.parse(rw(dir, "check", "--strict", "--json").stdout);
  assert.equal(j.exitCode, 0);
  assert.deepEqual(j.requiresUnmet, [], "every rule's required kind of evidence is cited");
  // The gate's limit, said by a test so that nobody mistakes it for a defect: it reads a report, it
  // never runs the tool. A JSON file of a hundred bytes written by hand reads as an ESLint report.
  const forged = JSON.stringify([{ filePath: "src/core/domain/guard.ts", messages: [], errorCount: 0 },
    { filePath: "src/core/domain/triage.ts", messages: [], errorCount: 0 },
    { filePath: "src/core/application/triage-request.usecase.ts", messages: [], errorCount: 0 }]);
  writeFileSync(join(dir, "code", "reports", "eslint.json"), forged);
  writeFileSync(join(dir, "code", "src", "core", "domain", "guard.ts"),
    readFileSync(join(dir, "code", "src", "core", "domain", "guard.ts"), "utf8") + '\nimport "pg";\n');
  assert.equal(rw(dir, "check", "--strict").status, 0, "the committed tree alone cannot tell: the CI regeneration is what refuses it");
  const hooks = JSON.parse(readFileSync(join(dir, "runward", "hooks.json"), "utf8"));
  assert.deepEqual(hooks.before, ["cd code && npm install --no-audit --no-fund --loglevel=error && npm run --silent reports:fresh"],
    "the example's hook is the regeneration and comparison, run before the gate by `check --hooks`");
  const pkg = JSON.parse(readFileSync(join(dir, "code", "package.json"), "utf8"));
  assert.equal(pkg.scripts["reports:fresh"], "node scripts/reports.mjs --check");
  assert.equal(pkg.scripts.reports, "node scripts/reports.mjs");
});

// ── 4. reports.mjs --check, its comparison alone: the generators replaced by fakes ─────────────────

const FAKE = `#!/usr/bin/env node
import { cpSync, existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
const dir = join(process.env.FAKE_DIR, basename(process.argv[1], ".mjs"));
if (existsSync(join(dir, "out"))) cpSync(join(dir, "out"), process.argv[2], { recursive: true });
process.exit(existsSync(join(dir, "exit")) ? Number(readFileSync(join(dir, "exit"), "utf8")) : 0);
`;
const JUNIT = (cases) => `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n${cases.map(([n, body]) => body
  ? `\t<testcase name="${n}" classname="test">${body}</testcase>\n` : `\t<testcase name="${n}" classname="test"/>\n`).join("")}\t<!-- tests ${cases.length} -->\n</testsuites>\n`;
const LCOV = (files) => files.map(([f, hits]) => `TN:\nSF:${f}\nDA:1,${hits}\nDA:2,${hits}\nLH:${hits ? 2 : 0}\nLF:2\nend_of_record\n`).join("");
const ESLINT = (files) => JSON.stringify(files.map(([f, msgs = []]) => ({ filePath: f, messages: msgs.map(([ruleId, line]) => ({ ruleId, severity: 2, message: "m", line, column: 1 })),
  errorCount: msgs.length, fatalErrorCount: 0, warningCount: 0 })), null, 2) + "\n";
const SARIF = (rules, results = []) => JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "ESLint", rules: rules.map((id) => ({ id })) } },
  results: results.map(([ruleId, uri, line]) => ({ ruleId, level: "error", message: { text: "m" }, locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: line } } }] })) }] }, null, 2) + "\n";
const BASE = {
  "junit-committable/junit.xml": JUNIT([["a case", null], ["b case", null]]),
  "coverage-committable/lcov.info": LCOV([["src/core/domain/guard.ts", 3], ["src/adapters/x.ts", 1]]),
  "lint-committable/eslint.json": ESLINT([["src/adapters/x.ts"], ["src/core/domain/guard.ts"]]),
  "lint-committable/eslint.sarif": SARIF(["no-eval", "no-restricted-imports"]),
};

/** A package holding reports.mjs and fake generators; `committed` is reports/, `fresh` what the fakes write. */
function freshCheck(fresh, { committed = BASE, exits = {} } = {}) {
  const dir = tmp("rw-reports-fresh-");
  mkdirSync(join(dir, "scripts"));
  cpSync(join(CODE, "scripts", "reports.mjs"), join(dir, "scripts", "reports.mjs"));
  const fakes = join(dir, "fakes");
  for (const gen of ["junit-committable", "coverage-committable", "lint-committable"]) {
    writeFileSync(join(dir, "scripts", `${gen}.mjs`), FAKE);
    mkdirSync(join(fakes, gen, "out"), { recursive: true });
    if (exits[gen] !== undefined) writeFileSync(join(fakes, gen, "exit"), String(exits[gen]));
  }
  mkdirSync(join(dir, "reports"));
  for (const [key, body] of Object.entries(committed)) writeFileSync(join(dir, "reports", key.split("/")[1]), body);
  for (const [key, body] of Object.entries(fresh)) if (body !== undefined) writeFileSync(join(fakes, ...key.split("/").map((p, i) => (i === 0 ? join(p, "out") : p))), body);
  const r = spawnSync(process.execPath, [join(dir, "scripts", "reports.mjs"), "--check"], { cwd: dir, encoding: "utf8", env: { ...ENV, FAKE_DIR: fakes } });
  const after = Object.fromEntries(Object.keys(committed).map((k) => [k, readFileSync(join(dir, "reports", k.split("/")[1]), "utf8")]));
  return { ...r, untouched: JSON.stringify(after) === JSON.stringify(committed) };
}

test("4. the same reports, written in another order and with other hit counts, are fresh — bytes are not compared", () => {
  const r = freshCheck({
    "junit-committable/junit.xml": JUNIT([["b case", null], ["a case", null]]),
    "coverage-committable/lcov.info": LCOV([["src/adapters/x.ts", 7], ["src/core/domain/guard.ts", 11]]),
    "lint-committable/eslint.json": ESLINT([["src/core/domain/guard.ts"], ["src/adapters/x.ts"]]),
    "lint-committable/eslint.sarif": SARIF(["no-restricted-imports", "no-eval"]),
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /the 4 committed report\(s\) record what this tree produces/);
  assert.ok(r.untouched, "the check never writes reports/");
});

test("4. a hand-written lint report naming one file is not the report this tree produces", () => {
  const r = freshCheck(BASE, { committed: { ...BASE, "lint-committable/eslint.json": '[{"filePath":"src/core/domain/guard.ts","messages":[],"errorCount":0,"warningCount":0}]' } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /reports\/eslint\.json is not the report this tree produces/);
  assert.match(r.stderr, /produced by this tree, not in the committed report \(1\):\n\s+\["src\/adapters\/x\.ts",0,0,\[\]\]/,
    "the census differs: the tree lints two files, the forgery names one, and the one it leaves out is named");
});

test("4. each kind of difference is refused and named: a finding, a file nothing executed, a rule gone, a case gone or red", () => {
  const cases = [
    ["lint finding", { "lint-committable/eslint.json": ESLINT([["src/adapters/x.ts"], ["src/core/domain/guard.ts", [["no-restricted-imports", 3]]]]) }, /eslint\.json is not the report/],
    ["sarif result", { "lint-committable/eslint.sarif": SARIF(["no-eval", "no-restricted-imports"], [["no-eval", "src/core/application/autopilot.ts", 12]]) }, /\["result","no-eval","error","src\/core\/application\/autopilot\.ts",12\]/],
    ["rule switched off", { "lint-committable/eslint.sarif": SARIF(["no-eval"]) }, /\["rule in force","no-restricted-imports"\]/],
    ["nothing executed a file", { "coverage-committable/lcov.info": LCOV([["src/core/domain/guard.ts", 0], ["src/adapters/x.ts", 1]]) }, /\["src\/core\/domain\/guard\.ts","never executed"\]/],
    ["a file no longer measured", { "coverage-committable/lcov.info": LCOV([["src/adapters/x.ts", 1]]) }, /\["src\/core\/domain\/guard\.ts","exercised"\]/],
    ["a case gone", { "junit-committable/junit.xml": JUNIT([["a case", null]]) }, /"b case","passed"/],
    ["a case red", { "junit-committable/junit.xml": JUNIT([["a case", null], ["b case", "<failure message=\"x\"/>"]]) }, /"b case","failure"/],
  ];
  for (const [label, change, named] of cases) {
    const r = freshCheck({ ...BASE, ...change });
    assert.equal(r.status, 1, `${label}: refused`);
    assert.match(r.stderr, named, `${label}: the difference is named\n${r.stderr}`);
    assert.ok(r.untouched, `${label}: reports/ untouched`);
  }
});

test("4. a tool that is not green fails the check, and a report the tree did not produce or nobody committed is named", () => {
  const red = freshCheck(BASE, { exits: { "lint-committable": 1 } });
  assert.equal(red.status, 1);
  assert.match(red.stderr, /lint \(ESLint, SARIF\): the tool is not green \(exit 1\)/);
  const none = freshCheck({ ...BASE, "coverage-committable/lcov.info": undefined });
  assert.equal(none.status, 1);
  const uncommitted = { ...BASE };
  delete uncommitted["junit-committable/junit.xml"];
  const missing = freshCheck(BASE, { committed: uncommitted });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /reports\/junit\.xml is not committed/);
  const crashed = freshCheck(BASE, { exits: { "junit-committable": 2 } });
  assert.equal(crashed.status, 2, "a tool that could not run is exit 2, never read as a stale report");
});

// ── 5. the CI the product ships runs the regeneration before the gate ───────────────────────────────

test("5. the adapter samples, the Action and the GitLab template run the gate with --hooks by default", () => {
  const gh = readFileSync(join(ROOT, "templates", "adapters", "github-actions.yml"), "utf8");
  assert.match(gh, /run: npx --yes runward@\{\{RUNWARD_VERSION\}\} check --strict --hooks\n/);
  const glSample = yaml.load(readFileSync(join(ROOT, "templates", "adapters", "gitlab-ci.yml"), "utf8"))["runward-gate"].script.join("\n");
  assert.match(glSample, /check --strict --hooks \|\| code=\$\?/, "the gate run of the GitLab sample carries --hooks");
  const commands = glSample.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  assert.equal((commands.match(/--hooks/g) ?? []).length, 1, "only the gate run: the runs that write the reports read the same tree");
  const action = yaml.load(readFileSync(join(ROOT, "action.yml"), "utf8"));
  assert.equal(action.inputs.hooks.default, "true");
  assert.match(action.runs.steps[0].run, /\[ "\$RUNWARD_HOOKS" = "true" \] && hflag="--hooks"/);
  const [spec] = yaml.loadAll(readFileSync(join(ROOT, "templates", "ci", "gitlab", "runward-gate.yml"), "utf8"));
  assert.equal(spec.spec.inputs.hooks.default, true);
});
