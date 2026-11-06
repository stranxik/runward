// readers.js: what one committed tree says, read with fixed rules. No network, no clock, no locale.
//
// Every reader takes a Tree (the committed files and their text) and returns facts of the catalogue
// plus the details a report shows. A reader that cannot decide says so with {$unobserved: reason};
// it never guesses. The patterns are part of the grid's procedure: changing one that can move a
// result is a new rev of the criterion that reads it.
import { posix } from "node:path";
import { cmp, ratio, sha256 } from "./canon.js";

const EXCLUDED = /(^|\/)(node_modules|vendor|dist|build|coverage|\.git|\.stryker-tmp)\//;
const SCAFFOLD = /(^|\/)(examples?|templates?|fixtures?|__fixtures__|test-[^/]+|demo|testdata)\//;
const unobserved = (reason) => ({ $unobserved: reason });

export class Tree {
  constructor(files, read) {
    this.files = files.slice().sort(cmp);
    this.set = new Set(this.files);
    this._read = read;
    this._cache = new Map();
    this.lower = new Map(this.files.map((f) => [f.toLowerCase(), f]));
    this.dirs = new Set(this.files.flatMap((f) => { const p = f.split("/"); return p.slice(1).map((_, i) => p.slice(0, i + 1).join("/")); }));
    this.own = this.files.filter((f) => !EXCLUDED.test(f));
    this.surface = this.own.filter((f) => !SCAFFOLD.test(f));
  }
  has(p) { return this.set.has(p); }
  text(p) {
    if (!this.set.has(p)) return null;
    if (!this._cache.has(p)) this._cache.set(p, this._read(p));
    return this._cache.get(p);
  }
  json(p) { const t = this.text(p); if (t === null) return undefined; try { return JSON.parse(t); } catch { return null; } }
}

// ------------------------------------------------------------------------------------ governance
function findDoc(tree, names) {
  for (const dir of ["", ".github/", "docs/"]) {
    for (const n of names) {
      for (const [k, real] of tree.lower) {
        if (!k.startsWith(dir) || k.slice(dir.length).includes("/")) continue;
        const base = k.slice(dir.length);
        if (base === n || base.startsWith(n + ".")) return real;
      }
    }
  }
  return null;
}
const LICENSES = [
  ["MIT", /Permission is hereby granted, free of charge/i],
  ["Apache-2.0", /Apache License,?\s+Version 2\.0/i],
  ["ISC", /Permission to use, copy, modify, and\/or distribute this software for any purpose/i],
  ["BSD-3-Clause", /Redistribution and use in source and binary forms[\s\S]*Neither the name/i],
  ["BSD-2-Clause", /Redistribution and use in source and binary forms/i],
  ["AGPL-3.0", /GNU AFFERO GENERAL PUBLIC LICENSE/i],
  ["LGPL-3.0", /GNU LESSER GENERAL PUBLIC LICENSE/i],
  ["GPL-3.0", /GNU GENERAL PUBLIC LICENSE\s+Version 3/i],
  ["GPL-2.0", /GNU GENERAL PUBLIC LICENSE\s+Version 2/i],
  ["MPL-2.0", /Mozilla Public License,?\s+(v\.?|Version)\s*2\.0/i],
  ["Unlicense", /This is free and unencumbered software/i],
  ["CC0-1.0", /CC0 1\.0 Universal/i],
];
const SEC_CHANNEL = /security\/advisories\/new|report a vulnerability|private vulnerability|vulnerability report|security@|mailto:|signaler une vuln/i;
const SEC_DELAY = /\b(?:within|sous|under|in|dans|en)\s+\*{0,2}\d+\*{0,2}\s+(?:business\s+|working\s+)?(?:days?|hours?|jours?|heures?)\b/i;
const GOV = {
  roles: /maintainer|mainteneur|owner|steward|propriétaire/i,
  decisions: /decision|décision|\bADR\b|vote|consensus/i,
  succession: /succession|successor|bus factor|continuity|continuité|if the maintainer|ownership itself/i,
};

