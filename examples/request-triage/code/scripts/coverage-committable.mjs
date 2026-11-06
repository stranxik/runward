#!/usr/bin/env node
// Produce a COMMITTABLE coverage report, reports/lcov.info (runward ADR-0115; the pattern is
// scripts/junit-committable.mjs, ADR-0073 option 1).
//
// WHY COVERAGE AT ALL. A JUnit report says which cases ran green; it cannot say whether a case still
// exercises the code it is named after. Empty every test body, keep the names, regenerate the report:
// it is green, case for case. The coverage report is what changes, because the domain no longer runs.
// A manifest row that cites `file:code/reports/lcov.info#src/core/domain/guard.ts` is refused by the
// gate when nothing executed that file (presence and non-vacuity, never a threshold: a threshold is
// a policy, and policy is your CI's).
//
// WHAT IT REMOVES, and nothing else. Node.js's lcov reporter writes each `SF:` record with the
// ABSOLUTE path of the machine that ran the tests. This script makes that path relative to this
// package, with `/` separators. Every count, every line and every record is left as the runner wrote
// it, so a file nothing exercised stays a file nothing exercised.
//
// AND IT EXITS WITH THE TESTS' OWN CODE, for the reason junit-committable.mjs gives: a script that
// answers green on a red suite is the defect its output exists to prevent.
//
// `node scripts/coverage-committable.mjs [dir]` writes into `dir` (default `reports/`).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIR = resolve(ROOT, process.argv[2] ?? "reports");
const RAW = join(DIR, "lcov.raw.info");
const OUT = join(DIR, "lcov.info");
const TESTS = existsSync(join(ROOT, "test")) ? readdirSync(join(ROOT, "test")).filter((f) => f.endsWith(".test.ts")).sort().map((f) => `test/${f}`) : [];
if (TESTS.length === 0) {
  console.error("coverage-committable: no test/*.test.ts file — there is no suite to measure");
  process.exit(2);
}

mkdirSync(DIR, { recursive: true });
// Only the code under src/ is measured: the test files themselves are not the subject, and Node.js
// releases have not always agreed on whether a test file is included by default.
const run = spawnSync(process.execPath,
  ["--import", "tsx", "--test", "--experimental-test-coverage", "--test-coverage-include=src/**",
    "--test-reporter=lcov", `--test-reporter-destination=${RAW}`, ...TESTS],
  { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] });

if (!existsSync(RAW)) {
  console.error("coverage-committable: the test run produced no coverage report");
  process.exit(run.status || 2);
}
const raw = readFileSync(RAW, "utf8");
rmSync(RAW);
const posix = (p) => p.split("\\").join("/");
const lcov = raw.split(/\r?\n/).map((line) => (line.startsWith("SF:") ? `SF:${posix(relative(ROOT, line.slice(3)))}` : line)).join("\n");
// Written whatever it says, even when it measured nothing: keeping the previous file would leave a
// report of a run that did not happen in the tree, green where this one is not.
writeFileSync(OUT, lcov.endsWith("\n") ? lcov : lcov + "\n");
const shown = relative(ROOT, OUT).startsWith("..") ? OUT : posix(relative(ROOT, OUT));
const files = (lcov.match(/^SF:/gm) ?? []).length;
if (files === 0) {
  console.error(`coverage-committable: wrote ${shown}, and it records no source file: the suite exercised nothing under src/, which is not evidence`);
  process.exit(run.status || 1);
}
console.log(`coverage-committable: wrote ${shown} (${files} source file(s), counts untouched)`);
process.exit(run.status ?? 0);
