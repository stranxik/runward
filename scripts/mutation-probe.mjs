#!/usr/bin/env node
// Judges a function's surviving mutants by running a real mission and reading the verdict.
//
// ADR-0046 decision 3 forbids instructing a survivor by reading the code: on an earlier bench of
// four, three survivors declared harmless by reading were live defects. So every verdict here comes
// from applying the mutant and observing runward's own output.
//
// It compares the WHOLE `check --json` payload, not the exit code. The whole-net pass of 2026-08-20
// compared exit codes only, and an exit code cannot see a mutant that changes a message, a count or
// a verdict field without flipping the outcome. Those are still observable by a consumer, so they
// are not "harmless".
//
//   node scripts/mutation-probe.mjs --function spellingViaRealpath
//   node scripts/mutation-probe.mjs --function spellingViaRealpath --mission /tmp/probe-case
//
// Without --mission it runs against this repository's own mission (the self-gate). That is one
// mission and it does not exercise everything: a mutant in the Windows case check cannot change
// runward's own verdict on macOS, where no pointer has a diverging spelling. A "no change" result
// against the self-gate is therefore NOT a verdict of harmless — it is the signal that this mutant
// needs a mission built to exercise it, which is exactly what --mission is for.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { runBounded } from "./bounded-run.mjs";

const argv = process.argv.slice(2);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

const fnName = value("function");
if (!fnName) {
  console.error("usage: mutation-probe.mjs --function <name> [--mission <dir>] [--ledger <file>]");
  process.exit(2);
}

const listPath = resolve(process.cwd(), `reports/mutation/by-function/${fnName}.json`);
if (!existsSync(listPath)) {
  console.error(`no mutant list at ${listPath}`);
  process.exit(2);
}
const list = JSON.parse(readFileSync(listPath, "utf8"));

const mission = value("mission");
const label = mission ? mission : "self-gate";
const ledger = value("ledger") ?? `reports/mutation/probe-${fnName}.jsonl`;
const TIMEOUT_MS = Number(value("timeout-ms") ?? 120_000);

// Rebuild before measuring: a previous run killed with SIGKILL cannot have restored the file, and
// measuring a tree of unknown state produces confident nonsense.
const built = spawnSync("npm", ["run", "build"], { encoding: "utf8" });
if (built.status !== 0) {
  console.error("npm run build failed — refusing to measure a tree of unknown state");
  console.error(built.stderr ?? "");
  process.exit(2);
}

const target = list.file;
const pristine = readFileSync(target, "utf8");

// The mutant list is only meaningful against the build it was measured on.
//
// Every mutant is a line/column range spliced into the file. Fix anything ABOVE a function and its
// mutants now point at other code entirely: the splice still succeeds, the gate still returns a
// verdict, and every result is nonsense produced with confidence. Measured 2026-08-21 — three fixes
// to evidence.js moved `evidenceReport` from line 426 to line 473, so a replay of that bench would
// have spliced 47 lines off target.
//
// The read-back guard added earlier does NOT catch this: it proves the write landed, not that the
// offset still meant something. Refusing is the only safe answer; regenerating the list is cheap
// and re-measuring is the honest cost of having changed the code.
if (list.sourceSha256) {
  const actual = createHash("sha256").update(pristine).digest("hex");
  if (actual !== list.sourceSha256) {
    console.error(`${target} is not the build this mutant list was measured against.`);
    console.error(`  list expects sha256 ${list.sourceSha256.slice(0, 16)}…`);
    console.error(`  this build is       ${actual.slice(0, 16)}…`);
    console.error("Line/column offsets would splice into other code and every verdict would be");
    console.error("fiction. Re-run the mutation pass on this build and regenerate the lists.");
    process.exit(4);
  }
}
let restored = false;
const restore = () => { if (!restored) { writeFileSync(target, pristine); restored = true; } };
process.on("exit", restore);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => { restore(); process.exit(130); });
}

