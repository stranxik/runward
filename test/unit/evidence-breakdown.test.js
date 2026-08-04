// What the gate verified, counted — and the shipped example held to the standard it teaches.
//
// A field mission ran for months at 0 typed rows out of 24. The number was one line of arithmetic
// away and nobody printed it, so nobody knew the mechanical part of their gate was empty. Accepting
// prose is a decision (ADR-0004: an absence has no file to cite). Accepting it in SILENCE was the
// defect, and it contradicted ADR-0040's own standard: every gate names what it cannot verify.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceBreakdown } from "../../dist/lib/evidence.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("evidenceBreakdown separates what the gate opened from what it took on trust", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-brk-"));
  try {
    mkdirSync(join(dir, "governance"), { recursive: true });
    const manifest = (rows) =>
      "## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" + rows.join("\n") + "\n";
    writeFileSync(join(dir, "floor.md"), manifest([
      "| r-typed | applied | file:src/a.ts#sym |",
      "| r-test | applied | test:test/x.test.ts |",
      "| r-adr | applied | adr:0007 |",
      "| r-prose | applied | we reviewed it and it holds |",
      "| r-na | n/a | nothing to point at, and that is the point |",
      "| r-dev | deviated | adr:0009 |",
    ]));
    const b = evidenceBreakdown(dir);
    assert.equal(b.applied, 4, "only `applied` rows are counted");
    assert.equal(b.typed, 3, "file:, test: and adr: all count as opened");
    assert.equal(b.prose, 1);
    assert.deepEqual(b.proseRows.map((r) => r.rule), ["r-prose"],
      "and the prose rows are NAMED, so the operator can act on them");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a mission with no manifest at all reports nothing rather than dividing by zero", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-brk-empty-"));
  try {
    const b = evidenceBreakdown(dir);
    assert.deepEqual(b, { applied: 0, typed: 0, prose: 0, proseRows: [] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the SHIPPED example holds to the standard it teaches", () => {
  // An example teaches harder than a rule. `init --example` was the reference an agent read to
  // learn how to fill a manifest, and it showed prose 16 times out of 23 — so missions produced
  // prose. Whatever the docs said, this is what was demonstrated.
  const b = evidenceBreakdown(join(ROOT, "examples", "request-triage", "runward"));
  assert.ok(b.applied >= 20, `${b.applied} applied rows`);
  const ratio = b.typed / b.applied;
  assert.ok(ratio >= 0.8,
    `the shipped example must verify at least 80% of its applied rows mechanically (currently ${b.typed}/${b.applied} = ${Math.round(ratio * 100)}%). Prose is legitimate where nothing can be pointed at — but the reference mission is what every new operator copies.`);
});

test("runward's own mission holds to it too", () => {
  const b = evidenceBreakdown(join(ROOT, "runward"));
  const ratio = b.typed / b.applied;
  assert.ok(ratio >= 0.8,
    `dogfooding: ${b.typed}/${b.applied} = ${Math.round(ratio * 100)}% typed`);
});
