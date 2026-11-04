// ADR-0104: the mutation ratchet's chunk plan is cut from measured cost, and the plan input can
// never change what is measured.
//
// The plan job of .github/workflows/mutation-ratchet.yml runs scripts/mutation-plan.mjs. What the
// record (docs/compliance/mutation-chunk-costs.json) decides is WHERE each module is cut and in WHICH
// ORDER the chunks run; what it must never decide is WHETHER a line is measured. So the first cases
// here are about coverage, with a positive control that proves the checker sees a dropped range, and
// the others hold the planner to its contract: predicted time under the target, longest first,
// deterministic, complete when the record is stale or absent, and the same `chunks=`/`modules=`
// output the ratchet job counts against.
//
// Every case runs against a throwaway tree; none reads this repository's dist/ or its record, so the
// suite never reddens because a module grew (ADR-0046 decision 3: not a pull-request gate).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { plan, assertCovers, cutModule, orderLongestFirst, lineCount, predict, recordModule, buildRecord, serializeRecord, DEFAULT_MODEL, MATRIX_LIMIT } from "../../scripts/mutation-plan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, "scripts", "mutation-plan.mjs");

const MODEL = { baseSeconds: 600, perKilledSeconds: 10, perSurvivorSeconds: 150 };
const config = { mutate: ["dist/lib/alpha.js", "dist/lib/beta.js:1-40", "dist/lib/gamma.js"] };
/** A built file of `n` lines as the workflow counts them (`split("\n").length`). */
const built = (n) => "x\n".repeat(n - 1) + "x";
const sources = { "dist/lib/alpha.js": built(100), "dist/lib/beta.js": built(7), "dist/lib/gamma.js": built(40) };
const sourceOf = (f) => { if (!(f in sources)) throw new Error(`not built: ${f}`); return sources[f]; };

/** A record where alpha costs a lot on a few lines, beta is cheap, gamma is unknown. */
const record = {
  model: MODEL,
  run: "1",
  measuredAt: "2026-10-28",
  modules: {
    alpha: { lines: 100, mutants: [[5, 20, 10], [6, 0, 30], [50, 40, 0], [51, 0, 25], [99, 3, 3]] },
    beta: { lines: 7, mutants: [[2, 1, 0]] },
  },
};
const modules = [{ module: "alpha", lines: 100 }, { module: "beta", lines: 7 }, { module: "gamma", lines: 40 }];

test("plan: every line of every module is measured exactly once", () => {
  const r = plan({ config, sourceOf, record, targetMinutes: 90 });
  assert.doesNotThrow(() => assertCovers(r.chunks, modules));
  assert.deepEqual(r.modules, ["alpha", "beta", "gamma"], "the modules come out in configuration order, as the ratchet matrix reads them");
  for (const c of r.chunks) assert.ok(c.start >= 1 && c.end >= c.start, `${c.module} ${c.start}-${c.end}`);
});

test("plan (positive control): the coverage checker reddens on a dropped range, a gap, an overlap and a short last range", () => {
  const r = plan({ config, sourceOf, record, targetMinutes: 90 });
  const alpha = r.chunks.filter((c) => c.module === "alpha").sort((a, b) => a.start - b.start);
  assert.ok(alpha.length >= 3, `the control needs several alpha chunks, got ${alpha.length}`);
  const last = alpha[alpha.length - 1];
  // drop one range
  assert.throws(() => assertCovers(r.chunks.filter((c) => c !== alpha[1]), modules), /alpha: lines \d+-\d+ are not measured/);
  // gap of one line
  const gap = r.chunks.map((c) => (c === alpha[0] ? { ...c, end: c.end - 1 } : c));
  assert.throws(() => assertCovers(gap, modules), /not measured/);
  // overlap of one line
  const overlap = r.chunks.map((c) => (c === alpha[0] ? { ...c, end: c.end + 1 } : c));
  assert.throws(() => assertCovers(overlap, modules), /measured twice/);
  // a range past the end of the module
  const past = r.chunks.map((c) => (c === last ? { ...c, end: c.end + 1 } : c));
  assert.throws(() => assertCovers(past, modules), /alpha: range \d+-101 runs past the last line \(100\)/);
  // a module whose last range stops short
  assert.throws(() => assertCovers(r.chunks, [{ module: "beta", lines: 8 }]), /beta: lines 8-8 are not measured/);
  // a module with no chunk at all
  assert.throws(() => assertCovers(r.chunks, [{ module: "delta", lines: 3 }]), /delta: lines 1-3 are not measured/);
});

