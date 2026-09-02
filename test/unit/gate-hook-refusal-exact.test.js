// refusalLines, pinned to the byte (consolidated pass: 36 mutants survived on gate-hook.js, most
// in the refusal builder nothing compared exactly). The refusal IS the product at the armed tier —
// what the model reads back — so its lines are a contract, not a rendering detail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { refusalLines, GATE_HOOK_HARNESSES, LOOP_CEILING, bypassEntry } from "../../dist/lib/gate-hook.js";

test("the harness list is exactly the six shipped shapes, in a stable order", () => {
  assert.deepEqual([...GATE_HOOK_HARNESSES], ["claude", "copilot", "kiro", "gemini", "junie", "cursor"]);
  assert.equal(LOOP_CEILING, 8, "the ceiling is the documented one — copilot's native ceiling, adopted everywhere");
});

const verdict = (over = {}) => ({
  gaps: 1,
  strictBreakdown: { conformance: 1, corpus: 0, seal: 0, unratified: 0, proposed: 0 },
  workflowContract: { gating: false, malformed: [], joinBreaks: [], unmetRequires: [] },
  deliverables: [
    { phase: "Frame", artifact: "Framing note", relPath: "framing.md", state: "untouched", cause: null },
    { phase: "Floor", artifact: "Floor note", relPath: "floor.md", state: "filled", cause: null },
  ],
  gated: [{ label: "Floor", skipped: false, violations: [{ rule: "r-1", problem: "typed pointer dead" }] }],
  corpus: { status: "verifiable", missing: [], edited: [], extra: [] },
  seal: { present: false, violations: [] },
  unratified: [],
  ...over,
});

test("the refusal names the summary, every unfilled deliverable, every violation — byte-exact", () => {
  assert.deepEqual(refusalLines(verdict()), [
    "runward gate: check --strict refuses this tree — 1 deliverable(s) not filled · 1 rule-conformance gap(s).",
    "✗ Frame · Framing note (runward/framing.md) — untouched",
    "✗ Floor · r-1 — typed pointer dead",
  ], "filled rows never appear; the summary arithmetic is check's own");
});

test("past the caps the refusal says how many more, with the exact arithmetic", () => {
  const many = verdict({
    deliverables: Array.from({ length: 12 }, (_, i) => ({ phase: "P", artifact: `A${i}`, relPath: `a${i}.md`, state: "missing", cause: null })),
    gated: [{ label: "Floor", skipped: false, violations: Array.from({ length: 16 }, (_, i) => ({ rule: `r-${i}`, problem: "x" })) }],
  });
  const lines = refusalLines(many);
  assert.equal(lines.length, 1 + 10 + 15 + 1, "10 deliverables + 15 rows shown, one summary, one more-line");
  assert.equal(lines.at(-1), "… and 3 more — `runward check --strict` names them all.",
    "12+16 total, 25 shown: the difference is 3, spelled out");
});

test("exactly at the caps there is no phantom more-line", () => {
  const exact = verdict({
    deliverables: Array.from({ length: 10 }, (_, i) => ({ phase: "P", artifact: `A${i}`, relPath: `a${i}.md`, state: "missing", cause: null })),
    gated: [{ label: "Floor", skipped: false, violations: Array.from({ length: 15 }, (_, i) => ({ rule: `r-${i}`, problem: "x" })) }],
  });
  const lines = refusalLines(exact);
  assert.equal(lines.length, 26);
  assert.doesNotMatch(lines.at(-1), /and 0 more/, "zero hidden is silence, not a count");
});

test("bypassEntry is one exact greppable line per cause", () => {
  assert.equal(bypassEntry("2026-09-02T22:00:00Z", "claude", "already-blocked"),
    "2026-09-02T22:00:00Z  gate red at end of turn, released after one block (claude, already-blocked)\n");
  assert.equal(bypassEntry("2026-09-02T22:00:00Z", "gemini", "loop-ceiling"),
    "2026-09-02T22:00:00Z  gate red at end of turn, released after one block (gemini, loop-ceiling)\n");
});
