#!/usr/bin/env node
// Re-derives the survivor register from a fresh report and refuses a stale one. ADR-0059.
//
// It reads NO score. A module may sit at 60 % or at 99 % and pass; a survivor list may GROW and
// pass. What fails is a register that has stopped describing the code, because that is a claim
// nobody re-derived — the shape ADR-0045 refuses from an operator, applied to runward's own
// compliance material. Clearing a failure is the work ADR-0046 decision 4 already prescribes:
// re-run, regenerate, instruct what is new, commit.
//
//   node scripts/mutation-ratchet.mjs --module evidence --report reports/mutation/evidence.json
//
// Exit codes are distinct on purpose (ADR-0059 decision 5): a refused measurement and a stale
// register must not share an outcome, or the first silently becomes the second the moment anyone
// stops reading logs.
//
//   0  the register describes this tree
//   1  MISMATCH — survivors appeared, vanished, or counts moved
//   2  REFUSED  — the module is not in the register, or the report is unusable
//   3  UNINSTRUCTED — new survivors carry no filing

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { stableKey, describeKey, assignOrdinals } from "./mutation-key.mjs";

const VERDICTS = "docs/compliance/mutation-survivors";
const SURVIVING = new Set(["Survived", "NoCoverage"]);

const argv = process.argv.slice(2);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

const moduleName = value("module");
const reportPath = value("report");
if (!moduleName || !reportPath) {
  console.error("usage: mutation-ratchet.mjs --module <name> --report <stryker.json>");
  process.exit(2);
}

/** Exit 2, never 1: "I could not measure" is not "the register is wrong". */
function refuse(...lines) {
  for (const l of lines) console.error(l);
  console.error("\nREFUSED — nothing was compared. This is not a passing outcome.");
  process.exit(2);
}

if (!existsSync(resolve(process.cwd(), reportPath))) {
  refuse(`no report at ${reportPath}`);
}
const report = JSON.parse(readFileSync(resolve(process.cwd(), reportPath), "utf8"));

// ---- what the tree produces now -------------------------------------------------------------

const files = Object.entries(report.files).filter(([f]) => f.includes(`/${moduleName}.`));
if (files.length !== 1) {
  refuse(`report holds ${files.length} file(s) matching "${moduleName}" — expected exactly one`);
}
const [, entry] = files[0];
const src = entry.source ?? "";
if (!src) refuse("the report carries no source, so no stable key can be built from it");
const lines = src.split("\n");
const offsetOf = (l, c) => {
  let o = 0;
  for (let i = 0; i < l - 1; i++) o += lines[i].length + 1;
  return o + c - 1;
};

/**
 * Which function a line belongs to. The register is organised per function and the key carries it,
 * so the two sides have to agree on this before anything else is comparable.
 */
const bounds = [];
lines.forEach((l, i) => {
  const m = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.exec(l);
  if (m) bounds.push({ name: m[1], line: i + 1 });
});
bounds.push({ name: "__end__", line: lines.length + 1 });
const functionAt = (line) => {
  for (let i = 0; i < bounds.length - 1; i++) {
    if (line >= bounds[i].line && line < bounds[i + 1].line) return bounds[i].name;
  }
  return "(top level)";
};

let timeouts = 0;
// Collected first, keyed second. An ordinal is a mutant's rank among its textually identical
// siblings on the same line, so it cannot be computed one mutant at a time, and without it two
// occurrences of the same literal on one line share an identity. That is measured and real:
// normalize("NFC") appears twice on one line of onDiskSpelling, and each occurrence is its own
// mutant.
const survivors = [];
for (const m of entry.mutants) {
  if (m.status === "Timeout") timeouts++;
  if (!SURVIVING.has(m.status)) continue;
  survivors.push({
    module: moduleName,
    function: functionAt(m.location.start.line),
    mutator: m.mutatorName,
    replacement: m.replacement,
    original: src.slice(offsetOf(m.location.start.line, m.location.start.column),
                        offsetOf(m.location.end.line, m.location.end.column)),
    source: lines[m.location.start.line - 1] ?? "",
    line: m.location.start.line,
    column: m.location.start.column,
  });
}
assignOrdinals(survivors);
const measured = new Map();
for (const m of survivors) {
  const key = stableKey(m);
  measured.set(key, (measured.get(key) ?? 0) + 1);
}

