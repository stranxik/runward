// The mission templates keep the couplings the product's own parsers rely on.
//
// PR-T6 of the stagnant-half harness (2026-09-02). Three couplings between templates/mission/ and
// src/lib were load-bearing and unguarded — the same class as the nine templateKey mutants of
// 2026-08-28 (a rename in one place, silence everywhere):
//   1. `artifactState` decides "untouched vs in-progress" by counting bracketed placeholders
//      against the PLACEHOLDER regex. A template whose brackets stop matching that regex silently
//      disarms raw-state detection: the file reads as already-worked-on the day it is scaffolded.
//   2. The five gated deliverables teach the manifest format with a `| [rule-slug] |` illustration
//      row, in the exact shape readManifest skips (RWD-2026-0097). Change the illustration and it
//      either becomes a counted garbage row again, or vanishes and stops teaching.
//   3. Every template opens with an H1 and ends with a newline — the anatomy `analyze` and the
//      renderers assume.
//
// The placeholder-poor templates are an EXHAUSTIVE INVENTORY, measured 2026-09-02, never an
// inference: decision-matrix (0 — a table of positions, filled by choosing, not by replacing),
// execution-topology (1), gap-analysis (1), reference-stack (0) and shared-bricks (0 — the two
// notes M3 will formally declare non-templates). A new template landing under the floor is a
// decision recorded here, in the same commit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readManifest } from "../../dist/lib/conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MISSION_DIR = join(ROOT, "templates", "mission");

// The PRODUCT's regex, restated. It cannot be imported (mission.ts keeps it private), so the
// source is pinned below: if mission.ts changes its literal, the pin fails and THIS copy is
// re-synced in the same commit — the two cannot drift silently.
const PLACEHOLDER = /\[[^\]\n]*\s[^\]\n]{1,80}\](?!\()/g;
const PLACEHOLDER_SOURCE = "/\\[[^\\]\\n]*\\s[^\\]\\n]{1,80}\\](?!\\()/g";

// decision-matrix left the poor on 2026-09-03: the M3a "Positions held" section brought its own
// placeholders — the two-way inventory shrinking exactly as designed.
const POOR = new Set(["execution-topology.md", "gap-analysis.md", "reference-stack.md", "shared-bricks.md"]);
// The five templates that carry a Rule conformance manifest — the flat-template names of the five
// GATED_DELIVERABLES (governance/threat-model.md is laid out at init time from threat-model.md).
const MANIFESTED = ["architecture.md", "execution-topology.md", "floor.md", "handover.md", "threat-model.md"];

const walk = (dir, prefix) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walk(join(dir, e.name), `${prefix}${e.name}/`)
    : e.name.endsWith(".md") ? [[`${prefix}${e.name}`, join(dir, e.name)]] : []);

test("this file's PLACEHOLDER copy is the product's, character for character", () => {
  const src = readFileSync(join(ROOT, "src", "lib", "mission.ts"), "utf8");
  assert.ok(src.includes(`const PLACEHOLDER = ${PLACEHOLDER_SOURCE};`),
    "mission.ts changed its PLACEHOLDER literal — re-sync the copy in this test in the same " +
    "commit, then re-measure every template against the new regex");
});

test("every mission template opens with an H1 and ends with a newline", () => {
  for (const [rel, abs] of walk(MISSION_DIR, "")) {
    const text = readFileSync(abs, "utf8");
    assert.match(text, /^# /m, `${rel}: no H1 title`);
    assert.ok(text.endsWith("\n"), `${rel}: no trailing newline`);
  }
});

test("every template carries at least 3 product-matching placeholders, save the inventoried poor", () => {
  const measured = [];
  for (const [rel, abs] of walk(MISSION_DIR, "")) {
    const n = (readFileSync(abs, "utf8").match(PLACEHOLDER) || []).length;
    measured.push([rel, n]);
    if (POOR.has(rel)) continue;
    assert.ok(n >= 3,
      `${rel}: only ${n} placeholder(s) match the product regex — below 3, artifactState can no ` +
      "longer tell an untouched scaffold from worked-on prose, and the template disarms raw-state " +
      "detection the day it ships. If lowering it is deliberate, the POOR inventory moves in this commit");
  }
  // The inventory is exhaustive in BOTH directions: a poor template that gains placeholders comes
  // OUT of the list, so the exception set never pads itself with entries nothing needs.
  for (const name of POOR) {
    const row = measured.find(([rel]) => rel === name);
    assert.ok(row, `POOR names ${name}, which is not a shipped template`);
    assert.ok(row[1] < 3, `${name} now carries ${row[1]} placeholders — remove it from the POOR inventory`);
  }
});

test("the five manifested templates teach the format in the exact shape the parser skips", () => {
  for (const name of MANIFESTED) {
    const text = readFileSync(join(MISSION_DIR, name), "utf8");
    assert.match(text, /^## Rule conformance$/m, `${name}: the manifest section vanished`);
    assert.match(text, /^\| \[rule-slug\] \| applied \\\| deviated \\\| n\/a \|/m,
      `${name}: the illustration row changed shape — it must keep the escaped pipes and the ` +
      "bracketed rule name that readManifest skips (RWD-2026-0097), or it becomes a counted row again");
    const { rows } = readManifest(text);
    assert.deepEqual(rows, [],
      `${name}: the raw template parses to ${rows.length} manifest row(s) — an untouched scaffold ` +
      "must read as zero rows, not as decisions");
  }
});
