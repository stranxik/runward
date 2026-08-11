// The ADR side of the --strict gate: what makes a cited decision carry a deviation, what makes a
// recorded decision "still unratified", and the two numeric floors that separate a decision from a
// placeholder.
//
// Why this file exists. A mutation pass over `dist/lib/conformance.js` left ten mutants alive in
// `adrDecision`, `adrProblem`, `unratifiedAdrs` and `trivialReason`. Eight of them are real: four
// turn a mission the gate should pass into a refusal, and four replace a named diagnostic with an
// uncaught TypeError that erases the whole report — `check --strict --json` printed nothing at all,
// which is the proof surface going away rather than a check failing. None of them was reddened by
// the 346 cases already in the suite, because every existing fixture sits comfortably inside the
// accepted region: no cited ADR was ever exactly at a boundary, none was handwritten without a
// `**Status**` line, no deviated row ever cited nothing, and no `runward/adr/` ever held a file that
// was not a `.md`.
//
// Every guard below is exercised in BOTH directions. A gate that refuses everything satisfies a
// one-sided fixture exactly as well as a correct one, and the inverse failure — a control that
// refuses an honest mission — is the one that teaches an operator to ignore the gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { conformance, unratifiedAdrs } from "../../dist/lib/conformance.js";

// "custom" is absent from EXPECTED_MAPPED, so the non-vacuity floor of ADR-0002 stays out of these
// cases and every violation counted below comes from the guard under test.
const PHASE = "custom";

/** A body that reads like a decision someone took: comfortably past the 40-character floor. */
const REAL = (id, status) =>
  `# ${id}: x\n\n**Status**: ${status}\n\n## Context\n\nSomething had to be decided here, and this records it.\n`;

function makeMission(slugs = ["rule-a"]) {
  const dir = mkdtempSync(join(tmpdir(), "runward-adrgate-"));
  mkdirSync(join(dir, "rules"), { recursive: true });
  for (const s of slugs) {
    writeFileSync(
      join(dir, "rules", `${s}.md`),
      `---\ntitle: ${s}\nimpact: CRITICAL\nasi: [ASI01]\nphases: [${PHASE}]\n---\n\nBody.\n`,
    );
  }
  return dir;
}

