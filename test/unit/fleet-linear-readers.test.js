// RWD-2026-0206: runward-fleet reads the views, the page and the trust policy in linear time.
//
// CodeQL's code scanning raised eight polynomial-time patterns on the first integration pull request of
// 2026-11-06, in the view rules (src/rules.js), the repository names of the trust policy (src/trust.js)
// and the markdown of the pull-request view (ui/views.js). Measured the same day on adversarial text of
// 100,000 characters, with five more the static analyzers found in the same functions: a run of `<`
// read by `ownText` 9 s, a run of slashes by `normRepo` 7.8 s, a `<script ` run by the page rules
// 1.1 s, and every count of a view looked up again in the whole view (9.6 s at 400,000 characters).
// Each is quadratic, so a view of a megabyte is minutes. One more alert, on the reading of an index
// path, measured linear (the loop stops at the first token that does not follow the last), and is
// rewritten anyway.
//
// Held here, for each reader: the answers of the pattern it replaces, on generated inputs (the former
// patterns are kept below as the reference), and the time it takes on the adversarial text at
// 1,000,000 characters, as CPU time, under a ceiling the former patterns exceed by seconds to minutes.
// And the other alert on the markdown reader, an "incomplete multi-character sanitization", held as
// what it is: a `<!--` left in the text is written escaped, never as markup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "packages", "runward-fleet");
const rules = await import(join(PKG, "src", "rules.js"));
const trust = await import(join(PKG, "src", "trust.js"));
const views = await import(join(PKG, "ui", "views.js"));

const SIZE = 1_000_000;
const CEILING_MS = 2000;
const INDEX_OPEN = '<script type="application/json" id="runward-fleet-index">';

