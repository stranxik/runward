// What "typed" is allowed to mean in the breakdown the gate prints.
//
// Found by the full mutation pass of 2026-08-04: eight survivors sat in the pointer predicate of
// `evidenceBreakdown` — the `adr:` branch, the empty-path guard, the resolve/regular-file guard —
// and every one of them survived the unit suite, `check --strict`, the OSCAL validation and the
// smoke test.
//
// This function never gates: `check.ts` prints its numbers and adds nothing to `strictGaps`
// (verified 2026-08-05 — the eight mutants left `check --strict` at exit 0 on `init --example`).
// What it produces is the honesty measure, the one line that says how much of a green gate was
// mechanically opened: "N of M `applied` row(s) carry a pointer the gate opened and checked".
// That number exists because an audit reached "36 of 36 (100%)" on pointers that proved nothing.
// Measured on a mission that passes `check --strict` with exit 0, the survivors turned it into
// 21/27, 22/27 and 21/24 while the mission stayed green: the pointers they counted sit on rows the
// blocking layer never inspects (template placeholder rows, and rows whose status is not `applied`
// for a rule outside the phase's expected set — `conformance()` validates status only for expected
// rules). A verdict held by defence in depth, over a proof surface held by nothing.
//
// Each case pins one refusal AND the acceptance beside it, so no constant satisfies it: a predicate
// stuck on false would erase the coverage the number is meant to report, which is the mirror defect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceBreakdown } from "../../dist/lib/evidence.js";

// A mission laid out the way the resolution bases expect it: the project root holds the code, the
// mission lives in runward/ beside it, and `floor.md` is one of the gated deliverables.
function mission(rows) {
  const root = mkdtempSync(join(tmpdir(), "rw-brkp-"));
  const dir = join(root, "runward");
  mkdirSync(join(dir, "adr"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "test"), { recursive: true });
  writeFileSync(join(root, "src", "a.ts"), "export function guardFields() { return true; }\n");
  writeFileSync(join(root, "test", "x.test.ts"), "test('the guard holds', () => {});\n");
  writeFileSync(join(dir, "adr", "ADR-0007-x.md"),
    "# ADR-0007: a decision\n\n**Status**: accepted\n\nSomething was decided and this records it.\n");
  writeFileSync(join(dir, "floor.md"),
    "## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" + rows.join("\n") + "\n");
  return { root, dir };
}
const clean = (root) => rmSync(root, { recursive: true, force: true });

test("a pointer at a file that does not exist is prose, never coverage", () => {
  // The dangerous direction: counting a dead pointer as "a pointer the gate opened and checked".
  // Measured 2026-08-05 on a mission at exit 0 — the count went from 20/24 to 21/24 with the gate
  // still green, because the row carrying it is one the blocking layer skips.
  const { root, dir } = mission([
    "| r-live | applied | file:src/a.ts#guardFields |",
    "| r-dead | applied | file:src/deleted.ts |",
  ]);
  try {
    const b = evidenceBreakdown(dir);
    assert.equal(b.applied, 2);
    assert.equal(b.typed, 1, "the pointer that opens a real file counts — and only that one");
    assert.deepEqual(b.proseRows.map((r) => r.rule), ["r-dead"],
      "a pointer the gate cannot resolve leaves its row in prose, and the row is named");
  } finally { clean(root); }
});

test("a pointer that resolves to a directory is not a pointer the gate opened", () => {
  // `file:src` resolves; it is not a file. Refusing on `!abs` alone (`||` turned into `&&`) lets a
  // directory through and it then passes the circularity check unopposed — measured as 21/27
  // instead of 20/27 on a green mission.
  const { root, dir } = mission([
    "| r-file | applied | file:src/a.ts#guardFields |",
    "| r-dir | applied | file:src |",
  ]);
  try {
    const b = evidenceBreakdown(dir);
    assert.equal(b.typed, 1, "a directory is not evidence; the file beside it still is");
    assert.deepEqual(b.proseRows.map((r) => r.rule), ["r-dir"]);
  } finally { clean(root); }
});

test("an `adr:` pointer counts only when the ADR exists, and it does count when it does", () => {
  // Both directions in one case. An ADR id that resolves to nothing must not read as coverage
  // (measured 21/27 vs 20/27, gate green); an ADR that was really written must not be downgraded
  // to prose, or the operator is pushed to invent a file pointer for a decision.
  const { root, dir } = mission([
    "| r-adr-real | applied | adr:0007 |",
    "| r-adr-ghost | applied | adr:9999 |",
  ]);
  try {
    const b = evidenceBreakdown(dir);
    assert.equal(b.applied, 2);
    assert.equal(b.typed, 1, "adr:0007 exists and is accepted — it opens something");
    assert.deepEqual(b.proseRows.map((r) => r.rule), ["r-adr-ghost"],
      "adr:9999 names no decision in runward/adr/ — the row was never verified");
  } finally { clean(root); }
});

test("a pointer that names no path proves nothing", () => {
  // `file:#guardFields` parses as a pointer whose path is empty: there is no file to open, only a
  // symbol nobody looked for. Counting it as typed is the purest form of the failure this number
  // was added to expose.
  const { root, dir } = mission([
    "| r-real | applied | test:test/x.test.ts |",
    "| r-hollow | applied | file:#guardFields |",
  ]);
  try {
    const b = evidenceBreakdown(dir);
    assert.equal(b.typed, 1, "the test: pointer opens a real file — the pathless one opens nothing");
    assert.deepEqual(b.proseRows.map((r) => r.rule), ["r-hollow"]);
  } finally { clean(root); }
});

test("only a row whose status is exactly `applied` is counted as applied", () => {
  // `deviated` and `n/a` have their own buckets; anything else is not a decision at all. A row left
  // at `pending` for a rule outside the phase's expected set passes `check --strict` untouched
  // (`conformance()` validates status only for expected rules), so nothing else here says no:
  // measured 21 of 24 (88%) instead of 20 of 23 (87%) on a mission at exit 0.
  const { root, dir } = mission([
    "| r-applied | applied | file:src/a.ts#guardFields |",
    "| r-pending | pending | file:src/a.ts#guardFields |",
    "| r-dev | deviated | adr:0007 |",
    "| r-na | n/a | nothing to point at here, and that is the point |",
  ]);
  try {
    const b = evidenceBreakdown(dir);
    assert.equal(b.rows, 4, "every row is seen");
    assert.equal(b.applied, 1, "an unfinished row is not an applied one, whatever pointer it carries");
    assert.equal(b.typed, 1, "and the real applied row is still counted — the guard is not a wall");
    assert.equal(b.deviated, 1);
    assert.equal(b.na, 1);
    assert.equal(b.prose, 0);
  } finally { clean(root); }
});
