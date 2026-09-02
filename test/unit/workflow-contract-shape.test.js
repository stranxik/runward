// The 11 workflows keep their shape, and every hand they point with points at something.
//
// PR-T3 of the stagnant-half harness (2026-09-02). templates/workflows/ had not moved since 07-31
// and nothing guarded it: an editorial pass could drop a section, rename a heading, or leave a
// `Delegate to` pointing at a retired procedure, and the first reader to notice would be an agent
// mid-mission. The class of error has been paid twice already in this repository (editorial passes
// deleting the load-bearing line while polishing around it — the reason agent-contract-drift pins
// its four patterns character-exact).
//
// Three properties, each measured before being pinned:
//   1. Section order. Canonical: When to use, Inputs, Outputs, Procedure, Definition of Done,
//      Anti-patterns. The EXCEPTIONS are an exhaustive inventory, not an inference: method.md and
//      verify.md carry no Outputs (measured 2026-09-02) — method delegates its outputs to the six
//      workflows it sequences, verify emits findings through the operator's agent, not files.
//   2. Every `mission/<file>.md` reference resolves to a shipped template. templates/mission/ is
//      FLAT (threat-model.md sits at the top level; the governance/ layout appears at init time),
//      so resolution is against templates/mission/<name>, exactly as written.
//   3. Every `Delegate to \`slug\`` resolves to templates/workflows/<slug>.md, and every literal
//      `workflows/<file>.md` mention resolves too.
//
// Like every sweep in this suite, the extractors assert their own floors — a broken regex must
// read as blindness, never as cleanliness.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WF_DIR = join(ROOT, "templates", "workflows");
const CANONICAL = ["When to use", "Inputs", "Outputs", "Procedure", "Definition of Done", "Anti-patterns"];
// The exhaustive exception inventory. Adding a workflow that omits a section is a DECISION,
// recorded here in the same commit — never a quiet divergence the order check happens to allow.
const NO_OUTPUTS = new Set(["method.md", "verify.md"]);

const workflows = () => readdirSync(WF_DIR).filter((f) => f.endsWith(".md")).sort();

test("there are exactly eleven workflows, the count every other surface pins", () => {
  // smoke.js and doctor count 11; if this changes, the constant, the smoke pin and this line move
  // in the same commit (house rule: the count and its test, never one without the other).
  assert.equal(workflows().length, 11, "the workflow inventory moved — adjust every pinned count deliberately");
});

test("every workflow carries the canonical sections, in order, with the exceptions inventoried", () => {
  for (const f of workflows()) {
    const text = readFileSync(join(WF_DIR, f), "utf8");
    const sections = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    const expected = CANONICAL.filter((s) => !(s === "Outputs" && NO_OUTPUTS.has(f)));
    assert.deepEqual(sections, expected,
      `${f}: the section skeleton drifted. If the change is deliberate, this inventory and the ` +
      "exception set move in the same commit — a workflow with a missing section reads as complete " +
      "to an agent that navigates by heading");
    assert.match(text, /^# /m, `${f}: no H1 title`);
  }
});

test("every mission/<file>.md reference resolves to a shipped template", () => {
  let seen = 0;
  for (const f of workflows()) {
    const text = readFileSync(join(WF_DIR, f), "utf8");
    for (const m of text.matchAll(/mission\/[A-Za-z0-9/_-]+\.md/g)) {
      seen++;
      assert.ok(existsSync(join(ROOT, "templates", m[0])),
        `${f} references \`${m[0]}\` and templates/${m[0]} does not exist — the workflow is telling ` +
        "the agent to open a template this package does not ship");
    }
  }
  assert.ok(seen >= 14,
    `only ${seen} mission references extracted (14 measured on 2026-09-02) — the extractor went blind, not the workflows silent`);
});

test("every delegation and workflow mention resolves to a shipped workflow", () => {
  const shipped = new Set(workflows().map((f) => f.replace(/\.md$/, "")));
  let delegations = 0;
  for (const f of workflows()) {
    const text = readFileSync(join(WF_DIR, f), "utf8");
    for (const m of text.matchAll(/Delegate to `([a-z-]+)`/g)) {
      delegations++;
      assert.ok(shipped.has(m[1]),
        `${f} delegates to \`${m[1]}\`, which is not a shipped workflow — an agent following the ` +
        "method would be handed to a procedure that does not exist");
    }
    for (const m of text.matchAll(/workflows\/([a-z-]+\.md)/g)) {
      assert.ok(shipped.has(m[1].replace(/\.md$/, "")),
        `${f} mentions workflows/${m[1]}, which is not shipped`);
    }
  }
  assert.ok(delegations >= 6,
    `only ${delegations} delegations extracted (method.md alone carries six) — the extractor went blind`);
});
