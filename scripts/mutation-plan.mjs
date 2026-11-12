#!/usr/bin/env node
// The chunk plan of the mutation ratchet, cut from measured cost (ADR-0104).
//
// Until ADR-0104 the plan was fixed line ranges in `stryker.config.json` order: 60 lines a chunk,
// whatever those lines held. A chunk's time does not follow its line count; it follows what the
// mutants in it cost, and a survivor costs the whole suite where a killed mutant costs the cheap
// stage (scripts/mutation-testcmd.sh). Fitted on the 0.46.0 release ratchet, a chunk takes about
// base + perKilled × killed + perSurvivor × survivors seconds, so a 60-line range of `mission` ran
// 4.6 hours against a step ceiling of five, while the matrix ended with sixteen slots waiting on
// the few long legs that happened to sit last in the configuration.
//
// This script does two things, and nothing else writes the plan:
//
//   node scripts/mutation-plan.mjs [--module <m>] [--target <minutes>] [--max-mutants <n>] [--github-output]
//       Cuts every module of the perimeter into line ranges whose PREDICTED time stays under the
//       target, orders them longest first (so the sixteen slots of the matrix drain evenly), and
//       prints the plan as JSON. `--github-output` appends `chunks=` and `modules=` to $GITHUB_OUTPUT.
//
//   node scripts/mutation-plan.mjs --record --merged <dir> --run <id> --measured-at <date> [--out <file>]
//       Regenerates the plan input, docs/compliance/mutation-chunk-costs.json, from the merged
//       reports of a ratchet run (the `merged-<module>` artifacts, as download-artifact leaves them):
//       per module, per line, how many mutants were killed and how many survived.
//
// WHAT THE PLAN INPUT CAN AND CANNOT DO. It decides WHERE a module is cut and in WHICH ORDER the
// chunks run. It never decides WHAT is measured: the ranges always cover line 1 to the last line of
// the module as built now, with no gap and no overlap, whatever the record says (test/unit/
// mutation-plan.test.js proves it, with a positive control). A stale record, a missing module, a
// module that grew or shrank since the record: each costs time, never coverage. The guarantees of
// ADR-0059 are untouched: every chunk is counted by the ratchet job against this plan, and a chunk
// that does not come back refuses the module.
//
// A STALE RECORD IS PLACED, NOT READ BY LINE NUMBER (ADR-0131 B). Until 2026-11-12 a module whose
// build differed from the recorded one kept the record's per-line costs at the record's line
// numbers, and only lines past the recorded length were averaged. ADR-0114's lexer inserted 336
// lines near line 70 of dist/lib/evidence.js after the 0.46.0 record (1793 lines, 1653 mutants);
// the build had 2441 lines and 2856 mutants, the lexer's ranges were priced with the code the
// insertion had pushed down, and range 65-105, predicted 2038 s for 52 mutants, held 147 mutants at
// 200 to 330 s each and hit the 300-minute ceiling. Now the mutants of a stale module are placed
// where Stryker's instrumenter puts them in the build being planned (the call
// scripts/mutation-mutant-table.mjs makes), each priced at the module's recorded mean cost per
// mutant, and no chunk of it holds more than DEFAULT_MAX_MUTANTS of them: a mean is a guess, and
// the cap bounds what a guess can cost.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const COSTS_FILE = "docs/compliance/mutation-chunk-costs.json";
export const CONFIG_FILE = "stryker.config.json";
export const DEFAULT_TARGET_MINUTES = 90;
/** GitHub refuses a matrix of more than 256 jobs; a plan above that would never run. */
export const MATRIX_LIMIT = 256;
/**
 * The most mutants a chunk of a STALE module holds (ADR-0131 B), whatever their guessed price. A
 * leg has 300 minutes and pays about 961 s before its first mutant. Measured 2026-11-12, a lexer
 * survivor runs about the whole suite (267 to 533 s on a runner), and since ADR-0131 C a lexer kill
 * about a tenth of that. 40 would hold even a chunk where every mutant survives; it also makes the
 * whole perimeter 321 legs on today's tree, over the matrix's 256, while 15 of 25 modules are stale.
 * 60 plans it in 228 legs and stays under the ceiling unless more than about 84 % of a chunk
 * survives (the worst lexer leg measured: 37 %). A module whose record describes its build is cut
 * on measured cost and carries no cap.
 */
