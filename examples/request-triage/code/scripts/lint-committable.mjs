#!/usr/bin/env node
// Produce two COMMITTABLE lint reports from ONE ESLint run (runward ADR-0115; the pattern is
// scripts/junit-committable.mjs, ADR-0073 option 1):
//
//   reports/eslint.json   ESLint's own JSON results, one entry per linted file. A manifest row cites
//                         a FILE: `file:code/reports/eslint.json#src/core/domain/guard.ts` is green
//                         only when ESLint linted that file and recorded no error.
//   reports/eslint.sarif  the same results as a SARIF 2.1.0 log, one rule entry per rule in force. A
//                         row cites a RULE: `file:code/reports/eslint.sarif#no-restricted-imports` is
//                         green only when the rule was on and fired nowhere, so a file added later,
//                         cited by no row, still reddens it.
//
// WHAT IT REMOVES, and nothing else. The absolute `filePath` (the layout of whoever ran the lint), the
// `source` text ESLint echoes back when a message fires (the file is in the repository already), and
// the fix and suggestion payloads. Entries are sorted, because a directory's traversal order is not a
// promise. Every message, severity and count is kept as ESLint wrote it.
//
// THE RULE LIST IS READ FROM THE CONFIGURATION IN FORCE, never written here. A rule switched off in
// eslint.config.mjs disappears from the SARIF log, and a row citing it is refused: the log cannot vouch
// for a rule it never ran.
//
// AND IT EXITS WITH ESLINT'S OWN VERDICT: 1 when an error-severity message exists, 2 when ESLint
// could not run. The reports are written either way, so a red lint is a red report, never a missing one.
//
// `node scripts/lint-committable.mjs [dir]` writes into `dir` (default `reports/`).
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ESLint } from "eslint";

const ROOT = resolve(import.meta.dirname, "..");
const DIR = resolve(ROOT, process.argv[2] ?? "reports");
const posix = (p) => p.split("\\").join("/");

let results, eslint;
try {
  eslint = new ESLint({ cwd: ROOT, errorOnUnmatchedPattern: true });
  results = await eslint.lintFiles(["src"]);
} catch (e) {
  console.error(`lint-committable: ESLint could not run — ${e.message}`);
  process.exit(2);
}

const entries = results.map((r) => ({
  filePath: posix(relative(ROOT, r.filePath)),
  messages: r.messages.map((m) => ({
    ruleId: m.ruleId, severity: m.severity, message: m.message,
    line: m.line, column: m.column,
    ...(m.endLine !== undefined ? { endLine: m.endLine, endColumn: m.endColumn } : {}),
    ...(m.fatal ? { fatal: true } : {}),
  })),
  errorCount: r.errorCount, fatalErrorCount: r.fatalErrorCount, warningCount: r.warningCount,
})).sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0));

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

mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, "eslint.json"), JSON.stringify(entries, null, 2) + "\n");
writeFileSync(join(DIR, "eslint.sarif"), JSON.stringify(sarif, null, 2) + "\n");
const errors = entries.reduce((n, e) => n + e.errorCount, 0);
const warnings = entries.reduce((n, e) => n + e.warningCount, 0);
console.log(`lint-committable: ${entries.length} file(s) linted, ${level.size} rule(s) in force, ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors > 0 ? 1 : 0);
