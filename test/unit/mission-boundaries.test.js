// The boundaries of mission.js: what counts as an ADR, when a deliverable has diverged enough
// from its scaffold, and where a reopening trigger section begins and ends.
//
// Written against eighteen mutants of src/lib/mission.ts that survived the whole net on 2026-08-08
// (179 of 2973 still alive after the suite grew to 346 cases). Five of them decide something
// observable today, eight sit on a branch no PHASES entry reaches yet, and five are equivalent —
// `contracts.length === 0` before a `some()` on an empty array, the blank-line filter inside
// `lines()` whose template always carries a blank line, and the two bounds of the root climb.
// The equivalent five are deliberately not pinned: a test there would freeze an arbitrary guard
// bound rather than a decision.
//
// The measurement that made this file necessary, run on a real mission built by
// `runward init --yes --example`, with the ADR files replaced by a plain `notes.md`:
//
//   honest code   `runward check`  -> exit 1, "○ Decision journal (≥1 ADR) — raw template"
//   isRealAdr with its `/^ADR-\d+/` term forced true
//                 `runward check`  -> exit 0, "✓ Decision journal (≥1 ADR)"
//
// A false green, on the plain gate, with no second mechanism behind it. Under `--strict` the run
// still exits 1, but only because the example mission happens to carry a typed pointer `adr:0001`
// that no longer resolves — defence in depth that a mission without such a pointer does not get.
// That contingency is exactly why the filter itself has to be pinned.
//
// Every guard below is exercised in both directions: a filter that accepts everything and one that
// accepts nothing both pass a one-sided fixture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { artifactState, isRealAdr, readReopeningTriggers } from "../../dist/lib/mission.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TPL = join(ROOT, "templates", "mission");
const template = (name) => readFileSync(join(TPL, name), "utf8");

