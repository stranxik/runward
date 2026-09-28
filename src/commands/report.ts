// `runward report` — the delivery report an assessor reads alone (ADR-0064). The shell only:
// assembling the very payload `check --json` publishes (same lib bricks, no second decision)
// and writing the rendered file. Exit 0 whether the verdict is clean or gaps: a red mission's
// report is exactly what an assessor must be able to see.
import { writeFileSync, mkdirSync, existsSync, rmSync, statSync, openSync, readSync, closeSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { findMissionRoot, analyze } from "../lib/mission.js";
import { computeVerdict, verdictFrom } from "../lib/verdict.js";
import { machinePayload, conformanceRows, currentGateLabel, nextPayload, nextStep } from "../lib/check-contract.js";
import { renderDeliveryReport } from "../lib/report.js";
import { missionStateDigest } from "../lib/attestation.js";
import { GATE_NON_SCOPE, corpusStamp, corpusDrift } from "../lib/rules.js";
import { rulesDir } from "../lib/conformance.js";
import { c, createHeader, section, status, generationDate } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";
import { emitJson, noMissionPayload } from "../lib/machine-output.js";

// The title every report has carried since the command shipped (v0.39.0): the one mark that tells a
// previous delivery report apart from any other file an `--out` typo could land on.
const REPORT_MARK = "<title>Delivery report — subject ";

/** True when `file` is a delivery report this command wrote earlier — the only file it may replace
 *  unasked. Reads the head only: the mark sits in <head>, and a large unrelated file is not slurped. */
export function isDeliveryReport(file: string): boolean {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(4096);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const head = buf.subarray(0, n).toString("utf8");
    return head.startsWith("<!DOCTYPE html>") && head.includes(REPORT_MARK);
  } finally { closeSync(fd); }
}

/** `p` with its longest existing prefix resolved through symlinks: an absolute path typed as
 *  /var/... must compare equal to a project root the OS reports as /private/var/... (macOS). */
function canonical(p: string): string {
  let head = p;
  const tail: string[] = [];
  while (!existsSync(head) && dirname(head) !== head) { tail.unshift(basename(head)); head = dirname(head); }
  return join(realpathSync(head), ...tail);
}

export async function reportCommand(opts: { path?: string; out?: string; force?: boolean; json?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    if (opts.json) emitJson(noMissionPayload(VERSION));
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
    // The assessor reads this line alone: under a red verdict it names what it measured, never
    // "all gates passed" above a GAPS banner (RWD-2026-0131).
    currentGate: currentGateLabel(report, clean),
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
    // The same Next the strict gate prints (RWD-2026-0145), from the same function.
    next: nextPayload(nextStep({ gaps: verdict.gaps, strictGaps: verdict.strictGaps, hookFailed: 0, breakdown: verdict.strictBreakdown }, { strict: true })),
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
  //
  // The output path is guarded BEFORE anything is removed (RWD-2026-0139): the removal below is
  // right for a previous report and destructive for anything else, and `-o` is typed by hand. An
  // absolute path is taken as written (it used to be re-rooted under the project); a path that
  // leaves the project is refused, because the report describes this tree and belongs in it.
  const out = opts.out === undefined ? join(root, "runward/governance/delivery-report.html")
    : isAbsolute(opts.out) ? resolve(opts.out) : resolve(root, opts.out);
  const rel = relative(canonical(root), canonical(out));
  // Shown with `/` on every OS, like every other path the CLI prints (a Windows run printed
  // `runward\framing.md`, and the message no longer matched what it names elsewhere).
  const shown = rel.split(sep).join("/");
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    console.error(status.error(`--out must be a file path inside the project (got ${opts.out}): the report describes this tree and is written into it.`));
    process.exit(2);
  }
  const exists = existsSync(out);
  if (exists && statSync(out).isDirectory()) {
    console.error(status.error(`--out points to a directory (${shown}): give a file path, e.g. runward/governance/delivery-report.html.`));
    process.exit(2);
  }
  if (exists && !opts.force && !isDeliveryReport(out)) {
    console.error(status.error(`${shown} exists and is not a runward delivery report: refusing to overwrite it. Choose another --out path, or pass --force to replace it.`));
    process.exit(2);
  }
  // The global --dry-run promises "without writing" (RWD-2026-0140): nothing is removed, nothing is
  // written, and the planned act is said — the verdict needs no file to be known.
  // `--json` (ADR-0030): what was written and what it says, as one document — the verdict and the
  // Next of the payload the report renders, so an agent need not open the HTML to learn either.
  const result = (written: boolean, dryRun: boolean, subjectDigest: string | null) => ({
    runward: VERSION, mission: root, file: shown, written, replaced: exists, dryRun,
    strict: true, verdict: clean ? "clean" : "gaps",
    gaps: { deliverables: verdict.gaps, conformance: verdict.strictGaps },
    subjectDigest, next: payload.next,
  });
  if (process.env.RUNWARD_DRY_RUN === "1") {
    if (opts.json) { emitJson(result(false, true, null)); return; }
    console.log(createHeader(`Runward v${VERSION} — report (the assessor's document)`, root));
    console.log(`  ${c.info(exists ? "would replace" : "would write")} ${shown} ${c.darkGray(`(verdict ${clean ? "CLEAN" : "GAPS"})`)}`);
    console.log();
    return;
  }
  mkdirSync(dirname(out), { recursive: true });
  if (exists) rmSync(out);
  const subjectDigest = missionStateDigest(root, mission);
  const html = renderDeliveryReport(payload, { generatedOn: generationDate(), subjectDigest });
  writeFileSync(out, html);
  if (opts.json) { emitJson(result(true, false, subjectDigest)); return; }

  console.log(createHeader(`Runward v${VERSION} — report (the assessor's document)`, root));
  console.log(`  ${clean ? c.success("✓") : c.warning("◑")} ${c.white(`delivery report written — verdict ${clean ? "CLEAN" : "GAPS"}, said as such`)}`);
  console.log(`  ${c.darkGray("file:")} ${c.primary(shown)}`);
  console.log(section("Next"));
  console.log("  " + c.darkGray("Commit it, attach it to a release, or email it: self-contained, no account, no terminal needed. It renders the gate's machine payload and computes nothing (ADR-0064)."));
  console.log();
}