test("plan: a chunk's predicted time stays under the target, and a single line dearer than the target is still measured", () => {
  const r = plan({ config, sourceOf, record, targetMinutes: 90 });
  for (const c of r.chunks) {
    if (c.end > c.start) assert.ok(c.predicted <= 90 * 60, `${c.module} ${c.start}-${c.end} predicted ${c.predicted}s`);
  }
  // alpha line 6 alone costs 600 + 30 × 150 = 5100 s: over a 60-minute target, so it is a chunk of its own.
  const tight = plan({ config, sourceOf, record, targetMinutes: 60 });
  const six = tight.chunks.find((c) => c.module === "alpha" && c.start === 6);
  assert.ok(six, "line 6 starts a chunk");
  assert.equal(six.end, 6, "and that chunk holds only line 6");
  assert.equal(six.predicted, 5100);
  assert.doesNotThrow(() => assertCovers(tight.chunks, modules), "over target, never unmeasured");
});

test("plan: chunks come out longest first, ties broken by module then start", () => {
  const r = plan({ config, sourceOf, record, targetMinutes: 90 });
  for (let i = 1; i < r.chunks.length; i++) {
    const a = r.chunks[i - 1], b = r.chunks[i];
    assert.ok(a.predicted > b.predicted || (a.predicted === b.predicted && (a.module < b.module || (a.module === b.module && a.start < b.start))), `${i}: ${JSON.stringify([a, b])}`);
  }
  assert.equal(r.longestSeconds, r.chunks[0].predicted);
  const tie = orderLongestFirst([{ module: "b", start: 1, predicted: 5 }, { module: "a", start: 9, predicted: 5 }, { module: "a", start: 2, predicted: 5 }, { module: "c", start: 1, predicted: 7 }]);
  assert.deepEqual(tie.map((c) => `${c.module}:${c.start}`), ["c:1", "a:2", "a:9", "b:1"]);
});

test("plan: deterministic — the same inputs give the same plan, byte for byte", () => {
  const a = JSON.stringify(plan({ config, sourceOf, record, targetMinutes: 90 }));
  const b = JSON.stringify(plan({ config, sourceOf, record, targetMinutes: 90 }));
  assert.equal(a, b);
});

test("plan: a stale or absent record changes the cut, never the coverage", () => {
  // the module grew since the record: the new lines are cut on the module's mean line cost
  const grown = { ...sources, "dist/lib/alpha.js": built(140) };
  const r1 = plan({ config, sourceOf: (f) => grown[f], record, targetMinutes: 90 });
  assert.doesNotThrow(() => assertCovers(r1.chunks, [{ module: "alpha", lines: 140 }, { module: "beta", lines: 7 }, { module: "gamma", lines: 40 }]));
  assert.ok(r1.stale.some((s) => s.startsWith("alpha (recorded 100 lines, built 140)")), r1.stale.join("; "));
  // the module shrank
  const shrunk = { ...sources, "dist/lib/alpha.js": built(30) };
  const r2 = plan({ config, sourceOf: (f) => shrunk[f], record, targetMinutes: 90 });
  assert.doesNotThrow(() => assertCovers(r2.chunks, [{ module: "alpha", lines: 30 }, { module: "beta", lines: 7 }, { module: "gamma", lines: 40 }]));
  // a module the record never saw (gamma) is cut on the record's mean line, and said so
  const r0 = plan({ config, sourceOf, record, targetMinutes: 90 });
  assert.ok(r0.stale.some((s) => s === "gamma (no record)"), r0.stale.join("; "));
  // no record at all: every module is one or more chunks, still complete
  const r3 = plan({ config, sourceOf, record: null, targetMinutes: 90 });
  assert.doesNotThrow(() => assertCovers(r3.chunks, modules));
  assert.equal(r3.stale.length, 3);
});

