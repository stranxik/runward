// The pull request / merge request summary in Markdown (ADR-0093 D1, ADR-0094 decision 1): the
// neutral rendering `runward-forge post-summary <file.md>` posts as a GitLab merge request note or
// appends to the GitHub job summary. The same bytes on every forge.
//
// A RENDERING, NOT A SECOND VERDICT (ADR-0064, as amended by ADR-0093). It is a pure function of the
// ADR-0030 machine payload `check --strict --json` publishes and of the attestation's subject digest:
// no git, no network, no spawn, no clock (ADR-0054). Every number it prints is a field of the payload
// (ADR-0095's settling test); it counts nothing itself. Where it lists rows it filters them, and a
// list that stops says so and names the command that carries every row, with no computed remainder.
//
// NEVER ABOVE `ci-declared` (ADR-0093 decision 6). Each line of the status table carries its standing:
// what the gate computed on this tree, unsigned; what the tree declares and runward does not verify
// ("declared"). The assurance mode printed is the one the gate reads in force (`inForce`), never the
// charter's declared value, and `degraded` is said in words.
//
// SAFE TO POST. Every string that comes from the tree (deliverable names, rule ids, ratifier names,
// file paths, problems that quote them) is rendered either inside a code span, where neither forge
// renders a link, a mention, a reference or HTML, or as escaped prose (HTML-escaped, Markdown
// punctuation backslash-escaped, mentions, references and autolinks broken by a zero-width space).
// Line breaks and control characters become spaces, so no value can open a block or close a table.

/** The one mark that tells a summary this command wrote apart from any other file (`--out` guard). */
export const SUMMARY_MARK = "<!-- runward:report-md";

/**
 * The size the summary never exceeds, in UTF-8 bytes: below GitHub's 1 MiB job summary limit and below
 * GitLab's 1,000,000-character note limit once runward-forge prepends its marker line (bytes are never
 * fewer than characters). The runward package imports nothing from runward-forge (ADR-0094), so the
 * value is restated here and a test holds it under both of the package's constants.
 */
export const SUMMARY_MAX_BYTES = 999_000;

/** How many rows one table shows before it says where the rest are. A rendering constant, never printed. */
export const SUMMARY_TABLE_ROWS = 40;

const MAX_IDENT = 200;
const MAX_PROSE = 1200;
const ZWSP = "\u200B";

/** Control characters, line and paragraph separators and bidirectional overrides: none may reach the page. */
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function clip(s: string, max: number): string {
  const chars = [...s];
  return chars.length <= max ? s : chars.slice(0, max - 1).join("") + "…";
}

function flat(v: unknown, max: number): string {
  return clip(String(v ?? "").replace(UNSAFE, " "), max);
}

/**
 * A value from the tree as an inline code span. Inside a code span neither GitHub nor GitLab renders
 * Markdown, HTML, a link, a mention or a reference. The fence is one backtick longer than the longest
 * run inside, padded when the value starts or ends with a backtick or a space; in a table a pipe is
 * written `\|`, which GFM and GLFM both read as a literal pipe inside the cell, code spans included,
 * and a backslash of the tree's is kept apart from it by a zero-width space.
 */
