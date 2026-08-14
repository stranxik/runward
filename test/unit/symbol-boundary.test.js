// ADR-0051 decision 1: a typed pointer's `#SYMBOL` matches only at an identifier boundary.
//
// Until 2026-08-13 the check was a bare `content.includes(symbol)`, so `#guardFields` was green over
// a file that contained only `guardFieldsLegacy` — a seal sitting on a pointer whose identifier no
// longer exists, the exact "moved or renamed" case the violation message names. This amends the
// declared substring depth of ADR-0019, and the amendment is ADR-0051. Non-identifier symbols keep
// the exact-substring semantics they have by construction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { symbolPresent } from "../../dist/lib/evidence.js";

test("ADR-0051: an identifier symbol matches at a boundary, never as a fragment of a larger name", () => {
  // The seal-over-a-dead-pointer case, both directions.
  assert.equal(symbolPresent("export const guardFieldsLegacy = 1;", "guardFields"), false,
    "a fragment of a larger identifier must not satisfy the pointer");
  assert.equal(symbolPresent("export const guardFieldsLegacy = 1;", "guardFieldsLegacy"), true,
    "the real identifier still matches");

  // Legitimate adjacency (dot, paren, brace, whitespace, start/end) is a boundary and still matches.
  assert.equal(symbolPresent("class Foo { guardFields() {} }", "guardFields"), true);
  assert.equal(symbolPresent("obj.guardFields", "guardFields"), true);
  assert.equal(symbolPresent("guardFields", "guardFields"), true);

  // Embedding on either side is not a match.
  assert.equal(symbolPresent("xguardFields", "guardFields"), false, "a prefix inside a larger identifier");
  assert.equal(symbolPresent("guardFields_v2", "guardFields"), false, "a suffix inside a larger identifier");
  assert.equal(symbolPresent("myGuardFieldsHelper", "GuardFields"), false, "an interior fragment");
});

test("ADR-0051: a non-identifier symbol keeps exact-substring semantics (a boundary is meaningless there)", () => {
  // Quoted, dotted, or operator-bearing symbols are prose-like; an identifier boundary has no
  // defined meaning, and the quoted case is already exact by construction.
  assert.equal(symbolPresent('handle("x; y")', 'handle("x; y")'), true);
  assert.equal(symbolPresent("routes to a.b.c here", "a.b.c"), true);
  assert.equal(symbolPresent("nothing like it", "a.b.c"), false);
});