test("plan: `--module` narrows to one module, an unknown module is an error, and the matrix limit is enforced", () => {
  const r = plan({ config, sourceOf, record, targetMinutes: 90, only: "beta" });
  assert.deepEqual(r.modules, ["beta"]);
  assert.deepEqual(r.chunks, [{ module: "beta", file: "dist/lib/beta.js", start: 1, end: 7, predicted: 610 }]);
  assert.throws(() => plan({ config, sourceOf, record, targetMinutes: 90, only: "nope" }), /nothing to measure/);
  // 300 lines each costing more than the target → 300 chunks > 256
  const dear = { model: MODEL, modules: { alpha: { lines: 100, mutants: Array.from({ length: 100 }, (_, i) => [i + 1, 0, 100]) } } };
  const big = { mutate: ["dist/lib/alpha.js", "dist/lib/alpha2.js", "dist/lib/alpha3.js"] };
  const src = (f) => built(100);
  assert.throws(() => plan({ config: big, sourceOf: src, record: { ...dear, modules: { alpha: dear.modules.alpha, alpha2: dear.modules.alpha, alpha3: dear.modules.alpha } }, targetMinutes: 1 }), new RegExp(`300 chunks exceed the matrix limit of ${MATRIX_LIMIT}`));
});

test("cutModule and predict: the arithmetic the plan rests on", () => {
  assert.equal(predict(MODEL, 2, 1), 600 + 20 + 150);
  const costs = [0, 100, 100, 100, 100, 100]; // 5 lines of 100 s each
  const chunks = cutModule({ module: "m", file: "f", lines: 5, costs, model: MODEL, targetSeconds: 850 });
  // 600 + 100 + 100 = 800 fits, a third line would make 900 > 850
  assert.deepEqual(chunks, [
    { module: "m", file: "f", start: 1, end: 2, predicted: 800 },
    { module: "m", file: "f", start: 3, end: 4, predicted: 800 },
    { module: "m", file: "f", start: 5, end: 5, predicted: 700 },
  ]);
  assert.equal(lineCount("a\nb\n"), 3, "the count the workflow has always used: a trailing newline counts a line");
});

