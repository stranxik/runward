// The whole net, and its identity. ONE definition, consumed by the pass that runs it and by the
// register that reports on it — the same rule the survivor key follows (ADR-0059 criterion 5).
//
// WHY THE DIGEST EXISTS, and it is a defect this apparatus already made. A row filed `hole` in the
// survivor register asserts something quite strong: *nothing catches this mutant, in the unit suite
// AND in the whole net*. That is a claim about a NET — a specific set of legs, each a specific file.
// Change one of those files and every such claim silently becomes a statement about a net that no
// longer exists.
//
// It happened on 2026-09-01. `test/sarif-shape.js` was extended with the fixtures a campaign showed
// were missing; every `hole` filed on `sarif` instantly rested on the old net; and a pass-1
// measurement run afterwards reported that the extension had retired nothing — which was then
// explained as "the schema leg is outside the mutation net". It is not: `sarif-shape` is a leg
// below. What was stale was the second pass, and nothing in the tree could say so, because nothing
// recorded which net a filing had been measured against.
//
// So the net has a digest, and a whole-net pass records it. A filing whose recorded digest differs
// from the current one is DISCLOSED as resting on a superseded net — disclosed, not refused
// (ADR-0060): re-running seven legs over hundreds of survivors because one test file gained a
// fixture would be an instrument that makes honest work wait, which ADR-0046 decision 3 refuses.
// The reader is told; the operator decides when to re-measure.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The net, in ascending cost. Order matters: the first leg that detects the mutant ends the trial,
 * so the cheap self-gate absorbs most of the work.
 *
 * `npm run` is deliberately absent — every npm script here starts with `npm run build`, which would
 * recompile dist/ and silently erase the mutant under test. That failure is invisible: every mutant
 * would look detected-by-nothing on a pristine build.
 */
export const NET = [
  { name: "self-gate", argv: ["dist/cli.js", "check", "--strict"] },
  { name: "oscal-schema", argv: ["test/oscal-schema.js"] },
  { name: "smoke", argv: ["test/smoke.js"] },
  { name: "intoto-schema", argv: ["test/intoto-schema.js"] },
  // Added 2026-08-27. Both shipped that same week and were in NEITHER pass: the unit stage runs
  // `test/unit/*.test.js` only, and this list did not name them — so every mutant they catch was
  // reported as SURVIVING THE NET. Found by an agent instructing the survivors of that very run,
  // which is the shape of the defect: a net the instrument does not run is a net the measurement
  // denies exists. `spelling-conformance` is the ADR-0061 corpus and `sarif-shape` the ADR-0062
  // schema check, and both are the cheap kind — a handful of probe missions, no full suite.
  { name: "spelling-corpus", argv: ["test/spelling-conformance.js"] },
  { name: "sarif-shape", argv: ["test/sarif-shape.js"] },
  { name: "audit-corpus", argv: ["test/audit-corpus.js"] },
];

/**
 * The net's identity: its leg NAMES in order, and the bytes of every leg script that is a file in
 * this repository. `dist/cli.js` is deliberately excluded — it is rebuilt from source on every
 * change and would make the digest move for reasons that have nothing to do with the net's reach.
 * What the digest must capture is "which checks run, and what they check", not "which commit".
 *
 * @returns {{digest: string, legs: string[]}}
 */
export function netDigest() {
  const h = createHash("sha256");
  const legs = [];
  for (const leg of NET) {
    h.update(leg.name);
    h.update("");
    const p = join(ROOT, leg.argv[0]);
    if (leg.argv[0].startsWith("test/") && existsSync(p)) {
      h.update(readFileSync(p));
      legs.push(leg.argv[0]);
    }
    h.update("");
  }
  return { digest: h.digest("hex"), legs };
}

/** Where a whole-net pass records what it measured, per module. */
export const WHOLENET_RECORD = "docs/compliance/mutation-wholenet.json";

/** @returns {Record<string, {at: string, digest: string, trials: number, detected: number}>} */
export function readWholeNetRecord(root = ROOT) {
  const p = join(root, WHOLENET_RECORD);
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}
