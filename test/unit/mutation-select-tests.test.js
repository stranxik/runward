// ADR-0105: a survivor runs only the test files that execute its lines.
//
// Three scripts carry it: scripts/mutation-coverage-map.mjs (which test file executes which line of
// which perimeter module, subprocesses included), scripts/mutation-mutant-table.mjs (which line the
// mutant Stryker numbered N sits on, by running Stryker's own instrumenter), and
// scripts/mutation-select-tests.mjs (the covering files, or ALL on any doubt), read by
// scripts/mutation-testcmd.sh inside the sandbox.
//
// What these cases hold: the table numbers mutants as Stryker does (pinned on the 42 mutants of
// paths.js:1-60 from release run 40684642130, while that build is the one in dist/); every doubt
// the selector can have answers ALL, and the test command then runs the whole ordered suite; a
// selected set is run cheap-first and exits at the first failure; and the positive control, on the
// real tree: the ObjectLiteral mutant on check-contract.js L41, killed on 2026-10-28 by the release
// ratchet, is executed by exactly one unit test file of its module's neighbourhood, the 24-second
// verdict-witness.test.js, and the map hands the selector that file and no other.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Instrumenter } from "@stryker-mutator/instrumenter";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TABLE = join(ROOT, "scripts", "mutation-mutant-table.mjs");
const SELECT = join(ROOT, "scripts", "mutation-select-tests.mjs");
const MAP = join(ROOT, "scripts", "mutation-coverage-map.mjs");
const TESTCMD = join(ROOT, "scripts", "mutation-testcmd.sh");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const run = (cmd, args, { cwd, env = {} }) => {
  // Never under this process's NODE_V8_COVERAGE (the map built by the positive control must read
  // its own, and a coverage run of the suite must not see the throwaway sandboxes), nor under its
  // NODE_TEST_CONTEXT (a nested `node --test` would otherwise skip its files as recursive).
  const { NODE_V8_COVERAGE: _c, NODE_TEST_CONTEXT: _t, ...clean } = process.env;
  return spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...clean, ...env } });
};

const ALPHA = [
  "export function alpha(x) {",
  '    return x > 1 ? "big" : "small";',
  "}",
  "export function beta() {",
  "    return [1, 2];",
  "}",
  "",
].join("\n");

const silent = { isDebugEnabled: () => false, debug() {}, info() {}, warn() {}, error() {}, trace() {}, fatal() {} };
/** What Stryker writes into its sandbox for `--mutate <file>:<start>-<end>`. */
async function instrumented(file, content, start, end) {
  const r = await new Instrumenter(silent).instrument(
    [{ name: file, content, mutate: [{ start: { line: start - 1, column: 0 }, end: { line: end - 1, column: Number.MAX_SAFE_INTEGER } }] }],
    { ignorers: [], excludedMutations: [], plugins: null });
  return { content: r.files[0].content, count: r.mutants.length };
}

test("the table numbers mutants in source order, from 0, within the range, and refuses a config whose mutator it would not mirror", () => {
  const root = mkdtempSync(join(tmpdir(), "rw-table-"));
  try {
    mkdirSync(join(root, "dist", "lib"), { recursive: true });
    writeFileSync(join(root, "dist", "lib", "alpha.js"), ALPHA);
    writeFileSync(join(root, "stryker.config.json"), JSON.stringify({ mutate: ["dist/lib/alpha.js"] }));
    let r = run(process.execPath, [TABLE, "--mutate", "dist/lib/alpha.js:1-3", "--out", "t.json"], { cwd: root });
    assert.equal(r.status, 0, r.stderr);
    const t = JSON.parse(readFileSync(join(root, "t.json"), "utf8"));
    assert.equal(t.file, "dist/lib/alpha.js");
    assert.equal(t.sha256, sha(ALPHA));
    assert.ok(t.mutants.length >= 3, `alpha L1-3 holds a conditional, a comparison and two strings: ${t.mutants.length}`);
    assert.deepEqual(t.mutants.map((m) => m.id), t.mutants.map((_, i) => String(i)));
    for (const m of t.mutants) {
      assert.ok(m.line >= 1 && m.line <= 3, `${JSON.stringify(m)} is outside 1-3`);
      assert.ok(m.endLine >= m.line);
    }
    const lines = t.mutants.map((m) => m.line);
    assert.deepEqual(lines, [...lines].sort((a, b) => a - b), "ids follow source order");
    // The whole file: beta's array joins, after alpha's mutants.
    r = run(process.execPath, [TABLE, "--mutate", "dist/lib/alpha.js", "--out", "w.json"], { cwd: root });
    const w = JSON.parse(readFileSync(join(root, "w.json"), "utf8"));
    assert.ok(w.mutants.length > t.mutants.length);
    assert.ok(w.mutants.some((m) => m.mutator === "ArrayDeclaration" && m.line === 5));
    // A `mutator` in the config would change the numbering Stryker produces; the table says so.
    writeFileSync(join(root, "stryker.config.json"), JSON.stringify({ mutate: ["dist/lib/alpha.js"], mutator: { excludedMutations: ["StringLiteral"] } }));
    r = run(process.execPath, [TABLE, "--mutate", "dist/lib/alpha.js", "--out", "x.json"], { cwd: root });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /mutator/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("this repository's stryker.config.json sets neither `mutator` nor `ignorers`, so the table mirrors its run", () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, "stryker.config.json"), "utf8"));
  assert.equal(cfg.mutator, undefined);
  assert.equal(cfg.ignorers, undefined);
});

