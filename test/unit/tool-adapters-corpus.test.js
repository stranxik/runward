// The committed-tool adapters, over a corpus of documents real tools actually emit.
//
// These six adapters are the surface a third party's evidence lands on: the gate reads a JUnit
// report, a SARIF scan, an LCOV or Cobertura coverage file, an ESLint report, a CycloneDX SBOM, and
// turns each into a verdict a rule row depends on. A wrong verdict here is the worst failure the
// gate has, because it is a SILENT one: a red scan read as `clean`, an uncovered file read as
// `covered`, a failed test case read as `pass`. The mission-level tests cannot see it — they assert
// what the gate does with a verdict, never how the verdict was reached.
//
// Measured on 2026-08-28: 155 mutants of `tool-adapters.js` survived the whole suite, and 141 of
// them changed an adapter's answer on a document a real tool emits. Named cases from that campaign,
// each one now in the corpus below:
//
//   · a SARIF result addressed by `rule.index` instead of `ruleId` — an error-level finding read
//     as `clean`, because the only index-addressed result the suite had was note-level;
//   · a truncated JUnit report whose last case ends mid-`<failure` — read as `pass`;
//   · a lost `isSarifReport` recognition — the pointer falls through to the generic substring check
//     and reads GREEN precisely because the rule id appears in the log, which it does because the
//     rule FIRED (the first-match class the JUnit homonym fix already killed once);
//   · an LCOV suffix match without a segment boundary — `guard.ts` satisfied by `xguard.ts`;
//   · hits leaking past `end_of_record` — a dead file credited with the next file's coverage.
//
// Two instruments, because they fail differently. The TRANSCRIPT is a byte golden over the whole
// corpus: it needs no expected value written by hand, so it cannot be wrong about what the adapters
// do, and it reds on any answer that moves. The INVARIANTS below it are written out, few, and they
// name the property in their failure message, so the graver classes fail legibly rather than as
// "line 812 differs". Neither replaces the other: the golden has the breadth, the invariants say
// what must never happen.
//
// Regenerate the golden deliberately, after reading the diff:
//   UPDATE_GOLDEN=1 node --test test/unit/tool-adapters-corpus.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as A from "../../dist/lib/tool-adapters.js";
import { symbolPresent } from "../../dist/lib/evidence.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GOLDEN = join(ROOT, "test", "fixtures", "golden", "tool-adapters-transcript.txt");

// ── SARIF ────────────────────────────────────────────────────────────────────────────────────────
const SARIF_OBJ = {
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  version: "2.1.0",
  runs: [{
    tool: { driver: { name: "scanner", rules: [
      { id: "no-hardcoded-secrets", defaultConfiguration: { level: "error" } },
      { id: "pinned-actions" },
      { id: "style-note", defaultConfiguration: { level: "note" } },
      { id: "warn-default", defaultConfiguration: { level: "warning" } },
      { id: "none-default", defaultConfiguration: { level: "none" } },
    ] } },
    results: [
      { ruleId: "no-hardcoded-secrets", level: "error", message: { text: "AWS key in src/x.ts" } },
      { rule: { index: 2 }, message: { text: "informational only" } },
      { ruleId: "warn-default", message: { text: "no explicit level" } },
      { ruleId: "none-default", message: { text: "suppressed-ish" } },
      { ruleId: "unknown-rule", level: "warning", message: { text: "fired but not declared" } },
    ],
  }],
};
const spaced = (s) => s.replace(/"([^"]+)": /g, '"$1" : ');
const pretty = JSON.stringify(SARIF_OBJ, null, 2);
const drop = (k) => { const o = JSON.parse(JSON.stringify(SARIF_OBJ)); delete o[k]; return JSON.stringify(o, null, 2); };

// The three stamp spellings a JSON writer emits, each on a log that RECORDS a finding: what a lost
// recognition costs is measured by routing these, not by asserting the regex.
const FINDING_RUN = '"runs":[{"tool":{"driver":{"rules":[{"id":"no-hardcoded-secrets","defaultConfiguration":{"level":"error"}},{"id":"pinned-actions"}]}},"results":[{"ruleId":"no-hardcoded-secrets","level":"error","message":{"text":"AWS key"}}]}]';
const STAMP = '"$schema":"https://json.schemastore.org/sarif-2.1.0.json","version":"2.1.0",';

