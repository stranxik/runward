// What the evidence layer refuses to accept as proof, and what the seal is allowed to freeze.
//
// Found by the full mutation pass of 2026-08-04/05: nineteen survivors clustered in four functions
// of src/lib/evidence.ts — `textOutsideManifest`, `splitPointers`, `circularEvidence`,
// `collectSealableEvidence`. All four sit on the verdict path of `check --strict`: their output
// becomes a Violation, a Violation becomes a strict gap, a strict gap becomes exit code 1. Measured
// on a real `init --yes --example` mission, the surviving mutants flip a REFUSED mission to
// ACCEPTED (a rule proven by its own text; a deleted file cited beside a live one) and an ACCEPTED
// mission to REFUSED (a documentary fact stated after the manifest table; a seal that freezes a
// directory). Nothing else in the gate catches either direction: the drift pass skips typed rows by
// construction, so `circularEvidence` and the pointer splitter are the only readers of these facts.
//
// The rule these tests hold: a pointer that LOOKS like proof must either be proof or be refused,
// and the seal must cover exactly what the crossing rested on — no more, no less. Each case names
// the decision it pins and the direction that would be dangerous, and every guard is tested in both
// directions, so no constant can satisfy it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEvidencePointers, evidenceReport, collectSealableEvidence } from "../../dist/lib/evidence.js";

function scaffold() {
  const root = mkdtempSync(join(tmpdir(), "runward-evself-"));
  const mission = join(root, "runward");
  mkdirSync(join(mission, "adr"), { recursive: true });
  return { root, mission };
}
// A cell may never contain `|` (it splits columns) and backticks are stripped before the grammar runs.
const manifest = (rows) =>
  "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" +
  rows.map((r) => `| ${r.join(" | ")} |`).join("\n") + "\n";
const problemsFor = (v, rule) => v.filter((x) => x.rule === rule).map((x) => x.problem).join(" | ");

// ── A rule is never its own application (circularEvidence) ──────────────────────────────────────
// `abs === rulesHome || abs.startsWith(rulesHome + sep)`. Collapsing this condition — to `false`,
// or `||` to `&&` — made a mission that cites runward/rules/<rule>.md as its evidence exit 0.
// Verified on the example mission: exit 1 → exit 0, with no other check picking it up.

