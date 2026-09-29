// What the joined verdict says about each refused row, read from `computeVerdict` directly.
//
// Found by the mutation measure of 2026-09-28 (release 0.42.3): the default kind of an evidence
// refusal (RWD-2026-0149) and the attachment of a proposal's evidence failures to ITS refusal
// (RWD-2026-0133) were read only through `check --json` in a child process, where no mutant is
// active. Pinned here on the reference mission: an evidence refusal the layer does not name itself
// is published as `evidence-refused`; a proposal whose pointer is dead says so in its own refusal,
// and a sound proposal beside it is not blamed for its neighbour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function example() {
  const parent = mkdtempSync(join(tmpdir(), "rw-verdict-kinds-"));
  cpSync(join(ROOT, "examples", "request-triage"), join(parent, "m"), { recursive: true });
  return { parent, mission: join(parent, "m", "runward"), floor: join(parent, "m", "runward", "floor.md") };
}
const floorRows = (v) => v.gated.find((g) => g.label === "Floor").violations;

test("an evidence refusal the layer does not name itself is published as evidence-refused", () => {
  const { parent, mission, floor } = example();
  try {
    writeFileSync(join(parent, "m", "code", "empty.ts"), "");
    writeFileSync(floor, readFileSync(floor, "utf8").replace(
      "| hexa-architecture | applied | file:code/src/core/domain/triage.ts — code/src/core/ pure domain behind four ports |",
      "| hexa-architecture | applied | file:code/empty.ts — the domain lives here |"));
    const rows = floorRows(computeVerdict(mission, { strict: true }));
    assert.deepEqual(rows.map((r) => [r.rule, r.kind]), [["hexa-architecture", "evidence-refused"]]);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a proposal's dead pointer is said in its own refusal, and only there", () => {
  const { parent, mission, floor } = example();
  try {
    writeFileSync(floor, readFileSync(floor, "utf8")
      .replace("| hexa-architecture | applied | file:code/src/core/domain/triage.ts —",
        "| hexa-architecture | proposed:applied | file:code/src/core/domain/gone.ts —")
      .replace("| state-event-sourcing | applied |", "| state-event-sourcing | proposed:applied |"));
    const rows = floorRows(computeVerdict(mission, { strict: true }));
    assert.deepEqual(rows.map((r) => [r.rule, r.kind]), [["hexa-architecture", "proposed"], ["state-event-sourcing", "proposed"]],
      "one row, one refusal: the dead pointer does not add a second");
    const [dead, sound] = rows;
    assert.match(dead.problem, /Its evidence does not hold yet, fix it before anyone ratifies: .*gone\.ts/);
    assert.doesNotMatch(sound.problem, /does not hold yet/, "the sound proposal is not blamed for its neighbour's pointer");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