const SARIF = {
  compact: JSON.stringify(SARIF_OBJ),
  pretty,
  spacedColon: spaced(pretty),
  noVersion: drop("version"),
  noSchema: drop("$schema"),
  version20: pretty.replace('"2.1.0"', '"2.0.0"'),
  schemaUpper: pretty.replace("sarif-2.1.0.json", "SARIF-2.1.0.json"),
  stampOnlyNoRuns: JSON.stringify({ $schema: SARIF_OBJ.$schema, version: "2.1.0", results: [] }, null, 2),
  runsOnlyNoStamp: '{"tool":"custom","runs":[{"name":"nightly"}]}',
  notSarifJson: '{"version":"1.0","data":[]}',
  packageLock: '{\n  "name": "app",\n  "lockfileVersion": 3,\n  "packages": {\n    "node_modules/left-pad": {\n      "version": "2.1.4"\n    }\n  }\n}',
  truncated: pretty.slice(0, 420),
  emptyRuns: JSON.stringify({ $schema: SARIF_OBJ.$schema, version: "2.1.0", runs: [] }),
  badJson: "{ not json",
  jsonNull: "null",
  jsonNumber: "42",
  jsonArray: '[{"runs":[]}]',
  // degenerate but stamped: hand-edited, merged or partially written scans
  runsNull: `{${STAMP}"runs":null}`,
  runsObject: `{${STAMP}"runs":{"a":1}}`,
  runNull: `{${STAMP}"runs":[null]}`,
  runEmpty: `{${STAMP}"runs":[{}]}`,
  toolEmpty: `{${STAMP}"runs":[{"tool":{}}]}`,
  driverEmpty: `{${STAMP}"runs":[{"tool":{"driver":{}}}]}`,
  rulesObject: `{${STAMP}"runs":[{"tool":{"driver":{"rules":{}}}}]}`,
  rulesWithNull: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[null,{"id":"pinned-actions"}]}}}]}`,
  resultsNull: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"pinned-actions"}]}},"results":null}]}`,
  resultsWithNull: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"pinned-actions"}]}},"results":[null]}]}`,
  resNoRuleId: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"pinned-actions"}]}},"results":[{"message":{"text":"x"}}]}]}`,
  resRuleEmpty: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"pinned-actions"}]}},"results":[{"rule":{}}]}]}`,
  resIndexError: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"pinned-actions"}]}},"results":[{"rule":{"index":0},"level":"error"}]}]}`,
  resIndexOutOfRange: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"pinned-actions"}]}},"results":[{"rule":{"index":9}}]}]}`,
  resIndexNoRules: `{${STAMP}"runs":[{"results":[{"rule":{"index":0}}]}]}`,
  twoRunsSecondFires: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"pinned-actions"}]}},"results":[]},{"tool":{"driver":{"rules":[{"id":"pinned-actions"}]}},"results":[{"ruleId":"pinned-actions","level":"error"}]}]}`,
  levelNote: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"r1"}]}},"results":[{"ruleId":"r1","level":"note"}]}]}`,
  levelNone: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"r1"}]}},"results":[{"ruleId":"r1","level":"none"}]}]}`,
  levelEmpty: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"r1"}]}},"results":[{"ruleId":"r1","level":""}]}]}`,
  levelMissingNoDefault: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"r1"}]}},"results":[{"ruleId":"r1"}]}]}`,
  levelMissingDefaultNote: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"r1","defaultConfiguration":{"level":"note"}}]}},"results":[{"ruleId":"r1"}]}]}`,
  levelMissingDefaultNone: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"r1","defaultConfiguration":{"level":"none"}}]}},"results":[{"ruleId":"r1"}]}]}`,
  defaultConfigNull: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"r1","defaultConfiguration":null}]}},"results":[{"ruleId":"r1"}]}]}`,
  undeclaredRuleFires: `{${STAMP}"runs":[{"tool":{"driver":{"rules":[]}},"results":[{"ruleId":"r1"}]}]}`,
  // one stamp only, in each spelling, over a log that records a finding
  schemaOnlyCompact: `{"$schema":"${SARIF_OBJ.$schema}",${FINDING_RUN}}`,
  schemaOnlySpaceAfter: `{"$schema": "${SARIF_OBJ.$schema}", ${FINDING_RUN}}`,
  schemaOnlySpaceBoth: `{"$schema" : "${SARIF_OBJ.$schema}", ${FINDING_RUN}}`,
  versionOnlyCompact: `{"version":"2.1.0",${FINDING_RUN}}`,
  versionOnlySpaceAfter: `{"version": "2.1.0", ${FINDING_RUN}}`,
  versionOnlySpaceBoth: `{"version" : "2.1.0", ${FINDING_RUN}}`,
};
const RULE_IDS = ["pinned-actions", "no-hardcoded-secrets", "style-note", "warn-default",
  "none-default", "unknown-rule", "r1", "", "toString"];

// ── JUnit ────────────────────────────────────────────────────────────────────────────────────────
const JUNIT = {
  basic: '<testsuite><testcase name="ok"/><testcase name="body"></testcase>' +
    '<testcase name="bad"><failure>x</failure></testcase><testcase name="err"><error/></testcase>' +
    '<testcase name="skip"><skipped/></testcase></testsuite>',
  homonymShortClass: '<testsuite><testcase name="t" classname="A"/><testcase name="t" classname="B"><failure>x</failure></testcase></testsuite>',
  homonymRealClass: '<testsuite name="unit"><testcase name="shouldRefuse" classname="com.example.GuardTest" time="0.01"/>' +
    '<testcase name="shouldRefuse" classname="com.example.LegacyGuardTest"><failure message="boom">stack</failure></testcase></testsuite>',
  realGreen: '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites><testsuite name="GuardTest" tests="2">' +
    '<testcase classname="com.example.GuardTest" name="portsAreTyped" time="0.004"/>' +
    '<testcase classname="com.example.GuardTest" name="failsClosed" time="0.002"></testcase></testsuite></testsuites>',
  attrUpper: '<testsuite><TESTCASE NAME="t" CLASSNAME="com.example.GuardTest"/></testsuite>',
  classCaseDiff: '<testsuite><testcase name="t" classname="Com.Example.GuardTest"/></testsuite>',
  singleQuotes: "<testsuite><testcase name='t' classname='com.example.GuardTest'/></testsuite>",
  spacedAttr: '<testsuite><testcase name = "t" classname = "com.example.GuardTest" /></testsuite>',
  metaDot: '<testsuite><testcase name="Guard.checksFloor" classname="suite"/></testsuite>',
  metaDotFail: '<testsuite><testcase name="Guard.checksFloor" classname="suite"><failure>x</failure></testcase></testsuite>',
  metaBracket: '<testsuite><testcase name="test_add[1+2]" classname="suite"><failure/></testcase></testsuite>',
  metaParens: '<testsuite><testcase name="checks the floor (fast)" classname="suite"/></testsuite>',
  truncOpenOnly: '<testsuite><testcase name="alpha"/><testcase name="beta">',
  truncFailurePartial: '<testsuite><testcase name="alpha"/><testcase name="beta"><failure',
  truncFailureFull: '<testsuite><testcase name="alpha"/><testcase name="beta"><failure>',
  truncAfterEarlierFailure: '<testsuite><testcase name="alpha"><failure>boom</failure></testcase><testcase name="beta">',
  truncFailureMsg: '<testsuite><testcase name="alpha"/><testcase name="beta"><failure message="assert',
  nestedSuites: '<testsuites><testsuite name="a"><testcase name="t" classname="A"/></testsuite>' +
    '<testsuite name="b"><testcase name="t" classname="B"><skipped/></testcase></testsuite></testsuites>',
  noClose: '<testcase name="lone">',
  prefixName: '<testsuite><testcase name="okLonger"/></testsuite>',
};
const JUNIT_QUERIES = ["ok", "body", "bad", "err", "skip", "missing", "t", "A::t", "B::t",
  "com.example.GuardTest::shouldRefuse", "com.example.LegacyGuardTest::shouldRefuse",
  "com.example.GuardTest::t", "Com.Example.GuardTest::t", "suite::Guard.checksFloor",
  "Guard.checksFloor", "test_add[1+2]", "checks the floor (fast)", "portsAreTyped",
  "alpha", "beta", "lone", "okLonger"];

// ── LCOV ─────────────────────────────────────────────────────────────────────────────────────────
const lines = (...xs) => xs.join("\n") + "\n";
const LCOV = {
  basic: lines("TN:", "SF:/home/runner/work/repo/src/lib/guard.ts", "DA:1,4", "DA:2,0", "LF:2", "LH:1", "end_of_record",
    "TN:", "SF:/home/runner/work/repo/src/lib/dead.ts", "DA:1,0", "DA:2,0", "LF:2", "LH:0", "end_of_record",
    "TN:", "SF:src/lib/relative.ts", "DA:1,7", "LF:1", "LH:1", "end_of_record"),
  fullRecord: lines("TN:unit", "SF:/repo/src/lib/full.ts", "FN:3,doThing", "FNDA:5,doThing", "FNF:1", "FNH:1",
    "DA:3,5", "DA:4,5", "DA:5,0", "LF:3", "LH:2", "BRF:0", "BRH:0", "end_of_record"),
  summaryOnly: lines("TN:", "SF:src/summary.ts", "LF:10", "LH:7", "end_of_record"),
  summaryDead: lines("TN:", "SF:src/sumdead.ts", "LF:10", "LH:0", "end_of_record"),
  daOnly: lines("SF:src/x.ts", "DA:1,3", "DA:2,0", "end_of_record"),
  daOnlyDead: lines("SF:src/y.ts", "DA:1,0", "end_of_record"),
  leakDeadThenAlive: lines("SF:src/lib/dead2.ts", "DA:1,0", "LF:1", "LH:0", "end_of_record",
    "SF:src/lib/alive.ts", "DA:1,9", "LF:1", "LH:1", "end_of_record"),
  trailingAfterTerminator: lines("SF:src/t.ts", "DA:1,0", "LF:1", "LH:0", "end_of_record", "DA:1,99", "LH:42"),
  leadingBeforeFirstSF: lines("DA:1,99", "LH:42", "SF:src/l.ts", "DA:1,0", "LF:1", "LH:0", "end_of_record"),
  crlf: lines("SF:src/crlf.ts", "DA:1,4", "LF:1", "LH:1", "end_of_record").split("\n").join("\r\n"),
  indented: lines("  SF:src/ind.ts", "  DA:1,4", "  LF:1", "  LH:1", "  end_of_record"),
  sfSpaced: lines("SF: src/space.ts", "DA:1,4", "LF:1", "LH:1", "end_of_record"),
  windowsPath: lines("SF:C:\\build\\repo\\src\\lib\\win.ts", "DA:1,4", "LF:1", "LH:1", "end_of_record"),
  blankLineInside: lines("SF:src/b.ts", "", "DA:1,4", "", "LF:1", "LH:1", "end_of_record"),
  noTerminator: lines("SF:src/n.ts", "DA:1,4", "LF:1", "LH:1"),
  suffixTrap: lines("SF:src/lib/xguard.ts", "DA:1,9", "LF:1", "LH:1", "end_of_record"),
  dotSlashPrefix: lines("SF:./src/dot.ts", "DA:1,4", "LF:1", "LH:1", "end_of_record"),
  dotMidPath: lines("SF:src/a./b.ts", "DA:1,4", "LF:1", "LH:1", "end_of_record"),
  upDir: lines("SF:/repo/pkg/../lib/up.ts", "DA:1,4", "LF:1", "LH:1", "end_of_record"),
  daChecksum: lines("SF:src/ck.ts", "DA:1,4,uT/9zH", "DA:2,0,aB3", "end_of_record"),
  terminatorTrailingWs: lines("SF:src/e.ts", "DA:1,0", "end_of_record   ", "SF:src/other.ts", "DA:1,9", "end_of_record"),
  lhNotNumeric: lines("SF:src/nan.ts", "LH:abc", "DA:1,5", "end_of_record"),
  strayEndOfRecordInProse: lines("a note about end_of_record", "and SF: mid-line", "end_of_record"),
};
const LCOV_PATHS = ["src/lib/guard.ts", "guard.ts", "uard.ts", "src/lib/dead.ts", "src/lib/relative.ts",
  "src/lib/full.ts", "src/summary.ts", "src/sumdead.ts", "src/x.ts", "src/y.ts", "src/lib/dead2.ts",
  "src/lib/alive.ts", "src/t.ts", "src/l.ts", "src/crlf.ts", "src/ind.ts", "src/space.ts",
  "src/lib/win.ts", "src\\lib\\win.ts", "src/b.ts", "src/n.ts", "./src/dot.ts", "src/dot.ts",
  "src/a./b.ts", "../lib/up.ts", "src/ck.ts", "src/e.ts", "src/other.ts", "src/nan.ts", "src/missing.ts"];

// ── Cobertura ────────────────────────────────────────────────────────────────────────────────────
const COBERTURA = {
  basic: '<?xml version="1.0"?><coverage line-rate="0.5" version="1.9">' +
    '<packages><package name="src"><classes>' +
    '<class name="guard" filename="src/guard.ts" line-rate="1"><lines><line number="1" hits="4"/></lines></class>' +
    '<class name="dead" filename="src/dead.ts" line-rate="0"><lines><line number="1" hits="0"/></lines></class>' +
    "</classes></package></packages></coverage>",
  rateOnly: '<coverage line-rate="0.5"><class filename="src/rateonly.ts" line-rate="0.5"></class></coverage>',
  rateZero: '<coverage line-rate="0"><class filename="src/ratezero.ts" line-rate="0"></class></coverage>',
  rateOne: '<coverage line-rate="1"><class filename="src/rateone.ts" line-rate="1"></class></coverage>',
  hitsOnlyNoRate: '<coverage line-rate="0.5"><class filename="src/hitsonly.ts"><lines><line number="1" hits="4"/></lines></class></coverage>',
  hitsTwoDigits: '<coverage line-rate="0.5"><class filename="src/twodigit.ts"><lines><line number="1" hits="12"/></lines></class></coverage>',
  hitsZero: '<coverage line-rate="0.5"><class filename="src/hitszero.ts"><lines><line number="1" hits="0"/></lines></class></coverage>',
  selfClosedThenLive: '<coverage line-rate="0.5"><class filename="src/selfclosed.ts"/>' +
    '<class filename="src/live.ts"><lines><line number="1" hits="7"/></lines></class></coverage>',
  spacedAttrs: '<coverage line-rate = "0.5"><class filename = "src/ws.ts" line-rate = "1"></class></coverage>',
  singleQuotes: "<coverage line-rate='0.5'><class filename='src/sq.ts' line-rate='1'></class></coverage>",
  attrsAfterOthers: '<coverage version="1.9" timestamp="1700000000" line-rate="0.5">' +
    '<class filename="src/late.ts" line-rate="1"></class></coverage>',
  truncated: '<coverage line-rate="0.5"><class filename="src/dead3.ts" line-rate="0"></class>' +
    '<class filename="src/trunc.ts"><lines><line number="1" hits="9"',
  windowsPath: '<coverage line-rate="1"><class filename="src\\lib\\cwin.ts" line-rate="1"></class></coverage>',
  absolutePath: '<coverage line-rate="1"><class filename="/home/runner/work/repo/src/deep.ts" line-rate="1"></class></coverage>',
  suffixTrap: '<coverage line-rate="1"><class filename="/src/guard.ts.orig" line-rate="1"></class></coverage>',
  // Ends with the wanted path, on NO segment boundary: `xguard.ts` must not vouch for `guard.ts`.
  suffixNoBoundary: '<coverage line-rate="1"><class filename="src/lib/xguard.ts" line-rate="1"></class></coverage>',
  noClassRecord: '<coverage line-rate="0.5"></coverage>',
  notCoverageXml: '<project><class filename="src/other.ts"/></project>',
};
const COBERTURA_PATHS = ["src/guard.ts", "src/dead.ts", "src/rateonly.ts", "src/ratezero.ts",
  "src/rateone.ts", "src/hitsonly.ts", "src/twodigit.ts", "src/hitszero.ts", "src/selfclosed.ts",
  "src/live.ts", "src/ws.ts", "src/sq.ts", "src/late.ts", "src/dead3.ts", "src/trunc.ts",
  "src/lib/cwin.ts", "src/deep.ts", "src/other.ts", "src/missing.ts", "guard.ts", "uard.ts"];

// ── ESLint ───────────────────────────────────────────────────────────────────────────────────────
const j = JSON.stringify;
const ESLINT = {
  basic: j([{ filePath: "/repo/src/clean.ts", messages: [{ ruleId: "style", severity: 1 }], errorCount: 0, warningCount: 1 },
    { filePath: "/repo/src/broken.ts", messages: [{ ruleId: "no-undef", severity: 2 }], errorCount: 1, warningCount: 0 }]),
  noCounts: j([{ filePath: "/repo/src/warnonly.ts", messages: [{ severity: 1 }, { severity: 1 }] },
    { filePath: "/repo/src/err.ts", messages: [{ severity: 2 }] },
    { filePath: "/repo/src/mixed.ts", messages: [{ severity: 1 }, { severity: 2 }, { severity: 1 }] },
    { filePath: "/repo/src/none.ts", messages: [] }]),
  countOnly: j([{ filePath: "/repo/src/countonly.ts", errorCount: 3, messages: [] }]),
  countDisagrees: j([{ filePath: "/repo/src/disagree.ts", errorCount: 0, messages: [{ severity: 2 }] }]),
  countAsString: j([{ filePath: "/repo/src/strcount.ts", errorCount: "1", messages: [{ severity: 1 }] }]),
  nullEntry: j([null, { filePath: "src/a.ts", errorCount: 0, messages: [] }]),
  noFilePath: j([{ messages: [], errorCount: 0 }, { filePath: "src/b.ts", errorCount: 0, messages: [] }]),
  nullMessage: j([{ filePath: "/repo/src/nullmsg.ts", messages: [null, { severity: 2 }] }]),
  messagesNotArray: j([{ filePath: "/repo/src/notarr.ts", messages: { severity: 2 } }]),
  noMessages: j([{ filePath: "/repo/src/nomsg.ts" }]),
  suffixTrap: j([{ filePath: "/repo/src/lib/xx.ts", errorCount: 0, messages: [] }]),
  suffixNoBoundary: j([{ filePath: "/repo/src/lib/xclean.ts", errorCount: 0, messages: [] }]),
  windowsPath: j([{ filePath: "C:\\repo\\src\\win.ts", errorCount: 0, messages: [] }]),
  dotSegment: j([{ filePath: "/repo/src/./lib/dot.ts", errorCount: 0, messages: [] }]),
  duplicateCleanThenDirty: j([{ filePath: "/a/src/dup.ts", errorCount: 0, messages: [] },
    { filePath: "/b/src/dup.ts", errorCount: 2, messages: [{ severity: 2 }, { severity: 2 }] }]),
  notEslint: j({ results: [] }),
  // A JSON OBJECT carrying both marker keys: the shape the recognition guard exists to refuse.
  objectWithMarkers: '{"filePath":"a","messages":[]}',
  leadingWhitespace: "  \n\t" + j([{ filePath: "/repo/src/lead.ts", errorCount: 0, messages: [] }]),
  prettyPrinted: j([{ filePath: "/repo/src/pretty.ts", errorCount: 0, messages: [] }], null, 2),
  exactPath: j([{ filePath: "src/exact.ts", errorCount: 0, messages: [] }]),
  emptyArray: "[]",
  badJson: "[{",
};
const ESLINT_PATHS = ["src/clean.ts", "src/broken.ts", "src/warnonly.ts", "src/err.ts", "src/mixed.ts",
  "src/none.ts", "src/countonly.ts", "src/disagree.ts", "src/strcount.ts", "src/a.ts", "src/b.ts",
  "src/nullmsg.ts", "src/notarr.ts", "src/nomsg.ts", "xx.ts", "src/win.ts", "src/lib/dot.ts",
  "src/dup.ts", "src/missing.ts", "clean.ts", "lean.ts", "src/lead.ts", "src/pretty.ts",
  "src/exact.ts", "./src/exact.ts", "src\\win.ts"];

// ── CycloneDX ────────────────────────────────────────────────────────────────────────────────────
const SBOM = {
  basic: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [
    { name: "left-pad", version: "1.3.0", purl: "pkg:npm/left-pad@1.3.0" },
    { name: "lodash", version: "4.17.21", purl: "pkg:npm/lodash@4.17.21" }] }),
  twoMatching: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [
    { name: "dup", version: "1.0.0", purl: "pkg:npm/dup@1.0.0" },
    { name: "dup", version: "2.0.0", purl: "pkg:npm/dup@2.0.0" }] }),
  noComponents: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [] }),
  componentsMissing: j({ bomFormat: "CycloneDX", specVersion: "1.5" }),
  nullComponent: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [null, { name: "ok", version: "1.0.0" }] }),
  noPurl: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [{ name: "nopurl", version: "9.9.9" }] }),
  notCycloneDx: j({ components: [{ name: "left-pad" }] }),
  spdxWithComponents: j({ bomFormat: "SPDX", components: [{ name: "left-pad", version: "1.3.0" }] }),
  prettyPrinted: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [{ name: "pretty", version: "1.0.0" }] }, null, 2),
  // Non-string name/version: stringifying them is how a component NOBODY declared reads as present.
  numericVersion: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [{ name: "widget", version: 2 }] }),
  numericName: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [{ name: 42, version: "1.0.0" }] }),
  versionOnly: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [{ version: "1.0.0" }] }),
  nameOnly: j({ bomFormat: "CycloneDX", specVersion: "1.5", components: [{ name: "solo" }] }),
  badJson: "{ nope",
};
const SBOM_IDS = ["left-pad", "pkg:npm/left-pad@1.3.0", "lodash", "dup", "pkg:npm/dup@1.0.0",
  "nopurl", "ok", "missing", "", "widget@2", "42@1.0.0", "undefined@1.0.0", "solo@undefined",
  "pretty@1.0.0", "  left-pad  ", " pkg:npm/left-pad@1.3.0 "];

// ── the transcript ───────────────────────────────────────────────────────────────────────────────
/** Mirrors how evidence.ts picks an adapter for a `#symbol` pointer, including the fall-through. */
function route(content, symbol) {
  if (A.isSarifReport(content)) return "sarif:" + A.sarifRuleResult(content, symbol);
  if (A.isEslintReport(content)) return "eslint:" + A.eslintFileResult(content, symbol);
  if (A.isCycloneDxSbom(content)) return "sbom:" + A.sbomComponentPresent(content, symbol);
  if (A.isLcovReport(content)) return "lcov:" + A.lcovFileResult(content, symbol);
  if (A.isCoberturaReport(content)) return "cobertura:" + A.coberturaFileResult(content, symbol);
  return "substring:" + (symbolPresent(content, symbol) ? "GREEN" : "red");
}