const scratch = () => mkdtempSync(join(tmpdir(), "rw-boundaries-"));
const put = (dir, rel, body) => {
  mkdirSync(join(dir, dirname(rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
};

// ── What counts as an ADR ───────────────────────────────────────────────────────────────────────
// `/^ADR-\d+/.test(f) && f.endsWith(".md") && f !== "ADR-0000-template.md"`. Three terms, one
// source of truth for the mission gate, `runward status` and the reopening watch. Dropping the
// first term is the dangerous direction: any stray markdown note dropped in runward/adr/ then
// counts as a locked decision.

test("the ADR-NNNN name shape is load-bearing: a stray note in adr/ is not a decision", () => {
  // The direction that produces a false green. `README.md`, `notes.md`, `index.md` are ordinary
  // things to leave in a directory; none of them is a recorded decision.
  assert.equal(isRealAdr("README.md"), false, "a readme is not an ADR");
  assert.equal(isRealAdr("notes.md"), false, "a note is not an ADR");
  assert.equal(isRealAdr("ADR-draft.md"), false, "ADR- without a number is not an ADR");
  assert.equal(isRealAdr("adr-0001-lowercase.md"), false, "the prefix is case-sensitive");
});

test("a properly numbered ADR is accepted, and the other two terms still hold", () => {
  // The opposite direction, so the filter cannot satisfy this file by refusing everything, plus
  // the two terms that were already pinned elsewhere — kept here so this test reads as the whole
  // rule rather than a fragment of it.
  assert.equal(isRealAdr("ADR-0001-single-orchestrator.md"), true);
  assert.equal(isRealAdr("ADR-0021-timeout-of-10000-ms.md"), true, "digits in the title, not just the id");
  assert.equal(isRealAdr("ADR-0000-template.md"), false, "the scaffolded template is not a decision");
  assert.equal(isRealAdr("ADR-0001-single-orchestrator.txt"), false, "only markdown");
});

test("an adr/ holding only ordinary markdown is untouched — the gate must not read it as filled", () => {
  // The consequence at gate level, measured: with the name test dropped, this same directory
  // reports "filled", the Decision journal gap disappears and `runward check` exits 0 on a mission
  // that locked no decision at all.
  const dir = scratch();
  put(dir, "adr/README.md", "# Decisions\n\nWhere the ADRs will live.\n");
  put(dir, "adr/notes.md", "# Notes\n\nThings to decide later.\n");
  assert.equal(artifactState(dir, { label: "x", relPath: "adr" }), "untouched");
  rmSync(dir, { recursive: true, force: true });
});

// ── The divergence word floor ───────────────────────────────────────────────────────────────────
// `if (added.length < 3 || addedWords < 20) return "in-progress"`. The existing suite pins that a
// handful of near-empty lines is not a filled deliverable and that plenty of prose is; neither
// side touches the boundary itself, so `< 20` could become `<= 20` and stay green. That mutation
// refuses an honest deliverable — the false-red direction, which is how a gate gets switched off.
//
// Both cases run on execution-topology.md (one placeholder). On a placeholder-rich template the
// earlier floor answers first and these cases would pass while guarding nothing.
const topo = { label: "x", relPath: "execution-topology.md", templateKey: "execution-topology.md" };

// Three lines the template does not contain, carrying exactly twenty words: 7 + 7 + 6.
const TWENTY_WORDS = [
  "The orchestrator owns the turn and never delegates",     // 7
  "the verdict to a model it just",                          // 7
  "invoked during that same turn.",                          // 6
];
const ONE_WORD_SHORT = [
  "The orchestrator owns the turn and never delegates",     // 7
  "the verdict to a model it just",                          // 7
  "invoked that same turn.",                                 // 5 -> nineteen
];
// Counting the fixture, not reimplementing the rule: a fixture whose numbers drift makes the test
// green for the wrong reason, which is the failure this whole file exists to prevent.
const words = (ls) => ls.reduce((n, l) => n + l.split(/\s+/).filter(Boolean).length, 0);

test("exactly twenty added words clears the divergence floor — the bar is < 20, not <= 20", () => {
  // The boundary itself. With `<= 20` a deliverable that meets the stated bar is announced as
  // still in progress, and the phase it belongs to never closes.
  const dir = scratch();
  assert.equal(TWENTY_WORDS.length, 3, "fixture must add three lines");
  assert.equal(words(TWENTY_WORDS), 20, "fixture must add exactly twenty words");
  const body = `${template("execution-topology.md")}\n${TWENTY_WORDS.join("\n")}\n`;
  // The other floor must not be what answers here, or this case measures the wrong guard.
  assert.ok((body.match(/\[[^\]\n]*\s[^\]\n]{1,80}\](?!\()/g) || []).length < 3, "placeholder floor must stay out of it");
  put(dir, "execution-topology.md", body);
  assert.equal(artifactState(dir, topo), "filled");
  rmSync(dir, { recursive: true, force: true });
});

test("nineteen added words do not clear it — the floor is a floor in both directions", () => {
  const dir = scratch();
  assert.equal(ONE_WORD_SHORT.length, 3, "same three lines, one word short");
  assert.equal(words(ONE_WORD_SHORT), 19, "fixture must add exactly nineteen words");
  put(dir, "execution-topology.md", `${template("execution-topology.md")}\n${ONE_WORD_SHORT.join("\n")}\n`);
  assert.equal(artifactState(dir, topo), "in-progress");
  rmSync(dir, { recursive: true, force: true });
});

// ── The templateKey-less fallback ───────────────────────────────────────────────────────────────
// The last three lines of artifactState — the placeholder floor applied to an artifact with no
// template to compare against. No entry of PHASES reaches it today: the only two artifacts without
// a templateKey are the `adr` and `contracts` directories, and both return earlier. Seven mutants
// survived there for that reason alone, and the branch decides "filled" versus "in-progress" for
// the first PHASES entry that is ever added without a templateKey. Pinned as a latent path, so it
// does not become a silent one.
const untemplated = { label: "x", relPath: "gap-analysis.md" };

test("without a template, three placeholders still hold a deliverable at in-progress", () => {
  const dir = scratch();
  const body = ["# Gap analysis", "", "What the mission has, and what it does not.", "",
    "- [owner to name]", "- [date to set]", "- [budget to agree]", ""].join("\n");
  assert.equal((body.match(/\[[^\]\n]*\s[^\]\n]{1,80}\](?!\()/g) || []).length, 3, "fixture must carry exactly three");
  put(dir, "gap-analysis.md", body);
  assert.equal(artifactState(dir, untemplated), "in-progress");
  rmSync(dir, { recursive: true, force: true });
});

test("without a template, two placeholders let a deliverable through", () => {
  // The other direction. A constant "in-progress" would satisfy the case above on its own.
  const dir = scratch();
  const body = ["# Gap analysis", "", "What the mission has, and what it does not.", "",
    "- [owner to name]", "- [date to set]", ""].join("\n");
  assert.equal((body.match(/\[[^\]\n]*\s[^\]\n]{1,80}\](?!\()/g) || []).length, 2, "fixture must carry exactly two");
  put(dir, "gap-analysis.md", body);
  assert.equal(artifactState(dir, untemplated), "filled");
  rmSync(dir, { recursive: true, force: true });
});

// ── Where the reopening trigger section ends ────────────────────────────────────────────────────
// `const section = nextHead === -1 ? afterHeading : afterHeading.slice(0, nextHead)`. When the
// trigger section is the last one in the file, `nextHead` is -1 and the whole remainder is the
// section. Collapsing that test — to `false`, or to `=== +1` — silently turns the read into
// `slice(0, -1)` and drops the final character of the ADR. The existing cases all put a newline
// after the last line, where losing one character is invisible.