test("a rule proven by its own rule file is refused, and the code that applies it is not", () => {
  const { root, mission } = scaffold();
  try {
    mkdirSync(join(mission, "rules"), { recursive: true });
    writeFileSync(join(mission, "rules", "hexa-architecture.md"), "# hexa-architecture\n\nsignature: ports\n");
    writeFileSync(join(root, "guard.ts"), "export function guard() { return true; }\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-own-text", "applied", "file:runward/rules/hexa-architecture.md"],
      ["r-application", "applied", "file:guard.ts"],
    ]));
    const v = evidenceReport(mission, "floor.md", {});
    // The dangerous direction: a rule file contains the very tokens its own signature looks for,
    // so accepting it is a universal green key.
    assert.match(problemsFor(v, "r-own-text"), /the rule's own text/,
      "citing runward/rules/<rule>.md proves nothing about the code");
    // The opposite direction, so no constant refusal can satisfy this test: real code still passes.
    assert.equal(problemsFor(v, "r-application"), "", "a file outside runward/rules/ is legitimate evidence");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the runward/rules directory itself is the rule corpus, not a stray directory pointer", () => {
  // `abs === rulesHome` is the half of the condition that `startsWith(rulesHome + sep)` cannot
  // reach. Dropping it left the pointer to be caught one line later as "a directory, not a file" —
  // same verdict, wrong diagnosis, and the containment reasoning silently gone.
  const { root, mission } = scaffold();
  try {
    mkdirSync(join(mission, "rules"), { recursive: true });
    writeFileSync(join(mission, "rules", "x.md"), "# x\n");
    writeFileSync(join(mission, "floor.md"), manifest([["r-corpus", "applied", "file:runward/rules"]]));
    assert.match(problemsFor(evidenceReport(mission, "floor.md", {}), "r-corpus"), /the rule's own text/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── The manifest cannot prove itself (textOutsideManifest) ──────────────────────────────────────
// A documentary rule may be proven by the SECTION that states the fact; never by the ROW that
// claims it. The function removes the `Rule conformance` section from the deliverable's text and
// looks for the symbol in what is left. Losing the end of that section (the loop that finds the
// next heading) throws away every section BELOW the table, which refuses honest evidence.

const selfDoc = [
  "# Floor",                                            // 0
  "",                                                   // 1
  "The classifier reads no secret at runtime.",          // 2   ← fact stated BEFORE the table
  "",                                                   // 3
  "## Rule conformance",                                 // 4
  "",
  "| Rule | Status | Evidence |",
  "|---|---|---|",
  '| r-before | applied | file:floor.md#"reads no secret at runtime" |',
  '| r-after | applied | file:floor.md#"seven gestures carry commands" |',
  "| zz-inside-marker | applied | file:floor.md#zz-inside-marker |",
  "",
  "## 2. Recovery",                                      //     ← the section BELOW the table
  "",
  "The runbook's seven gestures carry commands and paths.",
  "",
].join("\n");

test("a fact stated after the Rule conformance table is legitimate self-evidence", () => {
  // The dangerous direction: dropping everything below the table makes the gate refuse the one
  // form of documentary proof it explicitly advertises, on a mission that is honest. A gate that
  // reddens on the safe input is a gate people switch off.
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(mission, "floor.md"), selfDoc);
    const v = evidenceReport(mission, "floor.md", {});
    assert.equal(problemsFor(v, "r-before"), "", "a fact stated above the table is accepted");
    assert.equal(problemsFor(v, "r-after"), "", "a fact stated below the table is accepted too");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a symbol that exists only inside the manifest table is refused", () => {
  // The other direction, and the audit's actual vector: `file:<self>#<the rule's own slug>` is
  // column 1 of the very row making the claim, so it always matched. 36 of 36 pointers "opened and
  // checked" on a mission containing no evidence at all.
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(mission, "floor.md"), selfDoc);
    assert.match(problemsFor(evidenceReport(mission, "floor.md", {}), "zz-inside-marker"),
      /appears only in its Rule conformance table/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a manifest whose table starts on the second line still hides its own rows", () => {
  // Pins the sentinel: `start === -1` means "no table in this file", and nothing else. Comparing
  // against any other index makes a deliverable whose table happens to sit at that line return its
  // FULL text — table included — so every row proves itself. Measured on the example mission with
  // the heading moved to line 2: exit 1 → exit 0.
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(mission, "floor.md"), [
      "# Floor",                                          // 0
      "## Rule conformance",                              // 1  ← the index a sentinel mutation lands on
      "",
      "| Rule | Status | Evidence |",
      "|---|---|---|",
      "| zz-inside-marker | applied | file:floor.md#zz-inside-marker |",
      '| r-outside | applied | file:floor.md#"the deadline parser is deterministic" |',
      "",
      "## 2. Notes",
      "",
      "The deadline parser is deterministic and the deadline parser is deterministic out of the model.",
      "",
    ].join("\n"));
    const v = evidenceReport(mission, "floor.md", {});
    assert.match(problemsFor(v, "zz-inside-marker"), /appears only in its Rule conformance table/,
      "the table is removed wherever it starts");
    assert.equal(problemsFor(v, "r-outside"), "", "and the prose around it is still readable as evidence");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── Where one pointer ends and the next begins (splitPointers) ──────────────────────────────────
// A quote is the only thing that lets a symbol contain spaces. If the splitter stops honouring
// quotes, a sentence that mentions a path becomes a second pointer (honest evidence refused); if it
// never closes the quote, a real second pointer is swallowed (a deleted file cited and invisible).

test("a quoted symbol that mentions a path is ONE pointer, not two", () => {
  const [only, ...rest] = parseEvidencePointers('file:src/a.ts#"see file:src/b.ts for the guard"');
  assert.equal(rest.length, 0, "the quote holds the segment together");
  assert.equal(only.path, "src/a.ts");
  assert.equal(only.symbol, "see file:src/b.ts for the guard",
    "the operator's sentence survives intact — a truncated symbol matches everywhere and proves nothing");
});

test("two pointers separated by a space are both parsed when the first carries a quoted symbol", () => {
  // The opposite direction. Never closing the quote keeps everything in one chunk and the SECOND
  // pointer disappears — a deleted file cited beside a live one, invisible while the row still
  // reads as typed.
  const got = parseEvidencePointers('file:src/a.ts#"the guard fails closed" file:src/b.ts');
  assert.deepEqual(got.map((p) => p.path), ["src/a.ts", "src/b.ts"], "both pointers are parsed");
  assert.equal(got[0].symbol, "the guard fails closed", "and the first one keeps its whole symbol");
});

test("a second pointer to a deleted file is refused even when the first carries a quoted symbol", () => {
  // The same defect at the verdict level: on the example mission this is the difference between
  // exit 1 and exit 0.
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "a.ts"), "// the guard fails closed\nexport const a = 1;\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-two", "applied", 'file:a.ts#"the guard fails closed" file:gone.ts'],
      ["r-one", "applied", 'file:a.ts#"the guard fails closed"'],
    ]));
    const v = evidenceReport(mission, "floor.md", {});
    assert.match(problemsFor(v, "r-two"), /does not resolve: file:gone\.ts/, "the cited deleted file is seen");
    assert.equal(problemsFor(v, "r-one"), "", "and a lone quoted symbol is still accepted");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── What the seal is allowed to freeze (collectSealableEvidence) ────────────────────────────────
// The seal certifies a crossing: the files the `applied` rows actually rest on, plus the manifests
// that carry the claim. Widening it to rows the gate never verified (`n/a`, template placeholders)
// or to paths that are not regular files turns a later, unrelated edit into a red gate — and makes
// the seal count say the crossing rested on something it never read.

test("the seal freezes what the crossing rests on, and nothing else", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "a.ts"), "export const applied = 1;\n");
    writeFileSync(join(root, "b.ts"), "export const setAside = 1;\n");
    writeFileSync(join(root, "c.ts"), "export const placeholder = 1;\n");
    mkdirSync(join(root, "bundle.md"), { recursive: true }); // a DIRECTORY whose name carries a doc extension
    writeFileSync(join(mission, "floor.md"), manifest([
      // an applied row naming, in prose, a path that does not resolve and a path that is a directory
      ["r-live", "applied", "file:a.ts — see also docs/missing.md and the ports bundled under bundle.md"],
      ["r-set-aside", "n/a", "file:b.ts — nothing rests on this one"],
      ["[Rule name]", "applied", "file:c.ts"],
    ]));
    // Never throws: an unresolvable prose token is an ordinary thing to write in a green mission,
    // and `check --freeze` runs this on every seal.
    const keys = Object.keys(collectSealableEvidence(mission));
    assert.deepEqual(keys, ["a.ts", "runward/floor.md"],
      "an applied row's file and the manifest that carries it — not the n/a row's file, not the template placeholder's, not the directory");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
