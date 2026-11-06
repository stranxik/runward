// The terminal lines of the level-of-proof section (ADR-0119, ADR-0120 decision 6), rendered from the
// reading the verdict carries and never re-decided: `check` prints them, the verdict answered them.
import type { LevelsReading } from "./evidence-levels.js";
import { c, status } from "./styles.js";

const SHOWN = 8;

export function levelsLines(l: LevelsReading): string[] {
  const out: string[] = [];
  const n = (k: keyof LevelsReading["rows"]): number => l.rows[k].length;
  const asked = l.source === "flag" ? `asked with \`--require ${l.required}\`` : "the default";
  out.push(`  ${c.white(`required: ${l.required}`)} ${c.darkGray(`(${asked})`)} · ${l.met ? status.success("met") : c.warning("not met")}`);
  // ADR-0119 decision 5: the sentence, at the character, wherever `attested` is read.
  out.push(`  ${c.darkGray(l.sentence)}`);
  out.push(`  ${c.darkGray(`applied rows: ${n("attested")} attested · ${n("re-derived")} re-derived · ${n("declared")} declared — each listed under \`levels.rows\` in --json; no level is summed into a score`)}`);
  if (l.territory.analysed) {
    out.push(`  ${c.darkGray(`◌ declared territory analysed: ${l.territory.files} source file(s) read under the pinned policy (runward ADR-0118)`)}`);
  } else {
    out.push(`  ${c.warning("!")} ${c.darkGray(`re-derived needs the declared territory analysed: ${l.territory.why}`)}`);
  }
  for (const s of l.execution.statements) {
    const sigs = s.signatures === 0 ? "no signature" : `${s.signatures} signature(s) counted, not verified here`;
    const mark = s.bound && s.signatures > 0 ? c.success("◆") : c.warning("!");
    out.push(`  ${mark} ${c.white(`run Statement ${s.path}`)} ${c.darkGray(`(${s.form}): binds ${s.binds.length} cited report(s), ${sigs}${s.bound ? "" : `; does not bind to this tree: ${s.problems.join("; ")}`}`)}`);
  }
  if (l.below.length > 0) {
    out.push(`  ${c.darkGray(`${l.below.length} applied row(s) below \`${l.required}\`, and what holds each there:`)}`);
    for (const b of l.below.slice(0, SHOWN)) out.push(`  ${c.error("✗")} ${c.white(`${b.deliverable} · ${b.rule}`)} ${c.darkGray(`(${b.level}) — ${b.holds.join("; ")}`)}`);
    if (l.below.length > SHOWN) out.push(`  ${c.darkGray(`… and ${l.below.length - SHOWN} more — \`runward check --strict --json\` lists them all (levels.below).`)}`);
  }
  out.push(`  ${c.darkGray(`◌ ${l.execution.mutation}`)}`);
  return out;
}

/** The summary line of a run that exits 5 above `mechanical` (ADR-0119 decision 3). */
export function levelNotMetSummary(l: LevelsReading, exit: number): string {
  const rows = l.below.length;
  const why = rows > 0
    ? `${rows} applied row(s) are below it, named above with what holds each there`
    : l.territory.why ?? "the level below it is not met";
  return `No gap, and the level of proof this run requires is not met: \`${l.required}\` — ${why} (exit ${exit}, runward ADR-0119).`;
}