function transcript() {
  const out = [];
  const rec = (key, fn) => {
    let v;
    try { v = JSON.stringify(fn()); } catch (e) { v = `THREW:${e?.constructor?.name}`; }
    out.push(`${key} => ${v}`);
  };
  const sweep = (label, docs, queries, sniff, resolve) => {
    for (const [k, doc] of Object.entries(docs)) {
      rec(`${label}.recognised[${k}]`, () => sniff(doc));
      for (const q of queries) rec(`${label}[${k}|${q}]`, () => resolve(doc, q));
    }
  };
  sweep("sarif", SARIF, RULE_IDS, A.isSarifReport, A.sarifRuleResult);
  sweep("junit", JUNIT, JUNIT_QUERIES, A.isJUnitReport, A.junitTestResult);
  sweep("lcov", LCOV, LCOV_PATHS, A.isLcovReport, A.lcovFileResult);
  sweep("cobertura", COBERTURA, COBERTURA_PATHS, A.isCoberturaReport, A.coberturaFileResult);
  sweep("eslint", ESLINT, ESLINT_PATHS, A.isEslintReport, A.eslintFileResult);
  sweep("sbom", SBOM, SBOM_IDS, A.isCycloneDxSbom, A.sbomComponentPresent);

  // Routing: what a document resolves to once the adapter has been CHOSEN. A recognition that is
  // lost here does not merely answer differently, it hands the pointer to the substring check.
  const routed = { ...SARIF, ...LCOV, ...COBERTURA, ...ESLINT, ...SBOM, junitBasic: JUNIT.basic };
  for (const [k, doc] of Object.entries(routed)) {
    for (const q of ["no-hardcoded-secrets", "pinned-actions", "src/lib/guard.ts", "src/broken.ts", "left-pad"]) {
      rec(`route[${k}|${q}]`, () => route(doc, q));
    }
  }
  return out.join("\n") + "\n";
}

