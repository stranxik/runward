import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES, VERSION } from "../lib/paths.js";
import { findMissionRoot } from "../lib/mission.js";
import { makeWriter } from "../lib/write.js";
import { c, createHeader, section, status } from "../lib/styles.js";

/**
 * Refresh runward/workflows/ from the installed package version.
 * Never touches mission state (framing, architecture, ADRs, governance).
 * Local workflow edits are preserved unless --force.
 */
export async function updateCommand(opts: { path?: string; force?: boolean }): Promise<void> {
  const root = findMissionRoot(join(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found. Run `runward init` first."));
    process.exit(2);
  }
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  const dest = join(root, "runward", "workflows");
  console.log(createHeader(`Runward v${VERSION} — update workflows`, root));

  let same = 0, drifted = 0, added = 0;
  const w = makeWriter({ force: true, dryRun, root });

  console.log(section("Workflows"));
  for (const wf of readdirSync(join(TEMPLATES, "workflows"))) {
    const src = readFileSync(join(TEMPLATES, "workflows", wf), "utf8");
    const destPath = join(dest, wf);
    if (!existsSync(destPath)) {
      w.write(destPath, src);
      added++;
    } else if (readFileSync(destPath, "utf8") === src) {
      same++;
    } else if (opts.force) {
      w.write(destPath, src);
      drifted++;
    } else {
      drifted++;
      console.log(`  ${c.warning("drift")} ${c.white(`runward/workflows/${wf}`)} ${c.darkGray("(locally modified — --force to overwrite)")}`);
    }
  }

  console.log(section("Summary"));
  console.log(`  ${status.success(`${same} up to date`)}   ${added ? status.info(`${added} added`) + "   " : ""}${drifted ? status.warning(`${drifted} drifted${opts.force ? " (overwritten)" : ""}`) : ""}`);
  console.log(c.darkGray("\n  Mission state (framing, architecture, ADRs, governance) is never touched by update.\n"));
}
