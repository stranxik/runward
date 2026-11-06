#!/usr/bin/env node
// The SARIF recipe's writer for a project linted by ESLint (runward ADR-0122): the project's own ESLint,
// with the project's own configuration, run on the project's sources, written as one SARIF 2.1.0 log.
//
//   node eslint-sarif.mjs --out <file> [pattern ...]      (default pattern: src; run in the project)
//
// WHY A WRITER HERE AND NOT IN THE PROJECT. ESLint has no SARIF output of its own, so a project that cites
// a SARIF log usually writes it with a script of its own (the shipped example's lint-committable.mjs). That
// script sits in the tree the agent writes: emptied of its results, it still writes a log that reads clean.
// This one is taken from runward's repository at a pinned commit, out of the agent's reach; only the
// project's ESLint and its configuration come from the tree, which is what a lint is.
//
// WHAT IT WRITES, in the form of the shipped example's committed log, so that on an unchanged tree the
// regenerated log is the committed one byte for byte:
//   - one rule per rule in force on at least one linted file, at its strongest level, read from the
//     configuration ESLint calculates for each file: a rule switched off disappears, and a row citing it is
//     refused (the log cannot vouch for a rule it never ran);
//   - one result per message, with its rule (none for a parse error), level, text, file and position.
// Files are relative to the working directory, `/`-separated, sorted; nothing ESLint echoes back (the
// source text, fix and suggestion payloads) is written.
//
// It exits 1 when a message has error severity, 2 when ESLint cannot be loaded or cannot lint, 0 otherwise.
// The log is written either way: a red lint is a red log, never a missing one.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const at = args.indexOf("--out");
if (at === -1 || !args[at + 1]) {
  console.error("eslint-sarif: usage: node eslint-sarif.mjs --out <file> [pattern ...]");
  process.exit(2);
}
const OUT = resolve(args[at + 1]);
const patterns = args.filter((_, i) => i !== at && i !== at + 1);
if (patterns.length === 0) patterns.push("src");
const ROOT = process.cwd();
const posix = (p) => p.split("\\").join("/");

let ESLint;
try {
  // The project's own ESLint, resolved from the project as its own scripts would resolve it.
  const resolved = createRequire(join(ROOT, "package.json")).resolve("eslint");
  const mod = await import(pathToFileURL(resolved).href);
  ESLint = mod.ESLint ?? mod.default?.ESLint;
  if (typeof ESLint !== "function") throw new Error("the eslint package exports no ESLint class");
} catch (e) {
  console.error(`eslint-sarif: the project's ESLint cannot be loaded from ${ROOT} (${e.message}): install the project's dependencies first`);
  process.exit(2);
}

let results, eslint;
try {
  eslint = new ESLint({ cwd: ROOT, errorOnUnmatchedPattern: true });
  results = await eslint.lintFiles(patterns);
} catch (e) {
  console.error(`eslint-sarif: ESLint could not run: ${e.message}`);
  process.exit(2);
}

const entries = results.map((r) => ({ filePath: posix(relative(ROOT, r.filePath)), messages: r.messages }))
  .sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0));

// Every rule in force on at least one linted file, at its strongest level.
const level = new Map();
for (const r of results) {
  const config = await eslint.calculateConfigForFile(r.filePath);
  for (const [id, value] of Object.entries(config?.rules ?? {})) {
    const sev = Array.isArray(value) ? value[0] : value;
    const n = sev === "error" || sev === 2 ? 2 : sev === "warn" || sev === 1 ? 1 : 0;
    if (n > (level.get(id) ?? 0)) level.set(id, n);
  }
}
const sarifLevel = (n) => (n === 2 ? "error" : "warning");
const sarif = {
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  version: "2.1.0",
  runs: [{
    tool: { driver: { name: "ESLint", informationUri: "https://eslint.org",
      rules: [...level.keys()].sort().map((id) => ({ id, defaultConfiguration: { level: sarifLevel(level.get(id)) } })) } },
    columnKind: "utf16CodeUnits",
    results: entries.flatMap((e) => e.messages.map((m) => ({
      // A parse error belongs to no rule: SARIF says so by leaving ruleId out.
      ...(m.ruleId ? { ruleId: m.ruleId } : {}),
      level: sarifLevel(m.severity),
      message: { text: m.message },
      locations: [{ physicalLocation: { artifactLocation: { uri: e.filePath }, region: { startLine: m.line, startColumn: m.column } } }],
    }))),
  }],
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(sarif, null, 2)}\n`);
const errors = entries.reduce((n, e) => n + e.messages.filter((m) => m.severity === 2).length, 0);
console.log(`eslint-sarif: ${entries.length} file(s) linted, ${level.size} rule(s) in force, ${errors} error(s)`);
process.exit(errors > 0 ? 1 : 0);
