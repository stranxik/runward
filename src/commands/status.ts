import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyze, findMissionRoot } from "../lib/mission.js";
import { c, createHeader, section } from "../lib/styles.js";
import { VERSION, WORKFLOWS } from "../lib/paths.js";

/** Mission snapshot: phase progress, decision journal, activity, workflows —
 *  a transmission-ready "where the mission stands", read-only from the mission files. */
export async function statusCommand(opts: { path?: string }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(c.error("✗ ") + "No runward/ mission found. Run `runward init` first.");
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
  console.log(`  ${c.primaryBold("Current gate")}  ${c.white(report.currentPhase)}`);

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

  // Decision journal — the ADRs, dated
  console.log(section("Decision journal"));
  const adrDir = join(mission, "adr");
  const adrs = existsSync(adrDir)
    ? readdirSync(adrDir).filter((f) => /^ADR-\d+/.test(f) && !f.includes("0000")).sort()
    : [];
  if (adrs.length === 0) {
    console.log(c.darkGray("  no ADR yet — every structural decision must be locked"));
  } else {
    for (const f of adrs.slice(-5)) {
      // Date the ADR from its own `**Date**:` line; fall back to file mtime.
      const dateLine = readFileSync(join(adrDir, f), "utf8").match(/^\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/m);
      const date = dateLine ? dateLine[1] : statSync(join(adrDir, f)).mtime.toISOString().slice(0, 10);
      console.log(`  ${c.primary("•")} ${c.white(f)} ${c.darkGray(date)}`);
    }
    if (adrs.length > 5) console.log(c.darkGray(`  … and ${adrs.length - 5} more`));
    console.log(c.darkGray(`  ${adrs.length} decision(s) traced`));
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
  if (currentIndex === -1) {
    console.log(`  All gated deliverables are filled. Run ${c.primary("runward check --strict")} to confirm on evidence, then ${c.primary("runward compliance <regime>")} for the evidence pack.`);
  } else {
    const cur = report.phases[currentIndex];
    const open = cur.artifacts.filter((a) => a.state !== "filled").length;
    console.log(`  Fill the ${open} open deliverable(s) in ${c.white(cur.spec.label)}, then run ${c.primary("runward check")} to cross the gate on evidence.`);
  }
  console.log();
}
