// The territory map as an operator actually writes it, and as an editor actually saves it.
//
// This module has NO second layer, and that is measured rather than assumed: applied to `dist` on
// 2026-08-29, the mutant that makes `readTerritoryMap` THROW leaves `check --strict`, `check --json`,
// `test/smoke.js`, `test/audit-corpus.js` and `test/oscal-schema.js` byte-identical and exit 0 —
// none of them ever writes a `runward/territory.md`. The map is reached through `rules --for` and
// `status` alone. Every gap here is therefore a gap in the last net, which is why the corpus below
// is a corpus and not a handful of cases.
//
// What the campaign's 45 survivors say the existing tests do not see:
//
//   · MARKDOWN DIALECT. The boundaries test pins the left-aligned separator `|:---|` and nothing
//     else, so making the leading colon mandatory publishes a right-aligned `|---:|` as
//     "unknown category `:---:`" — a refusal reported about a line the operator never declared.
//   · A BACKTICK INSIDE A CELL. Stripping every backtick instead of the enclosing pair turns
//     `` de`clare` `` from a NAMED REFUSAL into a LIVE BINDING, and `` `star`tup` `` into a live
//     `startup`. That is the worst direction this module has: a malformed declaration silently
//     governing files.
//   · PADDING. `` ` startup ` `` refused as an unknown category is a correct declaration reported
//     as the operator's mistake — the undue-refusal half, which matters as much.
//   · THE SECTION'S EDGES. An anchorless heading match lets the prose line `Notes ## Territory`
//     open a territory section; an anchorless end match lets a why reading `see issue # 12` close
//     one, truncating the map with the operator's own sentence.
//
// The transcript is a byte golden: it needs no expected value written by hand, so it cannot be
// wrong about what the parser does. The invariants after it name the property, so the graver
// classes fail legibly rather than as "line 212 differs".
//
// Regenerate deliberately, after reading the diff:
//   UPDATE_GOLDEN=1 node --test test/unit/territory-map-corpus.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readTerritoryMap, applyTerritoryMap } from "../../dist/lib/territory-map.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GOLDEN = join(ROOT, "test", "fixtures", "golden", "territory-map-transcript.txt");

const HEAD = "| Pattern | Category | Effect | Why |";
const SEP = "|---|---|---|---|";
const ROW = "| `src/entry.*.ts` | `secret-boundary` | declare | derives a token from an env secret |";
const doc = (...lines) => `## Territory\n\n${HEAD}\n${SEP}\n${lines.join("\n")}\n`;