export function governance(tree) {
  const lic = findDoc(tree, ["license", "licence", "copying"]);
  const licText = lic ? tree.text(lic) ?? "" : "";
  const licId = lic ? (LICENSES.find(([, re]) => re.test(licText)) ?? ["unrecognised"])[0] : "absent";
  const readme = ["README.md", "README", "README.rst", "README.txt", "readme.md"].some((f) => tree.has(f));
  const contributing = findDoc(tree, ["contributing"]);
  const security = findDoc(tree, ["security"]);
  const secText = security ? tree.text(security) ?? "" : "";
  const gov = findDoc(tree, ["governance"]);
  const govText = gov ? tree.text(gov) ?? "" : "";
  return {
    facts: {
      "m.gou01.license_id": licId,
      "m.gou01.license_spdx": lic !== null && licId !== "unrecognised",
      "m.gou01.readme": readme,
      "m.gou01.contributing": contributing !== null,
      "m.gou01.security": security !== null,
      "m.gou01.gov_roles": gov !== null && GOV.roles.test(govText),
      "m.gou01.gov_decisions": gov !== null && GOV.decisions.test(govText),
      "m.gou01.gov_succession": gov !== null && GOV.succession.test(govText),
      "m.sec01.security_md": security !== null,
      "m.sec01.channel": security !== null && SEC_CHANNEL.test(secText),
      "m.sec01.delay_days": security !== null && SEC_DELAY.test(secText),
    },
    details: { license: lic, security, governance: gov, contributing },
  };
}

// ------------------------------------------------------------------------------------ packages
const LOCKS = ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock"];
export function packages(tree, sdks) {
  const pkgs = tree.surface.filter((f) => posix.basename(f) === "package.json").map((f) => {
    const j = tree.json(f);
    const dir = posix.dirname(f) === "." ? "" : posix.dirname(f) + "/";
    if (!j || typeof j !== "object") return { path: f, dir, parseError: true };
    return { path: f, dir, name: j.name ?? null, version: j.version ?? null, private: j.private === true, workspaces: !!j.workspaces,
      deps: Object.keys(j.dependencies ?? {}), devDeps: Object.keys(j.devDependencies ?? {}), scripts: j.scripts ?? {},
      lock: LOCKS.filter((l) => tree.has(dir + l)) };
  });
  const byDir = new Map(pkgs.map((p) => [p.dir, p]));
  const covered = (p) => {
    if (p.lock?.length) return true;
    // a workspace member is covered by an ancestor that declares workspaces and holds a lockfile
    let d = p.dir;
    while (d) {
      d = d.replace(/[^/]+\/$/, "");
      const a = byDir.get(d);
      if (a && a.workspaces && a.lock?.length) return true;
      if (!d) break;
    }
    return false;
  };
  const withDeps = pkgs.filter((p) => !p.parseError && p.deps.length + p.devDeps.length > 0);
  const unlocked = withDeps.filter((p) => !covered(p)).map((p) => p.path);
  const root = byDir.get("") ?? null;
  const allDeps = new Set(pkgs.flatMap((p) => [...(p.deps ?? []), ...(p.devDeps ?? [])]));
  return {
    facts: { "m.sec02.lockfile": withDeps.length === 0 ? unobserved("no package.json with dependencies: no npm lockfile to expect (the only ecosystem runward-assess 0.1.0 reads)") : unlocked.length === 0 },
    evidence: {
      publishable: pkgs.filter((p) => p.name && p.version && !p.private).map((p) => p.name).sort(cmp),
      modelSdks: sdks.model.filter((s) => allDeps.has(s)).sort(cmp),
      toolSdks: sdks.tools.filter((s) => allDeps.has(s)).sort(cmp),
      rootScripts: root ? Object.keys(root.scripts).sort(cmp) : [],
      rootScriptText: root ? Object.entries(root.scripts).map(([k, v]) => `${k}: ${v}`).join("\n") : "",
    },
    details: { packageFiles: pkgs.length, withDependencies: withDeps.length, unlocked },
    root,
  };
}

