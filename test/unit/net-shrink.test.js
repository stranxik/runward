// ADR-0090, M3: the net-shrink guard (scripts/net-shrink.mjs, .github/workflows/net-shrink.yml).
//
// What is pinned here: every shrink kind the guard names is detected on a synthetic diff (a positive
// control per kind), a pure addition passes, a rename paired by file and name is reported and does not
// escalate while an unpaired removal does, the fingerprint changes with the shrink, the
// acknowledgment needs the label from a non-delegate admin AND the body line with the fingerprint and
// every kind, the extractors are not blind on runward's own tree, and the workflow runs on
// pull_request_target with read-only permissions and never checks out the pull request's code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareNets, fingerprint, shrinkKinds, acknowledged, dirSnapshot, junitCases, declaredNames, relations, corpusIds,
  ledgerIds, runCounts, coverageFloors, wholenetModules, assertionCount, skipCount, propertyCount, similarity,
  ACK_LABEL, ACK_LINE, STAGE1_NOTE, JUNIT, CORPUS, LEDGER, RELATIONS, WHOLENET, STRYKER,
} from "../../scripts/net-shrink.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const junit = (names, skipped = []) =>
  ["<?xml version=\"1.0\" encoding=\"utf-8\"?>", "<testsuites>",
    ...names.map((n) => `\t<testcase name="${n.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" classname="test"/>`),
    ...skipped.map((n) => `\t<testcase name="${n}" classname="test">\n\t\t<skipped type="skipped" message="x"/>\n\t</testcase>`),
    "</testsuites>"].join("\n");

const A_TEST = [
  'test("the gate refuses a self-citation", () => { assert.equal(1, 1); assert.ok(true); });',
  'test("the gate reads a CRLF checkout as LF", () => { assert.deepEqual([], []); });',
  'test("a pointer that names nothing is refused", () => { assert.ok(true); });',
].join("\n");
const FUZZ = [
  "const RUNS = 500;",
  "const PARAMS = { seed: 1, numRuns: RUNS };",
  'test("fuzz one", () => { fc.assert(fc.property(fc.integer(), () => true), { numRuns: 300 }); });',
  'test("fuzz two", () => { fc.assert(fc.property(fc.integer(), () => true), PARAMS); });',
].join("\n");
const REL = [
  'const RUNS = Math.max(1, Number.parseInt(process.env.RUNWARD_MR_RUNS ?? "", 10) || 3);',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `test("MR-${n}: relation ${n}", () => holds("MR-${n}"));`),
].join("\n");
const CORPUS_TEXT = ['attack("AC-001", ["ADR-0045"], "one", "why", () => {});', 'honest("AC-002", ["ADR-0045"], "two", "why", () => {});'].join("\n");
const LEDGER_TEXT = JSON.stringify({ assigned: { "AC-001": "one", "AC-002": "two" }, retired: {} });
const CI = 'jobs:\n  coverage-floor:\n    steps:\n      - env:\n          FLOOR: "85"\n        run: npm run coverage\n';

const NAMES = ["the gate refuses a self-citation", "the gate reads a CRLF checkout as LF", "a pointer that names nothing is refused", "fuzz one", "fuzz two",
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `MR-${n}: relation ${n}`)];

function baseTree() {
  return {
    [JUNIT]: junit(NAMES),
    "test/unit/a.test.js": A_TEST,
    "test/unit/fuzz.test.js": FUZZ,
    [RELATIONS]: REL,
    [CORPUS]: CORPUS_TEXT,
    [LEDGER]: LEDGER_TEXT,
    ".github/workflows/ci.yml": CI,
    [WHOLENET]: JSON.stringify({ evidence: { trials: 1 }, verdict: { trials: 1 } }),
    [STRYKER]: JSON.stringify({ mutate: ["dist/lib/evidence.js", "dist/lib/verdict.js"] }),
  };
}
const snap = (tree) => ({ paths: Object.keys(tree).sort(), read: (p) => (p in tree ? tree[p] : null) });
const diff = (edit) => { const b = baseTree(); const h = baseTree(); edit(h); return compareNets(snap(b), snap(h)); };
const kinds = (findings) => shrinkKinds(findings);

