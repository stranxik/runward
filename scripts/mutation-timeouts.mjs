#!/usr/bin/env node
// Re-runs every Timeout-status mutant alone, because Stryker counts a Timeout as DETECTED.
//
// A timeout is the one verdict a mutation run can get wrong in the direction that hides work. A
// killed mutant that is really a survivor cannot happen — a test failed. A survivor that is really
// killed only inflates the register. But a mutant starved past the timeout threshold is filed as
// detected and disappears, and the score goes UP.
//
// Measured 2026-08-19: with 7 workers on 8 cores (the suite alone uses ~2.7), chunk 1 of
// evidence.js reported 66 of 82 mutants as Timeout, a 100 % score and zero survivors. Re-run one
// at a time, those were ordinary kills at ~1 s — and evidence.js:28, the anchor dropped from the
// pointer regex, SURVIVES. This script is that check, made routine.
//
//   node scripts/mutation-timeouts.mjs --report reports/mutation/evidence.json --module evidence
//
// Prints a verdict per mutant and exits non-zero if any Timeout turned out not to be one, so it
// can gate a register that would otherwise be built on a fiction.

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { runBounded, claimExclusive } from "./bounded-run.mjs";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

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
claimExclusive("timeouts");
ensurePristine();

const reportPath = resolve(process.cwd(), value("report") ?? "reports/mutation/mutation.json");
const only = value("module");

// Two bounds, because a hang and a survivor are expensive for opposite reasons and only one of
// them deserves patience.
//
// Phase A runs the module's own tests, which cost ~1.3 s on an idle machine. Still running at 20 s
// is 15x that, with no contention to explain it. Nearly every hang is here, in the parser, so
// nearly every hang costs 20 s instead of 240 s — 269 timeouts verified in ~90 min rather than 18 h.
//
// The bound is safe in the direction that matters. Hitting it files the mutant as detected, so the
// only harmful error would be a SURVIVOR mistaken for a hang — and a survivor passes phase A at its
// normal 1.3 s, because its tests all pass. A killed-but-slow mutant misfiled as a timeout is
// harmless: both are detected, and neither enters the register as a survivor.
//
// Phase B is only reached when phase A passes, and it must run the whole suite because that is
// what proving a survivor requires. 240 s against a ~105 s suite, alone.
//
// Verifying all 66 timeouts of the evidence pass costs ~33 min this way against ~4 h with a single
// 240 s bound. The cheap discrimination is what makes "verify, do not trust" affordable enough to
// actually be done.
const PHASE_A_MS = Number(value("phase-a-ms") ?? 20_000);
const PHASE_B_MS = Number(value("limit-ms") ?? 240_000);

// Verify a handful instead of all of them, to smoke-test the harness itself before committing
// hours to it. The harness has been wrong twice (a signal-only hang check, then orphaned test
// processes), and both times the cheapest way to see it was a three-mutant run against a case
// whose ground truth was already known.
const HEAD = value("head") ? Number(value("head")) : Infinity;

if (!existsSync(reportPath)) {
  console.error(`no report at ${reportPath}`);
  process.exit(2);
}
const report = JSON.parse(readFileSync(reportPath, "utf8"));

const trials = [];
for (const [file, entry] of Object.entries(report.files)) {
  const mod = file.replace(/^.*\//, "").replace(/\.js$/, "");
  if (only && mod !== only) continue;
  for (const m of entry.mutants) {
    if (m.status === "Timeout") trials.push({ file, mod, mutant: m });
  }
}

trials.sort((a, b) => a.mutant.location.start.line - b.mutant.location.start.line);
if (HEAD !== Infinity) trials.splice(HEAD);

if (trials.length === 0) {
  console.log("no Timeout-status mutants to verify");
  process.exit(0);
}

const targets = new Set(trials.map((t) => t.file));
if (targets.size > 1) {
  console.error(`report covers ${targets.size} files — pass --module to pick one`);
  process.exit(2);
}

const target = trials[0].file;
const pristine = readFileSync(target, "utf8");
let restored = false;
const restore = () => { if (!restored) { writeFileSync(target, pristine); restored = true; } };
process.on("exit", restore);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => { restore(); process.exit(130); });
}

/**
 * The module's own test files, for phase A. EMPTY when the module has none, and callers must skip
 * phase A entirely in that case.
 *
 * An earlier comment here claimed `node --test` with no files exits 0, so an empty list would merely
 * fall through to phase B. Measured 2026-08-24: it does not. It discovers and runs the whole suite,
 * exceeds the 20 s phase-A budget every time, and phase A therefore reports EVERY mutant as a real
 * hang. On the `check` sample that produced 4 confirmed hangs out of 4 — a fabricated result, in the
 * flattering direction, from an assertion nobody had run.
 */
