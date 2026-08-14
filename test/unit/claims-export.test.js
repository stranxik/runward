// The `runward/claims` export resolves (ADR-0050 decision 2, closing the audit's finding).
//
// ADR-0050 moved the forbidden-claim list into src/lib/claims-rules.ts "published with the package
// (the runward/claims export)" so a site-build guard consumes the SAME list from its pinned
// dependency. The 2026-08-14 audit found the documented export did not resolve: package.json had no
// `exports` field at all, so the two-lists-cannot-drift mechanism was a documented intention, not a
// contract. This test resolves it by Node self-reference — exactly the resolution a consumer gets.
import { test } from "node:test";
import assert from "node:assert/strict";

test("ADR-0050: `runward/claims` resolves and carries the rules, the screen, and the frozen citations", async () => {
  const m = await import("runward/claims");
  assert.ok(Array.isArray(m.CLAIMS_RULES) && m.CLAIMS_RULES.length >= 5, "the forbidden-claim list ships");
  assert.ok(m.CLAIMS_RULES.every((r) => r.name && r.re instanceof RegExp && r.instead && r.why), "each rule carries name/re/instead/why — the failure hands over the sentence to use");
  assert.ok(m.NEGATED instanceof RegExp, "the legitimate-context screen ships with the rules");
  assert.ok(m.FROZEN_CITATIONS, "the frozen citations ship");
});

test("ADR-0050: deep paths stay importable — the exports map closes nothing that worked", async () => {
  // The wildcard passthrough: adding `exports` must not break any consumer that already reached
  // into the package by path (the site spawns dist/cli.js; tests import dist/lib/*).
  const deep = await import("runward/dist/lib/claims-rules.js");
  assert.ok(Array.isArray(deep.CLAIMS_RULES), "the pre-exports deep path still resolves");
});
