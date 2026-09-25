import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { GATED_DELIVERABLES, readManifest, proposedStatus } from "./conformance.js";
import { parseEvidencePointers, resolutionBases, resolveEvidencePath, symbolPresent } from "./evidence.js";

/**
 * The rules this mission already answered for on these files (ADR-0077).
 *
 * A reminder, never a territory. `rules --for` matches on what a RULE declares it governs
 * (ADR-0041, ADR-0043), and a rule that declared it has no file territory is never matched —
 * which left the file the example mission cites for four CRITICAL/HIGH rules answering "0 rules".
 * The mission had already said it: a typed pointer in a gated manifest row is an operator
 * declaration in a normed file, the class of fact ADR-0043 admits, never a reading of project code.
 *
 * What this is NOT, and the output must say so where it is read:
 * - not "the rules that govern this file": a rule enters only once someone has answered for it
 *   here, so a file nobody instructed yet — a new file, above all — gets nothing. The case that
 *   created `--for` (a cron and a secret relay rewritten, their rules never surfaced) would have
 *   returned nothing through this source: the mission cited neither file at the time.
 * - not counted: it never enters `count`, `matched`, `unscoped` or `territoryStates`.
 * - not a verdict: a pointer is rendered, and whether it still resolves is stated, never judged —
 *   that is `check`'s work, and this exits 0 like the rest of `--for`.
 */

export interface Citation {
  /** The path asked about, exactly as the caller normalised it. */
  path: string;
  rule: string;
  /** The row's status as written — `applied`, `deviated` or `n/a`. Shown, never filtered: a
   *  deviation that cites this file is as much a reminder as an application. */
  status: string;
  /** Where the mission said it: the manifest, project-relative, and its 1-based line. */
  via: { file: string; line: number; pointer: string };
  /** Does the cited file still exist and, when a `#symbol` was written, does it still carry it?
   *  A renamed symbol keeps the path — so the reminder still surfaces — and says it no longer
   *  resolves, rather than presenting stale evidence as live. */
  resolves: boolean;
  /** Why it does not resolve, when it does not. */
  note?: string;
}

export interface CitationReport {
  citations: Citation[];
  /** Proposed rows (ADR-0066) that cite an asked path: written by an agent, not yet ratified, so
   *  not a declaration of the mission. Counted, named, never listed as a citation. */
  proposedSkipped: Array<{ rule: string; file: string; line: number }>;
  /** Manifests that could not be read (several `Rule conformance` sections): a zero here would
   *  otherwise be blind. Same fail-loud channel as the territory carriers. */
  couldNotRead: Array<{ source: "manifest"; carrier: string; detail: string }>;
  /** How many gated manifests existed and were read. Zero with a mission means nothing was cited
   *  because nothing was written — a fact to state, not a silence. */
  manifestsRead: number;
}

const posix = (p: string) => p.split(sep).join("/");

/** Project-relative spelling of a pointer's target, or null when it leaves the project. Used only
 *  when the file no longer exists: an existing file is resolved by the gate's own containment rule. */
function lexicalTarget(projectRoot: string, p: string, bases: string[]): string[] {
  const out: string[] = [];
  for (const b of bases) {
    const rel = posix(relative(projectRoot, resolve(b, p)));
    // `relative()` never yields a leading "/" on POSIX, and an asked path is never absolute
    // (`normalizeForPath` refuses it), so only an escape needs refusing here.
    if (rel && !rel.startsWith("..")) out.push(rel);
  }
  return out;
}

export function citationsForPaths(projectRoot: string | null, paths: string[]): CitationReport {
  const report: CitationReport = { citations: [], proposedSkipped: [], couldNotRead: [], manifestsRead: 0 };
  if (!projectRoot || paths.length === 0) return report;
  const missionDir = join(projectRoot, "runward");
  const asked = new Set(paths);
  // The gate's resolver returns the CANONICAL path (it must: containment is checked on the real path,
  // ADR-0019). A root reached through a symlink — macOS `/var` is `/private/var` — would put every
  // cited file "outside" it, and the section would stay silently empty. Measured on 2026-09-25: the
  // CLI escaped it only because its cwd is already canonical.
  let realRoot = projectRoot;
  try { realRoot = realpathSync(projectRoot); } catch { /* an unreadable root is compared as given */ }

  for (const { deliverable } of GATED_DELIVERABLES) {
    const file = join(missionDir, deliverable);
    if (!existsSync(file)) continue;
    const manifestRel = posix(relative(projectRoot, file));
    const { rows, lines, problems } = readManifest(readFileSync(file, "utf8"));
    report.manifestsRead++;
    for (const p of problems) {
      // Only the refusal to read ANY row blinds this source; a single malformed row is the gate's.
      if (rows.length === 0) report.couldNotRead.push({ source: "manifest", carrier: manifestRel, detail: p });
    }
    const bases = resolutionBases(missionDir, deliverable);
    rows.forEach((row, i) => {
      const line = lines[i];
      for (const ptr of parseEvidencePointers(row.evidence)) {
        if (!ptr.path || ptr.malformed) continue; // `adr:` names no file
        const abs = resolveEvidencePath(ptr.path, bases);
        const rel = abs ? posix(relative(realRoot, abs)) : null;
        // A pointer into the rule set is circular evidence and refused by the gate (ADR-0045).
        if (rel?.startsWith("runward/rules/")) continue;
        const candidates = rel ? [rel] : lexicalTarget(projectRoot, ptr.path, bases);
        const hit = candidates.find((c) => asked.has(c));
        if (!hit) continue;
        if (proposedStatus(row.status) !== null) {
          report.proposedSkipped.push({ rule: row.rule, file: manifestRel, line });
          continue;
        }
        let resolves = abs !== null;
        let note: string | undefined = abs ? undefined : "the cited file does not exist — moved or renamed?";
        if (abs && ptr.symbol) {
          let content = "";
          try { content = readFileSync(abs, "utf8"); } catch { /* unreadable: treated as absent */ }
          if (!symbolPresent(content, ptr.symbol)) {
            resolves = false;
            note = `symbol "${ptr.symbol}" not found in the cited file — moved or renamed?`;
          }
        }
        report.citations.push({
          path: hit, rule: row.rule, status: row.status,
          via: { file: manifestRel, line, pointer: ptr.raw }, resolves, ...(note ? { note } : {}),
        });
      }
    });
  }
  report.citations.sort(compareCitations);
  return report;
}

/** Deterministic order: by rule slug, then manifest, then line — the rule set's own order, never
 *  ranked. Code-unit comparison, never `localeCompare`: the order is part of the byte-stable output.
 *  Exported so each branch is pinned pairwise: a sort only calls it in the order its algorithm picks,
 *  which would leave half the branches unobserved. */
export function compareCitations(a: Citation, b: Citation): number {
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  if (a.via.file !== b.via.file) return a.via.file < b.via.file ? -1 : 1;
  return a.via.line - b.via.line;
}

/** The caveat printed with every citation section. The list is the mission's history on these
 *  files, and its length measures documentation written, not exposure. */
export const CITED_NOT_TERRITORY =
  "A reminder, not a territory: these rules are listed because this mission already cited these " +
  "files as their evidence. A rule nobody has answered for here is absent, and a new file is never " +
  "cited — this list says what was declared, never what governs the file.";
