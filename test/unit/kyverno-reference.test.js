// The reference Kyverno consumer (ADR-0055 layer 6).
//
// A reference policy nobody checks is a snippet that rots: the shape it teaches is what an operator
// copies, so the three load-bearing conditions must not be silently droppable. This test is not
// about Kyverno working — that is Kyverno's job — it is about the POLICY still saying the thing the
// docs claim it says.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW = readFileSync(join(ROOT, "examples/kyverno/require-runward-verdict.yaml"), "utf8");

test("layer 6: the reference policy pins WHO verified, WHAT the verdict was, and AT WHICH LEVEL", () => {
  // 1. The trust base. Without verifier.id, any VSA from any verifier satisfies the policy — the
  //    format is public, so the predicate alone proves nothing.
  assert.match(RAW, /key:\s*"\{\{ verifier\.id \}\}"[\s\S]{0,120}value:\s*"https:\/\/runward\.dev"/, "verifier.id is pinned to runward");
  // 2. The verdict.
  assert.match(RAW, /key:\s*"\{\{ verificationResult \}\}"[\s\S]{0,120}value:\s*PASSED/, "verificationResult must be PASSED");
  // 3. THE ONE THAT IS EASILY FORGOTTEN. RUNWARD_GATE_PRESENCE is weaker than STRICT, and
  //    …_THROUGH_<PHASE> is a declared PREFIX (ADR-0053). A policy checking only PASSED would admit
  //    a prefix verdict as a completion — which is the entire reason the horizon lives in the level.
  assert.match(RAW, /key:\s*"\{\{ verifiedLevels \}\}"/, "verifiedLevels is checked, not just the result");
  assert.match(RAW, /RUNWARD_GATE_STRICT/, "and the accepted level is named explicitly");
  assert.ok(!/RUNWARD_GATE_STRICT_THROUGH/.test(RAW.split("value:")[RAW.split("value:").length - 1] ?? ""),
    "a prefix level is not silently in the accepted list");
});

test("layer 6: the policy is enforcing, scoped, and pins BOTH halves of the keyless identity", () => {
  assert.match(RAW, /failureAction:\s*Enforce/, "an advisory policy admits everything — it would teach the wrong shape");
  assert.ok(!/imageReferences:[\s\S]{0,40}["']\*["']/.test(RAW), "the image scope is not a bare wildcard: a policy matching everything is an opinion, not a gate");
  assert.match(RAW, /subject:/, "the keyless subject is pinned");
  assert.match(RAW, /issuer:/, "and so is the issuer — an unpinned issuer admits anyone that provider signs for");
});

test("layer 6: the policy states the boundary runward states everywhere else", () => {
  // Whitespace-tolerant on purpose: the description is a YAML folded scalar, so a line break can
  // fall between any two words. A literal-space regex here fails on correct copy — it did, three
  // times across this session's guards, which is why every prose assertion below uses `\s+`.
  // The annotation is what a cluster operator reads in `kubectl describe`, so the non-scope has to
  // live there and not only in the docs page they may never open.
  assert.match(RAW, /never a\s+statement about the\s+code's quality/i, "the description carries GATE_NON_SCOPE");
  assert.match(RAW, /never a\s+runtime control/i, "and the ADR-0054 boundary: a delivery verdict is not a runtime policy");
  assert.match(RAW, /runward is not in the admission path and holds no\s+key/i, "the header names who owns each link of the chain");
});
