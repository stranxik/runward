// The per-tool bench the spec-conformance campaign named (PR #188): tool-adapters.test.js proves
// each adapter answers correctly WHEN CALLED; nothing proved spec-check ROUTES a pointer to the
// right adapter and turns its answer into the verdict. Under the mutation net every
// tool-adjudication branch of pointerLinks was dead code: a red SARIF scan, an unlinted file, an
// uncovered lcov/cobertura file, an absent SBOM component and an unreadable report each became
// evidence under one mutant, exit 1 -> 0 measured through the real CLI. This file drives every
// rung THROUGH specConformance — same import the mutation net exercises — and asserts verdict AND
// the load-bearing fragment of the reason, because a reason is the remediation an operator runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { specConformance, specBundleConformance } from "../../dist/lib/spec-conformance.js";

const SARIF = (results) => JSON.stringify({
  version: "2.1.0",
  runs: [{ tool: { driver: { name: "s", rules: [{ id: "RW001", defaultConfiguration: { level: "error" } }] } }, results }],
});
const ESLINT = (messages) => JSON.stringify([
  { filePath: "/w/src/app.ts", messages, errorCount: messages.filter((m) => m.severity === 2).length },
]);
const SBOM = JSON.stringify({ bomFormat: "CycloneDX", specVersion: "1.5", components: [
  { type: "library", name: "lodash", version: "4.17.21", purl: "pkg:npm/lodash@4.17.21" },
] });
const LCOV = ["TN:", "SF:src/covered.ts", "DA:1,4", "LF:1", "LH:1", "end_of_record",
              "TN:", "SF:src/dead.ts", "DA:1,0", "LF:1", "LH:0", "end_of_record", ""].join("\n");
const COB = '<?xml version="1.0"?>\n<coverage line-rate="0.5" version="1.9"><packages><package name="a"><classes>' +
  '<class name="C" filename="src/covered.ts" line-rate="1.0"><lines><line number="1" hits="4"/></lines></class>' +
  '<class name="D" filename="src/dead.ts" line-rate="0.0"><lines><line number="1" hits="0"/></lines></class>' +
  "</classes></package></packages></coverage>\n";

function project() {
  const dir = mkdtempSync(join(tmpdir(), "rw-spectools-"));
  mkdirSync(join(dir, "r"), { recursive: true });
  mkdirSync(join(dir, "code", "adir"), { recursive: true });
  const w = (p, c) => writeFileSync(join(dir, p), c);
  w("r/sarif-red.sarif", SARIF([{ ruleId: "RW001", level: "error", message: { text: "boom" } }]));
  w("r/sarif-clean.sarif", SARIF([]));
  w("r/sarif-bad.sarif", '{"version":"2.1.0","runs":[{');
  w("r/eslint-red.json", ESLINT([{ ruleId: "no-undef", severity: 2 }]));
  w("r/eslint-clean.json", ESLINT([{ ruleId: "style", severity: 1 }]));
  w("r/eslint-bad.json", '[{"filePath":"/w/src/app.ts","messages":[');
  w("r/bom.json", SBOM);
  w("r/bom-bad.json", '{"bomFormat":"CycloneDX","components":[');
  w("r/lcov.info", LCOV);
  w("r/cobertura.xml", COB);
  w("code/present.ts", "export const ab = 1;\nexport function login() { return ab; }\n");
  w("code/empty.ts", "");
  w("code/blank.ts", " \n\t\n ");
  w("code/three.md", "l1\nl2\nl3");
  w("code/chars.md", "abcdefghij");
  return { dir, drop: () => rmSync(dir, { recursive: true, force: true }) };
}

const one = (dir, pointer) => {
  const r = specConformance(`# S\n\n## Acceptance Criteria\n\n- AC1 x ${pointer}\n`, dir);
  assert.equal(r.criteria.length, 1, `${pointer}: one criterion expected`);
  return r.criteria[0];
};

// ── the routing rungs: every adjudication branch of pointerLinks, verdict + reason fragment ──────
const RUNGS = [
  // SARIF (the registered false-green family: a red scan is not evidence)
  ["file:r/sarif-red.sarif#RW001", false, /red scan is not evidence/],
  ["file:r/sarif-clean.sarif#RW001", true, null],
  ["file:r/sarif-clean.sarif#NOPE9", false, /no rule "NOPE9" in the committed scan/],
  ["file:r/sarif-bad.sarif#RW001", false, /looks like SARIF but is not valid JSON/],
  // ESLint
  ["file:r/eslint-red.json#src/app.ts", false, /error-severity finding/],
  ["file:r/eslint-clean.json#src/app.ts", true, null],
  ["file:r/eslint-red.json#src/ghost.ts", false, /no record for "src\/ghost.ts" in the committed lint report/],
  ["file:r/eslint-bad.json#src/app.ts", false, /looks like an ESLint report but is not valid JSON/],
  // SBOM (refuse-rather-than-guess: a bare name names no version)
  ["file:r/bom.json#lodash@4.17.21", true, null],
  ["file:r/bom.json#pkg:npm/lodash@4.17.21", true, null],
  ["file:r/bom.json#lodash", false, /names no version/],
  ["file:r/bom.json#left-pad@1.3.0", false, /no component "left-pad@1.3.0" in the committed SBOM/],
  ["file:r/bom-bad.json#lodash@4.17.21", false, /components could not be read/],
  // lcov (a file nothing exercised is not evidence)
  ["file:r/lcov.info#src/covered.ts", true, null],
  ["file:r/lcov.info#src/dead.ts", false, /0 covered lines/],
  ["file:r/lcov.info#src/ghost.ts", false, /no record .* in the committed coverage report/],
  // cobertura, same three rungs
  ["file:r/cobertura.xml#src/covered.ts", true, null],
  ["file:r/cobertura.xml#src/dead.ts", false, /0 covered lines/],
  ["file:r/cobertura.xml#src/ghost.ts", false, /no record .* in the committed coverage report/],
];

