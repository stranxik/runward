// The documents of a mission in runward-fleet (ADR-0127): a renderer that is safe by construction, the
// check its output passes before a page inserts it, the register of decision records and the port
// placement table. A mission's documents are untrusted text; each property is held with its planted control:
//   - the attack corpus (test/support/fleet-documents-corpus.js): every vector is asserted on the parsed
//     tokens of the output, by a reader written here that shares nothing with the module's own check;
//   - a seeded property test: 10,000 strings drawn from a dangerous alphabet never yield an element, an
//     attribute or an address outside the closed lists, and what the check accepts the reader accepts;
//   - planted controls: a copy of the module with one rule loosened turns the corpus red, each in turn,
//     and a copy with one rule of the check loosened accepts an output it must refuse;
//   - a time bound: 100 KB of pathological input renders, and is checked, in under ten times the CPU time of a
//     plain document of the same size on the same machine, and never under 200 ms;
//   - the register is exact on the decision records of a real mission, and says nothing a file does not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { documents, FIX, PKG, ROOT, rules } from "../support/fleet.js";
import { CONTEXT, ELSEWHERE, HOSTILE, RAW, VECTORS } from "../support/fleet-documents-corpus.js";

const SRC = readFileSync(join(PKG, "ui", "documents.js"), "utf8");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

