// ADR-0120 R2, its acceptance, and the pieces it rests on (ADR-0119 decision 2): the coverage and the
// mutation of the cited lines, JavaScript and TypeScript first.
//
//   - the mutator changes one operator at a time, in code only, on the cited lines only;
//   - the cited lines are runward's to say (src/lib/mutation-targets.ts): a symbol's declaration to the end
//     of its block, a line, else the file; runward-run mutates those and records them, and a Statement that
//     records other ones binds nothing for the row;
//   - a mutant is killed through a failed assertion, through an error, or survives, as the runner tells;
//   - R2's acceptance, on the laboratory with the shipped example's run policy: every assertion of the
//     example's tests replaced by `assert.ok(true)` is refused at `attested` on every row citing that file,
//     and the original tests are accepted.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { check, checkJson, countedEnvelope, makeLab, mutationPolicy, runLab, runModule, weakenAssertions } from "../support/run-lab.js";
import { MUTATOR_LANGUAGES, citedLines, mutationOutcome, symbolRange } from "../../dist/lib/mutation-targets.js";

const POSIX = process.platform !== "win32";
const skip = POSIX ? false : "runward-run drives a Linux container runtime; its fake runtime is a POSIX executable";
const { mutantsOf, applyMutant, LANGUAGES, MUTATOR } = await runModule("mutate.js");
const { caseOutcomes, classify } = await runModule("cases.js");
const { readPolicy } = await runModule("policy.js");
const REPORTS = join("code", "reports");
const TESTS = join("code", "test", "triage.test.ts");

const SOURCE = [
  'import { x } from "./a.js";',
  "const re = /a+b/g; // a < b && c",
  "export function f(a, b) {",
  "  if (a === b && !flag) {",
  '    return a + b > 2 ? "yes" : `no`;',
  "  }",
  "  const t: Array<string> = [];",
  "  return value!.length - 1;",
  "}",
].join("\n");

test("the mutator changes one operator at a time, in code only, on the cited lines only", () => {
  const all = mutantsOf(SOURCE, 1, 9);
  const on = (line) => all.filter((m) => m.line === line).map((m) => `${m.kind} ${m.original.length > 20 ? "…" : m.original}→${m.replacement}`);
  assert.deepEqual(on(1), [], "a module specifier is never changed");
  assert.deepEqual(on(2), [], "nothing in a regular expression or a comment");
  assert.deepEqual(on(3), ["block …→{}"]);
  assert.deepEqual(on(4), ["conditional a === b && !flag→true", "conditional a === b && !flag→false", "equality ===→!==", "logical &&→||", "negation !→", "block …→{}"]);
  assert.deepEqual(on(5), ["arithmetic +→-", "relational >→<=", 'string "yes"→""', "string `no`→``"]);
  assert.deepEqual(on(7), [], "a TypeScript generic is not a comparison");
  assert.deepEqual(on(8), ["arithmetic -→+"], "a non-null assertion (`value!`) is not a negation");
  assert.deepEqual(mutantsOf(SOURCE, 4, 4).map((m) => m.line), Array(6).fill(4), "only the cited lines");
  for (const m of all) {
    const mutated = applyMutant(SOURCE, m);
    assert.equal(mutated.slice(0, m.start), SOURCE.slice(0, m.start));
    assert.equal(mutated.slice(m.start + m.replacement.length), SOURCE.slice(m.end), "one change, and nothing else");
  }
  assert.deepEqual(mutantsOf('"use strict";\nconst o = { "key": 1, b: "v" };\nrequire("fs");\n', 1, 3).map((m) => m.original), ['"v"'], "never a directive, an object key or a module specifier");
  assert.equal(MUTATOR, "runward-run/js-ts/1");
  assert.deepEqual({ ...LANGUAGES }, { ...MUTATOR_LANGUAGES }, "runward and runward-run agree on the languages the mutator serves");
});

