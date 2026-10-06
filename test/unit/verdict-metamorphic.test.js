// The canonical mission snapshot and the eight metamorphic relations of ADR-0089 (increment 1).
//
// A metamorphic relation is "a necessary property of f over a sequence of two or more inputs" (Chen
// et al. 2018): it needs no oracle for any single verdict, only a statement of how two verdicts must
// relate when the mission changes in a known way. Five changes must leave the verdict as it was;
// three must turn a green mission red. Each is a property over missions generated from the shipped
// example (`test/support/mission-generator.js`) and judged by `computeVerdict` with `strict: true`.
//
// What a green run here shows, and what it does not (ADR-0089, "What each step shows"): on the
// generated missions, the verdict respects these eight necessary properties. It does not show that
// any single verdict is right; a relation is not an oracle.
//
// Deterministic in CI like the manifest fuzz: a fixed seed, a bounded run count. The run count is
// RUNWARD_MR_RUNS (default 3 generated missions per relation, about four seconds for the file on a
// laptop); raise it for a deeper local run, e.g. `RUNWARD_MR_RUNS=200 node --test
// test/unit/verdict-metamorphic.test.js`. Each verdict materialises its mission in a fresh temporary
// directory, so a generated case costs about 0.1 s.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import fc from "fast-check";
import { computeVerdict } from "../../dist/lib/verdict.js";
import { canonical, materialize, renderSnapshot, renderVerdict, snapshot, snapshotOfTree, toSnapshotPath } from "../support/mission-snapshot.js";
import { exampleTree, missionArb, RELATIONS } from "../support/mission-generator.js";

const SEED = 0xC0FFEE;
const RUNS = Math.max(1, Number.parseInt(process.env.RUNWARD_MR_RUNS ?? "", 10) || 3);
const PARAMS = { seed: SEED, numRuns: RUNS, endOnFailure: true };

