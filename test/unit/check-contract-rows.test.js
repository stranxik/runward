// The conformance rows of the ADR-0030 payload, asserted directly (the 0.42.3 mutation re-measure).
//
// RWD-2026-0149 gave every `conformance` row a kind, a file, a line and a phase id, and RWD-2026-0150
// and 0151 put coverage and phase ids beside them. Each was pinned through `check --json` run in a
// child process, where the mutants of a Stryker pass are not active: 28 mutants of the row builder
// survived the unit suite, among them a fabricated corpus row on a mission whose corpus the gate
// deliberately never flags. These are the fields an agent branches on (`kind`), opens (`file`,
// `line`) and joins (`phaseId`); each case below states which one and why.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conformanceRows, conformanceRowsLocated, conformanceFile, CONFORMANCE_ADDITIVE_KEYS,
  coverageSummary, deliverableRowsWithPhaseId,
} from "../../dist/lib/check-contract.js";

const verdict = (over = {}) => ({
  gated: [],
  corpus: { status: "package", missing: [], edited: [], extra: [] },
  seal: { present: false, violations: [] },
  unratified: [],
  regulated: { on: false, unbound: [] },
  ...over,
});
/** A locator that answers for every file, so a row that is NOT located shows as null by choice. */
const everywhere = (file, rule) => `${file}#${rule}`.length;

test("a gated violation is located on its deliverable's row, with the phase id rules --phase takes", () => {
  const [row] = conformanceRowsLocated(verdict({
    gated: [{ label: "Floor", skipped: false, violations: [{ rule: "r-1", problem: "typed pointer dead" }] }],
  }), (file, rule) => (file === "runward/floor.md" && rule === "r-1" ? 42 : null));
  assert.deepEqual(row, { scope: "Floor", rule: "r-1", problem: "typed pointer dead", kind: "rule-violation",
    file: "runward/floor.md", line: 42, phaseId: "floor" });
});

test("each gated scope maps to ITS deliverable and phase, not to the first one", () => {
  const rows = conformanceRowsLocated(verdict({
    gated: ["Architect", "Topology", "Floor", "Govern", "Handover"].map((label) => ({ label, skipped: false, violations: [{ rule: "x", problem: "p" }] })),
  }));
  assert.deepEqual(rows.map((r) => [r.file, r.phaseId]), [
    ["runward/architecture.md", "architect"],
    ["runward/execution-topology.md", "topology"],
    ["runward/floor.md", "floor"],
    ["runward/governance/threat-model.md", "govern"],
    ["runward/handover.md", "handover"],
  ]);
});

test("a violation that carries its own kind keeps it", () => {
  const [row] = conformanceRowsLocated(verdict({
    gated: [{ label: "Architect", skipped: false, violations: [{ rule: "r", problem: "p", kind: "unresolved-pointer" }] }],
  }));
  assert.equal(row.kind, "unresolved-pointer");
});

test("a scope that is not a gated deliverable lands on the mission directory, with no phase", () => {
  assert.equal(conformanceFile("Architect"), "runward/architecture.md");
  assert.equal(conformanceFile("Workflow"), "runward", "not a gated deliverable: the mission, never an empty uri");
  const [row] = conformanceRowsLocated(verdict({
    gated: [{ label: "Workflow", skipped: false, violations: [{ rule: "w", problem: "p" }] }],
  }));
  assert.equal(row.file, "runward");
  assert.equal(row.phaseId, null, "no phase is guessed for a scope that has none");
});

test("a skipped scope contributes no row", () => {
  assert.deepEqual(conformanceRowsLocated(verdict({
    gated: [{ label: "Floor", skipped: true, violations: [{ rule: "r", problem: "p" }] }],
  })), []);
});

test("whole-file findings name their file, their kind, and are never located on a row", () => {
  const rows = conformanceRowsLocated(verdict({
    corpus: { status: "verifiable", missing: ["a.md"], edited: ["b.md"], extra: ["c.md"] },
    seal: { present: true, violations: [{ rule: "(seal)", problem: "sealed evidence changed" }] },
    unratified: [{ file: "ADR-0009-x.md", reason: "not ratified" }],
  }), everywhere);
  assert.deepEqual(rows.map(({ kind, file, line, phaseId }) => ({ kind, file, line, phaseId })), [
    { kind: "corpus-missing", file: "runward/rules/a.md", line: null, phaseId: null },
    { kind: "corpus-edited", file: "runward/rules/b.md", line: null, phaseId: null },
    { kind: "corpus-extra", file: "runward/rules/c.md", line: null, phaseId: null },
    { kind: "seal-violation", file: "runward/evidence-lock.json", line: null, phaseId: null },
    { kind: "unratified-decision", file: "runward/adr/ADR-0009-x.md", line: null, phaseId: null },
  ], "a whole-file fact has no row to point at, even when a locator would answer");
});

