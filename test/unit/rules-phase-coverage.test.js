// Every rule says which gate demands it, or why none does. No third state.
//
// PR-R2 of the 2026-09-02 work orders. For two months, 33 of 64 rules — five CRITICAL among them,
// the pre-production security checklist included — were attached to no phase, and nothing could
// say whether that was a decision or an omission: "not yet attached" and "no phase by nature" were
// indistinguishable. The territory family already solved this shape (appliesTo/noTerritory,
// ADR-0041; asi/noAsi, ADR-0009): silence is not a declaration. This is the third member —
// phases/noPhase — and this guard is what keeps the corpus from ever growing a silent rule again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const CLI = join(process.cwd(), "dist", "cli.js");
const { rules } = JSON.parse(execFileSync("node", [CLI, "rules", "--json"], { encoding: "utf8" }));

test("every rule carries phases or a motivated noPhase — never neither, never both", () => {
  assert.ok(rules.length >= 60, `only ${rules.length} rules read — the surface went blind`);
  for (const r of rules) {
    const hasPhases = Array.isArray(r.phases) && r.phases.length > 0;
    const hasNoPhase = typeof r.noPhase === "string" && r.noPhase.length > 0;
    assert.ok(hasPhases || hasNoPhase,
      `${r.slug}: attached to no phase and carrying no noPhase motive — the silent third state ` +
      "this guard exists to refuse. Attach it, or say why none applies (>= 40 characters)");
    assert.ok(!(hasPhases && hasNoPhase),
      `${r.slug}: carries BOTH phases and noPhase — the two are exclusive by construction`);
    if (hasNoPhase) {
      assert.ok(r.noPhase.length >= 40,
        `${r.slug}: the noPhase motive is ${r.noPhase.length} characters — a motive shorter than ` +
        "40 is a label, not a reason (the noTerritory standard)");
    }
  }
});