// The 42 mutants of dist/lib/paths.js:1-60 as release run 40684642130 numbered and located them
// (chunk-paths--1/verified.json, embedded source sha256 6a7db905…). Checked whenever the built
// file is that one; a changed paths.js is reported as not pinned, not as a failure (the run
// measured other code, and ADR-0046 decision 3 keeps the mutation instrument off the PR path).
const PATHS_SHA = "6a7db9056ea63a28997aaf9efddc8f44ae8c24e4ca8b0e7456e68c643f305063";
const PATHS_RUN = ["0:9:9:ArrowFunction", "1:9:9:StringLiteral", "2:11:11:StringLiteral", "3:11:11:StringLiteral", "4:12:12:StringLiteral", "5:14:14:StringLiteral", "6:14:14:StringLiteral", "7:14:14:StringLiteral", "8:16:16:StringLiteral", "9:16:16:StringLiteral", "10:16:16:StringLiteral", "11:17:17:StringLiteral", "12:17:17:StringLiteral", "13:19:36:ObjectLiteral", "14:20:20:StringLiteral", "15:21:21:StringLiteral", "16:22:22:StringLiteral", "17:23:23:StringLiteral", "18:24:24:StringLiteral", "19:25:25:StringLiteral", "20:26:26:StringLiteral", "21:27:27:StringLiteral", "22:28:28:StringLiteral", "23:29:29:StringLiteral", "24:30:30:StringLiteral", "25:31:31:StringLiteral", "26:32:32:StringLiteral", "27:33:33:StringLiteral", "28:34:34:StringLiteral", "29:35:35:StringLiteral", "30:37:40:ArrayDeclaration", "31:38:38:StringLiteral", "32:38:38:StringLiteral", "33:38:38:StringLiteral", "34:38:38:StringLiteral", "35:38:38:StringLiteral", "36:39:39:StringLiteral", "37:39:39:StringLiteral", "38:39:39:StringLiteral", "39:39:39:StringLiteral", "40:39:39:StringLiteral", "41:39:39:StringLiteral"];

test("the table reproduces the numbering of release run 40684642130 on paths.js:1-60", (t) => {
  const built = join(ROOT, "dist", "lib", "paths.js");
  if (!existsSync(built)) return t.skip("no dist/lib/paths.js: npm run build first");
  if (sha(readFileSync(built, "utf8")) !== PATHS_SHA) {
    return t.skip("dist/lib/paths.js is not the build run 40684642130 measured; the pin does not apply");
  }
  const out = join(mkdtempSync(join(tmpdir(), "rw-table-paths-")), "t.json");
  try {
    const r = run(process.execPath, [TABLE, "--mutate", "dist/lib/paths.js:1-60", "--out", out], { cwd: ROOT });
    assert.equal(r.status, 0, r.stderr);
    const tbl = JSON.parse(readFileSync(out, "utf8"));
    assert.deepEqual(tbl.mutants.map((m) => `${m.id}:${m.line}:${m.endLine}:${m.mutator}`), PATHS_RUN);
  } finally { rmSync(dirname(out), { recursive: true, force: true }); }
});

/**
 * A sandbox as Stryker leaves it for `--mutate dist/lib/alpha.js:1-6`: the instrumented module,
 * three test files (b.test.js on the slow list, and it fails, as a test that catches the mutant
 * would), a cost file. Beside it, outside the tree, the map and the table the caller hands over.
 */
