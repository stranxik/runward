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

// ── The loop's budget: the decision this pair was built to make visible, taken 2026-08-26 ───────
// It read `i < 20` — twenty collapses, then the screen gave up AND ANSWERED "safe". The pair below
// pinned both sides of that boundary so moving it could not be silent, and it worked: the audit
// measured what lived past it. `nested(25)` killed `check --strict` at 25 s with no verdict at all,
// so the far side of the boundary was never a documented miss. It was a false green, and a
// bounded screen that says "safe" past its bound is the one thing this corpus never allows.
//
// What changed is not the number. The reduction now collapses one whole LEVEL per pass (the replace
// is global) and the budget comes from the input — a pattern cannot need more passes than it has
// opening groups — so a fixpoint is always reached for any well-formed pattern. When groups remain
// standing, the screen has NO OPINION, and it now refuses rather than approves. A pattern with more
// than 64 groups is refused outright rather than reduced: nothing legitimate in this corpus looks
// like that, and an unbounded reduction is its own way to spend the operator's CPU.

test("nesting the loop can still peel is reported unsafe", () => {
  assert.equal(unsafeSignature(nested(21)), true);
});

test("nesting past the old budget is reported too — an exhausted screen refuses, it does not approve", () => {
  // This assertion is the inverse of the one it replaces, deliberately and on the record.
  assert.equal(unsafeSignature(nested(22)), true, "22 was the first accepted depth on 0.36.2");
  assert.equal(unsafeSignature(nested(64)), true, "and no depth above it is accepted either");
});

// ── The screen had a cliff, and past the cliff it said "safe" (2026-08-26 audit, finding 6) ──
test("the ReDoS screen has no depth at which it starts accepting", () => {
  // The reducer collapsed ONE group per pass under a flat budget of 20, then fell through to
  // `return false`. Measured: depths 18-21 caught, 22 and beyond ACCEPTED, and 25 levels killed
  // `check --strict` at 25 s with no verdict at all. The realistic carrier is `update --corpus`
  // (ADR-0057), which vendors a third party's rules. Both directions in one test.
  for (const d of [18, 21, 22, 25, 30, 60]) {
    const p = "(".repeat(d) + "a+" + ")".repeat(d) + "+$";
    assert.equal(unsafeSignature(p), true, `${d} nesting levels must not be accepted`);
  }
  assert.equal(unsafeSignature("(a+)+b"), true, "the canonical form still caught");
  assert.equal(unsafeSignature("secret|vault"), false, "a shipped signature is not refused");
});

test("the same atom quantified twice in a row is refused — no group is involved, so both group scans are blind to it", () => {
  // Measured against a 40-character subject: 4 repeats 13 ms, 6 repeats 713 ms, 8 repeats >20 s.
  // `a*a*a*a*a*a*a*a*X` is seventeen characters and renders no verdict.
  for (const p of ["a*a*X", "a*a*a*a*a*a*a*a*X", String.raw`\d+\d+`, String.raw`\s*\s*\s*X`, String.raw`[-\s]?[-\s]?X`])
    assert.equal(unsafeSignature(p), true, `adjacent repetition of one atom: /${p}/`);
  // The opposite direction, so the rule is adjacency AND identity rather than "two quantifiers".
  assert.equal(unsafeSignature(String.raw`\s*\d+`), false, "two disjoint atoms are not ambiguous");
  for (const p of ["secret|vault", String.raw`sand[-\s]?box`, "pinn(ed|ing)|sha256|digest", String.raw`back[-\s]?off`,
                   String.raw`re[-\s]?approv|re[-\s]?authori[sz]`, String.raw`idempoten|dead[-\s]?letter|bounded[-\s]?concurren`,
                   String.raw`provenance|quarantin|trust[-\s]?tier`, String.raw`fall[-\s]?back|fail[-\s]?over`,
                   String.raw`assertGrounded|GroundingError|fail[-\s]?closed`])
    assert.equal(unsafeSignature(p), false, `every signature runward ships must stay legal: /${p}/`);
});
