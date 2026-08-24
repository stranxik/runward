// The gate ROUTES a `#symbol` pointer onto the right committed-tool adapter, and reports every
// state that adapter can return.
//
// `tool-adapters.test.js` proves each adapter answers correctly when called. Nothing proved the
// GATE calls it, or that it acts on the answer. Measured 2026-08-21: 27 mutants in that routing
// survived the unit suite AND the whole net, and the shape of them is what makes this file
// necessary — they are `ConditionalExpression`, `StringLiteral` and `ObjectLiteral` mutants on the
// `else if (result === "…")` chain. Delete a branch, compare against the wrong word, or empty the
// violation object, and the gate stops reporting a state the adapter correctly detected.
//
// What that buys an attacker, or an honest mistake: a scan that never checked the cited rule, a lint
// report that cannot be parsed, an SBOM that does not declare the component, a coverage report that
// never measured the file — every one of them accepted as evidence, with `check --strict` at exit 0.
//
// The adapters recognise files STRUCTURALLY, never by extension (ADR-0056), so these fixtures carry
// the real shapes. Each case asserts the FAILURE CLASS is reported, never the wording: the message
// is prose and prose has no business being pinned. The mirror — the state that must stay silent —
// is here for every adapter, because a router that reports everything satisfies the other half.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceReport } from "../../dist/lib/evidence.js";

const table = (...rows) =>
  `## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n${rows.join("\n")}\n`;

const SARIF_CLEAN = JSON.stringify({
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  version: "2.1.0",
  runs: [{
    tool: { driver: { name: "scanner", rules: [{ id: "no-hardcoded-secrets" }] } },
    results: [],
  }],
});
const SARIF_FINDINGS = JSON.stringify({
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  version: "2.1.0",
  runs: [{
    tool: { driver: { name: "scanner", rules: [{ id: "no-hardcoded-secrets" }] } },
    results: [{ ruleId: "no-hardcoded-secrets", level: "error", message: { text: "AWS key" } }],
  }],
});
const ESLINT_CLEAN = JSON.stringify([
  { filePath: "/w/repo/src/clean.ts", messages: [], errorCount: 0 },
]);
const ESLINT_FINDINGS = JSON.stringify([
  { filePath: "/w/repo/src/broken.ts", messages: [{ ruleId: "no-undef", severity: 2 }], errorCount: 1 },
]);
const SBOM = JSON.stringify({
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  components: [{ type: "library", name: "lodash", version: "4.17.21", purl: "pkg:npm/lodash@4.17.21" }],
});
const LCOV = [
  "TN:", "SF:src/lib/guard.ts", "DA:1,4", "DA:2,1", "LF:2", "LH:2", "end_of_record",
  "TN:", "SF:src/lib/dead.ts", "DA:1,0", "DA:2,0", "LF:2", "LH:0", "end_of_record",
].join("\n") + "\n";
const COBERTURA = `<?xml version="1.0"?>
<coverage line-rate="0.5" version="1.9"><packages><package name="app"><classes>
  <class name="Guard" filename="src/guard.ts" line-rate="1.0"><lines><line number="1" hits="4"/></lines></class>
  <class name="Dead" filename="src/dead.ts" line-rate="0.0"><lines><line number="1" hits="0"/></lines></class>
</classes></package></packages></coverage>`;

/** A mission citing one committed report through one typed pointer. */
function fixture(reportName, reportBody, symbol) {
  const root = mkdtempSync(join(tmpdir(), "rw-routing-"));
  const mission = join(root, "runward");
  mkdirSync(join(root, "ci"), { recursive: true });
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(root, "ci", reportName), reportBody);
  writeFileSync(join(mission, "floor.md"),
    table(`| r1 | applied | file:ci/${reportName}#${symbol} |`));
  return { root, mission };
}