export function mdCode(v: unknown, inTable = true): string {
  let s = flat(v, MAX_IDENT);
  if (s.trim() === "") return "(empty)";
  // A backslash the tree wrote just before a pipe would turn `\|` into `\\|`, an escaped backslash
  // and a live column separator: every backslash is followed by a zero-width space first.
  if (inTable) s = s.replace(/[\\|]/g, (ch) => (ch === "|" ? "\\|" : `\\${ZWSP}`));
  const longest = Math.max(0, ...[...s.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = /^[` ]|[` ]$/.test(s) ? " " : "";
  return `${fence}${pad}${s}${pad}${fence}`;
}

/**
 * A sentence that may quote the tree, as escaped prose: HTML-escaped (no tag, no comment, no entity of
 * the tree's), every Markdown inline marker backslash-escaped (no emphasis, link, image, code span or
 * table pipe, no strikethrough, no inline math), and a zero-width space after every character that
 * would start a mention, a reference or an autolink on either forge (`@user`, `#1`, `!1`, `~label`,
 * `%milestone`, `$snippet`, `&epic`, `^`, `scheme://`, `mailto:`, `www.`). Inline-only escapes suffice:
 * a value never starts a line, so no block marker (`#`, `-`, `>`, a list number) can take effect.
 */
export function mdProse(v: unknown, max = MAX_PROSE): string {
  return flat(v, max)
    .replace(/[&<>]/g, (ch) => (ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : "&gt;"))
    .replace(/[\\`*_[\]|~$]/g, (ch) => `\\${ch}`)
    .replace(/([@#!%^$]|~|&amp;)/g, `$1${ZWSP}`)
    .replace(/:(?=\/)/g, `:${ZWSP}`)
    .replace(/\b(mailto|xmpp|tel|ssh|data|javascript):/gi, `$1:${ZWSP}`)
    .replace(/(w)(ww\.)/gi, `$1${ZWSP}$2`);
}

interface ConformanceRow { scope: string; rule: string; problem: string; kind?: string; file?: string; line?: number | null }
interface ByRow { deliverable: string; rule: string; state: string; mode: string | null; by: string | null; for: string | null; date: string | null }
interface Assurance { declared: string | null; inForce: string | null; degraded: boolean; notInForce: string[]; sentence: string | null }

/** What the payload says, typed as far as the summary reads it. */
interface SummaryPayload {
  runward: string; currentGate: string; adrCount: number; strict: boolean; verdict: string; exitCode: number;
  gaps: { deliverables: number; conformance: number; hooks: number; deferred: number; proposed: number;
    unboundRows?: number; charter?: number; causesByKind?: Record<string, { count: number; indices: number[] }> };
  deliverables: Array<{ phase: string; artifact: string; relPath: string; state: string; cause: string | null }>;
  through: string | null;
  conformance?: ConformanceRow[];
  evidence?: { rows: number; applied: number; deviated: number; na: number; typed: number; prose: number; signed: number;
    evidenceFiles: { total: number; external: number } };
  seal?: { present: boolean; count: number; sealedAt: string | null; violations: number };
  ratification?: { rows: number; lineByLine: number; enBloc: number; blind: number; untraced: number;
    agent?: number; changed?: number; byRow?: ByRow[] };
  regulated?: unknown;
  gateNonScope?: unknown;
  delegation?: { file: string; banner: string[]; stage: number | null; accountable: string | null; delegates: string[];
    assurance?: Assurance; sample?: { present: boolean; banner: string[] } };
  next?: { text: string; command: string };
}

export interface SummaryMeta {
  /** The attestation's subject digest (`missionStateDigest`), taken before any output file is written. */
  subjectDigest: string;
  /** Set when the summary is written inside the hashed `runward/` tree: the path, `/`-separated. */
  insideTree?: string | null;
}

const EXIT_MEANING: Record<number, string> = {
  0: "clean: the job passes",
  1: "gaps: the job fails until they are closed",
};

function table(head: string[], rows: string[][], more: boolean): string[] {
  const out = [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)];
  if (more) out.push("", "_The list stops here. `runward check --strict --json` carries every row._");
  return out;
}

function assuranceLine(d: NonNullable<SummaryPayload["delegation"]>): { value: string; standing: string } {
  const a = d.assurance;
  // ADR-0095 decision 3: until the payload carries the block, the reading is not-observed, never a default.
  if (!a) return { value: "not-observed", standing: "this payload carries no assurance block" };
  if (a.inForce === null) {
    return { value: "none in force", standing: `**degraded**: the charter declares ${mdCode(a.declared, true)}, which this version of the gate does not read` };
  }
  if (a.degraded) {
    return { value: mdCode(a.inForce), standing: `declared, **degraded**: not in force: ${a.notInForce.map((x) => mdProse(x)).join("; ")}` };
  }
  return { value: mdCode(a.inForce), standing: `declared, not degraded: ${mdProse(a.sentence ?? "")}` };
}

/** One assembled ADR-0030 payload in, one Markdown document out. Pure and deterministic. */
export function renderSummaryMarkdown(payload: Record<string, unknown>, meta: SummaryMeta): string {
  const p = payload as unknown as SummaryPayload;
  const clean = p.verdict === "clean";
  const word = clean ? "CLEAN" : "GAPS";
  const version = flat(p.runward, 40);
  const digest = /^[0-9a-f]{64}$/.test(meta.subjectDigest) ? meta.subjectDigest : "not-available";
  const L: string[] = [];

  L.push(`${SUMMARY_MARK} · subject ${digest.slice(0, 12)} -->`);
  L.push(`## runward gate: ${word}`);
  L.push("");
  L.push(`**Verdict: ${word}**, exit code ${p.exitCode} (${EXIT_MEANING[p.exitCode] ?? "not a verdict code"}). ` +
    "Exit code 0 is clean, 1 is gaps, 2 means the question could not be asked (no mission, a usage error or a refused gesture), never a red gate.");
  L.push("");
  L.push(`runward ${mdCode(version, false)} · ${p.strict ? "strict verdict" : "presence verdict"} · current gate: ${mdProse(p.currentGate)} · ${p.adrCount} architecture decision record(s)`);
  L.push("");

  // ── The status table: every line with its standing ───────────────────────
  const rat = p.ratification;
  const ev = p.evidence;
  const rows: string[][] = [];
  rows.push(["Verdict", `**${word}**`, "computed by `runward check --strict` on this tree; unsigned, re-derivable below"]);
  rows.push(["Deliverable gaps", String(p.gaps.deliverables), "computed by the gate"]);
  rows.push(["Rule-conformance gaps", String(p.gaps.conformance) + (p.gaps.proposed ? ` (of which ${p.gaps.proposed} proposed)` : ""), "computed by the gate"]);
  if (p.gaps.deferred) rows.push(["Deferred by a declared horizon", String(p.gaps.deferred), `declared: ${mdCode(`--through ${p.through ?? ""}`)}, outside the verdict`]);
  if (ev) {
    rows.push(["Evidence rows", `${ev.rows}: ${ev.applied} applied, ${ev.deviated} deviated, ${ev.na} n/a`,
      `${ev.typed} typed pointer(s) resolved by the gate; ${ev.prose} prose row(s) declared, never verified; ${ev.signed} signature-checked`]);
  }
  if (rat) {
    rows.push(["Ratification", `${rat.rows} traced: ${rat.lineByLine} line-by-line, ${rat.enBloc} en bloc, ${rat.blind} blind${rat.agent ? `, ${rat.agent} by an agent` : ""}; ${rat.untraced} untraced${rat.changed ? `; ${rat.changed} changed since ratified` : ""}`,
      "declared: names and dates as the tree writes them; runward cannot tell who answered"]);
  }
  if (p.seal) {
    rows.push(["Evidence seal", p.seal.present ? `${p.seal.count} file(s), ${p.seal.violations} violation(s)` : "absent (opt-in)",
      p.seal.present ? "computed by the gate against the committed seal" : "nothing is compared with a previous state"]);
  }
  if (p.delegation) {
    const d = p.delegation;
    rows.push(["Delegation charter", d.stage === null ? "stage not read" : `stage ${d.stage}`,
      `declared: ${d.banner.map((b) => mdProse(b)).join("; ") || "no banner"}`]);
    const a = assuranceLine(d);
    rows.push(["Assurance mode in force", a.value, a.standing]);
    if (d.sample?.present) rows.push(["Sample ledger", "present", `declared: ${d.sample.banner.map((b) => mdProse(b)).join("; ")}`]);
  } else {
    rows.push(["Assurance mode in force", "none", "no delegation charter: not-observed"]);
  }
  if (p.regulated) rows.push(["Forge approval", "not verified", "this command has no forge to ask (ADR-0080 part 2)"]);
  rows.push(["Attestation subject", mdCode(digest), "unsigned: runward never signs and never verifies a signature"]);
  L.push(...table(["What", "Reading", "Standing"], rows, false));
  L.push("");

  // ── Gaps, grouped by kind (gaps.causesByKind) ─────────────────────────────
  L.push("### Gaps by kind");
  L.push("");
  const missing = p.deliverables.filter((d) => d.state !== "filled");
  const conf = p.conformance ?? [];
  const byKind = p.gaps.causesByKind ?? {};
  const kinds = Object.keys(byKind);
  if (clean && missing.length === 0 && conf.length === 0) {
    L.push("No gap: every expected deliverable is filled and every CRITICAL/HIGH rule mapped to a crossed phase is accounted for.");
    L.push("");
  }
  if (missing.length > 0) {
    L.push(`**Deliverables** (${p.gaps.deliverables} gap(s)):`);
    L.push("");
    L.push(...table(["Phase", "Deliverable", "Path", "State"],
      missing.slice(0, SUMMARY_TABLE_ROWS).map((d) => [mdProse(d.phase), mdProse(d.artifact), mdCode(`runward/${d.relPath}`), mdCode(d.cause ? `${d.state} (${d.cause})` : d.state)]),
      missing.length > SUMMARY_TABLE_ROWS));
    L.push("");
  }
  if (kinds.length > 0) {
    L.push(`**Rule conformance** (${p.gaps.conformance} gap(s)), by kind:`);
    L.push("");
    L.push(...table(["Kind", "Count"], kinds.map((k) => [mdCode(k), String(byKind[k].count)]), false));
    L.push("");
    const listed: string[][] = [];
    let more = false;
    for (const k of kinds) {
      for (const i of byKind[k].indices) {
        const c = conf[i];
        if (!c) continue;
        if (listed.length >= SUMMARY_TABLE_ROWS) { more = true; break; }
        const where = c.file ? (c.line ? `${c.file}:${c.line}` : c.file) : "";
        listed.push([mdCode(k), mdCode(c.rule), where ? mdCode(where) : "(no file)", mdProse(c.problem, 400)]);
      }
      if (more) break;
    }
    L.push(...table(["Kind", "Rule", "Where", "Problem"], listed, more));
    L.push("");
  } else if (conf.length > 0) {
    // An older payload without kinds: the rows are listed as they are, nothing is grouped for them.
    L.push(`**Rule conformance** (${p.gaps.conformance} gap(s)), not grouped: this payload carries no \`causesByKind\`.`);
    L.push("");
    L.push(...table(["Scope", "Rule", "Problem"], conf.slice(0, SUMMARY_TABLE_ROWS).map((c) => [mdProse(c.scope), mdCode(c.rule), mdProse(c.problem, 400)]),
      conf.length > SUMMARY_TABLE_ROWS));
    L.push("");
  }

  // ── Ratification state (declared) ─────────────────────────────────────────
  if (rat) {
    L.push("### Ratification (declared)");
    L.push("");
    const byRow = rat.byRow ?? [];
    // Listed: the rows a person must look at again (changed since ratified, or ratified blind). An
    // untraced row is the normal state of a mission that does not ratify; its count is the payload's.
    const open = byRow.filter((r) => r.state === "changed" || r.state === "blind");
    if (open.length === 0) {
      L.push("No decided row is ratified blind or changed since its ratification." +
        (rat.untraced ? ` ${rat.untraced} decided row(s) carry no trace; \`runward check --strict --json\` lists them under \`ratification.byRow\`.` : ""));
    } else {
      L.push("Rows ratified blind, or changed since their ratification:");
      L.push("");
      L.push(...table(["Deliverable", "Rule", "State", "Mode", "By", "Date"],
        open.slice(0, SUMMARY_TABLE_ROWS).map((r) => [mdCode(r.deliverable), mdCode(r.rule), mdCode(r.state), r.mode ? mdCode(r.mode) : "none", r.by ? mdCode(r.by) : "none", r.date ? mdCode(r.date) : "none"]),
        open.length > SUMMARY_TABLE_ROWS));
    }
    const names = [...new Set(byRow.map((r) => r.by).filter((b): b is string => typeof b === "string" && b !== ""))].sort();
    if (names.length > 0) {
      L.push("");
      L.push(`Ratifiers, as the tree declares them: ${names.slice(0, SUMMARY_TABLE_ROWS).map((n) => mdCode(n, false)).join(", ")}${names.length > SUMMARY_TABLE_ROWS ? ", and more in `check --strict --json`" : ""}.`);
    }
    L.push("");
  }

  // ── Next, re-derivation, non-scope ────────────────────────────────────────
  if (p.next) {
    L.push(`**Next.** ${mdProse(p.next.text)}`);
    L.push("");
  }
  L.push("### Re-derive this verdict");
  L.push("");
  L.push(`The attestation's subject digest is ${mdCode(digest, false)} (SHA-256 over the mission tree and the evidence files it cites).` +
    (meta.insideTree ? ` It was taken before ${mdCode(meta.insideTree, false)} was written, because that file lives inside the tree it hashes: delete it before re-deriving.` : ""));
  L.push("On a checkout of the same commit, with no account and no network beyond the package registry:");
  L.push("");
  L.push("```sh");
  L.push(`npx runward@${/^[0-9A-Za-z.+-]+$/.test(version) ? version : "latest"} check --strict --attest > verdict.intoto.json`);
  L.push(`npx runward@${/^[0-9A-Za-z.+-]+$/.test(version) ? version : "latest"} verify verdict.intoto.json`);
  L.push("```");
  L.push("");
  L.push("`subject[0].digest.sha256` in the attestation must equal the digest above, and `verify` re-derives every field of the verdict from the tree. This summary computes nothing: every number in it is a field of `check --strict --json`.");
  L.push("");
  if (p.gateNonScope) {
    L.push(`**What the gate does not cover.** ${mdProse(p.gateNonScope, 4000)}`);
    L.push("");
  }
  L.push("_Rendered by `runward report --format md` (ADR-0093, ADR-0094): deterministic, no network, no clock._");

  const md = L.join("\n") + "\n";
  if (Buffer.byteLength(md) <= SUMMARY_MAX_BYTES) return md;
  // Unreachable with the row caps above (each cell is clipped), kept so a future field cannot push a
  // summary past the forges' limits: the verdict and the digest survive, the tables do not.
  return [L[0], L[1], "", L[3], "", "_The full summary exceeds the size a forge accepts. `runward check --strict --json` carries every row._", "",
    `Attestation subject digest: ${mdCode(digest, false)}.`, ""].join("\n");
}