test("record: a merged Stryker report becomes per-line killed and surviving counts, and round-trips through the file", () => {
  const report = {
    files: {
      "dist/lib/alpha.js": {
        source: "l1\nl2\nl3\n",
        mutants: [
          { status: "Killed", location: { start: { line: 1 } } },
          { status: "Timeout", location: { start: { line: 1 } } },
          { status: "Survived", location: { start: { line: 1 } } },
          { status: "NoCoverage", location: { start: { line: 3 } } },
          { status: "RuntimeError", location: { start: { line: 3 } } },
        ],
      },
      "test/unit/other.js": { source: "", mutants: [{ status: "Survived", location: { start: { line: 1 } } }] },
    },
  };
  assert.deepEqual(recordModule(report), { alpha: { lines: 4, mutants: [[1, 2, 1], [3, 1, 1]] } });
  const dir = mkdtempSync(join(tmpdir(), "rw-plan-"));
  try {
    mkdirSync(join(dir, "merged-alpha"));
    writeFileSync(join(dir, "merged-alpha", "alpha-merged.json"), JSON.stringify(report));
    const rec = buildRecord({ mergedDir: dir, run: 42, measuredAt: "2026-10-28" });
    assert.equal(rec.run, "42");
    assert.deepEqual(rec.model, DEFAULT_MODEL);
    const text = serializeRecord(rec);
    assert.deepEqual(JSON.parse(text), rec, "the compact serialization is the record");
    assert.throws(() => buildRecord({ mergedDir: join(dir, "nothing"), run: 1, measuredAt: "x" }), /no merged report/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("command line: the plan job's call writes chunks= and modules= to $GITHUB_OUTPUT and reports the count; --record writes the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-plan-cli-"));
  try {
    mkdirSync(join(dir, "dist", "lib"), { recursive: true });
    for (const [f, s] of Object.entries(sources)) writeFileSync(join(dir, f), s);
    writeFileSync(join(dir, "stryker.config.json"), JSON.stringify(config));
    mkdirSync(join(dir, "docs", "compliance"), { recursive: true });
    writeFileSync(join(dir, "docs/compliance/mutation-chunk-costs.json"), JSON.stringify(record));
    const out = join(dir, "gh-output");
    writeFileSync(out, "");
    const run = spawnSync(process.execPath, [SCRIPT, "--github-output", "--target", "90"], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: out } });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stderr, /3 module\(s\), \d+ chunk\(s\), target 90 min/);
    assert.match(run.stderr, /::warning::plan input stale for gamma \(no record\)/);
    const text = readFileSync(out, "utf8");
    const chunks = JSON.parse(/^chunks=(.*)$/m.exec(text)[1]);
    const mods = JSON.parse(/^modules=(.*)$/m.exec(text)[1]);
    assert.deepEqual(mods, ["alpha", "beta", "gamma"]);
    assert.deepEqual(chunks, plan({ config, sourceOf, record, targetMinutes: 90 }).chunks, "the file carries the same plan the library computes");
    for (const c of chunks) assert.deepEqual(Object.keys(c).sort(), ["end", "file", "module", "predicted", "start"], "the fields the matrix and the ratchet job read");

    // without --github-output the plan goes to stdout
    const plain = spawnSync(process.execPath, [SCRIPT, "--module", "beta"], { cwd: dir, encoding: "utf8" });
    assert.equal(plain.status, 0, plain.stderr);
    assert.deepEqual(JSON.parse(plain.stdout).map((c) => c.module), ["beta"]);

    // an unbuilt module is a refusal, never an empty plan
    rmSync(join(dir, "dist/lib/gamma.js"));
    const missing = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /perimeter names dist\/lib\/gamma\.js and it is not built/);

    // --record from a merged directory
    mkdirSync(join(dir, "merged", "merged-beta"), { recursive: true });
    writeFileSync(join(dir, "merged", "merged-beta", "beta-merged.json"), JSON.stringify({ files: { "dist/lib/beta.js": { source: built(7), mutants: [{ status: "Survived", location: { start: { line: 4 } } }] } } }));
    const rec = spawnSync(process.execPath, [SCRIPT, "--record", "--merged", "merged", "--run", "7", "--measured-at", "2026-11-03", "--out", "rec.json"], { cwd: dir, encoding: "utf8" });
    assert.equal(rec.status, 0, rec.stderr);
    const written = JSON.parse(readFileSync(join(dir, "rec.json"), "utf8"));
    assert.deepEqual(written.modules, { beta: { lines: 7, mutants: [[4, 0, 1]] } });
    assert.equal(written.run, "7");
    assert.ok(existsSync(join(dir, "rec.json")));
    const usage = spawnSync(process.execPath, [SCRIPT, "--record"], { cwd: dir, encoding: "utf8" });
    assert.equal(usage.status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("this repository: the committed record names every module of the perimeter, and the plan on it is complete", () => {
  // Reads the record and the configuration, not dist/: a module may have grown since the record
  // (the planner then warns and still covers it), which is exactly what must not redden a pull request.
  const rec = JSON.parse(readFileSync(join(ROOT, "docs/compliance/mutation-chunk-costs.json"), "utf8"));
  const cfg = JSON.parse(readFileSync(join(ROOT, "stryker.config.json"), "utf8"));
  const names = cfg.mutate.map((e) => e.replace(/:.*$/, "").replace(/^.*\//, "").replace(/\.js$/, ""));
  for (const m of names) assert.ok(rec.modules[m], `${m} is in the perimeter and not in the record — regenerate it with --record`);
  assert.match(rec.run, /^\d+$/);
  for (const k of ["baseSeconds", "perKilledSeconds", "perSurvivorSeconds"]) assert.ok(rec.model[k] > 0, k);
  const fromRecord = (f) => built(rec.modules[f.replace(/^.*\//, "").replace(/\.js$/, "")].lines);
  const r = plan({ config: cfg, sourceOf: fromRecord, record: rec });
  assert.doesNotThrow(() => assertCovers(r.chunks, names.map((m) => ({ module: m, lines: rec.modules[m].lines }))));
  assert.ok(r.chunks.length <= MATRIX_LIMIT);
  assert.equal(r.stale.length, 0, "measured on the record's own line counts, nothing is stale");
});
