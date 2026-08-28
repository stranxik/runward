// One line, two readers, two answers. `readAdrs` printed the ADR journal's Status cell from its own
// /^\*\*status\*\*\s*:\s*(.+)$/im while `adrStatusWord` decided ratification from
// /^\*\*Status\*\*:\s*(.+)$/mi — the same line, differing by one `\s*`. On `**Status** : accepted`
// the pack printed `accepted` and the same run counted the decision NOT ratified (RWD-2026-0084).
//
// The shape is not exotic. French typography REQUIRES a space before a colon, so it arrives from
// ordinary operators writing ordinary prose, not from fuzzing.
//
// POSITIVE CONTROL: the French case below fails on the unfixed pair — the cell reads `accepted`
// and `ratified` comes back false.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { adrStatusLine, adrStatusWord } from "../../dist/lib/conformance.js";
import { gatherComplianceInputs } from "../../dist/lib/compliance.js";

const body = (statusLine) =>
  `# Keep one queue\n\n${statusLine}\n\n## Context\n\nA body long enough to be a real decision record.\n`;

// The invariant, stated so it holds for spellings nobody has thought of yet: whatever the pack
// prints in the Status cell, the word the gate ratifies from is that cell's first token.
test("the printed status and the ratified word come from the same line, on every spelling", () => {
  for (const s of ["**Status**: accepted", "**Status** : accepted", "**Status**  :  accepted",
                   "**status**: accepted", "**Status**:accepted", "**Status** : superseded",
                   "  **Status**: accepted", "no status line at all"]) {
    const line = adrStatusLine(body(s));
    const word = adrStatusWord(body(s));
    assert.equal(word, line.toLowerCase().match(/^[a-zà-ÿ]+/)?.[0] ?? "",
      `the cell and the word disagree on ${JSON.stringify(s)} — two readers of one line`);
  }
});

test("a status written with the French space is honoured, not silently dropped", () => {
  assert.equal(adrStatusLine(body("**Status** : accepted")), "accepted");
  assert.equal(adrStatusWord(body("**Status** : accepted")), "accepted");
});

test("the pack's ADR journal and its ratified count agree on the French space", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-adrstatus-"));
  try {
    mkdirSync(join(dir, "adr"), { recursive: true });
    writeFileSync(join(dir, "adr", "ADR-0001-one-queue.md"), body("**Status** : accepted"));
    const [adr, ...rest] = gatherComplianceInputs(dir).adrs;
    assert.equal(rest.length, 0, "one ADR was written, one must be read");
    assert.equal(adr.status, "accepted", "the journal cell must carry the operator's word");
    assert.equal(adr.ratified, true,
      "the pack printed `accepted` and the same pass counted the decision unratified");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The reopening watch (ADR-0033) decides which decisions are in force by reading the same line.
// Before the fix it used the narrow pattern AND no `i` flag, so a ratified ADR written with the
// French space had its reevaluation triggers silently unwatched.
test("the reopening watch sees an ADR ratified with the French space", async () => {
  const { readReopeningTriggers } = await import("../../dist/lib/mission.js");
  const dir = mkdtempSync(join(tmpdir(), "runward-reopen-"));
  try {
    mkdirSync(join(dir, "adr"), { recursive: true });
    writeFileSync(join(dir, "adr", "ADR-0001-one-queue.md"),
      "# Keep one queue\n\n**Status** : accepted\n\n## Reevaluation trigger\n\n" +
      "- Reopen when a second queue is proposed.\n\n## Context\n\nA real decision record body.\n");
    const watch = readReopeningTriggers(join(dir, "adr"));
    assert.equal(watch.triggers.length + watch.missingSection.length, 1,
      "a ratified ADR must be in force for the watch, whichever side of it it lands on");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Recurrence guard for the class, not for this instance: four modules read this line and each new
// reader spelled the pattern again. Only mission.ts may hold it. Prose comments write `**Status**:`
// unescaped, regex literals write it escaped, so the escaped form is what this looks for.
test("exactly one module in src/lib spells the ADR status pattern", () => {
  const LIB = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "lib");
  const holders = readdirSync(LIB).filter((f) => f.endsWith(".ts"))
    .filter((f) => /\\\*\\\*Status\\\*\\\*/.test(readFileSync(join(LIB, f), "utf8")));
  assert.deepEqual(holders, ["mission.ts"],
    "every reader must go through adrStatusLine — a second spelling is how the pack, the gate, " +
    "the reopening watch and the draft-resurrection guard came to disagree (RWD-2026-0084)");
});

// ABSOLUTE values, not only coherence. The mission mutation campaign (2026-08-28) proved the
// invariant test above unfalsifiable for the shared reader itself: since adrStatusWord DERIVES
// from adrStatusLine, any misreading moves cell and word together ('stryker' == 'stryker') and
// the relative check stays green — an ADR with NO status line became ratified under the fallback
// mutant while this file passed. These assertions pin what each spelling READS, so a mutation of
// the single reader has to answer to a value, not to itself.
test("adrStatusLine reads absolute values, spelling by spelling", () => {
  const cases = [
    ["**Status**: accepted", "accepted"],
    ["**Status** : accepted", "accepted"],   // the French space
    ["**Status**:accepted", "accepted"],     // glued colon — the \s-family mutants read "" or "d"
    ["**status**: accepted", "accepted"],    // case-insensitive flag
    ["  **Status**: accepted", ""],          // indented: NOT a status line (anchored ^)
    ["See the **Status**: convention note.", ""], // mid-line mention: never a status
    ["no status line at all", ""],           // the fallback IS the empty string, nothing else
  ];
  for (const [line, want] of cases) {
    assert.equal(adrStatusLine(body(line)), want,
      `${JSON.stringify(line)} must read ${JSON.stringify(want)} — the single reader answering ` +
      `to a value is what the relative invariant above cannot check`);
  }
});

test("an ADR with no status line is NOT ratified, end to end", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-nostatus-"));
  try {
    mkdirSync(join(dir, "adr"), { recursive: true });
    writeFileSync(join(dir, "adr", "ADR-0001-no-status.md"),
      "# A decision without a status line\n\nA body long enough to be a real decision record.\n");
    const [adr] = gatherComplianceInputs(dir).adrs;
    assert.equal(adr.status, "", "no line means an empty cell — never a fabricated value");
    assert.equal(adr.ratified, false,
      "no status line means NOT ratified — the fallback mutant made this true while the " +
      "relative invariant stayed green");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
