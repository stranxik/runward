// What `init` lays down, pinned against the constants that decide it — in both directions.
//
// The mutation campaign of 2026-08-28 measured this module for the first time: 26 survivors, 24 of
// which `init` visibly obeys. Blank one destination of `MISSION_LAYOUT` and the mission comes out
// missing that deliverable; blank one entry of `WORKFLOWS` and the workflow pointer is written as
// `.claude/commands/rw-.md` while `doctor` reports a missing workflow with an empty name. The unit
// suite saw none of it — 812 tests, 0 failures, under every one of them — because the only layer
// that walked a real `init` was `test/smoke.js`, and the mutation runner
// (`scripts/mutation-testcmd.sh`) runs `test/unit/*.test.js` alone.
//
// Relying on smoke also left one destination genuinely unguarded. `execution-topology.md` is the
// ONLY one of the sixteen that smoke's expected-paths list does not name, so a mutant that stops
// `init` writing the architect-phase deliverable passes every layer this project has: unit green,
// smoke exit 0, oscal-schema, intoto-schema, spelling-conformance, sarif-shape and audit-corpus all
// exit 0. The single trace is `check --strict` wording flipping from "raw template" to "file
// missing" on a mission that exits 1 either way, so no verdict moves. That is a silent hole, and it
// existed because the guard was a hand-maintained list that one entry had never been added to.
//
// So the contract is stated twice here, and neither statement is derived from the other:
//
//   1. the constants hold exactly these entries, written out literally below — a list derived from
//      the module would agree with the module by construction and assert nothing;
//   2. a real `init` puts every destination the constants DECLARE on disk — which catches the
//      scaffolder drifting from the constants, the direction a literal list cannot see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MISSION_LAYOUT, WORKFLOWS } from "../../dist/lib/paths.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

/** Written out, not derived. Changing a destination must fail here and be a deliberate edit. */
const EXPECTED_LAYOUT = {
  "framing.md": "framing.md",
  "architecture.md": "architecture.md",
  "decision-matrix.md": "decision-matrix.md",
  "mission-contract.md": "mission-contract.md",
  "reference-stack.md": "reference-stack.md",
  "shared-bricks.md": "shared-bricks.md",
  "execution-topology.md": "execution-topology.md",
  "floor.md": "floor.md",
  "gap-analysis.md": "gap-analysis.md",
  "adr/ADR-0000-template.md": "adr/ADR-0000-template.md",
  "threat-model.md": "governance/threat-model.md",
  "evaluation-rubric.md": "governance/evaluation-rubric.md",
  "observability-schema.md": "governance/observability-schema.md",
  "port-contract.md": "contracts/port-contract.md",
  "runbook.md": "runbook.md",
  "handover.md": "handover.md",
};
const EXPECTED_WORKFLOWS = ["method", "frame", "architect", "floor", "iterate", "govern",
  "handover", "brownfield", "review", "decision-loop", "verify"];

test("the mission layout holds exactly the sixteen declared destinations", () => {
  assert.deepEqual(MISSION_LAYOUT, EXPECTED_LAYOUT,
    "a template's destination changed. That is a change to what every mission gets — make it " +
    "deliberately, and update this list in the same commit.");
  for (const [template, destination] of Object.entries(MISSION_LAYOUT)) {
    assert.match(destination, /^[\w./-]+\.md$/,
      `${template}: a destination emptied or made non-.md means init writes nothing there, and the ` +
      "deliverable goes missing without a single layer reddening");
  }
});

test("the workflow set holds exactly the eleven declared names", () => {
  assert.deepEqual([...WORKFLOWS], EXPECTED_WORKFLOWS);
  for (const w of WORKFLOWS) {
    assert.match(w, /^[a-z][a-z-]*[a-z]$/,
      `an emptied workflow name makes init write .claude/commands/rw-.md and doctor report a ` +
      `missing workflow with no name (got ${JSON.stringify(w)})`);
  }
});

test("a real init puts every declared destination on disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-layout-"));
  try {
    execFileSync("node", [CLI, "--yes", "init", "--path", dir, "--tools", "claude"],
      { encoding: "utf8", env: { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" }, stdio: "pipe" });
    for (const destination of Object.values(MISSION_LAYOUT)) {
      assert.ok(existsSync(join(dir, "runward", destination)),
        `init declares runward/${destination} in MISSION_LAYOUT and did not write it — the ` +
        "scaffolder and the constant have drifted apart");
    }
    for (const w of WORKFLOWS) {
      assert.ok(existsSync(join(dir, ".claude", "commands", `rw-${w}.md`)),
        `init declares the ${w} workflow and wrote no .claude/commands/rw-${w}.md pointer`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