/** Every shape the corpus covers, named by what it is about. */
const CORPUS = {
  // — the ordinary case, and the dialects an editor or a formatter produces —
  plain: doc(ROW),
  separatorLeftAligned: `## Territory\n\n${HEAD}\n|:---|:---|:---|:---|\n${ROW}\n`,
  separatorRightAligned: `## Territory\n\n${HEAD}\n|---:|---:|---:|---:|\n${ROW}\n`,
  separatorCentred: `## Territory\n\n${HEAD}\n|:---:|:---:|:---:|:---:|\n${ROW}\n`,
  separatorMixed: `## Territory\n\n${HEAD}\n|---:|:---:|---|---|\n${ROW}\n`,
  separatorLong: `## Territory\n\n${HEAD}\n|--------|--------|--------|--------|\n${ROW}\n`,
  separatorSingleDash: `## Territory\n\n${HEAD}\n| - | - | - | - |\n${ROW}\n`,

  // — the heading, and the near-misses around it —
  headingLevelThree: `### Territory\n\n${HEAD}\n${SEP}\n${ROW}\n`,
  headingLevelSeven: `####### Territory\n\n${HEAD}\n${SEP}\n${ROW}\n`,
  headingIndented: `  ## Territory\n\n${HEAD}\n${SEP}\n${ROW}\n`,
  headingInProse: `Notes ## Territory\n\n${HEAD}\n${SEP}\n${ROW}\n`,
  headingTwoSpaces: `##  Territory\n\n${HEAD}\n${SEP}\n${ROW}\n`,
  headingTrailingSpace: `## Territory  \n\n${HEAD}\n${SEP}\n${ROW}\n`,
  headingSuffixed: `## TerritoryX\n\n${HEAD}\n${SEP}\n${ROW}\n`,
  headingAbsent: `${HEAD}\n${SEP}\n${ROW}\n`,

  // — where the section ends —
  endedByHeadingOne: `## Territory\n\n${HEAD}\n${SEP}\n${ROW}\n\n# Notes\n\n${HEAD}\n${SEP}\n| \`other.ts\` | \`startup\` | declare | this table is NOT territory |\n`,
  endedByHeadingThree: `## Territory\n\n${HEAD}\n${SEP}\n${ROW}\n\n### Notes\n\n${HEAD}\n${SEP}\n| \`other.ts\` | \`startup\` | declare | this table is NOT territory |\n`,
  hashInsideAWhy: doc("| `src/a.ts` | `startup` | declare | see issue # 12 for the reason |", ROW),

  // — the header row, and what is mistaken for it —
  headerPlural: `## Territory\n\n| Patterns | Category | Effect | Why |\n${SEP}\n${ROW}\n`,
  dataRowEndingInPattern: doc("| `src/pattern` | `startup` | declare | a path that ends in the header word |"),

  // — cells: padding, and a backtick INSIDE the value —
  patternPadded: doc("| ` src/a.ts ` | `startup` | declare | padded pattern |"),
  patternInnerBacktick: doc("| `src/a`b.ts` | `startup` | declare | a backtick inside the pattern |"),
  categoryPadded: doc("| `src/a.ts` | ` startup ` | declare | padded category |"),
  categoryInnerBacktick: doc("| `src/a.ts` | `star`tup` | declare | a backtick inside the category |"),
  effectPadded: doc("| `src/a.ts` | `startup` | ` declare ` | padded effect |"),
  effectInnerBacktick: doc("| `src/a.ts` | `startup` | de`clare` | a backtick inside the effect |"),
  categoryUnknown: doc("| `src/a.ts` | `not-a-category` | declare | an unknown category |"),
  effectUnknown: doc("| `src/a.ts` | `startup` | maybe | an effect outside the vocabulary |"),

  // — the why column —
  whyEmpty: doc("| `src/a.ts` | `startup` | declare |  |"),
  whyPlaceholder: doc("| `src/a.ts` | `startup` | declare | [TODO] |"),
  whyEndsWithBracket: doc("| `src/a.ts` | `startup` | declare | see the notes [TODO] |"),
  whyStartsWithBracket: doc("| `src/a.ts` | `startup` | declare | [TODO] fix this reason later |"),
  whyWithPipe: doc("| `src/a.ts` | `startup` | declare | a why with a pipe | and a tail |"),
  whyWithEmptyTail: doc("| `src/a.ts` | `startup` | declare | a why with an empty tail column | |"),

  // — the pattern as a path —
  patternGlobStar: doc("| `**/*.ts` | `startup` | declare | every typescript file |"),
  patternBareStar: doc("| `*` | `startup` | declare | everything |"),
  patternAbsolute: doc("| `/etc/passwd` | `startup` | declare | not project-relative |"),
  patternParent: doc("| `../outside.ts` | `startup` | declare | outside the project |"),

  // — the row as a line —
  rowIndented: doc("  | `src/a.ts` | `startup` | declare | an indented row |"),
  rowNoLeadingPipe: doc("`src/a.ts` | `startup` | declare | no leading pipe |"),
  rowNoTrailingPipe: doc("| `src/a.ts` | `startup` | declare | no trailing pipe"),
  rowThreeColumns: doc("| `src/a.ts` | `startup` | declare |".replace(" declare |", " declare")),
  rowFiveColumns: doc("| `src/a.ts` | `startup` | declare | why | surplus |"),
  rowJustAPipe: doc("|"),

  // — remove, and the interplay with a derived binding —
  removeRow: doc("| `src/cron.ts` | `startup` | remove | this one is not startup |"),
  declareAndRemove: doc("| `src/cron.ts` | `startup` | remove | not startup after all |",
    "| `src/cron.ts` | `background-work` | declare | it is background work |"),
};