test("the cited lines are runward's: a symbol's declaration to the end of its block, a line, else the file", () => {
  const ts = [
    "export interface Port {",          // 1
    "  run(x: string): Promise<void>;", // 2
    "}",                                // 3
    "export const half = (n: number): { v: number } => {", // 4
    '  const s = "}";',                 // 5
    "  return { v: n / 2 };",           // 6
    "};",                               // 7
    "export class Adapter implements Port {", // 8
    "  async run(x: string): Promise<void> {", // 9
    "    if (!x) throw new Error(`no ${x}`);", // 10
    "  }",                              // 11
    "}",                                // 12
    "const LIMIT = 3;",                 // 13
  ].join("\n");
  assert.deepEqual(symbolRange(ts, "Port"), { from: 1, to: 3 });
  assert.deepEqual(symbolRange(ts, "half"), { from: 4, to: 7 }, "a return-type literal is followed by the body; a brace in a string closes nothing");
  assert.deepEqual(symbolRange(ts, "Adapter"), { from: 8, to: 12 });
  assert.deepEqual(symbolRange(ts, "LIMIT"), { from: 13, to: 13 });
  assert.equal(symbolRange(ts, "absent"), null);
  assert.deepEqual(citedLines(ts, { line: 10 }), { from: 10, to: 10 });
  assert.deepEqual(citedLines(ts, {}), { from: 1, to: 13 });
  assert.equal(citedLines(ts, { line: 99 }), null);
});

test("a cited case reads as the runner tells it: a failed assertion, another error, a failure with no class, skipped, absent", () => {
  const node = (cause) => `<failure type="testCodeFailure" message="m">\n[Error [ERR_TEST_FAILURE]: m] {\n  code: 'ERR_TEST_FAILURE',\n  failureType: 'testCodeFailure',\n  cause: ${cause}\n}\n</failure>`;
  assert.equal(classify(node("AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:")), "assertion");
  assert.equal(classify(node("TypeError: Cannot read properties of null (reading 'x')")), "error");
  assert.equal(classify(node("Error: boom")), "error");
  assert.equal(classify('<error message="x" type="Timeout"/>'), "error");
  assert.equal(classify('<failure message="expected 1">expected 1</failure>'), "failure", "no class the runner tells");
  assert.equal(classify("<skipped/>"), "skipped");
  const xml = `<testsuites><testcase name="a &amp; b" classname="s1"/><testcase name="a &amp; b" classname="s2">${node("AssertionError: x")}</testcase><testcase name="c"><skipped/></testcase></testsuites>`;
  assert.deepEqual(caseOutcomes(xml, ["a & b", "s1::a & b", "c", "d"]), { "a & b": "assertion", "s1::a & b": "passed", c: "skipped", d: "absent" }, "a homonym reads its worst outcome; CLASS::NAME pins one");
});

test("a row's mutation fact: killed through an assertion, without the distinction, not killed, no mutant, a failing baseline, other lines", () => {
  const target = { deliverable: "floor.md", rule: "r", locations: [{ file: "src/a.ts", from: 10, to: 20 }], tests: [{ report: "reports/junit.xml", name: "t" }, { report: "reports/evals.xml", name: "e" }] };
  const m = (line, outcome, extra = {}) => ({ file: "src/a.ts", line, column: 1, operator: "equality: === → !==", cases: { t: outcome }, ...extra });
  const fact = (mutants, over = {}) => ({ targets: [target], leg: { junit: "reports/junit.xml" }, baseline: { cases: { t: "passed" } }, mutants, ...over });
  const read = (f) => mutationOutcome(target, f, "code/reports/runward-run.dsse.json");
  assert.deepEqual([read(fact([m(12, "assertion"), m(13, "passed")])).state, read(fact([m(12, "assertion"), m(13, "passed")])).met], ["killed", true]);
  assert.deepEqual(read(fact([m(12, "assertion"), m(13, "passed")])).survived, [{ file: "src/a.ts", line: 13, column: 1, operator: "equality: === → !==" }], "the survivors are listed, never summed into a score");
  const errors = read(fact([m(12, "error"), m(14, "absent"), m(15, "passed", { timedOut: true })]));
  assert.deepEqual([errors.state, errors.met, errors.killed], ["not-killed", false, { assertion: 0, error: 2, timeout: 1, indistinct: 0 }]);
  assert.match(errors.why, /^its cited tests kill no mutant of its cited lines through a failed assertion/);
  assert.deepEqual([read(fact([m(12, "failure")])).state, read(fact([m(12, "failure")])).met], ["killed-indistinct", true]);
  assert.match(read(fact([m(12, "failure")])).why, /held to « at least one mutant of its cited lines killed »/);
  assert.deepEqual([read(fact([m(30, "assertion")])).state, read(fact([m(30, "assertion")])).met], ["no-mutant", false], "a kill outside the cited lines is not one of them");
  assert.equal(read(fact([m(12, "assertion")], { baseline: { cases: { t: "error" } } })).state, "baseline-failed");
  assert.equal(read(fact([m(12, "assertion")], { targets: [{ ...target, locations: [{ file: "src/a.ts", from: 10, to: 21 }] }] })).state, "mismatch");
  assert.equal(read(fact([m(12, "assertion")], { targets: [{ ...target, tests: [{ report: "reports/junit.xml", name: "another" }] }] })).state, "mismatch");
  assert.equal(read({}).state, "absent");
  // The leg runs the cases of its own JUnit report: a cited eval case is not its to read, and a row that
  // cites none of its cases has no mutation fact from it.
  assert.equal(read(fact([m(12, "assertion")])).state, "killed", "the eval case, absent from the leg's report, holds nothing");
  assert.match(read(fact([m(12, "assertion")], { leg: { junit: "reports/other.xml" } })).why, /runs the cases of reports\/other\.xml, and this row cites none of them/);
});

