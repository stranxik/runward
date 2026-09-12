// `runward report` — the delivery report an assessor reads alone (ADR-0064). The shell only:
// assembling the very payload `check --json` publishes (same lib bricks, no second decision)
// and writing the rendered file. Exit 0 whether the verdict is clean or gaps: a red mission's
// report is exactly what an assessor must be able to see.
import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findMissionRoot, analyze } from "../lib/mission.js";
import { computeVerdict, verdictFrom } from "../lib/verdict.js";
import { machinePayload, conformanceRows } from "../lib/check-contract.js";
import { renderDeliveryReport } from "../lib/report.js";
import { missionStateDigest } from "../lib/attestation.js";
import { GATE_NON_SCOPE, corpusStamp, corpusDrift } from "../lib/rules.js";
import { rulesDir } from "../lib/conformance.js";
import { c, createHeader, section, status, generationDate } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

export async function reportCommand(opts: { path?: string; out?: string }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const report = analyze(mission);
  const verdict = computeVerdict(mission, { strict: true, hookFailed: 0 });
  const { clean } = verdictFrom(verdict.gaps, verdict.strictGaps, 0);
  const payload = machinePayload(verdict, {
    version: VERSION,
    missionRoot: root,
    currentGate: report.currentPhase,
    adrCount: report.adrCount,
    clean,
    strict: true,
    gaps: verdict.gaps,
    strictGaps: verdict.strictGaps,
    hookFailed: 0,
    deliverables: verdict.deliverables,
    conformance: conformanceRows(verdict),
    corpusPin: corpusStamp(rulesDir(mission)),
    corpusDrift: corpusDrift(mission, rulesDir(mission)),
    gateNonScope: GATE_NON_SCOPE,
  });
  // ADR-0071 option 2: the subject digest is taken BEFORE the write, because the report lives inside
  // the tree the digest hashes. Measured while deciding: printing the after-value would be wrong on
  // every run — the naive fix would have manufactured a false green, which is why the ADR offered
  // three shapes and the maintainer chose this one.
  //
  // AND a PREVIOUS report must be gone before the hash, or the second run of an unchanged tree
  // prints a different digest than the first and the document stops being byte-identical across
  // runs — which is ADR-0064's own settling criterion, and it failed exactly once here before this
  // line existed. Removing the file we are about to overwrite is also literally the gesture the
  // report tells its reader to perform, so the command and the document now describe one act.
  const out = join(root, opts.out ?? "runward/governance/delivery-report.html");
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out)) rmSync(out);
  const subjectDigest = missionStateDigest(root, mission);
  const html = renderDeliveryReport(payload, { generatedOn: generationDate(), subjectDigest });
  writeFileSync(out, html);

  console.log(createHeader(`Runward v${VERSION} — report (the assessor's document)`, root));
  console.log(`  ${clean ? c.success("✓") : c.warning("◑")} ${c.white(`delivery report written — verdict ${clean ? "CLEAN" : "GAPS"}, said as such`)}`);
  console.log(`  ${c.darkGray("file:")} ${c.primary(out.startsWith(root) ? out.slice(root.length + 1) : out)}`);
  console.log(section("Next"));
  console.log("  " + c.darkGray("Commit it, attach it to a release, or email it: self-contained, no account, no terminal needed. It renders the gate's machine payload and computes nothing (ADR-0064)."));
  console.log();
}