test("net shrink: an unchanged net, and a pure addition, do not shrink", () => {
  assert.deepEqual(diff(() => {}), []);
  const f = diff((h) => {
    h["test/unit/new.test.js"] = 'test("a new case", () => { assert.ok(true); });';
    h[JUNIT] = junit([...NAMES, "a new case", "the gate refuses a dangling pointer"]);
    h["test/unit/a.test.js"] = `${A_TEST}\ntest("the gate refuses a dangling pointer", () => { assert.ok(1); });`;
    h["test/unit/fuzz.test.js"] = FUZZ.replace("numRuns: 300", "numRuns: 400");
    h[RELATIONS] = `${REL}\ntest("MR-9: relation 9", () => holds("MR-9"));`;
    h[CORPUS] = `${CORPUS_TEXT}\nattack("AC-003", ["ADR-0045"], "three", "why", () => {});`;
    h[LEDGER] = JSON.stringify({ assigned: { "AC-001": "one", "AC-002": "two", "AC-003": "three" }, retired: {} });
    h[".github/workflows/ci.yml"] = CI.replace('"85"', '"86"');
  });
  assert.deepEqual(f, []);
  assert.equal(fingerprint(f), "");
});

test("net shrink, control: a deleted test file is a shrink; the same file moved is a note", () => {
  assert.deepEqual(kinds(diff((h) => { delete h["test/unit/a.test.js"]; })), ["test-file-deleted"]);
  const moved = diff((h) => { h["test/integration/a.test.js"] = h["test/unit/a.test.js"]; delete h["test/unit/a.test.js"]; });
  assert.deepEqual(kinds(moved), []);
  assert.equal(moved[0].kind, "test-file-moved");
});

test("net shrink, control: a case gone from the JUnit inventory is a shrink", () => {
  const f = diff((h) => {
    h[JUNIT] = junit(NAMES.filter((n) => n !== "a pointer that names nothing is refused"));
    h["test/unit/a.test.js"] = A_TEST.split("\n").slice(0, 2).join("\n") + "\nassert.ok(true);";
  });
  assert.deepEqual(kinds(f), ["test-case-removed"]);
  assert.match(f.find((x) => x.kind === "test-case-removed").detail, /a pointer that names nothing is refused/);
});

test("net shrink: a rename in the same file with a similar name is reported, not escalated; an unsure one is a removal", () => {
  const renamed = diff((h) => {
    h[JUNIT] = junit(NAMES.map((n) => (n === "a pointer that names nothing is refused" ? "a pointer that names nothing at all is refused" : n)));
    h["test/unit/a.test.js"] = A_TEST.replace("names nothing is", "names nothing at all is");
  });
  assert.deepEqual(kinds(renamed), []);
  assert.deepEqual(renamed.map((x) => x.kind), ["test-case-renamed"]);
  const unrelated = diff((h) => {
    h[JUNIT] = junit(NAMES.map((n) => (n === "a pointer that names nothing is refused" ? "manifest rows sort stably" : n)));
    h["test/unit/a.test.js"] = A_TEST.replace("a pointer that names nothing is refused", "manifest rows sort stably");
  });
  assert.deepEqual(kinds(unrelated), ["test-case-removed"]);
  const otherFile = diff((h) => {
    h[JUNIT] = junit(NAMES.map((n) => (n === "a pointer that names nothing is refused" ? "a pointer that names nothing at all is refused" : n)));
    h["test/unit/a.test.js"] = A_TEST.split("\n").slice(0, 2).join("\n") + "\nassert.ok(true);";
    h["test/unit/b.test.js"] = 'test("a pointer that names nothing at all is refused", () => { assert.ok(true); });';
  });
  assert.deepEqual(kinds(otherFile), ["test-case-removed"], "a similar name in another file is not paired: unsure is a removal");
  assert.ok(similarity("a pointer that names nothing is refused", "a pointer that names nothing at all is refused") >= 0.5);
});

test("net shrink, control: an attack case retired in the ledger, or missing from the corpus, is a shrink", () => {
  const retired = diff((h) => {
    h[CORPUS] = CORPUS_TEXT.split("\n")[0];
    h[LEDGER] = JSON.stringify({ assigned: { "AC-001": "one" }, retired: { "AC-002": { retired: "2026-10-13", reason: "x" } } });
  });
  assert.deepEqual(kinds(retired), ["attack-case-dropped"]);
  assert.match(retired[0].detail, /AC-002 retired/);
  const missing = diff((h) => { h[CORPUS] = CORPUS_TEXT.split("\n")[0]; });
  assert.deepEqual(kinds(missing), ["attack-case-dropped"]);
  assert.match(missing[0].detail, /AC-002 is no longer declared/);
});

