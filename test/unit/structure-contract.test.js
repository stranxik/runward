// The structure contract's machinery (chantier 5, M1) — pure, inert, and precise about blame.
//
// The presence layer measures distance from the template, which is a floor against raw scaffolds
// and not a bar against confident emptiness (the T2 ratchet holds the measured proof). This file
// pins the machinery that will make a template's promises mechanical, BEFORE any template opts in:
//   - each checker (section, typed field, closed domain, cross-file echo) fires in both
//     directions;
//   - the whole contract is INERT unless the mission's own scaffold-lock declares
//     `"structureContract": true` — no existing mission moves an inch (the D3 default stays the
//     author's open decision);
//   - with an empty STRUCTURE registry, behavior is byte-identical to before M1 — proven by the
//     untouched artifact-state suite beside this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { structureViolations, structureContractOptIn, STRUCTURE } from "../../dist/lib/mission.js";

const SPEC = {
  sections: ["Problem", "Observable success criterion"],
  fields: [{ name: "Date", shape: /^\d{4}-\d{2}-\d{2}$/, hint: "an ISO date (YYYY-MM-DD)" }],
  domains: [{ section: "Definition of Ready check", column: 0, values: ["met", "risk", "missing"] }],
  echoes: [{ fromSection: "Observable success criterion", inFile: "floor.md" }],
};

const DOC = (over = {}) => [
  "# Framing", "",
  `**Date**: ${over.date ?? "2026-09-03"}`, "",
  "## Problem", "", "Forty emails a week, answered by hand.", "",
  "## Observable success criterion", "",
  over.criterion ?? "At least 60% of drafts sent unedited over two weeks.", "",
  "## Definition of Ready check", "",
  "| Condition | Status |", "|---|---|",
  `| Real problem | ${over.status ?? "met"} |`,
  "| Bracketed stays legal | [to assess] |", "",
].join("\n");

function mission(floorText) {
  const dir = mkdtempSync(join(tmpdir(), "rw-struct-"));
  writeFileSync(join(dir, "floor.md"), floorText);
  return dir;
}

test("a complete document under the spec carries zero violations", () => {
  const dir = mission("The floor proves: At least 60% of drafts sent unedited over two weeks.\n");
  try {
    assert.deepEqual(structureViolations(dir, DOC(), SPEC), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("each checker fires, and names what to fix", () => {
  const dir = mission("nothing echoed here\n");
  try {
    const missing = structureViolations(dir, DOC().replace("## Problem", "## Trouble"), SPEC);
    assert.ok(missing.some((v) => v.cause === "missing-section" && v.detail.includes('"Problem"')),
      "a renamed section is a missing section, named");

    const badDate = structureViolations(dir, DOC({ date: "next Tuesday" }), SPEC);
    assert.ok(badDate.some((v) => v.cause === "invalid-field" && v.detail.includes("ISO date")),
      "a field that does not parse under its shape is named with its hint");

    const outOfDomain = structureViolations(dir, DOC({ status: "probably fine" }), SPEC);
    assert.ok(outOfDomain.some((v) => v.cause === "row-out-of-domain" && v.detail.includes("met | risk | missing")),
      "a table cell outside its closed domain is named with the domain");

    const broken = structureViolations(dir, DOC(), SPEC);
    assert.ok(broken.some((v) => v.cause === "broken-echo" && v.detail.includes("floor.md")),
      "a criterion the floor does not echo verbatim is a broken echo");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a bracketed cell is the template teaching its format, never out of domain", () => {
  const dir = mission("At least 60% of drafts sent unedited over two weeks.\n");
  try {
    const v = structureViolations(dir, DOC(), SPEC).filter((x) => x.cause === "row-out-of-domain");
    assert.deepEqual(v, [], "the [to assess] row stayed legal");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the contract is inert without the mission's own opt-in declaration", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-optin-"));
  try {
    assert.equal(structureContractOptIn(dir), false, "no lock, no contract");
    writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify({ version: 1, files: {} }));
    assert.equal(structureContractOptIn(dir), false, "a lock without the declaration is not an opt-in");
    writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify({ version: 1, files: {}, structureContract: true }));
    assert.equal(structureContractOptIn(dir), true, "the mission's committed declaration, nothing else");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the registry ships empty in M1 — every hardening lands as a deliberate M2/M3 entry", () => {
  assert.deepEqual(Object.keys(STRUCTURE), [],
    "an entry appeared in STRUCTURE outside an M2/M3 rewrite — a spec without its rewritten " +
    "template and its T2 ratchet shrink is a hardening nobody calibrated");
});
