// Drift reaches the verdict. `driftReport` has its own unit tests (conformance-gate.test.js) and the
// smoke suite drives it through `check --strict`, but nothing in the UNIT suite — the suite Stryker
// runs — asserted that `judgeGated` joins its output into the violations. Stryker 10 dropped
// `violations.push(...driftReport(mission, deliverable))` and the suite stayed green: an applied
// row whose cited file no longer exists would have left the gate green, which is the exact hole
// ADR-0021 made blocking. The same recipe is filed under PATH_TOKEN in the mutation register.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("an applied bare pointer whose file vanished reddens the joined verdict (drift, ADR-0021)", () => {
  const parent = mkdtempSync(join(tmpdir(), "rw-drift-"));
  const dir = join(parent, "m");
  cpSync(join(ROOT, "examples", "request-triage"), dir, { recursive: true });
  const mission = join(dir, "runward");
  try {
    // Positive control: the shipped example is green, so whatever reddens it below is the edit.
    assert.equal(computeVerdict(mission, { strict: true }).clean, true, "the reference mission starts green");

    const floor = join(mission, "floor.md");
    const before = readFileSync(floor, "utf8");
    const row = /^\| hexa-move-deterministic-out \| applied \|[^\n]*$/m;
    assert.match(before, row, "the row this test rewrites must exist in the example");
    // Untyped on purpose: a `file:` pointer is the evidence layer's; a bare path is drift's alone.
    writeFileSync(floor, before.replace(row,
      "| hexa-move-deterministic-out | applied | code/src/core/domain/deadline-rules.ts — the deadline thresholds moved out of the model into this module |"));

    const v = computeVerdict(mission, { strict: true });
    assert.equal(v.clean, false, "a stale applied pointer must turn the mission red");
    const drift = v.gated.flatMap((g) => g.violations.map((x) => ({ label: g.label, ...x })))
      .filter((x) => /\(drift\)/.test(x.problem));
    assert.equal(drift.length, 1, `exactly one drift violation, got ${JSON.stringify(v.gated.map((g) => g.violations))}`);
    assert.equal(drift[0].rule, "hexa-move-deterministic-out");
    assert.equal(drift[0].label, "Floor");
    assert.match(drift[0].problem, /applied pointer does not resolve \(drift\): code\/src\/core\/domain\/deadline-rules\.ts/);
    assert.equal(v.strictGaps, 1, "the drift violation is the only gap, and it is counted");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