test("the adapter corpus is byte-identical to the golden transcript", () => {
  const got = transcript();
  if (process.env.UPDATE_GOLDEN === "1") { writeFileSync(GOLDEN, got); return; }
  const want = readFileSync(GOLDEN, "utf8");
  if (got !== want) {
    const g = got.split("\n"), w = want.split("\n");
    const first = g.findIndex((l, i) => l !== w[i]);
    assert.fail(`the adapters answer differently than the golden records.\n` +
      `  first difference at line ${first + 1}\n    golden: ${w[first]}\n    now:    ${g[first]}\n` +
      `  ${g.filter((l, i) => l !== w[i]).length} line(s) differ in total.\n` +
      `  If the new answers are the intended ones, regenerate with ` +
      `UPDATE_GOLDEN=1 node --test test/unit/tool-adapters-corpus.test.js and read the diff.`);
  }
});

// ── the invariants, written out ──────────────────────────────────────────────────────────────────
// Each one is a false green the campaign measured a mutant producing. They are stated here rather
// than left to the golden so that the failure names the property instead of a line number.

test("a SARIF finding addressed by rule.index is a finding, not a clean scan", () => {
  const log = `{${STAMP}"runs":[{"tool":{"driver":{"rules":[{"id":"pinned-actions"}]}},` +
    '"results":[{"rule":{"index":0},"level":"error"}]}]}';
  assert.equal(A.sarifRuleResult(log, "pinned-actions"), "findings",
    "a result that names its rule by index instead of by ruleId still names it — reading it as " +
    "`clean` turns a red scan into evidence");
});

