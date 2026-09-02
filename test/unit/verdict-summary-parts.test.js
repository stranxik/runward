// verdictSummaryParts — the one naming arithmetic (H1 factored it out of check.ts so the render
// and gate-hook's refusal can never diverge; the consolidated pass measured 31 mutants surviving
// on it). Pinned exactly: each counter alone produces its EXACT sentence, zero produces silence,
// and the order is the render's order. deepEqual, not matches — an emptied literal or a flipped
// guard has nowhere to hide in a compared array.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verdictSummaryParts } from "../../dist/lib/verdict.js";

const base = () => ({
  gaps: 0,
  strictBreakdown: { conformance: 0, corpus: 0, seal: 0, unratified: 0, proposed: 0 },
  workflowContract: { gating: false, malformed: [], joinBreaks: [], unmetRequires: [] },
});

test("zero everywhere is silence — no invented part", () => {
  assert.deepEqual(verdictSummaryParts(base()), []);
});

test("each counter alone yields its exact sentence", () => {
  for (const [mutate, expected] of [
    [(v) => { v.gaps = 3; }, "3 deliverable(s) not filled"],
    [(v) => { v.strictBreakdown.conformance = 2; }, "2 rule-conformance gap(s)"],
    [(v) => { v.strictBreakdown.proposed = 4; }, "4 proposed row(s) awaiting ratification"],
    [(v) => { v.strictBreakdown.corpus = 1; }, "1 rule-corpus divergence(s)"],
    [(v) => { v.strictBreakdown.seal = 5; }, "5 sealed evidence file(s) changed"],
    [(v) => { v.strictBreakdown.unratified = 6; }, "6 unratified decision(s)"],
  ]) {
    const v = base(); mutate(v);
    assert.deepEqual(verdictSummaryParts(v), [expected]);
  }
});

test("workflow-contract breaks are named only when they gate, and the arithmetic is a sum", () => {
  const v = base();
  v.workflowContract = { gating: false, malformed: ["a"], joinBreaks: ["b"], unmetRequires: ["c"] };
  assert.deepEqual(verdictSummaryParts(v), [], "disclosed elsewhere; the summary counts only what gates");
  v.workflowContract.gating = true;
  assert.deepEqual(verdictSummaryParts(v), ["3 workflow-contract break(s)"], "1+1+1: a minus in the sum cannot hide");
});

test("everything at once keeps the render's order", () => {
  const v = base();
  v.gaps = 1;
  v.strictBreakdown = { conformance: 1, corpus: 1, seal: 1, unratified: 1, proposed: 1 };
  v.workflowContract = { gating: true, malformed: ["x"], joinBreaks: [], unmetRequires: [] };
  assert.deepEqual(verdictSummaryParts(v), [
    "1 deliverable(s) not filled",
    "1 rule-conformance gap(s)",
    "1 proposed row(s) awaiting ratification",
    "1 rule-corpus divergence(s)",
    "1 sealed evidence file(s) changed",
    "1 unratified decision(s)",
    "1 workflow-contract break(s)",
  ]);
});
