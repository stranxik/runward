// Unit tests for the mission-reading boundary (ADR-0033) — the Reopening watch parse.
// Born from the 2026-07-20 brownfield-lot audit: readReopeningTriggers shipped with zero tests,
// and an accepted ADR without a trigger section inflated the "N decision(s) carry a reopening
// trigger" count on the exact transmission surface ADR-0033 exists to make truthful.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readReopeningTriggers } from "../../dist/lib/mission.js";

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