// `--strict` is not optional here, it is what makes the measurement exist.
//
// Found by the textOutsideManifest instruction on 2026-08-20: `computeVerdict` only calls
// `judgeGated` — and therefore `evidenceReport`, the pointer layer, the seal and the corpus check —
// inside `if (opts.strict)` (src/lib/verdict.ts:249). A plain `check --json` never reaches the
// evidence layer at all, so this probe reported "no observable difference" for every mutant in it
// BY CONSTRUCTION rather than by innocence. Demonstrated: on a mission where a mutant flips the
// gate from exit 1 to exit 0, the non-strict probe still reported nothing.
const gateArgs = ["dist/cli.js", "check", "--strict", "--json",
  ...(mission ? ["--path", mission] : [])];

/** The verdict as a consumer would see it: exit status plus the full JSON payload. */
async function readVerdict() {
  const r = await runBounded(process.execPath, gateArgs, { timeoutMs: TIMEOUT_MS, capture: true });
  if (r.timedOut) return { hung: true };
  return { hung: false, status: r.status, out: r.stdout ?? "" };
}

function offsetOf(source, line, column) {
  const lines = source.split("\n");
  let offset = 0;
  for (let i = 0; i < line - 1; i++) offset += lines[i].length + 1;
  return offset + (column - 1);
}

console.log(`${fnName}: ${list.mutants.length} mutant(s), mission = ${label}\n`);

const base = await readVerdict();
if (base.hung) { console.error("the gate hangs on a PRISTINE tree — fix that first"); process.exit(2); }
console.log(`baseline: exit ${base.status}, ${base.out.length} bytes of JSON\n`);

const results = [];
for (const [i, m] of list.mutants.entries()) {
  const start = offsetOf(pristine, m.line, m.column);
  const end = offsetOf(pristine, m.endLine, m.endColumn);
  const mutated = pristine.slice(0, start) + m.replacement + pristine.slice(end);
  writeFileSync(target, mutated);

  // Read the file back and confirm the mutant is really there before measuring.
  //
  // The spellingViaRealpath instruction (2026-08-20) hit a sweep that reported "no observable
  // difference" for two mutants which four later measurements, on the same mission with two
  // different instruments, showed to be observable. Same keys, same path, different verdict, cause
  // never found. "Identical to baseline" and "the mutant was not in effect" are indistinguishable
  // from the outside, and the second one always reads as harmless — the flattering direction this
  // whole exercise exists to refuse. So the premise is checked instead of assumed.
  if (readFileSync(target, "utf8") !== mutated) {
    console.error(`\nL${m.line} ${m.mutator}: the mutant is not on disk after writing it. ` +
      "Refusing to record a verdict about a tree that is not the one under test.");
    process.exit(3);
  }

  const v = await readVerdict();
  let observed;
  if (v.hung) observed = "hangs";
  else if (v.status !== base.status) observed = "exit-code";
  else if (v.out !== base.out) observed = "json";
  else observed = "identical";

  results.push({ key: m.key, line: m.line, mutator: m.mutator, replacement: m.replacement,
    mission: label, observed });
  appendFileSync(ledger, `${JSON.stringify(results.at(-1))}\n`);

  console.log(`[${String(i + 1).padStart(3)}/${list.mutants.length}] L${String(m.line).padEnd(5)} ` +
    `${m.mutator.padEnd(22)} ${observed === "identical" ? "no observable difference" : `OBSERVABLE: ${observed}`}`);
}
restore();

const seen = results.filter((r) => r.observed !== "identical").length;
console.log(`\n${seen}/${results.length} observable on this mission; ` +
  `${results.length - seen} produced an identical verdict.`);
console.log(`ledger: ${ledger}`);
if (!mission) {
  console.log("\nThe identical ones are NOT cleared: the self-gate is one mission. Build a mission " +
    "that exercises this function and re-run with --mission before filing anything as equivalent.");
}
