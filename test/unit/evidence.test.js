// Unit tests for the evidence layer (ADR-0019/0020/0021): pointer grammar,
// per-type checks, pointed-content non-vacuity, signatures, sealing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEvidencePointers, evidenceReport, renderEvidenceLock, verifyEvidenceLock, collectSealableEvidence } from "../../dist/lib/evidence.js";

function scaffold() {
  const root = mkdtempSync(join(tmpdir(), "runward-ev-"));
  const mission = join(root, "runward");
  mkdirSync(join(mission, "adr"), { recursive: true });
  return { root, mission };
}
const manifest = (rows) =>
  "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" +
  rows.map((r) => `| ${r.join(" | ")} |`).join("\n") + "\n";

test("parseEvidencePointers — grammar", () => {
  assert.deepEqual(parseEvidencePointers("plain prose, no pointer"), []);
  assert.deepEqual(parseEvidencePointers("file:src/x.ts"), [{ kind: "file", raw: "file:src/x.ts", path: "src/x.ts", line: undefined, symbol: undefined }]);
  const full = parseEvidencePointers("guard shipped — file:src/x.ts:22#assertGrounded")[0];
  assert.equal(full.path, "src/x.ts"); assert.equal(full.line, 22); assert.equal(full.symbol, "assertGrounded");
  const t = parseEvidencePointers("test:test/x.test.ts::rejects an ungrounded figure; file:src/y.ts");
  assert.equal(t.length, 2);
  assert.equal(t[0].kind, "test"); assert.equal(t[0].path, "test/x.test.ts"); assert.equal(t[0].testName, "rejects an ungrounded figure");
  assert.equal(t[1].path, "src/y.ts");
  assert.deepEqual(parseEvidencePointers("adr:0003"), [{ kind: "adr", raw: "adr:0003", adrId: "0003" }]);
  // a prose "test: covered in CI" (space after the colon) is not a pointer
  assert.deepEqual(parseEvidencePointers("test: covered in CI"), []);
  // quoted test names lose their quotes
  assert.equal(parseEvidencePointers('test:t.spec.ts::"name with spaces"')[0].testName, "name with spaces");
  // trailing punctuation from prose is stripped
  assert.equal(parseEvidencePointers("see file:src/x.ts.")[0].path, "src/x.ts");
});

test("evidenceReport — typed pointer checks", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "empty.ts"), "   \n");
    writeFileSync(join(root, "real.ts"), "export function assertGrounded() {}\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-empty", "applied", "file:empty.ts"],
      ["r-missing", "applied", "file:nope.ts"],
      ["r-line", "applied", "file:real.ts:99"],
      ["r-symbol", "applied", "file:real.ts#missingSym"],
      ["r-ok", "applied", "file:real.ts#assertGrounded"],
      ["r-adr", "applied", "adr:0042"],
      ["r-prose", "applied", "section §2 of the note"],
    ]));
    const v = evidenceReport(mission, "floor.md", {});
    const by = (rule) => v.filter((x) => x.rule === rule).map((x) => x.problem).join(" | ");
    assert.match(by("r-empty"), /empty file/);
    assert.match(by("r-missing"), /does not resolve/);
    assert.match(by("r-line"), /fewer than 99 lines/);
    assert.match(by("r-symbol"), /symbol "missingSym" not found/);
    assert.equal(by("r-ok"), "");
    assert.match(by("r-adr"), /no matching ADR/);
    assert.equal(by("r-prose"), ""); // prose stays the operator's judgment
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("evidenceReport — untyped resolvable path must be non-empty; non-applied rows skipped", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "hollow.ts"), "");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-hollow", "applied", "implemented in hollow.ts overall"],
      ["r-na", "n/a", "file:nope.ts is irrelevant here"],
    ]));
    const v = evidenceReport(mission, "floor.md", {});
    assert.equal(v.length, 1);
    assert.equal(v[0].rule, "r-hollow");
    assert.match(v[0].problem, /empty file/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("evidenceReport — signatures (ADR-0020)", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "guard.ts"), "// fail-closed guard\n");
    writeFileSync(join(root, "plain.ts"), "export const x = 1;\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-signed-ok", "applied", "file:guard.ts"],
      ["r-signed-miss", "applied", "file:plain.ts"],
      ["r-signed-prose", "applied", "prose only, no file"],
      ["r-signed-bad", "applied", "file:plain.ts"],
    ]));
    const sig = "assertGrounded|fail[-\\s]?closed";
    const v = evidenceReport(mission, "floor.md", {
      "r-signed-ok": sig, "r-signed-miss": sig, "r-signed-prose": sig, "r-signed-bad": "([unclosed",
    });
    const by = (rule) => v.filter((x) => x.rule === rule).map((x) => x.problem).join(" | ");
    assert.equal(by("r-signed-ok"), "");
    assert.match(by("r-signed-miss"), /does not match the rule's signature/);
    assert.match(by("r-signed-prose"), /point the applied evidence at a file/);
    assert.match(by("r-signed-bad"), /invalid signature regex/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("evidence lock — deterministic render, verify catches change and deletion", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "a.ts"), "content A\n");
    writeFileSync(join(mission, "floor.md"), manifest([["r1", "applied", "file:a.ts"]]));
    const lock1 = renderEvidenceLock(mission, "2026-07-16");
    const lock2 = renderEvidenceLock(mission, "2026-07-16");
    assert.equal(lock1, lock2); // byte-idempotent on unchanged evidence
    assert.deepEqual(Object.keys(collectSealableEvidence(mission)), ["a.ts"]);
    writeFileSync(join(mission, "evidence-lock.json"), lock1);
    assert.equal(verifyEvidenceLock(mission).violations.length, 0);
    writeFileSync(join(root, "a.ts"), "content B\n");
    assert.match(verifyEvidenceLock(mission).violations[0].problem, /sealed evidence changed/);
    rmSync(join(root, "a.ts"));
    assert.match(verifyEvidenceLock(mission).violations[0].problem, /sealed evidence missing/);
    // a corrupt lock is a violation, not a crash
    writeFileSync(join(mission, "evidence-lock.json"), "{not json");
    assert.match(verifyEvidenceLock(mission).violations[0].problem, /not valid JSON/);
    // no lock file → no seal check
    rmSync(join(mission, "evidence-lock.json"));
    assert.equal(verifyEvidenceLock(mission).present, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
