#!/usr/bin/env node
// Folds verified timeout verdicts back into a Stryker report.
//
// Stryker counts a Timeout as DETECTED, and scripts/mutation-timeouts.mjs re-runs every such mutant
// alone to find out whether it really hangs. This applies those verdicts, so the downstream steps —
// the whole-net pass, the register — work from what was measured rather than from what Stryker
// assumed. Without it, a survivor that hid in the detected column stays hidden.
//
//   node scripts/mutation-apply-verdicts.mjs \
//     --report reports/mutation/evidence.json \
//     --verdicts reports/mutation/timeout-verdicts.jsonl \
//     --out reports/mutation/evidence-verified.json
//
// The output is a normal Stryker report, so every other script reads it with --report unchanged.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

const reportPath = resolve(process.cwd(), value("report") ?? "reports/mutation/mutation.json");
const ledgerPath = resolve(process.cwd(), value("verdicts") ?? "reports/mutation/timeout-verdicts.jsonl");
const outPath = value("out");

for (const [label, p] of [["report", reportPath], ["verdicts", ledgerPath]]) {
  if (!existsSync(p)) { console.error(`no ${label} at ${p}`); process.exit(2); }
}
if (!outPath) { console.error("--out is required"); process.exit(2); }

/** Same key the verifier writes: position plus mutation, so mutants sharing a line stay distinct. */
const keyOf = (m) => [m.location.start.line, m.location.start.column,
  m.location.end.line, m.location.end.column, m.mutatorName, m.replacement].join("|");

const verdicts = new Map();
let malformed = 0;
for (const line of readFileSync(ledgerPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try { const e = JSON.parse(line); verdicts.set(e.key, e.verdict); } catch { malformed++; }
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const changed = { Survived: 0, Killed: 0, Timeout: 0 };
let timeouts = 0;
let unverified = 0;

for (const entry of Object.values(report.files)) {
  for (const m of entry.mutants) {
    if (m.status !== "Timeout") continue;
    timeouts++;
    const v = verdicts.get(keyOf(m));
    if (!v) { unverified++; continue; }
    if (v !== m.status) { m.status = v; changed[v]++; }
    else changed.Timeout++;
  }
}

writeFileSync(outPath, JSON.stringify(report));

console.log(`${timeouts} Timeout mutant(s) in the report, ${verdicts.size} verdict(s) on file`);
console.log(`  confirmed as real hangs : ${changed.Timeout}`);
console.log(`  re-filed as SURVIVING   : ${changed.Survived}`);
console.log(`  re-filed as killed      : ${changed.Killed}`);
if (malformed) console.log(`  ${malformed} unparseable ledger line(s) ignored`);
if (unverified) {
  // Loud, because a partial verification silently mixes measured verdicts with assumed ones, and
  // the assumed ones are exactly the direction that hides survivors.
  console.log(`\nWARNING: ${unverified} Timeout mutant(s) have NO verdict and stay "detected".`);
  console.log("The corrected report is incomplete — finish the verification before building a register.");
  process.exit(1);
}