test("the run policy: the coverage and mutation legs are delivered, and so is the evals leg (R3)", () => {
  const base = mutationPolicy();
  const p = readPolicy(base);
  const leg = p.legs.find((l) => l.leg === "mutation");
  assert.deepEqual([leg.junit, leg.timeoutSeconds, leg.maxMutantsPerLocation, leg.reports], ["code/reports/junit.xml", 60, 8, []]);
  assert.equal(readPolicy({ ...base, legs: [...base.legs.slice(0, -1), { ...base.legs.at(-1), timeoutSeconds: undefined, maxMutantsPerLocation: undefined }] }).legs.at(-1).maxMutantsPerLocation, 40, "the default bound of one cited location");
  const kind = (doc) => { try { readPolicy(doc); return "ok"; } catch (e) { return e.kind; } };
  assert.equal(kind({ ...base, legs: [...base.legs, { ...base.legs.at(-1) }] }), "usage", "one mutation leg per run");
  assert.equal(kind({ ...base, legs: [{ ...base.legs.at(-1), reports: [{ path: "code/reports/m.xml", nature: "junit" }] }] }), "usage", "a mutation leg binds no report");
  assert.equal(kind({ ...base, legs: [base.legs.at(-1)] }), "usage", "a run with no report has nothing for its Statement to bind");
  assert.equal(kind({ ...base, legs: [...base.legs.slice(0, -1), { ...base.legs.at(-1), junit: "../x.xml" }] }), "usage");
  assert.equal(kind({ ...base, legs: [...base.legs.slice(0, -1), { ...base.legs.at(-1), maxMutantsPerLocation: 0 }] }), "usage");
  assert.equal(kind({ ...base, legs: [{ leg: "coverage", cwd: "code", command: ["node", "-e", "0"], reports: [{ path: "code/reports/junit.xml", nature: "junit" }] }] }), "usage", "a coverage leg writes a coverage report");
  assert.equal(kind({ ...base, legs: [{ leg: "evals", cwd: "code", command: ["node", "-e", "0"], reports: [{ path: "code/reports/e.json", nature: "junit" }] }] }), "ok");
});

// ── R2's acceptance, on the laboratory ──────────────────────────────────────────────────────────────

let base, original, weakened, runs = {};
const treeHash = (dir) => {
  const h = createHash("sha256");
  const walk = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else h.update(`${p.slice(dir.length)}\0`).update(readFileSync(p)); } };
  walk(join(dir, "code", "src"));
  return h.digest("hex");
};
before(async () => {
  if (!POSIX) return;
  base = mkdtempSync(join(tmpdir(), "rw-run-mutation-"));
  original = makeLab(join(base, "original"));
  weakened = join(base, "weakened");
  cpSync(original, weakened, { recursive: true });
  assert.equal(await weakenAssertions(join(weakened, TESTS)), 42, "every assertion of the example's tests, replaced");
  for (const [name, tree] of [["original", original], ["weakened", weakened]]) {
    const wd = join(base, `run-${name}`);
    mkdirSync(wd);
    const sourcesBefore = treeHash(tree);
    const r = runLab(wd, tree, { policy: mutationPolicy() });
    assert.equal(r.status, 0, r.stderr.slice(-2000));
    assert.equal(treeHash(tree), sourcesBefore, "the mutants are written into the copy, never into the judged tree");
    cpSync(r.out, tree, { recursive: true });
    const st = readFileSync(join(tree, REPORTS, "runward-run.intoto.json"));
    writeFileSync(join(tree, REPORTS, "runward-run.dsse.json"), countedEnvelope(st));
    runs[name] = { ...r, statement: JSON.parse(st) };
  }
});
after(() => { if (base) rmSync(base, { recursive: true, force: true }); });

