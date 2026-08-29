// Merging chunk reports must carry the timeout verification forward, or discard the verdict.
//
// A chunked run verifies its timeouts CHUNK BY CHUNK: `mutation-timeouts.mjs` re-runs each
// Timeout-status mutant alone, `mutation-apply-verdicts.mjs` stamps `_runwardTimeoutsVerified` on
// that chunk. `mutation-ratchet.mjs` reads that stamp and refuses to compare anything without it,
// because Stryker counts a Timeout as DETECTED and an unverified one can be hiding a survivor.
//
// On 2026-08-25 the first full chunked run of `evidence` came back with all thirty chunks measured,
// four of them carrying timeouts, and all four verified — eight real hangs, none re-filed. The
// merge then built a fresh object and copied only `files` into it, so every stamp was dropped, and
// the ratchet refused the merged report for carrying "8 unverified timeouts". The verification had
// run; the evidence of it was thrown away one line before it was needed.
//
// Nothing tested the merge, which is why it shipped. The direction of the failure was safe — a
// refusal, not a false green — but a chain that can never reach a verdict is a chain nobody keeps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = join(process.cwd(), "scripts/mutation-survivors.mjs");

/** One mutant, Stryker-shaped, at a line of its own so no two collide on identity. */
const mutant = (id, status, line) => ({
  id: String(id),
  mutatorName: "ConditionalExpression",
  replacement: "true",
  status,
  location: { start: { line, column: 1 }, end: { line, column: 9 } },
});

/**
 * A chunk report. `verified` stamps it the way mutation-apply-verdicts.mjs does; omit it to model a
 * chunk whose timeouts were never re-run.
 */
function chunk(mutants, verified) {
  const report = {
    schemaVersion: "1.0",
    files: {
      "dist/lib/evidence.js": {
        source: Array.from({ length: 40 }, (_, i) => `const line${i + 1} = 1;`).join("\n"),
        mutants,
      },
    },
  };
  if (verified) report._runwardTimeoutsVerified = verified;
  return report;
}

