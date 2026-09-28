// refusalLines' grouping, asserted directly (the 0.42.3 mutation re-measure).
//
// RWD-2026-0158 made the armed refusal say each instruction once and group three rows or more that
// share a diagnosis. It was pinned through `gate-hook` run in a child process, where the mutants of a
// Stryker pass are not active, and 22 mutants of the grouping survived the unit suite. The refusal is
// what the model reads back at the end of a turn, so what it groups, what it elides and where it
// points are the product at the armed tier — the stance of gate-hook-refusal-exact.test.js, which
// this file extends to the grouped shapes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { refusalLines } from "../../dist/lib/gate-hook.js";

const verdict = (gated, over = {}) => ({
  gaps: 0,
  strictBreakdown: { conformance: 1, corpus: 0, seal: 0, unratified: 0, proposed: 0, unboundRows: 0 },
  workflowContract: { gating: false, malformed: [], joinBreaks: [], unmetRequires: [] },
  deliverables: [],
  gated,
  corpus: { status: "package", missing: [], edited: [], extra: [] },
  seal: { present: false, violations: [] },
  unratified: [],
  regulated: { on: false, unbound: [] },
  ...over,
});
const scope = (label, ...violations) => ({ label, skipped: false, violations: violations.map(([rule, problem]) => ({ rule, problem })) });
const body = (lines) => lines.slice(1);
const fixLines = (lines) => lines.filter((l) => l.startsWith("  Fix for the "));

test("three rows with one diagnosis are one line naming every rule, the instruction said once", () => {
  const lines = refusalLines(verdict([
    scope("Architect", ["a-1", "not accounted for — run sync"], ["a-2", "not accounted for — run sync"]),
    scope("Floor", ["f-1", "not accounted for — run sync"], ["f-2", "dead pointer — update it"]),
  ]));
  assert.deepEqual(body(lines), [
    "✗ 3 row(s): not accounted for",
    "    Architect: a-1, a-2",
    "    Floor: f-1",
    "✗ Floor · f-2 — dead pointer — update it",
    "  Fix for the 3 row(s) above that share it: run sync",
  ], "the group counts only its own members; the unrelated row keeps its whole sentence");
});

test("the threshold is three: two rows with one diagnosis stay two lines", () => {
  const two = refusalLines(verdict([scope("Floor", ["f-1", "not accounted for — run sync"], ["f-2", "not accounted for — run sync"])]));
  assert.deepEqual(body(two), [
    "✗ Floor · f-1 — not accounted for",
    "✗ Floor · f-2 — not accounted for",
    "  Fix for the 2 row(s) above that share it: run sync",
  ]);
  const three = refusalLines(verdict([scope("Floor", ["f-1", "x — s"], ["f-2", "x — s"], ["f-3", "x — s"])]));
  assert.equal(three[1], "✗ 3 row(s): x", "exactly three rows are grouped");
});

test("an instruction shared by rows with DIFFERENT diagnoses is still said once, after them", () => {
  const lines = refusalLines(verdict([scope("Floor", ["f-1", "dead pointer — update it"], ["f-2", "other thing — update it"])]));
  assert.deepEqual(body(lines), [
    "✗ Floor · f-1 — dead pointer",
    "✗ Floor · f-2 — other thing",
    "  Fix for the 2 row(s) above that share it: update it",
  ]);
});

test("an instruction nobody else shares stays on its row, and no Fix line is invented", () => {
  const lines = refusalLines(verdict([scope("Floor", ["f-1", "dead pointer — update it"], ["f-2", "other thing — remove it"])]));
  assert.deepEqual(body(lines), [
    "✗ Floor · f-1 — dead pointer — update it",
    "✗ Floor · f-2 — other thing — remove it",
  ]);
  assert.deepEqual(fixLines(lines), []);
});

test("a problem with no instruction is shown whole and never counted as one", () => {
  const lines = refusalLines(verdict([scope("Floor", ["f-1", "a bare diagnosis"], ["f-2", "a bare diagnosis"])]));
  assert.deepEqual(body(lines), ["✗ Floor · f-1 — a bare diagnosis", "✗ Floor · f-2 — a bare diagnosis"]);
});

test("a group of rows that carry no instruction invents none", () => {
  // Corpus rows are bare diagnoses: three missing rules group, and nothing is said after them.
  const lines = refusalLines(verdict([], { corpus: { status: "verifiable", missing: ["a.md", "b.md", "c.md"], edited: [], extra: [] } }));
  assert.deepEqual(body(lines), ["✗ 3 row(s): rule removed from the mission corpus", "    corpus: a.md, b.md, c.md"]);
  assert.deepEqual(fixLines(lines), []);
});

test("a placeholder rule id is not shown as a rule: the scope says what it is", () => {
  const lines = refusalLines(verdict([], {
    seal: { present: true, violations: [{ rule: "(seal)", problem: "sealed evidence changed: x.ts — re-seal it" }] },
  }));
  assert.deepEqual(body(lines), ["✗ evidence-seal — sealed evidence changed: x.ts — re-seal it"]);
});

test("with a locator, the group names each deliverable's file and each located row's line", () => {
  const locate = (file, rule) => ({ "runward/architecture.md#a-1": 7, "runward/floor.md#f-2": 9 })[`${file}#${rule}`] ?? null;
  const lines = refusalLines(verdict([
    scope("Architect", ["a-1", "not accounted for — run sync"], ["a-2", "not accounted for — run sync"]),
    scope("Floor", ["f-1", "not accounted for — run sync"], ["f-2", "dead pointer — update it"], ["f-3", "other thing"]),
  ]), locate);
  assert.deepEqual(body(lines), [
    "✗ 3 row(s): not accounted for",
    "    Architect (runward/architecture.md): a-1:7, a-2",
    "    Floor (runward/floor.md): f-1",
    "✗ Floor · f-2 (runward/floor.md:9) — dead pointer — update it",
    "✗ Floor · f-3 (runward/floor.md) — other thing",
    "  Fix for the 3 row(s) above that share it: run sync",
  ], "a row the locator cannot find keeps its file and gets no line — nothing is guessed");
});
