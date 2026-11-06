// The reports a leg wrote, made committable as ADR-0073 option 1 makes them: no absolute path, no
// timing, and nothing else changed. A verdict is never touched: a failed case keeps its failure, a
// finding keeps its severity, a count keeps its value. Each normaliser is idempotent, so a report a
// project's own script already normalised comes out byte for byte as it went in.
//
// `base` is the container path of the leg's working directory (`/runward-run/work/<cwd>`), `work` the
// container path of the copy of the tree: a path under either is rewritten relative to the leg's
// working directory, the form the reports of the shipped example carry (`src/core/domain/guard.ts`).

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function relativizer({ base, work }) {
  const prefixes = [`file://${base}/`, `${base}/`, `file://${work}/`, `${work}/`];
  const re = new RegExp(prefixes.map(escapeRe).join("|"), "g");
  const text = (s) => s.replace(re, "");
  const path = (p) => {
    const s = String(p);
    for (const pre of prefixes) if (s.startsWith(pre)) return s.slice(pre.length);
    if (s === base || s === `file://${base}`) return ".";
    return s;
  };
  return { text, path };
}

function junit(text, r) {
  return r.text(text)
    .replace(/(?<!\s)\s+(?:file|time|timestamp|hostname)="[^"]*"/g, "")
    .replace(/^[ \t]*<!--\s*duration_ms[^>]*-->\r?\n/gm, "");
}

function eslint(text, r) {
  const entries = JSON.parse(text);
  if (!Array.isArray(entries)) throw new Error("an ESLint report is a JSON array");
  const out = entries.map((e) => ({
    filePath: r.path(e.filePath),
    messages: (e.messages ?? []).map((m) => ({
      ruleId: m.ruleId ?? null, severity: m.severity, message: r.text(String(m.message ?? "")),
      line: m.line, column: m.column,
      ...(m.endLine !== undefined ? { endLine: m.endLine, endColumn: m.endColumn } : {}),
      ...(m.fatal ? { fatal: true } : {}),
    })),
    errorCount: e.errorCount, fatalErrorCount: e.fatalErrorCount, warningCount: e.warningCount,
  })).sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0));
  return `${JSON.stringify(out, null, 2)}\n`;
}

function sarif(text, r) {
  const doc = JSON.parse(text);
  const walk = (node, key) => {
    if (Array.isArray(node)) return node.map((x) => walk(x, key));
    if (!node || typeof node !== "object") return key === "uri" && typeof node === "string" ? r.path(node) : node;
    const o = {};
    for (const [k, v] of Object.entries(node)) {
      if (/^(startTimeUtc|endTimeUtc|timeUtc)$/.test(k)) continue;
      o[k] = walk(v, k);
    }
    return o;
  };
  return `${JSON.stringify(walk(doc, ""), null, 2)}\n`;
}

function lcov(text, r) {
  const out = text.split(/\r?\n/).map((l) => (l.startsWith("SF:") ? `SF:${r.path(l.slice(3))}` : l)).join("\n");
  return out.endsWith("\n") ? out : `${out}\n`;
}

function cobertura(text, r) {
  return r.text(text).replace(/\s+timestamp="[^"]*"/g, "");
}

function sbom(text) {
  const doc = JSON.parse(text);
  delete doc.serialNumber;
  if (doc.metadata && typeof doc.metadata === "object") delete doc.metadata.timestamp;
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** Normalise a report of a nature; throws when it is not the document its nature names. */
export function normalizeReport(nature, text, paths) {
  const r = relativizer(paths);
  const t = text.replace(/^﻿/, "");
  switch (nature) {
    case "junit": return junit(t, r);
    case "eslint": return eslint(t, r);
    case "sarif": return sarif(t, r);
    case "coverage": return /^SF:/m.test(t) ? lcov(t, r) : cobertura(t, r);
    case "sbom": return t.trimStart().startsWith("{") ? sbom(t) : r.text(t);
    default: return r.text(t);
  }
}
