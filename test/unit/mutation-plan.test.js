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
import { plan, placeAll, assertCovers, cutModule, orderLongestFirst, lineCount, lineCosts, predict, recordModule, buildRecord, serializeRecord, sha256, DEFAULT_MODEL, MATRIX_LIMIT, DEFAULT_MAX_MUTANTS } from "../../scripts/mutation-plan.mjs";

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
/** Where Stryker would place the mutants of each build (ADR-0131 B): gamma, which the record never saw, has one on every fourth line. */
const placements = { alpha: [5, 5, 6, 50, 51, 99], beta: [2], gamma: Array.from({ length: 10 }, (_, i) => 4 * i + 1) };

test("plan: every line of every module is measured exactly once", () => {
  const r = plan({ config, sourceOf, record, targetMinutes: 90, placements });
  assert.doesNotThrow(() => assertCovers(r.chunks, modules));
  assert.deepEqual(r.modules, ["alpha", "beta", "gamma"], "the modules come out in configuration order, as the ratchet matrix reads them");
  for (const c of r.chunks) assert.ok(c.start >= 1 && c.end >= c.start, `${c.module} ${c.start}-${c.end}`);
});

test("plan (positive control): the coverage checker reddens on a dropped range, a gap, an overlap and a short last range", () => {
  const r = plan({ config, sourceOf, record, targetMinutes: 90, placements });
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
  const r = plan({ config, sourceOf, record, targetMinutes: 90, placements });
  for (const c of r.chunks) {
    if (c.end > c.start) assert.ok(c.predicted <= 90 * 60, `${c.module} ${c.start}-${c.end} predicted ${c.predicted}s`);
  }
  // alpha line 6 alone costs 600 + 30 × 150 = 5100 s: over a 60-minute target, so it is a chunk of its own.
  const tight = plan({ config, sourceOf, record, targetMinutes: 60, placements });
  const six = tight.chunks.find((c) => c.module === "alpha" && c.start === 6);
  assert.ok(six, "line 6 starts a chunk");
  assert.equal(six.end, 6, "and that chunk holds only line 6");
  assert.equal(six.predicted, 5100);
  assert.doesNotThrow(() => assertCovers(tight.chunks, modules), "over target, never unmeasured");
});

test("plan: chunks come out longest first, ties broken by module then start", () => {
  const r = plan({ config, sourceOf, record, targetMinutes: 90, placements });
  for (let i = 1; i < r.chunks.length; i++) {
    const a = r.chunks[i - 1], b = r.chunks[i];
    assert.ok(a.predicted > b.predicted || (a.predicted === b.predicted && (a.module < b.module || (a.module === b.module && a.start < b.start))), `${i}: ${JSON.stringify([a, b])}`);
  }
  assert.equal(r.longestSeconds, r.chunks[0].predicted);
  const tie = orderLongestFirst([{ module: "b", start: 1, predicted: 5 }, { module: "a", start: 9, predicted: 5 }, { module: "a", start: 2, predicted: 5 }, { module: "c", start: 1, predicted: 7 }]);
  assert.deepEqual(tie.map((c) => `${c.module}:${c.start}`), ["c:1", "a:2", "a:9", "b:1"]);
});

test("plan: deterministic — the same inputs give the same plan, byte for byte", () => {
  const a = JSON.stringify(plan({ config, sourceOf, record, targetMinutes: 90, placements }));
  const b = JSON.stringify(plan({ config, sourceOf, record, targetMinutes: 90, placements }));
  assert.equal(a, b);
});