const ADR_LAST_SECTION = [
  "# ADR-0031 — Single writer on the evidence lock",
  "",
  "**Status**: accepted",
  "",
  "## Reevaluation trigger",
  "",
  "Reopen when a second process needs to write the lock inside one gate run.",
  "**Trigger set on**: 2026-01-15",       // last line, no trailing newline — see below
].join("\n");

test("a trigger section that runs to the end of the file is read whole, last character included", () => {
  // The dangerous direction is silent: the date is simply not found any more and the watch reports
  // a live decision as undated, which is a lie told by the proof surface rather than a crash.
  const dir = scratch();
  assert.ok(!ADR_LAST_SECTION.endsWith("\n"), "fixture must end without a newline, or it proves nothing");
  put(dir, "adr/ADR-0031-single-writer.md", ADR_LAST_SECTION);
  const watch = readReopeningTriggers(join(dir, "adr"));
  assert.equal(watch.triggers.length, 1);
  assert.equal(watch.triggers[0].setOn, "2026-01-15", "the date is the last thing in the file");
  assert.equal(watch.triggers[0].preview, "Reopen when a second process needs to write the lock inside one gate run.");
  rmSync(dir, { recursive: true, force: true });
});

test("a trigger section stops at the next heading — nothing below it is read as its own", () => {
  // The opposite direction: taking the remainder of the file whenever a following heading exists
  // would pull the decoy date out of the section underneath. Here the trigger carries no date of
  // its own, and `null` is the honest answer.
  const dir = scratch();
  put(dir, "adr/ADR-0032-two-sections.md", [
    "# ADR-0032 — Something decided",
    "",
    "**Status**: accepted",
    "",
    "## Reevaluation trigger",
    "",
    "Reopen when the extraction port gains a second provider.",
    "",
    "## Consequences",
    "",
    "**Trigger set on**: 2099-12-31",
    "",
  ].join("\n"));
  const watch = readReopeningTriggers(join(dir, "adr"));
  assert.equal(watch.triggers.length, 1);
  assert.equal(watch.triggers[0].setOn, null, "the date below the next heading is not this trigger's");
  assert.equal(watch.triggers[0].preview, "Reopen when the extraction port gains a second provider.");
  rmSync(dir, { recursive: true, force: true });
});

// ── The preview length boundary ─────────────────────────────────────────────────────────────────
// `prose.length > TRIGGER_PREVIEW_MAX ? … : prose`. The ellipsis is a claim: it says the operator
// is not reading the whole trigger. Moving the test to `>=` makes the read announce a truncation
// on a line it did not truncate — a small lie, on the one surface whose job is to not tell them.
const PREVIEW_MAX = 140; // TRIGGER_PREVIEW_MAX in src/lib/mission.ts, pinned here on purpose.
const FILLER = "Reopen when the measured latency of the extraction port exceeds the ceiling agreed in the floor note for three consecutive working days ok";
const proseOfLength = (n) => (FILLER + " " + "x".repeat(n)).slice(0, n);

const adrWithProse = (prose) => [
  "# ADR-0033 — Bounded preview",
  "",
  "**Status**: accepted",
  "",
  "## Reevaluation trigger",
  "",
  prose,
  "**Trigger set on**: 2026-02-01",
  "",
].join("\n");

test("a trigger line of exactly the maximum length is shown verbatim, with no ellipsis", () => {
  const dir = scratch();
  const prose = proseOfLength(PREVIEW_MAX);
  assert.equal(prose.length, PREVIEW_MAX, "fixture must sit exactly on the boundary");
  assert.equal(prose.trim(), prose, "an untrimmed fixture would shift the boundary by a character");
  put(dir, "adr/ADR-0033-bounded.md", adrWithProse(prose));
  const [t] = readReopeningTriggers(join(dir, "adr")).triggers;
  assert.equal(t.preview, prose, "nothing was cut, so nothing may claim it was");
  assert.ok(!t.preview.endsWith("…"), "no truncation marker on an untruncated line");
  rmSync(dir, { recursive: true, force: true });
});

test("one character past the maximum is truncated, and says so", () => {
  // The other direction, so the boundary cannot be satisfied by never truncating at all.
  const dir = scratch();
  const prose = proseOfLength(PREVIEW_MAX + 1);
  assert.equal(prose.length, PREVIEW_MAX + 1);
  put(dir, "adr/ADR-0033-bounded.md", adrWithProse(prose));
  const [t] = readReopeningTriggers(join(dir, "adr")).triggers;
  assert.ok(t.preview.endsWith("…"), "a cut line must carry the marker");
  assert.ok(t.preview.length <= PREVIEW_MAX, `preview must stay within the bound, got ${t.preview.length}`);
  rmSync(dir, { recursive: true, force: true });
});
