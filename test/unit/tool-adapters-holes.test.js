// These tests kill holes filed on 2026-11-04 in docs/compliance/mutation-survivors: mutants of the
// JUnit projection (`projectJUnit`, behind `junitProjection` and `junitProjectionQuoteVariants`) and of
// its strict attribute reader (`strictXmlAttributes`) that the unit suite let survive.
//
// The projection is what the evidence seal hashes for a JUnit report (ADR-0102 B, stated for a reader
// in docs/spec/runward-oscal-mapping.md §6): the cases and their verdicts, not the timings. Two
// properties are pinned here, each on crafted documents:
//  - a document this reader parses whole projects to EXACTLY the lines the specification states
//    (header, suite lines, case lines with the verdict of the case's direct `<error>`, `<failure>` or
//    `<skipped>` child), so a verdict read wrongly (a failure read as a pass: a seal that reads intact
//    over a changed verdict) moves the result;
//  - a document that is not well formed projects to null (the seal then hashes its bytes), and the
//    reader terminates on it: every reading runs in a worker thread bounded in time, so a reader that
//    loops fails the test instead of hanging the suite.
// Every refusal is paired with a positive control, a minimal well-formed sibling that projects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "lib", "tool-adapters.js")).href;
const BOUND_MS = 4000;

// Reads every document in a worker: the projection and its two quote variants, or the error thrown.
function readAll(docs) {
  const code = `
    const { parentPort, workerData } = require("node:worker_threads");
    import(workerData.module).then((m) => {
      const out = workerData.docs.map((d) => {
        const r = {};
        try { r.p = m.junitProjection(d); } catch (e) { r.p = { threw: String(e) }; }
        try { r.v = m.junitProjectionQuoteVariants(d); } catch (e) { r.v = { threw: String(e) }; }
        return r;
      });
      parentPort.postMessage(out);
    });`;
  return new Promise((resolve, reject) => {
    const w = new Worker(code, { eval: true, workerData: { module: MODULE, docs }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    const timer = setTimeout(() => { w.terminate(); reject(new Error(`the projection did not terminate within ${BOUND_MS} ms`)); }, BOUND_MS);
    w.once("message", (out) => { clearTimeout(timer); w.terminate(); resolve(out); });
    w.once("error", (e) => { clearTimeout(timer); reject(e); });
  });
}
const readOne = async (doc) => (await readAll([doc]))[0];

const header = (n) => JSON.stringify({ projection: "junit-projection-v1", rootFailuresAndErrors: n });
const suite = (...path) => JSON.stringify(["suite", path]);
const kase = (path, classname, name, verdict) => JSON.stringify(["case", path, classname, name, verdict]);
// The specification's order: the header, then suite and case lines sorted together by UTF-16 code units.
const projection = (n, ...lines) => [header(n), ...lines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))];

// Asserts a document projects to `expected`, and that both quote variants equal it when the document
// carries no quote to respell.
async function projectsTo(doc, expected, what) {
  const r = await readOne(doc);
  assert.deepEqual(r.p, expected, `${what}: projection`);
  assert.deepEqual(r.v, [expected, expected], `${what}: quote variants of a document with no quote`);
}
async function refused(doc, what) {
  const r = await readOne(doc);
  assert.equal(r.p, null, `${what}: not parsed whole, so no projection`);
  assert.deepEqual(r.v, [null, null], `${what}: no quote variant either`);
}

// ── Verdicts: a case's verdict is read from its direct child ───────────────────────────────────

test("each verdict is read from the case's direct child: error, failure, skipped, passed", async () => {
  const doc = `<testsuites>
  <testsuite name="s">
    <testcase classname="c" name="e"><system-err>x</system-err><error message="m"/></testcase>
    <testcase classname="c" name="f"><system-out>x</system-out><failure message="m">trace</failure></testcase>
    <testcase classname="c" name="k"><skipped/></testcase>
    <testcase classname="c" name="p"/>
    <testcase name="no-classname"/>
  </testsuite>
</testsuites>`;
  await projectsTo(doc, projection(2,
    suite("s"),
    kase(["s"], "c", "e", "error"),
    kase(["s"], "c", "f", "failure"),
    kase(["s"], "c", "k", "skipped"),
    kase(["s"], "c", "p", "passed"),
    kase(["s"], null, "no-classname", "passed"),
  ), "four verdicts and a case without classname");
});

test("a failing case and the same case passing never share a projection", async () => {
  const one = (body) => `<testsuite name="s"><testcase classname="c" name="t">${body}</testcase></testsuite>`;
  const [failing, erroring, passing] = await readAll([one("<system-out>log</system-out><failure/>"), one("<error/>"), one("<system-out>log</system-out>")]);
  assert.deepEqual(passing.p, projection(0, suite("s"), kase(["s"], "c", "t", "passed")), "positive control: the passing case");
  assert.deepEqual(failing.p, projection(1, suite("s"), kase(["s"], "c", "t", "failure")));
  assert.deepEqual(erroring.p, projection(1, suite("s"), kase(["s"], "c", "t", "error")));
});

