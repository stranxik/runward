// The view rules of ADR-0093 decision 11 that can be read on what the build produces. The build runs
// them on the index, on every rendered view and on the page before it writes anything, and refuses
// to write a page that breaks one; the tests run the same functions on planted mutations, so a rule
// that stops seeing its violation reddens.
//
// What a function here cannot see is said where it is used: the rules that need a planted index (no
// state computed by a view, no sum of states) are behavioural tests, in test/unit/fleet-view-rules.test.js.
import { PRIVATE_PATH } from "./build.js";

// Words runward never uses about itself in public, in both languages of the interface. A rule slug,
// a mission name or a quoted export is data, marked verbatim by the view, and is not the view's word.
export const BANNED = [
  /\bcompliant\b/i, /\bcertified\b/i, /tamper-?proof/i, /\bno[\s-]human\b/i, /\bplatforms?\b/i, /\bsovereign/i, /\bguarantee[ds]?\b/i,
  /\bcertifi[ée]e?s?\b/i, /\binviolable\b/i, /\binfalsifiable\b/i, /\bplateformes?\b/i, /\bsouverain/i, /\bgaranti(e|es|s)?\b/i,
  /\bconformes?\b/i, /\bsans humain\b/i, /\baucun humain\b/i,
];
const REFUSED_COLOURS = [/#241CC4/i, /#7B74FF/i, /#0A0A0A\b/i, /#FAFAFA\b/i, /\bindigo\b/i, /\bviolet\b/i];
const EMERGENCY = [/\bemergenc(y|ies)\b/i, /\burgences?\b/i];
const FORBIDDEN_KEYS = /^(score|percent|percentage|ratio|rate|grade|health|managementApproval|management_approval|approval|approved)$/i;
const GOLD = "#C9A45C";
// A clock read or a date formatted from one, in any spelling a browser or Node offers.
export const CLOCK = /\bnew\s+Date\b|\bDate\s*\.\s*(now|parse|UTC)\b|\bDate\s*\(|performance\s*\.\s*now|process\s*\.\s*hrtime|\btoLocale(Date|Time)?String\b|\bIntl\s*\.\s*DateTimeFormat\b|\.getTime\s*\(/;

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

// The readers below take the text a view or a page holds, which the build renders from the files of
// every mission, and each reads it in one pass. Until 2026-11-06 they were regular expressions that
// restart from every candidate opener, quadratic in the length of a view (RWD-2026-0206): a run of
// `<` took 9 s at 100,000 characters in `ownText`. Each reader gives the answers of the pattern it
// replaces, which test/unit/fleet-linear-readers.test.js compares on generated inputs.

/**
 * Each `open … close` of `s`, the first `close` after its `open`, replaced by `by`, left to right: what
 * `s.replace(/open[\s\S]*?close/g, by)` gives for two literal strings. An `open` with no `close` after
 * it ends the replacing, since no later `open` has one either.
 */
export function replaceBetween(s, open, close, by) {
  let out = "";
  let at = 0;
  for (;;) {
    const i = s.indexOf(open, at);
    if (i === -1) break;
    const j = s.indexOf(close, i + open.length);
    if (j === -1) break;
    out += s.slice(at, i) + by;
    at = j + close.length;
  }
  return out + s.slice(at);
}

/** The first `open … close` of `s`, as `s.match(/open([\s\S]*?)close/)` finds it, or null. */
export function firstBetween(s, open, close) {
  const i = s.indexOf(open);
  if (i === -1) return null;
  const j = s.indexOf(close, i + open.length);
  if (j === -1) return null;
  return { start: i, inner: s.slice(i + open.length, j), end: j + close.length };
}

/** Every tag of `s` replaced by a blank: what `s.replace(/<[^>]+>/g, " ")` gives. */
function withoutTags(s) {
  let out = "";
  let at = 0;
  let from = 0;
  for (;;) {
    const i = s.indexOf("<", from);
    if (i === -1) break;
    const k = s.indexOf(">", i + 1);
    if (k === -1) break; // no tag closes after this `<`, so none after any later one
    if (k === i + 1) { from = i + 1; continue; } // `<>` holds no character: not a tag
    out += s.slice(at, i) + " ";
    at = from = k + 1;
  }
  return out + s.slice(at);
}

/** The text a reader sees in a view, without what the view marks as verbatim data. */
export function ownText(html) {
  return decode(withoutTags(replaceBetween(String(html), "<!--verbatim:start-->", "<!--verbatim:end-->", " ")
    .replace(/<span data-verbatim>[^<]*<\/span>/g, " ")
    .replace(/<code>[^<]*<\/code>/g, " ")
    .replace(/<title>[^<]*<\/title>/g, " ")));
}

const NAME_START = /[A-Za-z_$]/;
const NAME_PART = /[\w$-]/;
/** The end of the name that starts at `i` (`[A-Za-z_$][\w$-]*`), or `i` when none does. */
function nameEnd(path, i) {
  if (i >= path.length || !NAME_START.test(path[i])) return i;
  let j = i + 1;
  while (j < path.length && NAME_PART.test(path[j])) j++;
  return j;
}

/**
 * Resolve an index path such as `missions[id=runward].latest.byState[state=filled].n`: names,
 * `[N]` positions and `[key=value]` selectors, each optionally after one dot, read left to right.
 */
export function resolvePath(root, path) {
  let cur = root;
  let at = 0;
  while (at < path.length) {
    const i = path[at] === "." ? at + 1 : at;
    let end = nameEnd(path, i);
    let step;
    if (end > i) step = (c) => c[path.slice(i, end)];
    else if (path[i] === "[") {
      let d = i + 1;
      while (d < path.length && path[d] >= "0" && path[d] <= "9") d++;
      const key = nameEnd(path, i + 1);
      const close = path[key] === "=" ? path.indexOf("]", key + 1) : -1;
      if (d > i + 1 && path[d] === "]") { end = d + 1; step = (c) => c[Number(path.slice(i + 1, d))]; }
      else if (key > i + 1 && close !== -1) {
        end = close + 1;
        const [k, v] = [path.slice(i + 1, key), path.slice(key + 1, close)];
        step = (c) => (Array.isArray(c) ? c.find((x) => String(x?.[k]) === v) : undefined);
      }
    }
    if (!step) return undefined;
    if (cur === undefined || cur === null) return undefined;
    cur = step(cur);
    at = end;
  }
  return cur;
}

/**
 * The first `what` at or after a position of `s`, for positions asked in increasing order: each scan
 * starts where the last one stopped, so all the asking reads `s` once. Asked out of order, it scans
 * again, and still answers right.
 */
function forward(s, what) {
  let from = Infinity, at = -1;
  return (i) => {
    if (i >= from && (at === -1 || at >= i)) return at;
    from = i;
    at = s.indexOf(what, i);
    return at;
  };
}

const NUMBER_OPEN = '<span class="n';
const DATA_INDEX = 'data-index="';
/**
 * Every path a view names, `data-index="path"` read at each place it starts (a path never holds `"`):
 * the set of `p` for which `html.includes(\`data-index="${p}"\`)`.
 */
export function indexPaths(html) {
  const s = String(html);
  const quote = forward(s, '"');
  const paths = new Set();
  for (let k = s.indexOf(DATA_INDEX); k !== -1; k = s.indexOf(DATA_INDEX, k + 1)) {
    const q = quote(k + DATA_INDEX.length);
    if (q === -1) break;
    paths.add(s.slice(k + DATA_INDEX.length, q));
  }
  return paths;
}

/**
 * The numbers of a view, `{ na, path, shown }` in order, as
 * `/<span class="n( na)?"[^>]*?data-index="([^"]*)"[^>]*>([^<]*)<\/span>/g` matches them, read in one
 * pass. A candidate `data-index="` answers the same whatever span it is read from, so each is read
 * once, and each search moves forward only.
 */
export function* numberSpans(html) {
  const s = String(html);
  const indexes = []; // every `data-index="`, in order
  for (let k = s.indexOf(DATA_INDEX); k !== -1; k = s.indexOf(DATA_INDEX, k + 1)) indexes.push(k);
  const quoteAfter = forward(s, '"'), tagEnd = forward(s, ">"), textEnd = forward(s, "<"), spanEnd = forward(s, ">");
  const outcome = new Map(); // a data-index position: the number it closes, or null
  const read = (k) => {
    if (outcome.has(k)) return outcome.get(k);
    const q = quoteAfter(k + DATA_INDEX.length);
    const gt = q === -1 ? -1 : tagEnd(q + 1);
    const lt = gt === -1 ? -1 : textEnd(gt + 1);
    const r = lt !== -1 && s.startsWith("</span>", lt) ? { path: s.slice(k + DATA_INDEX.length, q), shown: s.slice(gt + 1, lt), end: lt + 7 } : null;
    outcome.set(k, r);
    return r;
  };
  let next = 0; // the first data-index neither before the span being read nor known to close nothing
  let from = 0;
  for (;;) {
    const at = s.indexOf(NUMBER_OPEN, from);
    if (at === -1) return;
    const after = at + NUMBER_OPEN.length;
    const na = s.startsWith(' na"', after) ? " na" : undefined;
    const p0 = na ? after + 4 : s[after] === '"' ? after + 1 : -1;
    if (p0 === -1) { from = at + 1; continue; }
    const g = spanEnd(p0); // `[^>]*?` stops here: the data-index must start before it
    if (g === -1) return; // no `>` after this span opens, so none after any later one
    while (next < indexes.length) {
      const k = indexes[next];
      if (k >= p0 && (k >= g || read(k) !== null)) break;
      next++;
    }
    const k = indexes[next];
    if (k === undefined || k >= g) { from = at + 1; continue; }
    const r = read(k);
    yield { na, path: r.path, shown: r.shown };
    from = r.end;
  }
}

/** Rules on the index alone. */
export function checkIndex(index) {
  const problems = [];
  const walk = (v, p) => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${p}[${i}]`)); return; }
    if (!v || typeof v !== "object") return;
    for (const [k, x] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.test(k)) problems.push(`the index carries a field the views may not show: ${p}.${k}`);
      walk(x, `${p}.${k}`);
    }
    // A grouping is n of N with the list it counts, never a bare count.
    if ("state" in v && "n" in v && "N" in v) {
      if (!Array.isArray(v.list) || v.list.length !== v.n) problems.push(`${p}: n is not the length of the list it counts`);
    }
  };
  walk(index, "index");
  // machine-established is the satellite's, under a verified signature and a pinned policy.
  for (const m of index.missions ?? []) {
    for (const cell of [m.latest, m.attestation]) {
      if (!cell || cell === "not-observed" || cell.implemented !== "machine-established") continue;
      const s = (m.signatures ?? []).find((x) => x.id === cell.raisedBy);
      if (!s || !s.raised || s.state !== "verified") problems.push(`missions[id=${m.id}]: machine-established without a raised, verified signature`);
    }
    for (const s of m.signatures ?? []) if (s.raised && (s.reasons ?? []).length) problems.push(`missions[id=${m.id}] ${s.id}: raised with reasons not to`);
    for (const series of m.history?.series ?? []) {
      if (series.records.some((r) => r.signatureVerified !== false)) problems.push(`missions[id=${m.id}]: a history record claims a verified signature`);
    }
  }
  try {
    // eslint-disable-next-line no-unused-expressions
    JSON.stringify(index).match(PRIVATE_PATH) && problems.push("a private filesystem path is in the index");
  } catch { problems.push("the index is not serialisable"); }
  return problems;
}

/** Rules on one rendered view. `index` resolves the numbers the view shows. */
export function checkView(html, index, where = "view") {
  const problems = [];
  const say = (msg) => problems.push(`${where}: ${msg}`);
  // Gold, once at most: the one moment of proof of the view.
  const golds = [...String(html).matchAll(/class="([^"]*)"/g)].filter((m) => m[1].split(/\s+/).includes("or")).length;
  if (golds > 1) say(`gold appears ${golds} times; once at most per view`);
  // Every count carries its denominator. The paths are read once: searching the whole view again for
  // each count was quadratic in their number (9.6 s for a view of 400,000 characters).
  const paths = indexPaths(html);
  for (const m of String(html).matchAll(/data-index="([^"]*)\.n"/g)) {
    if (!paths.has(`${m[1]}.N`)) say(`the count at ${m[1]} is shown without its denominator`);
  }
  const own = ownText(html);
  if (/\d\s*%/.test(own) || /%\s*\d/.test(own)) say("a percentage is shown");
  for (const re of BANNED) { const m = own.match(re); if (m) say(`a word runward does not use about itself: "${m[0]}"`); }
  for (const re of EMERGENCY) { const m = own.match(re); if (m) say(`"${m[0]}": a harness release is never shown as an emergency`); }
  if (PRIVATE_PATH.test(html)) say("a private filesystem path reached the view");
  // Every number is the index's own value at the path it names (the face tied to its provenance).
  if (index) {
    for (const { na, path, shown } of numberSpans(html)) {
      if (!path) { say(`a number carries no index path ("${decode(shown)}")`); continue; }
      const v = resolvePath(index, path);
      if (na) { if (v !== undefined && v !== null && v !== "not-observed") say(`${path} is shown as not observed, the index holds ${JSON.stringify(v)}`); continue; }
      if (v === undefined || v === null || String(v) !== decode(shown)) say(`${path} is shown as "${decode(shown)}", the index holds ${JSON.stringify(v)}`);
    }
  }
  return problems;
}

const INDEX_OPEN = '<script type="application/json" id="runward-fleet-index">';
const isWord = (c) => c !== undefined && /\w/.test(c);
/** `s` with A to Z lowered and nothing else changed, so a position in it is the same position in `s`. */
const asciiLower = (s) => s.replace(/[A-Z]+/g, (w) => w.toLowerCase());

/** `t.replace(/url\(\s*["']?data:[^)]*\)/g, "url()")`, read in one pass. */
export function withoutDataUrls(t) {
  const paren = forward(t, ")");
  let out = "";
  let at = 0;
  let from = 0;
  for (;;) {
    const u = t.indexOf("url(", from);
    if (u === -1) break;
    let i = u + 4;
    while (i < t.length && /\s/.test(t[i])) i++;
    if (t[i] === '"' || t[i] === "'") i++;
    if (!t.startsWith("data:", i)) { from = u + 1; continue; }
    const c = paren(i + 5);
    if (c === -1) break; // no `)` closes this url(, so none closes a later one
    out += t.slice(at, u) + "url()";
    at = from = c + 1;
  }
  return out + t.slice(at);
}

/**
 * Whether `t` holds a script tag naming a source, as `/<script\b[^>]*\bsrc=/i` tests it. Every
 * `<script` before one `>` ends at that `>`, so the stretch is searched once, from the first.
 */
export function hasExternalScript(t) {
  const low = asciiLower(t);
  const gt = forward(t, ">");
  const src = forward(low, "src=");
  let searched = -2;
  for (let i = low.indexOf("<script"); i !== -1; i = low.indexOf("<script", i + 1)) {
    const b = i + 7;
    if (isWord(t[b])) continue;
    const g = gt(b);
    const end = g === -1 ? t.length : g;
    if (end === searched) continue;
    searched = end;
    for (let j = src(b); j !== -1 && j < end; j = src(j + 1)) if (!isWord(t[j - 1])) return true;
  }
  return false;
}

/** Rules on the whole page: self-contained, one gold token, no clock, the identity's colours. */
export function checkPage(html) {
  const problems = [];
  const say = (msg) => problems.push(`page: ${msg}`);
  const s = String(html);
  const inline = firstBetween(s, INDEX_OPEN, "</script>");
  const idxRaw = inline?.inner;
  let idx = null;
  try { idx = JSON.parse(idxRaw); } catch { idx = null; }
  if (!idx || idx.format !== "runward-fleet-index/0") say("the inline index is missing or of an unknown format");
  // The page's own words and code: without the inline index (data) and without embedded data: URLs
  // (fonts, the grain), which are bytes, not words.
  const own = withoutDataUrls(inline ? s.slice(0, inline.start) + s.slice(inline.end) : s);
  const css = firstBetween(own, "<style>", "</style>")?.inner ?? "";
  const script = firstBetween(own, '<script type="module">', "</script>")?.inner ?? "";
  if (!/<meta http-equiv="Content-Security-Policy" content="default-src 'none';/.test(own)) say("no content security policy that loads nothing by default");
  for (const [re, what] of [[/<link\b/i, "a <link>"], [{ test: hasExternalScript }, "an external script"], [/<(img|iframe|object|embed|audio|video|source)\b/i, "an embedded resource"],
    [/url\((["']?)(https?:)?\/\//i, "a url() to a host"], [/@import/i, "a CSS import rule"], [/fetch\(\s*["'`]https?:/i, "a fetch to a host"],
    [/\b(WebSocket|EventSource|XMLHttpRequest|sendBeacon)\b/, "a network API"]]) if (re.test(own)) say(`${what}: the page loads nothing from elsewhere`);
  if (PRIVATE_PATH.test(s)) say("a private filesystem path reached the page");
  const gold = (s.match(new RegExp(GOLD, "gi")) ?? []).length;
  if (gold !== 1) say(`the gold ${GOLD} must be defined once, as a token (found ${gold})`);
  // Which selectors use the gold token: each rule read once, in one pass (a nested block names its
  // innermost selector).
  const users = css.split("}").map((r) => r.split("{")).filter((p) => p.length >= 2 && p[p.length - 1].includes("var(--or)")).map((p) => p[p.length - 2].trim());
  if (!users.every((u) => u === ".or" || u === ".mk.or") || users.length === 0) say(`gold is used outside .or and .mk.or (${users.join(" | ")})`);
  for (const re of REFUSED_COLOURS) if (re.test(own)) say(`a colour the identity refuses: ${re}`);
  if (CLOCK.test(script)) say("the page script reads or formats a clock");
  if (/\*\s*100\b|\}\s*%|%`/.test(script)) say("the page script computes a percentage");
  for (const re of BANNED) { const m = own.match(re); if (m) say(`a word runward does not use about itself: "${m[0]}"`); }
  return problems;
}
