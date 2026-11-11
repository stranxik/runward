// The documents of a mission, for runward-fleet (ADR-0127): a renderer of a closed subset of Markdown,
// the check its output passes before a page inserts it, the register of a mission's decision records,
// and the port placement table of its topology note.
//
// A mission's documents are written in a repository this package does not hold: they are untrusted
// text. Nothing here trusts them:
//   - `renderDocument` never copies a character of the source into its output: every character passes
//     through `esc`, and markup comes only from `el`, which knows a closed list of elements and of
//     attributes and accepts only pieces it built itself. Raw HTML in a document is shown as text;
//   - a link is rewritten, never copied: a fragment becomes a slug of this renderer, a relative path is
//     normalised inside the repository and handed to the caller's `route` or `source`, an absolute
//     address is kept only when it is https without credentials. Anything else is shown as text;
//   - `checkRendered` reads the output as tokens and refuses whatever is outside the same closed lists,
//     and whatever an element of the list may not hold (a block in a paragraph, anything but rows in a
//     table). A page inserts a document only when it passes; otherwise it shows the source as plain text.
//
// Pure ES module: no import, no clock, no network, no DOM. The same code runs in a browser, at
// ingestion and in the tests. The elements carry no class and no style: a deployment styles them by
// element, inside the container it gives the document.

export const REGISTER_FORMAT = "runward-fleet-register/0";
export const TOPOLOGY_FORMAT = "runward-fleet-topology/0";