/** Materialise a tree in a fresh directory, judge it, and remove it. */
function judge(tree) {
  const dir = mkdtempSync(join(tmpdir(), "rw-mr-"));
  try {
    materialize(tree, dir);
    return computeVerdict(join(dir, "runward"), { strict: true });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// The same seed draws the same missions for every relation, so each mission is judged once and its
// verdict reused. Keyed by the raw bytes, not the snapshot: MR-4 changes bytes the snapshot folds.
const judged = new Map();
function judgeBase(tree) {
  const h = createHash("sha256");
  for (const [p, b] of tree) h.update(p).update("\0").update(createHash("sha256").update(b).digest()).update("\0");
  const key = h.digest("hex");
  if (!judged.has(key)) judged.set(key, judge(tree));
  return judged.get(key);
}

/** The first top-level field where two canonical verdicts differ, for a legible failure. */
function firstDifference(a, b) {
  const ca = canonical(a), cb = canonical(b);
  return Object.keys({ ...ca, ...cb }).find((k) => JSON.stringify(ca[k]) !== JSON.stringify(cb[k])) ?? "(none)";
}

/** A mission and a target for one relation, drawn together. */
const caseFor = (rel) => missionArb().chain((tree) => {
  const params = rel.params(tree);
  const describe = (p) => () => `${String(tree[fc.toStringMethod]?.() ?? "mission")} with ${JSON.stringify(p, (k, v) => (k === "row" ? `${v.file}#${v.rule}` : v))}`;
  return params === null ? fc.constant({ tree, p: null }) : params.map((p) => ({ tree, p, [fc.toStringMethod]: describe(p) }));
});

// ---------------------------------------------------------------------------------------------
// The snapshot.

test("snapshot: materialising a generated mission and reading it back gives the same snapshot", () => {
  fc.assert(fc.property(missionArb(), (tree) => {
    const dir = mkdtempSync(join(tmpdir(), "rw-snap-"));
    try {
      materialize(tree, dir);
      const read = snapshot(dir);
      assert.equal(renderSnapshot(read), renderSnapshot(snapshotOfTree(tree, read.markersAbove)), "the round trip changed the snapshot");
      // And again through the snapshot's own files: materialize(snapshot) is a fixed point.
      const again = mkdtempSync(join(tmpdir(), "rw-snap-"));
      try { materialize(read, again); assert.equal(renderSnapshot(snapshot(again)), renderSnapshot(read)); }
      finally { rmSync(again, { recursive: true, force: true }); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }), { seed: SEED, numRuns: RUNS, endOnFailure: true });
});

test("snapshot: a path is spelled with forward slashes whatever the platform's separator", () => {
  const rel = win32.relative("C:\\work\\mission", "C:\\work\\mission\\runward\\governance\\threat-model.md");
  assert.equal(rel, "runward\\governance\\threat-model.md", "the control: a Windows relative path carries backslashes");
  assert.equal(toSnapshotPath(rel, win32.sep), "runward/governance/threat-model.md");
  assert.equal(toSnapshotPath("runward/governance/threat-model.md", "/"), "runward/governance/threat-model.md");
  for (const p of exampleTree().keys()) assert.ok(!p.includes("\\") && !p.startsWith("/"), `a snapshot path is POSIX and relative: ${p}`);
});

test("snapshot: an LF and a CRLF checkout of one mission have one snapshot and get one verdict", () => {
  const lf = exampleTree();
  const crlf = new Map([...lf].map(([p, b]) => [p, b.includes(0) ? b : Buffer.from(b.toString("utf8").replace(/\n/g, "\r\n"), "utf8")]));
  const changed = [...lf.keys()].filter((p) => !lf.get(p).equals(crlf.get(p)));
  assert.ok(changed.length > 100, `the control: the CRLF tree differs in bytes (${changed.length} files)`);
  assert.equal(renderSnapshot(snapshotOfTree(crlf)), renderSnapshot(snapshotOfTree(lf)), "line endings are not content");
  assert.equal(renderVerdict(judge(crlf)), renderVerdict(judge(lf)), "two trees with one snapshot got two verdicts");
  // Sensitivity in the other direction: one changed byte of content is a different snapshot.
  const edited = new Map(lf).set("runward/floor.md", Buffer.from(lf.get("runward/floor.md").toString("utf8").replace("applied", "Applied"), "utf8"));
  assert.notEqual(renderSnapshot(snapshotOfTree(edited)), renderSnapshot(snapshotOfTree(lf)), "a content change must change the snapshot");
});

test("snapshot: the canonical rendering of a verdict ignores list and key order, never content", () => {
  const v = judge(exampleTree());
  const shuffle = (x) => Array.isArray(x) ? x.map(shuffle).reverse()
    : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).reverse().map((k) => [k, shuffle(x[k])])) : x;
  assert.notEqual(JSON.stringify(shuffle(v)), JSON.stringify(v), "the control: the reordered verdict differs as plain JSON");
  assert.equal(renderVerdict(shuffle(v)), renderVerdict(v));
  assert.notEqual(renderVerdict({ ...v, strictGaps: v.strictGaps + 1 }), renderVerdict(v), "a changed count must change the rendering");
});

// ---------------------------------------------------------------------------------------------
// The eight relations.

/** Check one relation over RUNS generated missions. */
function holds(id) {
  const rel = RELATIONS.find((r) => r.id === id);
  let ran = 0;
  fc.assert(fc.property(caseFor(rel), ({ tree, p }) => {
    fc.pre(p !== null);
    const after = rel.apply(tree, p);
    fc.pre(after !== null);
    const before = judgeBase(tree);
    if (rel.expect !== "same" && rel.expect !== "same-but-one-row") fc.pre(before.exitCode === 0);
    ran++;
    const v = judge(after);
    if (rel.expect === "same") {
      assert.equal(renderVerdict(v), renderVerdict(before), `the verdict changed (first difference: ${firstDifference(v, before)})`);
    } else if (rel.expect === "same-but-one-row") {
      // The added row is disclosed, and must be: the evidence breakdown and the ratification ledger
      // count it. Everything else, exit code and violations first, is unchanged.
      assert.equal(v.breakdown.rows, before.breakdown.rows + 1, "the breakdown counts the added row");
      assert.equal(v.breakdown.na, before.breakdown.na + 1, "the breakdown counts it as n/a");
      assert.equal(v.ratification.untraced, before.ratification.untraced + 1, "the ledger counts it as a decided row");
      const folded = { ...v, breakdown: { ...v.breakdown, rows: before.breakdown.rows, na: before.breakdown.na },
        ratification: { ...v.ratification, untraced: before.ratification.untraced } };
      assert.equal(renderVerdict(folded), renderVerdict(before), `the verdict changed beyond the disclosed count (first difference: ${firstDifference(folded, before)})`);
    } else {
      assert.equal(v.exitCode, 1, `a green mission stayed green after: ${rel.name}`);
      assert.equal(v.clean, false);
      const violations = v.gated.flatMap((g) => g.violations.map((x) => ({ ...x, label: g.label })));
      const target = rel.rule ? rel.rule(p) : null;
      assert.ok(violations.some((x) => x.kind === rel.expect && (!target || (x.rule === target.rule && x.label === target.label))),
        `no ${rel.expect} violation${target ? ` for ${target.rule} in ${target.label}` : ""}: ${JSON.stringify(violations.map((x) => [x.label, x.rule, x.kind]))}`);
    }
  }), { ...PARAMS, maxSkipsPerRun: 1 });
  // Positive control on the generator: a relation that discarded every case would pass vacuously.
  assert.equal(ran, RUNS, `${id} judged ${ran} generated missions out of ${RUNS}`);
}

// The names are written out, not built from RELATIONS, because the requirements register cites each
// one by its exact text (test/unit/tor-traceability.test.js reads this file for it).
test("MR-1: renaming a file no row cites leaves the verdict unchanged", () => holds("MR-1"));
test("MR-2: reversing the order of a manifest's rule rows leaves the verdict unchanged", () => holds("MR-2"));
test("MR-3: re-padding the cells of every rule row leaves the verdict unchanged", () => holds("MR-3"));
test("MR-4: converting files to CRLF leaves the verdict unchanged", () => holds("MR-4"));
test("MR-5: adding an n/a row for a rule the phase does not expect leaves the verdict unchanged", () => holds("MR-5"));
test("MR-6: deleting a file an applied row cites turns a green verdict red", () => holds("MR-6"));
test("MR-7: duplicating a rule row turns a green verdict red", () => holds("MR-7"));
test("MR-8: emptying the evidence of an applied row turns a green verdict red", () => holds("MR-8"));

test("the eight relations are the eight of ADR-0089, each checked above", () => {
  assert.deepEqual(RELATIONS.map((r) => r.id), ["MR-1", "MR-2", "MR-3", "MR-4", "MR-5", "MR-6", "MR-7", "MR-8"]);
  assert.deepEqual(RELATIONS.map((r) => r.expect), ["same", "same", "same", "same", "same-but-one-row", "unresolved-pointer", "duplicate-row", "applied-without-evidence"]);
});

test("generator: the generated missions differ from one another and from the example", () => {
  const trees = fc.sample(missionArb(), { seed: SEED, numRuns: Math.max(RUNS, 4) });
  const snaps = new Set(trees.map((t) => renderSnapshot(snapshotOfTree(t))));
  assert.ok(snaps.size > 1, "every generated mission is the same mission");
  const example = renderSnapshot(snapshotOfTree(exampleTree()));
  assert.ok([...snaps].some((s) => s !== example), "the generator only returns the example");
});
