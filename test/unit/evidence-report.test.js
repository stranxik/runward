// The decisions `evidenceReport` makes about a typed pointer — the ones that reach the exit code of
// `runward check --strict` through `strictGaps` in src/commands/check.ts.
//
// Found by the full mutation pass of 2026-08-04: 37 mutants survive inside this one function. The
// reason is structural, not accidental — runward's OWN mission (the corpus the auto-gate runs on)
// and the shipped `init --example` mission write no `file:PATH:LINE` pointer and no
// `test:PATH::NAME` pointer at all. Every guard that only fires on those two forms is therefore
// unreachable by the self-gate, whatever it does. Measured, not assumed:
//
//   `if (p.testName !== undefined && !content.includes(p.testName))` → `if (false)`
//     mission citing a test that was never written → `check --strict` exits 0.   (proven false green)
//   `if (p.testNameDeclared && …)` → `if (false)`
//     mission citing `test:x.ts::` — a pointer naming nothing → exits 0.         (proven false green)
//   `if (unsafeSignature(sig))` → `if (false)`
//     house rule carrying a ReDoS signature → exits 0.                           (proven false green)
//
// Not every survivor here is a hole. Two are caught a second time inside the same pass and are left
// to that second mechanism rather than pinned by prose (verified 2026-08-04):
//   · `if (p.malformed)` → `false`: a malformed pointer is only ever an `adr:` one, so it falls
//     through to `adrDecision("ADR-undefined")`, which refuses. Verdict unchanged, message degraded.
//   · `if (!isRegularFile(abs))` → `false`: `readFileSync` on a directory throws EISDIR and the
//     catch below emits its own violation. Verdict unchanged, message degraded.
//
// Each test below names the decision it pins and the direction that would be dangerous, and every
// guard is exercised in BOTH directions — a guard that refuses everything is as broken as one that
// refuses nothing, and only the pair forbids a constant.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceReport } from "../../dist/lib/evidence.js";

