// The nine PHASES templateKey mutants of the 2026-08-28 mission campaign, held by one loop.
//
// Emptying an artifact's templateKey disables BOTH the raw-template detection and the divergence
// floor for that deliverable: a hollowed-out scaffold (placeholder lines removed, nothing written)
// then closes its phase — exit 1 -> 0, measured per deliverable. The unit tests of artifactState
// built their own {relPath, templateKey} literals and never walked PHASES, so all nine table
// entries were unguarded; smoke holds exactly one (decision-matrix, smoke.js's one-byte-edit
// divergence assertion) and was never extended to the neighbours.
//
// This test walks the SHIPPED table, so a tenth deliverable added later is guarded on arrival.
//
// POSITIVE CONTROL: with `templateKey: "execution-topology.md"` emptied in dist, case (1) fails
// (the raw scaffold reads "filled" — its template has a single placeholder) and case (2) fails
// on the hollowed copy; with a placeholder-rich key emptied (threat-model), case (1) fails with
// "in-progress". Verified against the campaign's mutants before this file was committed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES, artifactState } from "../../dist/lib/mission.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TPL = (key) => readFileSync(join(ROOT, "templates", "mission", key), "utf8");
// Same shape artifactState counts (mission.js PLACEHOLDER): a bracketed span with a space inside.
const PLACEHOLDER = /\[[^\]\n]*\s[^\]\n]{1,80}\](?!\()/g;

// Derived from relPath, NEVER from templateKey: the first draft of this guard filtered on
// a.templateKey and so silently skipped exactly the artifact whose key a mutant emptied — a
// vacuous guard of the same family this campaign documents. Caught by its own positive control.
const keyed = PHASES.flatMap((p) => p.artifacts.filter((a) => a.relPath.endsWith(".md")));

test("every file deliverable in PHASES carries a templateKey naming a shipped template", () => {
  assert.equal(keyed.length, 11, `the table carries eleven file deliverables, saw ${keyed.length}`);
  for (const a of keyed) {
    assert.ok(a.templateKey,
      `${a.relPath}: no templateKey — without it artifactState skips both the raw-template ` +
      `comparison and the divergence floor (the templateKey mutant class, exit 1 -> 0 measured)`);
    TPL(a.templateKey); // throws if the key names no shipped template
  }
});

test("a byte-identical template copy is untouched, for every keyed deliverable", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-phases-"));
  try {
    for (const a of keyed) {
      mkdirSync(dirname(join(dir, a.relPath)), { recursive: true });
      writeFileSync(join(dir, a.relPath), TPL(a.templateKey));
      assert.equal(artifactState(dir, a), "untouched",
        `${a.relPath}: a raw scaffold must read untouched — anything else means the template ` +
        `comparison did not run (the templateKey mutant class of the mission campaign)`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a hollowed template — placeholder lines removed, nothing written — never reads filled", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-hollow-"));
  try {
    for (const a of keyed) {
      const hollow = TPL(a.templateKey).split("\n")
        .filter((l) => !PLACEHOLDER.test(l) || (PLACEHOLDER.lastIndex = 0, false)).join("\n");
      mkdirSync(dirname(join(dir, a.relPath)), { recursive: true });
      writeFileSync(join(dir, a.relPath), hollow);
      const st = artifactState(dir, a);
      assert.notEqual(st, "filled",
        `${a.relPath}: a scaffold with its placeholder lines deleted and not one word written ` +
        `read "${st}" — "filled" here is the hollowed-scaffold false green, measured as ` +
        `exit 1 -> 0 in the mission campaign`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