export const DEFAULT_MAX_MUTANTS = 60;

/**
 * The cost model, in seconds. Fitted by least squares on the 173 chunks of the 0.46.0 release
 * ratchet (run 40684642130, job durations): the intercept is what a chunk pays before its first
 * mutant (checkout, npm ci, build, Stryker's dry run), a killed mutant pays the cheap stage, a
 * survivor pays the whole suite. The record carries the model it was generated with, so a refit
 * changes the file, never the code.
 */
export const DEFAULT_MODEL = { baseSeconds: 961, perKilledSeconds: 12.7, perSurvivorSeconds: 151.5 };

/** Stryker statuses that mean "the suite did not kill this mutant" — the same set as mutation-survivors.mjs. */
const SURVIVING = new Set(["Survived", "NoCoverage"]);

/** dist/lib/evidence.js -> evidence; "dist/lib/evidence.js:1-40" -> dist/lib/evidence.js */
export const fileOf = (entry) => entry.replace(/:.*$/, "");
export const moduleOf = (file) => basename(file).replace(/\.js$/, "");
/** The line count the workflow has always used: `split("\n").length`, trailing newline included. */
export const lineCount = (source) => source.split("\n").length;
export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export function predict(model, killed, survivors) {
  return model.baseSeconds + model.perKilledSeconds * killed + model.perSurvivorSeconds * survivors;
}

/**
 * Why the record does not describe the module as built, or null when it does. A record that
 * carries the digest of the source it measured (every record written since ADR-0131) is compared
 * by digest; an older one only by line count, which misses an edit that keeps the count.
 */
export function staleness(entry, lines, digest) {
  if (!entry) return "no record";
  if (entry.sha256 && digest && entry.sha256 !== digest) return `recorded source ${entry.sha256.slice(0, 12)}, built ${digest.slice(0, 12)}, ${entry.lines} lines then, ${lines} now`;
  if ((entry.lines ?? 0) !== lines) return `recorded ${entry.lines ?? 0} lines, built ${lines}`;
  return null;
}

/**
 * Per-line cost of one module, in seconds, index 1..lines (index 0 unused), and per line how many
 * mutants a cap counts (`mutants`, null when the module is cut on measured cost alone).
 *
 * A module the record describes: each line costs what the record measured on it. A stale module
 * (ADR-0131 B): each mutant of `placed`, the start lines of the mutants Stryker places in the build
 * being planned, costs the module's recorded mean per mutant (with no record for the module, the
 * record's mean; with no record at all, a survivor), and `mutants` counts them per line. A stale
 * module without `placed` is refused: reading the old record by line number is the error this
 * replaced. Either way a guess changes where a module is cut, never what is measured.
 */
export function lineCosts(model, record, module, lines, { digest = null, placed = null } = {}) {
  const entry = record?.modules?.[module];
  const costs = new Array(lines + 1).fill(0);
  const stale = staleness(entry, lines, digest);
  if (!stale) {
    for (const [line, killed, survivors] of entry.mutants ?? []) {
      if (line >= 1 && line <= lines) costs[line] += model.perKilledSeconds * killed + model.perSurvivorSeconds * survivors;
    }
    return { costs, mutants: null, stale: null };
  }
  if (!Array.isArray(placed)) throw new Error(`${module}: the record is stale (${stale}) and the mutants of the build were not placed; the planner cannot price it`);
  const perMutant = meanMutantCost(model, entry ? { [module]: entry } : record?.modules) ?? model.perSurvivorSeconds;
  const mutants = new Array(lines + 1).fill(0);
  for (const line of placed) {
    if (!Number.isInteger(line) || line < 1 || line > lines) throw new Error(`${module}: a mutant placed on line ${line} of a ${lines}-line build`);
    mutants[line] += 1;
    costs[line] += perMutant;
  }
  return { costs, mutants, stale };
}

