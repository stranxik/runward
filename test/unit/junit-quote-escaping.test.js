// RWD-2026-0187 and RWD-2026-0188: a JUnit report reads the same whichever Node.js wrote it.
//
// Node.js's junit reporter writes a `"` of a test name as `&amp;quot;` up to 24.21.x (and in 20.x, 22.x,
// 25.x) and as `&quot;` from 24.22.0 (nodejs/node#65971). Read as XML says, the old form is the literal
// text `&quot;`, so one suite named a case two ways: the gate refused under one Node a pointer it linked
// under the other, the seal of ADR-0102 B broke on a regeneration, and the net-shrink guard counted 16
// removals on this repository. The two reports below are what 24.18.0 and 24.22.1 wrote for the same
// three-case file on 2026-11-04 (`file` and `time` removed, as scripts/junit-committable.mjs removes them).
//
// Pinned: both escapings link the same pointers; the projection, so the seal, is the same; a seal taken
// by the earlier reading breaks with a message naming the escaping, and a real change still breaks it
// with the old message; net-shrink counts no removal across the two escapings and still counts a real
// one; the residual risk is documented by a test and kept out of runward's own suite; the pointer
// grammar names an inner `"` and its echo reads back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  junitTestResult, junitTestCases, junitProjection, junitProjectionQuoteVariants, junitWritesQuotesTwice, decodeJUnitValue,
} from "../../dist/lib/tool-adapters.js";
import { parseEvidencePointers, verifyEvidenceLock } from "../../dist/lib/evidence.js";
import * as netShrink from "../../scripts/net-shrink.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const hashOf = (lines) => createHash("sha256").update(lines.join("\n") + "\n", "utf8").digest("hex");

const report = (q) => `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
\t<testcase name="a ${q}quoted${q} name" classname="test"/>
\t<testcase name="a &amp; b &lt; c" classname="test"/>
\t<testcase name="plain" classname="test"/>
</testsuites>
`;
const NODE_24_18 = report("&amp;quot;"); // up to 24.21.x, and 20.x, 22.x, 25.x
const NODE_24_22 = report("&quot;"); // from 24.22.0, and 26.x

// ── The reading ──────────────────────────────────────────────────────────────────────────────────

// No name below carries a literal entity: runward's own report must not hold one (the residual risk).
test("the document rule: escaped twice only with no once-escaped quote and at least one twice-escaped one", () => {
  assert.equal(junitWritesQuotesTwice(NODE_24_18), true);
  assert.equal(junitWritesQuotesTwice(NODE_24_22), false);
  assert.equal(junitWritesQuotesTwice(report("")), false, "no quote at all: nothing to read differently");
  assert.equal(junitWritesQuotesTwice(NODE_24_22.replace("plain", "p &amp;quot; q")), false, "one raw &quot; anywhere: decoded once, as XML says");
  assert.equal(decodeJUnitValue("a &amp;quot;b&amp;quot;", true), 'a "b"');
  assert.equal(decodeJUnitValue("a &amp;quot;b&amp;quot;", false), "a &quot;b&quot;");
  assert.equal(decodeJUnitValue("x &amp;amp;quot; y", true), "x &amp;quot; y", "decoded once, never until it stops changing");
  assert.equal(decodeJUnitValue("x &amp;gt; y", true), "x &gt; y", "only the quote is read differently");
});

test("both escapings link the same pointers: the name as the runner prints it, and the entity form", () => {
  for (const [who, xml] of [["24.18.0", NODE_24_18], ["24.22.1", NODE_24_22]]) {
    for (const spelling of ['a "quoted" name', "a &quot;quoted&quot; name", 'test::a "quoted" name']) {
      assert.equal(junitTestResult(xml, spelling), "pass", `${who}: ${spelling}`);
    }
    assert.equal(junitTestResult(xml, "a & b < c"), "pass", `${who}: the other entities are untouched`);
    assert.equal(junitTestResult(xml, 'a "other" name'), "absent", `${who}: a name it does not hold is still absent`);
  }
  // The spelling that linked before against an old report, its raw text, still does there.
  assert.equal(junitTestResult(NODE_24_18, "a &amp;quot;quoted&amp;quot; name"), "pass");
  // One red among the selected cases still reddens, whichever escaping.
  const red = NODE_24_18.replace('classname="test"/>', 'classname="test"><failure message="x"/></testcase>');
  assert.equal(junitTestResult(red, 'a "quoted" name'), "fail");
  assert.deepEqual(junitTestCases(NODE_24_18, 'a "quoted" name').map((c) => c.green), [true]);
});

