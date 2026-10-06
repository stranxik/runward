// Direct tests of the charter grammar in src/lib/delegation.ts (ADR-0088 decision 5), written from the
// survivors the 0.43.0 ratchet filed as "not yet instructed" (ADR-0046 decision 4). Each assertion is
// a behaviour of the exported API that a surviving mutant changed and no test observed: which lines the
// frontmatter reads and which it skips, how a value is unquoted and a list recognised, the bounds of a
// whole number, which paths escape the tree, the window's dates, the shape of the parsed charter, an
// unreadable charter, and the identities the charter merges over the lock.
//
// What is NOT pinned here, on purpose: the prose of a problem. A mutant that only rewrites a problem's
// sentence (or picks another malformation sentence for the same malformed line) leaves the number and
// the kind of problems unchanged; ADR-0046 decision 1 says no test pins prose.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCharter, readCharter, isDelegate, missionIdentities } from "../../dist/lib/delegation.js";

/** The frontmatter lines of a well-formed stage-1 charter; `over` replaces or removes (`null`) one key. */
function fields(over = {}) {
  const f = {
    charter: "runward-delegation/1",
    stage: "1",
    accountable: "github:ada",
    aliases: "[Ada]",
    delegates: "[claude, codex]",
    "class-R": "maintainer", "class-H": "maintainer", "class-I": "refused", "class-D": "delegated",
    "budget-consecutive-refusals": "3", "budget-refusals-per-period": "20",
    "sample-size": "5", "sample-seeds": "1", "sample-period-days": "7",
    effective: "2026-10-02", expires: "2026-12-31",
    "pre-merge-paths": "[runward/delegation.md]",
    ...over,
  };
  return Object.entries(f).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`);
}
/** A charter from frontmatter lines, with prose after it. */
const doc = (lines) => ["---", ...lines, "---", "", "# Delegation charter", ""].join("\n");
const parse = (lines) => parseCharter(doc(lines));
/** The well-formed charter with `extra` lines appended to its frontmatter. */
const withLines = (...extra) => parse([...fields(), ...extra]);

test("the reference charter of this file parses with no problem", () => {
  assert.deepEqual(parse(fields()).problems, []);
});

test("the scope lists of every class are fields the gate reads, and scopes holds only the classes declared", () => {
  const c = withLines("scope-R: [rotate the signing key]", "scope-H: [answer a reviewer]", "scope-I: [publish a release]", "scope-D: [docs]");
  assert.deepEqual(c.problems, []);
  assert.deepEqual(c.scopes, { R: ["rotate the signing key"], H: ["answer a reviewer"], I: ["publish a release"], D: ["docs"] });
  // No scope declared: no key at all, not a key holding nothing.
  assert.deepEqual(Object.keys(parse(fields()).scopes), []);
  assert.deepEqual(Object.keys(withLines("scope-D: [docs]").scopes), ["D"]);
});

test("a value is unquoted only when one quote of the same kind opens and closes it", () => {
  const c = withLines(
    "scope-D:",
    '  - "double"',
    "  - 'single'",
    '  - "opens only',
    '  - closes only"',
    "  - 'opens only",
    "  - closes only'",
    '  - "',
    "  - '",
    '  - ""',
    "  - ''",
  );
  assert.deepEqual(c.problems, []);
  assert.deepEqual(c.scopes.D, ["double", "single", '"opens only', 'closes only"', "'opens only", "closes only'", '"', "'"],
    "an empty quoted item is dropped, a lone quote is kept as written");
  const inline = withLines('scope-H: [ "a", \'b\', "", c" ]');
  assert.deepEqual(inline.scopes.H, ["a", "b", 'c"']);
});

test("an inline list needs both brackets: a value with one of them is a malformed list, never a list", () => {
  for (const v of ["Ada]", "[Ada", "Ada"]) {
    const c = parse(fields({ aliases: v }));
    assert.equal(c.problems.length, 1, `${v} → ${JSON.stringify(c.problems)}`);
    assert.deepEqual(c.aliases, [], v);
  }
  assert.deepEqual(parse(fields({ aliases: "[Ada]" })).aliases, ["Ada"]);
});

test("the frontmatter opens on the first line only, closes on a later `---`, and a byte-order mark is stripped only at the start", () => {
  // A leading BOM and a first line with trailing blanks still open the frontmatter.
  assert.deepEqual(parseCharter(`\uFEFF${doc(fields())}`).problems, []);
  assert.deepEqual(parseCharter(doc(fields()).replace(/^---/, "---  ")).problems, []);
  // A BOM elsewhere is content, kept where it was written.
  assert.equal(parse(fields({ accountable: "github:\uFEFFada" })).accountable, "github:\uFEFFada");
  // Not on the first line: no frontmatter, even though a `---` pair follows.
  const late = parseCharter(`title\n${doc(fields())}`);
  assert.equal(late.problems.length, 1, JSON.stringify(late.problems));
  assert.equal(late.accountable, null);
  assert.equal(late.stage, null);
  // Never closed: no frontmatter.
  const open = parseCharter(["---", ...fields(), ""].join("\n"));
  assert.equal(open.problems.length, 1, JSON.stringify(open.problems));
  assert.equal(open.stage, null);
  // Closed at once: a frontmatter with nothing in it, read as such (every field missing), not as none.
  const empty = parseCharter("---\n---\n");
  assert.ok(empty.problems.length > 1, JSON.stringify(empty.problems));
  assert.ok(empty.problems.every((p) => p.kind === "charter-malformed"));
});

test("whole numbers: digits only, at most six of them, at least 1", () => {
  const n = (v) => {
    const c = parse(fields({ "sample-size": v }));
    return [c.sample.size, c.problems.length];
  };
  assert.deepEqual(n("9"), [9, 0]);
  assert.deepEqual(n("19"), [19, 0]);
  assert.deepEqual(n("100000"), [100000, 0], "six digits");
  assert.deepEqual(n("999999"), [999999, 0]);
  assert.deepEqual(n("1000000"), [null, 1], "seven digits");
  for (const v of ["1.5", "+5", "1e3", "5x", "-1", "0", "a"]) assert.deepEqual(n(v), [null, 1], v);
});

test("pre-merge paths: an absolute path, a drive-letter path or a `..` escapes the tree; a trailing slash does not", () => {
  const problems = (paths) => parse(fields({ "pre-merge-paths": `[runward/delegation.md, ${paths}]` })).problems.length;
  assert.equal(problems("docs/"), 0);
  assert.equal(problems("src/lib/x.ts"), 0);
  assert.equal(problems("a"), 0, "a one-character path is a file name");
  for (const p of ["/etc/passwd", "/etc", "C:/Windows", "C:", "c:x", "../outside", "a/../../b"]) assert.equal(problems(p), 1, p);
});

test("blank lines, comments and indented comments inside the frontmatter are skipped, and do not close a block list", () => {
  const c = withLines(
    "",
    "   ",
    "# a comment",
    "   # an indented comment",
    "scope-D:",
    "  - first",
    "",
    "  # between items",
    "   ",
    "  - second",
  );
  assert.deepEqual(c.problems, []);
  assert.deepEqual(c.scopes.D, ["first", "second"]);
  // A comment is a line that STARTS with `#`; a value line ending with one is still read.
  assert.equal(parse(fields({ stage: "1 #" })).problems.length, 1, "stage: \"1 #\" is not 1 or 2");
});

