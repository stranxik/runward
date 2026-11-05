// The terminal lines of the built-in analyzers' section (ADR-0118), rendered from the reading the
// verdict carries and never re-decided: `check` prints them, the verdict counted them.
import type { AnalysisReading } from "./analyze.js";
import { c, status } from "./styles.js";

const SHOWN = 10;

export function analysisLines(r: AnalysisReading): string[] {
  const out: string[] = [];
  const where = (f: { path: string; line: number | null }): string => `${f.path}${f.line ? `:${f.line}` : ""}`;
  if (!r.known) {
    for (const f of r.findings) out.push(`  ${c.error("✗")} ${c.white(where(f))}${c.darkGray(` — ${f.message}`)}`);
    return out;
  }
  const read = `${r.files.analysed} source file(s) read (${r.files.core} in the declared domain core, ${r.files.tests} test file(s)), ${r.files.config} configuration file(s) read for secrets`;
  if (r.findings.length === 0) {
    out.push(`  ${status.success(`${read}: no finding`)}`);
  } else {
    out.push(`  ${c.darkGray(`${read}:`)}`);
    for (const f of r.findings.slice(0, SHOWN)) out.push(`  ${c.error("✗")} ${c.white(where(f))}${c.darkGray(` — ${f.message} (${f.family})`)}`);
    if (r.findings.length > SHOWN) out.push(`  ${c.darkGray(`… and ${r.findings.length - SHOWN} more — \`runward check --strict --json\` lists them all (analysis.findings).`)}`);
  }
  if (r.hypotheses.length > 0) {
    out.push(`  ${c.warning("◑")} ${c.darkGray(`${r.hypotheses.length} hypothesis(es) the reading cannot settle — reported, never counted (runward ADR-0041):`)}`);
    for (const h of r.hypotheses.slice(0, 3)) out.push(`      ${c.darkGray(`${where(h)} — ${h.message}`)}`);
    if (r.hypotheses.length > 3) out.push(`      ${c.darkGray(`… and ${r.hypotheses.length - 3} more (analysis.hypotheses).`)}`);
  }
  for (const n of r.notAnalyzed) out.push(`  ${c.darkGray(`◌ not analysed — ${n.what}${n.files ? `: ${n.files} file(s)` : ""}`)}`);
  const a = r.allowances;
  if (a.present) {
    out.push(`  ${c.darkGray(`◌ ${a.file}: ${a.used.length} allowance(s) in use, ${a.inert.length} that set aside nothing, ${a.problems.length} unreadable`)}`);
    for (const x of a.inert.slice(0, 3)) out.push(`      ${c.warning("!")} ${c.darkGray(`line ${x.line} sets aside nothing in this tree: a stale allowance hides the next real finding — ${x.text}`)}`);
    for (const x of a.problems.slice(0, 3)) out.push(`      ${c.warning("!")} ${c.darkGray(`line ${x.line} is not read: ${x.problem}`)}`);
  }
  out.push(`  ${c.darkGray(`◌ policy ${r.policy}, pinned in runward/scaffold-lock.json. A finding is an invariant this mission declares that the code breaks; an empty list is not a judgment that the code is good (runward ADR-0118).`)}`);
  return out;
}
