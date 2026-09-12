#!/usr/bin/env node
// runward's own committable JUnit report (ADR-0073 option 1, applied to the product itself).
//
// The product demands `requires: junit` of its users on 29 rules, and its own mission could not
// satisfy one of them: it committed no report anywhere. ADR-0073 named that plainly — the product
// cannot ask of others what it declines to do — and this is the gesture that closes it, the same one
// the shipped example uses.
//
// It removes exactly what a deterministic tree cannot carry (the absolute `file=` path of whoever
// ran the suite, the per-case `time=`, the suite wall clock, the trailing duration comment) and
// touches NO verdict: a failing case keeps its failure, a skipped case keeps its skip, every name is
// untouched. If a filter could green a red run, committing its output would be fabrication.
//
// It exits with the SUITE's status, never the filter's: a script reporting green over red tests is
// the defect its own output exists to prevent.
//
//   npm run test:junit     → reports/junit.xml, committed, cited by the manifest rows
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";

const RAW = "reports/junit.raw.xml";
const OUT = "reports/junit.xml";
const files = readdirSync("test/unit").filter((f) => f.endsWith(".test.js")).sort().map((f) => `test/unit/${f}`);

mkdirSync("reports", { recursive: true });
const run = spawnSync(process.execPath,
  ["--test", "--test-reporter=junit", `--test-reporter-destination=${RAW}`, ...files],
  { stdio: ["ignore", "inherit", "inherit"] });

if (!existsSync(RAW)) {
  console.error("junit-committable: the suite produced no report — nothing to make committable");
  process.exit(run.status ?? 2);
}
const raw = readFileSync(RAW, "utf8");
if (!/<testsuites?\b/.test(raw)) {
  console.error("junit-committable: the output is not a JUnit report — refusing to write something that is not one");
  rmSync(RAW);
  process.exit(2);
}
writeFileSync(OUT, raw
  .replace(/\s+file="[^"]*"/g, "")
  .replace(/\s+time="[^"]*"/g, "")
  .replace(/\s+timestamp="[^"]*"/g, "")
  .replace(/^[ \t]*<!--\s*duration_ms[^>]*-->\r?\n/gm, ""));
rmSync(RAW);
console.log(`junit-committable: wrote ${OUT} (${(raw.match(/<testcase\b/g) ?? []).length} cases, verdicts untouched)`);
process.exit(run.status ?? 0);
