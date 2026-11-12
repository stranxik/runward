#!/usr/bin/env node
// The part of Stryker's incremental mode that ADR-0106 relies on, run against the Stryker this tree installs.
//
//   node test/stryker-incremental-contract.js
//
// The release ratchet reuses a previous release's SURVIVORS through Stryker's own incremental mode: each
// leg is handed an incremental file holding only the survivors runward admitted, and Stryker re-runs
// everything else. That is sound only if Stryker behaves as read in
// node_modules/@stryker-mutator/core/src/mutants/incremental-differ.ts (10.1.1):
//
//   1. a mutant whose code did not change is taken from the file, with the file's `statusReason`, which is
//      how the ratchet counts what was reused;
//   2. a mutant the file does not carry is measured (so a killed mutant, which the file never carries, is
//      always re-measured);
//   3. a mutant whose code changed is measured, whatever the file says.
//
// And it is why runward checks the tests itself: with the command runner and coverageAnalysis "off",
// Stryker has no per-test coverage, and `mutantCanBeReused` returns true for every unchanged mutant
// ("This is the best we can do when the test runner didn't report coverage"). A changed test is invisible
// to it. Case 4 below records that blindness as observed, so the ADR's reading stays checked; case 5
// records that Stryker carries a file's mutant OUTSIDE the `--mutate` range into the report, which is why
// each leg trims its report to its range (scripts/mutation-reuse.mjs trim).
//
// Exit 0 when cases 1 to 3 hold, 1 when one does not (the plan job then measures the whole perimeter: a
// Stryker that behaves otherwise must not be trusted with a reuse), 2 when Stryker could not be run.
// Runs in a throwaway directory, about fifteen seconds; it is not a unit test, because the unit suite runs
// once per mutant and this would add its fifteen seconds to every one of them.

import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STRYKER = join(ROOT, "node_modules", "@stryker-mutator", "core", "bin", "stryker.js");
const MARK = "reused by ADR-0106 (contract)";

const dir = mkdtempSync(join(tmpdir(), "runward-stryker-contract-"));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); };

const SOURCE = [
  "exports.add = function (a, b) { return a + b; };",
  "exports.isAdult = function (age) { return age >= 18; };",
  "",
].join("\n");
const WEAK_TEST = [
  "const s = require('./src.js');",
  "const assert = require('assert');",
  "assert.strictEqual(s.add(2, 3), 5);",
  "assert.strictEqual(s.isAdult(30), true);",
  "assert.strictEqual(s.isAdult(5), false);",
  "",
].join("\n");
// The boundary assertion kills `age > 18`, the survivor the weak test leaves.
const STRONG_TEST = WEAK_TEST.replace("assert.strictEqual(s.isAdult(5), false);", "assert.strictEqual(s.isAdult(5), false);\nassert.strictEqual(s.isAdult(18), true);");

function stryker(mutate, force) {
  const config = {
    testRunner: "command",
    commandRunner: { command: "node test.js" },
    coverageAnalysis: "off",
    mutate: [mutate],
    plugins: [],
    reporters: ["json"],
    jsonReporter: { fileName: "reports/mutation.json" },
    incremental: true,
    incrementalFile: "reports/incremental.json",
    concurrency: 1,
    tempDirName: ".stryker-tmp",
    cleanTempDir: true,
    logLevel: "warn",
  };
  writeFileSync(join(dir, "stryker.conf.json"), JSON.stringify(config));
  const r = spawnSync(process.execPath, [STRYKER, "run", "stryker.conf.json", ...(force ? ["--force"] : [])], {
    cwd: dir, encoding: "utf8", timeout: 180_000,
  });
  if (r.status !== 0) {
    throw new Error(`stryker exited ${r.status ?? r.signal}: ${(r.stderr || r.stdout || "").slice(-800)}`);
  }
  return JSON.parse(readFileSync(join(dir, "reports", "mutation.json"), "utf8"));
}

const mutantsOf = (report) => Object.values(report.files).flatMap((f) => f.mutants);
const onLine = (report, line) => mutantsOf(report).filter((m) => m.location.start.line === line);
const survivorsOnly = (report) => ({
  schemaVersion: report.schemaVersion,
  thresholds: report.thresholds,
  files: Object.fromEntries(Object.entries(report.files).map(([f, e]) => [f, {
    language: e.language,
    source: e.source,
    mutants: e.mutants.filter((m) => m.status === "Survived").map((m) => ({ ...m, statusReason: MARK })),
  }])),
});

