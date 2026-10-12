// ADR-0091 increment 0: the Lean proofs recipe, held to what its documentation says.
//
// The recipe (docs/recipes/lean-proofs-as-junit.md) is documentation plus a script and a workflow an
// adopter copies. runward's gate never runs any of it. What this file pins is the contract between the
// recipe and the gate: the JUnit case name the script writes is the name the recipe documents, a row
// citing it parses as ONE test pointer whose name is that whole string, the statement digest in it
// moves the row's digest (so the ratification binds the statement), the axiom list is runward's fixed
// one, and the workflow ships as a template, never as a workflow of this repository.
//
// It does not run Lean. The end-to-end run is recorded in the recipe with its date and its limits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEvidencePointers } from "../../dist/lib/evidence.js";
import { rowDigest } from "../../dist/lib/conformance.js";
import { junitTestResult } from "../../dist/lib/tool-adapters.js";
import {
  PERMITTED_AXIOMS, REFUSED_AXIOMS, caseName, forbiddenIn, statementSha256, stripComments,
} from "../../docs/recipes/lean-proofs/lean-proof-junit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RECIPE = readFileSync(join(ROOT, "docs", "recipes", "lean-proofs-as-junit.md"), "utf8");
const SHA = "a51fb4616d6e2473a9ab0ceb4fdf7c7c92c5642331d291884e02d16fec85fec8";

test("ADR-0091: the case name is the documented one, axioms sorted, `none` when empty", () => {
  const name = caseName("Shop.refund_le_charge", SHA, ["propext", "Quot.sound"]);
  assert.equal(name, `lean-proof Shop.refund_le_charge statement-sha256=${SHA} axioms=Quot.sound,propext`);
  assert.equal(caseName("T.x", SHA, []), `lean-proof T.x statement-sha256=${SHA} axioms=none`);
  assert.ok(RECIPE.includes("lean-proof <Theorem.name> statement-sha256=<64 hex> axioms=<sorted list, or none>"),
    "the recipe documents the exact format the script writes");
  // Nothing in the name may break a manifest table cell or the pointer grammar.
  assert.doesNotMatch(name, /[|;"]|::/);
});

test("ADR-0091: a row citing the case reads one test pointer, and the statement digest moves rowDigest", () => {
  const name = caseName("Shop.refund_le_charge", SHA, ["propext"]);
  const cell = `test:reports/lean-proofs.xml::"${name}"; file:proofs/Challenge.lean — the refund bound`;
  const pointers = parseEvidencePointers(cell);
  const t = pointers.find((p) => p.kind === "test");
  assert.equal(t.path, "reports/lean-proofs.xml");
  assert.equal(t.testName, name, "the whole case name, statement digest and axioms included");
  const other = cell.replace(SHA, "0".repeat(64));
  assert.notEqual(rowDigest({ rule: "r", status: "applied", evidence: cell }), rowDigest({ rule: "r", status: "applied", evidence: other }),
    "a new statement digest in the cell unbinds a ratification bound to the old one");
});

test("ADR-0091: the gate reads the script's JUnit shape — green self-closing, red with <failure>", () => {
  const name = caseName("Shop.refund_le_charge", SHA, ["propext"]);
  const green = `<testsuites><testsuite name="lean-proofs"><testcase classname="lean-proofs" name="${name}"/></testsuite></testsuites>`;
  const red = `<testsuites><testsuite name="lean-proofs"><testcase classname="lean-proofs" name="${name}">` +
    `<failure message="x">x</failure></testcase></testsuite></testsuites>`;
  assert.equal(junitTestResult(green, name), "pass");
  assert.equal(junitTestResult(red, name), "fail");
  assert.equal(junitTestResult(green, caseName("Shop.refund_le_charge", "1".repeat(64), ["propext"])), "absent",
    "a statement changed after the row was written: the cited case is absent");
});

test("ADR-0091: the axiom list is runward's three, and the named refusals are outside it", () => {
  assert.deepEqual([...PERMITTED_AXIOMS].sort(), ["Classical.choice", "Quot.sound", "propext"]);
  for (const a of ["sorryAx", "Lean.ofReduceBool", "Lean.trustCompiler"]) {
    assert.ok(a in REFUSED_AXIOMS && !PERMITTED_AXIOMS.includes(a), a);
    assert.ok(RECIPE.includes(`\`${a}\``), `the recipe names ${a}`);
  }
});

test("ADR-0091: the scan finds forbidden words in code and ignores comments, both directions", () => {
  const src = [
    "-- sorry in a line comment",
    "/- an axiom in a /- nested -/ block comment -/",
    "theorem t : True := by sorry",
    "def axioms := 1 -- `axioms` is not `axiom`",
    "theorem u : 2 + 2 = 4 := by native_decide",
  ].join("\n");
  const hits = forbiddenIn(stripComments(src), ["sorry", "axiom", "native_decide"]);
  assert.deepEqual(hits.map((h) => `${h.word}@${h.line}`).sort(), ["native_decide@5", "sorry@3"]);
  assert.deepEqual(forbiddenIn(stripComments("-- nothing here\n/- unsafe -/\ndef ok := 1"), ["unsafe"]), []);
});

test("ADR-0091: the statement digest folds CRLF as runward's seal does", () => {
  const lf = Buffer.from("theorem t : True := by\n  sorry\n");
  const crlf = Buffer.from("theorem t : True := by\r\n  sorry\r\n");
  assert.equal(statementSha256(lf), statementSha256(crlf));
});

test("ADR-0091: the workflow ships as a template, never as a workflow of this repository", () => {
  assert.ok(existsSync(join(ROOT, "docs", "recipes", "lean-proofs", "lean-proofs.yml")));
  assert.ok(!existsSync(join(ROOT, ".github", "workflows", "lean-proofs.yml")));
  const wf = readFileSync(join(ROOT, "docs", "recipes", "lean-proofs", "lean-proofs.yml"), "utf8");
  assert.match(wf, /git diff --exit-code -- "\$REPORT"/, "the committed report is compared with the re-run");
  assert.match(wf, /HAS NOT\s+#?\s*BEEN RUN on a GitHub runner/, "the template says it was not run on a runner");
});
