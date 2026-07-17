// Drift guard for docs/positioning.md — the source of truth for all runward copy.
//
// positioning.md carries the MANDATORY compliance guardrails, the regulatory dates, the category
// rules and the ADRs it cites. Marketing prose drifts; a stale date or a deleted guardrail is how
// an honest project starts to overclaim without noticing. This test pins the *verifiable* facts:
// if a guardrail is diluted, a date goes stale, "audit-grade" is asserted rather than negated, or a
// cited ADR vanishes, CI reddens. Subjective wording stays free; the load-bearing claims stay true.
//
// Same principle as regulated-posture: the maintainer keeps the copy, the gate keeps it honest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const P = readFileSync(join(ROOT, "docs/positioning.md"), "utf8");

test("positioning: the MANDATORY compliance guardrails are present and intact", () => {
  assert.match(P, /##\s*Compliance guardrails \(MANDATORY/, "guardrails section header");
  assert.ok(P.includes('"audit-ready evidence"'), "approved term: audit-ready evidence");
  assert.ok(P.includes('NOT "audit-grade"'), "the never-audit-grade rule");
  assert.ok(P.includes("feeds / supports"), "the feeds/supports (not satisfies) rule");
  assert.ok(P.includes('**Never** say: "compliant", "certified"'), "the never-compliant/certified rule");
});

test("positioning: no active overclaim — 'audit-grade' only ever appears negated", () => {
  for (const line of P.split("\n")) {
    if (/audit-grade/i.test(line)) {
      assert.match(line, /\bnot\b/i, `"audit-grade" must stay negated: "${line.trim().slice(0, 90)}"`);
    }
  }
});

test("positioning: EU AI Act dates are current (high-risk = 2 Dec 2027, 2026 only as a forbidden claim)", () => {
  assert.ok(P.includes("2 December 2027"), "current high-risk date present");
  // "2026 high-risk deadline" may appear only inside the rule that forbids marketing it (negated/stale).
  for (const line of P.split("\n")) {
    if (/2026[^.]*high-risk deadline/i.test(line)) {
      assert.match(line, /\bnot\b|stale/i, `a 2026 high-risk deadline must be marked forbidden/stale: "${line.trim().slice(0, 90)}"`);
    }
  }
});

test("positioning: the category rule (framework/method, never platform) is kept", () => {
  assert.ok(P.includes("framework / method"), "framework/method descriptor");
  assert.ok(P.includes('never "platform"'), "the never-platform rule");
});

test("positioning: every cited ADR exists", () => {
  const adrs = readdirSync(join(ROOT, "docs/adr"));
  for (const n of new Set([...P.matchAll(/ADR-(\d{4})/g)].map((m) => m[1]))) {
    assert.ok(adrs.some((f) => f.startsWith(`ADR-${n}`)), `positioning cites ADR-${n}, but no such file in docs/adr/`);
  }
});
