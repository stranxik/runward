// A conformance row is never "the section that states the fact", wherever the row sits.
//
// `circularEvidence` refuses `file:<self>#<the rule's own slug>` — RWD-2026-0002's universal green
// key, column 1 of the very row making the claim. Its escape hatch is deliberate and load-bearing:
// some rules ARE documentary, and their only honest evidence is the passage of the deliverable that
// states the fact. So the line it draws is "cite a fact that lives OUTSIDE the manifest table, not
// the row that declares it", and `textOutsideManifest` decides what counts as outside.
//
// That function KEEPS fenced text on purpose: a code sample inside the deliverable can be honest
// evidence. Measured 2026-08-26 on the shipped example, that made the key work again:
//
//     bare self-citation                                    exit 1, 1 conformance gap
//     + a fenced illustration of a manifest row above it     exit 0, verdict clean
//     + the same row unfenced, outside the section           exit 0, verdict clean
//
// Any document explaining the manifest format carries such a block, which is precisely the artefact
// RWD-2026-0002 was about. The unfenced variant was never reported and is the same hole.
//
// The fix tests the SHAPE, not the fence: three cells or more whose second is one of the three
// decisions a row may carry. This file pins both directions — the two vectors closed, and the forms
// that must keep passing, because a gate that refuses honest evidence is the one that gets switched
// off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceReport } from "../../dist/lib/evidence.js";

/** A mission whose floor.md carries one applied row citing ITSELF, with `block` above the section
 *  and `inside` between the heading and the table. */