/** A copy of ui/documents.js with each [from, to] applied (each must apply exactly once), imported fresh. */
async function planted(...edits) {
  let s = SRC;
  for (const [from, to] of edits) {
    assert.equal(s.split(from).length - 1, 1, `the plant applies once: ${from.slice(0, 70)}`);
    s = s.replace(from, () => to);
  }
  const dir = mkdtempSync(join(tmpdir(), "rw-fleet-documents-"));
  const file = join(dir, `documents-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, s);
  try { return await import(pathToFileURL(file).href); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ------------------------------------------------------------------ the reader of this test
// Written apart from the module: its lists are literals, its tag reader a regular expression, its https
// rule the URL parser. It is the oracle of the corpus, so a loosened module cannot loosen it.
const ALLOWED = new Set(["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "pre", "code", "b", "i", "blockquote", "table", "tr", "th", "td", "hr", "a"]);
const ATTRS = { a: ["href", "rel", "target"], h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"] };
const TAG = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)((?: [^\s="'<>/]+(?:=(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*) ?\/?>$/;
const ATTR = / ([^\s="'<>/]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g;
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
const unescape = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => NAMED[e]);
const HIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\u2028\u2029]/;

/** Read an output: its tags, the text a reader sees, the addresses of its anchors, and what is outside the closed lists. */
function read(html) {
  const problems = [];
  const tags = [];
  const hrefs = [];
  const ids = [];
  const stack = [];
  let text = "";
  if (typeof html !== "string") return { problems: ["the output is not a string"], tags, hrefs, ids, text };
  if (!html.isWellFormed()) problems.push("half a surrogate pair");
  if (HIDDEN.test(html)) problems.push("a hidden or control character");
  for (const m of html.matchAll(/<[^<>]*>|<|[^<]+/g)) {
    const tok = m[0];
    if (tok[0] !== "<") {
      if (tok.includes(">")) problems.push(`a bare > in text: ${tok.slice(0, 40)}`);
      text += unescape(tok);
      continue;
    }
    const t = tok.length < 3000 ? TAG.exec(tok) : null;
    if (!t) { problems.push(`not a tag of the output: ${tok.slice(0, 60)}`); continue; }
    const name = t[2];
    if (!ALLOWED.has(name)) { problems.push(`<${name}> is outside the closed list`); continue; }
    if (t[1]) {
      if (stack.pop() !== name) problems.push(`</${name}> closes nothing`);
      continue;
    }
    const attrs = [...t[3].matchAll(ATTR)].map((a) => [a[1], unescape(a[2] ?? a[3] ?? a[4] ?? "")]);
    for (const [k] of attrs) if (!ATTRS[name]?.includes(k)) problems.push(`${k} on <${name}> is outside the closed list`);
    const get = (k) => attrs.find((a) => a[0] === k)?.[1];
    if (name === "a") {
      const href = get("href") ?? "";
      hrefs.push(href);
      if (stack.includes("a")) problems.push("a link inside a link");
      if (/^#\/[A-Za-z0-9._~%/-]*$/.test(href) || /^#doc-[\p{L}\p{N}-]*$/u.test(href)) {
        if (attrs.length !== 1) problems.push(`a link inside the application carries more than its address: ${tok}`);
      } else {
        let u = null;
        try { u = new URL(href); } catch { /* not an address */ }
        if (!href.startsWith("https://") || !u || u.protocol !== "https:" || u.username || u.password || !u.hostname || /\s/.test(href)) problems.push(`an address that is neither a slug, a route nor https without credentials: ${href.slice(0, 80)}`);
        if (get("rel") !== "noopener noreferrer nofollow" || get("target") !== "_blank") problems.push(`an absolute link without its rel and target: ${tok.slice(0, 80)}`);
      }
    }
    if (/^h[1-4]$/.test(name)) {
      const id = get("id");
      ids.push(id);
      if (!/^doc-[\p{L}\p{N}-]+$/u.test(id ?? "")) problems.push(`a heading whose id is not a slug of the renderer: ${id}`);
    }
    tags.push(name);
    if (name !== "hr") stack.push(name);
  }
  if (stack.length) problems.push(`<${stack.at(-1)}> is never closed`);
  return { problems, tags, hrefs, ids, text };
}

const contextOf = (x) => (x.ctx === "none" ? undefined : x.ctx === "hostile" ? HOSTILE : x.ctx === "raw" ? RAW : x.ctx === "elsewhere" ? ELSEWHERE : CONTEXT);

/** Run the corpus on a module: the vectors that fail, each with its reason. */
function failures(mod, vectors = VECTORS) {
  const out = [];
  for (const [family, name, src, x] of vectors) {
    const why = [];
    let html;
    try { html = mod.renderDocument(src, contextOf(x)); } catch (e) { out.push(`${family} / ${name}: the renderer threw: ${e.message}`); continue; }
    const r = read(html);
    why.push(...r.problems);
    const hrefs = x.hrefs ?? [];
    if (JSON.stringify(r.hrefs) !== JSON.stringify(hrefs)) why.push(`anchors ${JSON.stringify(r.hrefs).slice(0, 200)}, expected ${JSON.stringify(hrefs)}`);
    for (const t of x.text ?? []) if (!r.text.includes(t)) why.push(`the reader does not see ${JSON.stringify(t).slice(0, 80)}`);
    for (const t of x.absent ?? []) if (r.text.includes(t)) why.push(`the reader sees ${JSON.stringify(t).slice(0, 80)}`);
    for (const t of x.has ?? []) if (!r.tags.includes(t)) why.push(`no <${t}>`);
    for (const t of x.absentTags ?? []) if (r.tags.includes(t)) why.push(`a <${t}>`);
    if (x.ids && JSON.stringify(r.ids) !== JSON.stringify(x.ids)) why.push(`ids ${JSON.stringify(r.ids)}, expected ${JSON.stringify(x.ids)}`);
    if (why.length) out.push(`${family} / ${name}: ${why.slice(0, 3).join("; ")}`);
  }
  return out;
}

// ------------------------------------------------------------------ the corpus
test("the corpus: at least 120 attack vectors in ten families, each asserted on the parsed tokens of the output", () => {
  assert.ok(VECTORS.length >= 120, `${VECTORS.length} vectors`);
  const families = new Map();
  for (const v of VECTORS) families.set(v[0], (families.get(v[0]) ?? 0) + 1);
  assert.deepEqual([...families.keys()].sort(), ["address", "attribute", "construct", "entity", "long", "raw", "relative", "slug", "structure", "unicode"]);
  for (const [f, n] of families) assert.ok(n >= 7, `${f} holds ${n} vectors`);
  assert.equal(new Set(VECTORS.map((v) => `${v[0]} / ${v[1]}`)).size, VECTORS.length, "each vector has its own name");
  assert.deepEqual(failures(documents), []);
});

test("the corpus: every output passes the module's own check, and no vector yields more anchors than it declares", () => {
  let anchors = 0;
  for (const [family, name, src, x] of VECTORS) {
    const html = documents.renderDocument(src, contextOf(x));
    const c = documents.checkRendered(html);
    assert.deepEqual(c, { ok: true, refusals: [] }, `${family} / ${name}`);
    anchors += read(html).hrefs.length;
  }
  assert.equal(anchors, VECTORS.reduce((n, v) => n + (v[3].hrefs ?? []).length, 0));
  assert.ok(VECTORS.filter((v) => (v[3].hrefs ?? []).length === 0).length >= 100, "most vectors yield no anchor at all");
});

test("the reader of this test is not blind: it names an element, an attribute, an address and a hidden character outside the lists", () => {
  const seen = (html) => read(html).problems.join(" | ");
  assert.match(seen("<p>a</p><script>alert(1)</script>"), /<script> is outside/);
  assert.match(seen('<p onclick="x">a</p>'), /onclick on <p>/);
  assert.match(seen('<p class="x">a</p>'), /class on <p>/);
  assert.match(seen('<a href="javascript:alert(1)">a</a>'), /neither a slug/);
  assert.match(seen('<a href="https://u:p@a.example/" rel="noopener noreferrer nofollow" target="_blank">a</a>'), /neither a slug/);
  assert.match(seen('<a href="https://a.example/">a</a>'), /without its rel/);
  assert.match(seen('<a href="#/a"><a href="#/b">a</a></a>'), /a link inside a link/);
  assert.match(seen('<h2 id="x">a</h2>'), /not a slug/);
  assert.match(seen("<p>a\u202eb</p>"), /hidden/);
  assert.match(seen("<p>a > b</p>"), /bare >/);
  assert.match(seen("<p>a < b</p>"), /not a tag/);
  assert.match(seen("<p>a"), /never closed/);
  assert.match(seen("<img src=x onerror=alert(1)>"), /<img> is outside/);
  assert.deepEqual(read('<h1 id="doc-a">a &lt;b&gt;</h1>\n<p><a href="#doc-a">x</a> <a href="#/m/x">y</a> <a href="https://a.example/?a=1&amp;b=2" rel="noopener noreferrer nofollow" target="_blank">z</a></p><hr>'),
    { problems: [], tags: ["h1", "p", "a", "a", "a", "hr"], hrefs: ["#doc-a", "#/m/x", "https://a.example/?a=1&b=2"], ids: ["doc-a"], text: "a <b>\nx y z" });
});

// ------------------------------------------------------------------ what a document may write
test("the closed subset: headings, paragraphs, lists, quotes, tables, code, bold, italic, rules and links, and nothing else", () => {
  const md = [
    "# Title with `code` and **bold**", "", "A paragraph with _italic_, *italic*, **bold**, ***both***, snake_case_name and 2 * 3 * 4.", "",
    "## Lists", "", "- one", "- two", "  - nested **b**", "  - nested 2", "- three", "", "1. first", "2. second", "",
    "> a quote", "> > inside it", "", "| Column | Other |", "|:---|---:|", "| `a` | [doc](../architecture.md) |", "| b |", "",
    "```js", "const a = '<b>';", "```", "", "---", "", "See [the forge](https://forge.example/x), <https://a.example/y> and https://a.example/z.", "",
    "##### Level five", "###### Level six ##",
  ].join("\n");
  const html = documents.renderDocument(md, CONTEXT);
  const r = read(html);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.tags, ["h1", "code", "b", "p", "i", "i", "b", "b", "i", "h2", "ul", "li", "li", "ul", "li", "b", "li", "li", "ol", "li", "li",
    "blockquote", "p", "blockquote", "p", "table", "tr", "th", "th", "tr", "td", "code", "td", "a", "tr", "td", "pre", "code", "hr", "p", "a", "a", "a", "h4", "h4"]);
  assert.deepEqual(r.hrefs, ["#/m/demo/doc/runward%2Farchitecture.md", "https://forge.example/x", "https://a.example/y", "https://a.example/z"]);
  assert.deepEqual(r.ids, ["doc-title-with-code-and-bold", "doc-lists", "doc-level-five", "doc-level-six"]);
  assert.ok(r.text.includes("snake_case_name and 2 * 3 * 4.") && r.text.includes("const a = '<b>';"));
  assert.ok(html.includes("<pre><code>const a = &#39;&lt;b&gt;&#39;;</code></pre>"), "a fence keeps its text, escaped, and drops its info string");
  assert.ok(html.includes("<tr><td>b</td></tr></table>"), "a short row is left short");
  assert.equal(documents.renderDocument("| a | b |\n|---|---|\n| 1 | 2 | 3 |\n|\n||"), "<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr><tr></tr><tr><td></td></tr></table>", "a row is cut to the header's width and never filled");
  assert.deepEqual(documents.checkRendered(html), { ok: true, refusals: [] });
  assert.equal(documents.renderDocument(""), "");
  assert.equal(documents.renderDocument(null), "");
  assert.equal(documents.renderDocument(undefined), "");
  assert.equal(documents.renderDocument(42), "<p>42</p>");
});

test("the closed lists are the design's, and the module holds no import, no clock, no DOM, no sink", () => {
  assert.deepEqual([...documents.DOCUMENT_ELEMENTS].sort(), [...ALLOWED].sort());
  assert.deepEqual(documents.DOCUMENT_ATTRIBUTES, ATTRS);
  assert.equal(documents.EXTERNAL_REL, "noopener noreferrer nofollow");
  const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
  assert.equal(pkg.exports["./documents"], "./ui/documents.js");
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(code.length > 10_000 && !/^\s*import\b|\bimport\s*\(|\brequire\s*\(/m.test(code), "a pure module: no import");
  assert.ok(!rules.CLOCK.test(code), "no clock");
  for (const re of [/\binnerHTML\b/, /\bouterHTML\b/, /\bdocument\s*\./, /\bwindow\s*\./, /\bglobalThis\b/, /\bfetch\s*\(/, /\beval\s*\(/, /\bnew\s+Function\b/, /\bprocess\s*\./, /\bsetTimeout\b/, /Math\s*\.\s*random/]) assert.ok(!re.test(code), `the module uses ${re}`);
  for (const r of documents.DOCUMENT_RULES) assert.ok(r.id && r.en && r.fr && ["test", "build", "elsewhere"].includes(r.held));
});

// ------------------------------------------------------------------ the property
/** mulberry32: a seeded generator, so a failure is replayed by its seed and its index. */
function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ALPHABET = [
  "<", ">", "\"", "'", "&", "`", "*", "_", "[", "]", "(", ")", "!", "#", "|", "-", "+", "=", "/", "\\", ":", ";", " ", " ", "\n", "\n", "\t", "\r",
  "<script>", "</script>", "<img src=x onerror=alert(1)>", "<svg/onload=", "<a href=", "<!--", "-->", "<![CDATA[", "onerror=", "style=", "class=", "id=",
  "javascript:", "JAVASCRIPT:", "data:text/html,", "vbscript:", "file:", "http://", "https://", "https://a.example/", "https://u:p@", "//", "../", "..%2f", "%00", "%2e", "%zz", "#", "?",
  "&lt;", "&gt;", "&amp;", "&quot;", "&#60;", "&#x3c;", "&#106;", "&colon;", "&Tab;", "&#0;",
  "](", "[x](", "![", "](<", ">)", " \"", "\")", "```", "~~~", "``", "**", "__", "***", "> ", "- ", "  - ", "1. ", "# ", "## ", "---", "|---|", "| a |", "[r]: ",
  "\u0000", "\u0001", "\u001b", "\u007f", "\u0085", "\u00a0", "\u200b", "\u200e", "\u202e", "\u202c", "\u2066", "\u2069", "\u2028", "\u2029", "\ufeff", "\ud800", "\udc00", "\ud83d\ude00", "\uff1c", "\u0430",
  "a", "b", "x", "runward/adr/ADR-0001-x.md", "architecture.md", "alert(1)", "é", "決",
];
const drawn = (rnd) => { let s = ""; for (let k = 1 + Math.floor(rnd() * 60); k > 0; k--) s += ALPHABET[Math.floor(rnd() * ALPHABET.length)]; return s; };

test("property: 10,000 strings drawn from a dangerous alphabet never yield anything outside the closed lists (seed 20261111)", () => {
  const rnd = generator(20261111);
  const contexts = [CONTEXT, HOSTILE, undefined, { path: "a.md", route: (p) => `#/${p}`, source: (p) => `https://forge.example/${p}` }];
  let elements = 0;
  let anchors = 0;
  for (let k = 0; k < 10_000; k++) {
    const src = drawn(rnd);
    const html = documents.renderDocument(src, contexts[k % contexts.length]);
    const r = read(html);
    assert.deepEqual(r.problems, [], `string ${k}: ${JSON.stringify(src)}`);
    assert.equal(documents.checkRendered(html).ok, true, `string ${k}: ${JSON.stringify(src)}`);
    elements += r.tags.length;
    anchors += r.hrefs.length;
  }
  assert.ok(elements > 10_000 && anchors > 200, `the draw exercises the renderer (${elements} elements, ${anchors} anchors)`);
});

test("property: whatever the check accepts, the reader of this test accepts too, over 5,000 outputs with one random change each", () => {
  const rnd = generator(99);
  const PLANTS = ["<script>", "</p>", "<p>", " onclick=\"x\"", " class=\"x\"", "<img src=x>", "\"", "'", "<", ">", "&", "&#x3c;", "javascript:", "http://", "u:p@", "<a href=\"#/x\">", "</a>", "\u202e", "\u0000", " ", "=", "//", "<b>", "</b>", "href=\"https://evil.example/\""];
  let accepted = 0;
  let refused = 0;
  for (let k = 0; k < 5_000; k++) {
    let html = documents.renderDocument(drawn(rnd), CONTEXT);
    const at = Math.floor(rnd() * (html.length + 1));
    const kind = Math.floor(rnd() * 3);
    if (kind === 0) html = html.slice(0, at) + PLANTS[Math.floor(rnd() * PLANTS.length)] + html.slice(at);
    else if (kind === 1) html = html.slice(0, at) + html.slice(at + 1 + Math.floor(rnd() * 3));
    else html = html.slice(0, at) + PLANTS[Math.floor(rnd() * PLANTS.length)] + html.slice(at + 1);
    const c = documents.checkRendered(html);
    assert.equal(c.ok, c.refusals.length === 0);
    if (c.ok) { accepted++; assert.deepEqual(read(html).problems, [], `output ${k}: ${JSON.stringify(html)}`); } else refused++;
  }
  assert.ok(accepted > 100 && refused > 1_000, `both sides are exercised (${accepted} accepted, ${refused} refused)`);
});

// ------------------------------------------------------------------ planted controls
// One rule loosened at a time. `net`: the module's own check, unloosened, refuses an output of the
// loosened renderer too (the two nets do not share the rule); where it is false the rule is one only
// the renderer can hold (where a relative path leads), and the corpus alone holds it.
const A = "runward-fleet/documents: plant";
const LOOSENED = [
  { name: "the escaping lets one < through", net: true, edits: [[`String(s).replace(/[&<>"']/g, (c) => ENTITY[c]);`, `String(s).replace(/[&>"']/g, (c) => ENTITY[c]);`]] },
  { name: "the escaping lets & through", net: true, edits: [[`String(s).replace(/[&<>"']/g, (c) => ENTITY[c]);`, `String(s).replace(/[<>"']/g, (c) => ENTITY[c]);`]] },
  { name: "a fenced block is copied instead of escaped", net: true, edits: [[`out.push({ built: el("pre", el("code", text(buf.join("\\n")))) });`, `out.push({ built: el("pre", el("code", new Built(buf.join("\\n")))) });`]] },
  { name: "a code span is copied instead of escaped", net: true, edits: [[`toks.push(el("code", text(body)));`, `toks.push(el("code", new Built(body)));`]] },
  { name: "any scheme is accepted (javascript:, data:, http:)", net: true, edits: [
    [`if (!/^https:\\/\\/[^/?#]/i.test(raw)) return null;`, ``],
    [`if (u.protocol !== "https:") return null;`, ``],
    [`return href.startsWith("https://") && !UNSAFE.test(href) ? href : null;`, `return href;`],
  ] },
  { name: "an address with credentials is accepted", net: true, edits: [[`if (u.username !== "" || u.password !== "") return null;`, ``]] },
  { name: "a protocol-relative address is resolved as a path", net: false, edits: [[`if (raw.startsWith("//")) return null;`, ``]] },
  { name: "a relative path may leave the repository", net: false, edits: [[`if (d === "..") { if (at.length === 0) return null; at.pop(); continue; }`, `if (d === "..") { at.pop(); continue; }`]] },
  { name: "an encoded separator is accepted in a segment", net: false, edits: [[`if (/[\\u0000-\\u001f\\u007f/\\\\]/.test(d)) return null;`, ``]] },
  { name: "the application's route is believed as answered", net: true, edits: [[`route.length <= MAX_HREF && ROUTE.test(route)`, `route.length <= MAX_HREF`]] },
  { name: "the forge's address is believed as answered", net: true, edits: [[`const href = typeof ctx.source === "function" ? external(ctx.source(path)) : null;`, `const href = typeof ctx.source === "function" ? ctx.source(path) : null;`]] },
  { name: "a fragment is copied instead of made a slug", net: true, edits: [["return s ? { href: `#doc-${s}`, external: false } : null;", "return { href: raw, external: false };"]] },
  { name: "an absolute link loses its rel and target", net: true, edits: [[`to.external ? [["href", to.href], ["rel", EXTERNAL_REL], ["target", EXTERNAL_TARGET]] : [["href", to.href]]`, `[["href", to.href]]`]] },
  { name: "a link may hold a link", net: true, edits: [[`toks.push(anchor(href, inline(s.slice(at + 1, to), ctx, false)));`, `toks.push(anchor(href, inline(s.slice(at + 1, to), ctx, true)));`]] },
  { name: "a heading's id loses its prefix", net: true, edits: [["[[\"id\", `doc-${id}`]]", "[[\"id\", id]]"]] },
  { name: "a heading is given a suffix another heading wrote", net: false, edits: [["while (ctx.used.has(`${base}-${k}`)) k++;", ""]] },
  { name: "a slug is cut through a surrogate pair", net: true, edits: [[`.slice(0, 80).replace(/[\\ud800-\\udbff]$/, "");`, `.slice(0, 80);`]] },
  { name: "tag characters are kept", net: true, edits: [[`const HIDDEN = /\\udb40[\\udc00-\\udc7f]|[`, `const HIDDEN = /[`]] },
  { name: "a decoded segment may hold a percent sign, a question mark or a hash", net: false, edits: [[`if (/[%?#]/.test(d)) return null;`, ``]] },
  { name: "the forge's address is not compared with the path asked", net: false, edits: [[`return href && endsWithPath(href, path) ?`, `return href ?`]] },
  { name: "emphasis nests without a limit", net: true, edits: [[`const over = frames.length > MAX_DEPTH;`, `const over = false;`]] },
  { name: "hidden characters are kept", net: true, edits: [[`.replace(HIDDEN, "\\ufffd");`, `;`]] },
  { name: "a refused link is dropped instead of shown", net: false, edits: [[`else toks.push(text(s.slice(i, d.end)));`, `else toks.push(text(""));`]] },
  { name: "an image is loaded", net: true, edits: [
    [`"hr", "a"];`, `"hr", "a", "img"];`],
    [`const at = c === "!" ? i + 1 : i;`, `const at = c === "!" ? i + 1 : i; if (c === "!") { flush(); toks.push(new Built("<img>")); }`],
  ] },
  { name: "a document over the limit is marked up", net: false, long: true, edits: [[`if (src.length > MAX_DOCUMENT_LENGTH) return`, `if (false) return`]] },
];

test("planted controls: each rule of the renderer, loosened alone, turns the corpus red", async () => {
  assert.ok(A && LOOSENED.length >= 15);
  const SHORT = VECTORS.filter((v) => v[0] !== "long"); // the long family is run where the plant is about length
  for (const p of LOOSENED) {
    const mod = await planted(...p.edits);
    const vectors = p.long ? VECTORS : SHORT;
    const red = failures(mod, vectors);
    assert.ok(red.length > 0, `the corpus stays green when ${p.name}`);
    const caught = vectors.some(([, , src, x]) => {
      let html;
      try { html = mod.renderDocument(src, contextOf(x)); } catch { return false; }
      return !documents.checkRendered(html).ok;
    });
    assert.equal(caught, p.net, `${p.name}: the module's own check ${p.net ? "must refuse" : "is not expected to refuse"} an output of the loosened renderer`);
  }
});

test("by construction: a piece the renderer did not build, an element or an attribute outside the lists cannot be emitted", async () => {
  const raw = await planted([`const para = inline(buf.map((x) => x.trim()).join("\\n"), ctx);`, `const para = buf.join("\\n");`]);
  assert.throws(() => raw.renderDocument("a <script>"), /did not build/);
  const element = await planted([`out.push({ built: el("hr") });`, `out.push({ built: el("img") });`]);
  assert.throws(() => element.renderDocument("---"), /not in the closed list/);
  const attribute = await planted([`out.push({ built: el("p", para), para });`, `out.push({ built: el("p", para, [["style", "x"]]), para });`]);
  assert.throws(() => attribute.renderDocument("a"), /not an attribute/);
});

// ------------------------------------------------------------------ the check on the way out
const REFUSED = [
  ["element", "<script>alert(1)</script>"],
  ["element", "<p>a</p><img>"],
  ["element", '<img src="x">'],
  ["element", "<P>a</P>"],
  ["element", "<svg></svg>"],
  ["element", "<iframe></iframe>"],
  ["element", "<style>p{}</style>"],
  ["element", "<div>a</div>"],
  ["element", "<span>a</span>"],
  ["element", "<br>"],
  ["element", "<h5>a</h5>"],
  ["element", "<!-- a -->"],
  ["element", "<!DOCTYPE html>"],
  ["element", "<?xml?>"],
  ["element", "</script>"],
  ["element", "</hr>"],
  ["element", "<>"],
  ["element", "< p>a</p>"],
  ["tag", "<p >a</p>"],
  ["tag", "<p/>"],
  ["tag", "<hr/>"],
  ["tag", "<p\n>a</p>"],
  ["tag", "<p onclick=alert(1)>a</p>"],
  ["tag", "<p onclick='x'>a</p>"],
  ["tag", '<p  id="doc-a">a</p>'],
  ["tag", '<a href="#/x"onclick="y">a</a>'],
  ["tag", '<a href="#/<x">a</a>'],
  ["tag", '<a href="#/x&#x41;">a</a>'],
  ["tag", '<a HREF="#/x">a</a>'],
  ["tag", "<p>a</p><p"],
  ["tag", "<p>a <b</p>"],
  ["attribute", '<p onclick="alert(1)">a</p>'],
  ["attribute", '<p class="x">a</p>'],
  ["attribute", '<p style="color:red">a</p>'],
  ["attribute", '<p id="doc-a">a</p>'],
  ["attribute", '<h2 id="a">a</h2>'],
  ["attribute", "<h2>a</h2>"],
  ["attribute", '<h2 id="doc-a" class="x">a</h2>'],
  ["attribute", '<h2 id="doc-a b">a</h2>'],
  ["attribute", '<a href="#/x" onclick="y">a</a>'],
  ["attribute", '<a href="#/x" style="y">a</a>'],
  ["attribute", '<a href="#/x" rel="noopener noreferrer nofollow">a</a>'],
  ["attribute", '<a rel="noopener noreferrer nofollow" href="https://a.example/" target="_blank">a</a>'],
  ["attribute", "<a>a</a>"],
  ["attribute", '<a target="_blank">a</a>'],
  ["attribute", '<td colspan="2">a</td>'],
  ["href", '<a href="javascript:alert(1)">a</a>'],
  ["href", '<a href="JAVASCRIPT:alert(1)">a</a>'],
  ["href", '<a href="data:text/html,x">a</a>'],
  ["href", '<a href="http://a.example/">a</a>'],
  ["href", '<a href="//a.example/">a</a>'],
  ["href", '<a href="/x">a</a>'],
  ["href", '<a href="x.md">a</a>'],
  ["href", '<a href="">a</a>'],
  ["href", '<a href="#">a</a>'],
  ["href", '<a href="#x">a</a>'],
  ["href", '<a href="#/x y">a</a>'],
  ["href", '<a href="#/x?y=&quot;">a</a>'],
  ["href", '<a href="#doc-a b">a</a>'],
  ["href", '<a href="https://a.example/">a</a>'],
  ["href", '<a href="https://a.example/" rel="noopener" target="_blank">a</a>'],
  ["href", '<a href="https://a.example/" rel="noopener noreferrer nofollow" target="_top">a</a>'],
  ["href", '<a href="https://u:p@a.example/" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="https://u@a.example/" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="https://" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="https://a.example:x=y/" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="https://a.example:443:1/" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="https://a^b.example/" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="https://A.example/" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="https:///a" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="https://a.example/ x" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="https://a.example\\@b.example/" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="HTTPS://a.example/" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["href", '<a href="#/x" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["text", "<p>a > b</p>"],
  ["text", "a > b"],
  ["text", "<p>a &#x3c; b</p>"],
  ["text", "<p>a &lt b</p>"],
  ["text", "<p>a & b</p>"],
  ["text", "<p>&nbsp;</p>"],
  ["hidden", "<p>a\u202eb</p>"],
  ["hidden", "<p>a\u0000b</p>"],
  ["hidden", "<p>a\u001bb</p>"],
  ["hidden", "<p>a\rb</p>"],
  ["hidden", "<p>a\ud83db</p>"],
  ["hidden", "<p>a\ude00b</p>"],
  ["hidden", '<h2 id="doc-a\u2066">a</h2>'],
  ["hidden", '<a href="#/a\u202e">a</a>'],
  ["tag", '<a href="https://a.example/<" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["tag", '<a href="https://a.example/?a&b" rel="noopener noreferrer nofollow" target="_blank">a</a>'],
  ["nesting", "<p>a"],
  ["nesting", "a</p>"],
  ["nesting", "<p><b>a</p></b>"],
  ["nesting", '<a href="#/x"><a href="#/y">a</a></a>'],
  ["nesting", '<a href="#/x"><b><a href="#/y">a</a></b></a>'],
  ["nesting", "<li>a</li>"],
  ["nesting", "<p><li>a</li></p>"],
  ["nesting", "<tr><td>a</td></tr>"],
  ["nesting", "<table><td>a</td></table>"],
  ["nesting", "<ul><li>a</ul>"],
  // what a browser's parser would move or close: the tree must be the one the string writes
  ["nesting", "<table>x<tr><td>a</td></tr></table>"],
  ["nesting", "<table><tr>x<td>a</td></tr></table>"],
  ["nesting", "<table><tr><td>a</td></tr>\n</table>"],
  ["nesting", "<table><p>a</p><tr><td>a</td></tr></table>"],
  ["nesting", "<table><b>a</b></table>"],
  ["nesting", "<table><tr><td>a</td><p>x</p></tr></table>"],
  ["nesting", "<table><tr><td><table><tr><td>a</td></tr></table></td></tr></table>"],
  ["nesting", "<table><tr><th><p>a</p></th></tr></table>"],
  ["nesting", "<p>a<p>b</p></p>"],
  ["nesting", "<p><ul><li>a</li></ul></p>"],
  ["nesting", "<p>a<hr></p>"],
  ["nesting", "<p><pre><code>a</code></pre></p>"],
  ["nesting", "<p><b><blockquote><p>a</p></blockquote></b></p>"],
  ["nesting", "<p><i><table><tr><td>a</td></tr></table></i></p>"],
  ["nesting", '<p><a href="#/x"><p>a</p></a></p>'],
  ["nesting", '<h1 id="doc-a">a<h2 id="doc-b">b</h2></h1>'],
  ["nesting", '<h2 id="doc-a"><p>a</p></h2>'],
  ["nesting", "<ul>x<li>a</li></ul>"],
  ["nesting", "<ol><p>a</p></ol>"],
  ["nesting", "<pre>\n<code>a</code></pre>"],
  ["nesting", "<pre><b>a</b></pre>"],
  ["nesting", "<code><b>a</b></code>"],
  ["nesting", `${"<b>".repeat(65)}a${"</b>".repeat(65)}`],
  ["nesting", `${"<blockquote>".repeat(70)}${"</blockquote>".repeat(70)}`],
  ["hidden", "<p>a󠁁b</p>"],
  ["hidden", `<h1 id="doc-${"a".repeat(79)}\ud840">a</h1>`],
];
const ACCEPTED = [
  "",
  "plain text",
  "<p>a &lt;b&gt; &amp; &quot;c&quot; &#39;d&#39;</p>",
  '<h1 id="doc-a">a</h1>\n<h2 id="doc-décision-決定-2">b</h2>',
  '<p><a href="#/m/demo/doc/runward%2Fx.md">a</a> <a href="#doc-a">b</a> <a href="https://a.example/?a=1&amp;b=&#39;" rel="noopener noreferrer nofollow" target="_blank">c</a></p>',
  "<ul><li>a\n<ol><li><b><i>b</i></b></li></ol></li></ul><hr><blockquote><p>q</p></blockquote>",
  "<table><tr><th>a</th></tr><tr><td><code>b</code></td></tr></table><pre><code>c\n\td</code></pre>",
  "<table><tr><th>a</th><th>b</th></tr><tr><td>1</td></tr><tr></tr></table>",
  `${"<b>".repeat(60)}a${"</b>".repeat(60)}`,
  '<blockquote><ul><li><p>a <a href="#/x"><b><i><code>b</code></i></b></a></p>\n<table><tr><td><i>c</i></td></tr></table></li></ul>\ntext</blockquote>',
];

test("the check on the way out refuses each output outside the closed lists, with its reason, and accepts the renderer's", () => {
  assert.ok(REFUSED.length >= 80);
  for (const [why, html] of REFUSED) {
    const c = documents.checkRendered(html);
    assert.equal(c.ok, false, `accepted: ${html}`);
    assert.equal(c.refusals[0].why, why, `${html}: ${JSON.stringify(c.refusals[0])}`);
    assert.ok(Number.isInteger(c.refusals[0].at) && typeof c.refusals[0].found === "string");
  }
  for (const html of ACCEPTED) {
    assert.deepEqual(documents.checkRendered(html), { ok: true, refusals: [] }, html);
    assert.deepEqual(read(html).problems, [], html);
  }
  for (const v of [null, undefined, 1, {}, ["<p>a</p>"]]) assert.equal(documents.checkRendered(v).refusals[0].why, "not-a-string");
  assert.equal(documents.checkRendered("<script>".repeat(500)).refusals.length, 20, "the list of refusals is bounded");
});

const CHECK_LOOSENED = [
  { name: "the list of elements gains one", edits: [[`"hr", "a"];`, `"hr", "a", "script"];`]] },
  { name: "any attribute is accepted", edits: [[`if (attrs.some((a) => !allowed.includes(a[0]))) refuse(lt, "attribute", tag);`, `if (false) refuse(lt, "attribute", tag);`]] },
  { name: "any address is accepted", edits: [[`else refuse(lt, "href", tag);`, `else { /* accepted */ }`]] },
  { name: "an address with credentials is accepted", edits: [[`return AUTHORITY.test(authority);`, `return authority !== "";`]] },
  { name: "the rel of an absolute link is not read", edits: [[`httpsOnly(href) && attrs[1][1] === EXTERNAL_REL && attrs[2][1] === EXTERNAL_TARGET`, `httpsOnly(href) && attrs[2][1] === EXTERNAL_TARGET`]] },
  { name: "text is not read", edits: [[`if (bad) refuse(i + bad.index, "text", t.slice(bad.index));`, ``]] },
  { name: "an entity outside the five is accepted in text", edits: [[`const TEXT_REFUSED = /[>]|&(?!(?:amp|lt|gt|quot|#39);)/;`, `const TEXT_REFUSED = /[>]/;`]] },
  { name: "hidden characters are not looked for", edits: [[`if (hidden) refuse(`, `if (false) refuse(`]] },
  { name: "a link may hold a link", edits: [[`if (name === "a" && anchors > 0) refuse(lt, "nesting", tag);`, ``]] },
  { name: "an element left open is accepted", edits: [[`if (stack.length) refuse(n, "nesting", stack[stack.length - 1]);`, ``]] },
  { name: "a tag never closed is accepted", edits: [[`if (gt === -1) { refuse(lt, "tag", html.slice(lt)); break; }`, `if (gt === -1) break;`]] },
  { name: "a heading's id is not read", edits: [["if (names !== \"id\" || !SLUG.test(`#${attrs[0][1]}`)) refuse(lt, \"attribute\", tag);", ""]] },
  { name: "an attribute's value may hold a bare ampersand or a <", edits: [[`if (value.includes("<") || BARE_AMPERSAND.test(value)) return null;`, ``]] },
  { name: "an element may hold any element", edits: [[`else if (HOLDS[holder] && !HOLDS[holder].includes(name)) refuse(lt, "nesting", tag);`, ``]] },
  { name: "a paragraph may hold a block", edits: [[`pre: ["code"], code: [], p: INLINE,`, `pre: ["code"], code: [],`]] },
  { name: "a table may hold text between its rows", edits: [[`if (TEXTLESS.has(stack[stack.length - 1])) refuse(i, "nesting", t);`, ``]] },
  { name: "any depth is accepted", edits: [[`if (stack.length >= MAX_NESTING) refuse(lt, "nesting", tag);`, ``]] },
  { name: "tag characters are not looked for", edits: [[`const HIDDEN = /\\udb40[\\udc00-\\udc7f]|[`, `const HIDDEN = /[`]] },
];

test("planted controls: each rule of the check, loosened alone, accepts an output it must refuse", async () => {
  for (const p of CHECK_LOOSENED) {
    const mod = await planted(...p.edits);
    const accepted = REFUSED.filter(([, html]) => mod.checkRendered(html).ok);
    assert.ok(accepted.length > 0, `every refusal still holds when ${p.name}`);
  }
});

// ------------------------------------------------------------------ the time bound
const PATHOLOGICAL = {
  "open brackets": "[".repeat(100_000),
  "open links": "[a](".repeat(25_000),
  "open links with titles": "[a](x (".repeat(14_286),
  "open links in angle brackets": "[a](<".repeat(20_000),
  "open images": "![".repeat(50_000),
  "stars that never close": "*a ".repeat(33_334),
  "nested stars that close": "*a ".repeat(16_667) + "a* ".repeat(16_667),
  "nested double stars that close": "**a ".repeat(12_500) + "a** ".repeat(12_500),
  "nested underscores that close": "_a ".repeat(16_667) + "a_ ".repeat(16_667),
  "a table of 64 columns and short rows": `${"|a".repeat(64)}\n${"|-".repeat(64)}\n${"|\n".repeat(49_870)}`,
  "a table of 64 columns and rows of bars": `${"|a".repeat(64)}\n${"|-".repeat(64)}\n${`${"|".repeat(65)}\n`.repeat(1_511)}`,
  "underscores": "_a_".repeat(33_334),
  "alternating emphasis": "*_".repeat(50_000),
  "backticks that never close": "`a ".repeat(33_334),
  "backtick runs of every length": Array.from({ length: 445 }, (_, k) => "`".repeat(k + 1)).join(" "),
  "less-than signs": "<".repeat(100_000),
  "open autolinks": "<https://a".repeat(10_000),
  "bare addresses": "https://".repeat(12_500),
  "quote marks on one line": ">".repeat(100_000),
  "nested quotes": "> ".repeat(50_000),
  "list markers on one line": "- ".repeat(50_000),
  "nested lists": Array.from({ length: 4_200 }, (_, k) => `${" ".repeat(k % 40)}- x`).join("\n"),
  "loose items": "- a\n\n".repeat(20_000),
  "blank lines after an item": `- a${"\n".repeat(100_000)}`,
  "bars": "|".repeat(100_000),
  "tables": `${"|a".repeat(50)}\n${"|-".repeat(50)}\n`.repeat(500),
  "a heading followed by spaces": `# a${" ".repeat(100_000)}b`,
  "headings": "#\n".repeat(50_000),
  "entities": "&#x3c;".repeat(16_667),
  "backslashes": "\\".repeat(100_000),
  "fences": "```\n".repeat(25_000),
  "hidden characters": "\u202e\u0000".repeat(50_000),
};
// The bound is relative to the machine that runs the test: ten times the CPU time the same module takes on
// a plain document of the same size (PLAIN, a sound input), and never under 200 ms. A fixed 200 ms failed on
// a slower CI runner (Windows, 2026-11-11: "headings" in 203 ms, 55 ms on macOS). Measured on macOS the same
// day: the worst pathological input takes about 3 times PLAIN, a planted quadratic scan 26 to 50 times; ten
// leaves room on both sides. Under the coverage run (`npm run coverage`, node --experimental-test-coverage,
// which sets NODE_V8_COVERAGE in the test process) the floor doubles; PLAIN slows down with the code.
const PLAIN = Array.from({ length: 1_700 }, (_, k) => `Paragraph ${k} with **bold**, a [link](docs/a.md) and \`code\`.\n`).join("\n");
const FLOOR_MS = process.env.NODE_V8_COVERAGE ? 400 : 200;
const RATIO = 10;
let BOUND_MS = FLOOR_MS; // set from PLAIN at the start of the time bound's test
const GROWTH_SOUND = 10; // linear is about 4 from 50 KB to 200 KB (4.3 to 4.8 at rest); 8.1 was seen under load
const GROWTH_QUADRATIC = 12; // quadratic is about 16 (16.9 to 19.9 measured); 12 stays above the sound module's worst
/** Best elapsed time of `n` calls, in milliseconds, on the high-resolution clock. Not CPU time: on Windows
 *  process.cpuUsage() ticks in steps of about 15 ms, so a short render read 0 and a growth read 124 times
 *  (CI, 2026-11-11). The best of several runs removes the load's noise. */
function wallBest(f, n) { let ms = Infinity; for (let k = 0; k < n; k++) { const t0 = performance.now(); f(); ms = Math.min(ms, performance.now() - t0); } return ms; }
const BOUND_GROWTH = 20; // an output is at most this many times its source: the widest is a heading of one character
/** CPU time of a call, in milliseconds, the best of five: a measure that the load of the machine does not stretch. */
function best(f) {
  let ms = Infinity;
  let out;
  for (let k = 0; k < 5 && ms >= BOUND_MS / 4; k++) { const t0 = process.cpuUsage(); out = f(); const t = process.cpuUsage(t0); ms = Math.min(ms, (t.user + t.system) / 1000); }
  return [ms, out];
}

test("time bound: 100 KB of each pathological input renders in under ten times a plain document's CPU time (at least 200 ms), grows at most 20 times and is checked within the same bound; planted quadratic scans and a planted filling of rows are caught", async () => {
  assert.ok(PLAIN.length >= 96_000 && PLAIN.length <= 120_000, `PLAIN: ${PLAIN.length} characters`);
  let plain = Infinity;
  for (let k = 0; k < 5; k++) { const t0 = process.cpuUsage(); documents.renderDocument(PLAIN, CONTEXT); const t = process.cpuUsage(t0); plain = Math.min(plain, (t.user + t.system) / 1000); }
  BOUND_MS = Math.max(FLOOR_MS, RATIO * plain);
  for (const [name, src] of Object.entries(PATHOLOGICAL)) {
    assert.ok(src.length >= 96_000 && src.length <= 102_000, `${name}: ${src.length} characters`);
    const [render, html] = best(() => documents.renderDocument(src, CONTEXT));
    assert.ok(render < BOUND_MS, `${name}: rendered in ${render.toFixed(0)} ms of CPU, bound ${BOUND_MS.toFixed(0)} ms (PLAIN ${plain.toFixed(0)} ms)`);
    assert.ok(html.length <= BOUND_GROWTH * src.length, `${name}: ${src.length} characters became ${html.length}`);
    const [check, c] = best(() => documents.checkRendered(html));
    assert.ok(check < BOUND_MS, `${name}: checked in ${check.toFixed(0)} ms of CPU, bound ${BOUND_MS.toFixed(0)} ms (PLAIN ${plain.toFixed(0)} ms)`);
    assert.equal(c.ok, true, name);
  }
  // Controls: a quadratic scan is told apart by how its cost GROWS, not by an absolute time. On 2026-11-11 a
  // planted quadratic copy stayed under ten times PLAIN on a Linux runner (Node 24: under 404 ms), so a time
  // bound alone is machine-dependent for the controls. Each shape below is rendered at 50 KB and at 200 KB,
  // after a warm-up: a linear module grows about 4 times, a quadratic one about 16. Measured on macOS the same
  // day: the sound module 3.1 to 5.2 times, the planted copies 16.9 to 19.9 times (25 KB to 100 KB was too
  // noisy: 1.7 to 7.3 for the sound module; the best of 7 runs at 50 KB and of 5 at 200 KB then gave 4.3 to
  // 4.8 for the sound module over 8 rounds). The sound module must grow at most GROWTH_SOUND times on these
  // shapes, each planted copy at least GROWTH_QUADRATIC times; the ratio does not depend on the machine.
  const slow = await planted([`while (e.next < e.at.length && e.at[e.next] < from) e.next++;`, `e.next = 0; while (e.next < e.at.length && e.at[e.next] < from) e.next++;`]);
  const deep = await planted([`const over = frames.length > MAX_DEPTH;`, `const over = false;`]);
  for (const [label, mod, shape] of [
    ["backtick runs read again from the start at each run", slow, (n) => "`a ".repeat(n)],
    ["emphasis joined again at each closing mark (stars)", deep, (n) => "*a ".repeat(n) + "a* ".repeat(n)],
    ["emphasis joined again at each closing mark (double stars)", deep, (n) => "**a ".repeat(n) + "a** ".repeat(n)],
    ["emphasis joined again at each closing mark (underscores)", deep, (n) => "_a ".repeat(n) + "a_ ".repeat(n)],
  ]) {
    const full = Math.round(200_000 / shape(1).length);
    const quarter = Math.round(full / 4);
    const growthOf = (m, fullRuns) => {
      m.renderDocument(shape(quarter), CONTEXT); // warm-up: the first call compiles
      return wallBest(() => m.renderDocument(shape(full), CONTEXT), fullRuns) / Math.max(wallBest(() => m.renderDocument(shape(quarter), CONTEXT), 7), 0.5);
    };
    const sound = growthOf(documents, 5);
    assert.ok(sound <= GROWTH_SOUND, `${label}: the sound module grows ${sound.toFixed(1)} times from a quarter to the full size`);
    const plantedGrowth = growthOf(mod, 2);
    assert.ok(plantedGrowth >= GROWTH_QUADRATIC, `the growth does not see a quadratic scan: ${label} grows ${plantedGrowth.toFixed(1)} times`);
  }
  // Control: short rows filled to the header's width, two characters writing 64 cells, are seen by the bound on growth.
  const filled = await planted([`cells(lines[i++]).slice(0, head.length).map((c) => el("td", inline(c, ctx)))`, `((c) => head.map((_, k) => el("td", inline(c[k] ?? "", ctx))))(cells(lines[i++]))`]);
  const src = PATHOLOGICAL["a table of 64 columns and short rows"];
  const wide = filled.renderDocument(src, CONTEXT);
  assert.ok(wide.length > 200 * src.length, `the planted filling grows the source ${Math.round(wide.length / src.length)} times`);
  assert.ok(documents.renderDocument(src, CONTEXT).length < 5 * src.length);
});

// ------------------------------------------------------------------ real documents
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".md") ? [join(dir, e.name)] : []));