test("a truncated JUnit report does not turn a failing case into a passing one", () => {
  for (const [k, doc] of Object.entries({
    partial: JUNIT.truncFailurePartial, full: JUNIT.truncFailureFull, msg: JUNIT.truncFailureMsg,
  })) {
    assert.notEqual(A.junitTestResult(doc, "beta"), "pass",
      `${k}: a case cut off mid-<failure must never read as pass — the report does not record it green`);
  }
});

test("a JUnit case does not inherit another case's failure", () => {
  assert.equal(A.junitTestResult(JUNIT.truncAfterEarlierFailure, "beta"), "pass",
    "the failure belongs to alpha; beta must not be reddened by its neighbour");
  assert.equal(A.junitTestResult(JUNIT.homonymRealClass, "com.example.GuardTest::shouldRefuse"), "pass");
  assert.equal(A.junitTestResult(JUNIT.homonymRealClass, "com.example.LegacyGuardTest::shouldRefuse"), "fail",
    "class-qualified pinning must reach the right homonym, whatever the class name's length");
});

test("a test name containing regex metacharacters is matched literally", () => {
  assert.equal(A.junitTestResult(JUNIT.metaDot, "suite::Guard.checksFloor"), "pass");
  assert.equal(A.junitTestResult(JUNIT.metaDotFail, "suite::Guard.checksFloor"), "fail");
  assert.equal(A.junitTestResult(JUNIT.metaBracket, "suite::test_add[1+2]"), "fail",
    "pytest-style parameterised names carry brackets, and they are data, not a character class");
  assert.equal(A.junitTestResult(JUNIT.metaParens, "suite::checks the floor (fast)"), "pass");
});