const targetRows = (j) => j.levels.execution.mutationTargets.map((t) => t.rule);

test("R2: the weakened-assertion sabotage is refused at attested on every row citing the weakened file, and the original tests are accepted", { skip }, () => {
  const ok = checkJson(original, "--require", "attested");
  assert.equal(ok.exitCode, 0, JSON.stringify(ok.levels.below, null, 1));
  const rows = [...ok.levels.rows.attested, ...ok.levels.rows["re-derived"]].filter((r) => r.mutation);
  assert.equal(rows.length, 8, "every row that cites a code location and a test carries the mutation of its cited lines");
  for (const r of rows) assert.deepEqual([r.rule, r.level, r.mutation.state], [r.rule, "attested", "killed"]);
  const weak = checkJson(weakened, "--require", "attested");
  assert.equal(weak.exitCode, 5, "the sabotage reaches no row's attested");
  assert.equal(weak.verdict, "level-not-met");
  const refused = weak.levels.below.filter((b) => b.holds.some((h) => /^mutation: its cited tests kill no mutant of its cited lines through a failed assertion/.test(h)));
  assert.deepEqual(refused.map((b) => b.rule).sort(), targetRows(weak).sort(), "every row whose cited tests the sabotage weakened, named with the mutation fact that holds it");
  assert.equal(weak.levels.below.length, refused.length, "and nothing else holds the run: its reports are bound and signed, its JUnit is green");
  for (const b of refused) assert.match(b.holds.join("; "), /\d+ mutant\(s\): 0 killed through a failed assertion/);
  // The same verdict, on the terminal.
  const text = check(weakened, "--require", "attested").stdout;
  assert.match(text, /mutation: its cited tests kill no mutant of its cited lines through a failed assertion/);
  assert.match(text, /of 8 row\(s\) that cite a code location and a test, 0 with a mutant killed through a failed assertion, 8 below attested for it/);
});

test("R2: the run Statement records the baseline, each cited location with its candidates and its bound, each mutant with every cited case, and the coverage of the cited lines", { skip }, () => {
  const p = runs.original.statement.predicate;
  assert.deepEqual(p.legs.map((l) => l.leg), ["tests", "coverage", "reports", "mutation"], "the mutation leg runs last");
  const m = p.mutation;
  assert.equal(m.mutator, "runward-run/js-ts/1");
  assert.ok(Object.values(m.baseline.cases).every((x) => x === "passed"), "the cited cases pass on the unmutated copy");
  assert.equal(m.targets.length, 8);
  const capped = m.locations.filter((l) => l.candidates > l.mutants);
  assert.ok(capped.length > 0 && capped.every((l) => l.mutants === 8), "a capped location says how many mutants it had");
  assert.equal(m.mutants.length, m.locations.reduce((n, l) => n + l.mutants, 0));
  const cases = [...new Set(m.targets.flatMap((t) => t.tests.filter((x) => x.report === "code/reports/junit.xml").map((x) => x.name)))].sort();
  assert.ok(m.targets.every((t) => t.tests.every((x) => x.report === "code/reports/junit.xml")), "each cited case with its report");
  for (const x of m.mutants) assert.deepEqual(Object.keys(x.cases).sort(), cases, "every cited case of the leg's report, for every mutant");
  const cov = p.coverage.targets.find((t) => t.rule === "frontier-deterministic-boundary").locations[0];
  assert.deepEqual([cov.file, cov.instrumented > 0, cov.executed > 0], ["code/src/core/domain/guard.ts", true, true], "the cited lines are executed by the suite");
  const row = checkJson(original, "--require", "attested").levels.rows.attested.find((r) => r.rule === "frontier-deterministic-boundary");
  assert.deepEqual(row.coverage.locations[0].executed, cov.executed, "the row reads its coverage, which sets no level");
  assert.match(`${runs.original.stdout}${runs.original.stderr}`, /mutation leg: \d+ mutant\(s\) of \d+ cited location\(s\), [\d.]+ s of wall clock/);
});