test("real documents: every Markdown file of this repository's mission, records and templates renders inside the closed lists", () => {
  const files = [...walk(join(ROOT, "runward")), ...walk(join(ROOT, "docs")), ...walk(join(ROOT, "templates")), ...walk(join(FIX, "documents")), join(ROOT, "README.md"), join(ROOT, "CHANGELOG.md")];
  assert.ok(files.length > 200, `${files.length} documents`);
  let anchors = 0;
  for (const f of files) {
    const rel = f.slice(ROOT.length + 1).split("\\").join("/");
    const html = documents.renderDocument(readFileSync(f, "utf8"), { ...CONTEXT, path: rel });
    assert.equal(documents.checkRendered(html).ok, true, rel);
    const r = read(html);
    assert.deepEqual(r.problems, [], rel);
    anchors += r.hrefs.length;
  }
  assert.ok(anchors > 500, `links are rendered (${anchors})`);
});

// ------------------------------------------------------------------ the register
const HOSTED = join(FIX, "documents", "hosted");
const hostedFiles = () => readdirSync(join(HOSTED, "adr")).sort().map((f) => ({ path: `runward/adr/${f}`, text: readFileSync(join(HOSTED, "adr", f), "utf8") }));

test("the register is exact on the decision records of a real mission, read at the commit SOURCE.json names", () => {
  const source = JSON.parse(readFileSync(join(HOSTED, "SOURCE.json"), "utf8"));
  const files = hostedFiles();
  const reg = documents.register(files);
  assert.equal(reg.format, "runward-fleet-register/0");
  assert.equal(reg.count, source.records);
  assert.equal(reg.count, files.length - 1, "every file but the template is a record");
  assert.deepEqual(reg.unread, [{ path: "runward/adr/ADR-0000-template.md", why: "template" }]);
  assert.deepEqual(reg.duplicates, []);
  assert.deepEqual(reg.adrs.map((a) => a.number), Array.from({ length: 21 }, (_, k) => String(k + 1).padStart(4, "0")));

  // What each file says, written here by hand from the files.
  const SAYS = {
    "0001": ["accepted", "2026-11-06"], "0002": ["accepted", "2026-11-06"], "0003": ["accepted", "2026-11-06"], "0004": ["accepted", "2026-11-06"],
    "0005": ["accepted", "2026-11-06"], "0006": ["accepted", "2026-11-06"], "0007": ["accepted", "2026-11-06"], "0008": ["accepted", "2026-11-06"],
    "0009": ["accepted", "2026-11-06"], "0010": ["accepted", "2026-11-06"], "0011": ["accepted", "2026-11-06"], "0012": ["accepted", "2026-11-06"],
    "0013": ["accepted", "2026-11-06"], "0014": ["superseded", "2026-11-06"], "0015": ["accepted", "2026-11-06"], "0016": ["accepted", "2026-11-08"],
    "0017": ["accepted", "2026-11-08"], "0018": ["accepted", "2026-11-10"], "0019": ["accepted", "2026-11-10"], "0020": ["accepted", "2026-11-10"],
    "0021": ["proposed", "2026-11-10"],
  };
  for (const a of reg.adrs) {
    assert.deepEqual([a.status, a.date], SAYS[a.number], `ADR-${a.number}`);
    assert.equal(a.titleNumber, a.number, `ADR-${a.number}: the title line carries the file's number`);
    assert.equal(a.reopening.setOn, a.date, `ADR-${a.number}: its trigger was set on the day it was written`);
    assert.ok(a.title && a.deciders && a.method && a.reopening.text && a.reopening.watchedVia && a.references.length >= 1, `ADR-${a.number}: every field of the template is read`);
  }
  const by = Object.fromEntries(reg.adrs.map((a) => [a.number, a]));
  assert.deepEqual(reg.adrs.filter((a) => a.supersedes.length || a.refines.length || a.supersededBy).map((a) => [a.number, a.supersedes, a.refines, a.supersededBy]), [
    ["0014", [], [], "0019"], ["0018", [], ["0002"], null], ["0019", ["0014"], [], null], ["0020", [], ["0009"], null], ["0021", [], ["0018"], null],
  ]);
  assert.equal(by["0001"].title, "One Node.js monolith, no web framework, the domain behind ports, one network exit");
  assert.equal(by["0001"].statusWritten, "accepted");
  assert.equal(by["0021"].statusWritten, "proposed (written by an agent session; acceptance is the author's)");
  assert.ok(by["0014"].statusWritten.startsWith("superseded by ADR-0019 (2026-11-10); accepted (2026-11-08)"), "a status is kept as written, whole");
  assert.equal(by["0021"].title, "runward-fleet re-pinned at main@d05b597, the commit where PR #499 merged; the archive digest, not the version, names the build (refines ADR-0018)");
  assert.deepEqual(reg.adrs.filter((a) => a.settles !== null).map((a) => a.number), ["0016", "0018", "0019", "0020", "0021"], "what would settle it: read where the file holds the section, null elsewhere");
  assert.deepEqual(reg.byStatus, [
    { status: "proposed", n: 1, of: 21, numbers: ["0021"] },
    { status: "accepted", n: 19, of: 21, numbers: reg.adrs.map((a) => a.number).filter((n) => n !== "0014" && n !== "0021") },
    { status: "superseded", n: 1, of: 21, numbers: ["0014"] },
    { status: "deprecated", n: 0, of: 21, numbers: [] },
    { status: "as-written", n: 0, of: 21, numbers: [] },
    { status: "not-observed", n: 0, of: 21, numbers: [] },
  ]);

  // The same header, read a second way: each `**Field**:` line of the file, found by a plain search.
  for (const f of files.slice(1)) {
    const a = by[/ADR-(\d{4})/.exec(f.path)[1]];
    const line = (k) => f.text.split("\n").find((l) => l.startsWith(`**${k}**: `))?.slice(k.length + 6) ?? null;
    assert.equal(a.dateWritten, line("Date"));
    assert.equal(a.statusWritten, line("Status"));
    assert.equal(a.deciders, line("Deciders"));
    assert.equal(a.method, line("Method"));
    assert.deepEqual(a.refines, line("Refines") ? [/^ADR-(\d{4})/.exec(line("Refines"))[1]] : []);
    assert.deepEqual(a.supersedes, line("Supersedes") ? [/^ADR-(\d{4})/.exec(line("Supersedes"))[1]] : []);
    assert.equal(f.text.split("\n")[0], `# ADR-${a.number}: ${a.title}`);
  }

  const golden = join(HOSTED, "register.golden.json");
  const bytes = `${JSON.stringify(reg, null, 2)}\n`;
  if (UPDATE) writeFileSync(golden, bytes);
  assert.equal(bytes, readFileSync(golden, "utf8"), "the register of the real mission is golden");
  assert.deepEqual(documents.register([...files].reverse()), reg, "the order of the files does not change the register");
});