// A Timeout counts as DETECTED for Stryker, and the amendment of 2026-08-20 says such a verdict
// enters a register only once it reproduces alone. An unverified timeout therefore hides a possible
// survivor, and comparing against it would compare against a number nobody stands behind.
if (timeouts > 0 && !report._runwardTimeoutsVerified) {
  refuse(`${timeouts} mutant(s) are filed Timeout in this report and have not been verified alone.`,
    "Stryker counts a Timeout as DETECTED, so an unverified one can hide a survivor — that is how a",
    "contaminated pass read 98.1 % where the clean one reads 77.4 %. Run:",
    `  node scripts/mutation-timeouts.mjs --report ${reportPath} --module ${moduleName}`,
    `  node scripts/mutation-apply-verdicts.mjs --report ${reportPath} --out <verified.json>`);
}

// ---- what the register claims ----------------------------------------------------------------

const verdictDir = resolve(process.cwd(), VERDICTS);
if (!existsSync(verdictDir)) refuse(`no verdicts directory at ${VERDICTS}`);

const filed = new Map();
let anyForModule = false;
for (const f of readdirSync(verdictDir).filter((x) => x.endsWith(".json"))) {
  const j = JSON.parse(readFileSync(join(verdictDir, f), "utf8"));
  for (const v of j.verdicts) {
    if (!v.stableKey) {
      refuse(`${f}: a verdict carries no stableKey — the register cannot be compared to anything.`,
        "Regenerate the verdicts before running the ratchet.");
    }
    if (!v.stableKey.startsWith(moduleName)) continue;
    anyForModule = true;
    // Counted, not overwritten: the key admits one ambiguity (two identical mutations of identical
    // text on one line), and collapsing those to a single entry would make the count check — the
    // very thing that covers the ambiguity — compare 2 against 1 forever.
    filed.set(v.stableKey, (filed.get(v.stableKey) ?? 0) + 1);
  }
}

// A module nobody has instructed is REPORTED AS ABSENT, never as passing. Ten of eleven are in that
// state today, and a green here would mean "one module out of eleven" (ADR-0059 decision 4).
if (!anyForModule) {
  refuse(`"${moduleName}" has no entries in ${VERDICTS}: it has never been instructed.`,
    `The pass measured ${measured.size} surviving mutant(s) with nothing to compare them against.`);
}

// ---- compare ----------------------------------------------------------------------------------

const appeared = [...measured.keys()].filter((k) => !filed.has(k));
const vanished = [...filed.keys()].filter((k) => !measured.has(k));

// The count check is what catches the one ambiguity the key admits: two mutants that replace
// textually identical code the same way on one line share a key, so losing one of them moves a
// number without moving the key set.
const countMismatch = [];
for (const [k, n] of measured) {
  const expected = filed.get(k) ?? 0;
  if (expected !== 0 && n !== expected) countMismatch.push({ key: k, measured: n, expected });
}

const report_ = [];
if (appeared.length) {
  report_.push(`${appeared.length} survivor(s) the register does not carry:`);
  for (const k of appeared.slice(0, 20)) report_.push(`  + ${describeKey(k)}`);
  if (appeared.length > 20) report_.push(`  … and ${appeared.length - 20} more`);
}
if (vanished.length) {
  report_.push(`${vanished.length} survivor(s) the register carries and this tree does not produce:`);
  for (const k of vanished.slice(0, 20)) report_.push(`  - ${describeKey(k)}`);
  if (vanished.length > 20) report_.push(`  … and ${vanished.length - 20} more`);
}
for (const c of countMismatch) {
  report_.push(`  ! ${describeKey(c.key)} — measured ${c.measured}, register carries ${c.expected}`);
}

if (report_.length === 0) {
  console.log(`${moduleName}: the register describes this tree — ${measured.size} survivor(s), ` +
    "every one filed.");
  process.exit(0);
}

console.error(`${moduleName}: the register no longer describes this tree.\n`);
for (const l of report_) console.error(l);
console.error("\nThis is NOT a score check. Survivors may appear and the ratchet still passes —");
console.error("what it refuses is a register that stopped describing the code. To clear it:");
console.error("  1. node scripts/mutation-timeouts.mjs   (verify every Timeout alone)");
console.error("  2. instruct each new survivor: apply it, run a real mission, read the verdict");
console.error("  3. node scripts/mutation-register.mjs   (regenerate) and commit");
process.exit(1);
