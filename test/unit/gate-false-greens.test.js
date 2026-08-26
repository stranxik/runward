// Two false greens found by the 2026-08-26 audit of the gate itself, both in the same place: a
// signed rule could be discharged by evidence that proves nothing about the code.
//
//   1. Circularity was tested on the POINTER, not on the TARGET. `circularEvidence` ran only in the
//      typed-pointer loop, so deleting five characters — `file:runward/rules/x.md` becomes
//      `runward/rules/x.md` — moved the same file into the bare-path loop, which banked it
//      unexamined. Measured on 0.36.2 and on this tree, four states of one cell on a CRITICAL signed
//      rule: prose → exit 1, unrelated file → exit 1, typed self-pointer → exit 1, bare self-path →
//      **exit 0**. That is ADR-0019's inverted incentive a second time (RWD-2026-0020, "the gate
//      punished precision"): the vague spelling was the one that passed.
//
//   2. The signature was tested against the WHOLE file, conformance table included. 7 of the 9
//      signed rules runward ships carry a signature their own slug satisfies (3 CRITICAL), so
//      `file:<the manifest>#<any word in its prose>` cleared the rule from column 1 of the very row
//      making the claim. Measured: the only line of floor.md matching /secret|vault/ was that row,
//      and the gate returned verdict `clean`, exit 0, 0 violations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceReport } from "../../dist/lib/evidence.js";

const SLUG = "config-secrets-boundary";     // its own slug satisfies /secret|vault/, as shipped
const SIG = { [SLUG]: "secret|vault" };

/** A mission whose floor.md declares SLUG applied with `cell`, beside the rule's own file. */
function mission(cell, prose = "This floor is one of several.") {
  const root = mkdtempSync(join(tmpdir(), "rw-falsegreen-"));
  const m = join(root, "runward");
  mkdirSync(join(m, "rules"), { recursive: true });
  writeFileSync(join(m, "rules", `${SLUG}.md`),
    "---\nsignature: secret|vault\n---\n\n## Secrets at the boundary\n\nKeep the vault key out of the model.\n");
  writeFileSync(join(m, "unrelated.md"), "# Unrelated\n\nThis document is about queues.\n");
  writeFileSync(join(m, "states-it.md"), "# Boundary\n\nThe vault client runs outside the domain.\n");
  writeFileSync(join(m, "floor.md"),
    `# Floor\n\n${prose}\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| ${SLUG} | applied | ${cell} |\n`);
  return { root, m };
}

const problems = (cell, prose) => {
  const { root, m } = mission(cell, prose);
  try { return evidenceReport(m, "floor.md", SIG).map((v) => v.problem); }
  finally { rmSync(root, { recursive: true, force: true }); }
};

test("circularity is a property of the target, not of the pointer's spelling", () => {
  // All four states asserted together: the test cannot be satisfied by refusing everything, because
  // the last case must PASS, nor by accepting everything, because the first three must not.
  assert.ok(problems("the boundary is respected throughout").length > 0, "prose is not evidence");
  assert.ok(problems("file:runward/unrelated.md").length > 0, "an unrelated file does not carry the rule's shape");
  const typed = problems(`file:runward/rules/${SLUG}.md`);
  assert.ok(typed.some((p) => /the rule's own text/.test(p)), `typed self-pointer, got: ${JSON.stringify(typed)}`);

  // THE HOLE: the same target, five characters shorter.
  const bare = problems(`runward/rules/${SLUG}.md`);
  assert.ok(bare.some((p) => /the rule's own text/.test(p)),
    `a bare path to the rule's own file is the same circularity — got: ${JSON.stringify(bare)}`);

  assert.deepEqual(problems("file:runward/states-it.md"), [], "a file that states the fact still clears the rule");
});

test("one target is adjudicated once: a typed pointer is not also re-judged as a bare path", () => {
  // `evidencePathTokens` extracts `runward/rules/x.md` out of `file:runward/rules/x.md`, so the two
  // loops saw the same target. A real defect reported twice is a defect in the diagnostic.
  const found = problems(`file:runward/rules/${SLUG}.md`);
  const circular = found.filter((p) => /the rule's own text/.test(p));
  assert.equal(circular.length, 1, `one circularity, named once — got: ${JSON.stringify(found)}`);
  // The row is still reported as carrying no usable evidence, which is a different statement about
  // a different thing, and must survive: naming one defect once is not naming fewer defects.
  assert.ok(found.some((p) => /declares an evidence signature/.test(p)), JSON.stringify(found));
});

test("a conformance row DECLARES a fact and never states one, so it cannot satisfy a signature", () => {
  // `#of` resolves because "of" appears in the prose outside the table, which is what lets
  // circularEvidence through. What must stop it is the signature, read outside the manifest.
  const found = problems("file:runward/floor.md#of");
  assert.ok(found.some((p) => /does not match the rule's signature/.test(p)),
    `the declaring row must not discharge the rule it declares — got: ${JSON.stringify(found)}`);
});

test("the signature still reads the rest of the file, so the cut is the table and not the document", () => {
  // The opposite direction: if the fix had simply refused every pointer at the manifest, this would
  // pass too — and it must not. The fact lives in the prose of the same file the row sits in.
  const found = problems("file:runward/floor.md#vault",
    "This floor is one of several. The vault client runs outside the domain.");
  assert.deepEqual(found, [], `a fact stated in the prose of the manifest is still a fact — got: ${JSON.stringify(found)}`);
});