function moduleTests(mod) {
  const dir = "test/unit";
  return readdirSync(dir)
    .filter((f) => f.startsWith(mod) && f.endsWith(".test.js"))
    .map((f) => `${dir}/${f}`);
}

function offsetOf(source, line, column) {
  const lines = source.split("\n");
  let offset = 0;
  for (let i = 0; i < line - 1; i++) offset += lines[i].length + 1;
  return offset + (column - 1);
}

/**
 * Verdicts are appended one JSON object per line, as they are decided.
 *
 * Two reasons, both learned the hard way. A printed table cannot be merged back into the report:
 * seven mutants share evidence.js:126, so "line plus mutator" identifies none of them. And a run
 * this long gets interrupted — by a reboot, by a stray second copy, by the operator — so a verdict
 * that is only in memory is a verdict that has to be bought twice.
 *
 * The file is also the resume point: a mutant already recorded is skipped.
 */
const LEDGER = value("ledger") ?? "reports/mutation/timeout-verdicts.jsonl";

/** Identifies a mutant independently of its position in the report. */
const keyOf = (m) => [m.location.start.line, m.location.start.column,
  m.location.end.line, m.location.end.column, m.mutatorName, m.replacement].join("|");

const done = new Map();
if (existsSync(LEDGER)) {
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { const e = JSON.parse(line); done.set(e.key, e.verdict); } catch { /* partial last line */ }
  }
  if (done.size) console.log(`resuming: ${done.size} verdict(s) already in ${LEDGER}`);
}

console.log(`verifying ${trials.length} Timeout mutant(s) in ${target}, one at a time\n`);

const wrong = [];

for (const [i, t] of trials.entries()) {
  const m = t.mutant;
  const key = keyOf(m);
  if (done.has(key)) {
    const v = done.get(key);
    if (v !== "Timeout") wrong.push({ ...m, verdict: v, seconds: 0 });
    continue;
  }
  const start = offsetOf(pristine, m.location.start.line, m.location.start.column);
  const end = offsetOf(pristine, m.location.end.line, m.location.end.column);
  writeFileSync(target, pristine.slice(0, start) + m.replacement + pristine.slice(end));

  const t0 = Date.now();

  // Phase A: the module's own tests, cheap, where a looping parser shows itself immediately.
  // runBounded reports the hang through `timedOut` rather than through an exit code, because node
  // handles SIGTERM and exits with an ordinary status when killed — a status-based check reads
  // every real hang as an ordinary failure.
  //
  // Skipped when the module has no tests of its own: `node --test` with no files runs the whole
  // suite and always exceeds this budget, which would confirm every mutant as a hang.
  const own = moduleTests(t.mod);
  const a = own.length
    ? await runBounded("node", ["--test", ...own], { timeoutMs: PHASE_A_MS })
    : null;

  let verdict;
  if (a && a.timedOut) verdict = "Timeout";
  else if (a && a.status !== 0) verdict = "Killed";
  else {
    // Phase B: nothing cheap killed it, so the claim "this mutant survives" now has to be paid for
    // in full — every remaining test, including the expensive tail.
    const b = await runBounded("scripts/mutation-testcmd.sh", [], {
      shell: true,
      env: { ...process.env, RUNWARD_MUTATION_MODULE: t.mod },
      timeoutMs: PHASE_B_MS,
    });
    verdict = b.timedOut ? "Timeout" : b.status === 0 ? "Survived" : "Killed";
  }

  const seconds = (Date.now() - t0) / 1000;
  appendFileSync(LEDGER, `${JSON.stringify({ key, line: m.location.start.line,
    mutator: m.mutatorName, replacement: m.replacement, verdict, seconds })}\n`);
  if (verdict !== "Timeout") wrong.push({ ...m, verdict, seconds });

  console.log(
    `[${String(i + 1).padStart(3)}/${trials.length}] L${String(m.location.start.line).padEnd(5)} ` +
    `${m.mutatorName.padEnd(22)} ${seconds.toFixed(1).padStart(6)}s -> ${verdict}` +
    (verdict === "Timeout" ? " (real hang, detected)" : "  <-- MIS-REPORTED"),
  );
}

restore();

console.log(`\n${trials.length - wrong.length}/${trials.length} were real hangs.`);
if (wrong.length) {
  const survivors = wrong.filter((w) => w.verdict === "Survived");
  console.log(`${wrong.length} were mis-reported: ` +
    `${wrong.length - survivors.length} killed, ${survivors.length} SURVIVING.`);
  for (const s of survivors) {
    console.log(`  survivor hidden as a timeout: L${s.location.start.line} ${s.mutatorName} -> ${s.replacement}`);
  }
  console.log("\nThe report's score and survivor list are both wrong. Re-run the pass with lower " +
    "concurrency before building the register from it.");
  process.exit(1);
}
