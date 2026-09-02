// The fill-detection corpus: what an honest fill must keep passing, and what a generic
// reverse-fill still gets away with — held as a ratchet that only shrinks.
//
// PR-T2 of the stagnant-half harness. The 2026-09-02 investigation filled all thirteen
// deliverables IN REVERSE ORDER with generic prose, in two minutes, with zero code in the tree —
// and every one read "filled": `artifactState` measures distance from the template (fewer than 3
// bracketed placeholders, at least 3 lines and 20 words added), which is a floor against raw
// scaffolds, not a bar against confident emptiness. That is a measured limit of today's product,
// disclosed rather than hidden (ADR-0060's posture), and chantier 5 (ADR-0065's armed tier)
// exists to harden it template by template.
//
// Two sides, and the ratchet between them:
//   ACCEPT — the shipped example's real deliverables must read "filled", template by template.
//     This is the counterweight that keeps the hardening honest: a structure contract that
//     refuses the reference mission has overshot, and this side catches it before a user does.
//   KNOWN_ACCEPTED — the exhaustive list of templates whose generic reverse-fill still reads
//     "filled" today. Asserted in BOTH directions: every listed template must still accept the
//     generic fill (when a chantier-5 PR hardens one, this fails, and the fixer REMOVES the entry
//     — the ratchet shrinks, and the shrink is the chantier's measurable proof), and every
//     unlisted template must refuse it (no dormant red, no silent regression back to accepting).
//     The list only ever shrinks; adding to it is adding a defect, and the assertion message says
//     so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES, artifactState } from "../../dist/lib/mission.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATES = join(ROOT, "templates", "mission");
const EXAMPLE = join(ROOT, "examples", "request-triage", "runward");

/** The eleven templated file deliverables (adr/ and contracts/ are directory artifacts, judged by
 *  their own rules and hardened by chantier-5 PR-M4, not here). */
const TEMPLATED = PHASES.flatMap((p) => p.artifacts.filter((a) => a.templateKey));

// THE RATCHET. Measured 2026-09-02: all eleven accept the generic reverse-fill. Every hardening
// PR of chantier 5 removes its template from this list in the same commit — never the reverse.
const KNOWN_ACCEPTED = new Set([
  "framing.md",
  "mission-contract.md",
  "architecture.md",
  "execution-topology.md",
  "decision-matrix.md",
  "floor.md",
  "threat-model.md",
  "evaluation-rubric.md",
  "observability-schema.md",
  "runbook.md",
  "handover.md",
]);

/** The reverse-fill of the 2026-09-02 essay, reproduced deterministically: strip the bracketed
 *  placeholders, append generic prose — no decision, no code, no conversation. */
function genericFill(templateText) {
  return templateText.replace(/\[[^\]\n]*\]/g, "the value recorded during the mission")
    + "\n\nThe team reviewed this deliverable during the mission and recorded the outcome here."
    + "\nEvery point below was discussed with the stakeholders and the conclusion was written down."
    + "\nThe records were checked again before the phase was declared complete."
    + "\nNothing further was found to add at the time of writing.\n";
}

function missionWith(fillFor) {
  const dir = mkdtempSync(join(tmpdir(), "rw-corpus-"));
  for (const a of TEMPLATED) {
    const dest = join(dir, a.relPath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, fillFor(a));
  }
  return dir;
}

test("ACCEPT: the shipped example's real deliverables read filled, template by template", () => {
  const dir = missionWith((a) => readFileSync(join(EXAMPLE, a.relPath), "utf8"));
  try {
    for (const a of TEMPLATED) {
      assert.equal(artifactState(dir, a), "filled",
        `${a.relPath}: the reference mission's own fill no longer reads filled — a hardening ` +
        "overshot, and the first honest user to hit it will be told their real work is a template");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the ratchet: every template still fooled by a generic reverse-fill is inventoried, and only those", () => {
  const dir = missionWith((a) => genericFill(readFileSync(join(TEMPLATES, a.templateKey), "utf8")));
  try {
    for (const a of TEMPLATED) {
      const state = artifactState(dir, a);
      if (KNOWN_ACCEPTED.has(a.templateKey)) {
        assert.equal(state, "filled",
          `${a.templateKey}: the generic reverse-fill is now REFUSED (${state}) — a hardening ` +
          "landed. Remove this entry from KNOWN_ACCEPTED in the same commit: the ratchet shrinks, " +
          "and the shrink is the hardening's measurable proof");
      } else {
        assert.notEqual(state, "filled",
          `${a.templateKey}: a template hardened earlier accepts the generic reverse-fill again — ` +
          "a regression to the 2026-09-02 defect. Adding it back to KNOWN_ACCEPTED is not a fix; " +
          "it is filing a new defect without its register entry");
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the raw scaffold itself stays untouched — the floor under the ratchet", () => {
  // The generic fill passes because the FLOOR is low, not because the floor is absent: the raw
  // template must keep reading untouched, or the entire distinction collapses and the ratchet
  // above measures nothing.
  const dir = missionWith((a) => readFileSync(join(TEMPLATES, a.templateKey), "utf8"));
  try {
    for (const a of TEMPLATED) {
      assert.equal(artifactState(dir, a), "untouched",
        `${a.relPath}: a pristine template no longer reads untouched`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
