// mission.js: the trace a runward mission writes, read as text by this package's own reader.
//
// runward's gated manifests are Markdown tables `| Rule | Status | Evidence |`; their typed pointers
// (file:, test:, adr:) are read here with the grammar the manifests are written in, and resolved
// against the committed tree. This reader is a second implementation on purpose: the grid judges the
// gate, so it does not ask the gate whether its own pointers resolve.
import { posix } from "node:path";
import { cmp, ratio } from "./canon.js";

export const GATED = ["runward/architecture.md", "runward/execution-topology.md", "runward/floor.md", "runward/governance/threat-model.md", "runward/handover.md"];
export const PTR = /(file|test):([^\s;,)]+?)(::"[^"]*"|::[^\s;,]+|#[A-Za-z_][\w]*|:\d+)?(?=[\s;,)]|$)/g;
const unobserved = (reason) => ({ $unobserved: reason });

export function manifestRows(text) {
  const lines = text.split("\n");
  const idx = [];
  let inTab = false;
  lines.forEach((l, i) => {
    if (l.startsWith("| Rule | Status | Evidence")) { inTab = true; return; }
    if (inTab && !l.startsWith("|")) inTab = false;
    if (inTab && l.startsWith("|") && !l.startsWith("|---")) idx.push(i);
  });
  return { lines, idx };
}

/** Split an Evidence cell on `;`, never inside a double-quoted name (the manifests' own grammar). */
function segments(cell) {
  const out = [];
  let buf = "", quoted = false;
  for (const ch of cell) {
    if (ch === '"') quoted = !quoted;
    if (ch === ";" && !quoted) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}
/**
 * The typed pointers of an Evidence cell. A quoted test name ends at its closing quote; an unquoted
 * one runs to the end of its segment, or to the next pointer. A file symbol ends at a space unless
 * quoted. `adr:NNNN` is a decision.
 */
/** The Evidence cell of a `| Rule | Status | Evidence |` row: everything after the second cell, the closing pipe left out. */
export function evidenceCell(line) {
  const cells = line.split("|");
  const body = cells.slice(3);
  if (/\|\s*$/.test(line)) body.pop();
  return body.join("|");
}

export function rowPointers(evidence) {
  const out = [];
  for (const seg of segments(evidence.replace(/[\r\n]+/g, " "))) {
    const starts = [...seg.matchAll(/(?:^|[\s,(])((?:file|test|adr):\S)/g)].map((m) => m.index + m[0].length - m[1].length);
    starts.forEach((at, i) => {
      const chunk = seg.slice(at, i + 1 < starts.length ? starts[i + 1] : seg.length);
      const kind = chunk.slice(0, chunk.indexOf(":"));
      const rest = chunk.slice(kind.length + 1);
      if (kind === "adr") { const m = /^(\d{4})\b/.exec(rest); if (m) out.push({ kind, path: m[1], suffix: "" }); return; }
      if (kind === "test") {
        const sep = rest.indexOf("::");
        const ws = rest.search(/\s/);
        if (sep !== -1 && (ws === -1 || sep < ws)) {
          const after = rest.slice(sep + 2);
          const q = /^\s*"([^"]*)"/.exec(after);
          const name = q ? q[1] : after.trim().replace(/[,)]+$/, "");
          out.push({ kind, path: rest.slice(0, sep).replace(/[,)]+$/, ""), suffix: `::"${name}"` });
        } else out.push({ kind, path: rest.split(/\s/)[0].replace(/[,)]+$/, ""), suffix: "" });
        return;
      }
      const token = /^([^\s#;,)]+)(:\d+)?(#"[^"]*"|#[A-Za-z_$][\w$]*)?/.exec(rest);
      if (!token) return;
      let suffix = token[3] ?? token[2] ?? "";
      if (suffix.startsWith('#"')) suffix = "#" + suffix.slice(2, -1);
      out.push({ kind, path: token[1].replace(/:\d+$/, ""), suffix });
    });
  }
  return out;
}

export const decodeXml = (v) => {
  let prev, x = v;
  do { prev = x; x = x.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); } while (x !== prev);
  return x;
};

export function junitNames(xml) {
  const names = new Set();
  for (const m of xml.matchAll(/<testcase\b([^>]*?)\/?>/g)) {
    const a = (k) => { const r = m[1].match(new RegExp(`\\b${k}="([^"]*)"`)); return r ? decodeXml(r[1]) : null; };
    const n = a("name"), c = a("classname");
    if (n !== null) { names.add(n); if (c !== null) names.add(`${c}::${n}`); }
  }
  return names;
}

