// The phase-B bound of scripts/mutation-timeouts.mjs, and where it comes from (ADR-0131 A).
//
// Phase B re-runs a Timeout-status mutant through scripts/mutation-testcmd.sh with no coverage map,
// so it runs the WHOLE ordered suite, alone. A mutant still running at the bound is filed
// "Timeout (real hang, detected)": the bound decides between "a hang" and "a survivor", and only one
// of the two errors hides work. A bound under the suite's own duration files every survivor that
// reaches phase B as detected, the false-green direction.
//
// That is what happened. The bound was a constant, 240 s, set when the suite took ~105 s. Measured
// 2026-11-12 on the `evidence` measure of run 43208399067: Stryker's dry run (the same whole suite,
// alone, on the same runner) took 267 to 533 s across the legs, and seven verdicts stopped at
// 243 to 245 s and were filed as real hangs (evidence L51 and L53 StringLiteral, L111
// LogicalOperator and Regex, L251 EqualityOperator and UpdateOperator, L445 ArithmeticOperator).
// None of the seven is known to hang: each was cut off before the suite could have finished.
//
// So the bound follows the suite. The leg's own measurement is Stryker's dry run, which
// stryker.config.json's `fileLogLevel` writes to stryker.log; the bound is FACTOR times it, never
// under FLOOR_MS. Without a measurement it is DEFAULT_MS, well above every dry run measured.

/** The bound a hang costs at least, and the one a quick suite cannot go under: the old constant. */
export const FLOOR_MS = 240_000;
/** Twice the leg's own dry run: the same suite on the same runner, with room for its variance. */
export const FACTOR = 2;
/** No measurement: 900 s, against dry runs of 267 to 533 s on the runner (2026-11-12). */
export const DEFAULT_MS = 900_000;

/** Stryker's own line: "Initial test run succeeded. Ran 1 tests in 5 minutes and 50 seconds (net 350745 ms, overhead 0 ms)." */
const DRY_RUN = /Initial test run succeeded\. Ran \d+ tests? in .*?\(net (\d+) ms, overhead (\d+) ms\)/;

/** The dry run's duration in ms (net plus overhead), from a Stryker log; null when the log has none. */
export function dryRunMsFromLog(text) {
  const m = DRY_RUN.exec(String(text ?? ""));
  if (!m) return null;
  const ms = Number(m[1]) + Number(m[2]);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * The phase-B bound, and why, for the log. An explicit `limitMs` (the `--limit-ms` flag) is the
 * operator's and wins; else FACTOR × the measured suite, at least `floorMs`; else DEFAULT_MS.
 * @returns {{ ms: number, why: string }}
 */
export function phaseBBound({ limitMs = null, suiteMs = null, floorMs = FLOOR_MS, factor = FACTOR, defaultMs = DEFAULT_MS } = {}) {
  if (limitMs !== null && limitMs !== undefined) {
    const ms = Number(limitMs);
    if (!Number.isFinite(ms) || ms <= 0) throw new Error(`--limit-ms must be a positive number of milliseconds, got ${limitMs}`);
    return { ms, why: `--limit-ms ${ms}` };
  }
  if (Number.isFinite(suiteMs) && suiteMs > 0) {
    const ms = Math.max(floorMs, Math.ceil(factor * suiteMs));
    return { ms, why: `${factor} x the leg's dry run of ${(suiteMs / 1000).toFixed(1)} s, floor ${floorMs / 1000} s` };
  }
  return { ms: defaultMs, why: `no dry-run measurement, the default ${defaultMs / 1000} s` };
}

/**
 * The verdict on one mutant from its two phases, as mutation-timeouts.mjs files it. `a` is null
 * when the module has no tests of its own; `b` is null when phase A decided. Each is runBounded's
 * result: `timedOut` is the hang, never an exit code.
 */
export function verdictOf(a, b) {
  if (a && a.timedOut) return "Timeout";
  if (a && a.status !== 0) return "Killed";
  if (!b) throw new Error("phase A passed: phase B must run");
  return b.timedOut ? "Timeout" : b.status === 0 ? "Survived" : "Killed";
}
