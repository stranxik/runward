// Direct tests of the proposer reading in src/lib/ratify.ts (ADR-0082 and ADR-0088 decision 4),
// written from the survivors the 0.43.0 ratchet filed as "not yet instructed" (ADR-0046 decision 4):
// the evidence before a `; proposer:` segment kept whole, a proposal with no evidence listed as such,
// `; for:` carried by the decided rows `ratify --decided` lists, and the person accountable for the
// proposer read when the cell names no proposer text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { splitProposer, listProposals, listDecidedUnbound, proposerConflict, resolveAgentAccept } from "../../dist/lib/ratify.js";

function floor(rows, lock) {
  const dir = mkdtempSync(join(tmpdir(), "rw-ratify-proposer-"));
  writeFileSync(join(dir, "floor.md"), ["# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|", ...rows, ""].join("\n"));
  if (lock) writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify(lock));
  return dir;
}
const withFloor = (rows, lock, f) => { const dir = floor(rows, lock); try { return f(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };

test("the evidence before the proposer segment is kept whole", () => {
  assert.deepEqual(splitProposer("file:src/a.ts; proposer: claude"), { evidence: "file:src/a.ts", proposer: "claude" });
  assert.deepEqual(splitProposer("file:src/a.ts  ; proposer: claude ; for: Ada"), { evidence: "file:src/a.ts", proposer: "claude", proposerFor: "Ada" });
});

test("a proposal with no evidence is listed with no evidence", () => {
  withFloor(["| r-a | proposed:n/a |  |"], null, (dir) => {
    const [p] = listProposals(dir);
    assert.equal(p.rule, "r-a");
    assert.equal(p.evidence, "");
    assert.equal(p.proposer, null);
  });
});

test("a decided row ratify --decided lists carries the person accountable for its proposer", () => {
  withFloor(["| r-a | applied | file:src/a.ts; proposer: claude; for: Ada |"], { regulated: true }, (dir) => {
    const [u] = listDecidedUnbound(dir);
    assert.deepEqual([u.rule, u.proposer, u.proposerFor, u.unbound], ["r-a", "claude", "Ada", "no-trace"]);
  });
});

test("the person accountable for the proposer is read even when the cell names no proposer text", () => {
  const ids = { "github:ada": ["Ada"] };
  assert.equal(proposerConflict({ proposer: "", proposerFor: "Ada" }, "codex", "Ada", ids), "accountable");
  assert.equal(proposerConflict({ proposer: "", proposerFor: "Bob" }, "codex", "Ada", { ...ids, "github:bob": ["Bob"] }), null);
});

test("a refused row names its proposer as the cell wrote it, with nothing empty appended", () => {
  const listed = [{ deliverable: "floor.md", rule: "r-a", proposer: "codex" }, { deliverable: "floor.md", rule: "r-b", proposer: "codex", proposerFor: "Ada" }];
  const r = resolveAgentAccept(listed, ["floor.md:r-a,floor.md:r-b"], "codex", "Ada");
  assert.deepEqual(r.conflicts.map((c) => [c.id, c.party, c.proposer]), [["floor.md:r-a", "agent", "codex"], ["floor.md:r-b", "agent", "codex, for Ada"]]);
});
