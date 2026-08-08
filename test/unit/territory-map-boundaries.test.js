// The territory map's boundaries: the exact points where "read" turns into "refused".
//
// `readTerritoryMap` and `structurallyInertRows` never reach an exit code — `runward check
// --strict` does not import this module at all (measured: every mutant below leaves a green
// mission green). What they DO decide is the proof surface two commands publish about a mission's
// own declarations: `rules --for --json` emits `map.present`, `map.structural`, `map.problems` and
// `map.inert` as a versioned machine contract (ADR-0024), and `status` renders territory coverage
// off the same values. A map that is read but reported as absent, a separator row reported as a
// malformed declaration, or a live `declare` row reported as inert are all the same defect: the
// tool tells the operator something about their file that is not true, and there is no second
// mechanism behind it. So these cases pin the frontier itself — the value on each side of it —
// because a parser that refuses everything satisfies a one-sided fixture just as well as a
// correct one. Every guard below is exercised in BOTH directions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTerritoryMap, structurallyInertRows } from "../../dist/lib/territory-map.js";

/** One throwaway mission dir carrying `territory.md`; `null` writes no file at all. */
function mission(body) {
  const dir = mkdtempSync(join(tmpdir(), "rw-mapb-"));
  if (body !== null) writeFileSync(join(dir, "territory.md"), body);
  return dir;
}
const drop = (...dirs) => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); };
/** Heading(1) blank(2) header(3) separator(4) → the first data row is always line 5. */
const TABLE = (...rows) => `## Territory\n\n| Pattern | Category | Effect | Why |\n|---|---|---|---|\n${rows.join("\n")}\n`;
const row = (pattern, category, effect, why) => `| \`${pattern}\` | \`${category}\` | ${effect} | ${why} |`;

test("ADR-0043: `present` is a fact about the FILE, never about whether it could be used", () => {
  // Dangerous direction: a false `present: false`. `status` renders that as "no
  // runward/territory.md — categories come from derivation only", so the operator is told the file
  // they are looking at does not exist WHILE its rows are being applied underneath. The two halves
  // of the same JSON object then contradict each other (present: false, rows: 2) and the reader
  // has no way to know which half lies. Presence and usability are two separate answers, and
  // `structural` is the one that carries usability.
  const absent = mission(null);
  const unusable = mission("## Territory\n\nprose only, no table at all.\n");
  const usable = mission(TABLE(row("src/entry.ts", "startup", "declare", "the process entry point, logged at boot")));
  try {
    assert.equal(readTerritoryMap(absent).present, false, "no file is the honest false — derivation answers alone");

    const broken = readTerritoryMap(unusable);
    assert.equal(broken.present, true, "a file that exists is present even when nothing in it can be used");
    assert.notEqual(broken.structural, null, "and usability is reported separately, never folded into `present`");

    const ok = readTerritoryMap(usable);
    assert.equal(ok.present, true, "a readable map is present");
    assert.equal(ok.rows.length, 1, "and `present: true` must accompany the rows that are in force");
  } finally { drop(absent, unusable, usable); }
});

test("ADR-0043: a table with only a separator row, or only a header row, is still a table", () => {
  // `structural` is the loudest thing this module can say: `rules --for` prints "This map was not
  // read … Everything below is derivation only". Claiming it about a map that IS being read is the
  // weak-verifier failure inverted — the operator is pushed to rewrite a file that is correct.
  // A map scaffolded down to its header, with its first row not yet written, is exactly that case.
  // The two skeletons are separated on purpose: each reaches the `sawTable` assignment through a
  // DIFFERENT branch (the separator branch, then the header branch), and a fixture carrying both
  // proves neither.
  const sepOnly = mission("## Territory\n\n|---|---|---|---|\n");
  const hdrOnly = mission("## Territory\n\n| Pattern | Category | Effect | Why |\n");
  const noTable = mission("## Territory\n\nprose only, no pipe anywhere.\n");
  try {
    const sep = readTerritoryMap(sepOnly);
    assert.equal(sep.structural, null, "a separator row IS the table, declared empty");
    assert.equal(sep.rows.length, 0, "and an empty table yields no row — that part is not an error either");

    const hdr = readTerritoryMap(hdrOnly);
    assert.equal(hdr.structural, null, "a header row IS the table, declared empty");
    assert.equal(hdr.rows.length, 0);

    // The other direction: a section that really carries no table must still be named as such,
    // otherwise the diagnostic this test protects would just have been deleted.
    assert.match(readTerritoryMap(noTable).structural, /no table/, "prose alone is genuinely not a table");
  } finally { drop(sepOnly, hdrOnly, noTable); }
});