test("the register says nothing a file does not: a field not found is null, an unknown status is shown as written, a relation is never mirrored", () => {
  const f = (name, text) => ({ path: `runward/adr/${name}`, text });
  const reg = documents.register([
    f("ADR-0003-c.md", "# ADR-0003: Third\n\n**Date**: soon\n**Status**: rejected by the team\n\n## Context\n\n**Status**: accepted\n"),
    f("ADR-0001-a.md", "# ADR-0001: First <script>alert(1)</script>\n\n**Date**: 2026-01-02\n**Status**: Accepted\n**Supersedes**: ADR-0007 (x), ADR-0008 and ADR-0009, which also mention ADR-0010\n**Refines**: see ADR-0011\n\n## Reevaluation trigger (mandatory, dated)\n\nReopen when x.\n\n## References\n\n- a\n* b\ntext\n"),
    f("ADR-0002-b.md", "no title line\n"),
    f("ADR-0002-b-again.md", "# ADR-0009: The number of another file\n\n**Status**: acceptedly\n"),
    f("ADR-0004-d.md", "\n\n# ADR-0004: \n**Status**: superseded\n**Status**: accepted\n"),
    f("ADR-0005-e.md", "# ADR-0005: Deprecated\n**Status**: deprecated; superseded by ADR-0001\n"),
    f("ADR-0000-template.md", "# ADR-[number]: [short decision title]\n\n**Status**: [proposed | accepted]\n"),
    f("notes.md", "# notes"),
    f("ADR-12-short.md", "# ADR-12"),
    f("DRAFT-ADR-0006-x.md", "# ADR-0006: draft"),
    { path: "runward/adr/ADR-0006-f.md" },
    { path: "runward/architecture.md", text: "# ADR-0099: not in adr/\n**Status**: accepted" },
    { path: "runward/adr/nested/ADR-0098-x.md", text: "# ADR-0098: nested" },
    null, 7, { text: "x" },
  ]);
  assert.equal(reg.count, 6);
  assert.deepEqual(reg.adrs.map((a) => [a.number, a.path.slice(12), a.status, a.statusWritten, a.date]), [
    ["0001", "ADR-0001-a.md", "accepted", "Accepted", "2026-01-02"],
    ["0002", "ADR-0002-b-again.md", null, "acceptedly", null],
    ["0002", "ADR-0002-b.md", null, null, null],
    ["0003", "ADR-0003-c.md", null, "rejected by the team", null],
    ["0004", "ADR-0004-d.md", "superseded", "superseded", null],
    ["0005", "ADR-0005-e.md", null, "deprecated; superseded by ADR-0001", null],
  ]);
  const [first, again, untitled, third, fourth, fifth] = reg.adrs;
  assert.equal(first.title, "First <script>alert(1)</script>", "a title is the file's text: the view escapes it");
  assert.deepEqual(first.supersedes, ["0007", "0008", "0009"], "the records a line names first, not every record it mentions");
  assert.deepEqual(first.refines, [], "a line that does not start with a record names none");
  assert.deepEqual(first.reopening, { text: "Reopen when x.", setOn: null, watchedVia: null });
  assert.deepEqual(first.references, ["a", "b"]);
  assert.equal(first.settles, null);
  assert.deepEqual([again.title, again.titleNumber], ["The number of another file", "0009"], "the number is the file name's; the title line's is given beside it");
  assert.deepEqual([untitled.title, untitled.titleNumber, untitled.reopening, untitled.references, untitled.deciders], [null, null, null, null, null]);
  assert.equal(third.dateWritten, "soon");
  assert.deepEqual([fourth.title, fourth.supersededBy], [null, null], "superseded without a record named: none is guessed");
  assert.deepEqual([fifth.status, fifth.supersededBy], [null, null], "two statuses on a line: neither is chosen, and superseded by is read on a status that starts with it");
  assert.deepEqual(reg.duplicates, ["0002"]);
  assert.deepEqual(reg.byStatus.map((g) => [g.status, g.n, g.of, g.numbers]), [
    ["proposed", 0, 6, []], ["accepted", 1, 6, ["0001"]], ["superseded", 1, 6, ["0004"]], ["deprecated", 0, 6, []], ["as-written", 3, 6, ["0002", "0003", "0005"]], ["not-observed", 1, 6, ["0002"]],
  ]);
  assert.equal(reg.byStatus.reduce((n, g) => n + g.n, 0), reg.count, "each record is in one group");
  assert.deepEqual(reg.unread, [
    { path: "runward/adr/ADR-0000-template.md", why: "template" }, { path: "runward/adr/ADR-0006-f.md", why: "no-text" }, { path: "runward/adr/ADR-12-short.md", why: "not-a-record-name" },
    { path: "runward/adr/DRAFT-ADR-0006-x.md", why: "not-a-record-name" }, { path: "runward/adr/notes.md", why: "not-a-record-name" },
  ]);
  for (const empty of [undefined, null, [], "x", {}]) assert.deepEqual(documents.register(empty), { format: "runward-fleet-register/0", count: 0, adrs: [], byStatus: reg.byStatus.map((g) => ({ status: g.status, n: 0, of: 0, numbers: [] })), duplicates: [], unread: [] });
});

