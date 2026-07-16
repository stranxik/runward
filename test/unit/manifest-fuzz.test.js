// Deterministic fuzz of the manifest parser and the gate: seeded PRNG, no randomness across runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseManifest, conformance } from "../../dist/lib/conformance.js";

const SEED = 0xC0FFEE;
const ITERATIONS = 500;
const EXPECTED = "expected-rule";
const PHASE = "custom"; // outside EXPECTED_MAPPED, so only the manifest drives the verdict

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELLS = [
  EXPECTED, "some-other-rule", "applied", "deviated", "n/a", "N/A", "Applied ",
  "", "   ", "`code`", "a | b", "règle-été-🎯", "ADR-1", "[rule-slug]", ":---:",
  "über null", "\t", "🚀".repeat(40), "x".repeat(4000), "-42", "||||",
];
const HEADERS = ["## Rule conformance", "## Rule Conformance  ", "## Something else", "### Nested", "#Rule conformance", "## Rule conformance extra words"];

function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }

function fuzzLine(rnd) {
  const kind = Math.floor(rnd() * 8);
  switch (kind) {
    case 0: { // pipe row, 0..8 columns
      const n = Math.floor(rnd() * 9);
      return "|" + Array.from({ length: n }, () => ` ${pick(rnd, CELLS)} `).join("|") + "|";
    }
    case 1: return "| " + pick(rnd, CELLS) + " | " + pick(rnd, CELLS); // unbalanced pipes
    case 2: return pick(rnd, HEADERS);
    case 3: return "|---|" + ":---:|".repeat(Math.floor(rnd() * 5));
    case 4: return pick(rnd, CELLS) + pick(rnd, CELLS);
    case 5: return "";
    case 6: return " ".repeat(Math.floor(rnd() * 10)) + "| lone";
    default: return "plain prose about the gate, no table here " + Math.floor(rnd() * 1e6);
  }
}

function fuzzManifest(rnd) {
  const lines = [];
  if (rnd() < 0.7) lines.push("## Rule conformance");
  const n = 3 + Math.floor(rnd() * 28);
  for (let i = 0; i < n; i++) lines.push(fuzzLine(rnd));
  return lines.join(rnd() < 0.25 ? "\r\n" : "\n");
}

test(`fuzz: ${ITERATIONS} malformed manifests never throw and never pass the expected rule`, () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-fuzz-"));
  try {
    mkdirSync(join(dir, "rules"));
    writeFileSync(join(dir, "rules", `${EXPECTED}.md`), `---\ntitle: Expected\nimpact: CRITICAL\nasi: [ASI01]\nphases: [${PHASE}]\n---\n\nBody.\n`);
    const rnd = mulberry32(SEED);
    let skipped = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const content = fuzzManifest(rnd);
      let rows;
      assert.doesNotThrow(() => { rows = parseManifest(content); }, `parseManifest threw at iteration ${i}`);
      assert.ok(Array.isArray(rows), `parseManifest returned a non-array at iteration ${i}`);
      writeFileSync(join(dir, "floor.md"), content);
      let report;
      assert.doesNotThrow(() => { report = conformance(dir, PHASE, "floor.md"); }, `conformance threw at iteration ${i}`);
      assert.ok(Array.isArray(report.violations), `violations is not an array at iteration ${i}`);
      // Anti-false-pass: no fuzzed manifest carries a row for the expected rule, so the gate
      // must always report it. The rare accidental hit is skipped deterministically, not fixed up.
      if (rows.some((r) => r.rule === EXPECTED)) { skipped++; continue; }
      assert.ok(
        report.violations.some((v) => v.rule === EXPECTED),
        `iteration ${i}: the uncovered expected rule produced no violation — a fuzzed manifest passed the gate`,
      );
    }
    assert.ok(skipped < ITERATIONS / 2, `too many skipped iterations (${skipped}) — the generator lost its bite`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
