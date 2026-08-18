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
  // Both binding dates, not just the earlier one. The shipped regime sheet carried the Annex I date
  // only in `notes`, a field NO renderer reads, so an Annex I provider read a date eight months too
  // early with their own nowhere in the pack. A date that is right in a file nobody prints is not a
  // date the reader has.
  assert.ok(P.includes("2 December 2027"), "Annex III high-risk date present");
  assert.ok(P.includes("2 August 2028"), "Annex I high-risk date present too");
  // Cite the enforceable text, not the press release that preceded it by three weeks.
  assert.ok(P.includes("2026/1744"), "the amending regulation is cited by its OJ reference");
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

test("ADR template: every ADR carries the dated reevaluation trigger the template calls mandatory", () => {
  // The 2026-08-14 audit found ten consecutive ADRs (0048-0057) without the section
  // ADR-0000-template.md declares mandatory and ADR-0033 measured as "33/33 conform". A decision
  // with no re-evaluation date is a decision that quietly becomes permanent — the failure this
  // project names elsewhere as "a wish". `readReopeningTriggers` reads them, so a missing one is
  // also a silently shorter watch list.
  const dir = join(ROOT, "docs/adr");
  const adrs = readdirSync(dir).filter((f) => /^ADR-\d{4}-.*\.md$/.test(f) && !/^ADR-0000/.test(f));
  assert.ok(adrs.length >= 50, `expected the ADR journal, got ${adrs.length}`);
  const missing = adrs.filter((f) => !/## Reevaluation trigger/.test(readFileSync(join(dir, f), "utf8")));
  assert.deepEqual(missing, [], "every ADR carries `## Reevaluation trigger (mandatory, dated)`");
  // And the date must be there: a trigger with no date cannot lapse, so it never fires.
  const undated = adrs.filter((f) => {
    const s = readFileSync(join(dir, f), "utf8");
    return /## Reevaluation trigger/.test(s) && !/\*\*Trigger set on\*\*:\s*\d{4}-\d{2}-\d{2}/.test(s);
  });
  assert.deepEqual(undated, [], "every trigger carries a **Trigger set on**: YYYY-MM-DD");
});

test("positioning: the differentiator and the stage distinction cannot be diluted", () => {
  // The 2026-08-14 audit's arbitrage 3: the one line that must survive a landing-page skim, and the
  // sentence that keeps runward from being filed as a poor man's release gate. Both are load-bearing
  // claims (they are what a prospect repeats back), so they are pinned like the guardrails.
  assert.match(P, /re-derivable\s+offline months later — on the repo alone/i, "the one-line differentiator, intact");
  assert.match(P, /Construction stage, not release stage/i, "the stage distinction is stated, not left implicit");
  assert.match(P, /input to your release gate/i, "the honest relation to Kosli/JFrog/Chainloop: under them, never instead of them");
  // And the boundary the differentiator must never lose: linked, never judged.
  assert.match(P, /never that the code is\s+good/i, "the differentiator carries its own non-scope");
});

test("positioning: the survival thesis stands verbatim — diluting or paraphrasing it reds CI", () => {
  // ADR-0052 decision 1 and its ratification criterion (a). A thesis that can be softened under
  // commercial pressure is not a thesis, so the load-bearing clauses are pinned INDIVIDUALLY: a
  // paraphrase usually keeps the shape and loses exactly one of them.
  //
  // `loose` matches a sentence across whatever separates its words in the file — a line wrap, and
  // the `>` of the blockquote it lives in. Written as a helper rather than hand-escaped per
  // assertion because a literal-space regex against hard-wrapped prose fails on CORRECT copy, which
  // it did four times across this project's guards before this.
  const loose = (sentence) => new RegExp(
    sentence.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(?:\\s|>)+"),
    "i",
  );
  const has = (sentence, why) => assert.match(P, loose(sentence), why);

  has("A harness-native gate governs actions, at runtime, inside a session, under the signature of the agent's vendor", "the opening statement, intact");
  has("Independence: a verdict is opposable only when the judged party does not manufacture the judge", "independence — the clause the whole positioning rests on");
  has("Survival: an audit happens months after the session, on the repository alone", "survival");
  has("Agent-agnosticism: the same gate must judge whatever agent produced the code, including a competitor's", "agent-agnosticism");
  // The citation must stay a PRINCIPLE, never a status: dropping this line turns a legal reference
  // into an implied accreditation runward does not have.
  has("cited as a principle, not a status", "art. 31(4) is cited as a principle");
  has("not a notified body and performs no conformity assessment", "and the disclaimer travels with it");
  // The negating close, which is what keeps the thesis honest rather than triumphant.
  has("What this does not claim: that a harness vendor cannot build a phase-gate", "the thesis states what it does NOT claim");
  has("the auditor auditing its own books", "and names the actual defect, in one image");
});
