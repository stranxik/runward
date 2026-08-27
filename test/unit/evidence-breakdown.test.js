// What the gate verified, counted — and the shipped example held to the standard it teaches.
//
// A field mission ran for months at 0 typed rows out of 24. The number was one line of arithmetic
// away and nobody printed it, so nobody knew the mechanical part of their gate was empty. Accepting
// prose is a decision (ADR-0004: an absence has no file to cite). Accepting it in SILENCE was the
// defect, and it contradicted ADR-0040's own standard: every gate names what it cannot verify.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceBreakdown } from "../../dist/lib/evidence.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("evidenceBreakdown separates what the gate opened from what it took on trust", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-brk-"));
  try {
    mkdirSync(join(dir, "governance"), { recursive: true });
    const manifest = (rows) =>
      "## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" + rows.join("\n") + "\n";
    mkdirSync(join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "test"), { recursive: true });
    mkdirSync(join(dir, "adr"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "export const sym = 1;\n");
    writeFileSync(join(dir, "test", "x.test.ts"), "test('x', () => {});\n");
    writeFileSync(join(dir, "adr", "ADR-0007-x.md"), "# ADR-0007: a decision\n\n**Status**: accepted\n\nSomething was decided and this records it.\n");
    writeFileSync(join(dir, "floor.md"), manifest([
      "| r-typed | applied | file:src/a.ts#sym |",
      "| r-test | applied | test:test/x.test.ts |",
      "| r-adr | applied | adr:0007 |",
      "| r-prose | applied | we reviewed it and it holds |",
      "| r-na | n/a | nothing to point at, and that is the point |",
      "| r-dev | deviated | adr:0009 |",
    ]));
    // The counter now RESOLVES each pointer instead of trusting its shape, so the fixture must
    // provide files that exist. A pointer that the gate would refuse must never be counted as
    // coverage: an audit reached "36 of 36 (100%)" on pointers that proved nothing.
    const b = evidenceBreakdown(dir);
    assert.equal(b.applied, 4, "only `applied` rows are counted as applied");
    assert.equal(b.na, 1, "and the other statuses are counted too, so the emptiest pass is visible");
    assert.equal(b.deviated, 1);
    assert.equal(b.typed, 3, "file:, test: and adr: all count when they OPEN something");
    assert.equal(b.prose, 1);
    assert.deepEqual(b.proseRows.map((r) => r.rule), ["r-prose"],
      "and the prose rows are NAMED, so the operator can act on them");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a mission with no manifest at all reports nothing rather than dividing by zero", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-brk-empty-"));
  try {
    const b = evidenceBreakdown(dir);
    assert.deepEqual(b, { rows: 0, applied: 0, deviated: 0, na: 0, typed: 0, prose: 0, signed: 0, proseRows: [], duplicated: [], evidenceFiles: { total: 0, external: 0 } });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the SHIPPED example holds to the standard it teaches", () => {
  // An example teaches harder than a rule. `init --example` was the reference an agent read to
  // learn how to fill a manifest, and it showed prose 16 times out of 23 — so missions produced
  // prose. Whatever the docs said, this is what was demonstrated.
  const b = evidenceBreakdown(join(ROOT, "examples", "request-triage", "runward"));
  assert.ok(b.applied >= 20, `${b.applied} applied rows`);
  const ratio = b.typed / b.applied;
  assert.ok(ratio >= 0.8,
    `the shipped example must verify at least 80% of its applied rows mechanically (currently ${b.typed}/${b.applied} = ${Math.round(ratio * 100)}%). Prose is legitimate where nothing can be pointed at — but the reference mission is what every new operator copies.`);
});

test("runward's own mission holds to it too", () => {
  const b = evidenceBreakdown(join(ROOT, "runward"));
  const ratio = b.typed / b.applied;
  assert.ok(ratio >= 0.8,
    `dogfooding: ${b.typed}/${b.applied} = ${Math.round(ratio * 100)}% typed`);
});

// ── ADR-0051 paper cut: identical Evidence cells are named, never gated ───────────────────────────
// One artifact CAN legitimately evidence several rules — a threat model does cover more than one
// security rule. What this usually is, though, is a cell copied down a column while the rules
// underneath it differ, and the run said nothing at all. So: counted and shown, ADR-0004 intact.
test("paper cut: rows sharing an identical Evidence cell are grouped, and whitespace is not meaning", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-dup-"));
  try {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "export const sym = 1;\n");
    const manifest = (rows) =>
      "## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" + rows.join("\n") + "\n";
    writeFileSync(join(dir, "floor.md"), manifest([
      "| r-one | applied | file:src/a.ts#sym |",
      "| r-two | applied |  file:src/a.ts#sym  |",          // same citation, spaced differently
      "| r-three | applied | file:src/a.ts |",              // a DIFFERENT cell
      "| r-na | n/a | not applicable here, and that is a decision |",
      "| r-dev | deviated | adr:0009 |",
    ]));
    const b = evidenceBreakdown(dir);
    assert.equal(b.duplicated.length, 1, "one shared cell, not two");
    assert.deepEqual(b.duplicated[0].rules.map((r) => r.rule).sort(), ["r-one", "r-two"], "and it names which rows share it");
    assert.ok(!b.duplicated.some((d) => d.rules.some((r) => r.rule === "r-three")), "a different citation is not a duplicate");
    // Only `applied` rows: an `n/a` reason repeated across rules is normal and says nothing.
    assert.ok(!b.duplicated.some((d) => d.rules.some((r) => ["r-na", "r-dev"].includes(r.rule))), "n/a and deviated rows are not counted");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("paper cut: case is meaning in a path, so it is never normalised away", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-dup-case-"));
  try {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "export const sym = 1;\n");
    writeFileSync(join(dir, "floor.md"),
      "## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" +
      "| r-one | applied | file:src/a.ts |\n| r-two | applied | file:src/A.ts |\n");
    assert.deepEqual(evidenceBreakdown(dir).duplicated, [], "two paths differing only in case are two citations, and on Linux two files");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
