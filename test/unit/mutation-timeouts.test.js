// ADR-0131 A: phase B of the timeout verification (scripts/mutation-timeouts.mjs) is bounded above
// the suite's own duration, so a survivor slower than the old constant is not filed as a hang.
//
// Phase B runs the whole suite on a mutant that passed its module's own tests; a mutant still
// running at the bound is filed "Timeout (real hang, detected)". The bound was 240 s, set against a
// ~105 s suite. Measured 2026-11-12 on the `evidence` measure (run 43208399067), Stryker's dry run
// of the same suite took 267 to 533 s on the runner, and seven verdicts stopped at 243 to 245 s and
// were filed as hangs: the false-green direction. These cases hold the bound to the suite (twice the
// leg's dry run, never under 240 s, 900 s with no measurement), and run the real script on a
// throwaway tree whose "suite" outlives a bound set the old way: filed Survived with the derived
// bound, and, as the positive control, filed a hang with a fixed bound under its duration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { phaseBBound, dryRunMsFromLog, verdictOf, FLOOR_MS, FACTOR, DEFAULT_MS } from "../../scripts/mutation-timeout-bounds.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The line Stryker logged on one leg of run 43208399067 (evidence), as it logs it.
const LOGGED = "14:09:12 (2262) INFO DryRunExecutor Initial test run succeeded. Ran 1 tests in 5 minutes and 50 seconds (net 350745 ms, overhead 0 ms).";

test("the phase-B bound follows the leg's dry run, never under the old constant, and is well above every measured suite without one", () => {
  assert.equal(dryRunMsFromLog(`noise\n${LOGGED}\nmore`), 350_745);
  assert.equal(dryRunMsFromLog("Initial test run succeeded. Ran 12 tests in 2 seconds (net 1500 ms, overhead 250 ms)."), 1750);
  assert.equal(dryRunMsFromLog("Initial test run timed out!"), null);
  assert.equal(dryRunMsFromLog(undefined), null);

  // The leg's own measurement: twice it. 701.5 s against 244.8 s, the slowest of the seven verdicts
  // the 240 s bound filed as hangs, and against 533 s, the slowest dry run of the run.
  const measured = phaseBBound({ suiteMs: 350_745 });
  assert.equal(measured.ms, Math.ceil(FACTOR * 350_745));
  assert.ok(measured.ms > 244_800 && measured.ms > 533_000 * 1.3, `${measured.ms}`);
  assert.match(measured.why, /dry run of 350\.7 s/);
  // A quick suite does not take the bound under the old constant.
  assert.equal(phaseBBound({ suiteMs: 20_000 }).ms, FLOOR_MS);
  assert.equal(FLOOR_MS, 240_000);
  // No measurement: the default, above every dry run measured on the runner (267 to 533 s).
  assert.equal(phaseBBound({}).ms, DEFAULT_MS);
  assert.ok(DEFAULT_MS >= 900_000);
  assert.equal(phaseBBound({ suiteMs: null }).ms, DEFAULT_MS);
  assert.equal(phaseBBound({ suiteMs: Number.NaN }).ms, DEFAULT_MS);
  // `--limit-ms` is the operator's and wins; a bad one is refused, never read as zero.
  assert.equal(phaseBBound({ limitMs: "120000", suiteMs: 350_745 }).ms, 120_000);
  assert.throws(() => phaseBBound({ limitMs: "soon" }), /--limit-ms must be a positive number/);
  assert.throws(() => phaseBBound({ limitMs: "0" }), /--limit-ms must be a positive number/);
});

test("the verdict of the two phases: a hang is `timedOut`, never an exit code", () => {
  assert.equal(verdictOf({ timedOut: true, status: null }, null), "Timeout");
  assert.equal(verdictOf({ timedOut: false, status: 1 }, null), "Killed");
  assert.equal(verdictOf({ timedOut: false, status: 0 }, { timedOut: false, status: 0 }), "Survived");
  assert.equal(verdictOf(null, { timedOut: false, status: 0 }), "Survived", "no tests of its own: phase B decides");
  assert.equal(verdictOf({ timedOut: false, status: 0 }, { timedOut: false, status: 1 }), "Killed");
  // node exits with an ordinary status when the bound kills it: timedOut decides, not the status.
  assert.equal(verdictOf({ timedOut: false, status: 0 }, { timedOut: true, status: 1 }), "Timeout");
  assert.throws(() => verdictOf({ timedOut: false, status: 0 }, null), /phase B must run/);
});

