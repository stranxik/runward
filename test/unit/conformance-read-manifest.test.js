// What `readManifest` decides, and why it reaches the exit code.
//
// This is the only reader of the "## Rule conformance" table. Two of its outputs are load-bearing:
// `rows` — every accounted-for rule the gate will ever see for that deliverable — and `problems`,
// which `conformance()` pushes verbatim into `violations`, which `computeVerdict` sums into
// `strictGaps`, which `verdictFrom` turns into exit 1. There is no third path: a structural fault
// this function declines to report is a fault the gate never hears about.
//
// Every guard below is exercised in BOTH directions, because this function refuses and tolerates
// on the same line. A fixture that only ever checks "the malformed row is reported" passes just as
// well against a reader that reports every line it sees, and that reader reddens clean missions.
// Measured on a real `init --example` mission (2026-08-08): killing fence tracking in the section
// scan takes a green mission to 7 strict gaps; making the short-row guard unconditional takes it
// to 3; making it never fire takes a red mission to green.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readManifest } from "../../dist/lib/conformance.js";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

const TABLE = [
  "| Rule | Status | Evidence |",
  "|---|---|---|",
  "| hexa-architecture | applied | file:src/a.ts |",
];

// ── The section scan: which `Rule conformance` heading is the real one ──────────────────────────
// The scan tracks ``` / ~~~ fences so that a heading printed INSIDE an illustration is not counted
// as a section. Lose that tracking and a note that documents its own format is refused as having
// two manifests — and a refusal returns zero rows, so every expected rule of that phase becomes
// "not accounted for" at once.

test("a fenced illustration of the manifest format is not a second section, but a real duplicate is refused", () => {
  const illustrated = [
    "# Architecture",
    "The manifest looks like this:",
    "```markdown",
    "## Rule conformance",
    "| Rule | Status | Evidence |",
    "|---|---|---|",
    "| example-rule | applied | file:x.ts |",
    "```",
    "",
    "## Rule conformance",
    "",
    ...TABLE,
    "",
    "## Next",
  ].join("\n");
  const kept = readManifest(illustrated);
  assert.deepEqual(kept.problems, [], "a fenced example is prose, not a competing section");
  assert.deepEqual(kept.rows.map((r) => r.rule), ["hexa-architecture"], "the real table must still be read");

  // The other direction. Two sections that are both real stay refused: the guard tolerates fences,
  // it does not stop counting.
  const duplicated = [
    "## Rule conformance",
    "| Rule | Status | Evidence |",
    "|---|---|---|",
    "| example-rule | applied | file:x.ts |",
    "",
    "## Rule conformance",
    "",
    ...TABLE,
  ].join("\n");
  const refused = readManifest(duplicated);
  assert.equal(refused.rows.length, 0, "the gate must not choose between two manifests");
  assert.equal(refused.problems.length, 1);
  assert.match(refused.problems[0], /2 `Rule conformance` sections/);
});

test("a tilde-fenced illustration is treated exactly like a backtick-fenced one", () => {
  // Same decision, the other fence character: `~~~` is in the pattern for a reason and dropping
  // either half of it is invisible to a backtick-only fixture.
  const s = [
    "~~~",
    "## Rule conformance",
    "~~~",
    "",
    "## Rule conformance",
    "",
    ...TABLE,
  ].join("\n");
  const r = readManifest(s);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.rows.map((x) => x.rule), ["hexa-architecture"]);
});

// ── The short-row guard: which pipe lines are malformed rows, and which are table furniture ─────
// A line inside the section that starts with `|` but yields fewer than 3 columns is dropped either
// way. The only decision on that line is whether the operator is TOLD. Reporting nothing hides a
// pointer that vanished; reporting everything reddens the separator of the operator's own table.

test("a row too short to be a manifest row is reported with its line, and a whole row is not", () => {
  const truncated = [
    "## Rule conformance",
    ...TABLE,
    "| security-secrets-management | applied",
    "",
    "## Next",
  ].join("\n");
  const r = readManifest(truncated);
  assert.equal(r.rows.length, 1, "the short row cannot be read as a row");
  assert.equal(r.problems.length, 1, "and it must not vanish in silence — it carried a pointer");
  assert.match(r.problems[0], /line 5:/, "the operator needs the line, not just the fact");
  assert.match(r.problems[0], /security-secrets-management/, "and the row that caused it");

  // The other direction: the same table without the truncation reports nothing at all.
  const whole = ["## Rule conformance", ...TABLE, "", "## Next"].join("\n");
  assert.deepEqual(readManifest(whole).problems, [], "a well-formed manifest raises no structural fault");
});