/** The mean predicted cost of one recorded mutant over `modules`, or null when they record none. */
function meanMutantCost(model, modules) {
  let total = 0, count = 0;
  for (const entry of Object.values(modules ?? {})) {
    for (const [, killed, survivors] of entry.mutants ?? []) {
      total += model.perKilledSeconds * killed + model.perSurvivorSeconds * survivors;
      count += killed + survivors;
    }
  }
  return count > 0 ? total / count : null;
}

/**
 * Cuts one module into ranges whose predicted time stays under `targetSeconds`. Greedy and
 * left to right: a chunk grows until the next line would push it over; a chunk always holds at
 * least one line, so a single line dearer than the target is still measured, over target and said so.
 * With `mutants` (per-line counts) a chunk also ends before it would hold more than `maxMutants`;
 * a single line carrying more is a chunk of its own, over the cap and still measured.
 */
export function cutModule({ module, file, lines, costs, model, targetSeconds, mutants = null, maxMutants = DEFAULT_MAX_MUTANTS }) {
  const chunks = [];
  let start = 1, predicted = model.baseSeconds, held = 0;
  for (let l = 1; l <= lines; l++) {
    const next = predicted + costs[l];
    const count = mutants ? mutants[l] : 0;
    if (l > start && (next > targetSeconds || (mutants && held + count > maxMutants))) {
      chunks.push({ module, file, start, end: l - 1, predicted: Math.round(predicted) });
      start = l;
      predicted = model.baseSeconds + costs[l];
      held = count;
    } else {
      predicted = next;
      held += count;
    }
  }
  chunks.push({ module, file, start, end: lines, predicted: Math.round(predicted) });
  return chunks;
}

/** Longest first, then by module and start so two runs of the same inputs give the same plan. */
export function orderLongestFirst(chunks) {
  return [...chunks].sort((a, b) => b.predicted - a.predicted || (a.module < b.module ? -1 : a.module > b.module ? 1 : 0) || a.start - b.start);
}

/**
 * The invariant the plan must keep whatever the record says: for every module, the ranges cover
 * 1..lines exactly once. Throws naming the first module and line that breaks it.
 * `modules` is [{ module, lines }].
 */
export function assertCovers(chunks, modules) {
  for (const { module, lines } of modules) {
    const own = chunks.filter((c) => c.module === module).sort((a, b) => a.start - b.start);
    let expected = 1;
    for (const c of own) {
      if (c.start !== expected) throw new Error(`${module}: lines ${expected}-${c.start - 1} are ${c.start < expected ? "measured twice" : "not measured"}`);
      if (c.end < c.start) throw new Error(`${module}: empty range ${c.start}-${c.end}`);
      if (c.end > lines) throw new Error(`${module}: range ${c.start}-${c.end} runs past the last line (${lines})`);
      expected = c.end + 1;
    }
    if (expected !== lines + 1) throw new Error(`${module}: lines ${expected}-${lines} are not measured`);
  }
}

/**
 * The plan. `config` is the parsed stryker.config.json, `sourceOf(file)` returns the built file's
 * text (throws if it is not built), `record` the parsed costs file or null, `placements` per module
 * the start line of each mutant Stryker places in that text (`placeAll`; needed for every module
 * the record does not describe), `maxMutants` the cap on a chunk of such a module.
 */
