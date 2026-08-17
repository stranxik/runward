import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GATED_DELIVERABLES } from "./conformance.js";
import { toPosix, VERSION } from "./paths.js";
import type { Verdict } from "./verdict.js";

/**
 * The gate's own verdict, as SARIF (ADR-0056 widening, the emission half).
 *
 * runward already READS a committed SARIF scan as evidence; this is the other direction — the
 * verdict itself, emitted in the format every forge already renders. A gap stops being a line in a
 * CI log nobody opens and becomes an annotation on the manifest row that carries it, in the pull
 * request, where the person who wrote the row is looking. Emission only: runward writes a file, the
 * forge decides what to do with it (ADR-0054 — it uploads nothing and calls no API).
 *
 * Still presence/pointers/integrity, never code quality (GATE_NON_SCOPE): the non-scope travels in
 * the driver's `fullDescription`, so a reader who keeps the annotations and drops the caveat has to
 * do it on purpose.
 */

export const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
export const SARIF_VERSION = "2.1.0";

/** The 1-based line of a rule's row inside a manifest, or 1 when it cannot be located.
 *
 *  Located by the row's FIRST column, the way the manifest parser reads it — never by a bare
 *  substring search, which would hit the rule's name in prose above the table and annotate the
 *  wrong line. Falling back to line 1 keeps the annotation on the right FILE, which is the half
 *  that matters; a wrong line would be worse than an imprecise one. */
export function ruleRowLine(content: string, rule: string): number {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim().startsWith("|")) continue;
    const first = l.split("|").slice(1, -1)[0]?.replace(/`/g, "").trim();
    if (first === rule) return i + 1;
  }
  return 1;
}

interface SarifResult {
  ruleId: string;
  level: "error" | "warning";
  message: { text: string };
  locations: Array<{ physicalLocation: { artifactLocation: { uri: string }; region: { startLine: number } } }>;
}

/**
 * Build the SARIF log for a computed verdict. Deterministic: same tree, same bytes — results are
 * emitted in the gate's own order (deliverable by deliverable, violation by violation), and no
 * timestamp, host or absolute path enters the document.
 */
export function buildSarif(missionDir: string, verdict: Verdict): unknown {
  const results: SarifResult[] = [];
  const ruleIds = new Set<string>();

  // 1. Deliverable gaps — the phase-presence half of the verdict, annotated on the file that is
  //    missing or unfilled. `runward/<file>` is repository-relative: SARIF uri MUST be relative for
  //    a forge to resolve it against the checkout, and an absolute one would leak the runner path.
  for (const d of verdict.deliverables) {
    if (d.state === "filled") continue;
    const id = "runward/deliverable-not-filled";
    ruleIds.add(id);
    results.push({
      ruleId: id,
      level: "error",
      message: { text: `${d.artifact} (${d.phase}): ${d.state === "missing" ? "the deliverable is missing" : "the deliverable is started but not filled (placeholders remain, or it is below the floor)"} — the gate cannot be crossed on it.` },
      locations: [{ physicalLocation: { artifactLocation: { uri: toPosix(d.relPath) }, region: { startLine: 1 } } }],
    });
  }

  // 2. Strict violations — annotated on the manifest ROW that carries them, so the annotation lands
  //    where the operator writes the answer rather than at the top of the file.
  for (const g of verdict.gated) {
    const meta = GATED_DELIVERABLES.find((x) => x.label === g.label);
    const rel = meta ? join("runward", meta.deliverable) : "runward";
    const abs = meta ? join(missionDir, meta.deliverable) : null;
    const content = abs && existsSync(abs) ? readFileSync(abs, "utf8") : "";
    for (const v of g.violations) {
      const id = `runward/${v.rule}`;
      ruleIds.add(id);
      results.push({
        ruleId: id,
        level: "error",
        message: { text: v.problem },
        locations: [{ physicalLocation: { artifactLocation: { uri: toPosix(rel) }, region: { startLine: content ? ruleRowLine(content, v.rule) : 1 } } }],
      });
    }
  }

  return {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [{
      tool: {
        driver: {
          name: "runward",
          semanticVersion: VERSION,
          informationUri: "https://runward.dev",
          rules: [...ruleIds].sort().map((id) => ({
            id,
            shortDescription: { text: id === "runward/deliverable-not-filled" ? "A gated deliverable is missing or unfilled" : `Craft rule ${id.slice("runward/".length)} is not accounted for` },
            fullDescription: { text: GATE_NON_SCOPE_SARIF },
            defaultConfiguration: { level: "error" },
          })),
        },
      },
      results,
    }],
  };
}

/** The caveat travels with the annotations, in every rule's fullDescription: a consumer that keeps
 *  the findings and drops the non-scope has to drop it deliberately. */
const GATE_NON_SCOPE_SARIF =
  "runward verifies that a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. " +
  "It never judges code quality, never executes project code, and never proves the evidence implements the rule. " +
  "A finding here is a gap in the delivery record, not a defect in the code.";