/** The problems this mission raises, as plain strings. */
function problems(reportName, body, symbol) {
  const { root, mission } = fixture(reportName, body, symbol);
  try {
    return evidenceReport(mission, "floor.md", {}).map((v) => v.problem);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

/**
 * Every case is (what the report says) → (the class the gate must report).
 *
 * `expect: null` is the state that must stay SILENT, and each adapter has one. Without it a router
 * that reported every state would satisfy every other row here, and a gate that refuses honest
 * evidence is the one that gets switched off.
 *
 * The patterns match the DOMAIN TERM the state is about — "finding" for a scan, "measured but" for a
 * file a coverage report saw and nothing ran. Not the sentence: three of these were written against
 * wording the author assumed and had to be corrected against the wording that exists, which is the
 * argument for matching the class rather than the prose in the first place.
 */
const CASES = [
  // SARIF — a scan is evidence only when it ran the cited rule AND found nothing.
  ["SARIF, rule clean", "scan.json", SARIF_CLEAN, "no-hardcoded-secrets", null],
  ["SARIF, rule reported findings", "scan.json", SARIF_FINDINGS, "no-hardcoded-secrets", /finding/i],
  ["SARIF, rule never checked", "scan.json", SARIF_CLEAN, "some-other-rule", /no rule|absent/i],
  ["SARIF, unparseable", "scan.json", '{"$schema":"https://json.schemastore.org/sarif-2.1.0.json","version":"2.1.0","runs":[', "any", /sarif/i],

  // ESLint — severity 2 reddens; a warning does not.
  ["ESLint, file clean", "lint.json", ESLINT_CLEAN, "src/clean.ts", null],
  ["ESLint, file has an error", "lint.json", ESLINT_FINDINGS, "src/broken.ts", /lint|findings/i],
  ["ESLint, file not in the report", "lint.json", ESLINT_CLEAN, "src/never-linted.ts", /no record|absent/i],
  // Structurally an ESLint report (opens `[`, carries filePath and messages) and truncated, so the
  // adapter recognises the kind and then cannot read it. That state has its own violation, and it
  // has to: a report the gate cannot parse is not a report the gate has read.
  ["ESLint, unparseable", "lint.json", '[{"filePath":"/w/repo/src/x.ts","messages":[', "src/x.ts", /lint/i],

  // CycloneDX — presence only, and a bare name is REFUSED: `#lodash` would pass at any version.
  ["SBOM, component declared with its version", "sbom.json", SBOM, "pkg:npm/lodash@4.17.21", null],
  ["SBOM, component absent", "sbom.json", SBOM, "pkg:npm/left-pad@1.3.0", /no component|absent/i],
  ["SBOM, a bare name names no version", "sbom.json", SBOM, "lodash", /ambiguous|version|names/i],
  ["SBOM, unparseable", "sbom.json", '{"bomFormat":"CycloneDX","specVersion":"1.5","components":[', "pkg:npm/x@1", /sbom|cyclonedx|bill of materials/i],

  // Coverage — measured and exercised, or measured and not. Never a threshold (ADR-0056).
  ["lcov, file exercised", "cov.info", LCOV, "src/lib/guard.ts", null],
  ["lcov, file measured but never exercised", "cov.info", LCOV, "src/lib/dead.ts", /measured but|0 covered/i],
  ["lcov, file never measured", "cov.info", LCOV, "src/lib/absent.ts", /no record|absent/i],
  ["Cobertura, file exercised", "cov.xml", COBERTURA, "src/guard.ts", null],
  ["Cobertura, file measured but never exercised", "cov.xml", COBERTURA, "src/dead.ts", /measured but|0 covered/i],
];

for (const [name, file, body, symbol, expected] of CASES) {
  test(`the gate routes and acts on: ${name}`, () => {
    const found = problems(file, body, symbol);
    if (expected === null) {
      assert.deepEqual(found, [],
        `this state is honest evidence and must pass silently — got: ${JSON.stringify(found)}`);
    } else {
      assert.equal(found.length, 1,
        `exactly one violation expected for this state — got ${found.length}: ${JSON.stringify(found)}`);
      assert.match(found[0], expected,
        "the violation must name the failure CLASS the adapter detected, not merely exist");
    }
  });
}

test("a report is recognised by its shape, never by its file name", () => {
  // ADR-0056's mechanism: routing on the extension would let anyone rename a file to defeat or to
  // invoke an adapter. The same SARIF body under three names must route identically.
  const findings = [];
  for (const name of ["scan.json", "results.sarif", "anything.txt"]) {
    findings.push(problems(name, SARIF_FINDINGS, "no-hardcoded-secrets").length);
  }
  assert.deepEqual(findings, [1, 1, 1], "the name changed nothing; only the content decides");
});

test("an ordinary source file still routes to the symbol check, not to an adapter", () => {
  // The router's default branch. A mutant that made every file look like a tool report would take
  // the whole typed-pointer layer with it, and no adapter case above would notice.
  assert.deepEqual(problems("guard.ts", "export function assertGrounded() {}\n", "assertGrounded"), []);
  assert.equal(problems("guard.ts", "export function assertGrounded() {}\n", "notInThere").length, 1,
    "an ordinary file with a missing symbol is still a violation");
});