export function plan({ config, sourceOf, record, model = record?.model ?? DEFAULT_MODEL, targetMinutes = DEFAULT_TARGET_MINUTES, only = "", placements = null, maxMutants = DEFAULT_MAX_MUTANTS }) {
  const targetSeconds = targetMinutes * 60;
  const modules = [];
  const stale = [];
  let chunks = [];
  for (const entry of config.mutate) {
    const file = fileOf(entry);
    const module = moduleOf(file);
    if (only && module !== only) continue;
    const source = sourceOf(file);
    const lines = lineCount(source);
    modules.push({ module, file, lines });
    const lc = lineCosts(model, record, module, lines, { digest: sha256(source), placed: placements?.[module] ?? null });
    if (lc.stale) stale.push(`${module} (${lc.stale})`);
    chunks.push(...cutModule({ module, file, lines, costs: lc.costs, model, targetSeconds, mutants: lc.mutants, maxMutants }));
  }
  if (chunks.length === 0) throw new Error("nothing to measure — check the module input");
  assertCovers(chunks, modules);
  chunks = orderLongestFirst(chunks);
  if (chunks.length > MATRIX_LIMIT) {
    const capped = stale.length ? `, or --max-mutants (the cap on a chunk of a stale module, ${maxMutants}; regenerating the record with --record lifts it)` : "";
    throw new Error(`${chunks.length} chunks exceed the matrix limit of ${MATRIX_LIMIT}; raise --target${capped}`);
  }
  const longest = chunks[0].predicted;
  const total = chunks.reduce((s, c) => s + c.predicted, 0);
  return { chunks, modules: modules.map((m) => m.module), stale, targetMinutes, longestSeconds: longest, totalSeconds: total };
}

// ── the record ──────────────────────────────────────────────────────────────────────────────────

/** Every file under `dir` whose name matches, whatever depth download-artifact chose. */
function find(dir, test) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) found.push(...find(p, test));
    else if (test(name)) found.push(p);
  }
  return found;
}

/** One module's record from its merged Stryker report: per line, killed and surviving counts. */
export function recordModule(report) {
  const out = {};
  for (const [path, entry] of Object.entries(report.files ?? {})) {
    if (!/^dist\/lib\/[^/]+\.js$/.test(path)) continue;
    const byLine = new Map();
    for (const m of entry.mutants ?? []) {
      const line = m.location?.start?.line;
      if (!Number.isInteger(line)) continue;
      const row = byLine.get(line) ?? [line, 0, 0];
      if (SURVIVING.has(m.status)) row[2] += 1; else row[1] += 1;
      byLine.set(line, row);
    }
    out[moduleOf(path)] = { lines: lineCount(entry.source ?? ""), sha256: sha256(entry.source ?? ""), mutants: [...byLine.values()].sort((a, b) => a[0] - b[0]) };
  }
  return out;
}

export function buildRecord({ mergedDir, run, measuredAt, model = DEFAULT_MODEL }) {
  const modules = {};
  for (const path of find(mergedDir, (n) => n.endsWith(".json"))) {
    Object.assign(modules, recordModule(JSON.parse(readFileSync(path, "utf8"))));
  }
  if (Object.keys(modules).length === 0) throw new Error(`no merged report under ${mergedDir}`);
  const sorted = Object.fromEntries(Object.keys(modules).sort().map((m) => [m, modules[m]]));
  return {
    _comment: [
      "The plan input of the mutation ratchet (ADR-0104), generated by scripts/mutation-plan.mjs --record from",
      "the merged reports of a ratchet run: per module, per line, how many mutants the suite killed and how",
      "many survived. It decides where each module is cut into chunks and in which order the chunks run.",
      "It never decides what is measured: the plan always covers every line of every module as built now.",
      "A stale record costs time, never coverage. Regenerate it after each release ratchet (see",
      "docs/compliance/mutation-register.md, 'Filing a measurement').",
    ],
    model,
    run: String(run),
    measuredAt,
    modules: sorted,
  };
}

/** Readable and small: the record indented, each module's mutant rows on one line. */
export function serializeRecord(record) {
  const head = { ...record, modules: undefined };
  const lines = [JSON.stringify(head, null, 2).replace(/,\n  "modules": undefined\n}$/, "").replace(/\n}$/, ",")];
  lines.push('  "modules": {');
  const names = Object.keys(record.modules);
  names.forEach((m, i) => {
    const e = record.modules[m];
    const digest = e.sha256 ? `"sha256": ${JSON.stringify(e.sha256)}, ` : "";
    lines.push(`    ${JSON.stringify(m)}: { "lines": ${e.lines}, ${digest}"mutants": ${JSON.stringify(e.mutants)} }${i < names.length - 1 ? "," : ""}`);
  });
  lines.push("  }", "}", "");
  return lines.join("\n");
}