test("ADR-0043: a column-alignment separator is a separator, not a malformed declaration", () => {
  // GitHub-flavoured Markdown writes `|:---|:---:|---:|` for alignment, and every editor that
  // formats a table emits it. Dangerous direction: the row falls through to the data path and is
  // published in `map.problems` as `unknown category :---:` — a refusal report about a line the
  // operator never declared. A reader who trusts the problem list then hunts a row that does not
  // exist, and a reader who learns to ignore the problem list stops seeing the real refusals.
  const aligned = mission(`## Territory\n\n| Pattern | Category | Effect | Why |\n|:---|:---:|---:|---|\n${row("src/entry.ts", "startup", "declare", "the process entry point, logged at boot")}\n`);
  const plain = mission(TABLE(row("src/entry.ts", "startup", "declare", "the process entry point, logged at boot")));
  try {
    const m = readTerritoryMap(aligned);
    assert.deepEqual(m.problems, [], "an alignment separator is table syntax, and syntax is never a refused declaration");
    assert.equal(m.rows.length, 1, "and the real row behind it is still read");
    assert.equal(m.rows[0].line, 5, "at its own line — the <source>:<linenum> the whole format exists to keep");
    assert.equal(m.structural, null);

    // Both directions of the same guard: the undecorated separator must keep working, and a real
    // declaration must never be swallowed as if it were one.
    const p = readTerritoryMap(plain);
    assert.deepEqual(p.problems, []);
    assert.equal(p.rows.length, 1, "a data row is not a separator, whichever separator dialect precedes it");
  } finally { drop(aligned, plain); }
});

test("ADR-0043: the `why` floor is eight characters — the row on the boundary is accepted", () => {
  // The floor decides whether a declaration becomes a BINDING or a refusal, so moving it by one
  // character silently voids the shortest legitimate reasons a mission ever writes. Dangerous
  // direction: refusing a row the operator wrote correctly, which drops the category it declared
  // and therefore the rules that govern it — a narrower answer from `rules --for`, reported as the
  // operator's mistake. Pin both sides of the frontier, not just the refusal.
  const onFloor = mission(TABLE(row("src/a.ts", "startup", "declare", "boots it")));   // exactly 8
  const belowFloor = mission(TABLE(row("src/b.ts", "startup", "declare", "boot it")));  // exactly 7
  const placeholder = mission(TABLE(row("src/c.ts", "startup", "declare", "[why goes here]")));
  try {
    const at = readTerritoryMap(onFloor);
    assert.equal(at.rows.length, 1, "eight characters clears the floor — `< 8` refuses, it does not refuse eight");
    assert.deepEqual(at.problems, []);
    assert.equal(at.rows[0].why, "boots it");

    const below = readTerritoryMap(belowFloor);
    assert.equal(below.rows.length, 0, "seven does not clear it");
    assert.match(below.problems[0].problem, /placeholder|empty/);

    // The second half of the same predicate: length is not the only way to say nothing.
    const ph = readTerritoryMap(placeholder);
    assert.equal(ph.rows.length, 0, "a bracketed template is a placeholder however long it is");
    assert.match(ph.problems[0].problem, /placeholder|empty/);
  } finally { drop(onFloor, belowFloor, placeholder); }
});

test("ADR-0043: an empty pattern is diagnosed as empty, not as a path that escapes the project", () => {
  // Both refusals drop the row, so the decision is identical — what differs is what the operator
  // is sent to fix. "not project-relative: ``" about a cell that is blank sends them to check
  // their path syntax for a path they never wrote. A diagnostic that names the wrong defect is
  // the same class of harm as no diagnostic, at the cost of one branch.
  const blank = mission(TABLE("|  | `startup` | declare | a reason long enough to clear the floor |"));
  const escaping = mission(TABLE(row("/etc/passwd", "startup", "declare", "a path escaping the project entirely")));
  try {
    const b = readTerritoryMap(blank);
    assert.equal(b.rows.length, 0, "an empty pattern is refused");
    assert.equal(b.problems.length, 1);
    assert.match(b.problems[0].problem, /empty pattern/, "and named for what it is");

    // The other direction: the path check it must not be confused with is still doing its job.
    const e = readTerritoryMap(escaping);
    assert.equal(e.rows.length, 0);
    assert.match(e.problems[0].problem, /project-relative/, "a real path defect keeps its own diagnostic");
  } finally { drop(blank, escaping); }
});