const ADR_DIRS = ["runward/adr", "docs/adr", "doc/adr", "adr"];
export function resolvePointer(tree, p) {
  if (p.kind === "adr") return ADR_DIRS.some((d) => tree.files.some((f) => f.startsWith(`${d}/ADR-${p.path}`)));
  const path = posix.normalize(p.path).replace(/^\.\//, "");
  const isFile = tree.has(path);
  if (!isFile && !tree.dirs.has(path)) return false;
  if (!p.suffix) return true;
  if (!isFile) return false;
  const text = tree.text(path) ?? "";
  if (p.suffix.startsWith("#")) {
    const sym = p.suffix.slice(1);
    if (!/^[A-Za-z_$][\w$]*$/.test(sym)) return text.includes(sym);
    return new RegExp(`(?<![\\w$])${sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w$])`).test(text);
  }
  if (/^:\d+$/.test(p.suffix)) return text.split("\n").length >= Number(p.suffix.slice(1));
  if (p.suffix.startsWith("::")) {
    let name = p.suffix.slice(2);
    if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
    name = decodeXml(name);
    if (path.endsWith(".xml")) return junitNames(text).has(name);
    return text.includes(name);
  }
  return true;
}

/** PRV-01: the trace, its identifiers, and how many of its pointers resolve. */
export function trace(tree, prof) {
  const manifests = GATED.filter((m) => tree.has(m));
  const rows = [];
  const dupes = [];
  for (const m of manifests) {
    const { lines, idx } = manifestRows(tree.text(m) ?? "");
    const seen = new Set();
    for (const i of idx) {
      const cells = lines[i].split("|");
      if (cells.length < 4) continue;
      const rule = (cells[1] ?? "").trim();
      const status = (cells[2] ?? "").trim().toLowerCase();
      if (seen.has(rule)) dupes.push(`${m}: ${rule}`);
      seen.add(rule);
      rows.push({ manifest: m, rule, status, pointers: status === "applied" ? rowPointers(evidenceCell(lines[i])) : [] });
    }
  }
  if (!rows.length && prof.trace_file && tree.has(prof.trace_file)) {
    const j = tree.json(prof.trace_file);
    for (const it of Array.isArray(j?.items) ? j.items : []) {
      rows.push({ manifest: prof.trace_file, rule: String(it.id ?? ""), status: "applied", pointers: (it.pointers ?? []).flatMap((s) => rowPointers(String(s))) });
    }
    const ids = rows.map((r) => r.rule);
    for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) dupes.push(`${prof.trace_file}: ${id}`);
  }
  if (!rows.length) {
    return { facts: { "m.prv01.trace": false, "m.prv01.rows": 0, "m.prv01.ids_unique": false, "m.prv01.pointers": ratio(0, 0) }, details: { manifests: [], unresolved: [] }, rows };
  }
  const all = rows.flatMap((r) => r.pointers.map((p) => ({ ...p, manifest: r.manifest, rule: r.rule })));
  const unresolved = all.filter((p) => !resolvePointer(tree, p));
  return {
    facts: {
      "m.prv01.trace": true,
      "m.prv01.rows": rows.length,
      "m.prv01.ids_unique": dupes.length === 0 && rows.every((r) => r.rule.length > 0),
      "m.prv01.pointers": ratio(all.length - unresolved.length, all.length),
    },
    details: {
      manifests,
      duplicateIds: dupes.sort(cmp),
      unresolved: unresolved.map((p) => `${p.manifest} ${p.rule}: ${p.kind}:${p.path}${p.suffix}`).sort(cmp).slice(0, 30),
      byStatus: rows.reduce((m, r) => { m[r.status] = (m[r.status] ?? 0) + 1; return m; }, {}),
    },
    rows,
  };
}

/** Whether the tree is a runward mission at all, and the runward version its lockfile pins. */
export function missionFacts(tree) {
  const isMission = tree.has("runward/scaffold-lock.json") || GATED.some((m) => tree.has(m));
  const lock = tree.json("package-lock.json");
  const pin = lock?.packages?.["node_modules/runward"] ?? null;
  const root = tree.json("package.json");
  return { isMission, isProduct: root?.name === "runward", pinned: pin ? { integrity: pin.integrity ?? null, version: pin.version ?? null } : null };
}

export { unobserved };
