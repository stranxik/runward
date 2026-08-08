// The two contracts `applyTerritoryMap` makes about the SHAPE of what it returns, as opposed to
// which rows won — which `territory-map.test.js` already pins.
//
// Neither contract can redden `check --strict`: the gate never imports this module (verified: no
// occurrence of "territory" in `dist/commands/check.js`). What they decide is the evidence surface
// of `rules --for` and of `status`, and specifically the `git check-ignore -v` half of it: which
// declaration, in which file, at which line, bound this path to this category. A report that drops
// one of two declarations, or that renders them in an order nobody stated, is a report an operator
// cannot diff — and a report nobody can diff is the weak verifier ADR-0040 refuses, arriving by the
// back door of output shape rather than of logic.
//
// The mutation pass of 2026-08-05 left 19 survivors in this one function, all of them here: the
// early return of the empty-map arm, and every term of the two-key comparator. Every guard below is
// exercised in BOTH directions, because an ordering assertion that only ever sees an already-sorted
// fixture passes just as well against a comparator that does nothing at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTerritoryMap, applyTerritoryMap } from "../../dist/lib/territory-map.js";

function mapDir(body) {
  const dir = mkdtempSync(join(tmpdir(), "rw-map-order-"));
  writeFileSync(join(dir, "territory.md"), body);
  return dir;
}
const TABLE = (...rows) => `## Territory\n\n| Pattern | Category | Effect | Why |\n|---|---|---|---|\n${rows.join("\n")}\n`;
const row = (pattern, category) => `| \`${pattern}\` | \`${category}\` | declare | a reason long enough to inform a reviewer |`;
const seen = (bindings) => bindings.map((b) => `${b.path} ${b.category}`);

// ── The empty-map arm ───────────────────────────────────────────────────────────────────────────
// `if (!map.rows.length) return { bindings: [...derived], usedRows }` is a PASS-THROUGH, and the
// dangerous direction is that it stops being one. Falling through into the general path instead
// rebuilds derivation through a `Map` keyed by `path + category`, which silently collapses two
// declarations that bound the same file to the same category — the exact shape a single
// `wrangler.toml` produces when it declares both `[triggers] crons` and `[[queues.consumers]]`
// against one entry module. The count stays plausible, the report loses a reason, and nothing says
// so. That is why derivation's own sort carries a `tie(via)` discriminator: duplicates are expected
// here, not hypothetical.

const twoDeclarations = () => [
  {
    path: "src/index.ts", category: "background-work",
    via: { source: "derived", adapter: "cloudflare-workers", file: "wrangler.toml", line: 8, declaration: "queues.consumers[]" },
  },
  {
    path: "src/index.ts", category: "background-work",
    via: { source: "derived", adapter: "cloudflare-workers", file: "wrangler.toml", line: 5, declaration: "triggers.crons" },
  },
  {
    path: "src/index.ts", category: "scheduled-work",
    via: { source: "derived", adapter: "cloudflare-workers", file: "wrangler.toml", line: 5, declaration: "triggers.crons" },
  },
];