test("ADR-0043: `removes nothing` is reserved for a `remove` row whose category nothing derives", () => {
  // Inertness is an accusation: `status` prints these rows under "matched no walked file … Dead or
  // merely early is your call". Dangerous direction: accusing a LIVE row. A `declare` row that is
  // the only thing binding a file to its category — the whole reason tier 3 exists, since no
  // manifest can describe the nature of the code — reported as removing nothing, is an invitation
  // to delete the row that carries the mission's coverage. The four combinations of
  // effect × derived are all present, so the conjunction cannot be satisfied by half of itself.
  const dir = mission(TABLE(
    row("src/r1.ts", "configuration", "remove", "removes a category nothing ever derives here"),
    row("src/r2.ts", "startup", "remove", "corrects a derivation runward actually made"),
    row("src/d1.ts", "configuration", "declare", "declares what no manifest could ever describe"),
    row("src/d2.ts", "startup", "declare", "declares alongside what derivation already found"),
  ));
  try {
    const map = readTerritoryMap(dir);
    assert.equal(map.rows.length, 4, "the fixture must bite: all four rows are usable");
    const inert = structurallyInertRows(map, new Set(["startup", "configuration"]), new Set(["startup"]));
    assert.deepEqual(inert.map((r) => r.pattern), ["src/r1.ts"], "only remove-AND-not-derived is inert");
    assert.match(inert[0].reason, /nothing derives `configuration`/);
    // Named individually, so a failure says which half of the conjunction gave way.
    const flagged = new Set(inert.map((r) => r.pattern));
    assert.equal(flagged.has("src/r2.ts"), false, "a `remove` against a category derivation DID produce is live");
    assert.equal(flagged.has("src/d1.ts"), false, "a `declare` removes nothing by construction — it cannot be inert for that reason");
    assert.equal(flagged.has("src/d2.ts"), false, "and a `declare` beside a derivation is live too");
  } finally { drop(dir); }
});

test("ADR-0043: the same (pattern, category) declared twice names the earlier row dead", () => {
  // The precedence rule is "the last matching row wins, per (path, category)" — which means an
  // earlier duplicate is unreachable. Dangerous direction: staying silent about it. The operator
  // edits the row they find first, sees no change in `rules --for`, and concludes the map does not
  // work. Silence about a shadowed row is exactly the failure the whole "name every refused row"
  // regime was built against, arriving one layer later.
  const dupe = mission(TABLE(
    row("src/a.ts", "startup", "declare", "the first declaration, later shadowed"),
    row("src/a.ts", "startup", "declare", "the second declaration, which wins"),
  ));
  const distinct = mission(TABLE(
    row("src/a.ts", "startup", "declare", "same pattern, but a different category"),
    row("src/a.ts", "configuration", "declare", "so neither row shadows the other"),
  ));
  try {
    const inert = structurallyInertRows(readTerritoryMap(dupe), new Set(["startup", "configuration"]), new Set(["startup", "configuration"]));
    assert.equal(inert.length, 1, "a shadowed duplicate is reported, never left silent");
    assert.match(inert[0].reason, /overridden by the row at line 6/, "naming the row that wins");
    assert.match(inert[0].reason, /line 5 is dead/, "and the row that is dead");

    // The other direction: the key is the PAIR, so the same pattern under two categories is two
    // live rows. A duplicate detector that fires on the pattern alone would kill legitimate maps.
    const ok = structurallyInertRows(readTerritoryMap(distinct), new Set(["startup", "configuration"]), new Set(["startup", "configuration"]));
    assert.deepEqual(ok, [], "two categories on one pattern shadow nothing");
  } finally { drop(dupe, distinct); }
});