test("a coverage pointer matches on a path segment boundary, never on a bare substring", () => {
  assert.equal(A.lcovFileResult(LCOV.suffixTrap, "guard.ts"), "absent",
    "a report that measures only src/lib/xguard.ts does not vouch for guard.ts");
  assert.equal(A.lcovFileResult(LCOV.basic, "uard.ts"), "absent");
  assert.equal(A.coberturaFileResult(COBERTURA.suffixTrap, "src/guard.ts"), "absent",
    "src/guard.ts.orig is a different file — matching it would green the wrong one");
  assert.equal(A.coberturaFileResult(COBERTURA.suffixNoBoundary, "guard.ts"), "absent",
    "a report measuring src/lib/xguard.ts does not vouch for guard.ts");
  assert.equal(A.eslintFileResult(ESLINT.suffixNoBoundary, "clean.ts"), "absent",
    "the same boundary rule holds for the lint report: xclean.ts is not clean.ts");
});

test("coverage hits do not leak across a record boundary", () => {
  assert.equal(A.lcovFileResult(LCOV.leakDeadThenAlive, "src/lib/dead2.ts"), "uncovered",
    "the next record's hits belong to the next file");
  assert.equal(A.lcovFileResult(LCOV.trailingAfterTerminator, "src/t.ts"), "uncovered",
    "detail lines after end_of_record are not the closed record's");
  assert.equal(A.lcovFileResult(LCOV.leadingBeforeFirstSF, "src/l.ts"), "uncovered",
    "detail lines before the first SF: belong to no record at all");
  assert.equal(A.coberturaFileResult(COBERTURA.selfClosedThenLive, "src/selfclosed.ts"), "uncovered",
    "a self-closing class record has no body — it must not borrow the next record's");
  assert.equal(A.coberturaFileResult(COBERTURA.truncated, "src/dead3.ts"), "uncovered");
});