// ------------------------------------------------------------------------------------ workflows
/** The events a workflow listens to, read line by line from its `on:` key (never a backtracking pattern). */
export function triggers(t) {
  const lines = t.split("\n");
  const i = lines.findIndex((l) => /^(?:on|"on"|'on'):/.test(l));
  const out = new Set();
  if (i < 0) return out;
  const inline = lines[i].replace(/^(?:on|"on"|'on'):/, "").replace(/#.*$/, "").trim();
  if (inline) { for (const x of inline.replace(/^\[|\]$/g, "").split(",")) { const y = x.trim().replace(/['":]/g, ""); if (y) out.add(y); } return out; }
  let indent = null;
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim() || /^\s*#/.test(l)) continue;
    if (/^\S/.test(l)) break;
    const lead = l.length - l.trimStart().length;
    if (indent === null) indent = lead;
    if (lead !== indent) continue;
    const m = /^\s+(?:-\s*)?([A-Za-z_]+)/.exec(l);
    if (m) out.add(m[1]);
  }
  return out;
}
/** A checkout step whose `ref:` names the pull request's head: the untrusted code, under a trusted trigger. */
export function checksOutHead(t) {
  const lines = t.split("\n").map((l) => l.replace(/(^|\s)#.*$/, ""));
  const HEAD = /github\.event\.pull_request\.head\.(?:sha|ref)|github\.head_ref|refs\/pull\/[^\s'"]*\/(?:head|merge)/;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)-?\s*uses:\s*["']?actions\/checkout@/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim()) continue;
      const lead = l.length - l.trimStart().length;
      if (lead <= indent && /^\s*-/.test(l)) break;
      if (lead < indent) break;
      if (/^\s*ref:/.test(l) && HEAD.test(l)) return true;
    }
  }
  return false;
}
export function workflows(tree) {
  const files = tree.own.filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f) || (/(^|\/)action\.ya?ml$/.test(f) && !SCAFFOLD.test(f))).sort(cmp);
  const findings = [];
  const signing = [];
  for (const f of files) {
    const t = tree.text(f) ?? "";
    const isWorkflow = f.startsWith(".github/workflows/");
    for (const m of t.matchAll(/^\s*-?\s*uses:\s*["']?([^\s"'#]+)/gm)) {
      const ref = m[1];
      if (ref.startsWith("./")) continue;
      if (ref.startsWith("docker://")) { if (!/@sha256:[0-9a-f]{64}$/.test(ref)) findings.push({ file: f, rule: "W2", what: ref }); continue; }
      if (!/@[0-9a-f]{40}$/.test(ref)) findings.push({ file: f, rule: "W2", what: ref });
    }
    if (!isWorkflow) continue;
    if (!/^permissions:/m.test(t)) findings.push({ file: f, rule: "W3", what: "no top-level permissions" });
    if (/permissions:\s*write-all/.test(t)) findings.push({ file: f, rule: "W3", what: "write-all" });
    if (triggers(t).has("pull_request_target") && checksOutHead(t)) findings.push({ file: f, rule: "W1", what: "pull_request_target with a checkout of the head" });
    // jobs granted id-token: write, and what they run
    const lines = t.split("\n");
    const jobsAt = lines.findIndex((l) => /^jobs:\s*$/.test(l));
    if (jobsAt < 0) continue;
    let job = null, body = [];
    const flush = () => {
      if (!job) return;
      const text = body.join("\n");
      if (/id-token:\s*write/.test(text)) {
        const runs = /\bnpm (?:ci|install|i|test|t|run test\S*)\b|\byarn(?: install)?\b|\bpnpm (?:install|i)\b|\bnode --test\b/.test(text.replace(/#.*$/gm, ""));
        signing.push({ file: f, job, installsOrTests: runs });
      }
    };
    for (let i = jobsAt + 1; i < lines.length; i++) {
      const l = lines[i];
      const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
      if (m) { flush(); job = m[1]; body = []; continue; }
      if (/^\S/.test(l)) { flush(); job = null; body = []; continue; }
      if (job) body.push(l);
    }
    flush();
  }
  findings.sort((a, b) => cmp(`${a.file}|${a.rule}|${a.what}`, `${b.file}|${b.rule}|${b.what}`));
  signing.sort((a, b) => cmp(`${a.file}|${a.job}`, `${b.file}|${b.job}`));
  const allText = files.map((f) => tree.text(f) ?? "").join("\n");
  return {
    facts: {
      "m.sec05.workflow_high": findings.length,
      "m.sec06.signing_jobs": signing.length,
      "m.sec06.signing_job_clean": signing.length === 0 ? unobserved("no job is granted id-token: write: nothing signs in this repository's workflows") : signing.every((s) => !s.installsOrTests),
    },
    details: { files: files.length, findings, signing },
    allText,
  };
}

// ------------------------------------------------------------------------------------ decisions
const STATUS = [["accepted", /^(accepted|accepté|acceptée|ratified|adopted|decided|approved)/], ["proposed", /^(proposed|proposé|proposée|draft|brouillon|en discussion|under review|hypothesis)/],
  ["superseded", /^(superseded|remplacé|remplacée|replaced)/], ["deprecated", /^(deprecated|obsolète|retired)/], ["rejected", /^(rejected|rejeté|rejetée|abandoned|abandonné|declined|withdrawn)/]];
export function adrStatus(t) {
  const m = t.match(/^\s*(?:[-*]\s*)?\*{0,2}(?:Status|Statut)\*{0,2}\s*:\s*\*{0,2}\s*`?([^\n`*]+)/im)
    ?? t.match(/^#{2,3}\s*(?:Status|Statut)\s*\n+\s*\*{0,2}`?([^\n`*]+)/im) ?? t.match(/^status:\s*["']?([^\n"']+)/im);
  if (!m) return "missing";
  const w = m[1].trim().toLowerCase();
  return (STATUS.find(([, re]) => re.test(w)) ?? ["other"])[0];
}
const DATE = /\b(\d{4}-\d{2}-\d{2})\b/g;
export function decisions(tree, commitDate) {
  const adrs = tree.surface.filter((f) => /\.md$/i.test(f) && /^(runward\/adr|docs\/adr|doc\/adr|adr|docs\/decisions)\/ADR[-_]?\d{3,4}[^/]*\.md$/i.test(f) && !/ADR[-_]?0000|template/i.test(posix.basename(f)));
  let readable = 0, dated = 0;
  const overdue = [];
  const day = commitDate.slice(0, 10);
  for (const f of adrs) {
    const t = tree.text(f) ?? "";
    const st = adrStatus(t);
    if (st !== "missing" && st !== "other") readable++;
    const own = ((t.match(/^\s*\*{0,2}(?:Date)\*{0,2}\s*:\s*\*{0,2}\s*(\d{4}-\d{2}-\d{2})/im) ?? [])[1]) ?? null;
    const lines = t.split("\n");
    const at = lines.findIndex((l) => /^#{2,3}\s*(Re-?evaluation|Réévaluation|Reevaluation|Déclencheur|Re-evaluation trigger)/i.test(l));
    if (at < 0) continue;
    let end = lines.findIndex((l, i) => i > at && /^#{1,2}\s/.test(l));
    if (end < 0) end = lines.length;
    const section = lines.slice(at + 1, end).join("\n");
    const sectionDates = [...section.matchAll(DATE)].map((m) => m[1]);
    if (!sectionDates.length) continue;
    dated++;
    if (st !== "accepted") continue;
    // A deadline is a date of the section later than the decision's own date; the date a trigger
    // was set on is not one.
    const setOn = new Set([...section.matchAll(/set on\**\s*:?\**\s*(\d{4}-\d{2}-\d{2})/gi)].map((m) => m[1]));
    const deadlines = sectionDates.filter((d) => (own === null ? !setOn.has(d) : d > own)).sort(cmp);
    if (!deadlines.length) continue;
    const latest = deadlines[deadlines.length - 1];
    if (latest >= day) continue;
    const later = [...t.matchAll(DATE)].map((m) => m[1]).some((d) => d > latest && d <= day && !sectionDates.includes(d));
    if (!later) overdue.push({ adr: f, trigger: latest });
  }
  return {
    facts: {
      "m.gou05.adrs": adrs.length,
      "m.gou05.status_readable": ratio(readable, adrs.length),
      "m.gou05.trigger_dated": ratio(dated, adrs.length),
      "m.gou05.overdue_unnoted": overdue.length,
    },
    details: { overdue: overdue.sort((a, b) => cmp(a.adr, b.adr)), journals: [...new Set(adrs.map((f) => posix.dirname(f)))].sort(cmp) },
  };
}

// ------------------------------------------------------------------------------------ defect register
const REG_FIELDS = ["class", "effect", "affected", "fixed", "foundBy", "advisory"];
export function register(tree, decl, commitDate, unclassifiedDays = 30) {
  if (!decl?.path) return { facts: { "m.prv04.register": false, "m.prv04.entries": 0, "m.prv04.parsed": ratio(0, 0), "m.prv04.unclassified_over_30d": unobserved("no defect register declared"), "m.prv04.fixed_without_test": unobserved("no defect register declared") }, details: { declared: null } };
  if (!tree.has(decl.path)) return { facts: { "m.prv04.register": false, "m.prv04.entries": 0, "m.prv04.parsed": ratio(0, 0), "m.prv04.unclassified_over_30d": unobserved(`${decl.path} is not in the tree`), "m.prv04.fixed_without_test": unobserved(`${decl.path} is not in the tree`) }, details: { declared: decl.path } };
  if (decl.format !== "runward-known-defects/1") return { facts: { "m.prv04.register": true, "m.prv04.entries": unobserved(`format ${decl.format} is not read by runward-assess 0.1.0`), "m.prv04.parsed": unobserved(`format ${decl.format} is not read`), "m.prv04.unclassified_over_30d": unobserved("format not read"), "m.prv04.fixed_without_test": unobserved("format not read") }, details: { declared: decl.path } };
  const text = tree.text(decl.path) ?? "";
  const grab = (s, k) => (s.match(new RegExp("`" + k + "` = `([a-z-]+)`")) ?? [])[1] ?? null;
  let sec = { cls: null, effect: null, date: null };
  const rows = [];
  for (const l of text.split("\n")) {
    if (l.startsWith("## ")) { const dates = [...l.matchAll(DATE)].map((m) => m[1]).sort(cmp); sec = { cls: null, effect: null, date: dates[0] ?? null }; continue; }
    const r = l.match(/^\| (RWD-\d{4}-\d{4}) \|(.*)$/);
    if (r) {
      const b = r[2];
      const cells = b.split(" | ");
      const own = [...b.matchAll(DATE)].map((m) => m[1]).sort(cmp);
      rows.push({ id: r[1], class: grab(b, "class") ?? sec.cls, effect: grab(b, "effect") ?? sec.effect, foundBy: grab(b, "found-by"),
        advisory: (b.match(/`advisory=([^`]+)`/) ?? [])[1] ?? null, affected: (b.match(/`affected-from=([^`]+)`/) ?? [])[1] ?? null,
        fixed: (b.match(/`fixed-in=([^`]+)`/) ?? [])[1] ?? null, date: sec.date ?? own[0] ?? null,
        tests: [...(cells[1] ?? b).matchAll(/`([^`\s]*(?:test\/[^`\s]+|\.test\.[cm]?[jt]s))`/g)].map((m) => m[1]) });
      continue;
    }
    if (!l.startsWith("|")) { const c = grab(l, "class"), e = grab(l, "effect"); if (c && !sec.cls) sec.cls = c; if (e && !sec.effect) sec.effect = e; }
  }
  const parsed = rows.filter((x) => REG_FIELDS.every((k) => x[k])).length;
  const limit = commitDate.slice(0, 10);
  const minus = (d, days) => { const [y, m, dd] = d.split("-").map(Number); const t = Date.UTC(y, m - 1, dd) - days * 86400000; return new Date(t).toISOString().slice(0, 10); };
  const cutoff = minus(limit, unclassifiedDays);
  const unclassifiedOld = rows.filter((x) => x.advisory === "unclassified" && x.date !== null && x.date < cutoff);
  const isFixed = (x) => x.fixed && (/^\d+\.\d+\.\d+/.test(x.fixed) || /^unreleased/.test(x.fixed));
  const noTest = rows.filter((x) => isFixed(x) && !x.tests.some((p) => tree.has(p)));
  return {
    facts: {
      "m.prv04.register": true,
      "m.prv04.entries": rows.length,
      "m.prv04.parsed": ratio(parsed, rows.length),
      "m.prv04.unclassified_over_30d": unclassifiedOld.length,
      "m.prv04.fixed_without_test": noTest.length,
    },
    details: { declared: decl.path, unparsed: rows.filter((x) => !REG_FIELDS.every((k) => x[k])).map((x) => x.id), unclassifiedOld: unclassifiedOld.map((x) => x.id), fixedWithoutTest: noTest.map((x) => x.id).slice(0, 40), fixedWithoutTestCount: noTest.length },
  };
}

// ------------------------------------------------------------------------------------ mutation register
export function mutation(tree, perimeter) {
  const out = {};
  if (perimeter && tree.has(perimeter)) {
    const j = tree.json(perimeter);
    out["m.fia07.perimeter_files"] = j && Array.isArray(j.mutate) ? j.mutate.length : unobserved(`${perimeter} has no mutate list`);
  } else out["m.fia07.perimeter_files"] = unobserved(perimeter ? `${perimeter} is not in the tree` : "no mutation perimeter declared");
  const files = tree.surface.filter((f) => /(^|\/)mutation-survivors\/[^/]+\.json$/.test(f));
  if (!files.length) {
    for (const k of ["m.fia07.register_survivors", "m.fia07.register_holes", "m.fia07.holes_by_default"]) out[k] = unobserved("no survivors register in the runward format (mutation-survivors/*.json)");
    return { facts: out };
  }
  let survivors = 0, holes = 0, byDefault = 0;
  for (const f of files) {
    const j = tree.json(f);
    for (const v of j?.verdicts ?? []) {
      survivors++;
      if (v.filing === "hole") { holes++; if (/^(NOT YET INSTRUCTED|COULD NOT CLEAR)/.test(v.evidence ?? "")) byDefault++; }
    }
  }
  Object.assign(out, { "m.fia07.register_survivors": survivors, "m.fia07.register_holes": holes, "m.fia07.holes_by_default": byDefault });
  return { facts: out };
}

// ------------------------------------------------------------------------------------ links
export function links(tree) {
  const md = tree.surface.filter((f) => /\.md$/i.test(f));
  let count = 0;
  const dead = [];
  for (const f of md) {
    const t = (tree.text(f) ?? "").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    for (const m of t.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      let u = m[1];
      if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(u)) continue;
      u = u.split("#")[0].split("?")[0];
      if (!u) continue;
      let target;
      try { target = posix.normalize(u.startsWith("/") ? u.slice(1) : posix.join(posix.dirname(f), decodeURIComponent(u))).replace(/\/$/, ""); } catch { continue; }
      count++;
      if (!tree.has(target) && !tree.dirs.has(target)) dead.push(`${f} -> ${u}`);
    }
  }
  dead.sort(cmp);
  return { facts: { "m.ado02.internal_links": count, "m.ado02.internal_broken": dead.length }, details: { markdownFiles: md.length, deadSample: dead.slice(0, 20) } };
}

// ------------------------------------------------------------------------------------ public text
/** Plain text of an HTML page or a Markdown file, for the lexical detectors. Deterministic. */
export function plainText(s, kind) {
  let t = String(s ?? "");
  if (kind === "html") {
    t = t.replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ").replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer)>/gi, "\n").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
  } else {
    t = t.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, " ");
  }
  return t;
}
export function sentences(text) {
  return text.split(/(?<=[.!?])\s+|\n{1,}/).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 2);
}
// A number beside a unit or a noun, or a version. No two adjacent quantifiers overlap: every pattern
// of this file runs in linear time on the longest line a repository holds.
const FACTUAL = /\b\d[\d,.]*\s*(?:%|percent|pour ?cent)|\b\d[\d,.]*\s+[A-Za-zÀ-ÿ'’-]{3,}|\bv?\d+\.\d+\.\d+\b/;
export function factualCount(text) { return sentences(text).filter((s) => FACTUAL.test(s)).length; }

export function lexiconHits(text, lexicon, projectTerms = [], exceptions = []) {
  const neg = new RegExp(lexicon.negation, "i");
  const opens = new RegExp(lexicon.negatingOpening ?? "^$", "i");
  const terms = [...lexicon.terms.map((t) => ({ id: t.id, re: new RegExp(t.re, "gi") })), ...projectTerms.map((t, i) => ({ id: `project-${i + 1}`, re: new RegExp(t, "gi") }))];
  let hits = 0, negated = 0;
  const found = [];
  for (const s of sentences(text)) {
    const matches = [];
    for (const t of terms) { t.re.lastIndex = 0; for (const m of s.matchAll(t.re)) matches.push({ id: t.id, at: m.index, end: m.index + m[0].length }); }
    for (const m of matches) {
      // The negation must govern this term: the four words before it, other terms' own words left out
      // ("no hallucination, guaranteed" negates nothing; "is not guaranteed" does).
      let before = "";
      for (let i = 0; i < m.at; i++) before += matches.some((o) => o !== m && i >= o.at && i < o.end) ? " " : s[i];
      const window = before.trim().split(/\s+/).slice(-4).join(" ");
      const fp = sha256(`${m.id}|${s}`).slice(0, 16);
      if (exceptions.includes(fp)) continue;
      if (neg.test(window) || opens.test(s)) { negated++; continue; }
      hits++;
      found.push({ fingerprint: fp, sentence: s.slice(0, 160), term: m.id });
    }
  }
  return { found, hits, negated };
}

// ------------------------------------------------------------------------------------ tags, changelog, support
export function versions(tree, tags) {
  const ch = findDoc(tree, ["changelog", "history", "changes"]);
  const heads = ch ? [...(tree.text(ch) ?? "").matchAll(/^#{1,3}\s*\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?/gm)].map((m) => m[1]) : [];
  const support = tree.json("support.json");
  const lines = support && Array.isArray(support.lines) ? support.lines.filter((l) => l && (l.status === "maintained" || l.status === "supported")).map((l) => String(l.line)).sort(cmp) : [];
  return {
    facts: {
      "m.gou06.tags": [...new Set(tags)].sort(cmp),
      "m.gou06.changelog_versions": [...new Set(heads)].sort(cmp),
      "m.gou06.support_policy": !!(support && Array.isArray(support.lines)),
      "m.gou06.support_lines": lines,
    },
    details: { changelog: ch },
  };
}

// ------------------------------------------------------------------------------------ declared files
export function declaredFiles(tree, prof) {
  const facts = {};
  const ev = prof.evals ?? null;
  if (ev?.set) {
    const set = tree.files.filter((f) => f === ev.set || f.startsWith(ev.set.replace(/\/?$/, "/")));
    facts["m.fia05.eval_set"] = set.length > 0;
    facts["m.fia05.eval_set_digest"] = set.length ? sha256(set.map((f) => `${f}\0${tree.text(f) ?? ""}`).join("\0")) : unobserved(`${ev.set} is not in the tree`);
  } else { facts["m.fia05.eval_set"] = false; facts["m.fia05.eval_set_digest"] = unobserved("no evaluation set declared (profile: evals.set)"); }
  facts["m.fia05.eval_runner"] = typeof ev?.runner === "string" && ev.runner.length > 0;
  if (prof.slo_file) {
    const j = tree.json(prof.slo_file);
    facts["m.fia06.slo_declared"] = !!(j && j.objective !== undefined && j.sli !== undefined);
  } else facts["m.fia06.slo_declared"] = false;
  if (prof.tools_manifest && prof.tools_pattern) {
    const re = new RegExp(prof.tools_pattern, "g");
    const names = new Set();
    for (const f of tree.surface.filter((x) => /\.[cm]?[jt]sx?$/.test(x))) for (const m of (tree.text(f) ?? "").matchAll(re)) if (m[1]) names.add(m[1]);
    const man = tree.json(prof.tools_manifest);
    const listed = new Set(Array.isArray(man?.tools) ? man.tools.map((t) => (typeof t === "string" ? t : t?.name)).filter(Boolean) : []);
    const missingTools = [...names].filter((n) => !listed.has(n)).sort(cmp);
    facts["m.sec07.tools_registered"] = names.size;
    facts["m.sec07.tools_missing"] = man ? missingTools.length : unobserved(`${prof.tools_manifest} is not in the tree`);
    facts["m.sec07.manifest_complete"] = !!man && missingTools.length === 0 && names.size > 0;
  } else {
    facts["m.sec07.tools_registered"] = unobserved("no tools_pattern declared");
    facts["m.sec07.tools_missing"] = unobserved("no tools_manifest declared");
    facts["m.sec07.manifest_complete"] = false;
  }
  const docs = Array.isArray(prof.docs_conformite) ? prof.docs_conformite : [];
  const cited = docs.filter((d) => { const j = tree.json(d); return j && typeof j.regime === "string" && j.regime && typeof j.version === "string" && j.version; });
  facts["m.prv05.cited"] = ratio(cited.length, docs.length);
  facts["m.pro01.claims_register"] = !!(prof.claims_register && tree.has(prof.claims_register));
  return facts;
}