/**
 * Per module of the plan, the start line of every mutant Stryker's instrumenter places in the
 * built file, whole file, as scripts/mutation-mutant-table.mjs calls it (same options, so the same
 * mutants). Refuses a configuration that sets `mutator` or `ignorers`, which that call would not mirror.
 */
export async function placeAll({ config, sourceOf, only = "" }) {
  const { placeMutants, mirrorsConfig } = await import("./mutation-mutant-table.mjs");
  if (!mirrorsConfig(config)) throw new Error("stryker.config.json sets `mutator` or `ignorers`; the planner would not place the mutants Stryker places");
  const placements = {};
  for (const entry of config.mutate) {
    const file = fileOf(entry);
    const module = moduleOf(file);
    if (only && module !== only) continue;
    placements[module] = (await placeMutants(file, sourceOf(file))).map((m) => m.line);
  }
  return placements;
}

// ── command line ────────────────────────────────────────────────────────────────────────────────

async function main(argv) {
  const arg = (name) => { const i = argv.indexOf(`--${name}`); return i === -1 ? null : argv[i + 1]; };
  const flag = (name) => argv.includes(`--${name}`);

  if (flag("record")) {
    const mergedDir = arg("merged"), run = arg("run"), measuredAt = arg("measured-at");
    if (!mergedDir || !run || !measuredAt) {
      console.error("usage: mutation-plan.mjs --record --merged <dir> --run <id> --measured-at <YYYY-MM-DD> [--out <file>]");
      return 2;
    }
    const out = arg("out") ?? COSTS_FILE;
    const previous = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;
    const record = buildRecord({ mergedDir, run, measuredAt, model: previous?.model ?? DEFAULT_MODEL });
    writeFileSync(out, serializeRecord(record));
    const n = Object.keys(record.modules).length;
    console.error(`${out}: ${n} module(s) recorded from run ${run} (${measuredAt})`);
    return 0;
  }

  const configPath = arg("config") ?? CONFIG_FILE;
  const costsPath = arg("costs") ?? COSTS_FILE;
  if (!existsSync(configPath)) { console.error(`no ${configPath}`); return 2; }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const record = existsSync(costsPath) ? JSON.parse(readFileSync(costsPath, "utf8")) : null;
  if (!record) console.error(`::warning::no ${costsPath} — every module is cut on a mean line cost`);
  const targetMinutes = Number(arg("target") ?? DEFAULT_TARGET_MINUTES);
  if (!Number.isFinite(targetMinutes) || targetMinutes <= 0) { console.error("--target must be a positive number of minutes"); return 2; }
  const maxMutants = Number(arg("max-mutants") ?? DEFAULT_MAX_MUTANTS);
  if (!Number.isInteger(maxMutants) || maxMutants <= 0) { console.error("--max-mutants must be a positive integer"); return 2; }
  const sourceOf = (file) => {
    if (!existsSync(file)) throw new Error(`perimeter names ${file} and it is not built`);
    return readFileSync(file, "utf8");
  };
  let result;
  try {
    const placements = await placeAll({ config, sourceOf, only: arg("module") ?? "" });
    result = plan({ config, sourceOf, record, targetMinutes, only: arg("module") ?? "", placements, maxMutants });
  } catch (e) {
    console.error(`::error::${e.message}`);
    return 2;
  }
  const min = (s) => (s / 60).toFixed(1);
  console.error(`${result.modules.length} module(s), ${result.chunks.length} chunk(s), target ${targetMinutes} min: longest predicted ${min(result.longestSeconds)} min, ${(result.totalSeconds / 3600).toFixed(1)} runner-hours predicted, record ${record ? `from run ${record.run} (${record.measuredAt})` : "absent"}`);
  if (result.stale.length) console.error(`::warning::plan input stale for ${result.stale.join(", ")} — cut on a guessed cost, coverage unchanged; regenerate with --record after this run`);
  if (flag("github-output")) {
    const path = process.env.GITHUB_OUTPUT;
    if (!path) { console.error("--github-output needs $GITHUB_OUTPUT"); return 2; }
    appendFileSync(path, `chunks=${JSON.stringify(result.chunks)}\nmodules=${JSON.stringify(result.modules)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result.chunks)}\n`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
