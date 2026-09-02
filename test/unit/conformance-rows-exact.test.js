// conformanceRows — the machine table `verify` re-derives (RWD-2026-0095's fix made it the ONE
// source both render and payload read; the consolidated pass measured 35 mutants surviving on
// it). Pinned by deepEqual against hand-built verdicts: every branch writes its exact rows, and
// an emptied block, a blanked scope, or a flipped skip has nowhere to hide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { conformanceRows } from "../../dist/lib/check-contract.js";

const verdict = (over = {}) => ({
  gated: [],
  corpus: { status: "verifiable", missing: [], edited: [], extra: [] },
  seal: { present: false, violations: [] },
  unratified: [],
  ...over,
});

test("gated violations become rows, skipped scopes stay out, and the row is verbatim", () => {
  const v = verdict({
    gated: [
      { label: "Floor", skipped: false, violations: [{ rule: "r-1", problem: "hole named" }] },
      { label: "Govern", skipped: true, violations: [{ rule: "r-2", problem: "must not appear" }] },
    ],
  });
  assert.deepEqual(conformanceRows(v), [{ scope: "Floor", rule: "r-1", problem: "hole named" }]);
});

test("a verifiable corpus writes one exact row per divergence kind", () => {
  const v = verdict({ corpus: { status: "verifiable", missing: ["m.md"], edited: ["e.md"], extra: ["x.md"] } });
  assert.deepEqual(conformanceRows(v), [
    { scope: "corpus", rule: "m.md", problem: "rule removed from the mission corpus" },
    { scope: "corpus", rule: "e.md", problem: "rule edited since runward wrote it" },
    { scope: "corpus", rule: "x.md", problem: "rule not written by runward" },
  ]);
});

test("an unrecorded corpus is one row that says so — never silence, never the verifiable rows", () => {
  const rows = conformanceRows(verdict({ corpus: { status: "unrecorded", missing: [], edited: [], extra: [] } }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].scope, "corpus");
  assert.match(rows[0].problem, /scaffold-lock\.json is absent/);
});

test("seal violations row only when a seal is present, and reconstruction rows are verbatim", () => {
  const sealed = verdict({ seal: { present: true, violations: [{ rule: "file:x", problem: "changed since sealed" }] } });
  assert.deepEqual(conformanceRows(sealed), [{ scope: "evidence-seal", rule: "file:x", problem: "changed since sealed" }]);
  const absent = verdict({ seal: { present: false, violations: [{ rule: "ghost", problem: "must not appear" }] } });
  assert.deepEqual(conformanceRows(absent), [], "no seal, no seal rows — whatever the array carries");
  const unr = verdict({ unratified: [{ file: "adr/ADR-0001.md", reason: "no ratified line" }] });
  assert.deepEqual(conformanceRows(unr), [{ scope: "reconstruction", rule: "adr/ADR-0001.md", problem: "no ratified line" }]);
});

test("clean everywhere is an empty table — no invented row", () => {
  assert.deepEqual(conformanceRows(verdict()), []);
});