async function sandbox({ failing = ["b"] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "rw-select-"));
  const box = join(root, "sandbox");
  const aside = join(root, "aside");
  mkdirSync(join(box, "dist", "lib"), { recursive: true });
  mkdirSync(join(box, "test", "unit"), { recursive: true });
  mkdirSync(join(box, "scripts"), { recursive: true });
  mkdirSync(aside);
  const { content, count } = await instrumented(join(box, "dist", "lib", "alpha.js"), ALPHA, 1, 6);
  writeFileSync(join(box, "dist", "lib", "alpha.js"), content);
  for (const name of ["a", "b", "c"]) {
    const body = failing.includes(name)
      ? 'import { test } from "node:test"; test("catches the mutant", () => { throw new Error("killed"); });\n'
      : 'import { test } from "node:test"; test("sees nothing", () => {});\n';
    writeFileSync(join(box, "test", "unit", `${name}.test.js`), body);
  }
  writeFileSync(join(box, "test", "unit-cost.json"), JSON.stringify({
    totalSeconds: 30, slow: ["test/unit/b.test.js"],
    files: [{ file: "test/unit/a.test.js", seconds: 1 }, { file: "test/unit/b.test.js", seconds: 25 }, { file: "test/unit/c.test.js", seconds: 4 }],
  }));
  cpSync(SELECT, join(box, "scripts", "mutation-select-tests.mjs"));
  cpSync(TESTCMD, join(box, "scripts", "mutation-testcmd.sh"));
  chmodSync(join(box, "scripts", "mutation-testcmd.sh"), 0o755);
  // The table: as the real script writes it for this file and range (ids 0..count-1 in source
  // order); its lines are what the selector joins to the map.
  // The table script reads stryker.config.json from its cwd and hashes the PRISTINE file, as the
  // caller runs it before Stryker; the sandbox then holds the instrumented one.
  writeFileSync(join(box, "stryker.config.json"), JSON.stringify({ mutate: ["dist/lib/alpha.js"] }));
  writeFileSync(join(box, "dist", "lib", "alpha.js"), ALPHA);
  const r2 = run(process.execPath, [TABLE, "--mutate", "dist/lib/alpha.js:1-6", "--out", join(aside, "table.json")], { cwd: box });
  assert.equal(r2.status, 0, r2.stderr);
  writeFileSync(join(box, "dist", "lib", "alpha.js"), content);
  const table = JSON.parse(readFileSync(join(aside, "table.json"), "utf8"));
  assert.equal(table.mutants.length, count);
  assert.equal(table.sha256, sha(ALPHA));
  // Line 2 (alpha's body) is executed by a and b; line 5 (beta's body) by c alone; line 1 and 4
  // (the declarations) by every file that imports the module; line 3 and 6 by nobody.
  const map = {
    digests: { alpha: sha(ALPHA) },
    tests: [{ file: "test/unit/a.test.js" }, { file: "test/unit/b.test.js" }, { file: "test/unit/c.test.js" }],
    modules: { alpha: { lines: { 1: [0, 1, 2], 2: [0, 1], 4: [0, 1, 2], 5: [2] } } },
  };
  writeFileSync(join(aside, "map.json"), JSON.stringify(map));
  const env = { RUNWARD_MUTATION_MAP: join(aside, "map.json"), RUNWARD_MUTATION_TABLE: join(aside, "table.json") };
  const idOn = (line, mutator) => table.mutants.find((m) => m.line === line && (!mutator || m.mutator === mutator))?.id;
  return { root, box, aside, table, map, env, idOn };
}

