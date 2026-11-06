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

/** The text a reader sees in a view, without what the view marks as verbatim data. */
export function ownText(html) {
  return decode(String(html)
    .replace(/<!--verbatim:start-->[\s\S]*?<!--verbatim:end-->/g, " ")
    .replace(/<span data-verbatim>[^<]*<\/span>/g, " ")
    .replace(/<code>[^<]*<\/code>/g, " ")
    .replace(/<title>[^<]*<\/title>/g, " ")
    .replace(/<[^>]+>/g, " "));
}

/** Resolve an index path such as `missions[id=runward].latest.byState[state=filled].n`. */
export function resolvePath(root, path) {
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
  // Every count carries its denominator.
  for (const m of String(html).matchAll(/data-index="([^"]*)\.n"/g)) {
    if (!html.includes(`data-index="${m[1]}.N"`)) say(`the count at ${m[1]} is shown without its denominator`);
  }
  const own = ownText(html);
  if (/\d\s*%/.test(own) || /%\s*\d/.test(own)) say("a percentage is shown");
  for (const re of BANNED) { const m = own.match(re); if (m) say(`a word runward does not use about itself: "${m[0]}"`); }
  for (const re of EMERGENCY) { const m = own.match(re); if (m) say(`"${m[0]}": a harness release is never shown as an emergency`); }
  if (PRIVATE_PATH.test(html)) say("a private filesystem path reached the view");
  // Every number is the index's own value at the path it names (the face tied to its provenance).
  if (index) {
    for (const m of String(html).matchAll(/<span class="n( na)?"[^>]*?data-index="([^"]*)"[^>]*>([^<]*)<\/span>/g)) {
      const [, na, path, shown] = m;
      if (!path) { say(`a number carries no index path ("${decode(shown)}")`); continue; }
      const v = resolvePath(index, path);
      if (na) { if (v !== undefined && v !== null && v !== "not-observed") say(`${path} is shown as not observed, the index holds ${JSON.stringify(v)}`); continue; }
      if (v === undefined || v === null || String(v) !== decode(shown)) say(`${path} is shown as "${decode(shown)}", the index holds ${JSON.stringify(v)}`);
    }
  }
  return problems;
}

/** Rules on the whole page: self-contained, one gold token, no clock, the identity's colours. */
export function checkPage(html) {
  const problems = [];
  const say = (msg) => problems.push(`page: ${msg}`);
  const s = String(html);
  const idxRaw = (s.match(/<script type="application\/json" id="runward-fleet-index">([\s\S]*?)<\/script>/) ?? [])[1];
  let idx = null;
  try { idx = JSON.parse(idxRaw); } catch { idx = null; }
  if (!idx || idx.format !== "runward-fleet-index/0") say("the inline index is missing or of an unknown format");
  // The page's own words and code: without the inline index (data) and without embedded data: URLs
  // (fonts, the grain), which are bytes, not words.
  const own = s.replace(/<script type="application\/json" id="runward-fleet-index">[\s\S]*?<\/script>/, "").replace(/url\(\s*["']?data:[^)]*\)/g, "url()");
  const css = (own.match(/<style>([\s\S]*?)<\/style>/) ?? [])[1] ?? "";
  const script = (own.match(/<script type="module">([\s\S]*?)<\/script>/) ?? [])[1] ?? "";
  if (!/<meta http-equiv="Content-Security-Policy" content="default-src 'none';/.test(own)) say("no content security policy that loads nothing by default");
  for (const [re, what] of [[/<link\b/i, "a <link>"], [/<script\b[^>]*\bsrc=/i, "an external script"], [/<(img|iframe|object|embed|audio|video|source)\b/i, "an embedded resource"],
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
