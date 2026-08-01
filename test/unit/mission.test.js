// Unit tests for the mission-reading boundary (ADR-0033) — the Reopening watch parse.
// Born from the 2026-07-20 brownfield-lot audit: readReopeningTriggers shipped with zero tests,
// and an accepted ADR without a trigger section inflated the "N decision(s) carry a reopening
// trigger" count on the exact transmission surface ADR-0033 exists to make truthful.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { analyze, readReopeningTriggers, findMissionRoot } from "../../dist/lib/mission.js";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function adrDirWith(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-adr-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const accepted = (trigger) => [
  "# ADR — something", "", "**Status**: accepted", "**Date**: 2026-01-01", "",
  ...(trigger === null ? [] : ["## Reevaluation trigger", "", ...trigger, ""]),
  "## References", "", "- none", "",
].join("\n");

test("an accepted ADR with a dated trigger is parsed: setOn + first-line preview", () => {
  const dir = adrDirWith({
    "ADR-0001-a.md": accepted(["Reopen if p95 latency exceeds 400ms on real traffic.", "", "**Trigger set on**: 2026-01-02"]),
  });
  try {
    const w = readReopeningTriggers(dir);
    assert.equal(w.triggers.length, 1);
    assert.equal(w.triggers[0].setOn, "2026-01-02");
    assert.equal(w.triggers[0].preview, "Reopen if p95 latency exceeds 400ms on real traffic.");
    assert.deepEqual(w.missingSection, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an accepted ADR with NO trigger section goes to missingSection — never counted as a trigger", () => {
  const dir = adrDirWith({
    "ADR-0001-a.md": accepted(["Reopen on signal X.", "", "**Trigger set on**: 2026-01-02"]),
    "ADR-0002-b.md": accepted(null), // accepted, no section — the count-inflation bug
  });
  try {
    const w = readReopeningTriggers(dir);
    assert.equal(w.triggers.length, 1, "only the trigger-carrying ADR counts");
    assert.deepEqual(w.missingSection, ["ADR-0002-b.md"], "the non-conforming ADR is NAMED, not silently counted");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("non-accepted ADRs (proposed / superseded) are not a live backlog", () => {
  const dir = adrDirWith({
    "ADR-0001-a.md": "# x\n\n**Status**: proposed\n\n## Reevaluation trigger\n\nReopen if Y.\n",
    "ADR-0002-b.md": "# x\n\n**Status**: superseded by ADR-0003\n\n## Reevaluation trigger\n\nReopen if Z.\n",
  });
  try {
    const w = readReopeningTriggers(dir);
    assert.equal(w.triggers.length, 0);
    assert.deepEqual(w.missingSection, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a multi-line trigger previews its first line WITH a truncation marker — never silent", () => {
  const dir = adrDirWith({
    "ADR-0001-a.md": accepted(["- signal A: p95 above 400ms", "- signal B: error rate above 1%", "- signal C: a second operator joins", "", "**Trigger set on**: 2026-01-02"]),
  });
  try {
    const w = readReopeningTriggers(dir);
    assert.equal(w.triggers.length, 1);
    assert.ok(w.triggers[0].preview.startsWith("- signal A"));
    assert.ok(w.triggers[0].preview.endsWith("…"), "the dropped lines are marked, not silently truncated");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a very long single-line trigger is bounded with an ellipsis", () => {
  const long = "Reopen when " + "the signal ".repeat(30) + "fires.";
  const dir = adrDirWith({ "ADR-0001-a.md": accepted([long, "", "**Trigger set on**: 2026-01-02"]) });
  try {
    const w = readReopeningTriggers(dir);
    assert.ok(w.triggers[0].preview.length <= 141);
    assert.ok(w.triggers[0].preview.endsWith("…"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a missing adr/ dir yields an empty watch, not a crash", () => {
  const w = readReopeningTriggers(join(tmpdir(), "rw-adr-does-not-exist"));
  assert.deepEqual(w, { triggers: [], missingSection: [] });
});

test("triggers come back sorted by filename — byte-stable regardless of on-disk order", () => {
  // Written out of order (3, 1, 2); readdir order is platform-dependent, the parse must not be.
  const dir = adrDirWith({
    "ADR-0003-c.md": accepted(["Reopen on signal C.", "", "**Trigger set on**: 2026-03-03"]),
    "ADR-0001-a.md": accepted(["Reopen on signal A.", "", "**Trigger set on**: 2026-01-01"]),
    "ADR-0002-b.md": accepted(["Reopen on signal B.", "", "**Trigger set on**: 2026-02-02"]),
  });
  try {
    const w = readReopeningTriggers(dir);
    assert.deepEqual(
      w.triggers.map((t) => t.adr),
      ["ADR-0001-a.md", "ADR-0002-b.md", "ADR-0003-c.md"],
      "the reopening watch is deterministic: sorted by filename, never by readdir order",
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the **Trigger set on** metadata line is never taken as the preview prose", () => {
  // The dated line appears BEFORE the prose in the section body: setOn must still be read,
  // and the preview must be the trigger prose, not the metadata line.
  const dir = adrDirWith({
    "ADR-0001-a.md": accepted(["**Trigger set on**: 2026-01-02", "", "Reopen when the vendor ships native support."]),
  });
  try {
    const w = readReopeningTriggers(dir);
    assert.equal(w.triggers[0].setOn, "2026-01-02");
    assert.equal(w.triggers[0].preview, "Reopen when the vendor ships native support.");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── analyze(): the steady-state flag (ADR-0033, "ÉTAT") ──
// steadyState is asserted in smoke against the real (filled) reference mission; the negative case
// — the flag is false, and currentPhase is NOT the "all gates passed" sentinel, while any gated
// deliverable is still incomplete — belongs in a unit test so the contract holds without the fixture.
test("analyze names the steady-state explicitly: false while any gated phase is incomplete", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-mission-"));
  try {
    const r = analyze(dir); // empty mission dir: every deliverable missing → not steady-state
    assert.equal(r.steadyState, false);
    assert.notEqual(r.currentPhase, "all gates passed", "an incomplete mission never reads as all-passed");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("findMissionRoot climbs to the mission root from a nested directory", () => {
  // Found by mutation: flipping `parent === dir` to `!==` in the climb loop — which stops the walk
  // on its first iteration — survived the whole suite. Nothing pinned the single behaviour that
  // makes `runward check` usable from anywhere inside a repo, which is how it is actually run.
  const root = mkdtempSync(join(tmpdir(), "rw-climb-"));
  try {
    mkdirSync(join(root, "runward"), { recursive: true });
    writeFileSync(join(root, "runward", "framing.md"), "# A mission\n");
    const deep = join(root, "src", "lib", "deeper");
    mkdirSync(deep, { recursive: true });
    assert.equal(findMissionRoot(deep), root, "from three levels down");
    assert.equal(findMissionRoot(join(root, "src")), root, "from one level down");
    assert.equal(findMissionRoot(root), root, "and from the root itself");
    // And it must STOP: a directory with no mission above it resolves to null rather than
    // climbing to the filesystem root and adopting someone else's mission.
    const orphan = mkdtempSync(join(tmpdir(), "rw-orphan-"));
    try { assert.equal(findMissionRoot(orphan), null, "no mission above it"); }
    finally { rmSync(orphan, { recursive: true, force: true }); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("every shipped mission template ends with a newline (the invariant `filled` detection rests on)", () => {
  // The third survivor of the mutation bench, `l.length > 0` -> `>= 0` in the filled-detection
  // line splitter, IS equivalent — but by accident, not by design. It only stays equivalent while
  // every template contributes at least one empty string to its line list, which a trailing
  // newline guarantees. Strip that newline from one template and the mutation stops being
  // harmless: a deliverable flips from `in-progress` to `filled`, which OPENS a phase.
  // So this test does not kill the mutation. It guards the reason the mutation cannot hurt,
  // which is the thing actually worth pinning.
  const dir = join(ROOT, "templates", "mission");
  const files = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(".md"));
  assert.ok(files.length >= 10, `found ${files.length} templates`);
  for (const f of files) {
    const text = readFileSync(join(dir, String(f)), "utf8");
    assert.ok(text.endsWith("\n"), `templates/mission/${f} must end with a newline`);
  }
});
