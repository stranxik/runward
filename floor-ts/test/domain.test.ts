// Unit test of the pure domain. No network, no adapter, no mock: a
// deterministic business rule is tested directly (base of the test pyramid).

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyComplexity } from "../src/core/domain/request.ts";

test("classifyComplexity: a short request is simple", () => {
  assert.equal(classifyComplexity("hello"), "simple");
});

test("classifyComplexity: a medium text is balanced", () => {
  const medium = "x".repeat(120);
  assert.equal(classifyComplexity(medium), "balanced");
});

test("classifyComplexity: an analysis request is deep", () => {
  assert.equal(classifyComplexity("analyse this problem"), "deep");
});

test("classifyComplexity: a very long text is deep", () => {
  assert.equal(classifyComplexity("x".repeat(500)), "deep");
});
