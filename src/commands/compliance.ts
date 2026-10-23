import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { computeVerdict } from "../lib/verdict.js";
import { gatherComplianceInputs, countAdrs, renderIso42001Readiness, renderNistAiRmf, renderEuAiAct, renderOscal } from "../lib/compliance.js";
import { loadRegime, regimeLensId, type RegimeMapping } from "../lib/regimes.js";
import { makeWriter } from "../lib/write.js";
import { c, createHeader, generationDate, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";
import { emitJson, errorPayload, humanLog, noMissionPayload } from "../lib/machine-output.js";

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

export async function complianceCommand(regime: string | undefined, opts: { path?: string; regimeVersion?: string; json?: boolean; out?: string }): Promise<void> {
  const key = (regime ?? "").toLowerCase();
  const log = humanLog(opts.json);

  if (!key || !(key in REGIMES)) {
    log(createHeader(`Runward v${VERSION} — compliance`, key || "regime required"));
    const usage = `Usage: runward compliance <regime>. Supported: ${Object.keys(REGIMES).join(", ")}.`;
    if (opts.json) emitJson(errorPayload(VERSION, "usage", usage)); // ADR-0083
    console.error(status.error(usage));
    (opts.json ? console.error : console.log)("  " + c.darkGray("The manifest is universal (OWASP ASI); the regime is a lens (runward ADR-0015). Default posture is security-only — no regime named."));
    process.exit(2);
  }
  const spec = REGIMES[key];

  let lens: RegimeMapping;
  try {
    lens = loadRegime(key, opts.regimeVersion);
  } catch (e) {
    log(createHeader(`Runward v${VERSION} — compliance`, key));
    const msg = e instanceof Error ? e.message : String(e);
    if (opts.json) emitJson(errorPayload(VERSION, "usage", msg)); // ADR-0083: an unknown --regime-version
    console.error(status.error(msg));
    process.exit(2);
  }
  log(createHeader(`Runward v${VERSION} — compliance`, `${lens.label} — mapping version ${lens.version}`));

  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    if (opts.json) emitJson(noMissionPayload(VERSION));
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  const generatedAt = generationDate();

  log(section("Assembling (read-only, deterministic)"));
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
    // Not just the COUNT. `implemented` has to know WHICH rules rest on a sentence, or a control
    // whose only evidence is prose reads as implemented — measured 2026-08-26 on asi-07.
    proseRows: gate.breakdown.proseRows,
  };
  const md = spec.render(inputs, generatedAt, lens);

  // `--out`: a CI that publishes the pack as an artifact, without committing it (it is dated, so stale by the
  // next pull request), wrote into the working tree because the directory was fixed. Relative to the
  // current directory, like `--path`; the default stays runward/compliance/.
  const outDir = opts.out ? resolve(process.cwd(), opts.out) : join(mission, "compliance");
  const shown = (abs: string) => { const r = relative(root, abs); return r && !r.startsWith("..") && !isAbsolute(r) ? r.split("\\").join("/") : abs; };
  const w = makeWriter({ force: true, dryRun, root, quiet: opts.json }); // generated artifacts — always refresh
  w.write(join(outDir, spec.file), md);
  // OSCAL export — machine-readable; the interop layer (ADR-0016) so the evidence flows into GRC/auditor tools.
  // One file PER REGIME: every regime used to write the same name, so running eu-ai-act, then iso-42001,
  // then nist-ai-rmf kept only the last component (reported by an adopter, 2026-10-22). The generic
  // name is still written, for the tools and pipelines that read it; it holds the last regime run.
  const oscal = renderOscal(inputs, basename(root), generatedAt, regimeLensId(lens));
  const oscalOwn = `oscal-component-definition.${key}.json`;
  w.write(join(outDir, oscalOwn), oscal);
  w.write(join(outDir, "oscal-component-definition.json"), oscal);
  const files = [spec.file, oscalOwn, "oscal-component-definition.json"].map((f) => shown(join(outDir, f)));

  const mappedAsi = [...inputs.asiCoverage.values()].filter((v) => v.length).length;
  // The word "ratified" was printed over a count of every file in the directory. Say the number the
  // word claims, and name the rest rather than folding them into it.
  // A superseded or rejected decision is neither ratified nor pending: it was counted "not ratified",
  // which told the reader of a pack that a decision was still open when it had been replaced.
  const { ratified, setAside, notRatified: pending } = countAdrs(inputs.adrs);
  // "present" was printed for a file `check` calls a raw template in the same pass. Say the state.
  const gov = (ok: boolean, state?: string) => ok ? "filled" : (state ?? "missing");
  if (opts.json) {
    // `--json` (ADR-0030): the regime, the files, and the verdict the pack carries, as one document.
    emitJson({
      runward: VERSION, mission: root,
      regime: key, regimeLabel: lens.label, regimeVersion: lens.version, regimeLens: regimeLensId(lens),
      dryRun, written: !dryRun,
      files,
      strict: true, verdict: gate.clean ? "clean" : "gaps",
      gaps: { deliverables: gate.gaps, conformance: gate.strictGaps },
      summary: {
        asiMapped: mappedAsi, asiCategories: inputs.asiCoverage.size,
        conformanceRows: inputs.conformance.length,
        adrs: { ratified, setAside, notRatified: pending },
        governance: { threatModel: gov(inputs.threatModel, inputs.threatModelState), evalRubric: gov(inputs.evalRubric, inputs.evalRubricState) },
      },
    });
    return;
  }
  console.log(section("Assembled"));
  console.log(`  ${c.primaryBold("ASI coverage")}   ${c.white(`${mappedAsi}/10 OWASP agentic (ASI) categories mapped to a rule`)}`);
  console.log(`  ${c.primaryBold("Conformance")}    ${c.white(`${inputs.conformance.length} accounted rule(s)`)}`);
  console.log(`  ${c.primaryBold("Decisions")}      ${c.white(`${ratified} ratified ADR(s)`)}${setAside ? c.dim(` · ${setAside} set aside (superseded, rejected, withdrawn or obsolete)`) : ""}${pending ? c.dim(` · ${pending} not ratified`) : ""}`);
  console.log(`  ${c.primaryBold("Governance")}     ${c.white(`threat model ${gov(inputs.threatModel, inputs.threatModelState)}, eval rubric ${gov(inputs.evalRubric, inputs.evalRubricState)}`)}`);

  console.log(section("Next steps"));
  console.log("  " + c.white("1.") + " Review " + c.primary(files[0]) + c.darkGray(" — a draft, not a compliance claim."));
  console.log("  " + c.white("2.") + " Fill the " + c.warning("\"Required from the operator\"") + " sections yourself (applicability, risk acceptance, policy, sign-off).");
  console.log("  " + c.white("3.") + " Machine-readable " + c.primary(files[1]) + c.darkGray(" (OSCAL, this regime) — feed it to your GRC/auditor tool; " + files[2] + " holds the last regime run."));
  console.log("  " + c.white("4.") + " Hand it over as " + c.white("supporting evidence") + c.darkGray(" — never as a certification."));
  console.log();
}
