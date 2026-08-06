// The screen that decides whether an operator-authored rule signature is allowed to become a
// RegExp the gate compiles and runs against file content (ADR-0020).
//
// Found by the full mutation pass of 2026-08-04: nine survivors in `unsafeSignature`, every one of
// them in the second half of the function — the loop that collapses NESTED GROUPS. The two tests
// already in evidence.test.js only exercise the flat scan above it (`(a+)+`, `([^()]+)+$`,
// `(a|a)+$`): all of their fixtures return before the loop is entered, so the loop could be deleted
// outright and the suite stayed green. Verified 2026-08-05: all nine survive the 212-test unit
// suite untouched.
//
// That gap is not cosmetic. Measured 2026-08-05 in a sandboxed copy of the CLI, on a mission built
// by `init --yes --example`, carrying a MEDIUM-impact house rule whose frontmatter declares
// `signature: ((a)+)+$` — a legitimate extension, since corpus divergence reports an unwritten rule
// only when it declares a gated phase at CRITICAL/HIGH, so no other pass looks at it:
//   unmutated                 -> `check --strict` exits 1 in under a second, one violation, the
//                                screen names the offending regex
//   collapse loop disabled    -> `check --strict` still running at 60 s, killed, NO verdict
//   collapsed quantifier lost -> same, killed at 45 s
// `/((a)+)+$/i` against 26 characters costs 17.5 s in V8 on its own. Nothing catches the miss
// afterwards: the corpus, seal and drift passes all run later in the same process and never get to.
// A gate that hangs is worse than a gate that says no — it renders no verdict at all.
//
// Direction of danger. A FALSE NEGATIVE (the screen calls a catastrophic pattern safe) is that
// hang. A FALSE POSITIVE (the screen rejects an ordinary signature) is a red gate on honest work,
// which is how a gate gets switched off. Every case below pins one direction, and each dangerous
// direction has its opposite in the same section, so no constant can satisfy the file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unsafeSignature } from "../../dist/lib/evidence.js";

// A quantified group nested `depth` levels deep around an inner quantifier: `((((a+))))+`.
// Each turn of the collapse loop peels exactly one level, so `depth` is also the number of turns
// the screen needs before the flat scan can see the shape.
const nested = (depth) => "(".repeat(depth) + "a+" + ")".repeat(depth) + "+";

// ── The collapse loop must run at all ───────────────────────────────────────────────────────────
// `for (let i = 0; i < 20; i++)`, `if (next === t) break`, `if (flat(t)) return true`.
// Disabling the loop condition, inverting the break, or neutering the in-loop verdict all produce
// the same defect: a nested group is never reduced, so the flat scan never sees `(G+)+`.

test("a quantifier nested one group deep is unsafe — the flat scan alone cannot see it", () => {
  // `((a+))+`: the outer group's body holds parentheses, so the flat `[^()]*` scan never matches.
  // Only the collapse loop reduces it to `(G+)+`. The dangerous direction is false: the gate then
  // compiles this and hangs on adversarial content.
  assert.equal(unsafeSignature("((a+))+"), true);
});

test("the collapse keeps the quantifier that FOLLOWED the group, not just the body's", () => {
  // `((a)+)+`: the inner body `a` carries no quantifier at all — the mark that makes this
  // catastrophic is the `+` sitting after `(a)`. Dropping it on collapse reduces to `(G)+`, which
  // the flat scan reads as safe. Measured: this exact signature hangs `check --strict` past 45 s.
  assert.equal(unsafeSignature("((a)+)+"), true);
  assert.equal(unsafeSignature("(((a)+))+"), true);
});

test("an ordinary nested group with no quantifier inside is safe — the screen must not cry wolf", () => {
  // The opposite direction, in the same shape. Without it, `return true` would satisfy the two
  // cases above, and every honest signature would be refused.
  assert.equal(unsafeSignature("((abc))+"), false);
  assert.equal(unsafeSignature("(GET|POST|PUT)"), false);
  assert.equal(unsafeSignature("assertGrounded|GroundingError|fail[-\\s]?closed"), false);
});

test("a nested quantified group with no quantifier on the OUTSIDE is safe", () => {
  // `((a)+)` repeats nothing at the top level, so there is no ambiguity to blow up. This is the
  // case a screen that keys on "saw a quantifier somewhere" gets wrong.
  assert.equal(unsafeSignature("((a)+)"), false);
  assert.equal(unsafeSignature("((abc))"), false);
});

// ── The loop's budget ───────────────────────────────────────────────────────────────────────────
// `i < 20`: twenty collapses, and the screen gives up. The bound exists so a pathological input
// cannot spin the gate; it is also, deliberately, the point where this conservative screen stops
// promising anything. Both sides of the boundary are pinned so moving it is a visible decision and
// not a silent one — an off-by-one here was among the nine survivors.

test("nesting the loop can still peel is reported unsafe — twenty collapses are available", () => {
  assert.equal(unsafeSignature(nested(21)), true);
});

test("nesting deeper than the budget is NOT reported — the screen is bounded, and says so", () => {
  // A documented miss, not an accident: the docstring calls this a conservative screen, never a
  // promise to catch every pathological regex. What must not happen is the budget drifting without
  // anyone deciding it. If this line ever needs changing, the bound moved.
  assert.equal(unsafeSignature(nested(22)), false);
});
