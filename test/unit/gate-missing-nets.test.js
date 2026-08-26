// Three nets the 2026-08-26 audit found missing. None of them was a wrong verdict on its own; each
// was a detector that could not see the one shape where the abuse is free.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceBreakdown, collectSealableEvidence, evidenceReport } from "../../dist/lib/evidence.js";

const ADR_BODY = "# Single orchestrator\n\n**Status**: accepted\n\n## Context\nTwo orchestrators meant two retry policies.\n\n## Decision\nOne orchestrator.\n";

/** A mission whose floor.md carries `rows`, with one real ADR in adr/. */
function mission(rows) {
  const root = mkdtempSync(join(tmpdir(), "rw-nets-"));
  const m = join(root, "runward");
  mkdirSync(join(m, "adr"), { recursive: true });
  writeFileSync(join(m, "adr", "ADR-0001-single-orchestrator.md"), ADR_BODY);
  writeFileSync(join(m, "floor.md"),
    `# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n${rows.join("\n")}\n`);
  return { root, m };
}

const withMission = (rows, fn) => {
  const { root, m } = mission(rows);
  try { return fn(m); } finally { rmSync(root, { recursive: true, force: true }); }
};

test("the duplicate-cell census reads EVERY status, not only applied", () => {
  // `| <slug> | deviated | ADR-0001 |` repeated down a column is the shape where copying is free —
  // nobody has to justify a deviation twice — and it was the shape the census could not see: it sat
  // after the applied-only guard. Measured 2026-08-26: 36 such rows returned `duplicated` EMPTY.
  const deviated = ["rule-a", "rule-b", "rule-c"].map((r) => `| ${r} | deviated | adr:0001 |`);
  withMission(deviated, (m) => {
    const d = evidenceBreakdown(m).duplicated;
    assert.equal(d.length, 1, `one cell copied down three deviated rows must be named: ${JSON.stringify(d)}`);
    assert.equal(d[0].rules.length, 3);
    assert.deepEqual([...new Set(d[0].rules.map((r) => r.status))], ["deviated"], "the census reports which column was copied");
  });
  // The n/a column too, and the opposite direction: three DIFFERENT cells are not a duplicate.
  withMission(["rule-a", "rule-b"].map((r) => `| ${r} | n/a | this service has no queue at all |`),
    (m) => assert.equal(evidenceBreakdown(m).duplicated.length, 1, "an n/a reason copied down is a copy too"));
  withMission(["| rule-a | n/a | this service has no queue at all |", "| rule-b | n/a | no model runs in this adapter |"],
    (m) => assert.deepEqual(evidenceBreakdown(m).duplicated, [], "two genuinely different reasons are not a duplicate"));
});

test("the seal freezes `adr:` targets — the one pointer kind whose target could never be frozen", () => {
  // Measured 2026-08-26: 0 of the 18 lock keys sat under adr/, so replacing every ADR body with
  // filler left `✓ seal intact` and exit 0. A deviation's evidence IS its ADR.
  withMission(["| rule-a | deviated | adr:0001 |"], (m) => {
    const keys = Object.keys(collectSealableEvidence(m));
    assert.ok(keys.some((k) => k.includes("/adr/ADR-0001")), `the cited ADR must be sealed: ${JSON.stringify(keys)}`);
  });
  // The opposite direction: an ADR nobody cites is not evidence, and the seal does not invent it.
  withMission(["| rule-a | n/a | this service has no queue at all |"], (m) => {
    const keys = Object.keys(collectSealableEvidence(m));
    assert.ok(!keys.some((k) => k.includes("/adr/")), `an uncited ADR is not evidence: ${JSON.stringify(keys)}`);
  });
});

test("a `test:` pointer at a prose document is refused — no test runner executes a .md", () => {
  // Measured 2026-08-26 on an UNSIGNED rule, so nothing else could refuse it:
  // `test:runward/framing.md::of` returned exit 0. `check` is not a runtime and says so; what it can
  // say is that a document is not a test.
  const root = mkdtempSync(join(tmpdir(), "rw-testkind-"));
  const m = join(root, "runward");
  mkdirSync(join(m, "code"), { recursive: true });
  writeFileSync(join(m, "framing.md"), "# Framing\n\nThis document is one of several.\n");
  writeFileSync(join(m, "code", "triage.test.ts"), 'test("routes to the right queue", () => {});\n');
  const report = (cell) => {
    writeFileSync(join(m, "floor.md"),
      `# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| rule-a | applied | ${cell} |\n`);
    return evidenceReport(m, "floor.md", {}).map((v) => v.problem);
  };
  try {
    const bad = report("test:runward/framing.md::of");
    assert.ok(bad.some((p) => /document is not a test/.test(p)), `got: ${JSON.stringify(bad)}`);
    // The opposite direction, and the reason the check is on the EXTENSION and not on a name
    // convention: `*test*`/`*spec*` would refuse Rust `#[cfg(test)]` blocks and Go table tests that
    // live in ordinary source files, which are real tests in real projects.
    assert.deepEqual(report("test:runward/code/triage.test.ts::routes to the right queue"), [],
      "a real test file still clears");
    assert.deepEqual(report("file:runward/framing.md#several"), [],
      "the same document is still legitimate evidence under file:");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
