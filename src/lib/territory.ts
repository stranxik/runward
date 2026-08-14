import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * Territory categories and their derivation (ADR-0043).
 *
 * A rule declares the CATEGORY of artifact it governs (`governs:`) and no path. Which files
 * are in that category is derived from what the project ALREADY declares in a deployment
 * manifest — never from its code. A manifest entry is an operator declaration in a normed
 * file, the same class of fact `characterize` reads per ecosystem; reading it is not the
 * content signal ADR-0041 refused.
 *
 * The hard line, throughout: an unparseable or unmodelled manifest yields NO derivation and
 * says so. "Nothing is declared" and "I could not read it" are different answers, and
 * collapsing them is the failure this file exists to avoid (ADR-0035's discipline).
 */

/** The closed vocabulary named at ADR-0043's ratification. A category is added when a shipped
 *  rule needs one, never in anticipation — `secret-boundary` was split out of `configuration` on
 *  field evidence: two rules shared that word with different subjects, so declaring a file
 *  "configuration" would have surfaced the typed-config rule as a false positive beside the
 *  secret-boundary one it was meant to reach, and a signal that arrives with noise stops being
 *  read. Granularity is set by what missions must be able to declare separately. */
export const CATEGORIES = [
  "background-work", "configuration", "model-provider", "port-adapter",
  "schema-migration", "scheduled-work", "secret-boundary", "startup",
] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(s: string): s is Category {
  return (CATEGORIES as readonly string[]).includes(s);
}

/** One file bound to one category, with the declaration that bound it — the `<source>` half of
 *  the `git check-ignore -v` model: which file, which line, which declaration. */
/** Where a binding came from. Both members carry a file and a line where one exists, so the
 *  rendered reason always answers "because of what, written where" — the `<source>` component of
 *  the `git check-ignore -v` model that ADR-0041 named and could not yet supply. */
export type BindingSource =
  | { source: "derived"; adapter: string; file: string; line: number | null; declaration: string }
  | { source: "map"; file: string; line: number; pattern: string; why: string };

export interface Binding {
  path: string;                 // project-relative, POSIX
  category: Category;
  via: BindingSource;
}

/** What an adapter could not do, named. Never a silent empty result. */
export interface DerivationNote {
  adapter: string;
  file: string | null;
  /** `read` = parsed; `unread` = present but not modelled; `absent` = no manifest; `ambiguous`
   *  = more than one manifest and no documented precedence. */
  outcome: "read" | "unread" | "absent" | "ambiguous";
  detail: string;
}

export interface Derivation {
  bindings: Binding[];
  notes: DerivationNote[];
}

// ── JSONC: a two-state scanner, then JSON.parse ──
// Cloudflare's own canonical wrangler.jsonc carries `//` comments and trailing commas, so
// JSON.parse fails on the nominal case, not an edge case. Stripping comments is not a regex
// problem (a `//` inside "https://…" would be eaten): it is a two-state automaton, and JSON is
// the easy case — no multi-line strings, no single quotes. What does not parse THROWS, so the
// refusal is free and we never guess.

function stripJsonc(text: string): string {
  let out = "", i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") { out += c + (text[i + 1] ?? ""); i += 2; continue; }
      if (c === '"') inStr = false;
      out += c; i++; continue;
    }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === "/" && text[i + 1] === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2; continue;
    }
    out += c; i++;
  }
  // Trailing commas, same two-state discipline.
  let res = "", j = 0; inStr = false;
  while (j < out.length) {
    const c = out[j];
    if (inStr) {
      if (c === "\\") { res += c + (out[j + 1] ?? ""); j += 2; continue; }
      if (c === '"') inStr = false;
      res += c; j++; continue;
    }
    if (c === '"') { inStr = true; res += c; j++; continue; }
    if (c === ",") {
      let k = j + 1;
      while (k < out.length && /\s/.test(out[k])) k++;
      if (out[k] === "}" || out[k] === "]") { j++; continue; }
    }
    res += c; j++;
  }
  return res;
}