test("an unrecorded corpus is one row, named, on the rules directory", () => {
  const rows = conformanceRowsLocated(verdict({ corpus: { status: "unrecorded", missing: [], edited: [], extra: [] } }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rule, "(corpus)", "a placeholder rule id, which the refusal renders by its scope");
  assert.equal(rows[0].kind, "corpus-unrecorded");
  assert.equal(rows[0].file, "runward/rules");
});

test("a corpus read from the package is never flagged: no row is fabricated", () => {
  // `package` is the safest configuration (no local rule copy), which the gate deliberately never
  // flags. A row here would be a refusal in the payload that no count and no exit code carries.
  assert.deepEqual(conformanceRowsLocated(verdict({ corpus: { status: "package", missing: [], edited: [], extra: [] } })), []);
});

test("an unbound regulated row is located on its own deliverable, with its deliverable's phase", () => {
  const rows = conformanceRowsLocated(verdict({
    regulated: { on: true, unbound: [
      { deliverable: "floor.md", rule: "r-9", cause: "no-trace" },
      { deliverable: "handover.md", rule: "r-7", cause: "changed" },
    ] },
  }), (file, rule) => (file === "runward/handover.md" && rule === "r-7" ? 12 : null));
  assert.deepEqual(rows.map(({ scope, kind, file, line, phaseId }) => ({ scope, kind, file, line, phaseId })), [
    { scope: "ratification", kind: "unbound-row", file: "runward/floor.md", line: null, phaseId: "floor" },
    { scope: "ratification", kind: "unbound-row", file: "runward/handover.md", line: 12, phaseId: "handover" },
  ], "each row joins ITS deliverable, and is located on it");
  assert.match(rows[0].problem, /\(floor\.md\)$/, "the problem names which deliverable carries the row");
  assert.ok(rows[1].problem.startsWith("the row changed since it was ratified"), "and why it is unbound");
});

test("an unbound row on a file that is not a gated deliverable has no phase, and does not throw", () => {
  const [row] = conformanceRowsLocated(verdict({
    regulated: { on: true, unbound: [{ deliverable: "notes.md", rule: "r", cause: "no-trace" }] },
  }));
  assert.equal(row.phaseId, null);
  assert.equal(row.file, "runward/notes.md");
});

test("without a locator every line is null — present and null, never undefined", () => {
  // JSON drops an undefined key: `line` would vanish from the payload instead of saying "unknown".
  const rows = conformanceRowsLocated(verdict({
    gated: [{ label: "Floor", skipped: false, violations: [{ rule: "r", problem: "p" }] }],
    regulated: { on: true, unbound: [{ deliverable: "floor.md", rule: "r", cause: "no-trace" }] },
  }));
  for (const r of rows) {
    assert.equal(r.line, null);
    assert.ok("line" in JSON.parse(JSON.stringify(r)), "the key survives serialisation");
  }
});

test("the additive keys are exactly what separates the located rows from the three-field ones", () => {
  // `verify` reads an attestation older than RWD-2026-0149 by checking that these keys are absent and
  // then comparing against conformanceRows. A key missing from the list, or a wrong one, and an older
  // attestation of an honest tree stops verifying.
  const v = verdict({
    gated: [{ label: "Floor", skipped: false, violations: [{ rule: "r", problem: "p" }] }],
    corpus: { status: "verifiable", missing: ["a.md"], edited: [], extra: [] },
    regulated: { on: true, unbound: [{ deliverable: "floor.md", rule: "r", cause: "no-trace" }] },
  });
  const stripped = conformanceRowsLocated(v, everywhere).map((r) => {
    const o = { ...r };
    for (const k of CONFORMANCE_ADDITIVE_KEYS) delete o[k];
    return o;
  });
  assert.deepEqual(stripped, conformanceRows(v));
});

test("coverage counts the filled deliverables, not all of them, and names what is left to ratify", () => {
  const report = { phases: [
    { artifacts: [{ state: "filled" }, { state: "untouched" }] },
    { artifacts: [{ state: "missing" }, { state: "filled" }, { state: "in-progress" }] },
  ] };
  const c = coverageSummary(report, { ratified: 3, total: 5, unratified: [
    { file: "ADR-0004-a.md", reason: "proposed", extra: "not published" },
    { file: "ADR-0006-b.md", reason: "no ratification section" },
  ] });
  assert.deepEqual(c.deliverables, { filled: 2, total: 5 });
  assert.deepEqual(c.decisions, { ratified: 3, total: 5, toRatify: [
    { file: "ADR-0004-a.md", reason: "proposed" },
    { file: "ADR-0006-b.md", reason: "no ratification section" },
  ] });
});

test("a deliverable row whose phase label is unknown gets a null phase id, and the rest keep theirs", () => {
  const rows = deliverableRowsWithPhaseId([
    { phase: "3 · Floor", relPath: "floor.md" },
    { phase: "9 · Nowhere", relPath: "x.md" },
  ]);
  assert.deepEqual(rows.map((r) => r.phaseId), ["floor", null]);
});