function check(dir, rows) {
  writeFileSync(
    join(dir, "floor.md"),
    ["# Deliverable", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|", ...rows, ""].join("\n"),
  );
  return conformance(dir, PHASE, "floor.md");
}

/** Run a body against a fresh mission that owns a runward/adr/ directory. */
function withMission(fn) {
  const dir = makeMission();
  try {
    mkdirSync(join(dir, "adr"));
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── adrDecision: what the cited path actually is ────────────────────────────────────────────────

test("a directory carrying an ADR name is refused AS a directory, not as an unreadable file", () => {
  // An audit passed 36 deviations by pointing at `ADR-0009-…/`, a directory. The guard that catches
  // it is `statSync(abs).isFile()`. Dropping it does not open the gate — `readFileSync` then throws
  // EISDIR into the catch below and the deviation is still refused — but the operator is told the
  // file "cannot be read", and goes looking for a permissions problem that does not exist.
  // The dangerous direction here is the diagnostic, not the verdict: name the real shape.
  withMission((dir) => {
    mkdirSync(join(dir, "adr", "ADR-0009-as-a-directory"));
    const { violations } = check(dir, ["| rule-a | deviated | ADR-0009 |"]);
    assert.equal(violations.length, 1, "a directory never carries a deviation");
    assert.match(violations[0].problem, /is a directory, not a decision/);
    assert.doesNotMatch(violations[0].problem, /cannot be read/, "a directory is not an I/O failure");

    // The other direction: a real file at the same id is accepted, so this is a floor, not a wall.
    writeFileSync(join(dir, "adr", "ADR-0010-real.md"), REAL("ADR-0010", "accepted"));
    assert.deepEqual(check(dir, ["| rule-a | deviated | ADR-0010 |"]).violations, []);
  });
});

test("the near-empty floor is 40 characters: 39 is not a decision, 40 is", () => {
  // A 0-byte file satisfied 36 deviations before this floor existed. The floor is `< 40` on the
  // TRIMMED body, and the boundary is load-bearing in both directions: moved one character out it
  // starts refusing a terse but real decision, and the gate reddens a mission that is honest.
  withMission((dir) => {
    const at40 = "**Status**: accepted\n\nWe chose plan BCD.";
    assert.equal(at40.trim().length, 40, "fixture must sit exactly ON the boundary to discriminate");
    writeFileSync(join(dir, "adr", "ADR-0040-terse.md"), at40);
    assert.deepEqual(
      check(dir, ["| rule-a | deviated | ADR-0040 |"]).violations,
      [],
      "exactly 40 characters is a decision, however terse",
    );

    const at39 = at40.slice(0, -1);
    assert.equal(at39.trim().length, 39);
    writeFileSync(join(dir, "adr", "ADR-0041-terser.md"), at39);
    const { violations } = check(dir, ["| rule-a | deviated | ADR-0041 |"]);
    assert.equal(violations.length, 1, "39 characters is below the floor");
    assert.match(violations[0].problem, /empty or near-empty/);
  });
});

test("an ADR with no **Status** line is read as unstated, never as a crash", () => {
  // `text.match(/^\*\*Status\*\*:…/)` returns null on a handwritten or imported ADR that carries no
  // status header, and `line.toLowerCase().match(/^[a-zà-ÿ]+/)` returns null on the empty string
  // that follows. Both reads are optional for that reason. Made non-optional, a mission that is
  // GREEN today exits 1 with the report replaced by "Cannot read properties of null", and
  // `check --strict --json` emits no JSON at all: the whole proof surface, not one finding.
  withMission((dir) => {
    writeFileSync(
      join(dir, "adr", "ADR-0031-handwritten.md"),
      "# ADR-0031: Secrets stay outside the floor\n\n## Context\n\nWritten by hand, with no status header line, as imported journals often are.\n",
    );
    assert.deepEqual(
      check(dir, ["| rule-a | deviated | ADR-0031 |"]).violations,
      [],
      "an unstated status is not a refusal — the gate does not invent one",
    );

    // The other direction: a status that IS stated and is not ratified must still be refused, so
    // "unstated is accepted" cannot be reached by simply never reading the status.
    writeFileSync(join(dir, "adr", "ADR-0032-proposed.md"), REAL("ADR-0032", "proposed"));
    const { violations } = check(dir, ["| rule-a | deviated | ADR-0032 |"]);
    assert.equal(violations.length, 1);
    assert.match(violations[0].problem, /not ratified \(proposed\)/);
  });
});

test("a status line that does not open on a letter is unstated, not a crash", () => {
  // Isolates the second of the two optional reads: here the `**Status**` line EXISTS, so the first
  // match succeeds; it is the leading-word match that returns null because the line opens on a
  // digit. `**Status**: 2026-07-21 accepted` is a shape operators write.
  withMission((dir) => {
    writeFileSync(
      join(dir, "adr", "ADR-0033-dated.md"),
      "# ADR-0033: x\n\n**Status**: 2026-07-21 accepted\n\n## Context\n\nA real decision, recorded with enough substance to count.\n",
    );
    assert.deepEqual(check(dir, ["| rule-a | deviated | ADR-0033 |"]).violations, []);

    // And the word that IS there still decides, so this is not "the status is never read".
    writeFileSync(join(dir, "adr", "ADR-0034-withdrawn.md"), REAL("ADR-0034", "withdrawn"));
    assert.match(check(dir, ["| rule-a | deviated | ADR-0034 |"]).violations[0].problem, /withdrawn/);
  });
});

// ── adrProblem: a deviation that cites nothing ──────────────────────────────────────────────────

test("a deviated row citing no ADR is told so by name, with the adr/ directory present", () => {
  // Two guards stand here — extracting the id, and refusing an absent one — and both are read
  // optionally/defensively because `evidence.match(/ADR-\d+/i)` returns null on prose. Made
  // non-optional, the gate throws instead of reporting: the exit code survives (the row was going
  // to be a violation anyway) but the entire audit is replaced by a TypeError and `--json` emits
  // nothing. The directory must EXIST for this case to discriminate: without it the function
  // returns early on "no runward/adr/ directory" and never reaches the id at all.
  withMission((dir) => {
    writeFileSync(join(dir, "adr", "ADR-0001-real.md"), REAL("ADR-0001", "accepted"));

    const { violations } = check(dir, ["| rule-a | deviated | recorded in the design doc |"]);
    assert.equal(violations.length, 1);
    assert.match(violations[0].problem, /no ADR referenced/, "name the cause: nothing was cited");
    assert.doesNotMatch(violations[0].problem, /Cannot read properties/);

    // The other direction: a cited, ratified decision carries the deviation.
    assert.deepEqual(check(dir, ["| rule-a | deviated | ADR-0001 |"]).violations, []);
  });
});

// ── unratifiedAdrs: what counts as a recorded decision at all ───────────────────────────────────

test("only .md files in runward/adr/ are read: a stray note is not an unratified decision", () => {
  // The extension filter is the whole definition of "an ADR file" here. Removed, any note the
  // operator left beside the journal is scanned for the same markers, and a `notes.txt` holding
  // `why: UNKNOWN` becomes a strict gap on a mission with nothing wrong. Measured on the shipped
  // example mission: exit 0 becomes exit 1.
  const dir = makeMission([]);
  try {
    mkdirSync(join(dir, "adr"));
    writeFileSync(join(dir, "adr", "ADR-0001-good.md"), REAL("ADR-0001", "accepted"));
    writeFileSync(join(dir, "adr", "notes.txt"), "why: UNKNOWN\n");
    writeFileSync(join(dir, "adr", "DRAFT-scratch.txt"), "a scratch note, not a decision\n");
    assert.deepEqual(unratifiedAdrs(dir), [], "files that are not .md are not decisions");

    // The other direction: the very same content, in a .md, IS an unratified decision. Without
    // this half, deleting the marker checks entirely would satisfy the assertion above.
    writeFileSync(join(dir, "adr", "ADR-0002-why.md"), "# Why\n\n**Status**: accepted\n\nwhy: UNKNOWN\n");
    assert.deepEqual(unratifiedAdrs(dir).map((o) => o.file), ["ADR-0002-why.md"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a DRAFT the operator marked rejected is resolved, not unratified (ADR-0038)", () => {
  // A rejected DRAFT is the operator's durable "not a decision": deleting it instead would only get
  // it re-proposed by `--mine`. If the rejected check stops holding, that file reddens the gate for
  // ever and the only way out is the one the design refuses. Measured on the shipped example
  // mission: exit 0 becomes exit 1.
  const dir = makeMission([]);
  try {
    mkdirSync(join(dir, "adr"));
    writeFileSync(join(dir, "adr", "DRAFT-0007-no.md"), "# DRAFT-0007\n\n**Status**: rejected\n\nWe looked at this and said no.\n");
    assert.deepEqual(unratifiedAdrs(dir), [], "a rejected DRAFT is resolved");

    // The other direction: a DRAFT that is NOT rejected is still an unratified reconstruction, so
    // "rejected is skipped" cannot degrade into "every DRAFT is skipped".
    writeFileSync(join(dir, "adr", "DRAFT-0008-open.md"), "# DRAFT-0008\n\n**Status**: hypothesis\n\nA reconstruction nobody has ratified.\n");
    const out = unratifiedAdrs(dir);
    assert.deepEqual(out.map((o) => o.file), ["DRAFT-0008-open.md"]);
    assert.match(out[0].reason, /DRAFT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── trivialReason: the n/a floor ────────────────────────────────────────────────────────────────

test("the n/a reason floor is 8 characters: 7 is a placeholder, 8 is a reason", () => {
  // `n/a` is the one status that carries no pointer, so prose is all the gate has. The floor is
  // `< 8`; moved one character out it refuses `no queue`, which is a complete reason, and reddens
  // an honest mission. Both edges are asserted because only the boundary discriminates.
  const dir = makeMission();
  try {
    assert.deepEqual(check(dir, ["| rule-a | n/a | no queue |"]).violations, [], "8 characters is a reason");

    const short = check(dir, ["| rule-a | n/a | noqueue |"]).violations;
    assert.equal(short.length, 1, "7 characters is a placeholder");
    assert.match(short[0].problem, /empty or placeholder reason/);

    // The bracketed-token half of the same guard, so length cannot be the only thing tested.
    assert.equal(check(dir, ["| rule-a | n/a | [one-line reason why it does not apply] |"]).violations.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
