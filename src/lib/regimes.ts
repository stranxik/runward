import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PKG_ROOT } from "./paths.js";

/**
 * Regime mappings as versioned data (ADR-0022). Each regimes/<regime>@<version>.json ships the part
 * of a compliance lens that tracks a dated external text — clause references, Annex IV points, the
 * ASI crosswalk, the operator-required list — while the stable narrative stays in compliance.ts.
 * A regulatory change is a new file, never an edit of a shipped version: a pack must stay
 * re-assemblable against the exact lens its auditor saw.
 */

export interface AnnexIvRow { point: string; supplies: string; provider: string; }

export interface RegimeMapping {
  regime: string;
  label: string;
  version: string;
  notes: string;
  /** When true, the readiness draft prints `notes` under its header (ADR-0101, EU AI Act renderer
   *  only). Absent on every lens shipped before it, so a pinned older lens renders unchanged. */
  printNotes?: boolean;
  /** ISO date (YYYY-MM-DD) after which the dated wording here should be re-verified against the
   *  primary text. Not read by the pack assembler (never enters the OSCAL) — only the scheduled
   *  `watch external facts` workflow reads it, opening a tracking issue once it passes (ADR-0032). */
  reviewBy?: string;
  operatorRequired: string[];
  /** Regime-specific closing caveat, appended to the "not legal advice" disclaimer. */
  disclaimerTail: string;
  clauses?: Record<string, string>;
  crosswalk?: { primary: string; confirmAgainst: string };
  measureRef?: string;
  highRisk?: { bindFrom: string; scope: string };
  articles?: Record<string, string>;
  annexIv?: AnnexIvRow[];
}

export const REGIMES_DIR = join(PKG_ROOT, "regimes");

/** Shipped versions of a regime, ascending lexicographic. That order IS the contract: version
 *  identifiers are chosen date-/zero-pad-shaped (2023, 2024-1689, 1.0) so lexicographic ==
 *  chronological within a regime, and the default pick is the last element. A revision of the lens
 *  over the SAME legal text appends `-r<n>` (2026-1744-r2, ADR-0101): a string sorts after its own
 *  prefix, so the revision becomes the default. One digit only: `-r10` would sort before `-r2`, and
 *  a tenth revision of one text is a new scheme, decided in an ADR. The sort is on the version, never
 *  on the filename: `.json` after the prefix would put `2026-1744.json` after `2026-1744-r2.json`. */
export function listRegimeVersions(regime: string, dir: string = REGIMES_DIR): string[] {
  if (!existsSync(dir)) return [];
  const prefix = `${regime}@`;
  return readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .map((f) => f.slice(prefix.length, -".json".length))
    .sort();
}

/** Load a regime mapping; default = highest shipped version. Throws with the shipped list on an
 *  unknown version — the caller maps that onto exit 2 (operator misuse). */
export function loadRegime(regime: string, version?: string, dir: string = REGIMES_DIR): RegimeMapping {
  const versions = listRegimeVersions(regime, dir);
  if (versions.length === 0) throw new Error(`No shipped mapping data for regime "${regime}" (looked in ${dir}).`);
  const pick = version ?? versions[versions.length - 1];
  if (!versions.includes(pick)) {
    throw new Error(`Unknown ${regime} mapping version "${version}". Shipped versions: ${versions.join(", ")}.`);
  }
  return JSON.parse(readFileSync(join(dir, `${regime}@${pick}.json`), "utf8")) as RegimeMapping;
}

/** The lens identifier stamped into the draft header and the OSCAL props, e.g. "eu-ai-act@2024-1689". */
export function regimeLensId(m: RegimeMapping): string {
  return `${m.regime}@${m.version}`;
}