test("a map with no usable row hands derivation back untouched — every declaration, in the order given", () => {
  const dir = mapDir("## Territory\n\n_no table yet._\n");
  try {
    const map = readTerritoryMap(dir);
    assert.equal(map.rows.length, 0, "fixture must bite: this map must carry no row at all");

    const derived = twoDeclarations();
    const { bindings, usedRows } = applyTerritoryMap(derived, map, ["src/index.ts"]);

    // Two declarations bound the same file to the same category. Both survive: the reason surface
    // is the whole point, and a deduplicated one answers a shorter truth than derivation found.
    assert.equal(bindings.length, 3, "no binding may be collapsed when the map decides nothing");
    assert.deepEqual(
      bindings.map((b) => b.via.declaration),
      ["queues.consumers[]", "triggers.crons", "triggers.crons"],
      "derivation's own order and provenance survive verbatim",
    );
    assert.equal(usedRows.size, 0, "no row ran, so no row may be reported as used");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the other direction: a map WITH a row does override derivation, so the pass-through is not the only behaviour", () => {
  // Guards against the mirror defect — an arm that returns derivation unchanged whatever the map
  // says would satisfy the case above and govern nothing.
  const dir = mapDir(TABLE(row("src/index.ts", "background-work")));
  try {
    const map = readTerritoryMap(dir);
    assert.equal(map.rows.length, 1, "fixture must bite: exactly one row must have been read");

    const { bindings, usedRows } = applyTerritoryMap(twoDeclarations(), map, ["src/index.ts"]);
    const bg = bindings.filter((b) => b.category === "background-work");
    assert.equal(bg.length, 1, "the map's row wins, per (path, category)");
    assert.equal(bg[0].via.source, "map", "and it wins with the map's own provenance, not derivation's");
    assert.deepEqual([...usedRows], [5], "the row that matched is reported at its line");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── The stated order ────────────────────────────────────────────────────────────────────────────
// The comparator states one order and only one: path ascending, then category ascending. It is what
// makes two runs of `rules --for --json` diffable, so every term of it is load-bearing. The fixture
// declares its rows in neither of the two orders that could pass by accident — not sorted, not
// reversed — and the assertions name the two dangerous directions explicitly.

const SCRAMBLED = TABLE(
  row("src/boot.ts", "startup"),
  row("src/boot.ts", "configuration"),
  row("src/boot.ts", "secret-boundary"),
  row("src/queue.ts", "background-work"),
  row("src/queue.ts", "scheduled-work"),
  row("src/adapter.ts", "port-adapter"),
);
const EXPECTED = [
  "src/adapter.ts port-adapter",
  "src/boot.ts configuration",
  "src/boot.ts secret-boundary",
  "src/boot.ts startup",
  "src/queue.ts background-work",
  "src/queue.ts scheduled-work",
];

test("bindings come back ordered by path then category, whatever order the map declared them in", () => {
  const dir = mapDir(SCRAMBLED);
  try {
    const map = readTerritoryMap(dir);
    assert.equal(map.rows.length, 6, "fixture must bite: all six rows must have been read");

    // Paths are passed in yet another order, so nothing downstream can be credited to the caller.
    const { bindings } = applyTerritoryMap([], map, ["src/queue.ts", "src/boot.ts", "src/adapter.ts"]);
    const order = seen(bindings);

    assert.equal(order.length, 6, "six rows, six bindings — the ordering case must not double as a count case");
    assert.deepEqual(order, EXPECTED, "path ascending, then category ascending — the whole contract, in one line");

    // The two ways an ordering assertion passes without an ordering: the comparator did nothing, or
    // it did the opposite. Named, because `deepEqual` alone would not say which failure occurred.
    assert.notDeepEqual(order, [
      "src/boot.ts startup", "src/boot.ts configuration", "src/boot.ts secret-boundary",
      "src/queue.ts background-work", "src/queue.ts scheduled-work", "src/adapter.ts port-adapter",
    ], "declaration order must not survive: a comparator that never orders is not an order");
    assert.notDeepEqual(order, [...EXPECTED].reverse(), "and it must not be the reverse of the stated one");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the path key decides first, and the category key only breaks ties within one path", () => {
  // Isolates the two keys so a single fixture cannot pass on the strength of the other. Same paths
  // throughout would leave every path comparison untested; same category throughout would leave the
  // tie-break untested. Each case here removes one of the two variables.
  const byPath = mapDir(TABLE(
    row("src/c.ts", "startup"),
    row("src/a.ts", "startup"),
    row("src/b.ts", "startup"),
  ));
  try {
    const map = readTerritoryMap(byPath);
    assert.equal(map.rows.length, 3, "fixture must bite: three single-category rows");
    const { bindings } = applyTerritoryMap([], map, ["src/c.ts", "src/a.ts", "src/b.ts"]);
    assert.deepEqual(seen(bindings), ["src/a.ts startup", "src/b.ts startup", "src/c.ts startup"],
      "one category everywhere: only the path key can have produced this");
  } finally { rmSync(byPath, { recursive: true, force: true }); }

  const byCategory = mapDir(TABLE(
    row("src/one.ts", "startup"),
    row("src/one.ts", "model-provider"),
    row("src/one.ts", "configuration"),
  ));
  try {
    const map = readTerritoryMap(byCategory);
    assert.equal(map.rows.length, 3, "fixture must bite: three rows on one single path");
    const { bindings } = applyTerritoryMap([], map, ["src/one.ts"]);
    assert.deepEqual(seen(bindings), ["src/one.ts configuration", "src/one.ts model-provider", "src/one.ts startup"],
      "one path everywhere: only the category tie-break can have produced this");
  } finally { rmSync(byCategory, { recursive: true, force: true }); }
});
