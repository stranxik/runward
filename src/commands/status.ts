import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyze, findMissionRoot } from "../lib/mission.js";
import { c, createHeader, section } from "../lib/styles.js";
import { VERSION, WORKFLOWS } from "../lib/paths.js";

/** Mission snapshot: phase, ADR journal, framing summary, workflow presence. */
export async function statusCommand(opts: { path?: string }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(c.error("✗ ") + "No runward/ mission found. Run `runward init` first.");
    process.exit(2);
  }
  const mission = join(root, "runward");
  const report = analyze(mission);

  console.log(createHeader(`Runward v${VERSION} — mission status`, root));

  // Framing summary: first line of Problem + success criterion heading state
  console.log(section("Mission"));
  const framingPath = join(mission, "framing.md");
  if (existsSync(framingPath)) {
    const title = readFileSync(framingPath, "utf8").split("\n")[0]?.replace(/^#\s*/, "") ?? "";
    console.log(`  ${c.white(title)}`);
  }
  console.log(`  ${c.primaryBold("Current gate")}  ${c.white(report.currentPhase)}`);

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
  }

  console.log(section("Workflows"));
  const missing = WORKFLOWS.filter((wf) => !existsSync(join(mission, "workflows", `${wf}.md`)));
  if (missing.length === 0) console.log(c.success("  ✓ ") + c.white(`all ${WORKFLOWS.length} workflows present`));
  else console.log(c.warning("  ! ") + c.white(`missing: ${missing.join(", ")} — run \`runward update\``));
  console.log();
}
