// The ratification ledger and its grammar, pinned exactly (consolidated pass, 2026-09-02: 25
// mutants survived on conformance.js, most in ratificationLedger and the anchors of the block
// grammar). deepEqual against hand-built deliverable content — a flipped accumulator, a loosened
// anchor or an untrimmed slice has nowhere to hide in a compared object.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ratificationLedger, readRatification, proposedStatus, parseManifest } from "../../dist/lib/conformance.js";
import { REQUIRABLE_NATURES } from "../../dist/lib/evidence.js";

test("REQUIRABLE_NATURES is exactly the six shipped adapters — a blanked member cannot hide in a size check", () => {
  assert.deepEqual([...REQUIRABLE_NATURES].sort(), ["adr", "coverage", "eslint", "junit", "sarif", "sbom"]);
});

test("proposedStatus trims what it slices, and refuses what is not the grammar", () => {
  assert.equal(proposedStatus("proposed:applied"), "applied");
  assert.equal(proposedStatus("proposed: applied "), "applied", "the slice is trimmed — grammar, not bytes");
  assert.equal(proposedStatus("applied"), null);
  assert.equal(proposedStatus("proposed:definitely"), null, "only the three decided statuses can be proposed");
});

const FLOOR = (block) => `# Floor

## Rule conformance

| Rule | Status | Evidence |
|---|---|---|
| r-one | applied | file:a.ts |
| r-two | applied | file:b.ts |
| r-three | applied | file:c.ts |
${block}`;

function missionWith(block) {
  const dir = mkdtempSync(join(tmpdir(), "rw-ledger-"));
  mkdirSync(join(dir, "governance"), { recursive: true });
  writeFileSync(join(dir, "floor.md"), FLOOR(block));
  return dir;
}

test("the ledger reads every mode exactly, and untraced is the complement", () => {
  const dir = missionWith(`
### Ratification

- 2026-09-01 · rows: r-one · by: op (declared) · mode: line-by-line
- 2026-09-02 · rows: r-two · by: op (declared) · mode: en bloc (sample 3/10, sampled rows accepted 3/3)
`);
  try {
    // Only floor.md exists in this fixture; the other gated deliverables are absent and read empty.
    // `rows` counts the TRACED lines (what the block covers), never the decided ones — r-three is
    // decided with no trace and lives in `untraced` only.
    assert.deepEqual(ratificationLedger(dir), { rows: 2, lineByLine: 1, enBloc: 1, blind: 0, untraced: 1 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("BLIND is counted apart, and `en bloc` matches at the start of the mode only", () => {
  const dir = missionWith(`
### Ratification

- 2026-09-01 · rows: r-one · by: op (declared) · mode: BLIND
- 2026-09-02 · rows: r-two · by: op (declared) · mode: line-by-line (bloc cancelled by a sampled reject — not en bloc)
`);
  try {
    assert.deepEqual(ratificationLedger(dir), { rows: 2, lineByLine: 1, enBloc: 0, blind: 1, untraced: 1 },
      "a mode that merely MENTIONS 'bloc' later in the sentence is not an en-bloc ratification");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the block heading is anchored: an H4 or a prefixed line is not the Ratification block", () => {
  for (const notABlock of ["#### Ratification", "see ### Ratification above", "### Ratification and notes"]) {
    const dir = missionWith(`\n${notABlock}\n\n- 2026-09-01 · rows: r-one · by: op (declared) · mode: line-by-line\n`);
    try {
      assert.equal(readRatification(readFileSync(join(dir, "floor.md"), "utf8")).length, 0, `"${notABlock}" must not open the block`);
      assert.equal(ratificationLedger(dir).untraced, 3, "nothing is traced through a heading that is not the grammar");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test("a placeholder rule row is skipped only when brackets span the WHOLE cell", () => {
  // parseManifest reads the manifest SECTION, not any table: the heading is part of the grammar.
  const rows = parseManifest(`## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| [rule-id] | applied | file:a.ts |\n| x[rule-id] | applied | file:b.ts |\n| [rule-id]x | applied | file:c.ts |\n`);
  assert.deepEqual(rows.map((r) => r.rule), ["x[rule-id]", "[rule-id]x"],
    "anchors on both ends: brackets inside a real name never make a row disappear");
});
