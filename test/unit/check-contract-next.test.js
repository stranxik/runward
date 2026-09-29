// nextStep and rerunCommand, asserted directly (the 0.42.3 mutation re-measure).
//
// The Next line and the payload's `next` (RWD-2026-0145) were only reached through `check` run in a
// child process, where the mutants of a Stryker pass are not active: 57 mutants of nextStep survived
// the unit suite while every branch of it was exercised by a spawned CLI. What is pinned here is
// what a consumer acts on: `action` (a stable id to branch on), `command` and `rerun` (what to type),
// which commands the line names, and whether it sends the reader to `status` (RWD-2026-0130: only
// where `status` can see the gap). The prose around the commands is not pinned (ADR-0046).
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStep, nextPayload, rerunCommand } from "../../dist/lib/check-contract.js";

const breakdown = (over = {}) => ({ conformance: 0, corpus: 0, seal: 0, unratified: 0, proposed: 0, unboundRows: 0, ...over });
const v = (over = {}) => ({ gaps: 0, strictGaps: 0, hookFailed: 0, ...over, breakdown: breakdown(over.breakdown) });
/** The commands the line tells its reader to type, in order: the segments the terminal colours as commands. */
const commands = (n) => n.segments.filter((s) => s.tone === "command").map((s) => s.text);
/** What the payload publishes, which is what an agent reads. */
const said = (n) => nextPayload(n).text;

test("a green run assembles the evidence pack and re-runs nothing", () => {
  const n = nextStep(v(), { strict: true });
  assert.equal(n.action, "assemble-evidence-pack");
  assert.equal(n.command, "runward compliance <regime>");
  assert.equal(n.rerun, null);
  assert.deepEqual(commands(n), ["runward compliance <regime>", "runward status"],
    "the pack command first, the handover snapshot second");
  assert.ok(said(n).includes("iso-42001"), "the regimes the placeholder stands for are named");
});

test("a deliverable gap alone is NOT green: it names the deliverables and the gate to re-run", () => {
  // Deliverable gaps with no strict gap and no failed hook: the case a `gaps === 0` short-circuit
  // would have read as a green run and answered "assemble the evidence pack".
  const n = nextStep(v({ gaps: 2 }), { strict: true });
  assert.equal(n.action, "fill-deliverables");
  assert.equal(n.command, "runward check --strict");
  assert.equal(n.rerun, "runward check --strict");
  assert.deepEqual(commands(n), ["runward check --strict", "runward status"],
    "status names deliverable gaps, so it is offered here");
});

test("a strict gap alone is not green either, and a failed hook alone is not", () => {
  assert.notEqual(nextStep(v({ strictGaps: 1, breakdown: { conformance: 1 } }), { strict: true }).action, "assemble-evidence-pack");
  assert.notEqual(nextStep(v({ hookFailed: 1 }), { hooks: true }).action, "assemble-evidence-pack");
});

test("deliverable gaps with conformance gaps: both gestures, one action", () => {
  const n = nextStep(v({ gaps: 1, strictGaps: 1, breakdown: { conformance: 1 } }), { strict: true });
  assert.equal(n.action, "fill-deliverables-and-close-conformance-gaps");
  assert.equal(n.command, "runward check --strict");
  assert.deepEqual(commands(n), ["runward check --strict"],
    "status cannot see a conformance gap, so it is not offered (RWD-2026-0130)");
});

test("a drifted seal is re-sealed, never re-run", () => {
  const n = nextStep(v({ strictGaps: 1, breakdown: { seal: 1 } }), { strict: true });
  assert.equal(n.action, "reseal-evidence");
  assert.equal(n.command, "runward check --freeze");
  assert.equal(n.rerun, "runward check --strict", "rerun still names the gate that said no");
  assert.deepEqual(commands(n), ["runward check --freeze"]);
});

test("a corpus divergence names both reconcile commands", () => {
  const n = nextStep(v({ strictGaps: 1, breakdown: { corpus: 1 } }), { strict: true });
  assert.equal(n.action, "reconcile-corpus");
  assert.equal(n.command, "runward update");
  assert.deepEqual(commands(n), ["runward update", "runward update --corpus <path>"],
    "one for a rule runward moved, one for a corpus the organisation vendors");
});

test("an unratified decision, then a conformance gap, then an unbound row: the order is the gesture order", () => {
  assert.equal(nextStep(v({ strictGaps: 3, breakdown: { unratified: 1, conformance: 1, unboundRows: 1 } }), { strict: true }).action,
    "ratify-decisions");
  assert.equal(nextStep(v({ strictGaps: 2, breakdown: { conformance: 1, unboundRows: 1 } }), { strict: true }).action,
    "close-conformance-gaps", "conformance before ratification: ratifying a refused row binds it twice");
  const bound = nextStep(v({ strictGaps: 1, breakdown: { unboundRows: 1 } }), { strict: true });
  assert.equal(bound.action, "ratify-decided-rows");
  assert.equal(bound.command, "runward ratify --decided");
  assert.equal(bound.rerun, "runward check --strict");
  assert.deepEqual(commands(bound), ["runward ratify --decided", "runward check --strict"],
    "ratify the rows, then re-run the gate that refused them");
});

test("a failed hook names the hooks file and re-runs with --hooks", () => {
  const n = nextStep(v({ hookFailed: 1 }), { hooks: true });
  assert.equal(n.action, "fix-hooks");
  assert.equal(n.command, "runward check --hooks");
  assert.deepEqual(commands(n), ["runward check --hooks"], "status cannot see a failed hook");
  assert.ok(said(n).includes("runward/hooks.json"), "the file to fix is named");
});

test("a red run with no counted cause still says re-run, and names the command", () => {
  // strictGaps counted with no breakdown term set: the fallback branch.
  const n = nextStep(v({ strictGaps: 1 }), { strict: true });
  assert.equal(n.action, "rerun");
  assert.equal(n.command, "runward check --strict");
  assert.deepEqual(commands(n), ["runward check --strict"]);
});

test("the status pointer is offered exactly where status sees the gap (RWD-2026-0130)", () => {
  const offered = (x, opts = { strict: true }) => commands(nextStep(v(x), opts)).includes("runward status");
  assert.equal(offered({ gaps: 1 }), true, "deliverable gaps only: status names them");
  assert.equal(offered({ gaps: 1, strictGaps: 1, breakdown: { conformance: 1 } }), false, "a strict gap is invisible to status");
  assert.equal(offered({ gaps: 1, hookFailed: 1 }, { hooks: true }), false, "a failed hook is invisible to status");
  assert.equal(offered({ strictGaps: 1, breakdown: { seal: 1 } }), false, "no deliverable gap: nothing for status to name");
  assert.equal(offered({ hookFailed: 1 }, { hooks: true }), false);
});

test("rerunCommand echoes the mission path, so the re-run judges the same mission", () => {
  assert.equal(rerunCommand({ path: "missions/a", strict: true }), "runward check -p missions/a --strict");
  assert.equal(nextStep(v({ gaps: 1 }), { path: "missions/a" }).command, "runward check -p missions/a");
  assert.equal(rerunCommand({ strict: true }), "runward check --strict", "no path given, none invented");
});
