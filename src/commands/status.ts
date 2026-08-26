import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyze, findMissionRoot, isRealAdr, readReopeningTriggers } from "../lib/mission.js";
import { territoryCoverage } from "../lib/characterize.js";
import { c, createHeader, section } from "../lib/styles.js";
import { VERSION, WORKFLOWS } from "../lib/paths.js";

/** Mission snapshot: phase progress, decision journal, activity, workflows —
 *  a transmission-ready "where the mission stands", read-only from the mission files. */
export async function statusCommand(opts: { path?: string }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    // Aiguillage (ADR-0033): pick the mode from a fact, not instinct. No governed mission here —
    // point at `init` for a fresh mission and `characterize` for an existing, ungoverned codebase.
    console.error(c.error("✗ ") + "No runward/ mission found here.");
    console.error(c.darkGray("  New mission: ") + c.primary("runward init") + c.darkGray("   ·   Existing codebase to bring under governance (M1/M2): ") + c.primary("runward characterize"));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const report = analyze(mission);

  console.log(createHeader(`Runward v${VERSION} — mission status`, root));

  // Mission title + current gate
  console.log(section("Mission"));
  const framingPath = join(mission, "framing.md");
  if (existsSync(framingPath)) {
    const title = readFileSync(framingPath, "utf8").split("\n")[0]?.replace(/^#\s*/, "") ?? "";
    console.log(`  ${c.white(title)}`);
  }
  // ADR-0033: once every gate is filled the mission is in the iterate/operate steady-state, not at a
  // terminal "done". Name it as such instead of the bare "all gates passed".
  const gateLabel = report.steadyState ? "iterate — steady-state (delivery arc complete)" : report.currentPhase;
  console.log(`  ${c.primaryBold("Current gate")}  ${c.white(gateLabel)}`);

  // Phase progress across the gated arc — where the mission stands, gate by gate
  console.log(section("Phase progress"));
  const currentIndex = report.phases.findIndex((p) => !p.complete);
  report.phases.forEach((p, i) => {
    const filled = p.artifacts.filter((a) => a.state === "filled").length;
    const total = p.artifacts.length;
    const isCurrent = i === currentIndex;
    const mark = p.complete ? c.success("✓") : isCurrent ? c.primary("▸") : c.darkGray("○");
    const label = p.complete ? c.white(p.spec.label) : isCurrent ? c.primaryBold(p.spec.label) : c.gray(p.spec.label);
    const count = p.complete ? c.darkGray(`${filled}/${total}`) : c.white(`${filled}/${total}`);
    console.log(`  ${mark} ${label}  ${count}${isCurrent ? c.primary("  ← you are here") : ""}`);
    // Under the current phase, name exactly what is still open.
    if (isCurrent) {
      for (const a of p.artifacts.filter((a) => a.state !== "filled")) {
        console.log(`      ${c.darkGray("○")} ${c.gray(a.artifact.label)} ${c.darkGray(`(${a.state})`)}`);
      }
    }
  });
  // ADR-0033: the arc is a delivery arc, not the whole life. When it is crossed, the mission lives in
  // the iterate steady-state — name it as the real "you are here", not an already-finished gate.
  if (report.steadyState) {
    console.log(`  ${c.primary("▸")} ${c.primaryBold("Iterate — continuous improvement")}  ${c.primary("← you are here")}`);
    console.log(`      ${c.darkGray("advance by one ADR per structural switch, on an objective reevaluation trigger")}`);
  }

  // Decision journal — the ADRs, dated
  console.log(section("Decision journal"));
  const adrDir = join(mission, "adr");
  const adrs = existsSync(adrDir)
    ? readdirSync(adrDir).filter((f) => isRealAdr(f, adrDir)).sort()
    : [];
  if (adrs.length === 0) {
    console.log(c.darkGray("  no ADR yet — every structural decision must be locked"));
  } else {
    for (const f of adrs.slice(-5)) {
      // Date the ADR from its own `**Date**:` line — CONTENT only, never mtime (ADR-0033 rejects
      // mtimes as non-reproducible across clones). No conforming date line = say so.
      // Guarded: a pathological adr/ entry (a directory named ADR-*.md, a broken symlink) must
      // not crash the whole status render.
      let date = "date unlisted";
      try {
        const dateLine = readFileSync(join(adrDir, f), "utf8").match(/^\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/m);
        if (dateLine) date = dateLine[1];
      } catch { date = "unreadable"; }
      console.log(`  ${c.primary("•")} ${c.white(f)} ${c.darkGray(date)}`);
    }
    if (adrs.length > 5) console.log(c.darkGray(`  … and ${adrs.length - 5} more`));
    console.log(c.darkGray(`  ${adrs.length} decision(s) traced`));
  }

  // Reopening watch (ADR-0033, "À ROUVRIR") — the real backlog of a governed mission: which locked
  // decision is due to reopen. A deterministic parse of each accepted ADR's mandatory reevaluation
  // trigger. It presents the triggers; the operator judges whether one has fired (operator-owns-the-gate).
  const watch = readReopeningTriggers(adrDir);
  const triggers = watch.triggers;
  if (triggers.length > 0 || watch.missingSection.length > 0) {
    console.log(section("Reopening watch"));
    const CAP = 8;
    for (const t of triggers.slice(0, CAP)) {
      const when = t.setOn ? c.darkGray(` (set ${t.setOn})`) : "";
      console.log(`  ${c.primary("•")} ${c.white(t.adr.replace(/\.md$/, ""))}${when}`);
      if (t.preview) console.log(`      ${c.gray(t.preview)}`);
    }
    if (triggers.length > CAP) console.log(c.darkGray(`  … and ${triggers.length - CAP} more — see runward/adr/`));
    // Fail-honest: an accepted ADR without the mandatory trigger section is named, never
    // silently counted as if it carried one.
    if (watch.missingSection.length > 0) {
      console.log(c.warning("  ! ") + c.gray(`${watch.missingSection.length} accepted decision(s) carry NO reevaluation trigger section (template mandates one): ${watch.missingSection.map((f) => f.replace(/\.md$/, "")).join(", ")}`));
    }
    if (triggers.length > 0) console.log(c.darkGray("  triggers shown, not judged — you decide if one has fired."));
  }

  // Territory coverage (ADR-0043). This lives here, and not in `characterize`, because that
  // command tells a governed mission it is the wrong command before running anyway, and writes a
  // characterization.md that is not a mission deliverable. The anti-rot instrument has to be
  // reachable by the mission it protects: `status` is the governed-mission read, at the groom
  // cadence the ADR watches at. `rules --for` cannot host it — it only ever sees the paths its
  // caller passed, so it can never know a map row matched no file.
  {
    const cov = territoryCoverage(root);
    if (cov) {
      console.log(section("Territory coverage"));
      console.log(`  ${c.white(String(cov.covered))} ${c.darkGray(`of ${cov.walked} walked file(s) carry a category`)}${cov.byCategory.length ? c.darkGray(` · ${cov.byCategory.map((b) => `${b.category} ${b.files}`).join(" · ")}`) : ""}`);
      console.log(cov.mapPresent
        ? `  ${c.darkGray(`runward/territory.md: ${cov.mapRows} row(s) declared.`)}`
        : `  ${c.darkGray("no runward/territory.md — categories come from derivation only.")}`);
      if (cov.inertRows.length) {
        console.log(`  ${c.warning("!")} ${c.white(String(cov.inertRows.length))} ${c.darkGray("row(s) matched no walked file:")}`);
        for (const r of cov.inertRows) console.log(`      ${c.darkGray(`territory.md:${r.line}  ${r.pattern} → ${r.category}`)}`);
        console.log(`  ${c.darkGray("A row that affects nothing today. Dead or merely early is your call, not the tool's.")}`);
      }
    }
  }

  // Activity — the most recently touched deliverable, so a receiving team sees the last movement
  console.log(section("Activity"));
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
  if (latest) console.log(`  ${c.primaryBold("Last touched")}  ${c.white(latest.date)}  ${c.darkGray(latest.label)}`);
  else console.log(c.darkGray("  no deliverable written yet"));

  // Workflows
  console.log(section("Workflows"));
  const missing = WORKFLOWS.filter((wf) => !existsSync(join(mission, "workflows", `${wf}.md`)));
  if (missing.length === 0) console.log(c.success("  ✓ ") + c.white(`all ${WORKFLOWS.length} workflows present`));
  else console.log(c.warning("  ! ") + c.white(`missing: ${missing.join(", ")} — run \`runward update\``));

  // Next — the transmission surface: name the next gesture, never leave the reader guessing
  console.log(section("Next"));
  if (report.steadyState) {
    // ADR-0033: the gated arc is crossed. Do not point back through it as if pending — name the iterate
    // posture, and name the evidence gate as re-runnable any time, not as the next milestone.
    console.log(`  This mission is in the ${c.white("iterate steady-state")}: advance it by locking ${c.white("one ADR per structural switch")}, on an objective reevaluation trigger.`);
    if (triggers.length > 0) console.log(`  ${triggers.length} decision(s) carry a reopening trigger — see ${c.primary("Reopening watch")} above.`);
    console.log(c.darkGray(`  The evidence gate stays re-runnable any time: ${c.primary("runward check --strict")}${c.darkGray(", ")}${c.primary("runward compliance <regime>")}${c.darkGray(".")}`));
  } else {
    const cur = report.phases[currentIndex];
    const open = cur.artifacts.filter((a) => a.state !== "filled").length;
    console.log(`  Fill the ${open} open deliverable(s) in ${c.white(cur.spec.label)}, then run ${c.primary("runward check")} to cross the gate on evidence.`);
  }
  console.log();
}
