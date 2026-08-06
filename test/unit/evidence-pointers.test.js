// The `test:` branch of the pointer grammar, and the pointer the operator reads back.
//
// Found by the full mutation pass of 2026-08-04: thirteen mutants inside `parseEvidencePointers`
// survived the unit suite, the self-gate, the OSCAL validation and the smoke run. Re-measured on
// 2026-08-05 against the suite as it stands today, ten of them still survive, and they sit on three
// distinct decisions:
//
//   1. WHICH SIDE OF `::` IS THE PATH (line 98). The one fixture in the suite that exercises this
//      branch, `test:test/x.test.ts::rejects an ungrounded figure`, carries a SPACE inside the test
//      name — so `firstWs` is not -1 and the guard reads the same mutated or not. A single-word
//      name (`::escalated`, the ordinary way to cite a `test("guard: ...")` by one token) took the
//      other branch and put `::escalated` inside the PATH. The file then never resolves and a
//      mission that cites a test it really has goes red. A gate that refuses honest evidence is
//      the failure that gets a gate switched off.
//   2. THAT A `::` WAS WRITTEN AT ALL (line 108). `testNameDeclared` is the only thing that tells
//      "no test name requested" from "a test name was requested and lost". Flipped to `false`,
//      `test:code/test/triage.test.ts::` — a pointer that names nothing — produces ZERO violations
//      and the row crosses as verified evidence. That direction is a false green, measured below
//      on a real mission: `check --strict` returns 1 with the guard, 0 without it.
//   3. THE POINTER THE ERROR MESSAGE NAMES (line 140). `raw` is rebuilt from what was parsed, so
//      the operator is sent to the pointer they actually wrote. Mutants there drop the `:LINE`, or
//      drop the `#SYMBOL` entirely, and the message then names a DIFFERENT pointer than the one
//      that failed. What is pinned here is the invariant — `raw` re-parses to the same pointer —
//      never the rendering: whether a symbol comes back quoted is prose, and prose is the
//      operator's business.
//
// Not covered, on purpose: `sep <= firstWs` in place of `sep < firstWs` is an EQUIVALENT mutant.
// The right-hand side is only ever evaluated when `sep !== -1` and `firstWs !== -1`, and then `sep`
// indexes a `:` while `firstWs` indexes a whitespace character in the same string — they cannot be
// the same index. No input distinguishes the two.
//
// Each case below states the decision it pins and the direction that would be dangerous, and every
// decision is pinned in BOTH directions: a guard that refuses everything is as broken as one that
// accepts everything, and only the pair forbids a constant.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEvidencePointers, evidenceReport } from "../../dist/lib/evidence.js";

const P = (s) => parseEvidencePointers(s);
const table = (...rows) =>
  `## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n${rows.join("\n")}\n`;

// ── 1. Which side of `::` is the path ───────────────────────────────────────────────────────────

test("a one-word test name after `::` is a test name, never part of the path", () => {
  // The dangerous direction: `::escalated` swallowed into the path, so `test:code/test/triage.
  // test.ts::escalated` resolves to nothing and a mission citing a test it really has is refused.
  // The suite's only `::` fixture has a space inside the name, which is exactly why two mutants
  // on this guard lived through it.
  const [p] = P("test:code/test/triage.test.ts::escalated");
  assert.equal(p.path, "code/test/triage.test.ts");
  assert.equal(p.testName, "escalated");
  assert.equal(p.testNameDeclared, true);
});

test("a multi-word test name after `::` reads the same way", () => {
  // The form the suite already had, kept here so the two are read side by side: whether the name
  // holds a space must not change which side of `::` the path is on.
  const [p] = P("test:code/test/triage.test.ts::the deadline is re-parsed");
  assert.equal(p.path, "code/test/triage.test.ts");
  assert.equal(p.testName, "the deadline is re-parsed");
});

test("a `test:` pointer with no `::` keeps its whole path and declares no name", () => {
  // The opposite direction. Always taking the `::` branch truncates the path by one character
  // (`rest.slice(0, -1)`) and invents a test name out of the path itself — and a constant "always
  // split" would satisfy the two cases above on its own.
  const [p] = P("test:code/test/triage.test.ts");
  assert.equal(p.path, "code/test/triage.test.ts");
  assert.equal(p.testName, undefined);
  assert.equal(p.testNameDeclared, undefined);
});

