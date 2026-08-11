// The requirements register must not rot.
//
// `docs/compliance/tool-operational-requirements.md` states what the gate is required to do, one
// requirement at a time, each citing a test file and a case name inside it. A document like that is
// worth exactly as much as its weakest citation: a renamed test, a deleted file, a case that never
// existed, and the register becomes a list of assertions with the appearance of evidence — which is
// the shape of thing this whole project exists to refuse.
//
// So the citations are checked mechanically. Every file cited must exist. Every case name cited must
// be present in that file. Identifiers must be unique and contiguous, so a requirement cannot be
// dropped without anyone noticing the hole.
//
// WHAT THIS GUARD DOES NOT DO, and it must be said here as loudly as in the document: it checks that
// a LINK EXISTS, never that the test is RELEVANT. A requirement citing a test that passes for
// unrelated reasons stays green here. That is the same class of limit `GATE_NON_SCOPE` states one
// floor below, and a traceability guard that let itself be read as a relevance guard would reproduce,
// at its own level, precisely the defect the register documents.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TOR = join(ROOT, "docs", "compliance", "tool-operational-requirements.md");

/** Parse the register into `{ id, title, requirement, verifiedBy: [{file, caseName}], nonScope }`. */
function parseRegister() {
  const text = readFileSync(TOR, "utf8");
  const blocks = text.split(/^### /m).slice(1);
  return blocks.map((b) => {
    const head = b.slice(0, b.indexOf("\n"));
    const id = (head.match(/^(TOR-\d{3})/) ?? [])[1] ?? null;
    // A citation reads: **Verified by.** `path/to/file.js` — "the case name"
    // The em dash is the separator the document uses; a citation without a quoted name is caught
    // below rather than silently skipped, which is how a half-written entry would otherwise pass.
    const verifiedBy = [...b.matchAll(/\*\*Verified by\.\*\*\s*`([^`]+)`(?:\s*—\s*"([^"]+)")?/g)]
      .map((m) => ({ file: m[1], caseName: m[2] ?? null }));
    return {
      id,
      title: head.trim(),
      hasRequirement: /\*\*Requirement\.\*\*/.test(b),
      hasNonScope: /\*\*Does not assert\.\*\*/.test(b),
      verifiedBy,
    };
  }).filter((e) => e.id);
}

const REGISTER = parseRegister();

test("the register is not empty, and parsing it did not silently collapse", () => {
  // The base case. Every assertion below is vacuously true against an empty parse, which is exactly
  // how a broken regex turns this file into a guard that guards nothing.
  assert.ok(REGISTER.length >= 40, `expected the shipped register, parsed ${REGISTER.length} entries`);
  assert.ok(REGISTER.every((e) => /^TOR-\d{3}$/.test(e.id)), "every entry carries a well-formed identifier");
});

test("every requirement states a requirement, a verification and a non-scope", () => {
  // The third part is the one that decays first: it is the only one nobody misses when it is gone.
  const missing = REGISTER.filter((e) => !e.hasRequirement || !e.hasNonScope || e.verifiedBy.length === 0);
  assert.deepEqual(missing.map((e) => e.id), [],
    "these entries are missing a Requirement, a Verified by, or a Does not assert");
});

test("identifiers are unique and contiguous, so a dropped requirement leaves a hole that is visible", () => {
  const ids = REGISTER.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate identifier");
  const nums = ids.map((i) => Number(i.slice(4))).sort((a, b) => a - b);
  const gaps = nums.filter((n, i) => i > 0 && n !== nums[i - 1] + 1);
  assert.deepEqual(gaps, [], `numbering must be contiguous; first break at TOR-${String(gaps[0]).padStart(3, "0")}`);
  assert.equal(nums[0], 1, "numbering starts at TOR-001");
});

test("every cited file exists", () => {
  const dead = [];
  for (const e of REGISTER) {
    for (const v of e.verifiedBy) if (!existsSync(join(ROOT, v.file))) dead.push(`${e.id} -> ${v.file}`);
  }
  assert.deepEqual(dead, [], "a requirement cites a file that is not in the tree");
});

test("every cited case name is present in the file that is supposed to carry it", () => {
  // The citation that rots the most quietly: the file survives a rename of the test inside it, so
  // nothing breaks and the register keeps pointing at a case that no longer exists under that name.
  const dead = [];
  for (const e of REGISTER) {
    for (const v of e.verifiedBy) {
      if (!v.caseName) continue; // a file-level citation, checked by the case above
      const src = existsSync(join(ROOT, v.file)) ? readFileSync(join(ROOT, v.file), "utf8") : "";
      if (!src.includes(v.caseName)) dead.push(`${e.id} -> ${v.file} :: "${v.caseName}"`);
    }
  }
  assert.deepEqual(dead, [], "a requirement cites a case name that file does not contain");
});

test("the register states its own limit: a link is not relevance", () => {
  // A document that traced requirements to tests and did NOT say what the tracing proves would be
  // read as a stronger claim than it is. This is the sentence an assessor should find before they
  // have to ask for it, so its absence is a build failure like any other.
  const text = readFileSync(TOR, "utf8");
  assert.match(text, /checks that a link EXISTS, never that the test is relevant/i,
    "the register must state that traceability checks the link and not the relevance of the test");
  assert.match(text, /not a qualification kit/i,
    "the register must refuse the name a reader would otherwise attach to it");
});

test("the register names what it does NOT cover", () => {
  // Omission is the failure mode of a requirements document: what is absent reads as absent because
  // nothing was needed, rather than because nobody wrote it.
  const text = readFileSync(TOR, "utf8");
  assert.match(text, /## 10\. What has no requirement yet/,
    "the register must carry the section that names its own gaps");
  for (const owed of ["compliance.ts", "characterize", "ADR-0046"]) {
    assert.ok(text.includes(owed), `the gap section must still name ${owed}`);
  }
});
