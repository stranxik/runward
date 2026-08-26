import { basename, join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { computeVerdict } from "../lib/verdict.js";
import { gatherComplianceInputs, renderIso42001Readiness, renderNistAiRmf, renderEuAiAct, renderOscal } from "../lib/compliance.js";
import { loadRegime, regimeLensId, type RegimeMapping } from "../lib/regimes.js";
import { makeWriter } from "../lib/write.js";
import { c, createHeader, generationDate, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Assemble a regime-framed compliance evidence pack (ADR-0016) — deterministic, read-only, zero-LLM,
 * outside the gate. Reads the mission's real artifacts (rule→OWASP ASI, conformance manifests, ADR
 * journal, governance docs) and writes an assessment-readiness *draft*, explicitly flagging what only
 * the operator can supply. Never a compliance claim. The regime mapping is versioned data (ADR-0022):
 * `--regime-version` pins the lens; the selected lens is stamped into the draft and the OSCAL.
 * Exit codes: 0 = draft written, 2 = no mission / unsupported regime / unknown mapping version.
 */

const REGIMES: Record<string, { render: (i: ReturnType<typeof gatherComplianceInputs>, at: string, lens: RegimeMapping) => string; file: string }> = {
  "iso-42001": { render: renderIso42001Readiness, file: "iso-42001-readiness.md" },
  "nist-ai-rmf": { render: renderNistAiRmf, file: "nist-ai-rmf-readiness.md" },
  "eu-ai-act": { render: renderEuAiAct, file: "eu-ai-act-readiness.md" },
};

export async function complianceCommand(regime: string | undefined, opts: { path?: string; regimeVersion?: string }): Promise<void> {
  const key = (regime ?? "").toLowerCase();

  if (!key || !(key in REGIMES)) {
    console.log(createHeader(`Runward v${VERSION} — compliance`, key || "regime required"));
    console.error(status.error(`Usage: runward compliance <regime>. Supported: ${Object.keys(REGIMES).join(", ")}.`));
    console.log("  " + c.darkGray("The manifest is universal (OWASP ASI); the regime is a lens (ADR-0015). Default posture is security-only — no regime named."));
    process.exit(2);
  }
  const spec = REGIMES[key];

  let lens: RegimeMapping;
  try {
    lens = loadRegime(key, opts.regimeVersion);
  } catch (e) {
    console.log(createHeader(`Runward v${VERSION} — compliance`, key));
    console.error(status.error(e instanceof Error ? e.message : String(e)));
    process.exit(2);
  }
  console.log(createHeader(`Runward v${VERSION} — compliance`, `${lens.label} — mapping version ${lens.version}`));

  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  const generatedAt = generationDate();

  console.log(section("Assembling (read-only, deterministic)"));
  const inputs = gatherComplianceInputs(mission);
  // ASK THE GATE. The pack used to be assembled without ever calling it, so it read the
  // same on a mission runward accepts and on one it refuses (measured 2026-08-26: byte-
  // identical with 18 conformance gaps). The verdict is computed in --strict, because a
  // presence check is not what `implementation-status: implemented` would mean to an
  // assessor, and it is carried onto every requirement rather than summarised once.
  const gate = computeVerdict(mission, { strict: true });
  inputs.verdict = {
    clean: gate.clean, strict: true, exitCode: gate.exitCode,
    conformanceGaps: gate.strictGaps,
    typed: gate.breakdown.typed, prose: gate.breakdown.prose,
  };
  const md = spec.render(inputs, generatedAt, lens);

  const w = makeWriter({ force: true, dryRun, root }); // generated artifacts — always refresh
  w.write(join(mission, "compliance", spec.file), md);
  // OSCAL export — regime-neutral, machine-readable; the interop layer (ADR-0016) so the evidence flows into GRC/auditor tools.
  w.write(join(mission, "compliance", "oscal-component-definition.json"), renderOscal(inputs, basename(root), generatedAt, regimeLensId(lens)));

  const mappedAsi = [...inputs.asiCoverage.values()].filter((v) => v.length).length;
  console.log(section("Assembled"));
  console.log(`  ${c.primaryBold("ASI coverage")}   ${c.white(`${mappedAsi}/10 categories mapped to a rule`)}`);
  console.log(`  ${c.primaryBold("Conformance")}    ${c.white(`${inputs.conformance.length} accounted rule(s)`)}`);
  // The word "ratified" was printed over a count of every file in the directory. Say the number the
  // word claims, and name the rest rather than folding them into it.
  const ratified = inputs.adrs.filter((a) => a.ratified).length;
  const pending = inputs.adrs.length - ratified;
  console.log(`  ${c.primaryBold("Decisions")}      ${c.white(`${ratified} ratified ADR(s)`)}${pending ? c.dim(` · ${pending} not ratified`) : ""}`);
  console.log(`  ${c.primaryBold("Governance")}     ${c.white(`threat model ${inputs.threatModel ? "present" : "missing"}, eval rubric ${inputs.evalRubric ? "present" : "missing"}`)}`);

  console.log(section("Next steps"));
  console.log("  " + c.white("1.") + " Review " + c.primary(`runward/compliance/${spec.file}`) + c.darkGray(" — a draft, not a compliance claim."));
  console.log("  " + c.white("2.") + " Fill the " + c.warning("\"Required from the operator\"") + " sections yourself (applicability, risk acceptance, policy, sign-off).");
  console.log("  " + c.white("3.") + " Machine-readable " + c.primary("runward/compliance/oscal-component-definition.json") + c.darkGray(" (OSCAL) — feed it to your GRC/auditor tool."));
  console.log("  " + c.white("4.") + " Hand it over as " + c.white("supporting evidence") + c.darkGray(" — never as a certification."));
  console.log();
}