/** Lay the chunks out where the script looks for them and run the real merge. */
function merge(...chunks) {
  const root = mkdtempSync(join(tmpdir(), "rw-merge-"));
  const dir = join(root, "reports", "mutation", "chunks");
  mkdirSync(dir, { recursive: true });
  chunks.forEach((c, i) => {
    writeFileSync(join(dir, `evidence-${String(i + 1).padStart(4, "0")}.json`), JSON.stringify(c));
  });
  const out = join(root, "merged.json");
  try {
    const run = spawnSync(process.execPath, [SCRIPT, "--chunks", "evidence", "--emit-merged", out],
      { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, `the merge itself must succeed — stderr: ${run.stderr}`);
    return { merged: JSON.parse(readFileSync(out, "utf8")), stderr: run.stderr };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test("every chunk that files a Timeout was verified: the merge carries the stamp", () => {
  const { merged, stderr } = merge(
    chunk([mutant(1, "Killed", 1), mutant(2, "Survived", 2)]),
    chunk([mutant(3, "Timeout", 3)], { verdicts: 1, confirmedHangs: 1, refiledSurviving: 0, refiledKilled: 0 }),
    chunk([mutant(4, "Timeout", 4), mutant(5, "Timeout", 5)],
      { verdicts: 2, confirmedHangs: 2, refiledSurviving: 0, refiledKilled: 0 }),
  );
  assert.ok(merged._runwardTimeoutsVerified,
    "the ratchet reads this stamp before it will compare anything; without it the run is refused");
  assert.equal(merged._runwardTimeoutsVerified.confirmedHangs, 3, "the rollup sums across chunks");
  assert.equal(merged._runwardTimeoutsVerified.chunks, 2, "two chunks contributed a verification");
  assert.match(stderr, /verified in 2 chunk/, "and it says so, so a reader can check the arithmetic");
});

test("one unverified chunk leaves the WHOLE merge unstamped", () => {
  // Not "29 of 30 checked". The ratchet's question is whether a Timeout in THIS report can be
  // hiding a survivor, and one unchecked chunk answers yes for the report as a whole. A qualified
  // stamp is the shape that gets read as a clean one.
  const { merged, stderr } = merge(
    chunk([mutant(1, "Timeout", 1)], { verdicts: 1, confirmedHangs: 1, refiledSurviving: 0, refiledKilled: 0 }),
    chunk([mutant(2, "Timeout", 2)]),   // measured, never re-run alone
  );
  assert.equal(merged._runwardTimeoutsVerified, undefined,
    "a partial verification must not produce a stamp — the ratchet has to refuse this report");
  assert.match(stderr, /carry no verification/, "and the refusal must name what is missing");
  assert.match(stderr, /evidence-0002\.json/, "by chunk, so the next run knows what to re-verify");
});

test("a chunk with no timeouts owes no stamp and does not block the merge", () => {
  // The clean case must never be the one that breaks the chain. That mistake has already been made
  // once in this pipeline: on 2026-08-25 a healthy `paths` chunk produced no verified.json and the
  // ratchet reported "0 of 1 chunks measured" — a module failing for being healthy.
  const { merged } = merge(
    chunk([mutant(1, "Killed", 1)]),
    chunk([mutant(2, "Survived", 2)]),
    chunk([mutant(3, "Timeout", 3)], { verdicts: 1, confirmedHangs: 1, refiledSurviving: 0, refiledKilled: 0 }),
  );
  assert.ok(merged._runwardTimeoutsVerified, "two unstamped chunks carried no timeouts to verify");
  assert.equal(merged._runwardTimeoutsVerified.chunks, 1);
});

test("no chunk carries a timeout at all: nothing to stamp, nothing to refuse", () => {
  const { merged } = merge(chunk([mutant(1, "Killed", 1)]), chunk([mutant(2, "Survived", 2)]));
  assert.equal(merged._runwardTimeoutsVerified, undefined,
    "absent because there was nothing to verify, which the ratchet reads the same way: 0 timeouts, no question to answer");
  const mutants = merged.files["dist/lib/evidence.js"].mutants;
  assert.equal(mutants.length, 2, "and the mutants themselves still merged");
});

test("the merge still drops duplicates across overlapping chunks", () => {
  // The stamp logic sits inside the same loop as the dedup; a regression in one can silently eat
  // the other.
  const { merged, stderr } = merge(
    chunk([mutant(1, "Survived", 7)]),
    chunk([mutant(1, "Survived", 7)]),
  );
  assert.equal(merged.files["dist/lib/evidence.js"].mutants.length, 1);
  assert.match(stderr, /1 duplicate mutant\(s\) dropped/);
});

// A module name is not a prefix. `territory` and `territory-map` are both in the perimeter, and
// the merge selected chunks with `startsWith("territory-")`, which accepts `territory-map-0001`.
// Measured 2026-08-29 on the whole-perimeter run: the territory leg collected TEN chunks where the
// plan asked for seven — its own seven plus territory-map's three — and refused. The direction was
// safe (the ratchet picks its file by `/territory.`, so it could not have compared the wrong one)
// but a complete measurement reported as incomplete blocks the gate, and the same shape had already
// gone through the 0.37.0 release run unnoticed, among fifteen red legs nobody read. RWD-2026-0089.
//
// What separates the two names is that a chunk's suffix is DIGITS — a line range locally, a counter
// in the workflow — and `m` is not a digit.
function mergeTwoModules(name) {
  const root = mkdtempSync(join(tmpdir(), "rw-collide-"));
  const dir = join(root, "reports", "mutation", "chunks");
  mkdirSync(dir, { recursive: true });
  const one = (mod) => ({
    schemaVersion: "1.0",
    files: { [`dist/lib/${mod}.js`]: { source: "const a = 1;\n", mutants: [mutant(mod, "Survived", 1)] } },
  });
  // both shapes the tree actually produces: `<mod>-<4>-<4>` locally, `<mod>-<4>` in the workflow
  writeFileSync(join(dir, "territory-0001-0060.json"), JSON.stringify(one("territory")));
  writeFileSync(join(dir, "territory-0061-0120.json"), JSON.stringify(one("territory")));
  writeFileSync(join(dir, "territory-map-0001-0060.json"), JSON.stringify(one("territory-map")));
  writeFileSync(join(dir, "territory-0003.json"), JSON.stringify(one("territory")));
  writeFileSync(join(dir, "territory-map-0001.json"), JSON.stringify(one("territory-map")));
  const out = join(root, "merged.json");
  try {
    const run = spawnSync(process.execPath, [SCRIPT, "--chunks", name, "--emit-merged", out],
      { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, `the merge must succeed — stderr: ${run.stderr}`);
    return JSON.parse(readFileSync(out, "utf8"));
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test("a module does not collect a neighbour whose name extends its own", () => {
  const merged = mergeTwoModules("territory");
  assert.deepEqual(Object.keys(merged.files), ["dist/lib/territory.js"],
    "territory collected territory-map's chunks: the merged report carries a second module, and " +
    "the chunk count comes back higher than the plan asked for, which refuses a complete measurement");
});

test("and the longer name still collects its own", () => {
  const merged = mergeTwoModules("territory-map");
  assert.deepEqual(Object.keys(merged.files), ["dist/lib/territory-map.js"],
    "the fix must not make the longer name unfindable — a filter tightened until it matches nothing " +
    "is the other way to break this");
});

// THIRD SITE of the same defect, and the one that would have been permanent. `mutation-ratchet.mjs`
// selected a module's filed verdicts with `stableKey.startsWith(moduleName)`, and a module name is
// not a prefix: on 2026-08-29, the day `territory` was first instructed, its ratchet pulled in all
// 45 of `territory-map`'s verdicts and reported them as survivors the tree no longer produces. The
// workflow's artifact pattern and the merge's file filter were sites one and two (RWD-2026-0089);
// this one is separated by the KEY SEPARATOR, which cannot occur inside a module name because it is
// a control character.
test("a module's filed verdicts are selected by name, not by prefix", async () => {
  const { SEP, stableKey } = await import("../../scripts/mutation-key.mjs");
  const mk = (mod) => stableKey({
    module: mod, function: "f", mutator: "ConditionalExpression", replacement: "true",
    original: "a", source: "const x = a;",
  });
  const short = mk("territory"), long = mk("territory-map");
  assert.equal(long.startsWith("territory"), true,
    "the fixture must reproduce the collision it guards against, or it guards nothing");
  assert.equal(long.startsWith("territory" + SEP), false,
    "the separator is what makes the test a module test: without it a neighbour's verdicts are " +
    "compared against this module's measurement, forever, and the ratchet reports them as " +
    "survivors the tree does not produce");
  assert.equal(short.startsWith("territory" + SEP), true, "the module must still select its own");
});