test("R2: a Statement that records other cited lines, an unsigned one, a run with no mutation leg: each leaves its rows below attested, named", { skip }, () => {
  const tampered = mkdtempSync(join(base, "tampered-"));
  cpSync(original, tampered, { recursive: true });
  const st = structuredClone(runs.original.statement);
  st.predicate.mutation.targets[0].locations[0].to += 1;
  const bytes = `${JSON.stringify(st, null, 2)}\n`;
  writeFileSync(join(tampered, REPORTS, "runward-run.intoto.json"), bytes);
  writeFileSync(join(tampered, REPORTS, "runward-run.dsse.json"), countedEnvelope(Buffer.from(bytes)));
  const j = checkJson(tampered, "--require", "attested");
  const first = st.predicate.mutation.targets[0].rule;
  assert.match(j.levels.below.find((b) => b.rule === first).holds.join("; "), /mutation: the run Statement code\/reports\/runward-run\.dsse\.json records other cited lines or cited tests for this row than this tree implies/);

  const unsigned = mkdtempSync(join(base, "unsigned-"));
  cpSync(original, unsigned, { recursive: true });
  rmSync(join(unsigned, REPORTS, "runward-run.dsse.json"));
  const u = checkJson(unsigned, "--require", "attested");
  assert.equal(u.exitCode, 5);
  const row = u.levels.rows["re-derived"].find((r) => r.rule === first);
  assert.deepEqual([row.mutation.state, row.mutation.met], ["unsigned", false]);

  // The R1 laboratory, with no mutation leg: its Statement is the R1 Statement, byte for byte in shape.
  const r1 = mkdtempSync(join(base, "r1-"));
  const tree = makeLab(join(r1, "lab"));
  const r = runLab(r1, tree);
  assert.equal(r.status, 0, r.stderr);
  const plain = JSON.parse(readFileSync(join(r.out, REPORTS, "runward-run.intoto.json"), "utf8"));
  assert.equal("mutation" in plain.predicate, false);
  assert.equal("coverage" in plain.predicate, false, "a run with neither leg keeps the Statement it had");
  cpSync(r.out, tree, { recursive: true });
  writeFileSync(join(tree, REPORTS, "runward-run.dsse.json"), countedEnvelope(readFileSync(join(tree, REPORTS, "runward-run.intoto.json"))));
  const n = checkJson(tree, "--require", "attested");
  assert.equal(n.exitCode, 5);
  assert.match(n.levels.execution.mutation, /no signed run Statement bound here carries the mutation of their cited lines/);
  assert.ok(n.levels.below.every((b) => b.holds.some((h) => /^mutation: no run Statement beside its cited reports carries the mutation of its cited lines/.test(h))));
});

test("R2: a row whose cited code is in a language runward-run has no mutator for reaches attested without the mutation fact, and says so", () => {
  const d = mkdtempSync(join(tmpdir(), "rw-run-nomutator-"));
  try {
    const lab = makeLab(join(d, "lab"));
    mkdirSync(join(lab, "code", "tools"), { recursive: true });
    writeFileSync(join(lab, "code", "tools", "journal.py"), "def append(log, entry):\n    log.append(dict(entry))\n");
    const floor = join(lab, "runward", "floor.md");
    writeFileSync(floor, readFileSync(floor, "utf8").replace("| state-event-sourcing | applied | file:code/src/adapters/in-memory-triage-log.adapter.ts;", "| state-event-sourcing | applied | file:code/tools/journal.py#append;"));
    const j = checkJson(lab, "--require", "attested");
    const row = [...j.levels.rows["re-derived"], ...j.levels.rows.attested].find((r) => r.rule === "state-event-sourcing");
    assert.deepEqual([row.mutation.state, row.mutation.met, row.mutation.languages], ["no-mutator", true, ["Python"]]);
    assert.match(row.mutation.why, /runward-run has no mutator for Python: the row reaches attested without the mutation fact/);
    assert.equal(j.levels.execution.mutationTargets.some((t) => t.rule === "state-event-sourcing"), false, "no target is published for it");
    assert.match(j.levels.execution.mutation, /1 row\(s\) cite code in a language runward-run has no mutator for \(Python\), and reach attested without it/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
