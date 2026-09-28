// Where the SARIF log points, asserted directly (the 0.42.3 mutation re-measure).
//
// RWD-2026-0149 moved the row search into `ruleRowLineOrNull` and a locator shared with
// `check --json`, and routed the whole-file findings through one `term` helper. The six row-search
// behaviours below were each MEASURED as holes on 2026-09-01 (a prose illustration above the table,
// a row with no closing pipe, an indented row, a bare pipe line that killed the emission, a rule
// written as a code span) and stayed filed as holes: the tests that reached them spawned the CLI,
// where the mutants of a Stryker pass are not active. The rename re-keyed them, so they are killed
// here rather than re-filed. The rest pins what a forge needs from each finding: a file, a line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSarif, ruleRowLineOrNull, manifestLineLocator } from "../../dist/lib/sarif.js";

const manifest = (...rows) => ["# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|", ...rows, ""].join("\n");

test("a row is found by its first column", () => {
  assert.equal(ruleRowLineOrNull(manifest("| hexa-architecture | applied | file:src/a.ts |"), "hexa-architecture"), 7);
  assert.equal(ruleRowLineOrNull(manifest("| other | applied | x |"), "hexa-architecture"), null, "not found is null, never line 1");
});

test("a prose line that illustrates the row format is not the row", () => {
  const md = ["Format reminder: each row reads | hexa-architecture | applied | ... |", manifest("| hexa-architecture | applied | file:src/a.ts |")].join("\n");
  assert.equal(ruleRowLineOrNull(md, "hexa-architecture"), 8, "the table row, below the prose that mentions it");
});

test("the row forms the manifest reader accepts are all located", () => {
  assert.equal(ruleRowLineOrNull(manifest("| hexa-architecture | applied | file:src/a.ts"), "hexa-architecture"), 7, "no closing pipe");
  assert.equal(ruleRowLineOrNull(manifest("   | hexa-architecture | applied | file:src/a.ts |"), "hexa-architecture"), 7, "indented");
  assert.equal(ruleRowLineOrNull(manifest("| `hexa-architecture` | applied | file:src/a.ts |"), "hexa-architecture"), 7, "rule as a code span");
});

test("a bare pipe line in the table does not stop the search", () => {
  assert.equal(ruleRowLineOrNull(manifest("|", "| hexa-architecture | applied | x |"), "hexa-architecture"), 8);
});

function mission() {
  const root = mkdtempSync(join(tmpdir(), "rw-sarif-locate-"));
  mkdirSync(join(root, "runward", "adr"), { recursive: true });
  writeFileSync(join(root, "runward", "floor.md"), manifest("| r-1 | applied | x |", "| r-2 | applied | y |"));
  return root;
}

test("the locator reads the mission's own file and says null where it cannot", () => {
  const root = mission();
  try {
    const locate = manifestLineLocator(join(root, "runward"));
    assert.equal(locate("runward/floor.md", "r-2"), 8);
    assert.equal(locate("runward/floor.md", "r-9"), null);
    assert.equal(locate("runward/absent.md", "r-1"), null, "a missing file is no line, not a crash");
    assert.equal(locate("runward/adr", "r-1"), null, "a directory is no line, not a crash");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const verdict = (over = {}) => ({
  horizon: null, through: null, deliverables: [], gated: [],
  seal: { present: false, violations: [] },
  corpus: { status: "package", missing: [], edited: [], extra: [] },
  unratified: [], regulated: { on: false, unbound: [] },
  ratification: { rows: 0, lineByLine: 0, enBloc: 0, blind: 0, untraced: 0 },
  ...over,
});
const where = (r) => ({ ruleId: r.ruleId, uri: r.locations[0]?.physicalLocation?.artifactLocation?.uri, line: r.locations[0]?.physicalLocation?.region?.startLine });

test("every whole-file finding carries a location a forge can anchor: its file, line 1", () => {
  const root = mission();
  try {
    const log = buildSarif(join(root, "runward"), verdict({
      seal: { present: true, violations: [{ rule: "(seal)", problem: "sealed evidence changed" }] },
      corpus: { status: "verifiable", missing: ["a.md"], edited: ["b.md"], extra: ["c.md"] },
      unratified: [{ file: "ADR-0009-x.md", reason: "not ratified" }],
    }), 1);
    assert.deepEqual(log.runs[0].results.map(where), [
      { ruleId: "runward/evidence-seal", uri: "runward/evidence-lock.json", line: 1 },
      { ruleId: "runward/rule-corpus", uri: "runward/rules/a.md", line: 1 },
      { ruleId: "runward/rule-corpus", uri: "runward/rules/b.md", line: 1 },
      { ruleId: "runward/rule-corpus", uri: "runward/rules/c.md", line: 1 },
      { ruleId: "runward/unratified-decision", uri: "runward/adr/ADR-0009-x.md", line: 1 },
      { ruleId: "runward/hook-failed", uri: "runward/hooks.json", line: 1 },
    ]);
    for (const r of log.runs[0].results) assert.equal(r.locations.length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("an unbound regulated row is annotated on its row, and on line 1 when the row cannot be found", () => {
  const root = mission();
  try {
    const log = buildSarif(join(root, "runward"), verdict({
      regulated: { on: true, unbound: [
        { deliverable: "floor.md", rule: "r-2", cause: "no-trace" },
        { deliverable: "floor.md", rule: "r-gone", cause: "changed" },
      ] },
    }));
    const results = log.runs[0].results;
    assert.deepEqual(results.map(where), [
      { ruleId: "runward/unratified-row", uri: "runward/floor.md", line: 8 },
      { ruleId: "runward/unratified-row", uri: "runward/floor.md", line: 1 },
    ]);
    assert.ok(results[0].message.text.startsWith("r-2 — "), "the message names the row");
    assert.ok(results[0].message.text.endsWith("decided, never ratified"), "and why it is not counted as ratified");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
