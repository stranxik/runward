// Unit tests for the scaffold lock — the record that lets `update` tell an UPSTREAM change from
// a LOCAL edit.
//
// Born from a field report (2026-07-31): a mission on 0.26.0 installed 0.27.0, ran `runward
// update`, and got nothing. Every rule the release had touched was reported "locally modified —
// --force to overwrite" on files the operator had never opened, so the new capability was
// withheld behind a flag our own guidance told them not to need. The bug was in the comparison:
// the mission's copy was compared to the CURRENT template, which cannot distinguish "you changed
// it" from "we changed it".
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, hashText, renderScaffoldLock, readScaffoldLock } from "../../dist/lib/scaffold-lock.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("an UPSTREAM change is not a local edit — the case that was misreported", () => {
  const shipped = "old text\n";      // what runward wrote into the mission
  const template = "new text\n";     // what the package ships today
  const v = classify(true, shipped, template, hashText(shipped));
  assert.equal(v, "upstream", "pristine since runward wrote it, and the template moved");
});

test("a genuine local edit is still recognised, and never silently overwritten", () => {
  const shipped = "old text\n";
  const edited = "old text\n<!-- operator note -->\n";
  const v = classify(true, edited, "new text\n", hashText(shipped));
  assert.equal(v, "local", "the copy no longer matches what runward wrote: the operator changed it");
});

test("without a record, runward says it cannot tell rather than blaming the operator", () => {
  // Every mission scaffolded before the lock existed lands here. The honest answer is "unknown",
  // not "locally modified" — the sentence that was false for the field report.
  assert.equal(classify(true, "whatever\n", "template\n", undefined), "unknown");
});

test("the trivial verdicts stay trivial", () => {
  assert.equal(classify(false, null, "t\n", undefined), "added");
  assert.equal(classify(true, "t\n", "t\n", hashText("t\n")), "same");
  assert.equal(classify(true, "t\n", "t\n", undefined), "same", "identical needs no record to be identical");
});

test("the lock is deterministic and byte-idempotent on an unchanged scaffold", () => {
  const files = { "rules/z.md": "h3", "rules/a.md": "h1", "workflows/m.md": "h2" };
  const a = renderScaffoldLock("0.27.0", files);
  const b = renderScaffoldLock("0.27.0", { "workflows/m.md": "h2", "rules/a.md": "h1", "rules/z.md": "h3" });
  assert.equal(a, b, "key order in the input never reaches the output");
  assert.match(a, /"rules\/a\.md"[\s\S]*"rules\/z\.md"[\s\S]*"workflows\/m\.md"/, "sorted");
});

test("a malformed or absent lock degrades to 'no record', never to a guess", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-lock-"));
  try {
    assert.equal(readScaffoldLock(dir), null, "absent");
    writeFileSync(join(dir, "scaffold-lock.json"), "{ not json");
    assert.equal(readScaffoldLock(dir), null, "malformed");
    writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify({ version: 99, files: {} }));
    assert.equal(readScaffoldLock(dir), null, "a version we do not know is not a lock we may trust");
    writeFileSync(join(dir, "scaffold-lock.json"), renderScaffoldLock("0.27.0", { "rules/a.md": "h" }));
    assert.deepEqual(readScaffoldLock(dir).files, { "rules/a.md": "h" }, "and a good one round-trips");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