// ── The former patterns, kept as the reference ─────────────────────────────────────────────────────
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const OLD = {
  ownText: (html) => decode(String(html)
    .replace(/<!--verbatim:start-->[\s\S]*?<!--verbatim:end-->/g, " ")
    .replace(/<span data-verbatim>[^<]*<\/span>/g, " ")
    .replace(/<code>[^<]*<\/code>/g, " ")
    .replace(/<title>[^<]*<\/title>/g, " ")
    .replace(/<[^>]+>/g, " ")),
  resolvePath(root, path) {
    let cur = root;
    const re = /([A-Za-z_$][\w$-]*)|\[(\d+)\]|\[([A-Za-z_$][\w$-]*)=([^\]]*)\]/g;
    let m;
    let at = 0;
    while ((m = re.exec(path))) {
      if (m.index !== at && !(path[at] === "." && m.index === at + 1)) return undefined;
      at = re.lastIndex;
      if (cur === undefined || cur === null) return undefined;
      if (m[1] !== undefined) cur = cur[m[1]];
      else if (m[2] !== undefined) cur = cur[Number(m[2])];
      else cur = Array.isArray(cur) ? cur.find((x) => String(x?.[m[3]]) === m[4]) : undefined;
    }
    return at === path.length ? cur : undefined;
  },
  numberSpans: (html) => [...String(html).matchAll(/<span class="n( na)?"[^>]*?data-index="([^"]*)"[^>]*>([^<]*)<\/span>/g)].map(([, na, path, shown]) => ({ na, path, shown })),
  withoutDataUrls: (t) => t.replace(/url\(\s*["']?data:[^)]*\)/g, "url()"),
  hasExternalScript: (t) => /<script\b[^>]*\bsrc=/i.test(t),
  index: (s) => (s.match(/<script type="application\/json" id="runward-fleet-index">([\s\S]*?)<\/script>/) ?? [])[1],
  withoutIndex: (s) => s.replace(/<script type="application\/json" id="runward-fleet-index">[\s\S]*?<\/script>/, ""),
  style: (s) => (s.match(/<style>([\s\S]*?)<\/style>/) ?? [])[1],
  normRepo: (s) => String(s ?? "").replace(/^https?:\/\//, "").replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase(),
  withoutComments: (s) => s.replace(/<!--[\s\S]*?-->/g, ""),
};

// ── Generated inputs: strings of fragments chosen to meet every branch of each pattern ────────────
function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function* generated(seed, count, fragments, maxParts = 24) {
  const r = prng(seed);
  for (let i = 0; i < count; i++) {
    let s = "";
    const n = Math.floor(r() * maxParts);
    for (let j = 0; j < n; j++) s += fragments[Math.floor(r() * fragments.length)];
    yield s;
  }
}
const differs = (name, gen, same) => {
  let n = 0;
  for (const input of gen) { n++; const why = same(input); if (why) assert.fail(`${name}: differs on ${JSON.stringify(input)}: ${why}`); }
  return n;
};

test("ownText: the verbatim blocks and the tags come out as the former patterns took them out", () => {
  const n = differs("ownText", generated(1, 30_000, ["<!--verbatim:start-->", "<!--verbatim:end-->", "<!--verbatim:", "<span data-verbatim>", "</span>", "<code>", "</code>",
    "<title>", "</title>", "<", ">", "<>", "a", " ", "&lt;", "&amp;", "\n", "<b>", "x>", "<<"]), (s) => {
    const [a, b] = [OLD.ownText(s), rules.ownText(s)];
    return a === b ? null : `${JSON.stringify(a)} != ${JSON.stringify(b)}`;
  });
  assert.equal(n, 30_000);
  // The two literal-pair readers on their own, beside the patterns they stand for.
  differs("replaceBetween", generated(2, 20_000, ["<!--", "-->", "-", ">", "<", "a", "<!-", "--", "<!--->"]), (s) => {
    const [a, b] = [s.replace(/<!--[\s\S]*?-->/g, "#"), rules.replaceBetween(s, "<!--", "-->", "#")];
    return a === b ? null : `${a} != ${b}`;
  });
  differs("firstBetween", generated(3, 20_000, [INDEX_OPEN, "</script>", "<style>", "</style>", "x", "<", "</scr"]), (s) => {
    const idx = rules.firstBetween(s, INDEX_OPEN, "</script>");
    if ((idx?.inner) !== OLD.index(s)) return "the inline index";
    if ((idx ? s.slice(0, idx.start) + s.slice(idx.end) : s) !== OLD.withoutIndex(s)) return "the page without its index";
    if ((rules.firstBetween(s, "<style>", "</style>")?.inner) !== OLD.style(s)) return "the style";
    return null;
  });
});

test("resolvePath: the same value as the former pattern for every generated path, on one index", () => {
  const root = { missions: [{ id: "a", latest: { n: 1, list: [1, 2], "a-b": "x" } }, { id: "b", latest: null }, { id: "1" }],
    a: { b: { c: 3 } }, $: { _: 7 }, "a-b": 2, 0: "zero", x: [{ x: "" }, { x: "1" }, null], n: null };
  const n = differs("resolvePath", generated(4, 60_000, ["missions", "a", "b", "c", "$", "_", "-", "n", "x", "latest", "list", "id", ".", "[", "]", "=", "0", "1", "[0]", "[1]",
    "[id=a]", "[id=1]", "[x=]", "[x=1]", "[1", "[a", "\\", " ", "..", "[$=", "a-b"], 10), (p) => {
    const [a, b] = [OLD.resolvePath(root, p), rules.resolvePath(root, p)];
    return a === b ? null : `${JSON.stringify(a)} != ${JSON.stringify(b)}`;
  });
  assert.equal(n, 60_000);
});

test("the numbers of a view and the paths it names: the former pattern's matches, and its substring test", () => {
  const n = differs("numberSpans", generated(5, 40_000, ['<span class="n"', '<span class="n na"', '<span class="n', " na", '"', 'data-index="', ">", "<", "</span>", "a", "x.n", " ",
    "<span", 'data-index=""', "</span", "na", '"n', ">5<"]), (s) => {
    const [a, b] = [JSON.stringify(OLD.numberSpans(s)), JSON.stringify([...rules.numberSpans(s)])];
    if (a !== b) return `${a} != ${b}`;
    const paths = rules.indexPaths(s);
    for (const p of ["", "a", "x.n", "x.N", "a.N", " ", "na", ">5<"]) if (paths.has(p) !== s.includes(`data-index="${p}"`)) return `the path ${JSON.stringify(p)}`;
    return null;
  });
  assert.equal(n, 40_000);
});

test("the page's own text: data URLs and external scripts read as the former patterns read them", () => {
  differs("withoutDataUrls", generated(6, 40_000, ["url(", "data:", ")", " ", "\t", " ", '"', "'", "x", "url(data:", "url( 'data:", "url(\"", "dat", "u", "(("]), (s) => {
    const [a, b] = [OLD.withoutDataUrls(s), rules.withoutDataUrls(s)];
    return a === b ? null : `${a} != ${b}`;
  });
  differs("hasExternalScript", generated(7, 40_000, ["<script", "<SCRIPT", "<Script", " ", "src=", "SRC=", "Src=", ">", "x", "_", "<scriptx", "-", " ", "=", "s", "<", "/"], 14), (s) => {
    const [a, b] = [OLD.hasExternalScript(s), rules.hasExternalScript(s)];
    return a === b ? null : `${a} != ${b}`;
  });
});

test("normRepo and the markdown's comment reader: the former patterns' answers", () => {
  differs("normRepo", generated(8, 30_000, ["/", "//", "a", "http://", "https://", ".git", "A", "x/", ".", "git", "H"], 10), (s) => {
    const [a, b] = [OLD.normRepo(s), trust.normRepo(s)];
    return a === b ? null : `${a} != ${b}`;
  });
  assert.equal(trust.normRepo(undefined), OLD.normRepo(undefined));
  differs("withoutComments", generated(9, 30_000, ["<!--", "-->", "-", "<", "!", ">", "a", "<!-", "--", "\n"]), (s) => {
    const [a, b] = [OLD.withoutComments(s), views.withoutComments(s)];
    return a === b ? null : `${a} != ${b}`;
  });
});

test("the markdown view writes a `<!--` left in the text as text, never as markup (CodeQL's sanitization alert)", () => {
  // The renderer's own tags are the only `<` it writes: every other `<` of its input comes out as `&lt;`.
  const OWN = /^<\/?(?:h2|h3|p|pre|code|b|i|div|table|tr|th|td)\b/;
  for (const src of ["<!<!---->-- <script>alert(1)</script>", "<!--", "<!-- a --> <img src=x onerror=alert(1)>", "a <!-- b", "<!<!--x-->--img src=x>",
    "`<!--`", "**<!--**", "| <!-- | x |\n|---|---|\n| <script> | y |", "```\n<!--\n```", "## <!--x--><!--", "_<b>_"]) {
    const html = views.md(src);
    for (const m of html.matchAll(/</g)) assert.match(html.slice(m.index), OWN, `md(${JSON.stringify(src)}) writes markup it did not make: ${html}`);
  }
});

/** CPU time of one call, in milliseconds: a measure that the load of the machine does not stretch. */
function cpu(fn) {
  const t0 = process.cpuUsage();
  fn();
  const t = process.cpuUsage(t0);
  return (t.user + t.system) / 1000;
}
const fill = (unit, prefix = "", suffix = "") => prefix + unit.repeat(Math.floor((SIZE - prefix.length - suffix.length) / unit.length)) + suffix;

for (const [what, run] of [
  ["ownText, verbatim openers that never close (CodeQL)", () => rules.ownText(fill("<!--verbatim:start-->"))],
  ["ownText, a run of `<` (9 s at 100,000 characters before)", () => rules.ownText(fill("<"))],
  ["resolvePath, CodeQL's string", () => rules.resolvePath({}, fill("[$=\\", "[$="))],
  ["checkView, number openers that never close (CodeQL)", () => rules.checkView(fill('<span class="n"'), {})],
  ["checkView, one opener and data-index after data-index (CodeQL)", () => rules.checkView(fill('data-index=""', '<span class="n"'), {})],
  ["checkView, every count looked up (9.6 s at 400,000 characters before)", () => rules.checkView(fill('data-index="a.n"'), null)],
  ["checkPage, inline index openers that never close (CodeQL, two alerts)", () => rules.checkPage(fill(INDEX_OPEN + "a"))],
  ["checkPage, data URLs that never close (CodeQL)", () => rules.checkPage(fill("url(data:"))],
  ["checkPage, style and module openers that never close", () => { rules.checkPage(fill("<style>")); rules.checkPage(fill('<script type="module">')); }],
  ["checkPage, script tags that never end", () => rules.checkPage(fill("<script "))],
  ["normRepo, a run of slashes (CodeQL; 7.8 s at 100,000 before)", () => trust.normRepo(fill("/", "a", "b"))],
  ["md, comment openers that never close (CodeQL)", () => views.md(fill("<!--"))],
]) {
  test(`${what}: 1,000,000 characters read in linear time`, () => {
    const ms = cpu(run);
    assert.ok(ms < CEILING_MS, `read in ${ms.toFixed(0)} ms of CPU, over the ${CEILING_MS} ms ceiling`);
  });
}