test("an adapter returns a verdict rather than throwing on a degenerate document", () => {
  const VERDICTS = {
    sarif: ["clean", "findings", "absent", "unparseable"],
    lcov: ["covered", "uncovered", "absent"],
    cobertura: ["covered", "uncovered", "absent"],
    eslint: ["clean", "findings", "absent", "unparseable"],
    sbom: ["present", "absent", "ambiguous", "unparseable"],
  };
  const cases = [
    ...Object.entries(SARIF).map(([k, d]) => ["sarif", k, () => A.sarifRuleResult(d, "pinned-actions")]),
    ...Object.entries(LCOV).map(([k, d]) => ["lcov", k, () => A.lcovFileResult(d, "src/lib/guard.ts")]),
    ...Object.entries(COBERTURA).map(([k, d]) => ["cobertura", k, () => A.coberturaFileResult(d, "src/guard.ts")]),
    ...Object.entries(ESLINT).map(([k, d]) => ["eslint", k, () => A.eslintFileResult(d, "src/clean.ts")]),
    ...Object.entries(SBOM).map(([k, d]) => ["sbom", k, () => A.sbomComponentPresent(d, "left-pad")]),
  ];
  for (const [family, name, call] of cases) {
    let got;
    assert.doesNotThrow(() => { got = call(); },
      `${family}/${name}: a hand-edited, merged or truncated report must yield a verdict, not an ` +
      "exception — the gate has no handler for one, and a crash reads as a broken gate, not as " +
      "unusable evidence");
    assert.ok(VERDICTS[family].includes(got),
      `${family}/${name}: returned ${JSON.stringify(got)}, which is outside the declared contract ` +
      `${VERDICTS[family].join(" | ")}`);
  }
});

