// The three answers the ratchet can give, and the one it used to get wrong.
//
// It is a FRESHNESS gate, not a score: survivors may appear and it still passes, what it refuses is
// a register that has stopped describing the code. Three states have to stay distinct, and two of
// them look alike from the outside because both end with an empty register:
//
//   · never instructed — the tree produces survivors and nothing is filed. REFUSED, always. Most of
//     the perimeter is here, and a green would read as "the register covers this module".
//   · nothing left — the tree produces NO survivor at all, so an empty register is the correct
//     description of it. PASSES. `verify-findings` reached that state on 2026-08-29, its 17
//     survivors instructed, a net built from what they said, and the next measurement killed all
//     seventeen — whereupon the ratchet answered "it has never been instructed", which was false,
//     and refused, which punished the best outcome the loop can produce.
//   · not measured — a report carrying no mutants at all. REFUSED, because that is not a tree with
//     nothing left, it is a measurement that did not happen. This is the case that makes the second
//     one safe, and it is why the discriminator is "did the pass measure anything", not "is the
//     survivor list empty".
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { stableKey } from "../../scripts/mutation-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, "scripts", "mutation-ratchet.mjs");
const SOURCE = ["function widget() {", "  return 1;", "}"].join("\n");

const mutant = (status, line) => ({
  id: `${status}-${line}`,
  mutatorName: "ConditionalExpression",
  replacement: "true",
  status,
  location: { start: { line, column: 10 }, end: { line, column: 11 } },
});

/**
 * Run the real ratchet against a throwaway tree.
 * @param {{mutants: object[], verdicts?: boolean}} spec
 */
function ratchet({ mutants, verdicts = false }) {
  const root = mkdtempSync(join(tmpdir(), "rw-ratchet-"));
  const dir = join(root, "docs", "compliance", "mutation-survivors");
  mkdirSync(dir, { recursive: true });
  if (verdicts) {
    // Built from a FIXED descriptor, not from the report: a register exists independently of what
    // the tree happens to produce today, which is the whole reason the ratchet compares the two.
    const rec = {
      module: "widgetmod", function: "widget", mutator: "ConditionalExpression",
      replacement: "true", original: "1", source: SOURCE.split("\n")[1],
    };
    writeFileSync(join(dir, "widget.json"), JSON.stringify({
      function: "widget", probeMissions: [],
      verdicts: [{ key: "x", line: 2, mutator: rec.mutator, filing: "hole",
        evidence: "fixture", argument: "fixture", stableKey: stableKey(rec) }],
    }));
  }
  const report = join(root, "report.json");
  writeFileSync(report, JSON.stringify({
    schemaVersion: "1.0",
    files: { "dist/lib/widgetmod.js": { source: SOURCE, mutants } },
  }));
  try {
    const run = spawnSync(process.execPath, [SCRIPT, "--module", "widgetmod", "--report", report],
      { cwd: root, encoding: "utf8" });
    return { code: run.status, out: `${run.stdout}${run.stderr}` };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test("a module with survivors and nothing filed is refused, never passed", () => {
  const { code, out } = ratchet({ mutants: [mutant("Survived", 2), mutant("Killed", 2)] });
  assert.equal(code, 2, "an uninstructed module must be reported as absent, not as passing");
  assert.match(out, /never been instructed/);
});

test("a module the tree leaves with no survivor at all passes on an empty register", () => {
  const { code, out } = ratchet({ mutants: [mutant("Killed", 2), mutant("Killed", 3)] });
  assert.equal(code, 0,
    "every mutant killed is the best outcome the loop can produce — refusing it punishes the net " +
    "that got there, and calling the module uninstructed is false");
  assert.match(out, /every mutant in this tree is killed/);
});

test("a report carrying no mutants is a measurement that did not happen", () => {
  const { code, out } = ratchet({ mutants: [] });
  assert.equal(code, 2,
    "an empty report is what makes the passing case above dangerous if it is not separated: the " +
    "discriminator is whether the pass measured anything, not whether the survivor list is empty");
  assert.match(out, /REFUSED/);
});

test("an instructed module whose register still describes the tree passes", () => {
  const { code, out } = ratchet({ mutants: [mutant("Survived", 2), mutant("Killed", 3)], verdicts: true });
  assert.equal(code, 0, out);
  assert.match(out, /the register describes this tree/);
});

test("an instructed module whose survivor is no longer produced is a mismatch", () => {
  const { code, out } = ratchet({ mutants: [mutant("Killed", 2), mutant("Killed", 3)], verdicts: true });
  assert.equal(code, 1,
    "the register carries a survivor this tree does not produce — that is a stale register, and it " +
    "must not be confused with the module that has nothing left to carry");
  assert.match(out, /no longer describes this tree/);
});
