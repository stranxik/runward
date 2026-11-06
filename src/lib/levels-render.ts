// The terminal lines of the level-of-proof section (ADR-0119, ADR-0120 decision 6), rendered from the
// reading the verdict carries and never re-decided: `check` prints them, the verdict answered them.
import { levelRequiredOf, type LevelsReading } from "./evidence-levels.js";
import { c, status } from "./styles.js";

const SHOWN = 8;

export function levelsLines(l: LevelsReading): string[] {
  const out: string[] = [];
  const n = (k: keyof LevelsReading["rows"]): number => l.rows[k].length;
  // Under the language fallback the level the run requires is not the one asked: both are said.
  const req = levelRequiredOf(l);
  const asked = l.source === "flag" ? `asked with \`--require ${l.required}\``
    : l.source === "lock" ? `${req !== l.required ? `${l.required} ` : ""}asked by runward/scaffold-lock.json, \`requiredLevel\`` : "the default";
  out.push(`  ${c.white(`required: ${req}`)} ${c.darkGray(`(${asked})`)} · ${l.met ? status.success("met") : c.warning("not met")}`);
  // ADR-0119 decision 4, at the character: the lock's level on a language the analyzers do not read.
  if (l.fallback) out.push(`  ${c.warning("!")} ${c.white(l.fallback)}`);
  // ADR-0119 decision 5: the sentence, at the character, wherever `attested` is read.
  out.push(`  ${c.darkGray(l.sentence)}`);
  out.push(`  ${c.darkGray(`applied rows: ${n("attested")} attested · ${n("re-derived")} re-derived · ${n("declared")} declared — each listed under \`levels.rows\` in --json; no level is summed into a score`)}`);
  if (l.territory.analysed) {
    out.push(`  ${c.darkGray(`◌ declared territory analysed: ${l.territory.files} source file(s) read under the pinned policy (runward ADR-0118)`)}`);
  } else if (!l.fallback) {
    out.push(`  ${c.warning("!")} ${c.darkGray(`re-derived needs the declared territory analysed: ${l.territory.why}`)}`);
  }
  for (const s of l.execution.statements) {
    const sigs = s.signatures === 0 ? "no signature" : `${s.signatures} signature(s) counted, not verified here`;
    const mark = s.bound && s.signatures > 0 ? c.success("◆") : c.warning("!");
    out.push(`  ${mark} ${c.white(`run Statement ${s.path}`)} ${c.darkGray(`(${s.form}): binds ${s.binds.length} cited report(s), ${sigs}${s.bound ? "" : `; does not bind to this tree: ${s.problems.join("; ")}`}`)}`);
  }
  if (l.below.length > 0) {
    out.push(`  ${c.darkGray(`${l.below.length} applied row(s) below \`${levelRequiredOf(l)}\`, and what holds each there:`)}`);
    for (const b of l.below.slice(0, SHOWN)) out.push(`  ${c.error("✗")} ${c.white(`${b.deliverable} · ${b.rule}`)} ${c.darkGray(`(${b.level}) — ${b.holds.join("; ")}`)}`);
    if (l.below.length > SHOWN) out.push(`  ${c.darkGray(`… and ${l.below.length - SHOWN} more — \`runward check --strict --json\` lists them all (levels.below).`)}`);
  }
  out.push(`  ${c.darkGray(`◌ ${l.execution.mutation}`)}`);
  return out;
}

/** The summary line of a run that exits 5 above `mechanical` (ADR-0119 decision 3). */
export function levelNotMetSummary(l: LevelsReading, exit: number): string {
  const rows = l.below.length;
  // Under the language fallback (ADR-0119 decision 4) the static half asks for `mechanical`: with no row
  // below, that is what is not met, never the territory the fallback set aside.
  const why = rows > 0
    ? `${rows} applied row(s) are below it, named above with what holds each there`
    : l.fallback ? "no applied row carries a pointer the gate verified (`mechanical`)"
      : l.territory.why ?? "the level below it is not met";
  return `No gap, and the level of proof this run requires is not met: \`${levelRequiredOf(l)}\` — ${why} (exit ${exit}, runward ADR-0119).`;
}

/**
 * ADR-0119 decision 4, « every strict run prints the level the mission meets and the rows the next level
 * would refuse »: read at `attested` for the terminal only, on a run that did not ask for an upper
 * level, so its payload keeps its bytes. `typed` is the count `mechanical` reads.
 */
export function levelMetLines(top: LevelsReading, typed: number): string[] {
  const declared = top.rows.declared.length;
  const staticOk = typed > 0 && top.territory.analysed && declared === 0;
  const met = typed === 0 ? "traced" : !staticOk ? "mechanical" : top.met ? "attested" : "re-derived";
  const next = met === "traced" ? "mechanical" : met === "mechanical" ? "re-derived" : met === "re-derived" ? "attested" : null;
  const refused = next === "re-derived"
    ? (declared > 0 ? `would refuse ${declared} row(s) that rest on a declaration` : "") + (top.territory.why ? `${declared > 0 ? ", and " : "is not reachable: "}${top.territory.why}` : "")
    : next === "attested" ? `would refuse ${top.below.length} row(s) whose execution evidence no signed run Statement binds`
      : next === "mechanical" ? "would refuse this run: no applied row carries a pointer the gate opened and checked" : "";
  const head = `  ${c.darkGray("◌")} ${c.white(`level of proof this tree meets: ${met}`)}`;
  if (next === null) return [`${head}${c.darkGray(` — ${top.sentence}`)}`];
  return [`${head}${c.darkGray(`; the next level, ${next}, ${refused} (\`runward check --strict --require ${next}\` names each; runward ADR-0119)`)}`];
}