test("the seal: the projection is the same under both escapings, and a real change still moves it", () => {
  const a = junitProjection(NODE_24_18), b = junitProjection(NODE_24_22);
  assert.deepEqual(a, b);
  assert.ok(a.includes('["case",[],"test","a \\"quoted\\" name","passed"]'), a.join("\n"));
  assert.notEqual(hashOf(junitProjection(NODE_24_18.replace("plain", "plainer"))), hashOf(a), "positive control: a rename moves it");
  // The earlier reading of the old report (`&quot;` in the name) is one of the two variants, never the projection.
  const [entity, quote] = junitProjectionQuoteVariants(NODE_24_18);
  assert.ok(entity.includes('["case",[],"test","a &quot;quoted&quot; name","passed"]'));
  assert.deepEqual(quote, a);
});

// ── The pointer grammar ──────────────────────────────────────────────────────────────────────────

test("a quoted name that stops at an inner quote is refused as such, with the two spellings that carry one", () => {
  for (const cell of ['test:r.xml::"a \\"quoted\\" name"', 'test:r.xml::"a "quoted" name"']) {
    const [p] = parseEvidencePointers(cell);
    assert.ok(p.malformed, cell);
    assert.match(p.malformed, /a `"` cannot appear inside a quoted test name/);
    assert.ok(p.malformed.includes('test:r.xml::"a &quot;quoted&quot; name"'), p.malformed);
    assert.ok(p.malformed.includes('unquoted: test:r.xml::a "quoted" name'), p.malformed);
    assert.equal(p.raw, cell, "echoed as written, so it can be found in the manifest");
  }
  // Positive controls: a quoted name followed by prose, or by punctuation, is not refused.
  for (const cell of ['test:r.xml::"a name" — prose', 'test:r.xml::"a name", then prose', 'test:r.xml::"a name"']) {
    assert.equal(parseEvidencePointers(cell)[0].malformed, undefined, cell);
  }
});

