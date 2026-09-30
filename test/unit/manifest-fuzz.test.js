// Property-based fuzz of the manifest parser and the gate, written with fast-check.
//
// Deterministic in CI: every property runs under a fixed seed and a bounded number of runs, so a
// failure reproduces byte for byte and the suite costs the same on every run. A counterexample is
// shrunk by fast-check and printed with its seed and path.
//
// This replaces a hand-written seeded fuzz (a mulberry32 PRNG over the same cells and line
// shapes). Everything it asserted is asserted here, over the same generator, and the test name is
// kept byte for byte because the mission's threat model cites it as evidence through the JUnit
// report. fast-check is also what OpenSSF Scorecard's Fuzzing check recognises for JavaScript: it
// matches a `*.js` file that imports the library (checks/raw/fuzzing.go).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { parseManifest, conformance, rowDigest } from "../../dist/lib/conformance.js";

const SEED = 0xC0FFEE;
const RUNS = 500;
const EXPECTED = "expected-rule";
const PHASE = "custom"; // outside EXPECTED_MAPPED, so only the manifest drives the verdict

// maxSkipsPerRun: 1 keeps the old guard that the generator has not lost its bite. A manifest that
// happens to carry a row for the expected rule is discarded with fc.pre, and more discards than
// runs fails the property instead of passing vacuously.
const PARAMS = { seed: SEED, numRuns: RUNS, maxSkipsPerRun: 1, endOnFailure: true };

// The cells of the original fuzz, kept verbatim: they pin the shapes it was written for (a pipe
// inside a cell, a bracketed placeholder, a separator, astral characters, a 4000-character cell).
const CELLS = [
  EXPECTED, "some-other-rule", "applied", "deviated", "n/a", "N/A", "Applied ",
  "", "   ", "`code`", "a | b", "règle-été-🎯", "ADR-1", "[rule-slug]", ":---:",
  "über null", "\t", "🚀".repeat(40), "x".repeat(4000), "-42", "||||",
];
const HEADERS = ["## Rule conformance", "## Rule Conformance  ", "## Something else", "### Nested", "#Rule conformance", "## Rule conformance extra words"];

// A cell is one of the pinned cells, or an arbitrary unicode string (which may contain pipes,
// backticks, backslashes and newlines: the pinned list could not reach those combinations).
const cell = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom(...CELLS) },
  { weight: 1, arbitrary: fc.string({ unit: "grapheme", maxLength: 40 }) },
);

// The eight line shapes of the original generator, one arbitrary each.
const line = fc.oneof(
  fc.array(cell, { maxLength: 8 }).map((cs) => "|" + cs.map((c) => ` ${c} `).join("|") + "|"), // pipe row, 0..8 columns
  fc.tuple(cell, cell).map(([a, b]) => `| ${a} | ${b}`),                                           // unbalanced pipes
  fc.constantFrom(...HEADERS),
  fc.nat(4).map((n) => "|---|" + ":---:|".repeat(n)),
  fc.tuple(cell, cell).map(([a, b]) => a + b),
  fc.constant(""),
  fc.nat(9).map((n) => " ".repeat(n) + "| lone"),
  fc.nat(999999).map((n) => "plain prose about the gate, no table here " + n),
);

const manifest = fc.record({
  headed: fc.double({ min: 0, max: 1, noNaN: true }).map((x) => x < 0.7),
  lines: fc.array(line, { minLength: 3, maxLength: 30 }),
  crlf: fc.double({ min: 0, max: 1, noNaN: true }).map((x) => x < 0.25),
}).map(({ headed, lines, crlf }) => (headed ? ["## Rule conformance", ...lines] : lines).join(crlf ? "\r\n" : "\n"));