test("spec-check routes every tool report and turns its answer into the verdict", () => {
  const p = project();
  try {
    for (const [ptr, linked, reason] of RUNGS) {
      const c = one(p.dir, ptr);
      assert.equal(c.linked, linked, `${ptr}: expected linked=${linked}, reason was: ${c.reason}`);
      if (reason) assert.match(c.reason, reason, `${ptr}: the remediation names the cause`);
    }
  } finally { p.drop(); }
});

// ── the entry guards: presence, emptiness, shape, depth — the RWD-2026-0003 vacuity side ─────────
const GUARDS = [
  ["file:code/empty.ts", false, /artifact is empty/],
  ["file:code/blank.ts", false, /artifact is empty/],          // whitespace is not content
  ["file:code/adir", false, /not a file/],                      // a directory is not an artifact
  ["file:code/nope.ts", false, /not present/],
  ["file:../outside.txt", false, /points outside the project tree/],
  ["file:code/present.ts#x", false, /names no usable symbol/],  // 1 char is tautological
  ["file:code/present.ts#ab", true, null],                      // 2 chars is the documented floor
  ["file:code/three.md:3", true, null],                         // N == line count links
  ["file:code/three.md:4", false, /fewer than 4 lines/],
  ["file:code/chars.md:5", false, /fewer than 5 lines/],        // lines, never characters
  ["test:code/present.ts::", false, /names no test/],           // an empty :: is a refusal, not a skip
  ['test:code/present.ts::"  "', false, /names no test/],
];

test("the entry guards refuse what is not evidence, and say why", () => {
  const p = project();
  try {
    for (const [ptr, linked, reason] of GUARDS) {
      const c = one(p.dir, ptr);
      assert.equal(c.linked, linked, `${ptr}: expected linked=${linked}, reason was: ${c.reason}`);
      if (reason) assert.match(c.reason, reason, `${ptr}: the remediation names the cause`);
    }
  } finally { p.drop(); }
});

// ── criteria grammar and the coherence check: what counts, where, and past nine ──────────────────
test("H1 sections, ordered items and indented sub-criteria are in the perimeter, with true lines", () => {
  const p = project();
  try {
    const r = specConformance([
      "# Acceptance criteria", "",
      "1. first file:code/present.ts#login",
      "10. tenth without pointer",
      "  - indented without pointer", "",
    ].join("\n"), p.dir);
    assert.equal(r.hasSection, true, "an H1 criteria heading opens the perimeter");
    assert.equal(r.criteria.length, 3, "ordered items (1., 10.) and an indented item all count");
    assert.deepEqual(r.criteria.map((c) => c.line), [3, 4, 5], "line numbers are the real ones");
    assert.equal(r.unlinked, 2);
    assert.match(r.criteria[1].reason, /no file:\/test: pointer/,
      "the commonest gap carries its remediation");
  } finally { p.drop(); }
});

test("an adr: pointer on a criterion line is a clean refusal, never a crash", () => {
  const p = project();
  try {
    const c = one(p.dir, "adr:0005");
    assert.equal(c.linked, false);
    assert.match(c.reason, /no file:\/test: pointer/,
      "runward's own citation spelling must not take the checker down");
  } finally { p.drop(); }
});

test("the coherence check reads multi-digit ids and reports every dangling occurrence", () => {
  const p = project();
  try {
    const files = [
      { path: "spec.md", content: "# S\n\n## Acceptance Criteria\n\n- AC1 ok file:code/present.ts#login\n" },
      { path: "tasks.md", content: "# T\n\ndo AC12 and AC12 again\ndo AC12 later\nthen FR9 too\n" },
    ];
    const r = specBundleConformance(files, p.dir);
    const ids = r.dangling.map((d) => `${d.file}:${d.line}:${d.id}`).sort();
    assert.deepEqual(ids, ["tasks.md:3:AC12", "tasks.md:4:AC12", "tasks.md:5:FR9"],
      "a two-digit id dangles (past nine criteria the check must still see), a same-line repeat " +
      "is deduped, distinct lines and distinct ids each get their finding");
  } finally { p.drop(); }
});

test("two failing pointers on one criterion keep their remediations separable", () => {
  const p = project();
  try {
    const c = one(p.dir, "file:code/nope.ts file:code/nope2.ts");
    assert.equal(c.linked, false);
    assert.match(c.reason, /not present · .*not present/,
      "the ' · ' separator is what keeps two remediations two actions");
  } finally { p.drop(); }
});