test("planted controls on the register: a status guessed, a template counted, a relation read from the whole line, each is caught on the real mission", async () => {
  const real = documents.register(hostedFiles());
  for (const [name, ...edits] of [
    ["an unknown status reads accepted", [`.test(status)) ?? null;`, `.test(status)) ?? "accepted";`]],
    ["the first word is found anywhere in the status", ["new RegExp(`^${w}(?![a-z-])`, \"i\")", "new RegExp(`${w}`, \"i\")"]],
    ["the template is a record", [`if (m[1] === "0000") { unread.push({ path, why: "template" }); continue; }`, ``]],
    ["every record a line mentions is a relation", [`const m = ADR_ID.exec(s);`, `const m = /ADR-([0-9]{4})/.exec(s); if (m) s = s.slice(m.index);`]],
    ["a field is read below the header", [`i > 0 && i < lines.length && !lines[i].startsWith("## "); i++)`, `i > 0 && i < lines.length; i++)`]],
  ]) {
    const mod = await planted(...edits);
    const synthetic = mod.register([{ path: "adr/ADR-0001-a.md", text: "# ADR-0001: A\n\n**Status**: rejected, not accepted\n\n## Context\n\n**Date**: 2026-01-01\n" }]);
    const same = JSON.stringify(mod.register(hostedFiles())) === JSON.stringify(real) && synthetic.adrs[0].status === null && synthetic.adrs[0].date === null;
    assert.ok(!same, `the register is unchanged when ${name}`);
  }
});

