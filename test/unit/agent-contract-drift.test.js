// Drift guard for what runward hands the AGENT: templates/targets/AGENTS.md and the one workflow
// ADR-0042 revised. Same principle as positioning-drift — the maintainer keeps the prose, the gate
// keeps the load-bearing gestures present.
//
// Why this exists: a doctrine sentence without its gesture cannot be executed. AGENTS.md carried
// "confront them at the point of action, not from memory" while naming only `explain <rule>` —
// which reads a rule whose NAME you already know. It never said how to find out WHICH rules govern
// the file being touched, so the obligation had no instrument. Precedent for the guard: a `**/worker/**`
// glob was removed by an editorial pass as "a redundant singular variant" and measurement proved it
// was not. Prose passes delete things; this makes the deletion red.
//
// Deliberately narrow: it pins COMMANDS and the ADR-0042 non-scope sentence, never wording. Adding a
// gesture here is a decision (it changes what every new mission tells its agent), so it is worth a
// failing test when it silently disappears.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENTS = readFileSync(join(ROOT, "templates/targets/AGENTS.md"), "utf8");
const ITERATE = readFileSync(join(ROOT, "templates/workflows/iterate.md"), "utf8");

test("AGENTS.md carries the gesture its own obligation needs, not just the obligation", () => {
  assert.match(AGENTS, /at the point of action, not from memory/,
    "the obligation ADR-0042 names");
  // The 2026-09-02 measurement: the V1 charter NAMED the verdict without ever ordering the agent
  // to produce it, and 0 of 1668 advisory-tier runs put a verdict in the model's context. The V2
  // loop closes it with an explicit order — this pin keeps the order from being polished away the
  // way the load-bearing line has been twice before.
  assert.match(AGENTS, /Run the gate yourself/,
    "the charter no longer orders the agent to run the gate before ending its turn — the loop is open again");
  assert.match(AGENTS, /Do not end your turn on a red you could have fixed/,
    "the end-of-turn discipline left the charter");
  assert.match(AGENTS, /runward rules --for <paths>/,
    "and the gesture that answers WHICH rules govern the file — an obligation with no instrument is prose");
  assert.match(AGENTS, /runward explain <rule>/,
    "then the gesture that reads the rule it returned");
  // The honesty clause travels with the gesture, or `--for` reads as exhaustive.
  assert.match(AGENTS, /declare no territory|never matched, only counted/,
    "`--for` is surfacing, never masking: rules with no territory are counted, not matched");
});

test("iterate.md still carries the ADR-0042 revision, non-scope included", () => {
  assert.match(ITERATE, /runward rules --for <paths>/, "the precise gesture (ADR-0041)");
  assert.match(ITERATE, /runward rules --phase <phase>/, "paired with the coarse one, which catches unterritoried rules");
  // ADR-0042: "an unenforced obligation that pretends to be enforced would be worse than none."
  assert.match(ITERATE, /check --strict\` verifies none of this|verifies none of this/,
    "the workflow must say the gate does not verify this");
});

test("the gate is named the same way everywhere it is named", () => {
  // A second gate invented in prose is the failure ADR-0042 and ADR-0039 both refuse.
  for (const [name, text] of [["AGENTS.md", AGENTS], ["iterate.md", ITERATE]]) {
    const gates = text.match(/runward check --[a-z]+/g) || [];
    for (const g of gates) {
      assert.match(g, /--strict|--freeze|--coverage|--hooks/, `${name}: unknown gate flag "${g}"`);
    }
  }
});