test("the table's own furniture is not reported as a malformed row", () => {
  // Separator cells, a two-column header, and an empty pipe line are all shorter than 3 columns and
  // all legitimate. Each is listed separately because a guard reduced to a single term still passes
  // a fixture that only carries one of them.
  const separatorOnly = ["## Rule conformance", ...TABLE, "| --- | --- |", "", "## Next"].join("\n");
  assert.deepEqual(readManifest(separatorOnly).problems, [], "a separator cell is not a row");

  const headerOnly = ["## Rule conformance", ...TABLE, "| Rule | Status |", "", "## Next"].join("\n");
  assert.deepEqual(readManifest(headerOnly).problems, [], "a header cell is not a row");

  const emptyOnly = ["## Rule conformance", ...TABLE, "||", "", "## Next"].join("\n");
  assert.deepEqual(readManifest(emptyOnly).problems, [], "an empty pipe line is not a row");

  // And the direction that matters: furniture is tolerated, a named short row next to it is not.
  const mixed = [
    "## Rule conformance",
    ...TABLE,
    "| --- | --- |",
    "| Rule | Status |",
    "||",
    "| security-secrets-management | applied",
    "",
    "## Next",
  ].join("\n");
  const r = readManifest(mixed);
  assert.equal(r.problems.length, 1, `only the named short row is a fault, got: ${JSON.stringify(r.problems)}`);
  assert.match(r.problems[0], /security-secrets-management/);
});

test("a short line whose first cell is neither furniture nor a header is a fault", () => {
  // The guard is three terms and each excludes a different kind of furniture. A line whose first
  // cell is an ordinary word passes all three and must be reported.
  const s = ["## Rule conformance", ...TABLE, "| Legend | Meaning |", "", "## Next"].join("\n");
  const r = readManifest(s);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /Legend/);
});

// ── The link to the exit code ───────────────────────────────────────────────────────────────────
// The two assertions above are about a parser. These two are about the gate: they run the real
// verdict over a real mission, so that neither direction can be argued away as cosmetic.

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-manifest-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-manifest-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}

test("documenting the manifest format inside a fence does not redden an otherwise clean mission", () => {
  const m = mission();
  const doc = join(m.mission, "architecture.md");
  const before = readFileSync(doc, "utf8");
  const after = before.replace(
    "## Rule conformance",
    "## Format reminder\n\n```markdown\n## Rule conformance\n| Rule | Status | Evidence |\n|---|---|---|\n| example-rule | applied | file:x.ts |\n```\n\n## Rule conformance",
  );
  assert.notEqual(after, before, "fixture must actually change the deliverable");
  writeFileSync(doc, after);

  const v = computeVerdict(m.mission, { strict: true });
  assert.equal(v.strictGaps, 0, `a fenced illustration is not a manifest, got: ${JSON.stringify(v.gated.flatMap((g) => g.violations).slice(0, 3))}`);
  assert.equal(v.exitCode, 0);
  m.drop();
});

test("a row that lost its columns reddens the gate even when its rule is outside the phase's expected set", () => {
  // The case with no second mechanism. When the truncated row names a rule the phase expects,
  // "not accounted for" fires anyway and the mission stays red for a different reason. When it
  // names any other rule of the corpus, this structural report is the ONLY thing between a
  // silently dropped pointer and a green gate.
  const m = mission();
  const doc = join(m.mission, "architecture.md");
  const before = readFileSync(doc, "utf8");
  const anchor = "| security-mcp-server-pinning | n/a |";
  assert.ok(before.includes(anchor), "fixture anchor must exist in the shipped example");
  const cut = before.indexOf("\n", before.indexOf(anchor));
  const after = before.slice(0, cut + 1) + "| async-job-guardrails | applied\n" + before.slice(cut + 1);
  assert.notEqual(after, before, "fixture must actually change the deliverable");
  writeFileSync(doc, after);

  const v = computeVerdict(m.mission, { strict: true });
  assert.equal(v.strictGaps, 1, "exactly one strict gap: the unreadable row itself");
  assert.equal(v.exitCode, 1, "a manifest the gate could not read whole has not passed");
  const problems = v.gated.flatMap((g) => g.violations).map((x) => x.problem).join("\n");
  assert.match(problems, /needs 3 columns/);
  m.drop();
});