// What a line says beyond its first word, and what a reader of the record does not see as a field.
const rec = (n, header) => ({ path: `runward/adr/ADR-${n}-x.md`, text: `# ADR-${n}: A record\n\n${header}\n\n## Context\n\nText.\n` });
const SAID = [
  // [number, the header, status, supersededBy, statusWritten when it is not the header's only line]
  ["0031", "**Status**: accepted, then superseded by ADR-0030 (2026-11-10)", null, null],
  ["0032", "**Status**: accepted; deprecated on 2026-11-10", null, null],
  ["0033", "**Status**: accepted: no, rejected by the author", null, null],
  ["0034", "**Status**: Superseded by [ADR-0030](ADR-0030-x.md)", "superseded", "0030"],
  ["0035", "**Status**: superseded by ADR-00301", "superseded", null],
  ["0036", "**Status**: superseded by ADR-0019 (2026-11-10); accepted (2026-11-08), ratified by the author", "superseded", "0019"],
  ["0037", "**Status**: superseded by ADR-0019 (2026-11-10); withdrawn", null, null],
  ["0038", "**Status**: accepted (accepted by the author, 2026-11-10)", "accepted", null],
  ["0039", "**Status**: proposed (acceptance is the author's)", "proposed", null],
  ["0040", "**Status**: accepted, then withdrawn", null, null],
  ["0041", "**Status**: proposed, not accepted", null, null],
  ["0042", "**Status**: superseded by [ADR-0030: its title](../adr/ADR-0030-x.md); accepted (2026-11-08)", "superseded", "0030"],
  ["0043", "**Status**: superseded by [ADR-00301](x.md)", "superseded", null],
  ["0044", "**Status**: deprecated (superseded in practice)", null, null],
  ["0045", "<!-- **Status**: accepted -->\n**Status**: rejected", null, null, "rejected"],
  ["0046", "<!--\n**Status**: accepted\n**Date**: 2026-01-01\n-->\n**Status**: proposed", "proposed", null, "proposed"],
  ["0047", "```\n**Date**: 2026-01-01\n**Status**: accepted\n```\n**Date**: 2026-02-02", null, null, null],
  ["0048", "~~~~\n<!--\n```\n~~~~\n**Status**: accepted", "accepted", null, "accepted"],
  ["0049", "**Status**: accepted <!-- superseded by ADR-0030 -->", null, null],
  ["0050", "**Date**: 2026-03-03 <!--\n**Status**: accepted\n--> **Status**: accepted\n**Deciders**: the author", null, null, null],
  ["0051", "<!-- a --> <!-- b\n**Status**: accepted\n-->\n**Status**: deprecated", "deprecated", null, "deprecated"],
];

