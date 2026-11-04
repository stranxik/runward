#!/usr/bin/env node
// Writes the table of the mutants a `stryker run --mutate <file>[:<start>-<end>]` will place, in
// the order Stryker numbers them (ADR-0105).
//
//   node scripts/mutation-mutant-table.mjs --mutate dist/lib/paths.js:1-60 --out reports/mutation/mutant-table.json
//
// WHY A TABLE EXISTS. Stryker's command runner hands the test command ONE thing about the mutant
// under test: its id, in `__STRYKER_ACTIVE_MUTANT__`. The sandbox holds the instrumented file, and
// the instrumenter prints it without retaining line numbers, so nothing in the sandbox says which
// line of the build a mutant sits on. The id is assigned by the instrumenter in placement order,
// which is source order: measured on the 173 chunk reports of release run 40684642130, the ids of
// every chunk are monotone in (line, column), 173/173. So the same instrumenter, run on the same
// file with the same range and the same options, numbers the same mutants the same way. This script
// runs it, and records with the table the SHA-256 of the file it instrumented: a consumer that
// finds the table's digest or its mutant count disagreeing with what it holds falls back to the
// whole suite (scripts/mutation-testcmd.sh).
//
// It calls the instrumenter as @stryker-mutator/core does (process/2-mutant-instrumenter-executor.js:
// `instrument(files, { ignorers, ...options.mutator })`), with the defaults of stryker.config.json,
// which sets no `mutator` and no `ignorers`. A configuration that set either would have to be
// mirrored here; test/unit/mutation-select-tests.test.js pins that the file sets neither.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Instrumenter } from "@stryker-mutator/instrumenter";

const argv = process.argv.slice(2);
const value = (name) => { const i = argv.indexOf(`--${name}`); return i === -1 ? null : argv[i + 1]; };
const mutate = value("mutate");
const out = value("out") ?? "reports/mutation/mutant-table.json";
if (!mutate) {
  console.error("usage: mutation-mutant-table.mjs --mutate <file>[:<start>-<end>] [--out <file>]");
  process.exit(2);
}

// The same regex and the same arithmetic as Stryker's project reader (fs/project-reader.js):
// one-based lines on the command line, zero-based in the description, +1 again for Babel.
const RANGE = /(.*?):((\d+)(?::(\d+))?-(\d+)(?::(\d+))?)$/;
const m = RANGE.exec(mutate);
const file = m ? m[1] : mutate;
const range = m
  ? [{ start: { line: parseInt(m[3]) - 1, column: parseInt(m[4] ?? "0") },
      end: { line: parseInt(m[5]) - 1, column: parseInt(m[6] ?? String(Number.MAX_SAFE_INTEGER)) } }]
  : true;

const cfg = JSON.parse(readFileSync("stryker.config.json", "utf8"));
if (cfg.mutator !== undefined || cfg.ignorers !== undefined) {
  console.error("stryker.config.json sets `mutator` or `ignorers`; this table would not number the same mutants");
  process.exit(2);
}

const content = readFileSync(file, "utf8");
const silent = { isDebugEnabled: () => false, debug() {}, info() {}, warn() {}, error() {}, trace() {}, fatal() {} };
const result = await new Instrumenter(silent).instrument(
  [{ name: resolve(file), content, mutate: range }],
  { ignorers: [], excludedMutations: [], plugins: null },
);

const table = {
  _comment: [
    "ADR-0105. The mutants `stryker run --mutate <mutate>` places, in Stryker's own numbering, each with",
    "the lines of the build it spans. Written by scripts/mutation-mutant-table.mjs; read by",
    "scripts/mutation-testcmd.sh with the coverage map to run only the test files that execute the",
    "mutant under test. Meaningful only for the file digest it records.",
  ],
  mutate,
  file,
  sha256: createHash("sha256").update(content).digest("hex"),
  mutants: result.mutants.map((x) => ({
    id: x.id,
    mutator: x.mutatorName,
    line: x.location.start.line + 1,
    endLine: x.location.end.line + 1,
  })),
};
mkdirSync(resolve(out, ".."), { recursive: true });
writeFileSync(out, `${JSON.stringify(table)}\n`);
console.error(`${out}: ${table.mutants.length} mutant(s) for ${mutate}`);