function withMission(fn) {
  const dir = mkdtempSync(join(tmpdir(), "runward-fuzz-"));
  try {
    mkdirSync(join(dir, "rules"));
    writeFileSync(join(dir, "rules", `${EXPECTED}.md`), `---\ntitle: Expected\nimpact: CRITICAL\nasi: [ASI01]\nphases: [${PHASE}]\n---\n\nBody.\n`);
    return fn(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test(`fuzz: ${RUNS} malformed manifests never throw and never pass the expected rule`, () => {
  withMission((dir) => {
    fc.assert(fc.property(manifest, (content) => {
      const rows = parseManifest(content);                     // a throw fails the property
      assert.ok(Array.isArray(rows), "parseManifest returned a non-array");
      writeFileSync(join(dir, "floor.md"), content);
      const report = conformance(dir, PHASE, "floor.md");
      assert.ok(Array.isArray(report.violations), "violations is not an array");
      // Anti-false-pass: a manifest without a row for the expected rule must be reported for it.
      // The rare accidental hit is discarded, not fixed up.
      fc.pre(!rows.some((r) => r.rule === EXPECTED));
      assert.ok(
        report.violations.some((v) => v.rule === EXPECTED),
        "the uncovered expected rule produced no violation: a fuzzed manifest passed the gate",
      );
    }), PARAMS);
  });
});

test("fuzz: the same manifest read twice gives the same rows and the same verdict", () => {
  withMission((dir) => {
    fc.assert(fc.property(manifest, (content) => {
      writeFileSync(join(dir, "floor.md"), content);
      const first = conformance(dir, PHASE, "floor.md");
      const second = conformance(dir, PHASE, "floor.md");
      assert.deepEqual(second, first, "same tree, same verdict");
      assert.deepEqual(parseManifest(content), parseManifest(content));
    }), { ...PARAMS, numRuns: 200 });
  });
});

// ADR-0080: a ratification binds to the row's digest, "whitespace folded so re-aligning a table
// does not unbind it. Rewriting the decision does." Cells are drawn from a table-safe alphabet
// (no pipe, no backtick, no line break) so that the only difference between the two renderings
// below is whitespace, which is what re-aligning a table changes.
const word = fc.string({ unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-_:/.#()éü"), minLength: 1, maxLength: 12 });
const words = fc.array(word, { minLength: 1, maxLength: 5 });
const gap = fc.string({ unit: fc.constantFrom(" ", "\t"), minLength: 1, maxLength: 6 });
const pad = fc.string({ unit: fc.constantFrom(" ", "\t"), maxLength: 6 });

// Join words with arbitrary whitespace runs and pad both ends: the same cell, re-aligned.
const realign = (ws) => fc.tuple(pad, fc.array(gap, { minLength: ws.length, maxLength: ws.length }), pad)
  .map(([lead, gaps, trail]) => lead + ws.map((w, i) => (i ? gaps[i] : "") + w).join("") + trail);

const decision = fc.record({
  rule: words, status: fc.constantFrom("applied", "deviated", "n/a"), evidence: words,
}).filter((d) => !/^(rule|:?-+:?)$/i.test(d.rule.join(" "))); // a header or separator cell is not a row, by design

test("fuzz: re-aligning a manifest row never changes the digest its ratification binds to", () => {
  fc.assert(fc.property(
    decision.chain((d) => fc.record({
      d: fc.constant(d),
      rule: realign(d.rule),
      status: fc.tuple(pad, pad, fc.boolean()).map(([a, b, up]) => a + (up ? d.status.toUpperCase() : d.status) + b),
      evidence: realign(d.evidence),
    })),
    ({ d, rule, status, evidence }) => {
      const canonical = { rule: d.rule.join(" "), status: d.status, evidence: d.evidence.join(" ") };
      const table = (r, s, e) => `## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| ${r} | ${s} | ${e} |\n`;
      const [tight] = parseManifest(table(canonical.rule, canonical.status, canonical.evidence));
      const [loose] = parseManifest(table(rule, status, evidence));
      assert.ok(tight && loose, "a well-formed row was not read");
      assert.equal(rowDigest(loose), rowDigest(tight), "re-aligning the table unbound the ratification");
      assert.equal(rowDigest({ rule, status, evidence }), rowDigest(canonical), "the digest does not fold whitespace");
    },
  ), { seed: SEED, numRuns: 300, endOnFailure: true });
});

test("fuzz: rewriting a decision's evidence changes the digest its ratification binds to", () => {
  fc.assert(fc.property(decision, words, (d, other) => {
    fc.pre(other.join(" ") !== d.evidence.join(" "));
    const a = { rule: d.rule.join(" "), status: d.status, evidence: d.evidence.join(" ") };
    const b = { ...a, evidence: other.join(" ") };
    assert.notEqual(rowDigest(b), rowDigest(a), "a rewritten decision kept its ratification");
  }), { seed: SEED, numRuns: 300, endOnFailure: true });
});