test("plan: a stale or absent record changes the cut, never the coverage", () => {
  // the module grew since the record: its mutants are placed in the build and priced at the module's mean
  const grown = { ...sources, "dist/lib/alpha.js": built(140) };
  const r1 = plan({ config, sourceOf: (f) => grown[f], record, targetMinutes: 90, placements: { ...placements, alpha: [5, 70, 130, 140] } });
  assert.doesNotThrow(() => assertCovers(r1.chunks, [{ module: "alpha", lines: 140 }, { module: "beta", lines: 7 }, { module: "gamma", lines: 40 }]));
  assert.ok(r1.stale.some((s) => s.startsWith("alpha (recorded 100 lines, built 140)")), r1.stale.join("; "));
  // the module shrank
  const shrunk = { ...sources, "dist/lib/alpha.js": built(30) };
  const r2 = plan({ config, sourceOf: (f) => shrunk[f], record, targetMinutes: 90, placements: { ...placements, alpha: [5, 6] } });
  assert.doesNotThrow(() => assertCovers(r2.chunks, [{ module: "alpha", lines: 30 }, { module: "beta", lines: 7 }, { module: "gamma", lines: 40 }]));
  // a module the record never saw (gamma) is placed and priced at the record's mean mutant, and said so
  const r0 = plan({ config, sourceOf, record, targetMinutes: 90, placements });
  assert.ok(r0.stale.some((s) => s === "gamma (no record)"), r0.stale.join("; "));
  // no record at all: every module is one or more chunks, still complete
  const r3 = plan({ config, sourceOf, record: null, targetMinutes: 90, placements });
  assert.doesNotThrow(() => assertCovers(r3.chunks, modules));
  assert.equal(r3.stale.length, 3);
  // a stale module whose mutants were not placed is refused: the old record read by line number is
  // the error ADR-0131 removed, and the planner does not fall back to it
  assert.throws(() => plan({ config, sourceOf: (f) => grown[f], record, targetMinutes: 90 }), /alpha: the record is stale \(recorded 100 lines, built 140\) and the mutants of the build were not placed/);
  // a record that names the digest of what it measured is stale on an edit that keeps the line count
  const digested = { ...record, modules: { ...record.modules, alpha: { ...record.modules.alpha, sha256: sha256(sources["dist/lib/alpha.js"]) } } };
  const same = plan({ config, sourceOf, record: digested, targetMinutes: 90, placements });
  assert.ok(!same.stale.some((s) => s.startsWith("alpha")), same.stale.join("; "));
  const edited = { ...sources, "dist/lib/alpha.js": built(100).replace(/^x/, "y") };
  const moved = plan({ config, sourceOf: (f) => edited[f], record: digested, targetMinutes: 90, placements });
  assert.ok(moved.stale.some((s) => /^alpha \(recorded source [0-9a-f]{12}, built [0-9a-f]{12}, 100 lines then, 100 now\)$/.test(s)), moved.stale.join("; "));
});

test("plan (ADR-0131 B): a stale module's mutants are priced where they are in the build, at the module's mean, and a chunk of it holds at most the cap", () => {
  // alpha's record: 5 lines carrying 20+10, 0+30, 40+0, 0+25, 3+3 killed+survived, 131 mutants for
  // 600·5 + 150·... seconds. The build is placed: the mean applies to each placed mutant, wherever it sits.
  const lc = lineCosts(MODEL, record, "alpha", 140, { digest: "other", placed: [1, 1, 140] });
  const recorded = record.modules.alpha.mutants;
  const mean = recorded.reduce((t, [, k, v]) => t + 10 * k + 150 * v, 0) / recorded.reduce((t, [, k, v]) => t + k + v, 0);
  assert.equal(lc.costs[1], 2 * mean);
  assert.equal(lc.costs[140], mean);
  assert.equal(lc.costs[5], 0, "the record's line 5 is no longer read: nothing was placed there");
  assert.deepEqual([lc.mutants[1], lc.mutants[140], lc.mutants[5]], [2, 1, 0]);
  assert.throws(() => lineCosts(MODEL, record, "alpha", 140, { placed: [141] }), /a mutant placed on line 141 of a 140-line build/);
  // a fresh module carries no cap and reads its record
  const fresh = lineCosts(MODEL, record, "alpha", 100, {});
  assert.equal(fresh.mutants, null);
  assert.equal(fresh.costs[6], 30 * 150);
  // the cap: 100 cheap mutants on one line each, far under the target, cut 40 a chunk
  const cheap = cutModule({ module: "m", file: "f", lines: 100, costs: new Array(101).fill(1), model: MODEL, targetSeconds: 90 * 60, mutants: new Array(101).fill(1), maxMutants: 40 });
  assert.deepEqual(cheap.map((c) => [c.start, c.end]), [[1, 40], [41, 80], [81, 100]]);
  // a single line carrying more than the cap is a chunk of its own, over the cap and still measured
  const heavy = new Array(11).fill(0); heavy[5] = 50;
  const one = cutModule({ module: "m", file: "f", lines: 10, costs: new Array(11).fill(0), model: MODEL, targetSeconds: 5400, mutants: heavy, maxMutants: 40 });
  assert.deepEqual(one.map((c) => [c.start, c.end]), [[1, 4], [5, 5], [6, 10]]);
  assert.equal(DEFAULT_MAX_MUTANTS > 0 && Number.isInteger(DEFAULT_MAX_MUTANTS), true);
});

