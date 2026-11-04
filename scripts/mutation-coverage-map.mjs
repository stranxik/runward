#!/usr/bin/env node
// Builds the per-test-file coverage map of the mutation perimeter (ADR-0105).
//
// For every unit test file, run alone, it records which lines of each dist/lib/<module>.js of the
// perimeter the file executes — in its own process AND in every process it spawns, because
// NODE_V8_COVERAGE is inherited by child processes that keep their environment. 64 of the 65 slow
// test files spawn the CLI as a subprocess; a map that only saw the test process would miss them,
// which is what Stryker's own per-test coverage did on 2026-08-18 (106/106 "no coverage").
//
//   node scripts/mutation-coverage-map.mjs --out reports/mutation/coverage-map.json
//
// The map is keyed to the build it was measured on: the SHA-256 of each perimeter module's built
// file. A consumer that reads it against another build must treat it as absent (ADR-0103's rule:
// a measurement is only meaningful against the code it measured).
//
// What it cannot see, and says so: a test that spawns with a cleared environment drops
// NODE_V8_COVERAGE, so its subprocess reports nothing. Each test entry records `processes` (how many
// coverage files its run produced) and `spawnsCli` (whether dist/cli.js was seen executing in any
// of them); a test that spawns the CLI by its source but shows `spawnsCli: false` is blind here.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, join, sep } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const value = (name) => { const i = argv.indexOf(`--${name}`); return i === -1 ? null : argv[i + 1]; };
const OUT = value("out") ?? "reports/mutation/coverage-map.json";
const DIR = "test/unit";
const ROOT = process.cwd();

const cfg = JSON.parse(readFileSync("stryker.config.json", "utf8"));
const modules = cfg.mutate.map((e) => e.replace(/:.*$/, "")).map((f) => ({
  name: f.replace(/^.*\//, "").replace(/\.js$/, ""),
  file: f,
  url: pathToFileURL(resolve(ROOT, f)).href,
}));
for (const m of modules) {
  if (!existsSync(m.file)) { console.error(`perimeter names ${m.file} and it is not built`); process.exit(2); }
}
const digests = Object.fromEntries(modules.map((m) =>
  [m.name, createHash("sha256").update(readFileSync(m.file)).digest("hex")]));

/** Byte offset of the first non-blank character of each line, or -1 for a line with none. */
function lineAnchors(source) {
  const anchors = [];
  let offset = 0;
  for (const line of source.split("\n")) {
    const m = /\S/.exec(line);
    // A line holding only a brace is kept: an ObjectLiteral mutant STARTS on its `{` line, and the
    // first map (2026-11-03) called seven killed mutants of mission.js unexecuted for leaving it out.
    anchors.push(m ? offset + m.index : -1);
    offset += Buffer.byteLength(line, "utf8") + 1;
  }
  return anchors;
}
const anchorsOf = Object.fromEntries(modules.map((m) => [m.name, lineAnchors(readFileSync(m.file, "utf8"))]));

/**
 * The lines a V8 script coverage entry executed: for each line, the innermost block range that
 * contains its first non-blank character decides, with its count. Block granularity, so an `else`
 * branch never taken does not count as executed because its function was.
 */
function executedLines(entry, anchors) {
  const ranges = [];
  for (const fn of entry.functions) for (const r of fn.ranges) ranges.push(r);
  ranges.sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  const lines = new Set();
  for (let i = 0; i < anchors.length; i++) {
    const at = anchors[i];
    if (at < 0) continue;
    let count = 0;
    for (const r of ranges) {
      if (r.startOffset > at) break;
      if (r.endOffset > at) count = r.count;
    }
    if (count > 0) lines.add(i + 1);
  }
  return lines;
}

// V8 offsets are in UTF-16 code units of the source text; the anchors above are byte offsets.
// The perimeter's built files are ASCII except for a few string literals, so the two agree on
// every line start before the first non-ASCII character and drift after it. Measure the drift
// rather than assume it away: a module whose source has non-ASCII characters is anchored in
// UTF-16 units instead.
for (const m of modules) {
  const text = readFileSync(m.file, "utf8");
  if (Buffer.byteLength(text, "utf8") !== text.length) {
    const anchors = [];
    let offset = 0;
    for (const line of text.split("\n")) {
      const mm = /\S/.exec(line);
      anchors.push(mm ? offset + mm.index : -1);
      offset += line.length + 1;
    }
    anchorsOf[m.name] = anchors;
  }
}

// `--only a,b`: keep the test files whose name contains one of the substrings. For a smoke run of
// this script and for the positive control of test/unit/mutation-select-tests.test.js; a map made
// this way says so in `only`, and a leg must never be handed one.
const only = value("only") ? value("only").split(",").filter(Boolean) : null;
const files = readdirSync(DIR).filter((f) => f.endsWith(".test.js") && (!only || only.some((o) => f.includes(o))))
  .sort().map((f) => `${DIR}/${f}`);
const covDir = join(tmpdir(), `runward-covmap-${process.pid}`);
rmSync(covDir, { recursive: true, force: true });

const tests = [];
const perModule = Object.fromEntries(modules.map((m) => [m.name, new Map()]));
const cliUrl = pathToFileURL(resolve(ROOT, "dist/cli.js")).href;
const moduleByUrl = new Map(modules.map((m) => [m.url, m.name]));
const elsewhere = {};

files.forEach((file, index) => {
  const dir = join(covDir, String(index));
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["--test", file], {
    stdio: "ignore", timeout: 600_000, env: { ...process.env, NODE_V8_COVERAGE: dir },
  });
  const seconds = Number(((Date.now() - t0) / 1000).toFixed(2));
  const covFiles = readdirSync(dir).filter((f) => f.endsWith(".json"));
  let spawnsCli = false;
  const touched = new Set();
  for (const cf of covFiles) {
    let data;
    try { data = JSON.parse(readFileSync(join(dir, cf), "utf8")); } catch { continue; }
    for (const entry of data.result ?? []) {
      if (entry.url === cliUrl) spawnsCli = true;
      let name = moduleByUrl.get(entry.url);
      if (!name) {
        // A copy of the build run from elsewhere (test/unit/example-packed.test.js packs the tree
        // and runs the tarball from a temporary directory). Inside Stryker's sandbox that copy is a
        // copy of the INSTRUMENTED file, so the test can kill the mutant: it counts as covering,
        // and the map says where it saw the copy.
        const alt = /\/dist\/lib\/([^/]+)\.js$/.exec(entry.url);
        if (!alt || !perModule[alt[1]] || entry.url.includes("/node_modules/")) continue;
        name = alt[1];
        (elsewhere[file] ??= new Set()).add(entry.url.replace(/^file:\/\/.*?(\/dist\/lib\/)/, "…$1"));
      }
      touched.add(name);
      for (const line of executedLines(entry, anchorsOf[name])) {
        const set = perModule[name].get(line) ?? new Set();
        set.add(index);
        perModule[name].set(line, set);
      }
    }
  }
  tests.push({ file, seconds, passed: r.status === 0, processes: covFiles.length, spawnsCli,
    modules: [...touched].sort() });
  process.stderr.write(`${seconds.toFixed(1).padStart(6)}s  ${String(covFiles.length).padStart(3)} proc  ${spawnsCli ? "cli" : "   "}  ${file}\n`);
  rmSync(dir, { recursive: true, force: true });
});
rmSync(covDir, { recursive: true, force: true });