test("an SBOM that cannot say which component was meant refuses instead of guessing", () => {
  assert.equal(A.sbomComponentPresent(SBOM.twoMatching, "dup"), "ambiguous",
    "two versions of one name is exactly the case where a `present` would be a guess");
  assert.equal(A.sbomComponentPresent(SBOM.twoMatching, "pkg:npm/dup@1.0.0"), "present",
    "the purl disambiguates, so the same document answers precisely once asked precisely");
});

test("an SBOM component is present only if it DECLARES the identity, as text", () => {
  assert.equal(A.sbomComponentPresent(SBOM.numericVersion, "widget@2"), "absent",
    "a numeric version stringified into the identity would make a component nobody declared read " +
    "as present — the worst verdict this adapter can give");
  assert.equal(A.sbomComponentPresent(SBOM.numericName, "42@1.0.0"), "absent");
  assert.equal(A.sbomComponentPresent(SBOM.versionOnly, "undefined@1.0.0"), "absent",
    "a component with no name declares no identity, and `undefined` is not one");
  assert.equal(A.sbomComponentPresent(SBOM.nameOnly, "solo@undefined"), "absent");
});

test("a pointer is read past its whitespace, and a marker past its spacing", () => {
  assert.equal(A.sbomComponentPresent(SBOM.basic, "  pkg:npm/left-pad@1.3.0  "), "present",
    "a pointer written with padding names the same component");
  assert.equal(A.isCycloneDxSbom(SBOM.prettyPrinted), true,
    "an SBOM emitted with two-space indentation is still an SBOM");
  assert.equal(A.isEslintReport(ESLINT.prettyPrinted), true);
  assert.equal(A.isEslintReport(ESLINT.leadingWhitespace), true,
    "a report written with a leading newline is still a report");
});

test("half a report, or the right keys in the wrong container, is not a report", () => {
  assert.equal(A.isEslintReport(ESLINT.objectWithMarkers), false,
    "a JSON object carrying filePath and messages is not an ESLint report — the report is an ARRAY, " +
    "and that discrimination is the whole job of the guard");
  assert.equal(A.isEslintReport("[]"), false, "an empty array carries no marker");
  assert.equal(A.isCycloneDxSbom(SBOM.spdxWithComponents), false,
    "an SPDX document has components too; routing it to the CycloneDX reader would be a guess");
});

test("recognition survives every spelling a JSON writer emits, so no stamped log falls through", () => {
  for (const k of ["schemaOnlyCompact", "schemaOnlySpaceAfter", "schemaOnlySpaceBoth",
    "versionOnlyCompact", "versionOnlySpaceAfter", "versionOnlySpaceBoth"]) {
    assert.equal(A.isSarifReport(SARIF[k]), true, `${k}: not recognised as SARIF`);
    assert.equal(route(SARIF[k], "no-hardcoded-secrets"), "sarif:findings",
      `${k}: a lost recognition sends the pointer to the substring check, which reads GREEN ` +
      "because the rule id is in the log — and it is in the log because the rule FIRED");
  }
});

test("a document that is not a report is not recognised as one", () => {
  assert.equal(A.isSarifReport(SARIF.packageLock), false,
    'a package-lock carrying "version": "2.1.4" is not a scan');
  assert.equal(A.isSarifReport(SARIF.runsOnlyNoStamp), false, "both markers are required, not either");
  assert.equal(A.isLcovReport(LCOV.strayEndOfRecordInProse), false,
    "prose mentioning end_of_record is not coverage");
  assert.equal(A.isCoberturaReport(COBERTURA.notCoverageXml), false);
  assert.equal(A.isCoberturaReport(COBERTURA.noClassRecord), false,
    "a coverage root with no class record measures nothing");
});