// ── TOML: a table-path automaton ──
// TOML table headers are ABSOLUTE paths, never positional nesting: `[env.dev.triggers]` names
// its own full path. Tracking the current table therefore resolves environment overrides
// exactly, and gives order-independence for free — a header may appear before the root one.
// A line-scan cannot do this: measured, it reports an env cron as the root schedule.

interface TomlRead {
  /** table path -> key -> raw value text (single line, or a bracket-balanced array) */
  values: Map<string, Map<string, string>>;
  /** table paths seen as `[[array of tables]]` */
  arrayTables: Set<string>;
  /** a construct we do not model; when set, the caller must refuse rather than degrade */
  unread: string | null;
  /** 1-based line of each (table, key) pair, for the evidence */
  lines: Map<string, number>;
}

function readToml(text: string): TomlRead {
  const values = new Map<string, Map<string, string>>();
  const arrayTables = new Set<string>();
  const lines = new Map<string, number>();
  let unread: string | null = null;
  let table = "";
  const raw = text.split("\n");

  let inMulti: false | '"""' | "'''" = false;
  for (let n = 0; n < raw.length; n++) {
    let line = raw[n];

    // Multi-line strings can contain anything, including a decoy `[triggers]`.
    if (inMulti) { if (line.includes(inMulti)) inMulti = false; continue; }
    const openMulti = line.match(/("""|''')/);
    if (openMulti && line.split(openMulti[1]).length === 2) { inMulti = openMulti[1] as '"""' | "'''"; continue; }

    // Strip `#` comments outside strings.
    let stripped = "", inStr: false | '"' | "'" = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        if (c === "\\" && inStr === '"') { stripped += c + (line[i + 1] ?? ""); i++; continue; }
        if (c === inStr) inStr = false;
        stripped += c; continue;
      }
      if (c === '"' || c === "'") { inStr = c; stripped += c; continue; }
      if (c === "#") break;
      stripped += c;
    }
    line = stripped.trim();
    if (!line) continue;

    const arrHead = line.match(/^\[\[\s*([^\]]+?)\s*\]\]$/);
    if (arrHead) { table = arrHead[1].trim(); arrayTables.add(table); continue; }
    const head = line.match(/^\[\s*([^\]]+?)\s*\]$/);
    if (head) { table = head[1].trim(); continue; }

    const kv = line.match(/^([A-Za-z0-9._"'-]+)\s*=\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].replace(/["']/g, "");
    let value = kv[2];

    // An inline table is legal TOML we do not model. Refuse, never report "nothing declared".
    if (/^\{/.test(value)) { unread = `inline table on \`${table ? table + "." : ""}${key}\``; continue; }

    // Arrays may span lines: consume until brackets balance.
    if (value.startsWith("[")) {
      let depth = (value.match(/\[/g) || []).length - (value.match(/\]/g) || []).length;
      while (depth > 0 && n + 1 < raw.length) {
        const next = raw[++n];
        value += " " + next.split("#")[0].trim();
        depth += (next.match(/\[/g) || []).length - (next.match(/\]/g) || []).length;
      }
    }
    if (!values.has(table)) values.set(table, new Map());
    values.get(table)!.set(key, value.trim());
    lines.set(`${table}\u0000${key}`, n + 1);
  }
  return { values, arrayTables, unread, lines };
}

function tomlStringList(raw: string): string[] | null {
  if (!raw.startsWith("[")) return null;
  return [...raw.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2]);
}

// ── The Cloudflare Workers adapter ──

/** A wrangler manifest, named or not. `wrangler -c <file>` lets one repository hold several
 *  Workers side by side (`wrangler.serve.jsonc`, `wrangler.mcp.jsonc`), which is the shape of the
 *  fleet that reported the gap — three entry modules in one `src/`. Several manifests are
 *  therefore NOT an ambiguity: each is authoritative for its own `main`. The genuine ambiguity is
 *  narrower and handled below: two manifests claiming the SAME entry module. */
const WRANGLER_PATTERN = /^wrangler(\..+)?\.(jsonc|json|toml)$/;

/** Derive categories from a Cloudflare Workers deployment manifest.
 *
 *  What it reads, and only this: `main` (the entry module) plus the triggers declared beside it
 *  — `triggers.crons` (scheduled work) and `queues.consumers` (background work). A queue
 *  PRODUCER is not background work in this Worker, and Durable Object alarms are declared in
 *  code, not in the manifest, so both are out of scope by ADR-0043.
 *
 *  It derives an INTENTION, never a deployed state: the docs are explicit that commenting the
 *  `crons` key does not disable a trigger. The evidence therefore says the manifest declares a
 *  schedule, never that the Worker runs on one. */
export function deriveCloudflareWorkers(projectRoot: string): Derivation {
  const adapter = "cloudflare-workers";
  let found: string[];
  try {
    found = readdirSync(projectRoot).filter((f) => WRANGLER_PATTERN.test(f)).sort();
  } catch {
    return { bindings: [], notes: [{ adapter, file: null, outcome: "absent", detail: "project root is not readable" }] };
  }
  if (found.length === 0) {
    return { bindings: [], notes: [{ adapter, file: null, outcome: "absent",
      detail: "no wrangler manifest at the project root (only the root is scanned: a monorepo with per-package manifests is not covered yet)" }] };
  }

  const all: Derivation = { bindings: [], notes: [] };
  for (const f of found) all.notes.push(...readOneWrangler(projectRoot, f, all.bindings));

  // The real ambiguity is narrow: two manifests claiming the same entry module. Cloudflare does
  // not document which would win, so the honest answer is to derive nothing for that entry.
  const byEntry = new Map<string, Set<string>>();
  for (const b of all.bindings) {
    if (!byEntry.has(b.path)) byEntry.set(b.path, new Set());
    byEntry.get(b.path)!.add(b.via.file);
  }
  const contested = [...byEntry.entries()].filter(([, files]) => files.size > 1).map(([p]) => p);
  if (contested.length) {
    all.bindings = all.bindings.filter((b) => !contested.includes(b.path));
    for (const p of contested) {
      all.notes.push({ adapter, file: [...byEntry.get(p)!].sort().join(", "), outcome: "ambiguous",
        detail: `more than one manifest declares \`${p}\` as its entry and no documented precedence — nothing derived for it` });
    }
  }
  return all;
}

/** Read one manifest, pushing its bindings and returning its notes. */
function readOneWrangler(projectRoot: string, file: string, bindings: Binding[]): DerivationNote[] {
  const adapter = "cloudflare-workers";
  const notes: DerivationNote[] = [];
  const note = (outcome: DerivationNote["outcome"], detail: string) => { notes.push({ adapter, file, outcome, detail }); };
  // A manifest found by readdir but unreadable must not crash the whole read — `rules --for` would
  // exit with no answer at all. Refuse loudly instead: an `unread` note the caller surfaces as
  // `couldNotRead`, so the matched list is known to be degraded rather than silently short.
  let text: string;
  try { text = readFileSync(join(projectRoot, file), "utf8"); }
  catch { note("unread", "manifest present but unreadable"); return notes; }

  /** Resolve `main` against the manifest's own directory — never the cwd, never the root. */
  const resolveMain = (main: string): string | null => {
    const abs = resolve(dirname(join(projectRoot, file)), main);
    const rel = relative(projectRoot, abs).split("\\").join("/");
    if (!rel || rel.startsWith("..")) return null;
    return existsSync(abs) ? rel : null;
  };

  const emit = (path: string, category: Category, line: number | null, declaration: string) => {
    bindings.push({ path, category, via: { source: "derived", adapter, file, line, declaration } });
  };

  if (file.endsWith(".toml")) {
    const t = readToml(text);
    if (t.unread) { note("unread", `${t.unread} — not modelled, nothing derived`); return notes; }
    const mainRaw = t.values.get("")?.get("main");
    if (!mainRaw) { note("read", "no root `main` (assets-only Worker, or declared per environment) — nothing derived"); return notes; }
    const entry = resolveMain(mainRaw.replace(/^["']|["']$/g, ""));
    if (!entry) { note("read", "`main` does not resolve to a file in the project — nothing derived"); return notes; }

    // Root triggers, then per-environment ones — `triggers` is an inheritable key, so an
    // environment may override it, and the evidence must name which environment.
    for (const [table, kv] of t.values) {
      const isRoot = table === "triggers";
      const env = table.match(/^env\.([^.]+)\.triggers$/);
      if (!isRoot && !env) continue;
      const crons = tomlStringList(kv.get("crons") ?? "");
      if (crons === null) continue;
      const decl = isRoot ? "triggers.crons" : `env.${env![1]}.triggers.crons`;
      if (crons.length === 0) { note("read", `\`${decl}\` is an empty array — a declared absence of scheduling`); continue; }
      emit(entry, "scheduled-work", t.lines.get(`${table}\u0000crons`) ?? null, decl);
      emit(entry, "background-work", t.lines.get(`${table}\u0000crons`) ?? null, decl);
    }
    for (const table of t.arrayTables) {
      if (table === "queues.consumers" || /^env\.[^.]+\.queues\.consumers$/.test(table)) {
        emit(entry, "background-work", t.lines.get(`${table}\u0000queue`) ?? null, `${table}[]`);
      }
    }
    if (!bindings.some((b) => b.via.file === file)) note("read", "no schedule or queue consumer declared");
    return notes;
  }

  // JSONC / JSON
  let tree: any;
  try { tree = JSON.parse(stripJsonc(text)); } catch {
    note("unread", "not valid JSON once comments and trailing commas are removed — nothing derived");
    return notes;
  }
  if (!tree || typeof tree !== "object") { note("unread", "manifest is not an object — nothing derived"); return notes; }
  if (typeof tree.main !== "string") { note("read", "no root `main` (assets-only Worker, or declared per environment) — nothing derived"); return notes; }
  const entry = resolveMain(tree.main);
  if (!entry) { note("read", "`main` does not resolve to a file in the project — nothing derived"); return notes; }

  const scopes: Array<[string, any]> = [["", tree]];
  for (const [name, cfg] of Object.entries(tree.env ?? {})) if (cfg && typeof cfg === "object") scopes.push([name, cfg]);
  for (const [envName, cfg] of scopes) {
    const prefix = envName ? `env.${envName}.` : "";
    const crons = (cfg as any)?.triggers?.crons;
    if (Array.isArray(crons)) {
      if (crons.length === 0) note("read", `\`${prefix}triggers.crons\` is an empty array — a declared absence of scheduling`);
      else { emit(entry, "scheduled-work", null, `${prefix}triggers.crons`); emit(entry, "background-work", null, `${prefix}triggers.crons`); }
    }
    if (Array.isArray((cfg as any)?.queues?.consumers) && (cfg as any).queues.consumers.length > 0) {
      emit(entry, "background-work", null, `${prefix}queues.consumers[]`);
    }
  }
  if (!bindings.some((b) => b.via.file === file) && notes.length === 0) note("read", "no schedule or queue consumer declared");
  return notes;
}

/** All shipped derivation adapters, in a fixed order. Each is a port: an unknown framework
 *  derives nothing rather than guessing (ADR-0012, ADR-0005). */
export function deriveAll(projectRoot: string | null): Derivation {
  if (!projectRoot) return { bindings: [], notes: [] };
  const out: Derivation = { bindings: [], notes: [] };
  for (const d of [deriveCloudflareWorkers(projectRoot)]) {
    out.bindings.push(...d.bindings);
    out.notes.push(...d.notes);
  }
  // Deterministic: by path, then category, then the source's own discriminator.
  const tie = (s: BindingSource) => (s.source === "derived" ? `d:${s.file}:${s.declaration}` : `m:${s.file}:${s.line}`);
  out.bindings.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1
      : a.category < b.category ? -1 : a.category > b.category ? 1
        : tie(a.via) < tie(b.via) ? -1 : tie(a.via) > tie(b.via) ? 1 : 0);
  return out;
}
