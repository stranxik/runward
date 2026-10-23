// The mutation command runs the cheap test files first and the slow ones only when nothing cheap
// killed the mutant (scripts/mutation-testcmd.sh). It reads the split from test/unit-cost.json, which
// nothing kept current: written on 2026-08-24 for 72 files and an empty slow list, it still drove the
// 0.44.0 ratchet over 202 files, so every mutant paid the whole suite (118 s median per mutant on a
// runner) and seven chunks hit the five-hour ceiling. Ordering never changes a verdict; a stale split
// only costs time, and here the time was the whole measurement. A test file the split does not know is
// the drift that happened, and it is cheap to see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cost = JSON.parse(readFileSync(join(ROOT, "test", "unit-cost.json"), "utf8"));

test("the mutation cost split knows every unit test file, and names none that is gone", () => {
  const onDisk = readdirSync(join(ROOT, "test", "unit")).filter((f) => f.endsWith(".test.js")).map((f) => `test/unit/${f}`).sort();
  const listed = new Set(cost.files.map((f) => f.file));
  const unlisted = onDisk.filter((f) => !listed.has(f));
  const gone = [...listed].filter((f) => !onDisk.includes(f));
  assert.deepEqual(unlisted, [], "a test file the split does not know runs among the cheap ones on every mutant: re-measure with node scripts/test-cost.mjs");
  assert.deepEqual(gone, [], "the split names a file that no longer exists: re-measure with node scripts/test-cost.mjs");
  for (const f of cost.slow) assert.ok(listed.has(f), `${f} is slow but not measured`);
});

test("the split is a split: some files are slow, and every measured file passed when measured", () => {
  assert.ok(cost.slow.length > 0, "an empty slow list makes every mutant pay the whole suite");
  // This file is measured too, against the split of the previous measurement: it is left out of its
  // own check, or a stale "passed: false" for it would re-write itself forever.
  const self = "test/unit/unit-cost-coverage.test.js";
  assert.deepEqual(cost.files.filter((f) => !f.passed && f.file !== self).map((f) => f.file), [], "a file that failed when measured was timed on its failure, not on its run");
});
