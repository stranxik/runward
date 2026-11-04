#!/usr/bin/env node
// Which unit test files can kill the mutant under test (ADR-0105).
//
// Called by scripts/mutation-testcmd.sh inside Stryker's sandbox, once per mutant. It reads:
//   __STRYKER_ACTIVE_MUTANT__   the mutant's id, set by Stryker's command runner;
//   RUNWARD_MUTATION_TABLE      the table scripts/mutation-mutant-table.mjs wrote for this leg's
//                               `--mutate` argument (absolute path, exported by the caller);
//   RUNWARD_MUTATION_MAP        the coverage map scripts/mutation-coverage-map.mjs wrote for this
//                               build (absolute path, exported by the caller);
//   test/unit-cost.json         the cheap/expensive split, read from the sandbox.
//
// It prints, on stdout, either the single word ALL or two lines: the cheap files that execute
// the mutant's lines, then the expensive ones, each space-separated and sorted. On stderr it says
// why, in one line, so a leg's log shows what each mutant paid for.
//
// EVERY DOUBT ANSWERS ALL. A missing input, a table measured on another build than the map, a
// sandbox file carrying a different number of mutant markers than the table, an id the table does
// not know, a line no test executes: each falls back to the whole suite. Fewer tests than the
// covering set can only turn a killed mutant into a survivor, never a survivor into a kill, and a
// survivor the register does not carry is what the ratchet refuses (ADR-0059); so the one error
// this selection can make is loud and in the safe direction. The fallback keeps it from being
// paid for silently.

import { readFileSync, existsSync } from "node:fs";

const say = (reason) => { process.stderr.write(`mutation-select-tests: ${reason}\n`); };
const all = (reason) => { say(`${reason}; running the whole suite`); process.stdout.write("ALL\n"); process.exit(0); };

const id = process.env.__STRYKER_ACTIVE_MUTANT__;
const tablePath = process.env.RUNWARD_MUTATION_TABLE;
const mapPath = process.env.RUNWARD_MUTATION_MAP;
if (!id) all("no active mutant in the environment");
if (!tablePath || !mapPath) all("RUNWARD_MUTATION_TABLE or RUNWARD_MUTATION_MAP not set");
if (!existsSync(tablePath)) all(`no table at ${tablePath}`);
if (!existsSync(mapPath)) all(`no map at ${mapPath}`);
if (!existsSync("test/unit-cost.json")) all("no test/unit-cost.json");

const read = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const table = read(tablePath);
const map = read(mapPath);
const cost = read("test/unit-cost.json");
if (!table?.mutants || !table.file || !table.sha256) all("the table is not one this script reads");
if (!map?.modules || !map.digests || !map.tests) all("the map is not one this script reads");
if (!cost?.slow || !cost.files) all("test/unit-cost.json is not one this script reads");

const moduleName = String(table.file).replace(/^.*\//, "").replace(/\.js$/, "");
if (map.digests[moduleName] !== table.sha256) {
  all(`${moduleName}: the table was made on build ${String(table.sha256).slice(0, 12)} and the map on ` +
    `${String(map.digests[moduleName] ?? "none").slice(0, 12)}`);
}

// The sandbox file is the instrumented one. It cannot be hashed against the table, but it carries
// one `stryMutAct_9fa48("<id>")` marker per mutant placed, so its marker count must be the table's.
let instrumented;
try { instrumented = readFileSync(table.file, "utf8"); } catch { all(`cannot read ${table.file} in the sandbox`); }
const markers = new Set(instrumented.match(/stryMutAct_9fa48\("\d+"\)/g) ?? []);
if (markers.size !== table.mutants.length) {
  all(`${table.file} carries ${markers.size} mutant marker(s) and the table ${table.mutants.length}`);
}
if (!markers.has(`stryMutAct_9fa48("${id}")`)) all(`mutant ${id} has no marker in ${table.file}`);

const mutant = table.mutants.find((m) => String(m.id) === String(id));
if (!mutant) all(`mutant ${id} is not in the table`);

const lines = map.modules[moduleName]?.lines ?? {};
const covering = new Set();
for (let l = mutant.line; l <= (mutant.endLine ?? mutant.line); l++) {
  for (const i of lines[String(l)] ?? []) covering.add(i);
}
if (covering.size === 0) all(`${moduleName} L${mutant.line}-${mutant.endLine}: no unit test executes these lines`);

const files = [...covering].map((i) => map.tests[i]?.file).filter(Boolean);
if (files.length !== covering.size) all("the map names a test index it does not describe");
for (const f of files) if (!existsSync(f)) all(`${f} is in the map and not in the sandbox`);

const slow = new Set(cost.slow);
const fast = files.filter((f) => !slow.has(f)).sort();
const expensive = files.filter((f) => slow.has(f)).sort();
const seconds = Object.fromEntries(cost.files.map((f) => [f.file, f.seconds]));
const sum = files.reduce((n, f) => n + (seconds[f] ?? 0), 0);
say(`${moduleName} L${mutant.line}${mutant.endLine !== mutant.line ? `-${mutant.endLine}` : ""} ` +
  `mutant ${id}: ${files.length} covering file(s), ${sum.toFixed(1)} s of ${cost.totalSeconds} s`);
process.stdout.write(`${fast.join(" ")}\n${expensive.join(" ")}\n`);