test("the selector names the covering files, cheap line then expensive line, and ALL on every doubt", async () => {
  const s = await sandbox();
  try {
    const select = (env) => run(process.execPath, ["scripts/mutation-select-tests.mjs"], { cwd: s.box, env: { ...s.env, ...env } });
    // Mutant on line 2: a (cheap) and b (slow).
    let r = select({ __STRYKER_ACTIVE_MUTANT__: s.idOn(2, "ConditionalExpression") });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, "test/unit/a.test.js\ntest/unit/b.test.js\n");
    assert.match(r.stderr, /alpha L2 mutant \d+: 2 covering file\(s\), 26\.0 s of 30 s/);
    // Mutant on line 5: c alone, cheap.
    r = select({ __STRYKER_ACTIVE_MUTANT__: s.idOn(5, "ArrayDeclaration") });
    assert.equal(r.stdout, "test/unit/c.test.js\n\n");
    // Every doubt is ALL, and says which.
    const all = (env, why) => {
      const x = select(env);
      assert.equal(x.status, 0, x.stderr);
      assert.equal(x.stdout, "ALL\n", `${why}: ${x.stderr}`);
      assert.match(x.stderr, why);
    };
    all({ __STRYKER_ACTIVE_MUTANT__: "" }, /no active mutant/);
    all({ __STRYKER_ACTIVE_MUTANT__: "0", RUNWARD_MUTATION_MAP: "" }, /not set/);
    all({ __STRYKER_ACTIVE_MUTANT__: "0", RUNWARD_MUTATION_TABLE: join(s.aside, "none.json") }, /no table at/);
    all({ __STRYKER_ACTIVE_MUTANT__: "9999" }, /is not in the table|has no marker/);
    // A map measured on another build of the module.
    writeFileSync(join(s.aside, "other-map.json"), JSON.stringify({ ...s.map, digests: { alpha: sha(`${ALPHA}\n`) } }));
    all({ __STRYKER_ACTIVE_MUTANT__: "0", RUNWARD_MUTATION_MAP: join(s.aside, "other-map.json") }, /made on build .* and the map on/);
    // A sandbox file carrying other mutants than the table (a different range was instrumented).
    const narrower = await instrumented(join(s.box, "dist", "lib", "alpha.js"), ALPHA, 4, 6);
    const wide = readFileSync(join(s.box, "dist", "lib", "alpha.js"), "utf8");
    writeFileSync(join(s.box, "dist", "lib", "alpha.js"), narrower.content);
    all({ __STRYKER_ACTIVE_MUTANT__: "0" }, /carries \d+ mutant marker\(s\) and the table \d+/);
    writeFileSync(join(s.box, "dist", "lib", "alpha.js"), wide);
    // A line no test executes: line 3 is a closing brace with no mutant, so take a mutant and
    // empty its lines in the map.
    const blind = { ...s.map, modules: { alpha: { lines: { 1: [0] } } } };
    writeFileSync(join(s.aside, "blind-map.json"), JSON.stringify(blind));
    all({ __STRYKER_ACTIVE_MUTANT__: s.idOn(5, "ArrayDeclaration"), RUNWARD_MUTATION_MAP: join(s.aside, "blind-map.json") }, /no unit test executes these lines/);
    // A map naming a test file the sandbox does not hold.
    const missing = { ...s.map, tests: [{ file: "test/unit/a.test.js" }, { file: "test/unit/gone.test.js" }, { file: "test/unit/c.test.js" }] };
    writeFileSync(join(s.aside, "missing-map.json"), JSON.stringify(missing));
    all({ __STRYKER_ACTIVE_MUTANT__: s.idOn(2, "ConditionalExpression"), RUNWARD_MUTATION_MAP: join(s.aside, "missing-map.json") }, /not in the sandbox/);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test("the test command runs the selected files cheap-first and stops at the first failure; without a map it runs the whole suite", { skip: process.platform === "win32" ? "POSIX bash harness: the mutation ratchet runs on Linux runners only" : false }, async () => {
  const s = await sandbox();
  try {
    const cmd = (env) => run("/bin/bash", ["scripts/mutation-testcmd.sh"], { cwd: s.box, env: { ...s.env, ...env } });
    // Line 2: a passes, b (slow, selected) fails: killed, exit 1, and b ran.
    let r = cmd({ __STRYKER_ACTIVE_MUTANT__: s.idOn(2, "ConditionalExpression") });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /killed/);
    // Line 5: c alone, passes: a survivor, exit 0, and b never ran.
    r = cmd({ __STRYKER_ACTIVE_MUTANT__: s.idOn(5, "ArrayDeclaration") });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /killed/);
    assert.match(r.stderr, /1 covering file\(s\)/);
    // No map: the whole suite, in which b fails, so the same mutant is reported killed by the
    // tests that cannot see it. That is the fallback's cost and its direction: more tests, never fewer.
    r = cmd({ __STRYKER_ACTIVE_MUTANT__: s.idOn(5, "ArrayDeclaration"), RUNWARD_MUTATION_MAP: "" });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.doesNotMatch(r.stderr, /mutation-select-tests/);
    // A doubt (another build's map): ALL, said on stderr, and the whole suite runs.
    writeFileSync(join(s.aside, "other-map.json"), JSON.stringify({ ...s.map, digests: { alpha: "0".repeat(64) } }));
    r = cmd({ __STRYKER_ACTIVE_MUTANT__: s.idOn(5, "ArrayDeclaration"), RUNWARD_MUTATION_MAP: join(s.aside, "other-map.json") });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /running the whole suite/);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

// POSITIVE CONTROL, on the real tree. check-contract.js L41-43 (`--witness` beside `--freeze`) carries
// an ObjectLiteral mutant the release ratchet of 2026-10-28 killed (run 40684642130, chunk
// check-contract--1, id 12). The full map of 2026-11-03 found ONE unit test file in 211 executing
// those lines: test/unit/verdict-witness.test.js, the most expensive file of the suite (24.6 s),
// which spawns the CLI. Here the map is built for that file and the three check-contract files
// (cheap, and the ones RUNWARD_MUTATION_MODULE puts first), and the selector must hand over the
// witness file alone: the slow CLI-spawning file the old command reached only in its last stage.
test("positive control: the map selects the one slow CLI-spawning file that executes check-contract L41", async (t) => {
  const built = join(ROOT, "dist", "lib", "check-contract.js");
  if (!existsSync(built)) return t.skip("no dist/: npm run build first");
  const source = readFileSync(built, "utf8");
  const line = source.split("\n")[40] ?? "";
  if (!/opts\.witness !== undefined && opts\.freeze/.test(source.split("\n")[39] ?? "") || !/return \{/.test(line)) {
    return t.skip("check-contract.js L40-41 are no longer the `--witness` beside `--freeze` refusal; re-anchor this control");
  }
  const root = mkdtempSync(join(tmpdir(), "rw-control-"));
  try {
    const mapPath = join(root, "map.json");
    const tablePath = join(root, "table.json");
    let r = run(process.execPath, [MAP, "--only", "verdict-witness.test,check-contract", "--out", mapPath], { cwd: ROOT });
    assert.equal(r.status, 0, r.stderr);
    const map = JSON.parse(readFileSync(mapPath, "utf8"));
    assert.deepEqual(map.only, ["verdict-witness.test", "check-contract"]);
    assert.ok(map.tests.length >= 4, map.tests.map((x) => x.file).join(","));
    const witness = map.tests.findIndex((x) => x.file === "test/unit/verdict-witness.test.js");
    assert.ok(witness >= 0);
    assert.ok(map.tests[witness].spawnsCli, "the witness file spawns the CLI and its coverage came back");
    // The run's own chunk, lines 1-60: a range of the single line 41 would leave the mutant out,
    // since Stryker places a mutant only when its whole node lies inside the range (L41:16-43:10).
    r = run(process.execPath, [TABLE, "--mutate", "dist/lib/check-contract.js:1-60", "--out", tablePath], { cwd: ROOT });
    assert.equal(r.status, 0, r.stderr);
    const table = JSON.parse(readFileSync(tablePath, "utf8"));
    const mutant = table.mutants.find((m) => m.mutator === "ObjectLiteral" && m.line === 41);
    assert.ok(mutant, JSON.stringify(table.mutants));
    // The sandbox: the instrumented module, the test files by path, the cost file, the selector.
    const box = join(root, "sandbox");
    mkdirSync(join(box, "dist", "lib"), { recursive: true });
    mkdirSync(join(box, "test", "unit"), { recursive: true });
    mkdirSync(join(box, "scripts"), { recursive: true });
    writeFileSync(join(box, "dist", "lib", "check-contract.js"), (await instrumented(built, source, 1, 60)).content);
    for (const x of map.tests) writeFileSync(join(box, x.file), "");
    cpSync(join(ROOT, "test", "unit-cost.json"), join(box, "test", "unit-cost.json"));
    cpSync(SELECT, join(box, "scripts", "mutation-select-tests.mjs"));
    r = run(process.execPath, ["scripts/mutation-select-tests.mjs"], { cwd: box,
      env: { RUNWARD_MUTATION_MAP: mapPath, RUNWARD_MUTATION_TABLE: tablePath, __STRYKER_ACTIVE_MUTANT__: mutant.id } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, "\ntest/unit/verdict-witness.test.js\n", r.stderr);
    assert.match(r.stderr, /check-contract L41-43 mutant \d+: 1 covering file\(s\)/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
