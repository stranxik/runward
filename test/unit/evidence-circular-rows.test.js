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

/** A mission whose floor.md carries one applied row citing ITSELF, with `block` above the section. */
function selfCiting(block, evidence = "file:runward/floor.md#hexa-architecture") {
  const root = mkdtempSync(join(tmpdir(), "rw-circular-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(mission, "floor.md"),
    `# Architecture\n\n${block ? block + "\n\n" : ""}## Rule conformance\n\n` +
    `| Rule | Status | Evidence |\n|---|---|---|\n| hexa-architecture | applied | ${evidence} |\n`);
  return { root, mission };
}

const problems = (block, evidence) => {
  const { root, mission } = selfCiting(block, evidence);
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