const map = {
  _comment: [
    "ADR-0105. Per module of the mutation perimeter, per executed line of its built file, the unit test",
    "files (indices into `tests`) that execute that line when run alone, subprocesses included.",
    "Written by scripts/mutation-coverage-map.mjs. Only meaningful against the build whose digests it",
    "records: a consumer must fall back to the whole suite on any other build. `elsewhere` names the",
    "tests that ran a COPY of the build (the packed tarball) and the path they ran it from.",
  ],
  generatedAt: new Date().toISOString(),
  node: process.version,
  ...(only ? { only } : {}),
  digests,
  tests,
  elsewhere: Object.fromEntries(Object.entries(elsewhere).map(([k, v]) => [k, [...v].sort()])),
  modules: Object.fromEntries(modules.map((m) => [m.name, {
    file: m.file,
    lines: Object.fromEntries([...perModule[m.name].entries()].sort((a, b) => a[0] - b[0])
      .map(([line, set]) => [line, [...set].sort((a, b) => a - b)])),
  }])),
};
mkdirSync(resolve(OUT, ".."), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(map)}\n`);

const total = tests.reduce((n, t) => n + t.seconds, 0);
const blind = tests.filter((t) => !t.spawnsCli && /\b(spawnSync|execFileSync|execSync|spawn|execFile)\(/.test(readFileSync(t.file, "utf8")));
process.stderr.write(`\n${OUT} written: ${tests.length} test files, ${total.toFixed(0)} s, ` +
  `${tests.filter((t) => t.spawnsCli).length} spawn the CLI with coverage kept, ` +
  `${blind.length} spawn something and show no CLI coverage\n`);
for (const m of modules) {
  const lines = perModule[m.name];
  process.stderr.write(`  ${m.name.padEnd(20)} ${String(lines.size).padStart(5)} executed lines\n`);
}
const failed = tests.filter((t) => !t.passed);
if (failed.length) process.stderr.write(`WARNING: ${failed.length} file(s) failed: ${failed.map((t) => t.file).join(", ")}\n`);
