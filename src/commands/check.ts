import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyze, findMissionRoot } from "../lib/mission.js";
import { conformance, driftReport, unratifiedAdrs, decisionCoverage, ruleSignatures, GATED_DELIVERABLES } from "../lib/conformance.js";
import { evidenceReport, verifyEvidenceLock, renderEvidenceLock, EVIDENCE_LOCK } from "../lib/evidence.js";
import { behavioralProof } from "../lib/behavioral-proof.js";
import { verifyFindings, VERIFY_FINDINGS } from "../lib/verify-findings.js";
import { runHooks } from "../lib/hooks.js";
import { c, createHeader, isNonInteractive, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Gate audit — the gap analysis: which deliverable, expected at which
 * phase, is present, started, or still a raw template.
 * With --strict, also verifies the rule-conformance manifests (ADR-0001): every
 * CRITICAL/HIGH rule mapped to a build phase must be accounted for, applied
 * evidence must point at something real (ADR-0019/0020/0021 — typed pointers,
 * non-vacuity, signatures, drift, seal). It checks the presence and shape of a
 * traced decision, never the quality of the implementation — that stays the
 * operator's judgment at the gate.
 * With --freeze (implies --strict), a green gate is sealed: the resolvable
 * evidence files are hashed into runward/evidence-lock.json (ADR-0021).
 * Exit codes: 0 = current gate clean, 1 = gaps, 2 = no mission found.
 */
export async function checkCommand(opts: { path?: string; strict?: boolean; hooks?: boolean; coverage?: boolean; freeze?: boolean }): Promise<void> {
  if (opts.freeze) opts.strict = true; // a seal certifies a strict crossing
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const report = analyze(mission);

  console.log(createHeader(`Runward v${VERSION} — gate audit`, root));

  let hookFailed = 0;
  if (opts.hooks) {
    const before = runHooks(mission, "before", root);
    if (before.ran > 0) {
      console.log(section("Hooks · before"));
      console.log("  " + (before.failed.length ? status.error(`${before.failed.length}/${before.ran} failed`) : status.success(`${before.ran} ok`)));
      hookFailed += before.failed.length;
    }
  }

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
    console.log(section("Rule conformance (--strict)"));
    let checked = 0;
    const signatures = ruleSignatures(mission);
    for (const { phase, deliverable, label } of GATED_DELIVERABLES) {
      const { expected, violations } = conformance(mission, phase, deliverable);
      // The evidence layer (ADR-0019/0020) and drift (blocking since ADR-0021) join the
      // same verdict: a traced decision whose pointer is hollow or stale is a gap.
      violations.push(...evidenceReport(mission, deliverable, signatures));
      violations.push(...driftReport(mission, deliverable));
      // Non-vacuity (ADR-0002): when no rules are currently mapped to a phase, conformance()
      // still raises a `(mapping)` violation if the mapping was stripped below its pinned
      // floor. Only skip when there is genuinely nothing to report — never discard that signal.
      if (expected.length === 0 && violations.length === 0) continue;
      checked++;
      if (violations.length === 0) {
        console.log(`  ${status.success(`${label}: ${expected.length} rule(s) accounted for`)}`);
      } else {
        for (const v of violations) console.log(`  ${c.error("✗")} ${c.darkGray(label + " · ")}${c.white(v.rule)}${c.darkGray(" — " + v.problem)}`);
        strictGaps += violations.length;
      }
    }
    if (checked === 0) console.log("  " + c.darkGray("no CRITICAL/HIGH rules mapped to a build phase"));
    // Under --freeze the old seal is being replaced, not verified — otherwise a changed
    // sealed file would make re-sealing impossible (the seal violation reddens the gate
    // that freeze requires green). Everything else must still be green to seal.
    const seal = opts.freeze ? { present: false, count: 0, violations: [] as ReturnType<typeof verifyEvidenceLock>["violations"] } : verifyEvidenceLock(mission);
    if (seal.present) {
      console.log(section("Evidence seal (--strict)"));
      if (seal.violations.length === 0) {
        console.log(`  ${status.success(`seal intact — ${seal.count} evidence file(s), sealed ${seal.sealedAt ?? "?"}`)}`);
      } else {
        for (const v of seal.violations) console.log(`  ${c.error("✗")} ${c.white(v.rule)}${c.darkGray(" — " + v.problem)}`);
        strictGaps += seal.violations.length;
      }
    }
    const unratified = unratifiedAdrs(mission);
    if (unratified.length > 0) {
      console.log(section("Reconstruction lifecycle (--strict)"));
      for (const u of unratified) console.log(`  ${c.error("✗")} ${c.white(u.file)}${c.darkGray(" — " + u.reason)}`);
      console.log("  " + c.darkGray("ratify each: write the real why + a re-evaluation trigger and set Status: accepted (rename DRAFT→ADR), or remove it. A hypothesis is not a decision."));
      strictGaps += unratified.length;
    }
    if (checked > 0 && strictGaps === 0) {
      // The two proofs, made legible together: this gate is the DOCUMENTARY proof (decisions traced);
      // the BEHAVIORAL proof is the operator's test suite. runward reads the pointer, never runs the code.
      console.log(section("Behavioral proof (advisory, above the gate)"));
      console.log("  " + c.darkGray("this gate is the documentary proof: the decisions are traced. runward did not run your code — it is not a runtime. The behavioral proof is your test suite."));
      const bp = behavioralProof(mission, root);
      if (!bp.declared) {
        console.log("  " + c.darkGray("no behavioral proof declared — add `Behavioral proof: <command>` to runward/floor.md §2 (and optionally `Proof artifact: <path>`)."));
      } else {
        if (bp.command) console.log(`  ${c.darkGray("prove behavior with:")} ${c.white(bp.command)}`);
        if (bp.artifact) {
          if (!bp.present) console.log(`  ${c.warning("◑")} ${c.darkGray("proof artifact")} ${c.white(bp.artifact)} ${c.warning("missing — run the command to produce it")}`);
          else {
            const fresh = bp.fresh === undefined ? "" : bp.fresh ? c.success(" · fresh") : c.warning(" · stale (older than the code — re-run)");
            console.log(`  ${c.success("✓")} ${c.darkGray("proof artifact")} ${c.white(bp.artifact)} ${c.darkGray(`(${bp.date})`)}${fresh}`);
          }
        }
        console.log("  " + c.darkGray("advisory — runward reports presence and freshness, never runs or reads the result. You cross on both proofs."));
      }
      console.log(section("Semantic check (advisory, above the gate)"));
      console.log("  " + c.darkGray("the gate proved every CRITICAL/HIGH rule was traced — not that the code applies it. Before you cross, run the verify workflow (runward/workflows/verify.md): an adversarial cite-vs-apply pass, ideally on a different model. Advisory, agent-executed, never blocks the gate (ADR-0007)."));
      const vf = verifyFindings(mission);
      if (!vf.present) {
        console.log("  " + c.darkGray(`no verify findings recorded yet — the workflow writes them to runward/${VERIFY_FINDINGS}.`));
      } else {
        const freshness = vf.fresh ? c.success(" · fresh") : c.warning(" · stale (a gated manifest changed since — re-run the verify workflow)");
        console.log(`  ${c.success("✓")} ${c.darkGray("verify findings")} ${c.white(`runward/${VERIFY_FINDINGS}`)} ${c.darkGray(`(${vf.date})`)}${freshness}`);
        console.log("  " + c.darkGray("advisory — runward reports presence and freshness, never reads a verdict. The findings inform your crossing; they never gate it."));
      }
    }
  }

  if (opts.coverage) {
    console.log(section("Documentation coverage (advisory)"));
    let filled = 0, totalArt = 0;
    for (const phase of report.phases) for (const { state } of phase.artifacts) { totalArt++; if (state === "filled") filled++; }
    console.log(`  ${c.primaryBold("Deliverables")}  ${c.white(`${filled}/${totalArt} filled`)}`);
    const dc = decisionCoverage(mission);
    console.log(`  ${c.primaryBold("Decisions")}     ${c.white(`${dc.ratified}/${dc.total} ratified`)}${dc.unratified.length ? c.warning(`  (${dc.unratified.length} to ratify)`) : ""}`);
    for (const u of dc.unratified) console.log(`     ${c.warning("◑")} ${c.white(u.file)}${c.darkGray(" — " + u.reason)}`);
    console.log("  " + c.darkGray("advisory — a ratio of what is documented and ratified, not a claim of completeness. Does not affect the verdict."));
  }

  if (opts.hooks) {
    const after = runHooks(mission, "after", root);
    if (after.ran > 0) {
      console.log(section("Hooks · after"));
      console.log("  " + (after.failed.length ? status.error(`${after.failed.length}/${after.ran} failed`) : status.success(`${after.ran} ok`)));
      hookFailed += after.failed.length;
    }
  }

  console.log(section("Summary"));
  console.log(`  ${c.primaryBold("Current gate")}  ${c.white(report.currentPhase)}`);
  console.log(`  ${c.primaryBold("ADRs")}          ${c.white(String(report.adrCount))}${report.adrCount === 0 ? c.warning("  — no structural decision locked yet") : ""}`);
  if (gaps === 0 && strictGaps === 0 && hookFailed === 0) {
    console.log("\n" + status.success("All expected deliverables are filled. Cross gates on evidence, not on paperwork."));
  } else {
    const parts: string[] = [];
    if (gaps) parts.push(`${gaps} deliverable(s) not filled`);
    if (strictGaps) parts.push(`${strictGaps} floor rule-conformance gap(s)`);
    if (hookFailed) parts.push(`${hookFailed} hook(s) failed`);
    console.log("\n" + status.warning(`${parts.join(" · ")}. No phase closes without its artifact — and, under --strict, without its CRITICAL/HIGH rules accounted for.`));
    process.exitCode = 1;
  }

  if (opts.freeze) {
    console.log(section("Evidence seal — freeze (ADR-0021)"));
    if (gaps || strictGaps || hookFailed) {
      console.log("  " + status.error("refusing to seal a red gate — a seal certifies a crossing, not a hope. Close the gaps above, then re-run `runward check --freeze`."));
    } else {
      const sealedAt = isNonInteractive() && process.env.RUNWARD_NOW ? process.env.RUNWARD_NOW : new Date().toISOString().slice(0, 10);
      const content = renderEvidenceLock(mission, sealedAt);
      const count = Object.keys(JSON.parse(content).files).length;
      if (process.env.RUNWARD_DRY_RUN === "1") {
        console.log("  " + c.darkGray(`dry-run — would seal ${count} evidence file(s) into runward/${EVIDENCE_LOCK}`));
      } else {
        writeFileSync(join(mission, EVIDENCE_LOCK), content);
        console.log(`  ${status.success(`sealed ${count} evidence file(s) into runward/${EVIDENCE_LOCK} — commit it`)}`);
        console.log("  " + c.darkGray("a sealed file that later changes or disappears fails `check --strict` until you re-verify and re-seal."));
      }
    }
  }

  // Transmission surface: name the next gesture, so the operating agent can hand the human a decision.
  console.log(section("Next"));
  if (gaps === 0 && strictGaps === 0 && hookFailed === 0) {
    console.log(`  Assemble the evidence pack with ${c.primary("runward compliance <regime>")} ${c.darkGray("(iso-42001 · nist-ai-rmf · eu-ai-act), or")} ${c.primary("runward status")} ${c.darkGray("for a handover snapshot.")}`);
  } else {
    console.log(`  Fill the deliverable(s) named above, then re-run ${c.primary("runward check")}. ${c.primary("runward status")} ${c.darkGray("names exactly what is open at the current gate.")}`);
  }
  console.log();
}
