// ADR-0088 decision 10: the public claims about runward's own delivery are narrowed before any act is
// delegated. Measured 2026-10-01: all 277 merged pull requests not opened by Dependabot were opened and
// merged by the maintainer's account with 0 reviews, and every agent session used the same token. Yet
// AGENTS.md read "The maintainer merges", GOVERNANCE.md "reviews and merges changes", the README
// "publishing to npm is a deliberate human gesture" and "the human decides the crossing", and the
// regulated sheet "review-by-default". Each sentence described a person where the forge records an
// account that agents also hold.
//
// This guard keeps the narrowed form in place, in both directions: the documents that state how
// runward is run must carry the one-accountable-person disclosure, and the unqualified sentences must
// not come back. A wording change that drops the disclosure reddens here first; if the facts change
// (a second maintainer, stage 2 proved), change the documents and this guard deliberately, together.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
// Prose is wrapped at different widths across these files: compare on collapsed whitespace.
const flat = (p) => read(p).replace(/\s+/g, " ");

const DISCLOSES = ["README.md", "AGENTS.md", "GOVERNANCE.md", "docs/compliance/regulated-adoption.md"];

const MUST = [
  [/one accountable person/i, "names the single accountable person"],
  [/disclosed throughput, not independent approval/, "says agent ratifications and forge approvals are not independent approval"],
  [/not a DORA change-approval control/, "says this is not a DORA change-approval control"],
  [/declared, not proved/, "says the delegation is declared, not proved"],
];

// Each was printed on 2026-10-01 as an unqualified fact; ADR-0088 decision 10 names the first four.
const NEVER = [
  [/\bThe maintainer merges\b/, "an unqualified 'The maintainer merges'"],
  [/reviews and merges changes/, "a maintainer who 'reviews and merges' (0 reviews on 277 merges)"],
  [/deliberate human gesture/, "publishing as a 'deliberate human gesture' while agents hold the credential"],
  [/the human decides the crossing/, "'the human decides the crossing' with no disclosure"],
  [/review-by-default/, "'review-by-default' on a repository whose merges carry 0 reviews"],
];

test("ADR-0088 decision 10: the documents that say how runward is run carry the one-accountable-person disclosure", () => {
  for (const file of DISCLOSES) {
    const text = flat(file);
    for (const [re, what] of MUST) assert.match(text, re, `${file} no longer ${what}`);
  }
});

test("ADR-0088 decision 10: the unqualified claims of 2026-10-01 do not come back", () => {
  for (const file of [...DISCLOSES, "docs/verifying-a-release.md", "runward/runbook.md", "CONTRIBUTING.md", "SECURITY.md"]) {
    const text = flat(file);
    for (const [re, what] of NEVER) assert.doesNotMatch(text, re, `${file} carries ${what}`);
  }
});

test("ADR-0088: runward's SLSA Source level is stated as not measured, never as a level", () => {
  // The ADR records the level as unmeasured, and the fourth level asks for two trusted persons, which one
  // maintainer cannot provide. Wherever a document names the Source track, the same sentence must say
  // it is not measured.
  let seen = 0;
  for (const file of DISCLOSES) {
    for (const s of flat(file).split(/(?<=[.;])\s+/)) {
      if (!/SLSA Source/i.test(s)) continue;
      seen++;
      assert.match(s, /not measured/, `${file}: "${s.slice(0, 100)}" names the SLSA Source track without saying it is not measured`);
    }
  }
  assert.ok(seen > 0, "no document names the SLSA Source level any more: was the disclosure reworded? update this guard deliberately");
});

test("the guard fires on the sentences it was written for", () => {
  // Proven in both directions (the no-overclaim lesson): a guard never seen failing is decoration.
  const before = [
    "- The maintainer merges. Review by a model is advisory: it produces findings, it never crosses a gate.",
    "The maintainer sets direction, reviews and merges changes, and cuts releases.",
    "publishing to npm is a deliberate human gesture (creating the Release)",
    "The deterministic executes; the human decides the crossing.",
    "`CODEOWNERS` and review-by-default; no committed secrets;",
  ];
  for (const line of before) assert.ok(NEVER.some(([re]) => re.test(line)), `the guard misses: ${line}`);
  const after = [
    "runward has one accountable person, the maintainer, who answers for every merge.",
    "The deterministic executes; the human sets the policy and answers for every crossing.",
  ];
  for (const line of after) assert.ok(!NEVER.some(([re]) => re.test(line)), `false positive on: ${line}`);
});
