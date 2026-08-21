#!/usr/bin/env node
// Measures what each unit test file costs, and writes it down.
//
// This exists to make mutation testing affordable as the suite grows (ADR-0046 decision 3: an
// instrument that makes every change wait gets switched off). Stryker's command runner re-runs the
// whole test command per mutant, so the cost of a mutant is the cost of the suite — unless the
// command can stop early, and stopping early is only worth anything if the cheap tests run first.
//
// Measured 2026-08-19 on 70 files: 155 s sequential, of which the ten slowest are 121 s. Fifty-two
// files together cost 11.6 s. That skew is the whole opportunity.
//
//   node scripts/test-cost.mjs          # measure and rewrite test/unit-cost.json
//
// Re-run it when the suite's shape changes. A stale file costs time, never truth: the split only
// decides the ORDER tests run in, and a mutant is killed iff some test fails in any order.

import { readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const OUT = "test/unit-cost.json";
const DIR = "test/unit";

const files = readdirSync(DIR).filter((f) => f.endsWith(".test.js")).sort();
const measured = [];

for (const f of files) {
  const rel = `${DIR}/${f}`;
  const t0 = Date.now();
  const r = spawnSync("node", ["--test", rel], { stdio: "ignore", timeout: 300_000 });
  const seconds = Number(((Date.now() - t0) / 1000).toFixed(2));
  measured.push({ file: rel, seconds, passed: r.status === 0 });
  process.stderr.write(`${seconds.toFixed(1).padStart(6)}s  ${f}\n`);
}

measured.sort((a, b) => b.seconds - a.seconds || a.file.localeCompare(b.file));
const total = measured.reduce((n, m) => n + m.seconds, 0);

// The threshold is not a tuned constant. It is the point where the tail stops mattering: below it
// a whole batch of files costs less than one file above it, so running the batch first is free.
const THRESHOLD = 1.5;
const slow = measured.filter((m) => m.seconds >= THRESHOLD);
const fast = measured.filter((m) => m.seconds < THRESHOLD);

writeFileSync(OUT, `${JSON.stringify({
  _comment: [
    "Measured cost of each unit test file, written by scripts/test-cost.mjs.",
    "Consumed by scripts/mutation-testcmd.sh to run cheap tests before expensive ones, so a killed",
    "mutant does not pay for the slow half of the suite. Ordering cannot change a verdict: a mutant",
    "is killed iff some test fails. A stale file therefore costs time and never truth.",
    "Re-measure with: node scripts/test-cost.mjs",
  ],
  measuredOn: new Date().toISOString().slice(0, 10),
  thresholdSeconds: THRESHOLD,
  totalSeconds: Number(total.toFixed(1)),
  slowSeconds: Number(slow.reduce((n, m) => n + m.seconds, 0).toFixed(1)),
  slow: slow.map((m) => m.file),
  files: measured,
}, null, 2)}\n`);

const failed = measured.filter((m) => !m.passed);
process.stderr.write(
  `\n${OUT} written: ${measured.length} files, ${total.toFixed(0)} s total, ` +
  `${slow.length} slow (${slow.reduce((n, m) => n + m.seconds, 0).toFixed(0)} s) / ` +
  `${fast.length} fast (${fast.reduce((n, m) => n + m.seconds, 0).toFixed(1)} s)\n`);
if (failed.length) {
  // Measuring a red suite is legitimate (that is what a mutant does), but silently measuring a red
  // suite you did not mean to have is how a broken tree gets baked into a cost model.
  process.stderr.write(`WARNING: ${failed.length} file(s) failed: ${failed.map((m) => m.file).join(", ")}\n`);
}