test("the register reads a status only where the line says one: a second status word, a comment or a fence leaves it as written or not observed", () => {
  const reg = documents.register(SAID.map(([n, header]) => rec(n, header)));
  for (const [k, [n, header, status, by, written]] of SAID.entries()) {
    const a = reg.adrs[k];
    const expected = SAID[k].length === 5 ? written : header.slice("**Status**: ".length);
    assert.deepEqual([a.number, a.status, a.supersededBy, a.statusWritten], [n, status, by, expected], `ADR-${n}: ${header}`);
  }
  const by = Object.fromEntries(reg.adrs.map((a) => [a.number, a]));
  assert.equal(by["0046"].date, null, "a date in a comment is not read");
  assert.equal(by["0047"].date, "2026-02-02", "a date in a fence is not read, the one after it is");
  assert.deepEqual([by["0050"].date, by["0050"].deciders], ["2026-03-03", "the author"], "a field is read before a comment opens and after it closes");
  assert.deepEqual(reg.byStatus.map((g) => [g.status, g.n]), [["proposed", 2], ["accepted", 2], ["superseded", 5], ["deprecated", 1], ["as-written", 9], ["not-observed", 2]]);
  assert.equal(reg.byStatus.reduce((n, g) => n + g.n, 0), reg.count, "each record is in one group");

  const rel = documents.register([
    rec("0060", "**Supersedes**: [ADR-0007](ADR-0007-x.md) (the reason), [ADR-0008: its title](x.md) and ADR-00091, ADR-0010\n**Refines**: ADR-00021"),
    rec("0061", "**Supersedes**: ADR-0007, [ADR-0008 never closed\n**Refines**: [ ADR-0002](x.md), ADR-0003 (why) and [ADR-0004](y.md"),
  ]).adrs;
  assert.deepEqual([rel[0].supersedes, rel[0].refines], [["0007", "0008"], []], "a linked record is read; a number that goes on with a digit is not a record");
  assert.deepEqual([rel[1].supersedes, rel[1].refines], [["0007"], ["0002", "0003"]], "a link that does not close names no record");
});

