#!/usr/bin/env node
// Re-runs surviving mutants against the whole net, not just the unit suite.
//
// ADR-0046 decision 2: the unit suite is not runward's safety net. In August, 433 mutants
// survived `node --test`, and 53 of them died against the self-gate, the OSCAL schema
// validation and the end-to-end smoke. Reporting those 53 as holes would have been false.
// This script is that second pass, made repeatable.
//
// ADR-0046 decision 3 is the reason it applies the mutant to a real mission and reads the
// verdict, rather than reasoning about the code: on an earlier bench of four, three
// survivors declared harmless by reading were live defects.
//
//   node scripts/mutation-wholenet.mjs --module evidence
//   node scripts/mutation-wholenet.mjs --module evidence --limit 5   # smoke the harness
//
// Output is JSON on stdout, progress on stderr, so it pipes into the register step.

import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { runBounded, claimExclusive } from "./bounded-run.mjs";
import { NET, netDigest, WHOLENET_RECORD, readWholeNetRecord } from "./mutation-net.mjs";
import { resolve } from "node:path";

const REPORT = "reports/mutation/mutation.json";
const SURVIVING = new Set(["Survived", "NoCoverage"]);


const argv = process.argv.slice(2);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

const only = value("module");
const limit = value("limit") ? Number(value("limit")) : Infinity;

/**
 * Rebuild dist/ before measuring anything.
 *
 * These scripts write a mutant into a build artifact and restore it on exit, but `process.on`
 * cannot run after SIGKILL — a machine reboot, an OOM kill, a `kill -9`. Measured 2026-08-20: a
 * reboot during the timeout pass left one mutant in dist/lib/evidence.js, and every verdict taken
 * afterwards would have been about a tree nobody meant to measure, with nothing in the output to
 * say so. Restoring on the way IN is the only defence that survives being killed.
 */
function ensurePristine() {
  const r = spawnSync("npm", ["run", "build"], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error("npm run build failed — refusing to measure a tree of unknown state");
    console.error(r.stderr ?? "");
    process.exit(2);
  }
}
claimExclusive("wholenet");
ensurePristine();

const reportPath = resolve(process.cwd(), value("report") ?? REPORT);
if (!existsSync(reportPath)) {
  console.error(`no report at ${reportPath} — run the mutation pass first`);
  process.exit(2);
}
const report = JSON.parse(readFileSync(reportPath, "utf8"));

/** Stryker gives line/column (1-based); splicing needs an absolute offset. */
function offsetOf(source, line, column) {
  let offset = 0;
  const lines = source.split("\n");
  for (let i = 0; i < line - 1; i++) offset += lines[i].length + 1;
  return offset + (column - 1);
}

function applyMutant(source, mutant) {
  const start = offsetOf(source, mutant.location.start.line, mutant.location.start.column);
  const end = offsetOf(source, mutant.location.end.line, mutant.location.end.column);
  return source.slice(0, start) + mutant.replacement + source.slice(end);
}

/**
 * A mutant is detected when any leg of the net changes its exit status from the baseline.
 *
 * A timed-out leg is reported as the sentinel "timeout" rather than as a status, so it cannot be
 * silently equal to the baseline: a leg that hangs under a mutant HAS changed behaviour, and
 * reading its killed-process exit code as an ordinary status would file that as "unchanged".
 */
async function runLeg(leg) {
  const r = await runBounded(process.execPath, leg.argv, { timeoutMs: 120_000 });
  return r.timedOut ? "timeout" : r.status;
}

const trials = [];
for (const [file, entry] of Object.entries(report.files)) {
  const mod = file.replace(/^.*\//, "").replace(/\.js$/, "");
  if (only && mod !== only) continue;
  for (const m of entry.mutants) {
    if (SURVIVING.has(m.status)) trials.push({ file, mod, mutant: m });
  }
}
trials.sort((a, b) => a.mutant.location.start.line - b.mutant.location.start.line);
const selected = trials.slice(0, limit);

if (selected.length === 0) {
  console.error("no surviving mutants in the report for that module");
  process.exit(1);
}

// One target file per run. Without this, a report covering several modules would splice every
// mutant into the first module's file: the offsets would still land somewhere, the net would still
// return an exit code, and the whole run would be quietly meaningless.
const targets = new Set(selected.map((t) => t.file));
if (targets.size > 1) {
  console.error(`report covers ${targets.size} files (${[...targets].join(", ")}) — ` +
    "pass --module to pick one; mutants from different files cannot share a run");
  process.exit(2);
}
const target = selected[0].file;
const pristine = readFileSync(target, "utf8");

// The mutant lives in a build artifact. If this process dies between write and restore,
// the working tree is left compiled-wrong, and every later run silently measures the
// wrong binary. Restoration is registered before the first write, not after the last.
let restored = false;
const restore = () => {
  if (restored) return;
  writeFileSync(target, pristine);
  restored = true;
};
process.on("exit", restore);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => { restore(); process.exit(130); });
}

