import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyze, findMissionRoot, isRealAdr, readReopeningTriggers } from "../lib/mission.js";
import { territoryCoverage } from "../lib/characterize.js";
import { computeVerdict, verdictFrom, verdictSummaryParts } from "../lib/verdict.js";
import { c, createHeader, section } from "../lib/styles.js";
import { VERSION, WORKFLOWS } from "../lib/paths.js";
import { readWorkflowContracts, producesGateJoin } from "../lib/workflow-contract.js";
import { currentGateLabel } from "../lib/check-contract.js";
import { emitJson, humanLog, noMissionPayload } from "../lib/machine-output.js";

/** An ADR's date from its own `**Date**:` line — CONTENT only, never mtime (ADR-0033 rejects mtimes
 *  as non-reproducible across clones). null when the line is absent, "unreadable" when the entry
 *  cannot be read (a directory named ADR-*.md, a broken symlink must not crash the render). */
function adrDate(adrDir: string, f: string): string | null {
  try {
    return readFileSync(join(adrDir, f), "utf8").match(/^\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? null;
  } catch { return "unreadable"; }
}

/** Mission snapshot: phase progress, decision journal, activity, workflows —
 *  a transmission-ready "where the mission stands", read-only from the mission files. */
export async function statusCommand(opts: { path?: string; json?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    if (opts.json) emitJson(noMissionPayload(VERSION));
    // Aiguillage (ADR-0033): pick the mode from a fact, not instinct. No governed mission here —
    // point at `init` for a fresh mission and `characterize` for an existing, ungoverned codebase.
    console.error(c.error("✗ ") + "No runward/ mission found here.");
    console.error(c.darkGray("  New mission: ") + c.primary("runward init") + c.darkGray("   ·   Existing codebase to bring under governance: ") + c.primary("runward characterize"));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const report = analyze(mission);
  const log = humanLog(opts.json);

  log(createHeader(`Runward v${VERSION} — mission status`, root));

  // Mission title + current gate
  log(section("Mission"));
  const framingPath = join(mission, "framing.md");
  if (existsSync(framingPath)) {
    const title = readFileSync(framingPath, "utf8").split("\n")[0]?.replace(/^#\s*/, "") ?? "";
    log(`  ${c.white(title)}`);
  }
  // `analyze()` reads the deliverables and nothing else. Alone, it let this screen print "delivery
  // arc complete" on a mission `check --strict` refused and `gate-hook` blocked: a dead pointer, a
  // drifted seal, an unratified decision were invisible here, and `check` sent its reader HERE to
  // learn what was open (RWD-2026-0130). The strict verdict is computed in-process — the same
  // function `check --strict`, `report` and `gate-hook` call, reading the tree and writing nothing —
  // so the arc is never called complete without having been judged. Hooks are not run: they are
  // the operator's own commands, opt-in behind `check --hooks`, and a snapshot does not execute.
  const strictVerdict = computeVerdict(mission, { strict: true, hookFailed: 0 });
  const strictClean = verdictFrom(strictVerdict.gaps, strictVerdict.strictGaps, 0).clean;
  const strictParts = verdictSummaryParts(strictVerdict).join(" · ");
  const arcComplete = report.steadyState && strictClean;
  // ADR-0033: once every gate is filled the mission is in the iterate/operate steady-state, not at a
  // terminal "done". Name it as such instead of the bare "all gates passed".
  const gateLabel = arcComplete
    ? "iterate — steady-state (delivery arc complete)"
    : report.steadyState
      ? "all deliverables filled, but check --strict refuses the crossing"
      : report.currentPhase;
  log(`  ${c.primaryBold("Current gate")}  ${c.white(gateLabel)}`);
  log(`  ${c.primaryBold("Strict gate")}   ${strictClean ? c.success("clean") : c.error(strictParts)}`);

  // Phase progress across the gated arc — where the mission stands, gate by gate
  log(section("Phase progress"));
  const currentIndex = report.phases.findIndex((p) => !p.complete);
  report.phases.forEach((p, i) => {
    const filled = p.artifacts.filter((a) => a.state === "filled").length;
    const total = p.artifacts.length;
    const isCurrent = i === currentIndex;
    const mark = p.complete ? c.success("✓") : isCurrent ? c.primary("▸") : c.darkGray("○");
    const label = p.complete ? c.white(p.spec.label) : isCurrent ? c.primaryBold(p.spec.label) : c.gray(p.spec.label);
    const count = p.complete ? c.darkGray(`${filled}/${total}`) : c.white(`${filled}/${total}`);
    log(`  ${mark} ${label}  ${count}${isCurrent ? c.primary("  ← you are here") : ""}`);
    // Under the current phase, name exactly what is still open.
    if (isCurrent) {
      for (const a of p.artifacts.filter((a) => a.state !== "filled")) {
        log(`      ${c.darkGray("○")} ${c.gray(a.artifact.label)} ${c.darkGray(`(${a.state})`)}`);
      }
    }
  });
  // ADR-0033: the arc is a delivery arc, not the whole life. When it is crossed, the mission lives in
  // the iterate steady-state — name it as the real "you are here", not an already-finished gate.
  if (report.steadyState && !arcComplete) {
    log(`  ${c.primary("▸")} ${c.primaryBold("Strict gate")}  ${c.error(strictParts)}  ${c.primary("← you are here")}`);
    log(`      ${c.darkGray("runward check --strict names each one")}`);
  } else if (arcComplete) {
    log(`  ${c.primary("▸")} ${c.primaryBold("Iterate — continuous improvement")}  ${c.primary("← you are here")}`);
    log(`      ${c.darkGray("advance by one ADR per structural switch, on an objective reevaluation trigger")}`);
  }

  // Decision journal — the ADRs, dated
  log(section("Decision journal"));
  const adrDir = join(mission, "adr");
  const adrs = existsSync(adrDir)
    ? readdirSync(adrDir).filter((f) => isRealAdr(f, adrDir)).sort()
    : [];
  if (adrs.length === 0) {
    log(c.darkGray("  no ADR yet — every structural decision must be locked"));
  } else {
    for (const f of adrs.slice(-5)) {
      // Date the ADR from its own `**Date**:` line — CONTENT only, never mtime (ADR-0033 rejects
      // mtimes as non-reproducible across clones). No conforming date line = say so.
      // Guarded: a pathological adr/ entry (a directory named ADR-*.md, a broken symlink) must
      // not crash the whole status render.
      const date = adrDate(adrDir, f) ?? "date unlisted";
      log(`  ${c.primary("•")} ${c.white(f)} ${c.darkGray(date)}`);
    }
    if (adrs.length > 5) log(c.darkGray(`  … and ${adrs.length - 5} more`));
    log(c.darkGray(`  ${adrs.length} decision(s) traced`));
  }

  // Reopening watch (ADR-0033, "À ROUVRIR") — the real backlog of a governed mission: which locked
  // decision is due to reopen. A deterministic parse of each accepted ADR's mandatory reevaluation
  // trigger. It presents the triggers; the operator judges whether one has fired (operator-owns-the-gate).
  const watch = readReopeningTriggers(adrDir);
  const triggers = watch.triggers;
  if (triggers.length > 0 || watch.missingSection.length > 0) {
    log(section("Reopening watch"));
    const CAP = 8;
    for (const t of triggers.slice(0, CAP)) {
      const when = t.setOn ? c.darkGray(` (set ${t.setOn})`) : "";
      log(`  ${c.primary("•")} ${c.white(t.adr.replace(/\.md$/, ""))}${when}`);
      if (t.preview) log(`      ${c.gray(t.preview)}`);
    }
    if (triggers.length > CAP) log(c.darkGray(`  … and ${triggers.length - CAP} more — see runward/adr/`));
    // Fail-honest: an accepted ADR without the mandatory trigger section is named, never
    // silently counted as if it carried one.
    if (watch.missingSection.length > 0) {
      log(c.warning("  ! ") + c.gray(`${watch.missingSection.length} accepted decision(s) carry NO reevaluation trigger section (template mandates one): ${watch.missingSection.map((f) => f.replace(/\.md$/, "")).join(", ")}`));
    }
    if (triggers.length > 0) log(c.darkGray("  triggers shown, not judged — you decide if one has fired."));
  }

  // Territory coverage (ADR-0043). This lives here, and not in `characterize`, because that
  // command tells a governed mission it is the wrong command before running anyway, and writes a
  // characterization.md that is not a mission deliverable. The anti-rot instrument has to be
  // reachable by the mission it protects: `status` is the governed-mission read, at the groom
  // cadence the ADR watches at. `rules --for` cannot host it — it only ever sees the paths its
  // caller passed, so it can never know a map row matched no file.
  const cov = territoryCoverage(root);
  {
    if (cov) {
      log(section("Territory coverage"));
      log(`  ${c.white(String(cov.covered))} ${c.darkGray(`of ${cov.walked} scanned file(s) are assigned a category that rules can govern`)}${cov.byCategory.length ? c.darkGray(` · ${cov.byCategory.map((b) => `${b.category} ${b.files}`).join(" · ")}`) : ""}`);
      log(cov.mapPresent
        ? `  ${c.darkGray(`runward/territory.md: ${cov.mapRows} row(s) declared.`)}`
        : `  ${c.darkGray("no runward/territory.md — categories come only from your deployment manifests (derivation).")}`);
      if (cov.inertRows.length) {
        log(`  ${c.warning("!")} ${c.white(String(cov.inertRows.length))} ${c.darkGray("row(s) matched no scanned file:")}`);
        for (const r of cov.inertRows) log(`      ${c.darkGray(`territory.md:${r.line}  ${r.pattern} → ${r.category}`)}`);
        log(`  ${c.darkGray("A row that affects nothing today. Dead or merely early is your call, not the tool's.")}`);
      }
    }
  }

  // `--json` (ADR-0030): the snapshot as one document. The Activity section is left out on purpose:
  // it reads file mtimes, which a clone or a checkout rewrites, and the document must be the same
  // for the same tree.
  if (opts.json) {
    const wf = readWorkflowContracts(mission);
    const wfMissing = WORKFLOWS.filter((w) => !existsSync(join(mission, "workflows", `${w}.md`)));
    emitJson({
      runward: VERSION,
      mission: root,
      title: existsSync(framingPath) ? (readFileSync(framingPath, "utf8").split("\n")[0]?.replace(/^#\s*/, "") ?? "") : null,
      // Same function, same meaning as `check --json` `currentGate` (RWD-2026-0131).
      currentGate: currentGateLabel(report, strictClean),
      currentPhaseId: currentIndex >= 0 ? report.phases[currentIndex].spec.id : null,
      steadyState: report.steadyState,
      arcComplete,
      // The strict verdict this screen already computes (RWD-2026-0130), named as `check --json` names it.
      strict: true,
      verdict: strictClean ? "clean" : "gaps",
      gaps: { deliverables: strictVerdict.gaps, conformance: strictVerdict.strictGaps },
      phases: report.phases.map((p, i) => ({
        id: p.spec.id,
        label: p.spec.label,
        complete: p.complete,
        current: i === currentIndex,
        filled: p.artifacts.filter((a) => a.state === "filled").length,
        total: p.artifacts.length,
        deliverables: p.artifacts.map((a) => ({ deliverable: `runward/${a.artifact.relPath}`, label: a.artifact.label, state: a.state })),
      })),
      adrCount: report.adrCount,
      adrs: adrs.map((f) => ({ file: f, date: adrDate(adrDir, f) })),
      reopening: { triggers: watch.triggers, missingSection: watch.missingSection },
      territoryCoverage: cov,
      workflows: {
        missing: wfMissing,
        present: WORKFLOWS.length - wfMissing.length,
        contracts: {
          held: wf.filter((x) => x.contract && x.contract.malformed.length === 0).length,
          malformed: wf.filter((x) => x.contract && x.contract.malformed.length > 0).map((x) => ({ file: x.file, problems: x.contract!.malformed })),
          undeclared: wf.filter((x) => x.contract === null).length,
        },
        joinBreaks: producesGateJoin(wf),
      },
    });
    return;
  }

  // Activity — the most recently touched deliverable, so a receiving team sees the last movement
  log(section("Activity"));
  let latest: { date: string; label: string } | null = null;
  for (const p of report.phases) {
    for (const a of p.artifacts) {
      const abs = join(mission, a.artifact.relPath);
      if (!existsSync(abs)) continue;
      const st = statSync(abs);
      if (!st.isFile()) continue;
      const date = st.mtime.toISOString().slice(0, 10);
      if (!latest || date > latest.date) latest = { date, label: a.artifact.label };
    }
  }
  if (latest) log(`  ${c.primaryBold("Last touched")}  ${c.white(latest.date)}  ${c.darkGray(latest.label)}`);
  else log(c.darkGray("  no deliverable written yet"));

  // Workflows — promises read, never files counted (ADR-0067). Until W2 poses the contracts,
  // "no contract yet" is the measured truth and is said as such.
  log(section("Workflows"));
  const missing = WORKFLOWS.filter((wf) => !existsSync(join(mission, "workflows", `${wf}.md`)));
  if (missing.length > 0) log(c.warning("  ! ") + c.white(`missing: ${missing.join(", ")} — run \`runward update\``));
  const wfContracts = readWorkflowContracts(mission);
  const held = wfContracts.filter((x) => x.contract && x.contract.malformed.length === 0).length;
  const broken = wfContracts.filter((x) => x.contract && x.contract.malformed.length > 0);
  const absent = wfContracts.filter((x) => x.contract === null).length;
  if (missing.length === 0) log(c.success("  ✓ ") + c.white(`all ${WORKFLOWS.length} workflows present`) + c.darkGray(` — contracts: ${held} held · ${broken.length} malformed · ${absent} not yet declared`));
  for (const b of broken.slice(0, 3)) log(c.warning("  ! ") + c.white(`${b.file}: ${b.contract!.malformed[0]}`));
  const joinBreaks = producesGateJoin(wfContracts);
  for (const j of joinBreaks.slice(0, 3)) log(c.warning("  ! ") + c.darkGray(j));

  // Next — the transmission surface: name the next gesture, never leave the reader guessing
  log(section("Next"));
  if (report.steadyState && !arcComplete) {
    log(`  The delivery arc is not complete: ${c.white(strictParts)}. Run ${c.primary("runward check --strict")}, which names each one, close them, then re-run it.`);
  } else if (report.steadyState) {
    // ADR-0033: the gated arc is crossed. Do not point back through it as if pending — name the iterate
    // posture, and name the evidence gate as re-runnable any time, not as the next milestone.
    log(`  This mission is in the ${c.white("iterate steady-state")}: advance it by locking ${c.white("one ADR per structural switch")}, on an objective reevaluation trigger.`);
    if (triggers.length > 0) log(`  ${triggers.length} decision(s) carry a reopening trigger — see ${c.primary("Reopening watch")} above.`);
    log(c.darkGray(`  The evidence gate stays re-runnable any time: ${c.primary("runward check --strict")}${c.darkGray(", ")}${c.primary("runward compliance <regime>")}${c.darkGray(".")}`));
  } else {
    const cur = report.phases[currentIndex];
    const open = cur.artifacts.filter((a) => a.state !== "filled").length;
    log(`  Fill the ${open} open deliverable(s) in ${c.white(cur.spec.label)}, then run ${c.primary("runward check")} to cross the gate on evidence.`);
    // The deliverables are not the whole gate: say so when the strict reading already refuses more.
    if (strictVerdict.strictGaps > 0) log(`  ${c.darkGray("Beyond the deliverables,")} ${c.primary("runward check --strict")} ${c.darkGray(`also refuses ${strictVerdict.strictGaps} gap(s) today.`)}`);
  }
  log();
}
