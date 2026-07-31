// Unit tests for the mission territory map (ADR-0043 tier 3).
//
// The map exists because a deployment manifest declares an execution topology, never the nature
// of the code behind it. A field report proved the gap concretely: their entry module carries a
// secret derivation that no manifest could ever describe, so the CRITICAL rule governing secret
// boundaries never surfaced. These tests weigh most on the two things that decide whether such a
// map is trustworthy: that a refused row is NAMED rather than dropped, and that the map can never
// narrow what the maintainer decided.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTerritoryMap, applyTerritoryMap, structurallyInertRows } from "../../dist/lib/territory-map.js";

function mission(body) {
  const dir = mkdtempSync(join(tmpdir(), "rw-map-"));
  if (body !== null) writeFileSync(join(dir, "territory.md"), body);
  return dir;
}
const TABLE = (...rows) => `## Territory\n\n| Pattern | Category | Effect | Why |\n|---|---|---|---|\n${rows.join("\n")}\n`;
const derived = (path, category) => ({
  path, category,
  via: { source: "derived", adapter: "cloudflare-workers", file: "wrangler.jsonc", line: null, declaration: "triggers.crons" },
});

test("ADR-0043: a declared row binds a path, and the reason carries the file AND the line", () => {
  const dir = mission(TABLE("| `src/entry.*.ts` | `secret-boundary` | declare | derives a token from an env secret |"));
  try {
    const map = readTerritoryMap(dir);
    assert.equal(map.rows.length, 1);
    const { bindings } = applyTerritoryMap([], map, ["src/entry.serve.ts"]);
    assert.equal(bindings.length, 1);
    assert.equal(bindings[0].category, "secret-boundary");
    assert.equal(bindings[0].via.source, "map");
    // Heading(1) blank(2) header(3) separator(4) → the first data row is line 5.
    assert.equal(bindings[0].via.line, 5, "the row's line number — the <source>:<linenum> JSON.parse could not have given");
    assert.equal(bindings[0].via.pattern, "src/entry.*.ts");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: the map corrects derivation in BOTH directions, last matching row winning", () => {
  // A mission must be able to say "runward guessed wrong here" — the browser bundle a framework
  // generates is matched by a broad row and carries no background work at all.
  const dir = mission(TABLE(
    "| `src/entry.*.ts` | `background-work` | declare | every entry module is a Worker surface |",
    "| `src/entry.browser.ts` | `background-work` | remove | the framework's browser bundle runs nothing in the background |",
  ));
  try {
    const map = readTerritoryMap(dir);
    const { bindings } = applyTerritoryMap([], map, ["src/entry.serve.ts", "src/entry.browser.ts"]);
    assert.deepEqual(bindings.map((b) => b.path), ["src/entry.serve.ts"], "the later row removed the earlier one's effect");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: a `remove` row can undo a DERIVED binding — what runward guessed, not what the maintainer decided", () => {
  const dir = mission(TABLE("| `src/entry.serve.ts` | `background-work` | remove | the cron moved out; this file only delegates now |"));
  try {
    const { bindings } = applyTerritoryMap([derived("src/entry.serve.ts", "background-work")], readTerritoryMap(dir), ["src/entry.serve.ts"]);
    assert.deepEqual(bindings, [], "a derivation is a guess the mission may correct");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: every refused row is NAMED with its line — never silently dropped", () => {
  // parseManifest skips a malformed row in silence; that is the one house habit not copied here.
  // A row the operator believes is working, that runward ignored, is the worst possible state.
  const dir = mission(TABLE(
    "| `src/a.ts` | `not-a-category` | declare | an invented category |",
    "| `src/b.ts` | `startup` | declare | x |",
    "| `src/c.ts` | `startup` | maybe | an effect that is neither declare nor remove |",
    "| `/etc/passwd` | `startup` | declare | a path escaping the project |",
    "| `src/d.ts` | `startup` |",
  ));
  try {
    const map = readTerritoryMap(dir);
    assert.equal(map.rows.length, 0, "none of these rows is usable");
    assert.equal(map.problems.length, 5, "and each one is reported");
    for (const p of map.problems) assert.ok(p.line > 0 && p.text, "with its line and its text");
    assert.match(map.problems[0].problem, /unknown category/);
    assert.match(map.problems[1].problem, /placeholder|empty/, "a `why` you must write is a row you notice when it goes stale");
    assert.match(map.problems[2].problem, /declare.*remove/);
    assert.match(map.problems[3].problem, /project-relative/);
    assert.match(map.problems[4].problem, /4 columns/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: absent, empty and structurally broken are three different answers", () => {
  const absent = mission(null);
  const noSection = mission("# Territory map\n\nnothing here.\n");
  const noTable = mission("## Territory\n\nprose only.\n");
  try {
    const a = readTerritoryMap(absent);
    assert.equal(a.present, false, "absent is not an error — derivation answers alone");
    assert.equal(a.structural, null);
    // Matched on meaning, not wording: "# Territory map" is not a Territory heading (the word is
    // followed by more), so the map is refused — and the refusal names the fix.
    assert.match(readTerritoryMap(noSection).structural, /Territory.*heading/);
    assert.match(readTerritoryMap(noSection).structural, /any heading level/, "and it says the level is not the problem");
    assert.match(readTerritoryMap(noTable).structural, /no table/);
  } finally { for (const d of [absent, noSection, noTable]) rmSync(d, { recursive: true, force: true }); }
});

test("ADR-0043: structurally inert rows are found without walking the tree", () => {
  // The half of the inertness question --for can answer honestly. The other half — "matched no
  // file" — needs the tree and lives in characterize (the ADR amendment).
  const dir = mission(TABLE(
    "| `src/a.ts` | `startup` | declare | a category some rule governs |",
    "| `src/b.ts` | `configuration` | remove | removes something nothing ever derives |",
    "| `src/c.ts` | `port-adapter` | declare | no rule governs this one in the fixture |",
  ));
  try {
    const map = readTerritoryMap(dir);
    const inert = structurallyInertRows(map, new Set(["startup", "configuration"]), new Set(["startup"]));
    const reasons = inert.map((r) => r.reason).join(" ");
    assert.equal(inert.length, 2);
    assert.match(reasons, /no rule governs `port-adapter`/, "a row whose category no rule governs can never surface one");
    assert.match(reasons, /nothing derives `configuration`/, "a remove that removes nothing is the FSE species");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: an empty map changes nothing, and the derivation passes through untouched", () => {
  const dir = mission(TABLE());
  try {
    const d = [derived("src/w.ts", "background-work")];
    const { bindings, usedRows } = applyTerritoryMap(d, readTerritoryMap(dir), ["src/w.ts"]);
    assert.deepEqual(bindings, d);
    assert.equal(usedRows.size, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: a `Territory` heading at any level is accepted — a near-miss must not silently void the map", () => {
  // A field report titled their map `# Territory` and it was ignored. The diagnostic existed and
  // was correct, but the map they believed was active did nothing — the exact state this whole
  // mechanism exists to avoid, produced by counting `#`. Liberal in what we accept.
  for (const h of ["# Territory", "## Territory", "### Territory"]) {
    const dir = mission(`${h}\n\n| Pattern | Category | Effect | Why |\n|---|---|---|---|\n| \`src/a.ts\` | \`startup\` | declare | the process entry point, logged at boot |\n`);
    try {
      const map = readTerritoryMap(dir);
      assert.equal(map.structural, null, `${h} must be read`);
      assert.equal(map.rows.length, 1, `${h} must yield its row`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test("ADR-0043: a heading of any level ends the section, so a following section is never eaten", () => {
  const dir = mission("## Territory\n\n| Pattern | Category | Effect | Why |\n|---|---|---|---|\n| `src/a.ts` | `startup` | declare | the process entry point |\n\n# Notes\n\n| Pattern | Category | Effect | Why |\n|---|---|---|---|\n| `src/b.ts` | `startup` | declare | this table is NOT territory |\n");
  try {
    assert.equal(readTerritoryMap(dir).rows.length, 1, "only the Territory section's rows count");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
