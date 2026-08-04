// The pointer grammar and the manifest reader, held to one rule: a pointer that LOOKS precise
// must either be precise or be refused. Never silently narrowed.
//
// Every case below was a proven FALSE POSITIVE — the gate went green on evidence that proved
// nothing — found by an adversarial audit on 2026-08-04. They are grouped because they are one
// defect wearing eight faces: something ran before the grammar did, and what the operator wrote
// was quietly turned into something else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEvidencePointers, evidenceReport } from "../../dist/lib/evidence.js";
import { parseManifest, readManifest } from "../../dist/lib/conformance.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const P = (s) => parseEvidencePointers(s);
const table = (...rows) => `## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n${rows.join("\n")}\n`;

test("a `;` inside a quoted symbol does not split the pointer", () => {
  // `evidence.split(";")` ran before anything knew about quotes, so a sentence containing a
  // semicolon became the symbol `"the` — present in nearly every file, hence GREEN. The same
  // sentence with a comma was RED. A verdict that depends on the punctuation inside a sentence
  // is not deterministic in any useful sense.
  const [p] = P('file:src/a.ts#"the guard fails closed; nothing passes"');
  assert.equal(p.path, "src/a.ts");
  assert.equal(p.symbol, "the guard fails closed; nothing passes");
});

test("the apostrophe is not a delimiter, because French is full of them", () => {
  // `#'l'invariant tient'` closed after ONE character and the gate then looked for `l`, which is
  // true of every non-empty file: a tautology dressed as a precise pointer. The project's working
  // language is French.
  const [p] = P("file:doc.md#'l'invariant n'est jamais franchi'");
  assert.notEqual(p.symbol, "l", "a single-letter symbol from a French sentence is the bug");
});

test("several pointers in one cell are ALL parsed, whatever separates them", () => {
  // `.match` took the first and `(\S.*)$` swallowed the rest, so a deleted file could be cited
  // beside a live one and stay invisible while the row still read as typed.
  for (const sep of [" ", ", ", " ; "]) {
    const got = P(`file:src/a.ts#Sym${sep}file:src/b.ts`).map((x) => x.path);
    assert.deepEqual(got, ["src/a.ts", "src/b.ts"], `separator ${JSON.stringify(sep)}`);
  }
});

test("a malformed `adr:` is a pointer that FAILS, not a pointer that never existed", () => {
  // `adr:ADR-9999` yielded no pointer at all and said nothing: the row read as prose, the drift
  // check skipped it because the cell looked typed, and the operator believed a decision was cited.
  const [p] = P("adr:ADR-9999");
  assert.ok(p, "a pointer is produced");
  assert.ok(p.malformed, "and it carries why it cannot be used");
  assert.equal(P("adr:0001")[0].malformed, undefined, "a well-formed one is untouched");
});

test("the error message shows the pointer the operator actually wrote", () => {
  // `raw` was built from the leading token, so a quoted symbol was reported as `file:doc.md#"the`
  // — sending the operator to hunt a typo that was not there.
  const [p] = P('file:doc.md#"two words"');
  assert.match(p.raw, /two words/, `raw was ${p.raw}`);
});

test("prose that merely mentions the grammar is not a pointer", () => {
  assert.deepEqual(P("voir le fichier src/a.ts pour le detail"), []);
});

test("a pointer written as a markdown code-span still resolves", () => {
  // Backticks are stripped from every column, as they always have been — writing a pointer as a
  // code-span is the normal thing to do. The consequence, and the reason the grammar offers only
  // `"` as a delimiter: a backtick is gone before the grammar runs, so it can never delimit.
  const rows = parseManifest(table("| rule-a | applied | `file:src/x.ts:1` |"));
  assert.equal(rows[0].evidence, "file:src/x.ts:1");
});

test("two `Rule conformance` sections are refused, never silently arbitrated", () => {
  // An "example of the format" pasted above the real table made a whole phase invisible while the
  // gate reported it accounted for. Choosing the first is the failure; refusing is the fix.
  const doc = table("| rule-a | applied | file:x |") + "\n" + table("| rule-b | applied | file:y |");
  const { rows, problems } = readManifest(doc);
  assert.deepEqual(rows, [], "nothing is read from an ambiguous manifest");
  assert.match(problems.join(" "), /2 .*sections/);
});

test("a table inside a code fence is an illustration, not a manifest", () => {
  const doc = "## Rule conformance\n\n```markdown\n| fake-rule | applied | file:nowhere.ts |\n```\n\n| Rule | Status | Evidence |\n|---|---|---|\n| rule-a | applied | file:x |\n";
  assert.deepEqual(readManifest(doc).rows.map((r) => r.rule), ["rule-a"]);
});

test("any heading level ends the section, and a row without its closing pipe is still read", () => {
  // GFM makes the trailing pipe optional and renders both forms identically; dropping such a row
  // took its pointer with it. And `### Notes` did not end the section, so a following table was
  // absorbed into the manifest.
  const doc = "## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| rule-a | applied | file:x\n\n### Notes\n\n| Rule | Status | Evidence |\n|---|---|---|\n| not-a-rule | applied | file:y |\n";
  assert.deepEqual(readManifest(doc).rows.map((r) => r.rule), ["rule-a"]);
});

test("a `#` or `::` that names nothing is refused, not treated as absent", () => {
  // Silent no-ops on a pointer that looks precise: the operator believes a claim was verified.
  const dir = mkdtempSync(join(tmpdir(), "rw-ptr-"));
  try {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "export const x = 1;\n");
    writeFileSync(join(dir, "floor.md"), table(
      "| r-hash | applied | file:src/a.ts# |",
      "| r-empty | applied | file:src/a.ts#\"\" |",
      "| r-one | applied | file:src/a.ts#x |",
    ));
    const v = evidenceReport(dir, "floor.md", {});
    for (const rule of ["r-hash", "r-empty", "r-one"]) {
      assert.ok(v.some((x) => x.rule === rule && /names nothing|at least 2/.test(x.problem)),
        `${rule} must be refused, got: ${v.filter((x) => x.rule === rule).map((x) => x.problem).join(" | ") || "nothing"}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