/**
 * Verdicts are appended as they are decided, and a recorded mutant is skipped on a later run.
 *
 * This pass is hours long, and on 2026-08-20 three separate runs of the mutation harness were lost
 * to a reboot, a stray second copy, and an operator stop. Work that only exists in memory gets
 * bought twice.
 */
const LEDGER = value("ledger") ?? "reports/mutation/wholenet-verdicts.jsonl";
const keyOf = (m) => [m.location.start.line, m.location.start.column,
  m.location.end.line, m.location.end.column, m.mutatorName, m.replacement].join("|");

const already = new Map();
if (existsSync(LEDGER)) {
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { const e = JSON.parse(line); already.set(e.key, e.caughtBy); } catch { /* partial line */ }
  }
  if (already.size) console.error(`resuming: ${already.size} verdict(s) already in ${LEDGER}`);
}

console.error(`baseline: establishing the net's own verdict on a pristine tree`);
const baseline = {};
for (const leg of NET) {
  baseline[leg.name] = await runLeg(leg);
  console.error(`  ${leg.name.padEnd(14)} exit ${baseline[leg.name]}`);
}

const results = [];
let detected = 0;
for (const [i, t] of selected.entries()) {
  const key = keyOf(t.mutant);
  let caughtBy;
  if (already.has(key)) {
    caughtBy = already.get(key);
  } else {
    writeFileSync(target, applyMutant(pristine, t.mutant));
    caughtBy = null;
    for (const leg of NET) {
      if (await runLeg(leg) !== baseline[leg.name]) { caughtBy = leg.name; break; }
    }
    appendFileSync(LEDGER, `${JSON.stringify({ key, line: t.mutant.location.start.line,
      mutator: t.mutant.mutatorName, replacement: t.mutant.replacement, caughtBy })}\n`);
  }
  if (caughtBy) detected++;
  results.push({
    line: t.mutant.location.start.line,
    mutator: t.mutant.mutatorName,
    replacement: t.mutant.replacement,
    caughtBy,
  });
  console.error(
    `[${String(i + 1).padStart(3)}/${selected.length}] L${String(t.mutant.location.start.line).padEnd(5)} ` +
    `${t.mutant.mutatorName.padEnd(22)} ${caughtBy ? `caught by ${caughtBy}` : "SURVIVES THE NET"}`,
  );
}

restore();
console.error(`\n${detected}/${selected.length} caught by the whole net; ` +
  `${selected.length - detected} survive everything and must be filed.`);

// WHAT WAS MEASURED, AGAINST WHICH NET. A row filed `hole` claims nothing catches the mutant in the
// unit suite AND in the whole net; that second half is a claim about a specific set of leg files.
// Recording the net's digest is what lets the register DISCLOSE, later, that a filing rests on a net
// that has since changed — the signal whose absence let a stale pass-2 be explained away on
// 2026-09-01. Only written for a whole-module run: a `--limit` pass smokes the harness and measures
// nothing anyone should file against.
if (only && !Number.isFinite(limit)) {
  const { digest } = netDigest();
  const record = readWholeNetRecord();
  record[only] = { at: new Date().toISOString().slice(0, 10), digest, trials: selected.length, detected };
  const ordered = Object.fromEntries(Object.keys(record).sort().map((k) => [k, record[k]]));
  writeFileSync(resolve(process.cwd(), WHOLENET_RECORD), JSON.stringify(ordered, null, 1) + "\n");
  console.error(`recorded in ${WHOLENET_RECORD}: ${only} against net ${digest.slice(0, 12)}…`);
}

console.log(JSON.stringify(results, null, 2));