function selfCiting(block, evidence = "file:runward/floor.md#hexa-architecture", inside = "", tail = "") {
  const root = mkdtempSync(join(tmpdir(), "rw-circular-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(mission, "floor.md"),
    `# Architecture\n\n${block ? block + "\n\n" : ""}## Rule conformance\n\n` +
    `${inside ? inside + "\n\n" : ""}` +
    `| Rule | Status | Evidence |\n|---|---|---|\n| hexa-architecture | applied | ${evidence} |\n${tail}`);
  return { root, mission };
}

const problems = (block, evidence, inside, tail) => {
  const { root, mission } = selfCiting(block, evidence, inside, tail);
  try { return evidenceReport(mission, "floor.md", {}).map((v) => v.problem); }
  finally { rmSync(root, { recursive: true, force: true }); }
};

test("the control: a bare self-citation is refused, or this file proves nothing", () => {
  const found = problems("");
  assert.equal(found.length, 1, `expected the circular refusal, got: ${JSON.stringify(found)}`);
  assert.match(found[0], /appears only in its Rule conformance table/);
});

// The two vectors. Each of these blocks, added and nothing else changed, used to turn the refusal
// above into a pass.
for (const [what, block] of [
  ["a fenced illustration of a manifest row", "### How a row is written\n\n```text\n| hexa-architecture | applied | file:code/src/x.ts#Foo |\n```"],
  ["the same illustration behind a tilde fence", "~~~text\n| hexa-architecture | applied | file:code/src/x.ts#Foo |\n~~~"],
  ["an indented fence, which readManifest also skips", "  ```md\n  | hexa-architecture | applied | file:code/src/x.ts#Foo |\n  ```"],
  ["a bare manifest row sitting outside the section", "| hexa-architecture | applied | file:code/src/x.ts#Foo |"],
  ["a row declaring a deviation", "| hexa-architecture | deviated | adr:0007 |"],
  ["a row declaring n/a", "| hexa-architecture | n/a | no adapter in this service |"],
  ["a whole second table of rows", "| Rule | Status | Evidence |\n|---|---|---|\n| hexa-architecture | applied | file:code/src/x.ts#Foo |"],
  // WITHOUT OUTER PIPES, which is the second spelling of this hole and was live until 2026-08-26.
  // The first fix required a leading pipe, so the same row written the way a markdown renderer still
  // lays out as a table was kept as text outside the manifest and the universal green key worked
  // again: measured on the shipped example, exit 1 with one gap became exit 0, verdict clean, with
  // `--freeze` sealing it.
  ["a row with no outer pipes at all", "hexa-architecture | applied | file:code/src/x.ts#Foo"],
  ["a row with only a trailing pipe", "hexa-architecture | applied | file:code/src/x.ts#Foo |"],
  ["a row with only a leading pipe", "| hexa-architecture | applied | file:code/src/x.ts#Foo"],
  ["a row with no spaces around its pipes", "hexa-architecture|applied|file:code/src/x.ts#Foo"],
  ["a fenced row with no outer pipes", "```text\nhexa-architecture | applied | file:code/src/x.ts#Foo\n```"],
]) {
  test(`a row that DECLARES conformance is not a fact that states it: ${what}`, () => {
    const found = problems(block);
    assert.equal(found.length, 1,
      `this block re-arms the universal green key and must not clear the citation — got: ${JSON.stringify(found)}`);
    assert.match(found[0], /appears only in its Rule conformance table/);
  });
}

// The other direction, and the file is worthless without it. Each of these is a legitimate way for a
// documentary rule to state its fact, and every one of them must stay green.
for (const [what, block] of [
  ["prose naming the rule", "The hexa-architecture rule is applied by keeping the domain pure, behind four ports."],
  ["a heading naming the rule", "### hexa-architecture, and where it lives"],
  ["an ordinary documentation table with no status cell", "| Rule | Where it lives |\n|---|---|\n| hexa-architecture | code/src/core/ |"],
  ["a two-cell row whose second cell merely looks like a word", "| hexa-architecture | applied |"],
  ["a fenced CODE sample, which is honest evidence and must keep counting",
   "```ts\n// hexa-architecture: the domain imports no adapter\nexport const pure = true;\n```"],
  ["a fenced shell snippet naming the rule", "```sh\nrunward explain hexa-architecture\n```"],
  // PIPES IN HONEST CONTENT, and this is the half that makes the fix hard. Dropping the pipe test
  // altogether closes the vectors above and immediately refuses all five of these — measured on a
  // 571-case battery, twelve honest cases that clear a citation on the shipped build. What separates
  // them from a row is the FIRST cell: a rule id carries no whitespace, and every line here has
  // words before its first pipe.
  ["a fenced shell pipeline", "```sh\nrunward explain hexa-architecture | applied | head -1\n```"],
  ["a fenced code comment carrying a pipe", "```ts\n// hexa-architecture | applied | the domain imports no adapter\nexport const x = 1;\n```"],
  ["prose with pipes in it", "The hexa-architecture rule | applied | keeps the domain pure."],
  ["a list item with pipes", "- hexa-architecture | applied | the domain imports no adapter"],
  ["a blockquote with pipes", "> hexa-architecture | applied | keeps the domain pure."],
]) {
  test(`a fact that STATES the rule still clears the citation: ${what}`, () => {
    assert.deepEqual(problems(block), [],
      "refusing this would make the gate contradict its own advice to type pointers");
  });
}

test("the exclusion is about the row's shape, not about the rule under test", () => {
  // A conformance row for a DIFFERENT rule is just as much a declaration, and dropping only the
  // matching slug would leave the vector open one rename away.
  const found = problems("| some-other-rule | applied | file:code/src/y.ts#Bar |\n| hexa-architecture | applied | file:code/src/x.ts#Foo |");
  assert.equal(found.length, 1);
});

// ---------------------------------------------------------------------------------------------
// THE SECTION EXCLUSION IS STILL LOAD-BEARING, and the row-shape test above made the old tests
// stop proving it.
//
// Measured on the CI run of 2026-08-26: `textOutsideManifest` fell from 59 % to 30 %, with SIXTEEN
// mutants flipping from killed to surviving — all of them in the fence detection and the
// section walk. The cause is not that the code became redundant. Every fixture that used to pin it
// put the slug in a conformance ROW, and `conformanceRow` now removes those wherever they sit, so
// breaking the section walk no longer changes whether the slug is found.
//
// It still changes it for everything ELSE inside the section. Measured on the shipped example with
// `heading()` forced to false: a mission carrying prose inside its Rule conformance section goes
// from exit 1 / gaps / 1 conformance gap to exit 0 / clean / 0, and the full unit suite passes with
// that mutant in place. A false green nothing caught.
//
// So these cases put the slug in content the row-shape test does NOT remove, which is the only way
// left to hold the section walk to its job.
for (const [what, inside] of [
  ["prose", "The hexa-architecture rule is applied by keeping the domain pure."],
  // NOT a sub-heading: a heading of any depth ENDS the section, so `### hexa-architecture` is
  // outside it by design and clearing the citation there is correct. Pinned below instead.
  ["a list item", "- hexa-architecture: the domain imports no adapter"],
  ["a blockquote", "> hexa-architecture is applied by keeping the domain pure."],
  ["a row whose status is not a decision, which readManifest refuses and this must still exclude",
   "| hexa-architecture | | file:code/src/x.ts#Foo |"],
  ["a row with a misspelled status", "| hexa-architecture | aplied | file:code/src/x.ts#Foo |"],
  ["an ordinary table inside the section", "| Rule | Where it lives |\n|---|---|\n| hexa-architecture | code/src/core/ |"],
  ["a fenced block, so a fenced heading may not terminate the section",
   "```md\n## Not a real heading\n\nhexa-architecture lives here\n```"],
]) {
  test(`content INSIDE the conformance section is not "outside the manifest": ${what}`, () => {
    const found = problems("", undefined, inside);
    assert.equal(found.length, 1,
      `${what} sits inside the section the gate excludes, so it cannot clear a self-citation — ` +
      `got: ${JSON.stringify(found)}`);
    assert.match(found[0], /appears only in its Rule conformance table/);
  });
}

test("the section runs to the next heading, and everything after it is outside again", () => {
  // The other end of the walk. If the section swallowed the rest of the file, a legitimate fact
  // stated below the table would stop clearing the citation — a false RED, and the direction that
  // gets a gate switched off.
  assert.deepEqual(
    problems("", undefined, "", "\n## 5. What stays open\n\nThe hexa-architecture rule is applied by keeping the domain pure.\n"),
    [], "a fact stated after the section is outside the manifest and clears the citation");
});

test("the section ends at a heading of ANY depth, including level 1", () => {
  assert.deepEqual(
    problems("", undefined, "", "\n# Appendix A\n\nThe hexa-architecture rule is applied here.\n"),
    [], "a level-1 heading terminates the section as surely as a level-2 one");
});

test("a fence flush against the heading does not hide it", () => {
  // Its own fixture, and that is the point of the test. `selfCiting` joins its block to the heading
  // with a BLANK LINE, so every case in this file leaves at least one line between a closing fence
  // and the heading below it — which is precisely the gap an off-by-one in the fence-flag array
  // hides behind. Written through the helper, this case passed under the mutant it was written for.
  //
  // Measured 2026-08-26: seeding that array with one element shifts every flag down by one, so a
  // heading sitting immediately after a CLOSING fence inherits the fence's flag and stops being a
  // heading. No section is then excluded, prose stated inside the conformance section counts as
  // text outside the manifest, and the mission goes exit 1 to exit 0 with the whole suite green.
  const root = mkdtempSync(join(tmpdir(), "rw-flush-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  const lines = [
    "# Architecture",
    "",
    "### How to read the table below",
    "",
    "```text",
    "an illustration",
    "```",
    "## Rule conformance",              // FLUSH against the closing fence, no blank line
    "",
    "The hexa-architecture rule is applied by keeping the domain pure.",
    "",
    "| Rule | Status | Evidence |",
    "|---|---|---|",
    "| hexa-architecture | applied | file:runward/floor.md#hexa-architecture |",
    "",
  ];
  assert.equal(lines[lines.indexOf("## Rule conformance") - 1], "```",
    "the fixture only tests anything if the fence closes on the line directly above the heading");
  writeFileSync(join(mission, "floor.md"), lines.join("\n"));
  try {
    const found = evidenceReport(mission, "floor.md", {}).map((v) => v.problem);
    assert.equal(found.length, 1,
      `the heading is real and its section must still be excluded — got: ${JSON.stringify(found)}`);
    assert.match(found[0], /appears only in its Rule conformance table/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