test("the echo of a test name carrying a quote reads back as the same name", () => {
  for (const name of ['a "quoted" name', '"leading" quote', "semi; and \"quote\"", 'a"b']) {
    const written = name.startsWith('"') || name.includes(";") ? `"${name.replace(/"/g, "&quot;")}"` : name;
    const [p] = parseEvidencePointers(`test:r.xml::${written}`);
    const [back] = parseEvidencePointers(p.raw);
    assert.equal(back.raw, p.raw, `${name}: the echo is stable`);
    assert.equal(back.malformed, undefined, `${name}: the echo parses`);
    const xml = report("").replace("a quoted name", name.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"));
    assert.equal(junitTestResult(xml, back.testName), "pass", `${name}: the pasted echo links the case (${p.raw})`);
  }
  assert.equal(parseEvidencePointers('test:r.xml::a "quoted" name')[0].raw, 'test:r.xml::a "quoted" name');
  assert.equal(parseEvidencePointers("test:r.xml::a case")[0].raw, 'test:r.xml::"a case"', "a name without a quote keeps its echo");
});

// ── End to end on `init --example`: the gate and the seal across a regeneration ─────────────────

const CITED = 'test:code/reports/junit.xml::"guard: a fabricated account reference never routes — escalated to review"';
function example(pointer) {
  const dir = mkdtempSync(join(tmpdir(), "rw-junit-quotes-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: dir, env });
  const floor = join(dir, "runward", "floor.md");
  const text = readFileSync(floor, "utf8");
  assert.ok(text.includes(CITED), "the example cites its committed report; this fixture depends on it");
  writeFileSync(floor, text.replace(CITED, pointer));
  const path = join(dir, "code", "reports", "junit.xml");
  const original = readFileSync(path, "utf8");
  const write = (q) => writeFileSync(path, original.replace("</testsuites>", `\t<testcase name="a ${q}quoted${q} name" classname="test"/>\n</testsuites>`));
  // The example reads its own code (ADR-0118), and its JUnit census refuses a report case that no test
  // source declares: the tree that records `a "quoted" name` declares it too.
  const tests = join(dir, "code", "test", "triage.test.ts");
  writeFileSync(tests, `${readFileSync(tests, "utf8")}\ntest('a "quoted" name', () => { assert.ok(true); });\n`);
  return { dir, write, lock: join(dir, "runward", "evidence-lock.json") };
}
const check = (dir, ...a) => spawnSync("node", [CLI, "check", ...a], { cwd: dir, encoding: "utf8", env });

test("end to end: the unquoted and the entity pointer are green under both escapings (the undue refusal)", () => {
  for (const pointer of ['test:code/reports/junit.xml::a "quoted" name', 'test:code/reports/junit.xml::"a &quot;quoted&quot; name"']) {
    const ex = example(pointer);
    try {
      for (const q of ["&amp;quot;", "&quot;"]) {
        ex.write(q);
        const r = check(ex.dir, "--strict");
        assert.equal(r.status, 0, `${pointer} against ${q}:\n${r.stdout}`);
      }
      // Positive control: a name the report does not hold is still refused.
      writeFileSync(join(ex.dir, "code", "reports", "junit.xml"), readFileSync(join(ex.dir, "code", "reports", "junit.xml"), "utf8").replace("quoted", "other"));
      assert.equal(check(ex.dir, "--strict").status, 1);
    } finally { rmSync(ex.dir, { recursive: true, force: true }); }
  }
});

test("end to end: a seal holds across a regeneration under the other escaping; one taken by the earlier reading names the escaping", () => {
  const ex = example('test:code/reports/junit.xml::a "quoted" name');
  try {
    ex.write("&amp;quot;");
    assert.equal(check(ex.dir, "--freeze").status, 0);
    ex.write("&quot;");
    const held = check(ex.dir, "--strict");
    assert.equal(held.status, 0, held.stdout);
    assert.match(held.stdout, /seal intact/);
    // A lock taken before this reading hashed the old report's name as `a &quot;quoted&quot; name`.
    const lock = JSON.parse(readFileSync(ex.lock, "utf8"));
    lock.files["code/reports/junit.xml"] = hashOf(junitProjectionQuoteVariants(readFileSync(join(ex.dir, "code", "reports", "junit.xml"), "utf8"))[0]);
    writeFileSync(ex.lock, JSON.stringify(lock, null, 2) + "\n");
    const broken = verifyEvidenceLock(join(ex.dir, "runward"));
    assert.equal(check(ex.dir, "--strict").status, 1, "the seal still breaks: exit 1");
    assert.ok(broken.violations.some((v) => v.problem.includes("changed only by the reporter's quote escaping (nodejs/node#65971)")), JSON.stringify(broken.violations));
    // Positive control: a renamed case on top of it is a real change, and says so.
    writeFileSync(join(ex.dir, "code", "reports", "junit.xml"), readFileSync(join(ex.dir, "code", "reports", "junit.xml"), "utf8").replace("support request", "support ask"));
    const real = verifyEvidenceLock(join(ex.dir, "runward"));
    assert.ok(real.violations.some((v) => /its JUnit cases or verdicts changed since the seal/.test(v.problem)), JSON.stringify(real.violations));
    assert.ok(!real.violations.some((v) => v.problem.includes("quote escaping")));
  } finally { rmSync(ex.dir, { recursive: true, force: true }); }
});

// ── net-shrink ───────────────────────────────────────────────────────────────────────────────────

const snap = (tree) => ({ paths: Object.keys(tree).sort(), read: (p) => (p in tree ? tree[p] : null) });

test("net-shrink: the two escapings remove nothing, and say how many cases differ only by escaping", () => {
  const f = netShrink.compareNets(snap({ [netShrink.JUNIT]: NODE_24_18 }), snap({ [netShrink.JUNIT]: NODE_24_22 }));
  assert.deepEqual(f.filter((x) => x.shrink), [], JSON.stringify(f));
  const note = f.find((x) => x.kind === "junit-quote-escaping");
  assert.ok(note, JSON.stringify(f));
  assert.match(note.detail, /^1 case\(s\) differ only by the reporter's escaping/);
  const back = netShrink.compareNets(snap({ [netShrink.JUNIT]: NODE_24_22 }), snap({ [netShrink.JUNIT]: NODE_24_18 }));
  assert.deepEqual(back.filter((x) => x.shrink), [], "the other direction too");
});

test("net-shrink: a real removal across the two escapings is still a shrink (positive control)", () => {
  const head = NODE_24_22.replace(/\t<testcase name="plain"[^\n]*\n/, "");
  const f = netShrink.compareNets(snap({ [netShrink.JUNIT]: NODE_24_18 }), snap({ [netShrink.JUNIT]: head }));
  const removed = f.filter((x) => x.kind === "test-case-removed");
  assert.equal(removed.length, 1, JSON.stringify(f));
  assert.match(removed[0].detail, /"plain"/);
  assert.equal(f.find((x) => x.kind === "junit-quote-escaping")?.detail.startsWith("1 case(s)"), true, "and the escaping-only case is still said, not counted");
});

test("net-shrink's copy of the reading is the product's, value for value", () => {
  const values = ["a &amp;quot;b&amp;quot;", "a &quot;b&quot;", "x &amp;amp;quot; y", "&lt;&gt;&apos;&#65;&#x42;&#X43;", "&#0; &#xD800; &nope; &LT;", "plain"];
  for (const v of values) for (const legacy of [true, false]) {
    assert.equal(netShrink.decodeJUnitValue(v, legacy), decodeJUnitValue(v, legacy), `${v} (${legacy})`);
  }
  for (const doc of [NODE_24_18, NODE_24_22, report(""), "<testsuite/>"]) assert.equal(netShrink.junitWritesQuotesTwice(doc), junitWritesQuotesTwice(doc));
});

// ── The residual risk, documented ────────────────────────────────────────────────────────────────

test("residual risk: a corrected reporter's case named with a literal quote entity, and no quote anywhere, reads as a quote", () => {
  // Node.js 24.22 writes a name holding the literal text `&quot;` as `&amp;quot;`; with no `"` in any
  // name, the document has no raw `&quot;` and reads as twice-escaped. Declared in RWD-2026-0187.
  const xml = '<testsuites><testcase name="the &amp;quot; entity" classname="test"/></testsuites>';
  assert.equal(junitTestResult(xml, 'the " entity'), "pass", "read as a quote: the risk, as it is");
  assert.equal(junitTestResult(xml, "the &amp;quot; entity"), "pass", "its raw text still links it");
  // With one `"` elsewhere in the document, it reads as written.
  const mixed = xml.replace("</testsuites>", '<testcase name="a &quot;q&quot;" classname="test"/></testsuites>');
  assert.equal(junitTestResult(mixed, "the &quot; entity"), "pass");
  assert.equal(junitTestResult(mixed, 'the " entity'), "absent");
});

test("residual risk, kept out of runward: no test of its own is named with a literal entity", () => {
  const ENT = /&(?:#\d+|#x[0-9a-f]+|lt|gt|amp|quot|apos);/i;
  const xml = readFileSync(join(ROOT, "reports", "junit.xml"), "utf8");
  const legacy = junitWritesQuotesTwice(xml);
  const names = [...xml.matchAll(/<testcase\b[^>]*?\bname="([^"]*)"/g)].map((m) => decodeJUnitValue(m[1], legacy));
  assert.ok(names.length > 1000, "the committed report is read");
  assert.deepEqual(names.filter((n) => ENT.test(n)), []);
  // Walked on disk, not `git ls-files`: the mutation ratchet runs this suite in a Stryker sandbox, a
  // copy under an ignored directory where git lists nothing (the dry run reddened on 2026-11-04).
  const files = ["test", "floor-ts", "examples"]
    .filter((d) => existsSync(join(ROOT, d)))
    .flatMap((d) => readdirSync(join(ROOT, d), { recursive: true }).map((f) => `${d}/${String(f).split("\\").join("/")}`))
    .filter((f) => !f.includes("/node_modules/"))
    .filter(netShrink.isTestFile);
  assert.ok(files.length > 100, "the test files are read");
  const declared = files.flatMap((f) => netShrink.declaredNames(readFileSync(join(ROOT, f), "utf8")).filter((n) => ENT.test(n)).map((n) => `${f}: ${n}`));
  assert.deepEqual(declared, [], "a test named with a literal entity reads as another name in a report a Node.js up to 24.21.x wrote");
});
