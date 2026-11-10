// The analyzers' measurement (scripts/measure-analyzers.mjs, ADR-0117 criterion 2) writes its tables so
// that GitHub shows each cell as it is written.
//
// CodeQL raised its cell writer on the second integration pull request of 2026-11-06 (alert 92,
// js/incomplete-sanitization): it escaped `|` and not the backslash. Read against how GitHub renders a
// GFM table cell, measured for the mutation register in #492, the pipe escape alone is right inside a
// code span, where a backslash is literal, and wrong in prose, where a backslash before punctuation is an
// escape and `*`, `_`, `~`, `<`, `&` and `[` are markup. The harness now writes a finding's message, a
// repository's reason and a reader's sentence through prose() (text()), and a code span with the pipe
// escape alone, its fence longer than any run of backticks it holds.
//
// Held here, on cells rendered with GitHub's own renderer on 2026-11-06 (POST /markdown, mode gfm,
// test/fixtures/measure-analyzers-gfm.json): the harness writes the markdown that was rendered, and that
// rendering shows each source as written, the prose with no tag but its code spans and each code span
// exactly; and, the positive control, the base harness's cells of the same sources show 8 of them
// otherwise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..", "..");
const { text, code } = await import(pathToFileURL(join(ROOT, "scripts", "measure-analyzers.mjs")).href);
const FIXTURE = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "measure-analyzers-gfm.json"), "utf8"));
const oldCell = (s) => String(s ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|");

const decode = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|#39);/gi, (_, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    : { amp: "&", lt: "<", gt: ">", quot: "\"" }[e.toLowerCase()]);

/** The code spans of `s` as CommonMark pairs them, [start, end, fence length]. */
function spans(s) {
  const out = [];
  for (let i = s.indexOf("`"); i !== -1;) {
    let n = 0;
    while (s[i + n] === "`") n++;
    let close = -1;
    for (let j = s.indexOf("`", i + n); j !== -1;) {
      let m = 0;
      while (s[j + m] === "`") m++;
      if (m === n) { close = j; break; }
      j = s.indexOf("`", j + m);
    }
    if (close === -1) { i = s.indexOf("`", i + n); continue; }
    out.push([i, close + n, n]);
    i = s.indexOf("`", close + n);
  }
  return out;
}
/** What a reader sees of a source string: its code spans' delimiters dropped, as CommonMark strips them. */
function visible(s) {
  let out = "", at = 0;
  for (const [a, b, n] of spans(s)) {
    let c = s.slice(a + n, b - n);
    if (c.length >= 2 && c[0] === " " && c.at(-1) === " " && c.trim() !== "") c = c.slice(1, -1);
    out += s.slice(at, a) + c;
    at = b;
  }
  return out + s.slice(at);
}
/** What GitHub shows of a rendered cell, and the tags it holds besides `code`. */
function shown(td) {
  const tags = [...new Set([...td.matchAll(/<\/?([a-zA-Z]+)/g)].map((m) => m[1]))].filter((t) => t !== "code");
  return { text: decode(td.replace(/<[^>]+>/g, "")), tags };
}

test("the harness writes the cells GitHub rendered, and GitHub showed every one as written", () => {
  assert.ok(FIXTURE.cases.length >= 25, `the fixture holds ${FIXTURE.cases.length} cases`);
  for (const c of FIXTURE.cases) {
    assert.equal(text(c.source), c.markdown.prose, `prose cell of ${JSON.stringify(c.source)}: not the markdown that was rendered`);
    assert.equal(code(c.source), c.markdown.code, `code cell of ${JSON.stringify(c.source)}: not the markdown that was rendered`);
    const p = shown(c.html.prose);
    assert.deepEqual(p.tags, [], `${JSON.stringify(c.source)}: GitHub read markup in the prose cell`);
    assert.equal(p.text, visible(c.source), `${JSON.stringify(c.source)}: the prose cell shows otherwise`);
    const k = /^<code class="notranslate">(.*)<\/code>$/s.exec(c.html.code.trim());
    assert.ok(k, `${JSON.stringify(c.source)}: the code cell is one code span`);
    assert.equal(decode(k[1]).trim(), c.source.trim(), `${JSON.stringify(c.source)}: the code span shows otherwise`);
  }
});

test("positive control: the base harness's prose cells of the same sources show 8 of them otherwise", () => {
  const wrong = [];
  for (const c of FIXTURE.cases) {
    assert.equal(oldCell(c.source), c.markdown.old, "the recorded old cell is the base harness's");
    const o = shown(c.html.old);
    if (o.tags.length > 0 || o.text !== visible(c.source)) wrong.push(c.source);
  }
  assert.equal(wrong.length, 8, JSON.stringify(wrong));
  assert.ok(wrong.includes("a\\|b outside code"), "a backslash before the escaped pipe vanished");
});