test("a block item is an indented `- ` line, by spaces or by a tab; anything else closes the list", () => {
  const tab = withLines("scope-D:", "\t- tabbed", "  - spaced");
  assert.deepEqual(tab.problems, []);
  assert.deepEqual(tab.scopes.D, ["tabbed", "spaced"]);
  // Not indented: not an item, and a malformed line of its own.
  const flush = withLines("scope-D:", "  - first", "- flush");
  assert.equal(flush.problems.length, 1, JSON.stringify(flush.problems));
  assert.deepEqual(flush.scopes.D, ["first"]);
  // Indented without the space after the dash: not an item either.
  const nospace = withLines("scope-D:", "  - first", "  -second");
  assert.equal(nospace.problems.length, 1, JSON.stringify(nospace.problems));
  assert.deepEqual(nospace.scopes.D, ["first"]);
  // An empty item is dropped.
  const blank = withLines("scope-D:", "  - first", '  - ""', "  - ");
  assert.deepEqual(blank.problems, []);
  assert.deepEqual(blank.scopes.D, ["first"]);
});

test("a key is what stands before the colon, trimmed; a line with no colon declares no field", () => {
  // Blanks around the key are not part of it.
  const spaced = parse([...fields({ stage: null }), "stage : 1"]);
  assert.deepEqual(spaced.problems, []);
  assert.equal(spaced.stage, 1);
  // A line with no colon is malformed and sets nothing, even when it starts with a field's name.
  const c = parse([...fields({ accountable: null }), "accountableX"]);
  assert.equal(c.accountable, null);
  assert.equal(c.problems.length, 2, JSON.stringify(c.problems));
  // Blanks after a list key's colon still open a block list.
  const trailing = parse([...fields({ delegates: null }), "delegates:   ", "  - claude"]);
  assert.deepEqual(trailing.problems, []);
  assert.deepEqual(trailing.delegates, ["claude"]);
});

