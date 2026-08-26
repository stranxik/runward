// Three false greens found on 2026-08-21 by instructing the surviving mutants of evidence.js, and
// the one that could not be closed.
//
// The mutation pass measured 960 mutants over that module; 215 survived the unit suite AND the
// whole net (self-gate, OSCAL validation, smoke, in-toto, audit-corpus). Instructing them one by
// one, against real missions rather than by reading the code (ADR-0046 decision 3), turned up
// defects that no mutant was needed to reach: they were live in the published 0.36.0.
//
// Each case below was measured in BOTH directions before it was fixed — an exit 1 that became an
// exit 0 — and each pins the mechanism, never the wording.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceReport, parseEvidencePointers } from "../../dist/lib/evidence.js";

const table = (...rows) =>
  `## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n${rows.join("\n")}\n`;

/** A mission whose floor.md carries the given body, beside a source tree with one real file. */
function fixture(body) {
  const root = mkdtempSync(join(tmpdir(), "rw-falsegreen-"));
  const mission = join(root, "runward");
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(root, "src", "guard.ts"), "export function assertGrounded() {}\n");
  writeFileSync(join(mission, "floor.md"), body);
  return { root, mission };
}

const FENCE = [
  "Format illustration for contributors:",
  "",
  "```markdown",
  "## Rule conformance",
  "",
  "| Rule | Status | Evidence |",
  "|---|---|---|",
  "| some-rule | applied | file:path/to/file.ts#symbol |",
  "```",
  "",
].join("\n");

// ---------------------------------------------------------------------------------------------
// 1. A fenced illustration must not hide the manifest from the circular-evidence check.
//
// `textOutsideManifest` removes the Rule conformance table before looking for a self-cited symbol,
// because column 1 of every row is the rule's own slug and would always match — RWD-2026-0002, the
// universal green key. It took the FIRST matching heading, fenced or not, so an example of the
// format pasted above the real table made the excluded slice run from the illustration to the real
// heading, leaving the real table inside the text where the slug is then found.
//
// `readManifest` had already fixed exactly this shape for row parsing; this function had not.