// A mission directory inside a project root: `file:x.ts` resolves against the root, as it does in a
// real repository where `runward/` sits beside the code.
function scaffold() {
  const root = mkdtempSync(join(tmpdir(), "rw-evrep-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  return { root, mission };
}
const table = (...rows) =>
  `## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n${rows.join("\n")}\n`;
const put = (root, rel, body) => writeFileSync(join(root, rel), body);
// Every assertion below counts violations and never reads their wording: the message is prose, and
// prose is not a contract. "Refused" and "accepted" are the only two things this function decides.

// ── A deliverable the mission does not carry ────────────────────────────────────────────────────
// `if (!existsSync(path)) return []`. Removing the guard does not soften the verdict — it destroys
// the run: `readFileSync` throws ENOENT out of the whole command, and `check --strict --json` stops
// being JSON (measured: `Unexpected token '✗'`). A mission in progress is missing deliverables by
// definition, so this is the common case, not the edge one.

test("a deliverable the mission does not carry yields no violation, and never throws", () => {
  const { root, mission } = scaffold();
  try {
    assert.deepEqual(evidenceReport(mission, "handover.md", {}), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a deliverable that IS there is still audited — the early return is about absence only", () => {
  // The opposite direction, so returning `[]` unconditionally cannot satisfy the pair.
  const { root, mission } = scaffold();
  try {
    put(root, "hollow.ts", "");
    writeFileSync(join(mission, "floor.md"), table("| r-hollow | applied | file:hollow.ts |"));
    assert.equal(evidenceReport(mission, "floor.md", {}).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── The scaffolded placeholder row ──────────────────────────────────────────────────────────────
// `if (/^\[.*\]$/.test(row.rule)) continue`. The dangerous direction is a FALSE refusal: the
// template row reads `| [rule-slug] | applied | [file:line, a test, ADR-id, or a reason] |`, and
// auditing it makes the gate report `typed pointer does not resolve: file:line` — a diagnostic
// about nothing, on a row the operator has not written yet.

test("a bracketed template slug is not audited, however its cell reads", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(mission, "floor.md"), table(
      "| [rule-slug] | applied | [file:line, a test, ADR-id, or a reason] |",
    ));
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the same cell under a real slug IS audited — the skip is about the placeholder, not the cell", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(mission, "floor.md"), table(
      "| retrieval-grounding | applied | [file:line, a test, ADR-id, or a reason] |",
    ));
    assert.equal(evidenceReport(mission, "floor.md", {}).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── `file:PATH:LINE` — the line the evidence claims to be at ────────────────────────────────────
// `p.line !== undefined && content.split("\n").length < p.line`. Both directions are live:
// refusing nothing lets a pointer cite line 99 of a 3-line file; refusing everything reddens every
// honest line pointer, which is how a gate gets switched off. The example mission and runward's own
// mission carry no `:LINE` pointer at all, so neither direction is visible to the self-gate.

const THREE = "line one\nline two\nline three"; // no trailing newline: split("\n").length === 3

test("a line the file does not have is refused", () => {
  const { root, mission } = scaffold();
  try {
    put(root, "three.ts", THREE);
    writeFileSync(join(mission, "floor.md"), table("| r-line | applied | file:three.ts:99 |"));
    assert.equal(evidenceReport(mission, "floor.md", {}).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a line the file does have is accepted", () => {
  // The direction that matters most in practice: `if (true)` and `||` here redden every mission
  // that ever writes a line pointer.
  const { root, mission } = scaffold();
  try {
    put(root, "three.ts", THREE);
    writeFileSync(join(mission, "floor.md"), table("| r-line | applied | file:three.ts:2 |"));
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the LAST line of the file is inside it — the bound is `<`, not `<=`", () => {
  // Pins the boundary itself. With `<=`, citing the last line of a file — the most natural thing an
  // operator does — is refused with "the file has fewer than 3 lines" about a file that has 3.
  const { root, mission } = scaffold();
  try {
    put(root, "three.ts", THREE);
    assert.equal(THREE.split("\n").length, 3, "fixture must carry exactly 3 lines");
    writeFileSync(join(mission, "floor.md"), table("| r-line | applied | file:three.ts:3 |"));
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── `test:PATH::NAME` — a `::` that names nothing ───────────────────────────────────────────────
// `p.testNameDeclared && (p.testName === undefined || p.testName.trim().length < 2)`.
// A pointer that LOOKS precise and checks nothing is worse than a bare path: the operator believes
// a claim was verified. The `#` half of this guard is pinned in pointer-grammar.test.js; the `::`
// half was pinned by nothing, and disabling it makes a mission citing `test:x.ts::` exit 0.

const NAMED = 'test("ab initio: the guard fails closed", () => {});\n';

test("a `::` naming nothing is refused", () => {
  const { root, mission } = scaffold();
  try {
    put(root, "t.js", NAMED);
    writeFileSync(join(mission, "floor.md"), table("| r-void | applied | test:t.js:: |"));
    assert.ok(evidenceReport(mission, "floor.md", {}).length >= 1,
      "a `::` followed by nothing must be refused, not read as 'no name requested'");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a one-character test name is refused — it matches almost every file", () => {
  const { root, mission } = scaffold();
  try {
    put(root, "t.js", NAMED);
    writeFileSync(join(mission, "floor.md"), table("| r-one | applied | test:t.js::a |"));
    assert.ok(evidenceReport(mission, "floor.md", {}).length >= 1,
      "one character is a tautology dressed as a pointer");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a two-character test name present in the file is accepted — the floor is `< 2`", () => {
  // The boundary, and the opposite direction. `<= 2`, `>= 2` and `!==` all pass the two tests above
  // and fail here; without this case a constant refusal satisfies the guard.
  const { root, mission } = scaffold();
  try {
    put(root, "t.js", NAMED);
    writeFileSync(join(mission, "floor.md"), table("| r-two | applied | test:t.js::ab |"));
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a test pointer with no `::` at all is accepted — the guard is about a DECLARED name", () => {
  // `p.testNameDeclared` is what separates "no name requested" from "a name was requested and
  // lost". Forcing it true refuses every plain `test:` pointer, which is the shipped example's form.
  const { root, mission } = scaffold();
  try {
    put(root, "t.js", NAMED);
    writeFileSync(join(mission, "floor.md"), table("| r-plain | applied | test:t.js |"));
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── `test:PATH::NAME` — the name must actually be in the file ───────────────────────────────────
// `p.testName !== undefined && !content.includes(p.testName)`. This is the whole point of a `test:`
// pointer: it claims a named test exists. Disabling it lets a mission cite a test that was never
// written and cross `check --strict` with exit 0 (measured on the shipped example mission).

test("a test name absent from the file is refused", () => {
  const { root, mission } = scaffold();
  try {
    put(root, "t.js", NAMED);
    writeFileSync(join(mission, "floor.md"), table(
      '| r-absent | applied | test:t.js::"a test that was never written" |',
    ));
    assert.equal(evidenceReport(mission, "floor.md", {}).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a test name present in the file is accepted", () => {
  // The inverse. Negating the `includes` passes the case above and fails here: a gate that refuses
  // exactly the evidence that is real would be worse than no gate.
  const { root, mission } = scaffold();
  try {
    put(root, "t.js", NAMED);
    writeFileSync(join(mission, "floor.md"), table(
      '| r-present | applied | test:t.js::"ab initio: the guard fails closed" |',
    ));
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── The signature screen (ADR-0020) ─────────────────────────────────────────────────────────────
// `if (unsafeSignature(sig)) { …; continue; }`. `unsafeSignature` has its own unit tests; that the
// REPORT consults it had none. For a rule runward wrote, the corpus check catches the edit a second
// time (verified) — but a house rule with `phases: []` and MEDIUM impact is deliberately outside
// the corpus check, and its signature is still applied to its manifest row. Dropping this screen on
// that path takes the mission from refused to exit 0.

test("a signature that risks catastrophic backtracking is refused before it is ever run", () => {
  const { root, mission } = scaffold();
  try {
    put(root, "guard.ts", "export const aab = 1; // fail-closed\n");
    writeFileSync(join(mission, "floor.md"), table("| r-redos | applied | file:guard.ts |"));
    const v = evidenceReport(mission, "floor.md", { "r-redos": "(a+)+b" });
    assert.equal(v.length, 1, "the rule file must be sent back for repair, not compiled and run");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a safe signature matched by the evidence is accepted", () => {
  // Without this case the screen could refuse every signed rule and still look correct.
  const { root, mission } = scaffold();
  try {
    put(root, "guard.ts", "export const aab = 1; // fail-closed\n");
    writeFileSync(join(mission, "floor.md"), table("| r-safe | applied | file:guard.ts |"));
    assert.deepEqual(evidenceReport(mission, "floor.md", { "r-safe": "fail[-\\s]?closed" }), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── The untyped path-token pass ─────────────────────────────────────────────────────────────────
// `if (!abs || !isRegularFile(abs) || resolvedFiles.has(abs)) continue`. Three disjuncts, three
// jobs: nothing to read, not a file, already read. Turning the chain into `!abs && !isRegularFile`
// costs both of the last two — and the project's own rule is one diagnosis per row, never two.

test("a prose token that names a DIRECTORY is not evidence, and not a violation either", () => {
  // A directory whose name ends in a code/doc extension (`notes.md/`, `schema.json/`) is a path
  // token. Reading it raises EISDIR, so losing this disjunct reddens an honest row.
  const { root, mission } = scaffold();
  try {
    mkdirSync(join(root, "notes.md"), { recursive: true });
    writeFileSync(join(mission, "floor.md"), table(
      "| r-dir | applied | the design is written up in notes.md overall |",
    ));
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a file already read as a typed pointer is diagnosed once, not twice", () => {
  // `resolvedFiles.has(abs)` is what keeps the two passes from both reporting the same empty file.
  // Two lines for one defect is a report the operator stops reading.
  const { root, mission } = scaffold();
  try {
    put(root, "empty.ts", "   \n");
    writeFileSync(join(mission, "floor.md"), table("| r-dup | applied | file:empty.ts |"));
    assert.equal(evidenceReport(mission, "floor.md", {}).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a prose token naming an empty file IS reported — the pass still does its job", () => {
  // The opposite direction: the loop must not become a no-op.
  const { root, mission } = scaffold();
  try {
    put(root, "hollow.ts", "");
    writeFileSync(join(mission, "floor.md"), table(
      "| r-token | applied | implemented in hollow.ts overall |",
    ));
    assert.equal(evidenceReport(mission, "floor.md", {}).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