test("an error child wins over a failure child", async () => {
  await projectsTo(`<testsuite name="s"><testcase classname="c" name="t"><failure/><error/></testcase></testsuite>`,
    projection(2, suite("s"), kase(["s"], "c", "t", "error")), "failure then error");
});

test("a failure nested in <system-out>, or a skipped outside any case, is not a case's verdict", async () => {
  await projectsTo(`<testsuite name="s"><testcase classname="c" name="t"><system-out><failure/></system-out></testcase></testsuite>`,
    projection(1, suite("s"), kase(["s"], "c", "t", "passed")), "nested failure (counted at the root only)");
  await projectsTo(`<testsuite name="s"><skipped/><testcase classname="c" name="t"/></testsuite>`,
    projection(0, suite("s"), kase(["s"], "c", "t", "passed")), "skipped directly under the suite");
});

// ── Suites ─────────────────────────────────────────────────────────────────────────────────────

test("a self-closing suite leaves the suite path, and a self-closing root projects", async () => {
  await projectsTo(`<testsuites><testsuite name="empty"/><testsuite name="full"><testcase classname="c" name="a"/></testsuite></testsuites>`,
    projection(0, suite("empty"), suite("full"), kase(["full"], "c", "a", "passed")), "empty suite then a full one");
  await projectsTo(`<testsuite name="solo" tests="0"/>`, projection(0, suite("solo")), "self-closing root suite");
  await projectsTo(`<testsuites/>`, projection(0), "self-closing root");
});

// ── Attributes, read strictly ──────────────────────────────────────────────────────────────────

test("attributes in every well-formed spelling are read", async () => {
  const expect = (name) => projection(0, suite("s"), kase(["s"], "c", name, "passed"));
  await projectsTo(`<testsuite name="s"><testcase  name="two-spaces"  classname="c"/></testsuite>`, expect("two-spaces"), "two spaces between attributes");
  await projectsTo(`<testsuite name="s"><testcase classname = "c" name = "around"/></testsuite>`, expect("around"), "white space around =");
  await projectsTo(`<testsuite name='s'><testcase name='xy' classname='c'/></testsuite>`, expect("xy"), "single-quoted values");
  await projectsTo(`<testsuite name="s"><testcase name="before-close" classname="c" /></testsuite>`, expect("before-close"), "a space before />");
  await projectsTo(`<testsuite name="s">\n<testcase\n\tname="nl"\n\tclassname="c"\n/>\n</testsuite>`, expect("nl"), "line breaks and tabs");
});

test("an attribute without a value is not well formed", async () => {
  await projectsTo(`<testsuite name="s"><testcase name="a" classname="c"/></testsuite>`,
    projection(0, suite("s"), kase(["s"], "c", "a", "passed")), "positive control");
  await refused(`<testsuite name="s"><testcase name="a" classname="c" junk/></testsuite>`, "junk after the attributes");
  await refused(`<testsuite name="s" junk><testcase name="a" classname="c"/></testsuite>`, "junk in an open tag");
});

// ── Leading byte order mark ────────────────────────────────────────────────────────────────────

test("a leading BOM is dropped, and a U+FEFF inside a name is kept", async () => {
  await projectsTo(`﻿<testsuites/>`, projection(0), "leading BOM");
  await projectsTo(`<testsuite name="s"><testcase classname="c" name="a﻿b"/></testsuite>`,
    projection(0, suite("s"), kase(["s"], "c", "a﻿b", "passed")), "U+FEFF inside a name");
});

// ── Prolog, comments, CDATA, processing instructions, DOCTYPE ─────────────────────────────────

test("white space around the root is allowed, text outside it is not", async () => {
  await projectsTo(` <testsuites/>`, projection(0), "one space before the root");
  await projectsTo(`<testsuites/>\n`, projection(0), "a newline after the root");
  await refused(`<testsuites/>x`, "one character after the root");
  await refused(`x<testsuites/>`, "one character before the root");
});

test("a DOCTYPE without an internal subset before the root is skipped", async () => {
  const body = `<testsuites><testsuite name="s"><testcase classname="c" name="t[1]"/></testsuite></testsuites>`;
  const expected = projection(0, suite("s"), kase(["s"], "c", "t[1]", "passed"));
  await projectsTo(body, expected, "positive control: no DOCTYPE");
  await projectsTo(`<!DOCTYPE testsuites>\n${body}`, expected, "DOCTYPE at offset 0");
  await projectsTo(`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE testsuites>\n${body}`, expected, "XML declaration then DOCTYPE, a name holding [");
});

test("a DOCTYPE with an internal subset, after the root, or unterminated is refused", async () => {
  const body = `<testsuites><testcase classname="c" name="a"/></testsuites>`;
  await refused(`<!DOCTYPE testsuites []>${body}`, "internal subset");
  await refused(`<!DOCTYPE testsuites [<!ENTITY x "y">]>${body}`, "internal subset declaring an entity");
  await refused(`${body}<!DOCTYPE testsuites>`, "DOCTYPE after the root");
  await refused(`<<!DOCTYPE testsuites>${body}`, "a stray < before a DOCTYPE");
  await refused(`<!DOCTYPE <testsuite`, "a DOCTYPE that never ends");
});