const PATHS = ["src/entry.serve.ts", "src/a.ts", "src/a`b.ts", "src/cron.ts", "src/pattern",
  "src/deep/nested.ts", "other.ts", "/etc/passwd"];
const DERIVED = [{
  path: "src/cron.ts", category: "startup",
  via: { source: "derived", adapter: "cloudflare-workers", file: "wrangler.jsonc", line: null, declaration: "triggers.crons" },
}];

/** A throwaway mission holding one corpus document. `null` writes no file at all. */
function mission(body) {
  const dir = mkdtempSync(join(tmpdir(), "rw-mapcorpus-"));
  if (body !== null) writeFileSync(join(dir, "territory.md"), body);
  return dir;
}

/** Stable, diffable, and derived from the parser rather than from an expectation. */
function transcript() {
  const out = [];
  const record = (name, body) => {
    const dir = typeof body === "function" ? body() : mission(body);
    try {
      const map = readTerritoryMap(dir);
      out.push(`${name}.structural => ${JSON.stringify(map.structural ?? null)}`);
      for (const r of map.rows ?? []) {
        out.push(`${name}.row => ${JSON.stringify([r.pattern, r.category, r.effect, r.why, r.line])}`);
      }
      for (const p of map.problems ?? []) {
        out.push(`${name}.problem => ${JSON.stringify([p.line ?? null, p.problem])}`);
      }
      const { bindings } = applyTerritoryMap(DERIVED, map, PATHS);
      for (const b of bindings) {
        out.push(`${name}.binding => ${JSON.stringify([b.path, b.category, b.via?.source, b.via?.pattern ?? null])}`);
      }
    } catch (e) {
      out.push(`${name} THREW ${e?.constructor?.name}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  for (const [name, body] of Object.entries(CORPUS)) record(name, body);
  record("fileAbsent", null);
  // A DIRECTORY where the file belongs: present on disk, impossible to read. The parser owes a
  // structural answer here, not an exception — measured, this is the only shape that produces one.
  record("fileUnreadable", () => {
    const dir = mkdtempSync(join(tmpdir(), "rw-mapcorpus-"));
    mkdirSync(join(dir, "territory.md"));
    return dir;
  });
  return out.join("\n") + "\n";
}

test("the territory-map corpus is byte-identical to the golden transcript", () => {
  const got = transcript();
  if (process.env.UPDATE_GOLDEN === "1") { writeFileSync(GOLDEN, got); return; }
  const want = readFileSync(GOLDEN, "utf8");
  if (got !== want) {
    const g = got.split("\n"), w = want.split("\n");
    const first = g.findIndex((l, i) => l !== w[i]);
    assert.fail("the territory map is read differently than the golden records.\n" +
      `  first difference at line ${first + 1}\n    golden: ${w[first]}\n    now:    ${g[first]}\n` +
      `  ${g.filter((l, i) => l !== w[i]).length} line(s) differ in total.\n` +
      "  If the new reading is the intended one, regenerate with " +
      "UPDATE_GOLDEN=1 node --test test/unit/territory-map-corpus.test.js and read the diff.");
  }
});

// ── the invariants, written out ──────────────────────────────────────────────────────────────────

const read = (body) => {
  const dir = mission(body);
  try { return readTerritoryMap(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};
const bind = (body) => {
  const dir = mission(body);
  try { return applyTerritoryMap(DERIVED, readTerritoryMap(dir), PATHS).bindings; }
  finally { rmSync(dir, { recursive: true, force: true }); }
};

test("only the ENCLOSING backticks are stripped, and what is inside is kept exactly", () => {
  // The three cells do not share a contract, and that is the whole point of separating them here.
  // `pattern` is free text — a path may legitimately carry a backtick — so an inner one must
  // SURVIVE into the stored pattern. `category` and `effect` are closed vocabularies, so a value
  // carrying an inner backtick falls outside them and must be REFUSED BY NAME. A parser that
  // strips every backtick rather than the enclosing pair gets all three wrong at once: it binds
  // the wrong path, and it turns two malformed cells into live declarations.
  const pat = read(CORPUS.patternInnerBacktick);
  assert.equal(pat.rows.length, 1, "a backtick inside a path is not a malformed row");
  assert.equal(pat.rows[0].pattern, "src/a`b.ts",
    "the inner backtick was eaten, so the row now binds a path the operator did not write");

  for (const [name, body, expected] of [
    ["categoryInnerBacktick", CORPUS.categoryInnerBacktick, /unknown category/],
    ["effectInnerBacktick", CORPUS.effectInnerBacktick, /effect must be/],
  ]) {
    const map = read(body);
    assert.equal((map.rows ?? []).length, 0,
      `${name}: a value outside its closed vocabulary became a live declaration — that is how a ` +
      "malformed row starts governing files, and nothing downstream would say so");
    assert.match((map.problems ?? []).map((p) => p.problem).join(" "), expected,
      `${name}: refused and did not say why — a row runward will not honour must be named, or the ` +
      "operator never learns it is inert");
  }
});

test("a correctly written row is honoured whatever whitespace the editor left in it", () => {
  for (const [name, body] of Object.entries({
    patternPadded: CORPUS.patternPadded,
    categoryPadded: CORPUS.categoryPadded,
    effectPadded: CORPUS.effectPadded,
  })) {
    const map = read(body);
    assert.equal(map.rows.length, 1, `${name}: padding turned a correct declaration into a refusal`);
    assert.equal(map.rows[0].category, "startup", name);
    assert.equal(map.rows[0].effect, "declare", name);
    assert.deepEqual(map.problems ?? [], [],
      `${name}: a correct declaration reported as the operator's mistake is the undue-refusal half, ` +
      "and it costs the same trust as the other one");
  }
});

test("every Markdown alignment dialect is a separator, not a declaration", () => {
  for (const name of ["separatorLeftAligned", "separatorRightAligned", "separatorCentred",
    "separatorMixed", "separatorLong"]) {
    const map = read(CORPUS[name]);
    assert.equal(map.rows.length, 1, `${name}: the data row was lost`);
    assert.deepEqual(map.problems ?? [], [],
      `${name}: the separator line was read as data and published as a refusal about a line the ` +
      "operator never declared — the left-aligned dialect is pinned elsewhere, and it is not the " +
      "only one Markdown allows");
  }
});

test("the section is opened by a heading and closed by a heading, not by prose", () => {
  assert.equal(read(CORPUS.headingInProse).rows.length, 0,
    "a line that merely CONTAINS `## Territory` is prose; letting it open the section means text " +
    "nobody meant as a declaration starts governing files");
  assert.equal(read(CORPUS.headingSuffixed).rows.length, 0, "`## TerritoryX` is a different heading");
  assert.equal(read(CORPUS.hashInsideAWhy).rows.length, 2,
    "a why containing `# 12` must not close the section — the map would be truncated by the " +
    "operator's own sentence, silently");
  assert.equal(read(CORPUS.endedByHeadingThree).rows.length, 1,
    "a following section of any level ends the territory table; eating it makes a foreign table bind files");
});

test("a map that cannot be read says so, and a map that is absent is not the same thing", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-mapcorpus-"));
  mkdirSync(join(dir, "territory.md"));
  try {
    const map = readTerritoryMap(dir);
    assert.ok(map.structural,
      "a present-but-unreadable map must raise a TRUTHY structural signal: an empty string is " +
      "falsy, and the `map.structural ? … : []` guards downstream then drop the carrier — the " +
      "fail-loud signal switched off exactly when the file could not be read");
    assert.match(String(map.structural), /unreadable/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.equal(readTerritoryMap(mkdtempSync(join(tmpdir(), "rw-mapcorpus-"))).structural ?? null, null,
    "no file at all is the ordinary case for a mission that declares nothing, and it must not " +
    "look like a broken one");
});

test("a `remove` row undoes a derived binding, and a `declare` row replaces it", () => {
  const removed = bind(CORPUS.removeRow).filter((b) => b.path === "src/cron.ts");
  assert.deepEqual(removed, [], "the remove row did not reach the derived binding it names");
  const both = bind(CORPUS.declareAndRemove).filter((b) => b.path === "src/cron.ts");
  assert.deepEqual(both.map((b) => b.category), ["background-work"],
    "remove-then-declare on one path must leave exactly the declared category");
});
