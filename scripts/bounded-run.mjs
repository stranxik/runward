// Runs a child process under a deadline, and kills its whole process tree when the deadline hits.
//
// WHY THIS EXISTS, MEASURED 2026-08-20. The mutation harness used spawnSync's `timeout`, which
// sends SIGTERM to the direct child only. `node --test` runs each test file in its own process
// (--test-isolation=process), so a timed-out suite left roughly a dozen grandchildren running
// forever, each still executing the mutant. They accumulated across iterations: measured load
// average 78 on an 8-core machine, with 32 orphans alive after the driver had been killed.
//
// Every verdict taken in that state was noise. It produced a false "51 of 53 timeouts are really
// survivors", and it also produced the opposite error — a mutant that genuinely hangs for over
// 400 s was filed as a survivor in 27 s. Contention corrupts a mutation run in BOTH directions,
// which is what makes it worse than slowness.
//
// `detached: true` puts the child in its own process group, so `kill(-pid)` reaches the whole tree.
// The group is swept after a normal exit too: a suite can return while a stray worker of its own
// is still alive, and that straggler would otherwise pollute the next measurement.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";

/**
 * @returns {Promise<{status: number|null, signal: string|null, timedOut: boolean}>}
 *   `timedOut` is the honest answer to "did this hang", and is never inferred from an exit code:
 *   node installs its own SIGTERM handler and exits with an ordinary status when killed, so an
 *   exit code cannot distinguish a hang from an ordinary failure.
 */
export function runBounded(command, args, { timeoutMs, env, shell = false, capture = false } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        // Output is dropped unless asked for: most callers only need a verdict, and buffering a
        // whole test suite's chatter for hundreds of mutants is memory spent on nothing.
        stdio: capture ? ["ignore", "pipe", "pipe"] : "ignore",
        detached: true, env, shell,
      });
    } catch (error) {
      resolve({ status: null, signal: null, timedOut: false, error });
      return;
    }

    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.on("data", (c) => { stdout += c; });
      child.stderr.on("data", (c) => { stderr += c; });
    }

    // A detached child is its own group leader, so its pgid equals its pid.
    const sweep = () => {
      try { process.kill(-child.pid, "SIGKILL"); } catch { /* group already empty */ }
    };

    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; sweep(); }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      sweep();
      resolve({ status: null, signal: null, timedOut: false, error, stdout, stderr });
    });

    // "close" rather than "exit": exit fires when the process ends, which can be before its pipes
    // have been drained, and a verdict compared against a truncated payload is a false difference.
    child.on(capture ? "close" : "exit", (status, signal) => {
      clearTimeout(timer);
      sweep();
      resolve({ status, signal, timedOut, stdout, stderr });
    });
  });
}

/**
 * Refuses to start when another run of the same harness is alive.
 *
 * Two instances ran concurrently on 2026-08-20, each spawning whole test suites, and neither could
 * have produced a valid timing. A mutation harness is a measuring instrument: a second copy of it
 * is not slower, it is wrong.
 */
export function claimExclusive(name) {
  const lock = `reports/mutation/${name}.pid`;
  mkdirSync("reports/mutation", { recursive: true });
  if (existsSync(lock)) {
    const previous = Number(readFileSync(lock, "utf8").trim());
    if (previous && alive(previous)) {
      console.error(`another ${name} is already running (pid ${previous}).`);
      console.error("Two concurrent runs cannot both be measuring anything. Stop it first:");
      console.error(`  kill -9 -$(ps -o pgid= -p ${previous} | tr -d ' ')`);
      process.exit(2);
    }
  }
  writeFileSync(lock, String(process.pid));
  const release = () => { try { unlinkSync(lock); } catch { /* already gone */ } };
  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => { release(); process.exit(130); });
  }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