// POSITIVE CONTROL, on real code and Stryker's own instrumenter. A module measured at 120 lines,
// cheap everywhere except a block of survivors near its end; then 60 lines inserted in its middle,
// each carrying three mutants (180 the record never measured), which pushes the dear block down.
// Read by line number, as before ADR-0131, the record prices the inserted lines with the cheap code
// that used to sit there, and one range swallows the insertion whole: the shape of evidence 65-105
// (52 mutants predicted, 147 measured) on 2026-11-12. Placed, the insertion is re-cut at the cap.
test("positive control: a file grown in the middle is re-cut at the cap; the old line-number reading made one oversized range of it", async () => {
  const root = mkdtempSync(join(tmpdir(), "rw-plan-grown-"));
  try {
    mkdirSync(join(root, "dist", "lib"), { recursive: true });
    const before = Array.from({ length: 120 }, (_, i) => `export const v${i} = "k${i}";`);
    const inserted = Array.from({ length: 60 }, (_, i) => `export const w${i} = ["a${i}", "b${i}"];`);
    const after = [...before.slice(0, 30), ...inserted, ...before.slice(30)].join("\n");
    const file = join(root, "dist", "lib", "alpha.js");
    writeFileSync(file, after);
    const cfg = { mutate: [file] };
    const sourceOf = (f) => readFileSync(f, "utf8");
    // The record of the 120-line build: one kill on each line, survivors on 100-120 (the dear block).
    const rec = { model: DEFAULT_MODEL, run: "1", measuredAt: "2026-10-28", modules: { alpha: {
      lines: 120, mutants: before.map((_, i) => (i >= 99 ? [i + 1, 0, 1] : [i + 1, 1, 0])),
    } } };
    const placed = await placeAll({ config: cfg, sourceOf });
    assert.equal(placed.alpha.length, 120 + 180, "one StringLiteral a line before, an ArrayDeclaration and two StringLiterals a line inserted");
    const inInserted = (c) => placed.alpha.filter((l) => l >= Math.max(c.start, 31) && l <= Math.min(c.end, 90)).length;
    const r = plan({ config: cfg, sourceOf, record: rec, targetMinutes: 90, placements: placed });
    assert.ok(r.stale.some((s) => s.startsWith("alpha (recorded 120 lines, built 180)")), r.stale.join("; "));
    assert.doesNotThrow(() => assertCovers(r.chunks, [{ module: "alpha", lines: 180 }]));
    for (const c of r.chunks) {
      const held = placed.alpha.filter((l) => l >= c.start && l <= c.end).length;
      assert.ok(held <= DEFAULT_MAX_MUTANTS, `${c.start}-${c.end} holds ${held} mutants`);
    }
    assert.ok(r.chunks.filter((c) => inInserted(c) > 0).length >= Math.ceil(180 / DEFAULT_MAX_MUTANTS), "the insertion is cut into several ranges");
    // The control: the pre-ADR-0131 pricing, record by line number and its mean past the recorded
    // length, cut by the same cutModule. The inserted mutants fall in one range, far over the cap.
    const old = new Array(181).fill(0);
    let knownCost = 0;
    for (const [l, k, v] of rec.modules.alpha.mutants) { const c = DEFAULT_MODEL.perKilledSeconds * k + DEFAULT_MODEL.perSurvivorSeconds * v; old[l] += c; knownCost += c; }
    for (let l = 121; l <= 180; l++) old[l] = knownCost / 120;
    const oldChunks = cutModule({ module: "alpha", file, lines: 180, costs: old, model: DEFAULT_MODEL, targetSeconds: 90 * 60 });
    const worst = Math.max(...oldChunks.map(inInserted));
    assert.ok(worst >= 180, `read by line number, one range held ${worst} of the 180 inserted mutants`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("plan: `--module` narrows to one module, an unknown module is an error, and the matrix limit is enforced", () => {
  const r = plan({ config, sourceOf, record, targetMinutes: 90, only: "beta", placements });
  assert.deepEqual(r.modules, ["beta"]);
  assert.deepEqual(r.chunks, [{ module: "beta", file: "dist/lib/beta.js", start: 1, end: 7, predicted: 610 }]);
  assert.throws(() => plan({ config, sourceOf, record, targetMinutes: 90, only: "nope", placements }), /nothing to measure/);
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
  assert.deepEqual(recordModule(report), { alpha: { lines: 4, sha256: sha256("l1\nl2\nl3\n"), mutants: [[1, 2, 1], [3, 1, 1]] } });
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
    assert.deepEqual(chunks, plan({ config, sourceOf, record, targetMinutes: 90, placements: { alpha: [], beta: [], gamma: [] } }).chunks, "the file carries the same plan the library computes (`x` lines place no mutant)");
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
    assert.deepEqual(written.modules, { beta: { lines: 7, sha256: sha256(built(7)), mutants: [[4, 0, 1]] } });
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
  // Placeholder sources of the recorded lengths, so the digests a record carries (ADR-0131) are
  // left out: this case is about the line counts and the coverage, not about the bytes.
  const byLines = { ...rec, modules: Object.fromEntries(Object.entries(rec.modules).map(([m, e]) => [m, { lines: e.lines, mutants: e.mutants }])) };
  const r = plan({ config: cfg, sourceOf: fromRecord, record: byLines });
  assert.doesNotThrow(() => assertCovers(r.chunks, names.map((m) => ({ module: m, lines: rec.modules[m].lines }))));
  assert.ok(r.chunks.length <= MATRIX_LIMIT);
  assert.equal(r.stale.length, 0, "measured on the record's own line counts, nothing is stale");
});