test("comments, CDATA and processing instructions inside a case are skipped whole", async () => {
  const wrap = (out) => `<testsuites><testsuite name="s"><testcase classname="c" name="a"><system-out>${out}</system-out></testcase></testsuite></testsuites>`;
  const expected = projection(0, suite("s"), kase(["s"], "c", "a", "passed"));
  const docs = [wrap("x"), wrap("--><!-- c -->"), wrap("<![CDATA[123<oops]]><![CDATA[a<b]]>"), wrap("]]><![CDATA[x]]>"), wrap("a?><?pi x?>")];
  const out = await readAll(docs);
  const what = ["positive control", "--> before a comment", "CDATA holding <", "]]> before a CDATA section", "a?> before a processing instruction"];
  out.forEach((r, i) => {
    assert.deepEqual(r.p, expected, what[i]);
    assert.deepEqual(r.v, [expected, expected], `${what[i]}: quote variants`);
  });
});

test("unterminated comments, CDATA, processing instructions and start tags are refused, and the reader terminates", async () => {
  const docs = [
    `<testsuites><!-- x</testsuites>`,
    `<testsuites><![CDATA[x</testsuites>`,
    `<testsuites><?pi x</testsuites>`,
    `<testsuites><x`,
    `<testsuites><testcase name="a"`,
  ];
  const out = await readAll(docs);
  out.forEach((r, i) => {
    assert.equal(r.p, null, docs[i]);
    assert.deepEqual(r.v, [null, null], docs[i]);
  });
});

test("CDATA before the root is refused", async () => {
  await refused(`<![CDATA[x]]><testsuites/>`, "CDATA before the root");
  await projectsTo(`<!-- c --><testsuites/>`, projection(0), "positive control: a comment before the root");
});

// ── Well-formedness of the element tree ────────────────────────────────────────────────────────

test("a root never closed is refused", async () => {
  await refused(`<testsuites><testsuite name="s"><testcase classname="c" name="a"/></testsuite>`, "root left open");
  await refused(`<testsuites>`, "root opened only");
  await projectsTo(`<testsuites></testsuites>`, projection(0), "positive control: root closed");
});

test("malformed or mismatched end tags are refused without throwing", async () => {
  await refused(`<testsuite name="s"></1></testsuite>`, "end tag </1>");
  // `</1>` has the length of the `</a>` that follows it: a reader that took that later end tag for this
  // one would resume exactly after `</1>` and accept the document.
  await projectsTo(`<testsuites><a><a></a></a></testsuites>`, projection(0), "positive control: nested elements closed");
  await refused(`<testsuites><a><a></1></a></testsuites>`, "end tag </1> among nested elements");
  await refused(`</testsuites>`, "an end tag before any root");
  await refused(`<testsuite name="s"><testcase name="a"></testcasex></testsuite>`, "a case closed by </testcasex>");
  await refused(`<testsuite name="s"><testcase name="a"></testsuite></testcase>`, "crossed end tags");
});

test("a malformed start tag inside a case is refused", async () => {
  await refused(`<testsuite name="s"><testcase name="a"><1 /><b/></testcase></testsuite>`, "start tag <1 />");
  await projectsTo(`<testsuite name="s"><testcase classname="c" name="a"><b/></testcase></testsuite>`,
    projection(0, suite("s"), kase(["s"], "c", "a", "passed")), "positive control: <b/> alone");
});

test("a second root is refused", async () => {
  await refused(`<testsuites></testsuites><testsuites/>`, "a second root after a closed one");
  await refused(`<testsuites/><testsuites/>`, "a second root after a self-closing one");
  await refused(`<testsuites></testsuites><testsuites></testsuites>`, "two closed roots");
});

// ── Quote variants (RWD-2026-0187) ────────────────────────────────────────────────────────────

test("the quote variants write every quote as an entity, then every entity as a quote", async () => {
  // Read once as XML says (the document holds a `&quot;`, so it is not a doubly escaping reporter's):
  // the first name reads as the literal text `a&quot;b`, the second as `x"y`.
  const doc = `<testsuite name="s"><testcase classname="c" name="a&amp;quot;b"/><testcase classname="c" name="x&quot;y"/></testsuite>`;
  const r = await readOne(doc);
  const lines = (a, x) => projection(0, suite("s"), kase(["s"], "c", a, "passed"), kase(["s"], "c", x, "passed"));
  assert.deepEqual(r.p, lines("a&quot;b", "x\"y"), "the projection decodes once");
  assert.deepEqual(r.v[0], lines("a&quot;b", "x&quot;y"), "every quote written as an entity");
  assert.deepEqual(r.v[1], lines("a\"b", "x\"y"), "every entity written as a quote");
  const respelled = await readOne(doc.replace("a&amp;quot;b", "a&quot;b"));
  assert.deepEqual(r.v[1], respelled.p, "the second variant is the projection of the report that wrote the quote once");
});