test("a self-citation is refused even when a fenced example of the table sits above it", () => {
  const row = "| my-rule | applied | file:runward/floor.md#my-rule |";
  const { root, mission } = fixture(FENCE + table(row));
  try {
    const problems = evidenceReport(mission, "floor.md", {});
    assert.equal(problems.length, 1,
      "the row cites its own slug in its own table: a code fence above must not clear it");
    assert.match(problems[0].problem, /Rule conformance table/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("without the fence the same row is refused too, so the fence is what is being pinned", () => {
  // The control. Without it, a function that refuses everything satisfies the case above.
  const row = "| my-rule | applied | file:runward/floor.md#my-rule |";
  const { root, mission } = fixture(table(row));
  try {
    assert.equal(evidenceReport(mission, "floor.md", {}).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a fenced illustration does not turn honest evidence red", () => {
  // The mirror direction. Excluding more text is the strict direction, and strictness that refuses
  // legitimate evidence is how a gate gets switched off.
  const row = "| my-rule | applied | file:src/guard.ts#assertGrounded |";
  const { root, mission } = fixture(FENCE + table(row));
  try {
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), [],
      "a pointer into real code is unaffected by an illustration in the deliverable");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------------------------
// 2. An invisible line terminator must not swallow a typed pointer.
//
// `POINTER_PREFIX` ends in `$`, and `.` never matches a line terminator in JavaScript, so a single
// CR, U+2028 or U+2029 after the prefix made `$` unreachable: the pointer was dropped in silence,
// the row still read as typed, and the cited file was never opened. A paste leaves such characters
// behind and no one can see them. Measured against 0.36.0 on a row citing a file that does not
// exist: exit 1 with an ordinary cell, exit 0 with a U+2028 in it.

for (const [name, ch] of [["U+2028", " "], ["U+2029", " "], ["a carriage return", "\r"]]) {
  test(`a pointer followed by ${name} is still read, so a missing file is still refused`, () => {
    const row = `| my-rule | applied | file:src/does-not-exist.ts${ch} trailing note |`;
    const { root, mission } = fixture(table(row));
    try {
      const problems = evidenceReport(mission, "floor.md", {});
      assert.equal(problems.length, 1, `${name} must not make the pointer invisible to the gate`);
      assert.match(problems[0].problem, /does not resolve/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("a line terminator inside a cell parses to the same pointers as a space", () => {
  // The mechanism, at the level where it lives, and in both arrangements: folding must not change
  // what a well-formed cell means, only stop swallowing the cells that used to vanish.
  const withSpace = parseEvidencePointers("file:a.ts#Sym note; file:b.ts");
  const withTerm = parseEvidencePointers("file:a.ts#Sym note; file:b.ts");
  assert.deepEqual(withTerm, withSpace);
  assert.equal(withTerm.length, 2, "both pointers are read, not just the first");
});

// A RUN of terminators, which is the part of the fold nothing constrained.
//
// The three cases above each plant exactly ONE terminator character, and with a single character
// `/[\r\n\u2028\u2029]+/g` and `/[\r\n\u2028\u2029]/g` produce the identical single space. The
// quantifier was the one part of that line no test could see: measured 2026-08-26, removing the `+`
// leaves all three green.
//
// It matters because the fold rewrites the SYMBOL, and a symbol is matched verbatim. Without the
// `+`, each character becomes its own space and a quoted name gains spaces it never had.
//
// `\r\n` cannot be used to build this: `readManifest` splits the file on `\n`, so an LF ends the
// manifest row and the pointer never reaches the fold at all. A run of two CRs is a multi-character
// terminator sequence that survives inside one row.
const CR = String.fromCharCode(13);

test("a RUN of line terminators folds to ONE space, not one space each", () => {
  const one = parseEvidencePointers('file:a.ts#"alpha beta"')[0].symbol;
  for (const n of [1, 2, 3]) {
    const cell = `file:a.ts#"alpha${CR.repeat(n)}beta"`;
    assert.equal(parseEvidencePointers(cell)[0].symbol, one,
      `${n} terminator(s) must fold to the same single space as a typed space; without the ` +
      "quantifier this yields " + JSON.stringify("alpha" + " ".repeat(n) + "beta"));
  }
});

test("a symbol the file does not contain is still refused when the cell holds a terminator run", () => {
  // The dangerous direction, and the reason this is a false-green test rather than a parsing one.
  // The file holds `"gamma  delta"` with TWO spaces. The cell cites it across a run of two CRs.
  // Folded correctly the symbol is `gamma delta`, ONE space, which is NOT in the file, so the
  // pointer is refused. Without the quantifier the run becomes two spaces, the symbol matches, and
  // a pointer naming a string the author never wrote is accepted as typed evidence — RWD-2026-0006,
  // the pointer that looks precise and verifies nothing.
  const { root, mission } = fixture(table(`| my-rule | applied | file:src/guard.ts#"gamma${CR}${CR}delta" |`));
  try {
    writeFileSync(join(root, "src", "guard.ts"), 'export const note = "gamma  delta";\n');
    const problems = evidenceReport(mission, "floor.md", {});
    assert.equal(problems.length, 1,
      "the folded symbol has one space and the file has two: the gate must not find it");
    assert.match(problems[0].problem, /symbol/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("and the same run still FINDS a symbol the file does contain", () => {
  // The mirror. A fold that mangled every run would refuse honest evidence, which satisfies the
  // case above just as well and is the failure mode that gets a gate switched off.
  const { root, mission } = fixture(table(`| my-rule | applied | file:src/guard.ts#"gamma${CR}${CR}delta" |`));
  try {
    writeFileSync(join(root, "src", "guard.ts"), 'export const note = "gamma delta";\n');
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), [],
      "one space is what the run folds to, and the file has exactly that");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------------------------
// 3. The seal says which regime it is in, including when there is none.
//
// An absent seal printed nothing at all, so a reader could not tell "never sealed" from "seal
// deleted". Measured: seal a mission, tamper with a sealed file, exit 1; delete
// `runward/evidence-lock.json` and the same tampered tree exits 0, silently.
//
// The verdict deliberately does not change — sealing is opt-in, and an absent lock is the honest
// default for most missions. The verdict-level fix would need an in-repository marker saying "this
// mission seals", and `scaffold-lock.ts` already records why that buys nothing: the lock is not the
// authority, it lives in the audited repository, and anyone deliberate re-signs it in the same
// commit while honest teams pay a red gate. Against a deliberate actor the trust anchor is the
// reviewed commit (ADR-0021), where deleting the file is a visible diff. What is pinned here is
// that the gate stops being SILENT about it.

test("the strict run names the absence of a seal instead of printing nothing", async () => {
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const cli = join(fileURLToPath(new URL("../..", import.meta.url)), "dist", "cli.js");
  // A real scaffolded mission, not the hand-built fixture above: this asserts on what `check`
  // RENDERS, and the renderer needs a mission the CLI actually recognises.
  const root = mkdtempSync(join(tmpdir(), "rw-seal-silence-"));
  const run = (...args) => {
    try {
      return execFileSync(process.execPath, [cli, ...args, "--path", root], { encoding: "utf8" });
    } catch (e) { return `${e.stdout ?? ""}${e.stderr ?? ""}`; }
  };
  try {
    run("init", "--yes", "--example");
    const unsealed = run("check", "--strict");
    assert.match(unsealed, /Evidence seal/,
      "an unsealed mission must still get a seal section, or silence hides a deleted lock");
    assert.match(unsealed, /no evidence seal/);

    // And the sealed regime still reports itself, so the line above distinguishes two states
    // rather than replacing one silence with another.
    run("check", "--freeze");
    assert.match(run("check", "--strict"), /seal intact/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