/**
 * A throwaway tree for scripts/mutation-timeouts.mjs: one module, one Timeout-status mutant in its
 * report, a module test that passes at once (phase A passes, as a survivor's does), and a whole
 * "suite" (the test command) that passes after `suiteSeconds`: a survivor slower than a bound set
 * under it. `npm run build` is a no-op here; the script restores the module on the way out.
 */
function tree({ suiteSeconds, logged }) {
  const root = mkdtempSync(join(tmpdir(), "rw-timeouts-"));
  for (const d of ["scripts", "dist/lib", "test/unit", "reports/mutation"]) mkdirSync(join(root, d), { recursive: true });
  for (const f of ["mutation-timeouts.mjs", "mutation-timeout-bounds.mjs", "bounded-run.mjs"]) cpSync(join(ROOT, "scripts", f), join(root, "scripts", f));
  writeFileSync(join(root, "scripts", "mutation-testcmd.sh"), `#!/bin/bash\nsleep ${suiteSeconds}\nexit 0\n`);
  chmodSync(join(root, "scripts", "mutation-testcmd.sh"), 0o755);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t", private: true, type: "module", scripts: { build: "node -e 0" } }));
  const source = "export const greeting = \"hello\";\n";
  writeFileSync(join(root, "dist/lib/alpha.js"), source);
  writeFileSync(join(root, "test/unit/alpha.test.js"), 'import { test } from "node:test"; test("passes", () => {});\n');
  writeFileSync(join(root, "reports/mutation/mutation.json"), JSON.stringify({ files: { "dist/lib/alpha.js": { source, mutants: [{
    id: "0", mutatorName: "StringLiteral", replacement: '""', status: "Timeout",
    location: { start: { line: 1, column: 25 }, end: { line: 1, column: 32 } },
  }] } } }));
  if (logged) writeFileSync(join(root, "stryker.log"), `${logged}\n`);
  return root;
}

function verify(root, args) {
  // Never under this run's NODE_TEST_CONTEXT (the script's own `node --test` would skip its file as
  // recursive) nor its NODE_V8_COVERAGE.
  const { NODE_TEST_CONTEXT: _t, NODE_V8_COVERAGE: _c, ...env } = process.env;
  const r = spawnSync(process.execPath, ["scripts/mutation-timeouts.mjs", "--report", "reports/mutation/mutation.json", "--module", "alpha", "--ledger", "reports/mutation/v.jsonl", ...args],
    { cwd: root, encoding: "utf8", env });
  const ledger = readFileSync(join(root, "reports/mutation/v.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  return { ...r, ledger };
}

test("a survivor slower than a bound set the old way is filed Survived; the old fixed bound files it a hang (positive control)", { skip: process.platform === "win32" ? "POSIX bash harness: the mutation ratchet runs on Linux runners only" : false }, () => {
  // The suite takes 3 s; the leg's dry run logged 2 s. Scaled down 100x, the floor at 1 s: the
  // derived bound is 4 s, and the survivor finishes inside it.
  let root = tree({ suiteSeconds: 3, logged: "Initial test run succeeded. Ran 1 tests in 2 seconds (net 2000 ms, overhead 0 ms)." });
  try {
    const r = verify(root, ["--phase-b-floor-ms", "1000"]);
    assert.match(r.stdout, /phase B 4 s \(2 x the leg's dry run of 2\.0 s, floor 1 s\)/, r.stdout + r.stderr);
    assert.equal(r.ledger.length, 1);
    assert.equal(r.ledger[0].verdict, "Survived", r.stdout);
    assert.match(r.stdout, /survivor hidden as a timeout: L1 StringLiteral/);
    assert.equal(r.status, 1, "a Timeout that is a survivor fails the verification, so the register is not built on it");
    assert.equal(readFileSync(join(root, "dist/lib/alpha.js"), "utf8"), "export const greeting = \"hello\";\n", "the module is restored");
  } finally { rmSync(root, { recursive: true, force: true }); }

  // CONTROL: the same survivor under a fixed bound below its duration, 2.4 s against 3 s (240 s
  // against a suite of 267 to 533 s, scaled): filed as a real hang, detected. The error ADR-0131 removes.
  root = tree({ suiteSeconds: 3, logged: null });
  try {
    const r = verify(root, ["--limit-ms", "2400"]);
    assert.equal(r.ledger[0].verdict, "Timeout", r.stdout);
    assert.match(r.stdout, /\(real hang, detected\)/);
    assert.equal(r.status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