test("net shrink, control: a metamorphic relation no longer checked is a shrink, by name or by call", () => {
  assert.deepEqual(kinds(diff((h) => { h[RELATIONS] = REL.replace(/test\("MR-8.*\n?/, ""); })), ["relation-removed"]);
  assert.deepEqual(kinds(diff((h) => { h[RELATIONS] = REL.replace('holds("MR-5")', "true"); })), ["relation-removed"]);
});

test("net shrink, control: a lowered numRuns, RUNS constant or RUNWARD_MR_RUNS default is a shrink", () => {
  assert.deepEqual(kinds(diff((h) => { h["test/unit/fuzz.test.js"] = FUZZ.replace("numRuns: 300", "numRuns: 30"); })), ["runs-lowered"]);
  assert.deepEqual(kinds(diff((h) => { h["test/unit/fuzz.test.js"] = FUZZ.replace("RUNS = 500", "RUNS = 50"); })), ["runs-lowered"]);
  assert.deepEqual(kinds(diff((h) => { h[RELATIONS] = REL.replace("|| 3)", "|| 1)"); })), ["runs-lowered"]);
});

test("net shrink, control: fewer fast-check properties in a test file is a shrink", () => {
  const f = diff((h) => { h["test/unit/fuzz.test.js"] = FUZZ.replace("fc.assert(fc.property(fc.integer(), () => true), PARAMS)", "assert.ok(true)"); });
  assert.ok(kinds(f).includes("properties-lowered"), JSON.stringify(f));
});

test("net shrink, control: a lowered coverage floor, or a coverage job that stopped measuring, is a shrink", () => {
  assert.deepEqual(kinds(diff((h) => { h[".github/workflows/ci.yml"] = CI.replace('"85"', '"80"'); })), ["coverage-floor-lowered"]);
  assert.deepEqual(kinds(diff((h) => { h[".github/workflows/ci.yml"] = CI.replace("npm run coverage", "true"); })), ["coverage-floor-lowered"]);
});

test("net shrink, control: the mutation perimeter losing a module or a mutate entry is a shrink", () => {
  assert.deepEqual(kinds(diff((h) => { h[WHOLENET] = JSON.stringify({ evidence: {} }); })), ["mutation-perimeter-shrunk"]);
  assert.deepEqual(kinds(diff((h) => { h[STRYKER] = JSON.stringify({ mutate: ["dist/lib/evidence.js"] }); })), ["mutation-perimeter-shrunk"]);
});

test("net shrink, control: a skip or todo added to an existing test, or a skipped JUnit case, is a shrink", () => {
  for (const edit of [
    (s) => s.replace('test("the gate reads', 'test.skip("the gate reads'),
    (s) => s.replace('test("the gate reads a CRLF checkout as LF", ()', 'test("the gate reads a CRLF checkout as LF", { skip: true }, ()'),
    (s) => s.replace('test("the gate reads a CRLF checkout as LF", ()', 'test("the gate reads a CRLF checkout as LF", { todo: "later" }, ()'),
  ]) assert.deepEqual(kinds(diff((h) => { h["test/unit/a.test.js"] = edit(A_TEST); })), ["skip-added"]);
  const j = diff((h) => { h[JUNIT] = junit(NAMES.filter((n) => n !== "fuzz two"), ["fuzz two"]); });
  assert.deepEqual(kinds(j), ["skip-added"]);
});

test("net shrink, control: fewer assertion calls in an existing test file is a shrink", () => {
  assert.deepEqual(kinds(diff((h) => { h["test/unit/a.test.js"] = A_TEST.replace(" assert.ok(true); });\ntest(\"the gate reads", " });\ntest(\"the gate reads"); })), ["assertions-lowered"]);
});

test("net shrink: the fingerprint is stable, changes with the shrink, and names nothing for the notes", () => {
  const one = diff((h) => { delete h["test/unit/a.test.js"]; });
  const again = diff((h) => { delete h["test/unit/a.test.js"]; });
  const two = diff((h) => { delete h["test/unit/a.test.js"]; h[".github/workflows/ci.yml"] = CI.replace('"85"', '"80"'); });
  assert.match(fingerprint(one), /^[0-9a-f]{12}$/);
  assert.equal(fingerprint(one), fingerprint(again));
  assert.notEqual(fingerprint(one), fingerprint(two));
});

test("net shrink: the acknowledgment needs the label from a non-delegate admin AND the body line with the fingerprint and every kind", () => {
  const f = diff((h) => { delete h["test/unit/a.test.js"]; h[".github/workflows/ci.yml"] = CI.replace('"85"', '"80"'); });
  const fp = fingerprint(f);
  const body = `Some text.\n${ACK_LINE} ${fp} test-file-deleted coverage-floor-lowered, the file is replaced by the new suite\n`;
  const ok = { findings: f, labels: [ACK_LABEL], labeler: "stranxik", labelerPermission: "admin", body };
  assert.equal(acknowledged(ok).ok, true);
  assert.equal(acknowledged({ ...ok, labels: [] }).ok, false, "no label");
  assert.equal(acknowledged({ ...ok, labelerPermission: "write" }).ok, false, "a writer is not enough");
  assert.equal(acknowledged({ ...ok, labeler: "runward-steward[bot]" }).ok, false, "the App is a delegate");
  assert.equal(acknowledged({ ...ok, labeler: "claude", delegates: ["claude"] }).ok, false, "a charter delegate");
  assert.equal(acknowledged({ ...ok, body: "" }).ok, false, "no line");
  assert.equal(acknowledged({ ...ok, body: `${ACK_LINE} ${fp} test-file-deleted` }).ok, false, "a kind not named");
  assert.equal(acknowledged({ ...ok, body: `${ACK_LINE} 000000000000 test-file-deleted coverage-floor-lowered` }).ok, false, "a stale fingerprint");
  assert.equal(acknowledged({ findings: diff(() => {}), labels: [] }).ok, true, "no shrink needs no acknowledgment");
  assert.match(STAGE1_NOTE, /declared, not proved/);
});

test("net shrink: the extractors are not blind on runward's own tree, and the tree against itself does not shrink", () => {
  const tree = dirSnapshot(ROOT);
  assert.deepEqual(relations(tree.read(RELATIONS)), ["MR-1", "MR-2", "MR-3", "MR-4", "MR-5", "MR-6", "MR-7", "MR-8"]);
  assert.deepEqual(corpusIds(tree.read(CORPUS)), ledgerIds(tree.read(LEDGER)).assigned.sort());
  assert.ok(junitCases(tree.read(JUNIT)).cases.length >= 1000);
  assert.ok(coverageFloors(tree.read(".github/workflows/ci.yml")).length >= 1);
  assert.deepEqual(runCounts(tree.read(RELATIONS)), [3]);
  assert.ok(runCounts(tree.read("test/unit/manifest-fuzz.test.js")).length >= 3);
  assert.ok(propertyCount(tree.read("test/unit/manifest-fuzz.test.js")) >= 3);
  assert.ok(wholenetModules(tree.read(WHOLENET)).length >= 10);
  assert.ok(assertionCount(read("test/unit/net-shrink.test.js")) > 20);
  assert.ok(skipCount(tree.read("test/unit/no-overclaim.test.js")) >= 1);
  assert.ok(declaredNames(read("test/unit/net-shrink.test.js")).includes("net shrink: an unchanged net, and a pure addition, do not shrink"));
  assert.deepEqual(compareNets(tree, tree), []);
});

test("net shrink: the workflow runs the default branch's guard on pull_request_target, read-only, never the pull request's code", () => {
  const wf = read(".github/workflows/net-shrink.yml");
  assert.match(wf, /pull_request_target:\n\s+types: \[[^\]]*labeled[^\]]*edited[^\]]*\]/);
  assert.match(wf, /^permissions: \{\}$/m);
  assert.doesNotMatch(wf, /:\s*write\b/);
  assert.doesNotMatch(wf, /ref:\s*\$\{\{\s*github\.event\.pull_request\.head/);
  assert.doesNotMatch(wf, /npm (ci|install|test)|npx /);
  assert.match(wf, /node scripts\/net-shrink\.mjs --base "\$NET_BASE" --head "\$NET_HEAD"/);
  assert.match(wf, /'net shrink'/);
  assert.match(wf, new RegExp(ACK_LABEL));
  assert.match(read("runward/runbook.md"), new RegExp(`${ACK_LINE}`));
});
