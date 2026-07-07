import { join } from "node:path";
import { analyze, findMissionRoot } from "../lib/mission.js";
import { conformance, driftReport } from "../lib/conformance.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Gate audit — the gap analysis: which deliverable, expected at which
 * phase, is present, started, or still a raw template.
 * With --strict, also verifies the floor rule-conformance manifest (see
 * docs/adr/ADR-0001): every CRITICAL/HIGH rule mapped to the floor phase must be
 * accounted for. It checks the presence of a traced decision, never the quality
 * of the implementation — that stays the operator's judgment at the gate.
 * Exit codes: 0 = current gate clean, 1 = gaps, 2 = no mission found.
 */
export async function checkCommand(opts: { path?: string; strict?: boolean }): Promise<void> {
  const root = findMissionRoot(join(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const report = analyze(mission);

  console.log(createHeader(`Runward v${VERSION} — gate audit`, root));

  const glyph = {
    "filled": c.success("✓"),
    "in-progress": c.warning("◐"),
    "untouched": c.darkGray("○"),
    "missing": c.error("✗"),
  } as const;
  const legendNote = {
    "filled": "",
    "in-progress": c.warning(" — placeholders remain"),
    "untouched": c.darkGray(" — raw template"),
    "missing": c.error(" — file missing"),
  } as const;

  let gaps = 0;
  for (const phase of report.phases) {
    console.log(section(phase.spec.label));
    for (const { artifact, state } of phase.artifacts) {
      console.log(`  ${glyph[state]} ${c.white(artifact.label)} ${c.darkGray(`(runward/${artifact.relPath})`)}${legendNote[state]}`);
      if (state !== "filled") gaps++;
    }
  }

  let strictGaps = 0;
  if (opts.strict) {
    const CONFORMANCE = [
      { phase: "architect", deliverable: "architecture.md", label: "Architect" },
      { phase: "floor", deliverable: "floor.md", label: "Floor" },
      { phase: "govern", deliverable: "governance/threat-model.md", label: "Govern" },
    ];
    console.log(section("Rule conformance (--strict)"));
    let checked = 0;
    const drift: string[] = [];
    for (const { phase, deliverable, label } of CONFORMANCE) {
      for (const d of driftReport(mission, deliverable)) drift.push(`${label} · ${d.rule} — ${d.problem}`);
      const { expected, violations } = conformance(mission, phase, deliverable);
      if (expected.length === 0) continue;
      checked++;
      if (violations.length === 0) {
        console.log(`  ${status.success(`${label}: ${expected.length} rule(s) accounted for`)}`);
      } else {
        for (const v of violations) console.log(`  ${c.error("✗")} ${c.darkGray(label + " · ")}${c.white(v.rule)}${c.darkGray(" — " + v.problem)}`);
        strictGaps += violations.length;
      }
    }
    if (checked === 0) console.log("  " + c.darkGray("no CRITICAL/HIGH rules mapped to a build phase"));
    if (drift.length > 0) {
      console.log(section("Drift (advisory)"));
      for (const d of drift) console.log(`  ${c.warning("◑")} ${c.white(d)}`);
      console.log("  " + c.darkGray("advisory — an applied pointer no longer resolves; verify it. Does not fail the gate."));
    }
  }

  console.log(section("Summary"));
  console.log(`  ${c.primaryBold("Current gate")}  ${c.white(report.currentPhase)}`);
  console.log(`  ${c.primaryBold("ADRs")}          ${c.white(String(report.adrCount))}${report.adrCount === 0 ? c.warning("  — no structural decision locked yet") : ""}`);
  if (gaps === 0 && strictGaps === 0) {
    console.log("\n" + status.success("All expected deliverables are filled. Cross gates on evidence, not on paperwork."));
  } else {
    const parts: string[] = [];
    if (gaps) parts.push(`${gaps} deliverable(s) not filled`);
    if (strictGaps) parts.push(`${strictGaps} floor rule-conformance gap(s)`);
    console.log("\n" + status.warning(`${parts.join(" · ")}. No phase closes without its artifact — and, under --strict, without its CRITICAL/HIGH rules accounted for.`));
    process.exitCode = 1;
  }
}