test("a template placeholder is named in a list as in a scalar, and only a value carrying both `<` and `>` is one", () => {
  assert.equal(parse(fields({ delegates: "[claude, <agent>]" })).problems.length, 1);
  assert.equal(withLines("scope-D:", "  - <an act>").problems.length, 1);
  for (const item of ["budget > 3", "a < b", "-> docs", "<-"]) {
    const c = withLines("scope-D:", `  - ${item}`);
    assert.deepEqual(c.problems, [], item);
    assert.deepEqual(c.scopes.D, [item]);
  }
  assert.deepEqual(parse(fields({ accountable: "github:a>b" })).problems, []);
  assert.deepEqual(parse(fields({ accountable: "github:a<b" })).problems, []);
});

test("absent lists parse as empty lists, and only the missing one is named", () => {
  const c = parse(fields({ aliases: null }));
  assert.deepEqual(c.aliases, []);
  assert.deepEqual(c.problems, []);
  const p = parse(fields({ "pre-merge-paths": null }));
  assert.deepEqual(p.preMerge, { paths: [], events: [] });
  assert.equal(p.problems.length, 1, JSON.stringify(p.problems));
});

test("the window: each missing or invalid date is one problem, never two, and a charter cannot expire the day it takes effect", () => {
  const count = (over) => parse(fields(over)).problems.length;
  assert.equal(count({ expires: null }), 1, "expires missing");
  assert.equal(count({ expires: "2026-13-01" }), 1, "expires not a date");
  assert.equal(count({ effective: null }), 1, "effective missing");
  assert.equal(count({ effective: "soon" }), 1, "effective not a date");
  assert.equal(count({ effective: null, expires: null }), 2);
  assert.equal(count({ expires: "2026-10-02" }), 1, "expires on the day it takes effect");
  assert.equal(count({ expires: "2026-10-03" }), 0, "one day later");
});

test("a charter that exists and cannot be read is a malformed charter, never an exception", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-charter-dir-"));
  try {
    mkdirSync(join(dir, "delegation.md"));
    const c = readCharter(dir);
    assert.ok(c !== null);
    assert.equal(c.problems.length, 1, JSON.stringify(c.problems));
    assert.equal(c.stage, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an agent whose name folds to nothing is never a delegate, even when the charter lists such a name", () => {
  const c = parse(fields({ delegates: "[claude, ---]" }));
  assert.ok(isDelegate(c, "claude"));
  for (const a of ["!", "", "  ", "---"]) assert.equal(isDelegate(c, a), false, JSON.stringify(a));
});

test("the charter's identities over the lock's: its own aliases that name something, and nothing invented", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-charter-ids-"));
  try {
    // No lock entry for the charter's id: its aliases are the charter's, the empty ones dropped.
    const c = parse(fields({ aliases: "[Ada, ---, ada lovelace]" }));
    assert.deepEqual(missionIdentities(dir, c), { "github:ada": ["Ada", "ada lovelace"] });
    assert.deepEqual(missionIdentities(dir, parse(fields({ aliases: null }))), { "github:ada": [] });
    // With the lock: its other ids kept, the charter's names taken off them, the union for the charter's id.
    writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify({ identities: { "github:ada": ["lovelace"], "github:bob": ["Bob", "Ada"] } }));
    assert.deepEqual(missionIdentities(dir, c), { "github:bob": ["Bob"], "github:ada": ["Ada", "ada lovelace", "lovelace"] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