test("planted controls on the reading of a status: each rule, loosened alone, changes what the register says of exactly the lines it holds", async () => {
  const files = [...SAID.map(([n, header]) => rec(n, header)), rec("0060", "**Supersedes**: [ADR-0007](ADR-0007-x.md), ADR-00091\n**Status**: superseded by ADR-00301")];
  const said = JSON.stringify(documents.register(files));
  const same = (mod, numbers) => { const a = JSON.parse(said).adrs; const b = mod.register(files).adrs; return a.filter((x, k) => JSON.stringify(x) !== JSON.stringify(b[k])).map((x) => x.number).join(" ") === numbers; };
  for (const [name, changed, ...edits] of [
    ["a second status word is not looked for", "0031 0032 0033 0037 0040 0041 0044 0049", [`contradicted(status, starts, by !== null) ? null : starts`, `false ? null : starts`]],
    ["any word may follow superseded by a record", "0037", [`(history && REGISTER_STATUSES.includes(w))`, `history`]],
    ["a status of the template may follow any first word", "0031 0032 0041 0044 0049", [`(history && REGISTER_STATUSES.includes(w))`, `REGISTER_STATUSES.includes(w)`]],
    ["a commented line is a field", "0046 0050 0051", [`if (commented) continue; // a field is a line a reader of the record sees as one`, ``]],
    ["a fenced line is a field", "0047 0048", [`if (f) { fence = f[1]; continue; }`, ``]],
    ["a record's number may go on with a digit", "0035 0043 0060", [`const SUPERSEDED_BY = /^superseded +by +(?:\\[ *)?ADR-([0-9]{4})(?![0-9])/i;`, `const SUPERSEDED_BY = /^superseded +by +(?:\\[ *)?ADR-([0-9]{4})/i;`], [`const ADR_ID = /^(?:\\[ *)?ADR-([0-9]{4})(?![0-9])/;`, `const ADR_ID = /^(?:\\[ *)?ADR-([0-9]{4})/;`]],
    ["a linked record is not read", "0034 0042 0060", [`const SUPERSEDED_BY = /^superseded +by +(?:\\[ *)?ADR-`, `const SUPERSEDED_BY = /^superseded +by +ADR-`], [`const ADR_ID = /^(?:\\[ *)?ADR-`, `const ADR_ID = /^ADR-`]],
  ]) {
    const mod = await planted(...edits);
    assert.ok(same(mod, changed), `${name}: the records read otherwise are ${JSON.parse(said).adrs.filter((x, k) => JSON.stringify(x) !== JSON.stringify(mod.register(files).adrs[k])).map((x) => x.number).join(" ")}`);
  }
});

// ------------------------------------------------------------------ the topology note
test("topology: the port placement table of a real mission, its cells as written, its ports grouped by location family with n / N", () => {
  const t = documents.topology(readFileSync(join(HOSTED, "execution-topology.md"), "utf8"));
  assert.equal(t.format, "runward-fleet-topology/0");
  assert.equal(t.found, true);
  assert.equal(t.columns.length, 7);
  assert.deepEqual(t.ports.map((p) => p.port), ["TenantStore and Ledger", "ExportStore, SecurityLog, Archive", "EntryPort (HTTP)", "OperatorEntry (the operator's gateway)", "WorkloadVerifier", "HumanAuthenticator", "IndexAssembler", "Clock, Log"]);
  assert.deepEqual(t.families.map((f) => [f.family, f.n, f.of]), [["Managed infrastructure service", 2, 8], ["In-app", 4, 8], ["In-app (a second process)", 1, 8], ["Existing infrastructure", 1, 8]]);
  assert.equal(t.families.reduce((n, f) => n + f.n, 0), t.ports.length);
  assert.deepEqual(t.ports[4], { port: "WorkloadVerifier", adapter: "in-app, reads GitHub's public keys", family: "In-app", dataClasses: "public reference (public keys)", level: "standard", adr: "ADR-0003", trigger: "GitLab declared", example: false });
  assert.ok(t.ports.every((p) => !p.example));
});

test("topology: the template's rows are marked as examples, a note without the table is not found, and a cell is never interpreted", () => {
  const t = documents.topology(readFileSync(join(ROOT, "templates", "mission", "execution-topology.md"), "utf8"));
  assert.deepEqual(t.ports.map((p) => [p.port, p.example]), [["_e.g._ Model port", true], ["_e.g._ Persistence port", true], ["_e.g._ Trace sink", true]]);
  const none = { format: "runward-fleet-topology/0", found: false, columns: [], ports: [], families: [] };
  assert.deepEqual(documents.topology("# Topology\n\n| Rule | Status |\n|---|---|\n| a | applied |\n"), none);
  assert.deepEqual(documents.topology("| Port | Location family |\n| a | In-app |\n"), none, "a table needs its divider");
  assert.deepEqual(documents.topology(""), none);
  assert.deepEqual(documents.topology(null), none);
  const hostile = documents.topology("| Port | Location family | ADR |\n|---|---|---|\n| <script>alert(1)</script> | <img src=x> | [a](javascript:alert(1)) |\n| b |\n");
  assert.deepEqual(hostile.ports, [
    { port: "<script>alert(1)</script>", adapter: null, family: "<img src=x>", dataClasses: null, level: null, adr: "[a](javascript:alert(1))", trigger: null, example: false },
    { port: "b", adapter: null, family: null, dataClasses: null, level: null, adr: null, trigger: null, example: false },
  ]);
  assert.deepEqual(read(documents.renderDocument(hostile.ports[0].port)).tags, ["p"], "a cell goes to the page through the renderer or an escape, like any text of a document");
});
