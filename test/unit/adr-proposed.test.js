// A `proposed` ADR is a question, and a question owes the evidence that would answer it.
//
// The journal's status vocabulary already distinguishes a decision taken from one that is not:
// `proposed | accepted | superseded by ADR-[n] | deprecated`, and the product reads that word —
// `readReopeningTriggers` watches accepted ADRs only, because a proposed one is not a live backlog.
// So a question awaiting arbitration has a native home, and does not need a register beside the
// journal. That was the mistake this guard replaces: a parallel file where a question could sit
// unenforced, next to a mechanism that already existed.
//
// What a `proposed` ADR must not become is a note nobody acts on. The field that prevents it is
// "What would settle it": the evidence that would ratify or reverse the decision. Without it, the
// entry is not awaiting judgement — it is a question nobody has thought about, and it will sit in
// the journal looking like work in progress until someone deletes it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adrStatusLine } from "../../dist/lib/mission.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ADR_DIR = join(ROOT, "docs", "adr");

const adrs = readdirSync(ADR_DIR)
  .filter((f) => /^ADR-\d{4}-.+\.md$/.test(f))
  .map((f) => ({ file: f, text: readFileSync(join(ADR_DIR, f), "utf8") }));

/** Read the status through the SHARED reader, so this guard and the gate agree (RWD-2026-0084). */
const status = (a) => adrStatusLine(a.text).trim().toLowerCase();
const proposed = adrs.filter((a) => status(a).startsWith("proposed"));

test("the journal declares its own status vocabulary, and it is the template's", () => {
  // THE FAILURE THIS GUARD EXISTS FOR, and it is a reproducible one rather than a slip.
  //
  // On 2026-08-29 an agent working this repository read the journal to learn how decisions are
  // recorded, found 63 files all reading `accepted`, and concluded that a decision awaiting
  // arbitration had nowhere to go — then built a parallel register beside the journal. The
  // inference is wrong but it is not careless: it reads the DATA as the SCHEMA. What made it
  // possible is that the journal's own README declared nothing about statuses (measured: zero
  // occurrences), while the vocabulary lived only in the ADR TEMPLATE, which sits under
  // `templates/mission/adr/` and `runward/adr/` — directories about MISSIONS, not about this
  // journal. A reader learning the conventions here had instances and no specification.
  //
  // So the journal states its vocabulary, and this holds the statement to the template's, because
  // a declaration that can drift from the thing it describes is worse than none.
  const readme = readFileSync(join(ADR_DIR, "README.md"), "utf8");
  const template = readFileSync(join(ROOT, "runward", "adr", "ADR-0000-template.md"), "utf8");
  const declared = /\*\*Status\*\*:\s*\[([^\]]+(?:\][^\]]*)*?)\]\s*$/m.exec(template)?.[1]
    ?? /\*\*Status\*\*:\s*\[(.+)\]/.exec(template)?.[1];
  assert.ok(declared, "the template no longer declares a status vocabulary this guard can read");
  for (const word of ["proposed", "accepted", "superseded", "deprecated"]) {
    assert.ok(declared.includes(word), `the template's vocabulary lost ${word}`);
    assert.match(readme, new RegExp(`\\b${word}\\b`),
      `docs/adr/README.md does not name \`${word}\`. A reader learning this journal's conventions ` +
      "sees 63 accepted files and infers that is the whole vocabulary — which is how a parallel " +
      "register got built beside a mechanism that already existed");
  }
});

test("the journal is read through the one status reader, and every ADR has a status", () => {
  assert.ok(adrs.length > 0, "no ADR found — the journal moved and this guard is looking at nothing");
  for (const a of adrs) {
    assert.ok(status(a).length > 0, `${a.file}: no **Status** line the shared reader can read`);
    assert.match(status(a), /^(proposed|accepted|superseded|deprecated)\b/,
      `${a.file}: status ${JSON.stringify(status(a))} is outside the template's vocabulary ` +
      "(proposed | accepted | superseded by ADR-[n] | deprecated), so no reader can classify it");
  }
});

test("a proposed decision says what would settle it, and what the tree does meanwhile", () => {
  for (const a of proposed) {
    assert.match(a.text, /^##\s+What would settle it\s*$/m,
      `${a.file} is proposed and does not say what would settle it. A decision awaiting judgement ` +
      "names the evidence that would ratify or reverse it; without that section it is a question " +
      "nobody has thought about, and it will sit here looking like work in progress");
    assert.match(a.text, /^##\s+Decision\s*$/m, `${a.file}: no Decision section`);
    assert.match(a.text, /^##\s+Alternatives discarded\s*$/m,
      `${a.file}: no alternatives — a decision with one path is not a decision, it is a task`);
    assert.match(a.text, /^##\s+Reevaluation trigger/m,
      `${a.file}: the trigger is mandatory for every ADR, proposed included — a proposed decision ` +
      "with no reopening signal hardens into the default nobody chose");
  }
});

test("a proposed decision is not counted as one that is in force", () => {
  // The product already draws this line; the guard states it so a future reader does not have to
  // rediscover it from the source: `readReopeningTriggers` watches accepted ADRs ONLY.
  for (const a of proposed) {
    assert.equal(status(a).startsWith("accepted"), false,
      `${a.file}: a proposed ADR must not read as accepted to the shared status reader — the ` +
      "reopening watch would then treat an undecided question as a decision in force");
  }
});
