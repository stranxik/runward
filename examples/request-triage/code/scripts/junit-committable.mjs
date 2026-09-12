#!/usr/bin/env node
// Produce a COMMITTABLE JUnit report (ADR-0073 option 1, ratified 2026-09-12).
//
// WHY A COMMITTED REPORT AT ALL. runward never runs your tools (ADR-0054): it reads a report that
// is already in the tree. So the report has to be a file someone committed — and `node --test
// --test-reporter=junit` writes three things a tree held to determinism cannot carry: an ABSOLUTE
// `file=` path (the layout of whoever ran the tests), a per-case `time=`, and a trailing duration
// comment. This script runs the tests and removes exactly those three, and nothing else.
//
// WHAT IT MUST NEVER DO, and the reason this file is short. It does not touch a verdict: a failing
// case keeps its failure, a skipped case keeps its skip, every name is untouched. If a filter could
// make a red report look green, committing its output would be fabrication — and runward's own rule
// corpus would be the thing teaching it. Evidence is produced, never composed.
//
// AND IT EXITS WITH THE TESTS' OWN CODE. A first version piped the reporter through this filter, so
// `npm run test:junit` returned the FILTER's success and answered 0 on a broken test suite. A script
// that reports green while the tests are red is the exact defect its output is supposed to make
// impossible, so the report is written either way and the test status is what this process returns.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";

const RAW = "reports/junit.raw.xml";
const OUT = "reports/junit.xml";

mkdirSync("reports", { recursive: true });
const run = spawnSync(process.execPath,
  ["--import", "tsx", "--test", "--test-reporter=junit", `--test-reporter-destination=${RAW}`, "test/triage.test.ts"],
  { stdio: ["ignore", "inherit", "inherit"] });

if (!existsSync(RAW)) {
  console.error("junit-committable: the test run produced no report — nothing to make committable");
  process.exit(run.status ?? 2);
}
const raw = readFileSync(RAW, "utf8");
if (!/<testsuites?\b/.test(raw)) {
  console.error("junit-committable: the output is not a JUnit report — refusing to write something that is not one");
  rmSync(RAW);
  process.exit(2);
}
writeFileSync(OUT, raw
  .replace(/\s+file="[^"]*"/g, "")                                  // the machine that ran the tests
  .replace(/\s+time="[^"]*"/g, "")                                  // per-case and per-suite duration
  .replace(/\s+timestamp="[^"]*"/g, "")                             // the suite's wall clock
  .replace(/^[ \t]*<!--\s*duration_ms[^>]*-->\r?\n/gm, ""));        // a timing wearing a comment's disguise
rmSync(RAW);
console.log(`junit-committable: wrote ${OUT} (${(raw.match(/<testcase\b/g) ?? []).length} cases, verdicts untouched)`);
process.exit(run.status ?? 0);