/** The closed list of elements a rendered document may hold. */
export const DOCUMENT_ELEMENTS = ["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "pre", "code", "b", "i", "blockquote", "table", "tr", "th", "td", "hr", "a"];
/** The closed list of attributes, by element. Every other element carries none. */
export const DOCUMENT_ATTRIBUTES = { a: ["href", "rel", "target"], h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"] };
/** What an absolute link carries, exactly. */
export const EXTERNAL_REL = "noopener noreferrer nofollow";
export const EXTERNAL_TARGET = "_blank";
/** Beyond this length a document is shown as plain text in one `pre`: nothing in it is marked up. */
export const MAX_DOCUMENT_LENGTH = 1 << 20;

export const DOCUMENT_RULES = [
  { id: "D1", held: "test", en: "No character of a document reaches the page unescaped: raw HTML is shown as text.", fr: "Aucun caractère d'un document n'atteint la page sans échappement : le HTML brut s'affiche comme du texte." },
  { id: "D2", held: "test", en: "Markup comes from a closed list of elements and attributes; a document sets no class, no style, no image.", fr: "Le balisage vient d'une liste fermée d'éléments et d'attributs ; un document ne pose ni classe, ni style, ni image." },
  { id: "D3", held: "test", en: "A link is rewritten, never copied: a slug, a route of the application, or an https address without credentials; anything else is text.", fr: "Un lien est réécrit, jamais copié : un ancrage, une route de l'application, ou une adresse https sans identifiants ; tout le reste est du texte." },
  { id: "D4", held: "test", en: "A rendered document is inserted only if the check by closed list passes; otherwise the source is shown as plain text.", fr: "Un document rendu n'est inséré que si le contrôle par liste fermée passe ; sinon la source s'affiche en texte brut." },
  { id: "D5", held: "test", en: "The register says what each record's file says: a field not found reads not observed, a status outside the template's list is shown as written.", fr: "Le registre dit ce que dit le fichier de chaque décision : un champ absent se lit non observé, un statut hors de la liste du modèle s'affiche tel qu'écrit." },
];

const ELEMENTS = new Set(DOCUMENT_ELEMENTS);
const MAX_DEPTH = 8; // nested quotes and lists beyond it are shown flat; nested emphasis beyond it keeps its marks as text
const MAX_NESTING = 64; // the deepest the check accepts: the renderer stays under 40 (nine levels of lists, a cell, emphasis around and inside a link)
const MAX_HREF = 1024;
const MAX_TITLE = 256; // a link's title is read to find where the link ends, and dropped
const MAX_COLUMNS = 64;

// ------------------------------------------------------------------ the only way to the output
const ENTITY = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITY[c]);

/** A piece of output. Only `text` and `el` make one, so a string of the source cannot stand in for it. */
class Built {
  constructor(html) { this.html = html; }
}
const need = (p) => {
  if (!(p instanceof Built)) throw new TypeError("runward-fleet/documents: a piece of output that the renderer did not build");
  return p;
};
const text = (s) => new Built(esc(s));
const EMPTY = new Built("");
const join = (parts, sep = "") => new Built(parts.map((p) => need(p).html).join(sep));
function el(tag, inner, attrs = []) {
  if (!ELEMENTS.has(tag)) throw new Error(`runward-fleet/documents: <${tag}> is not in the closed list`);
  let a = "";
  for (const [k, v] of attrs) {
    if (!DOCUMENT_ATTRIBUTES[tag]?.includes(k)) throw new Error(`runward-fleet/documents: ${k} is not an attribute of <${tag}>`);
    a += ` ${k}="${esc(v)}"`;
  }
  if (tag === "hr") return new Built("<hr>");
  return new Built(`<${tag}${a}>${need(inner).html}</${tag}>`);
}

// ------------------------------------------------------------------ the source, made plain
// Line ends are one kind; a control character, a bidirectional override or isolate, a tag character
// (U+E0000 to U+E007F) and half a surrogate pair are replaced by U+FFFD, so none can hide or reorder
// what the reader sees. Left as written, because text in some scripts needs them: U+200B to U+200F,
// U+061C, U+00AD, U+2060 and U+034F (refused in an address, shown in text, never in a heading's id).
const HIDDEN = /\udb40[\udc00-\udc7f]|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;
const plain = (src) => String(src ?? "").replace(/\r\n?|[\u2028\u2029]/g, "\n").replace(/\t/g, "    ").replace(HIDDEN, "\ufffd");

// ------------------------------------------------------------------ links
/** What an address may not hold, as written: a space of any kind, a control or invisible character, a backslash. */
const UNSAFE = /[\u0000-\u0020\u007f-\u00a0\u00ad\u034f\u061c\u1680\u2000-\u200f\u2028-\u202f\u205f-\u206f\u3000\ufeff\ufffd\\]/;
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const ROUTE = /^#\/[A-Za-z0-9._~%/-]*$/;
const HOST = /^(?:[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.?|\[[0-9a-f:.]+\])$/; // a name as the parser writes it, or an address in brackets
const SLUG = /^#doc-[\p{L}\p{N}-]*$/u;

const slug = (s) => s === "" ? "" : String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-/, "").replace(/-$/, "").slice(0, 80).replace(/[\ud800-\udbff]$/, ""); // cut at 80 units, never through a pair

/** An absolute address, kept only when it is https, names a host and carries no credentials. */
function external(raw) {
  if (typeof raw !== "string" || raw.length > MAX_HREF || UNSAFE.test(raw)) return null;
  if (!/^https:\/\/[^/?#]/i.test(raw)) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  if (u.username !== "" || u.password !== "") return null;
  if (!HOST.test(u.hostname)) return null;
  const href = u.href;
  return href.startsWith("https://") && !UNSAFE.test(href) ? href : null;
}

/** The path a relative link names, inside the repository, or null when it leaves it. */
function insideRepository(raw, from) {
  if (typeof from !== "string" || from === "" || from.startsWith("/") || from.split("/").some((s) => s === ".." || s === ".")) return null;
  let p = raw;
  for (const cut of ["#", "?"]) { const k = p.indexOf(cut); if (k !== -1) p = p.slice(0, k); }
  if (p === "") return null;
  const at = p.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const seg of p.split("/")) {
    let d;
    try { d = decodeURIComponent(seg); } catch { return null; }
    if (d === "" || d === ".") continue;
    if (d === "..") { if (at.length === 0) return null; at.pop(); continue; }
    if (/[\u0000-\u001f\u007f/\\]/.test(d)) return null;
    if (/[%?#]/.test(d)) return null; // what a second decoding, or a parser of addresses, would read as structure
    at.push(d);
  }
  return at.length ? at.join("/") : null;
}

/** The address a link of the source becomes, `{ href, external }`, or null: the link is then shown as text. */
function resolve(raw, ctx) {
  if (typeof raw !== "string" || raw === "" || raw.length > MAX_HREF || UNSAFE.test(raw)) return null;
  if (raw.startsWith("#")) {
    let f;
    try { f = decodeURIComponent(raw.slice(1)); } catch { return null; }
    const s = slug(f);
    return s ? { href: `#doc-${s}`, external: false } : null;
  }
  if (SCHEME.test(raw)) {
    const href = external(raw);
    return href ? { href, external: true } : null;
  }
  if (raw.startsWith("//")) return null;
  const path = insideRepository(raw, ctx.path);
  if (path === null) return null;
  const route = typeof ctx.route === "function" ? ctx.route(path) : null;
  if (typeof route === "string" && route.length <= MAX_HREF && ROUTE.test(route)) return { href: route, external: false };
  const href = typeof ctx.source === "function" ? external(ctx.source(path)) : null;
  return href && endsWithPath(href, path) ? { href, external: true } : null;
}

/** Whether the path of an address ends with `path`, each segment encoded: the forge's address names the file asked, and no other. */
function endsWithPath(href, path) {
  let u;
  try { u = new URL(href); } catch { return false; }
  return u.pathname.endsWith(`/${path.split("/").map(encodeURIComponent).join("/")}`);
}

const anchor = (to, inner) => el("a", inner, to.external ? [["href", to.href], ["rel", EXTERNAL_REL], ["target", EXTERNAL_TARGET]] : [["href", to.href]]);

// ------------------------------------------------------------------ inline
const SPACE = /\s/;
const WORD = /[\p{L}\p{N}]/u;
const ESCAPABLE = /[!-/:-@[-`{-~]/;
const SPECIAL = /[\\`![<h*_]/g;

/** For each `[`, the index of the `]` that closes it: one pass, so a run of brackets costs its length. */
function brackets(s) {
  const close = new Map();
  const open = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") i++;
    else if (c === "[") open.push(i);
    else if (c === "]" && open.length) close.set(open.pop(), i);
  }
  return close;
}

/** The index of `ch` at or after `from`, looked for no further than an address may run; -1 otherwise. */
const within = (s, ch, from) => { const k = s.slice(from, from + MAX_HREF + 1).indexOf(ch); return k === -1 ? -1 : from + k; };

/** The destination after `](`: `{ dest, end }`, or null when the parenthesis does not close as a link's does. */
function destination(s, p) {
  let i = p + 1;
  const n = s.length;
  while (i < n && s[i] === " ") i++;
  let dest = "";
  if (s[i] === "<") {
    const k = within(s, ">", i + 1);
    if (k === -1) return null;
    dest = s.slice(i + 1, k);
    if (dest.includes("\n") || dest.includes("<")) return null;
    i = k + 1;
  } else {
    const from = i;
    let depth = 0;
    while (i < n && i - from <= MAX_HREF) {
      const c = s[i];
      if (c === " " || c === "\n") break;
      if (c === "(") { if (++depth > MAX_DEPTH) return null; }
      else if (c === ")") { if (depth === 0) break; depth--; }
      i++;
    }
    if (i - from > MAX_HREF) return null;
    dest = s.slice(from, i);
  }
  while (i < n && (s[i] === " " || s[i] === "\n")) i++;
  const q = s[i];
  if (q === '"' || q === "'" || q === "(") {
    const closer = q === "(" ? ")" : q;
    const from = ++i;
    while (i < n && i - from <= MAX_TITLE && s[i] !== closer) i += s[i] === "\\" ? 2 : 1;
    if (i >= n || s[i] !== closer) return null;
    i++;
    while (i < n && s[i] === " ") i++;
  }
  return s[i] === ")" ? { dest, end: i + 1 } : null;
}

const ENDS_BARE = /[\s<>]/g;
/** A bare https address, with the punctuation that ends a sentence left outside. */
function bare(s, i) {
  ENDS_BARE.lastIndex = i;
  const m = ENDS_BARE.exec(s);
  let j = m ? m.index : s.length;
  while (j > i && /[.,;:!?"'*_`\]]/.test(s[j - 1])) j--;
  if (s[j - 1] === ")" && !s.slice(i, j).includes("(")) j--;
  return j;
}

/**
 * Inline text: code spans, bold, italic, links, each from the closed list. One pass builds tokens, one
 * resolves emphasis with a stack per delimiter, one assembles: no step looks back over its input.
 */
function inline(s, ctx, links = true) {
  if (s === "") return EMPTY;
  const toks = []; // a Built, or a delimiter { ch, n, open, close, role }
  let buf = "";
  const flush = () => { if (buf) { toks.push(text(buf)); buf = ""; } };
  const close = links && s.includes("[") ? brackets(s) : null;
  let runs = null; // the runs of backticks by length, each list read forward once: a closing run is found without a scan
  const closing = (r, from) => {
    if (!runs) {
      runs = new Map();
      for (let j = s.indexOf("`"); j !== -1;) {
        let q = 1;
        while (s[j + q] === "`") q++;
        if (!runs.has(q)) runs.set(q, { at: [], next: 0 });
        runs.get(q).at.push(j);
        j = s.indexOf("`", j + q);
      }
    }
    const e = runs.get(r);
    if (!e) return -1;
    while (e.next < e.at.length && e.at[e.next] < from) e.next++;
    return e.next < e.at.length ? e.at[e.next] : -1;
  };
  const n = s.length;
  let i = 0;
  while (i < n) {
    SPECIAL.lastIndex = i;
    const m = SPECIAL.exec(s);
    if (!m) { buf += s.slice(i); break; }
    if (m.index > i) { buf += s.slice(i, m.index); i = m.index; }
    const c = s[i];
    if (c === "\\") {
      if (i + 1 < n && ESCAPABLE.test(s[i + 1])) { buf += s[i + 1]; i += 2; } else { buf += c; i++; }
      continue;
    }
    if (c === "`") {
      let r = 1;
      while (s[i + r] === "`") r++;
      const found = closing(r, i + r);
      if (found === -1) { buf += s.slice(i, i + r); i += r; continue; }
      let body = s.slice(i + r, found).replace(/\n/g, " ");
      if (body.length > 1 && body.startsWith(" ") && body.endsWith(" ") && body.trim() !== "") body = body.slice(1, -1);
      flush();
      toks.push(el("code", text(body)));
      i = found + r;
      continue;
    }
    if (c === "!" && s[i + 1] !== "[") { buf += c; i++; continue; }
    if (c === "[" || c === "!") {
      const at = c === "!" ? i + 1 : i; // an image is shown as its text and a link, never loaded
      const to = close ? close.get(at) : undefined;
      const d = to !== undefined && s[to + 1] === "(" ? destination(s, to + 1) : null;
      if (d) {
        const href = resolve(d.dest, ctx);
        flush();
        if (href) toks.push(anchor(href, inline(s.slice(at + 1, to), ctx, false)));
        else toks.push(text(s.slice(i, d.end)));
        i = d.end;
        continue;
      }
      buf += c; i++;
      continue;
    }
    if (c === "<") {
      const k = links && /^https:\/\//i.test(s.slice(i + 1, i + 9)) ? within(s, ">", i + 1) : -1;
      const inner = k !== -1 ? s.slice(i + 1, k) : null;
      const href = inner !== null ? external(inner) : null;
      if (href) { flush(); toks.push(anchor({ href, external: true }, text(inner))); i = k + 1; continue; }
      buf += c; i++;
      continue;
    }
    if (c === "h") {
      if (links && s.startsWith("https://", i) && (i === 0 || !WORD.test(s[i - 1]))) {
        const j = bare(s, i);
        const href = external(s.slice(i, j));
        if (href) { flush(); toks.push(anchor({ href, external: true }, text(s.slice(i, j)))); } else buf += s.slice(i, j);
        i = j;
        continue;
      }
      buf += c; i++;
      continue;
    }
    // `*` or `_`
    let r = 1;
    while (s[i + r] === c) r++;
    if (r > 3) { buf += s.slice(i, i + r); i += r; continue; }
    const prev = i === 0 ? " " : s[i - 1];
    const next = i + r >= n ? " " : s[i + r];
    let open = !SPACE.test(next);
    let shut = !SPACE.test(prev);
    if (c === "_") { open = open && !WORD.test(prev); shut = shut && !WORD.test(next); }
    if (!open && !shut) { buf += s.slice(i, i + r); i += r; continue; }
    flush();
    // A run of three is bold and italic: two delimiters, whose order is settled when emphasis is resolved.
    for (const size of r === 3 ? [2, 1] : [r]) toks.push({ ch: c, n: size, open, close: shut, role: null, triple: r === 3 && size === 2 });
    i += r;
  }
  flush();

  // Emphasis: a closer takes the nearest opener of its own kind; openers left inside the pair stay text.
  const stacks = { "*1": [], "*2": [], _1: [], _2: [] };
  for (let k = 0; k < toks.length; k++) {
    const d = toks[k];
    if (d instanceof Built) continue;
    if (d.triple && d.close) { // close the innermost opener first
      const top = (size) => stacks[d.ch + size][stacks[d.ch + size].length - 1] ?? -1;
      if (top(1) > top(2)) { d.n = 1; toks[k + 1].n = 2; }
    }
    const mine = stacks[d.ch + d.n];
    if (d.close && mine.length) {
      const o = mine.pop();
      toks[o].role = "open"; d.role = "close";
      for (const other of Object.values(stacks)) while (other.length && other[other.length - 1] > o) other.pop();
    } else if (d.open) mine.push(k);
  }
  // Pairs nest; beyond MAX_DEPTH a pair keeps its marks as text, so no piece is joined more than MAX_DEPTH times.
  const frames = [[]];
  const flat = []; // for each pair open, whether it is beyond the depth
  for (const d of toks) {
    if (d instanceof Built) frames[frames.length - 1].push(d);
    else if (d.role === "open") {
      const over = frames.length > MAX_DEPTH;
      flat.push(over);
      if (over) frames[frames.length - 1].push(text(d.ch.repeat(d.n))); else frames.push([]);
    } else if (d.role === "close" && !flat.pop()) { const inner = join(frames.pop()); frames[frames.length - 1].push(el(d.n === 2 ? "b" : "i", inner)); }
    else frames[frames.length - 1].push(text(d.ch.repeat(d.n)));
  }
  return join(frames[0]);
}

// ------------------------------------------------------------------ blocks
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})(?: +|$)/;
const RULE = /^ {0,3}(?:(?:\* *){3,}|(?:- *){3,}|(?:_ *){3,})$/;
const QUOTE = /^ {0,3}> ?/;
const ITEM = /^( *)([-*+]|[0-9]{1,9}[.)])(?: +|$)/;
const ROW = /^ {0,3}\|/;
const DIVIDER = /^ *:?-+:? *$/;

/** The cells of a table row: split on `|`, a `\|` kept as a bar. */
function cells(line) {
  const out = [];
  let cur = "";
  const s = line.trim();
  for (let i = s.startsWith("|") ? 1 : 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") { cur += "|"; i++; } else if (s[i] === "|") { out.push(cur.trim()); cur = ""; } else cur += s[i];
  }
  if (cur.trim() !== "") out.push(cur.trim());
  return out;
}
const isDivider = (line) => { const c = cells(line ?? ""); return c.length > 0 && c.every((x) => DIVIDER.test(x)); };
const startsBlock = (l) => FENCE.test(l) || HEADING.test(l) || RULE.test(l) || QUOTE.test(l) || ITEM.test(l) || ROW.test(l);

/** The blocks of a run of lines, each `{ built, para }` (`para`: the inline content of a paragraph, for a tight list item). */
function blocks(lines, ctx, depth) {
  const out = [];
  if (depth > MAX_DEPTH) {
    const flat = lines.join("\n").trim();
    if (flat) out.push({ built: el("p", text(flat)), para: text(flat) });
    return out;
  }
  const n = lines.length;
  let i = 0;
  while (i < n) {
    const l = lines[i];
    if (l.trim() === "") { i++; continue; }
    let m = FENCE.exec(l);
    if (m) {
      const mark = m[1];
      const buf = [];
      i++;
      while (i < n) {
        const t = lines[i].trim();
        if (t.length >= mark.length && t[0] === mark[0] && t === mark[0].repeat(t.length)) break;
        buf.push(lines[i++]);
      }
      i++; // the closing fence, or the end of an unterminated block
      out.push({ built: el("pre", el("code", text(buf.join("\n")))) });
      continue;
    }
    m = HEADING.exec(l);
    if (m) {
      const level = Math.min(m[1].length, 4);
      let body = l.slice(m[0].length).trim();
      let e = body.length;
      while (e > 0 && body[e - 1] === "#") e--;
      if (e < body.length && (e === 0 || body[e - 1] === " ")) body = body.slice(0, e).trim(); // a closing run of #
      const base = slug(body) || "section";
      let id = base;
      if (ctx.used.has(id)) { // the next suffix no heading of this document carries, written or given
        let k = ctx.ids.get(base) ?? 2;
        while (ctx.used.has(`${base}-${k}`)) k++;
        ctx.ids.set(base, k + 1);
        id = `${base}-${k}`;
      }
      ctx.used.add(id);
      out.push({ built: el(`h${level}`, inline(body, ctx), [["id", `doc-${id}`]]) });
      i++;
      continue;
    }
    if (RULE.test(l)) { out.push({ built: el("hr") }); i++; continue; }
    if (QUOTE.test(l)) {
      const buf = [];
      while (i < n && QUOTE.test(lines[i])) buf.push(lines[i++].replace(QUOTE, ""));
      out.push({ built: el("blockquote", join(blocks(buf, ctx, depth + 1).map((b) => b.built), "\n")) });
      continue;
    }
    if (ROW.test(l) && isDivider(lines[i + 1])) {
      const head = cells(l).slice(0, MAX_COLUMNS);
      const rows = [el("tr", join(head.map((c) => el("th", inline(c, ctx)))))];
      i += 2;
      while (i < n && ROW.test(lines[i])) {
        rows.push(el("tr", join(cells(lines[i++]).slice(0, head.length).map((c) => el("td", inline(c, ctx)))))); // a short row is left short: filling it lets two characters write 64 cells
      }
      out.push({ built: el("table", join(rows)) });
      continue;
    }
    m = ITEM.exec(l);
    if (m) {
      const indent = m[1].length;
      const ordered = /[0-9]/.test(m[2][0]);
      const items = [];
      while (i < n) {
        if (lines[i].trim() === "") { // a loose list goes on past blank lines when a sibling item follows
          let k = i;
          while (k < n && lines[k].trim() === "") k++;
          const sib = k < n ? ITEM.exec(lines[k]) : null;
          if (!sib || sib[1].length !== indent || /[0-9]/.test(sib[2][0]) !== ordered || RULE.test(lines[k])) break;
          i = k;
        }
        const im = ITEM.exec(lines[i]);
        if (!im || im[1].length !== indent || /[0-9]/.test(im[2][0]) !== ordered || RULE.test(lines[i])) break;
        const body = [lines[i].slice(im[0].length)];
        i++;
        while (i < n) {
          const t = lines[i];
          if (t.trim() === "") {
            let k = i;
            while (k < n && lines[k].trim() === "") k++;
            if (k < n && lines[k].length - lines[k].trimStart().length > indent) { while (i < k) { body.push(""); i++; } continue; }
            break;
          }
          const lead = t.length - t.trimStart().length;
          if (lead <= indent && startsBlock(t)) break;
          body.push(lead > indent ? t.slice(Math.min(lead, indent + im[2].length + 1)) : t);
          i++;
        }
        const inner = blocks(body, ctx, depth + 1);
        items.push(el("li", join(inner.map((b, k) => (k === 0 && b.para ? b.para : b.built)), "\n")));
      }
      out.push({ built: el(ordered ? "ol" : "ul", join(items)) });
      continue;
    }
    const buf = [l];
    i++;
    while (i < n && lines[i].trim() !== "" && !startsBlock(lines[i])) buf.push(lines[i++]);
    const para = inline(buf.map((x) => x.trim()).join("\n"), ctx);
    out.push({ built: el("p", para), para });
  }
  return out;
}

/**
 * Render a document of a mission as a string of elements from the closed list.
 *
 * `context` (all optional): `path`, the document's path in its repository (`runward/adr/ADR-0001-x.md`),
 * against which a relative link is resolved; `route(path)`, the application's route (`#/…`) for a path
 * that is one of the mission's documents, or null; `source(path)`, the https address of that file in the
 * forge at the commit read, or null. What they return is checked like any address of the source.
 */
export function renderDocument(markdown, context = {}) {
  const src = plain(markdown);
  if (src.length > MAX_DOCUMENT_LENGTH) return el("pre", el("code", text(src))).html;
  const ctx = { path: context?.path, route: context?.route, source: context?.source, ids: new Map(), used: new Set() };
  return join(blocks(src.split("\n"), ctx, 0).map((b) => b.built), "\n").html;
}

// ------------------------------------------------------------------ the check on the way out
const BARE_AMPERSAND = /&(?!(?:amp|lt|gt|quot|#39);)/;
const TEXT_REFUSED = /[>]|&(?!(?:amp|lt|gt|quot|#39);)/;
const HIDDEN_ONCE = new RegExp(`\\r|${HIDDEN.source}`);
const PARENT = { li: ["ul", "ol"], tr: ["table"], th: ["tr"], td: ["tr"] };
// What an element may hold, where a browser's parser would otherwise move or close something: the tree
// a page gets is the one the string writes. The document itself, a quote and an item hold anything.
const INLINE = ["a", "b", "i", "code"];
const HOLDS = { ul: ["li"], ol: ["li"], table: ["tr"], tr: ["th", "td"], pre: ["code"], code: [], p: INLINE, h1: INLINE, h2: INLINE, h3: INLINE, h4: INLINE, th: INLINE, td: INLINE, a: INLINE, b: INLINE, i: INLINE };
const TEXTLESS = new Set(["ul", "ol", "table", "tr", "pre"]);
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));

const AUTHORITY = /^(?:[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.?|\[[0-9a-f:.]+\])(?::[0-9]{1,5})?$/;
/** An https address as the check accepts it, read without the renderer's parser: a host, no credentials, nothing hidden. */
function httpsOnly(v) {
  if (!v.startsWith("https://") || UNSAFE.test(v)) return false;
  const rest = v.slice(8);
  const cut = rest.search(/[/?#]/);
  const authority = cut === -1 ? rest : rest.slice(0, cut);
  return AUTHORITY.test(authority);
}

/** The attributes of a start tag after its name, `[[name, value]…]`, or null when they are not ` name="value"` in a row. */
function attributes(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] !== " ") return null;
    let j = i + 1;
    while (j < s.length && s[j] >= "a" && s[j] <= "z") j++;
    if (j === i + 1 || s[j] !== "=" || s[j + 1] !== '"') return null;
    const k = s.indexOf('"', j + 2);
    if (k === -1) return null;
    const value = s.slice(j + 2, k);
    if (value.includes("<") || BARE_AMPERSAND.test(value)) return null;
    out.push([s.slice(i + 1, j), value]);
    i = k + 1;
  }
  return out;
}

/**
 * The second net: read a rendered document as tokens and refuse whatever the closed lists do not hold.
 * Returns `{ ok, refusals: [{ at, why, found }] }`; `why` is one of `not-a-string`, `hidden`, `text`, `tag`,
 * `element`, `attribute`, `href`, `nesting`. At most twenty refusals are listed. `nesting` covers what an
 * element may hold: an output it accepts is read by a browser as the tree the string writes.
 */
export function checkRendered(html) {
  const refusals = [];
  const refuse = (at, why, found) => { if (refusals.length < 20) refusals.push({ at, why, found: String(found).slice(0, 80) }); };
  if (typeof html !== "string") return { ok: false, refusals: [{ at: 0, why: "not-a-string", found: typeof html }] };
  const hidden = HIDDEN_ONCE.exec(html);
  if (hidden) refuse(hidden.index, "hidden", `U+${hidden[0].charCodeAt(0).toString(16).padStart(4, "0")}`);
  const stack = [];
  let anchors = 0; // open anchors: a link never holds a link
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf("<", i);
    const end = lt === -1 ? n : lt;
    if (end > i) {
      const t = html.slice(i, end);
      const bad = TEXT_REFUSED.exec(t);
      if (bad) refuse(i + bad.index, "text", t.slice(bad.index));
      if (TEXTLESS.has(stack[stack.length - 1])) refuse(i, "nesting", t);
    }
    if (lt === -1) break;
    const gt = html.indexOf(">", lt);
    if (gt === -1) { refuse(lt, "tag", html.slice(lt)); break; }
    const tag = html.slice(lt + 1, gt);
    i = gt + 1;
    if (tag.startsWith("/")) {
      const name = tag.slice(1);
      if (!ELEMENTS.has(name) || name === "hr") refuse(lt, "element", tag);
      else if (stack[stack.length - 1] !== name) refuse(lt, "nesting", tag);
      else { stack.pop(); if (name === "a") anchors--; }
      continue;
    }
    let j = 0;
    while (j < tag.length && ((tag[j] >= "a" && tag[j] <= "z") || (tag[j] >= "0" && tag[j] <= "9"))) j++;
    const name = tag.slice(0, j);
    if (!ELEMENTS.has(name)) { refuse(lt, "element", tag); continue; }
    const attrs = attributes(tag.slice(j));
    if (attrs === null) { refuse(lt, "tag", tag); continue; }
    const names = attrs.map((a) => a[0]).join(" ");
    const allowed = DOCUMENT_ATTRIBUTES[name] ?? [];
    if (attrs.some((a) => !allowed.includes(a[0]))) refuse(lt, "attribute", tag);
    else if (name === "a") {
      const href = decode(attrs[0]?.[1] ?? "");
      if (names === "href" && (ROUTE.test(href) || SLUG.test(href))) { /* a route of the application, or a slug of this document */ }
      else if (names === "href rel target" && httpsOnly(href) && attrs[1][1] === EXTERNAL_REL && attrs[2][1] === EXTERNAL_TARGET) { /* an absolute link, opened apart */ }
      else if (names !== "href" && names !== "href rel target") refuse(lt, "attribute", tag);
      else refuse(lt, "href", tag);
    } else if (allowed.length) {
      if (names !== "id" || !SLUG.test(`#${attrs[0][1]}`)) refuse(lt, "attribute", tag);
    }
    if (name === "a" && anchors > 0) refuse(lt, "nesting", tag);
    const holder = stack[stack.length - 1];
    if (PARENT[name] && !PARENT[name].includes(holder)) refuse(lt, "nesting", tag);
    else if (HOLDS[holder] && !HOLDS[holder].includes(name)) refuse(lt, "nesting", tag);
    if (stack.length >= MAX_NESTING) refuse(lt, "nesting", tag);
    if (name === "a") anchors++;
    if (name !== "hr") stack.push(name);
  }
  if (stack.length) refuse(n, "nesting", stack[stack.length - 1]);
  return { ok: refusals.length === 0, refusals };
}

// ------------------------------------------------------------------ the register of decision records
/** The statuses the record template declares. Another first word is shown as written: `word` is then null. */
export const REGISTER_STATUSES = ["proposed", "accepted", "superseded", "deprecated"];
/** Words that are not the template's and still say a status: after the first word, either makes the line read as written. */
const STATUS_WORDS = /(?<![a-z-])(proposed|accepted|superseded|deprecated|rejected|withdrawn)(?![a-z-])/gi;
const SUPERSEDED_BY = /^superseded +by +(?:\[ *)?ADR-([0-9]{4})(?![0-9])/i;
const ADR_FILE = /(?:^|\/)adr\/ADR-([0-9]{4})-[^/]*\.md$/;
const ADR_ID = /^(?:\[ *)?ADR-([0-9]{4})(?![0-9])/; // a record, or a link whose text starts with one
const FIELD = /^\*\*([A-Za-z][A-Za-z -]*)\*\* *: *(.*)$/;
const DAY = /^([0-9]{4}-[0-9]{2}-[0-9]{2})(?![0-9])/;

/** The records a header line names first: `ADR-0002 (…), ADR-0003 and ADR-0004`, read until the sentence goes on. */
function named(value) {
  const out = [];
  let s = value.trim();
  for (;;) {
    const m = ADR_ID.exec(s);
    if (!m) break;
    const linked = s.startsWith("[");
    s = s.slice(m[0].length);
    if (linked) { // the rest of the link's text, then its address
      const k = s.indexOf("]");
      if (k === -1) break;
      s = s.slice(k + 1);
      if (s.startsWith("(")) { const end = s.indexOf(")"); if (end === -1) break; s = s.slice(end + 1); }
    }
    out.push(m[1]);
    s = s.trimStart();
    if (s.startsWith("(")) { const k = s.indexOf(")"); if (k === -1) break; s = s.slice(k + 1).trimStart(); }
    const sep = /^(?:, and |,|and )\s*/.exec(s);
    if (!sep) break;
    s = s.slice(sep[0].length);
  }
  return out;
}

/** The lines under a `## ` heading that starts with `title`, until the next `## `, or null when no heading does. */
function section(lines, title) {
  const at = lines.findIndex((l) => l.startsWith("## ") && l.slice(3).trim().toLowerCase().startsWith(title));
  if (at === -1) return null;
  let end = at + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(at + 1, end);
}
const body = (ls) => (ls === null ? null : ls.join("\n").trim() || null);

/**
 * Whether a status line says something other than the word it starts with: another status word after
 * it. One form is read: a line that starts with `superseded by` a record may go on with the template's
 * statuses the record had before (`superseded by ADR-0019 (…); accepted (…)`).
 */
function contradicted(status, first, history) {
  for (const m of status.slice(first.length).matchAll(STATUS_WORDS)) {
    const w = m[1].toLowerCase();
    if (w === first || (history && REGISTER_STATUSES.includes(w))) continue;
    return true;
  }
  return false;
}
/** Whether an HTML comment is open at the end of a line, given whether one was at its start. */
function commentOpenAfter(line, open) {
  for (let k = 0; ;) {
    const j = line.indexOf(open ? "-->" : "<!--", k);
    if (j === -1) return open;
    k = j + (open ? 3 : 4);
    open = !open;
  }
}

function record(path, number, src) {
  const lines = plain(src).split("\n");
  const first = lines.findIndex((l) => l.trim() !== "");
  const head = first === -1 ? null : /^# +(ADR-[0-9]{4}) *: *(.*)$/.exec(lines[first].trim());
  const fields = new Map();
  let fence = null; // the mark of the fenced block a line is in
  let comment = false; // whether a line starts inside an HTML comment
  for (let i = first + 1; i > 0 && i < lines.length && !lines[i].startsWith("## "); i++) {
    const l = lines[i];
    const t = l.trim();
    if (fence !== null) { if (t.length >= fence.length && t === fence[0].repeat(t.length)) fence = null; continue; }
    const f = comment ? null : FENCE.exec(l);
    if (f) { fence = f[1]; continue; }
    const commented = comment || t.startsWith("<!--");
    comment = commentOpenAfter(l, comment);
    if (commented) continue; // a field is a line a reader of the record sees as one
    const m = FIELD.exec(t);
    if (m && !fields.has(m[1].toLowerCase())) fields.set(m[1].toLowerCase(), m[2].trim());
  }
  const field = (k) => fields.get(k) || null;
  const status = field("status");
  const starts = status === null ? null : REGISTER_STATUSES.find((w) => new RegExp(`^${w}(?![a-z-])`, "i").test(status)) ?? null;
  const by = starts === "superseded" ? SUPERSEDED_BY.exec(status) : null;
  const word = starts !== null && contradicted(status, starts, by !== null) ? null : starts;
  const date = field("date");
  const trigger = section(lines, "reevaluation trigger");
  const mark = trigger?.findIndex((l) => l.trim().startsWith("**Trigger set on**")) ?? -1;
  const set = mark === -1 ? null : /^\*\*Trigger set on\*\* *: *(\S+)(?: *· *\*\*Watched via\*\* *: *(.*))?$/.exec(trigger[mark].trim());
  const refs = section(lines, "references");
  return {
    number,
    path,
    title: head ? head[2].trim() || null : null,
    titleNumber: head ? head[1].slice(4) : null,
    date: date === null ? null : (DAY.exec(date)?.[1] ?? null),
    dateWritten: date,
    status: word,
    statusWritten: status,
    supersededBy: by && word ? by[1] : null,
    supersedes: named(field("supersedes") ?? ""),
    refines: named(field("refines") ?? ""),
    deciders: field("deciders"),
    method: field("method"),
    reopening: trigger === null ? null : {
      text: body(mark === -1 ? trigger : trigger.slice(0, mark)),
      setOn: set ? (DAY.exec(set[1])?.[1] ?? null) : null,
      watchedVia: set?.[2]?.trim() || null,
    },
    settles: body(section(lines, "what would settle it")),
    references: refs === null ? null : refs.map((l) => /^ *[-*] +(.*)$/.exec(l)?.[1].trim()).filter(Boolean),
  };
}

/**
 * The register of a mission's decision records, from its `adr/` documents: `files` is `[{ path, text }]`.
 * Each record is read from the header its file carries (the record template's: the title line, then
 * `**Date**`, `**Status**`, `**Supersedes**`, `**Refines**`, `**Deciders**`, `**Method**`), its
 * reevaluation trigger, what would settle it and its references. Nothing is inferred: a field the file
 * does not carry is null (it reads "not observed"), a status whose first word is outside
 * `REGISTER_STATUSES`, or that goes on with another status word, has `status: null` and is shown as
 * written (`statusWritten`), a header line in a fence or an HTML comment is not a field, and a relation is
 * listed on the record that writes it, never mirrored onto the record it names. Every value is the
 * file's text: a view escapes it or renders it with `renderDocument`.
 */
export function register(files) {
  const adrs = [];
  const unread = [];
  for (const f of Array.isArray(files) ? files : []) {
    const path = typeof f?.path === "string" ? f.path : "";
    if (!/(?:^|\/)adr\/[^/]+$/.test(path)) continue;
    const m = ADR_FILE.exec(path);
    if (!m) { unread.push({ path, why: "not-a-record-name" }); continue; }
    if (m[1] === "0000") { unread.push({ path, why: "template" }); continue; }
    if (typeof f.text !== "string") { unread.push({ path, why: "no-text" }); continue; }
    adrs.push(record(path, m[1], f.text));
  }
  adrs.sort((a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : a.path < b.path ? -1 : 1));
  unread.sort((a, b) => (a.path < b.path ? -1 : 1));
  const N = adrs.length;
  const group = (key) => {
    const numbers = adrs.filter((a) => (key === "as-written" ? a.status === null && a.statusWritten !== null : key === "not-observed" ? a.statusWritten === null : a.status === key)).map((a) => a.number);
    return { status: key, n: numbers.length, of: N, numbers };
  };
  const seen = new Map();
  for (const a of adrs) seen.set(a.number, (seen.get(a.number) ?? 0) + 1);
  return {
    format: REGISTER_FORMAT,
    count: N,
    adrs,
    byStatus: [...REGISTER_STATUSES, "as-written", "not-observed"].map(group),
    duplicates: [...seen].filter(([, k]) => k > 1).map(([number]) => number),
    unread,
  };
}

// ------------------------------------------------------------------ the topology note
const COLUMNS = [["port", /^port\b/i], ["adapter", /^adapter\b/i], ["family", /^location\b/i], ["dataClasses", /^data class/i], ["level", /level\b/i], ["adr", /^adr\b/i], ["trigger", /trigger\b/i]];

/**
 * The port placement table of a mission's topology note, as data: the first table whose header starts
 * with `Port` and holds a `Location family` column. Each row gives the cells as written, by column, and
 * `families` groups the ports by location family with n / N and the list it counts. A template row
 * (`_e.g._ …`) is marked `example`, a row of ellipses is left out. A drawing made from it escapes every
 * label. `found: false` when the note holds no such table: nothing is guessed from another one.
 */
export function topology(markdown) {
  const lines = plain(markdown).split("\n");
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!ROW.test(lines[i]) || !isDivider(lines[i + 1])) continue;
    const head = cells(lines[i]);
    const at = Object.fromEntries(COLUMNS.map(([k, re]) => [k, head.findIndex((h) => re.test(h))]));
    if (at.port !== 0 || at.family === -1) continue;
    const ports = [];
    for (let k = i + 2; k < lines.length && ROW.test(lines[k]); k++) {
      const c = cells(lines[k]);
      if (c.every((x) => x === "…" || x === "..." || x === "")) continue;
      const row = Object.fromEntries(COLUMNS.map(([key]) => [key, at[key] === -1 ? null : (c[at[key]] ?? "") || null]));
      row.example = /^_e\.g\._/.test(c[0] ?? "");
      ports.push(row);
    }
    const names = [...new Set(ports.map((p) => p.family))];
    return {
      format: TOPOLOGY_FORMAT,
      found: true,
      columns: head,
      ports,
      families: names.map((family) => { const of = ports.filter((p) => p.family === family).map((p) => p.port); return { family, n: of.length, of: ports.length, ports: of }; }),
    };
  }
  return { format: TOPOLOGY_FORMAT, found: false, columns: [], ports: [], families: [] };
}