let code = 0;
try {
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "contract", private: true }));
  writeFileSync(join(dir, "src.js"), SOURCE);
  writeFileSync(join(dir, "test.js"), WEAK_TEST);
  mkdirSync(join(dir, "reports"), { recursive: true });

  // The baseline: a full measurement, as a release that has no previous bundle runs it.
  const full = stryker("src.js", true);
  const survivors = mutantsOf(full).filter((m) => m.status === "Survived");
  const killed = mutantsOf(full).filter((m) => m.status === "Killed");
  if (survivors.length === 0 || killed.length === 0) throw new Error(`the baseline needs a survivor and a kill, got ${survivors.length} and ${killed.length}`);
  const incremental = JSON.stringify(survivorsOnly(full));

  // Cases 1 and 2: the file carries the survivors only.
  writeFileSync(join(dir, "reports", "incremental.json"), incremental);
  const reuse = stryker("src.js", false);
  const reused = mutantsOf(reuse).filter((m) => m.statusReason === MARK);
  check("1. an unchanged mutant the file carries is taken from it, with the file's statusReason",
    reused.length === survivors.length && reused.every((m) => m.status === "Survived"),
    `${reused.length} of ${survivors.length} survivor(s) reused`);
  const remeasured = mutantsOf(reuse).filter((m) => m.statusReason !== MARK);
  check("2. a mutant the file does not carry (every kill) is measured",
    remeasured.length === mutantsOf(full).length - survivors.length,
    `${remeasured.length} measured, ${killed.length} killed in the baseline`);

  // Case 3: the survivor's line changes (an equivalent rewrite, so only the text moves).
  writeFileSync(join(dir, "src.js"), SOURCE.replace("return age >= 18;", "return (age >= 18);"));
  writeFileSync(join(dir, "reports", "incremental.json"), incremental);
  const changed = stryker("src.js", false);
  const line2 = onLine(changed, 2);
  check("3. a mutant whose code changed is measured, whatever the file says",
    line2.length > 0 && line2.every((m) => m.statusReason !== MARK),
    `${line2.filter((m) => m.statusReason === MARK).length} of ${line2.length} mutant(s) on the changed line taken from the file`);
  writeFileSync(join(dir, "src.js"), SOURCE);

  // Case 4 (observed, not required): a test that now kills the survivor is invisible to Stryker here.
  writeFileSync(join(dir, "test.js"), STRONG_TEST);
  writeFileSync(join(dir, "reports", "incremental.json"), incremental);
  const blind = stryker("src.js", false);
  const stillReused = mutantsOf(blind).filter((m) => m.statusReason === MARK).length;
  results.push({ name: "4. (observed) a changed test does not stop Stryker reusing a survivor under the command runner", ok: null,
    detail: stillReused > 0 ? `yes: ${stillReused} survivor(s) reused although the test now kills them; runward checks the covering tests itself` : "no: Stryker re-measured them" });
  writeFileSync(join(dir, "test.js"), WEAK_TEST);

  // Case 5 (observed, not required): a mutant of the file outside the `--mutate` range.
  writeFileSync(join(dir, "reports", "incremental.json"), incremental);
  const ranged = stryker("src.js:1-1", false);
  const outside = mutantsOf(ranged).filter((m) => m.location.start.line > 1).length;
  results.push({ name: "5. (observed) Stryker carries a file's mutant outside the --mutate range into the report", ok: null,
    detail: outside > 0 ? `yes: ${outside} mutant(s) past line 1; each leg trims its report to its range` : "no" });
} catch (e) {
  console.error(`stryker-incremental-contract: ${e.message}`);
  console.error("REFUSED: the contract could not be run. The plan job measures the whole perimeter.");
  code = 2;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

for (const r of results) console.log(`${r.ok === null ? "info" : r.ok ? "ok  " : "FAIL"}  ${r.name}: ${r.detail}`);
if (code === 0 && results.some((r) => r.ok === false)) {
  console.error("\nthe Stryker installed does not behave as ADR-0106 reads it: no reuse.");
  code = 1;
} else if (code === 0) {
  console.log("\nStryker's incremental mode behaves as ADR-0106 reads it.");
}
process.exit(code);