test("prose written after the path is not dragged into the path by a later `::`", () => {
  // When the `::` comes AFTER a space, it belongs to the sentence, not to the pointer: the path
  // ends at the first whitespace. Reading the guard the other way makes the path
  // `code/test/triage.test.ts covered end to end ` — spaces included — which resolves to nothing.
  const [p] = P("test:code/test/triage.test.ts covered end to end ::whatever");
  assert.equal(p.path, "code/test/triage.test.ts");
});

// ── 2. That a `::` was written at all ───────────────────────────────────────────────────────────

test("a `::` that names nothing is recorded as DECLARED, not as absent", () => {
  // `testNameDeclared` is the whole difference between "no name requested" and "a name was
  // requested and lost". Without it the second case is silently read as the first.
  const [p] = P("test:code/test/triage.test.ts::");
  assert.equal(p.testName, undefined, "nothing usable followed the `::`");
  assert.equal(p.testNameDeclared, true, "but the operator DID write one");
});

test("the gate refuses a `::` that names no test, and accepts one that does", () => {
  // The verdict itself, on a real manifest. Dangerous direction: a pointer that looks precise and
  // checks nothing crosses the gate, and the operator believes a claim was verified. Measured on
  // an example mission on 2026-08-05: with `testNameDeclared: false`, `check --strict` on a
  // mission carrying `test:code/test/triage.test.ts::` exits 0 instead of 1.
  const dir = mkdtempSync(join(tmpdir(), "rw-testname-"));
  try {
    mkdirSync(join(dir, "test"), { recursive: true });
    writeFileSync(join(dir, "test", "a.test.js"),
      'test("the deadline is re-parsed from the source text", () => {});\n');
    const write = (ptr) => writeFileSync(join(dir, "floor.md"), table(`| r1 | applied | ${ptr} |`));
    const problems = () => evidenceReport(dir, "floor.md", {}).map((v) => v.problem).join(" | ");

    write("test:test/a.test.js::the deadline is re-parsed from the source text");
    assert.equal(problems(), "", "a named test that the file really contains IS evidence");

    write("test:test/a.test.js::");
    assert.match(problems(), /names no test/, "a `::` naming nothing must be refused, not ignored");

    write("test:test/a.test.js::a");
    assert.match(problems(), /names no test/,
      "and a one-character name is a tautology, not a pointer");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── 3. The pointer the error message names ──────────────────────────────────────────────────────

test("the pointer read back in an error names the same pointer that was written", () => {
  // `raw` is what the operator is sent to look at. Rebuilt from the leading token it once showed
  // `file:doc.md#"the` for a pointer nobody wrote that way. The invariant that holds it: re-parsing
  // `raw` must yield the same path, the same line and the same symbol. Dropping the `:LINE` or the
  // `#SYMBOL` from it sends the operator to a different pointer than the one that failed.
  //
  // This pins the round trip, NOT the rendering: a symbol may come back quoted or bare, and that
  // choice is prose no test should own.
  for (const written of [
    "file:src/x.ts",
    "file:src/x.ts:22",
    "file:src/x.ts:22#assertGrounded",
    'file:doc.md#"the guard fails closed"',
  ]) {
    const [p] = P(written);
    const [again] = P(p.raw);
    assert.ok(again, `raw ${JSON.stringify(p.raw)} must itself be a pointer (from ${written})`);
    assert.equal(again.path, p.path, `path lost in raw ${JSON.stringify(p.raw)}`);
    assert.equal(again.line, p.line, `line lost in raw ${JSON.stringify(p.raw)}`);
    assert.equal(again.symbol, p.symbol, `symbol lost in raw ${JSON.stringify(p.raw)}`);
  }
});

test("a pointer with no line and no symbol is not given one by the message", () => {
  // The other direction of the same rebuild: announcing `:undefined` or a trailing `#` on a bare
  // path is the mirror defect, and a round trip alone would not catch a message that ADDS to what
  // was written.
  const [p] = P("file:src/x.ts");
  assert.equal(p.raw, "file:src/x.ts");
});
