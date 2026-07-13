import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { TEMPLATES, VERSION } from "../lib/paths.js";
import { findMissionRoot } from "../lib/mission.js";
import { makeWriter } from "../lib/write.js";
import { c, createHeader, section, status } from "../lib/styles.js";

/**
 * Refresh runward/workflows/ and runward/rules/ from the installed package.
 * Never touches mission state (framing, architecture, ADRs, governance).
 * Local edits are preserved unless --force.
 */
export async function updateCommand(opts: { path?: string; force?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found. Run `runward init` first."));
    process.exit(2);
  }
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  console.log(createHeader(`Runward v${VERSION} — update workflows & rules`, root));

  let same = 0, drifted = 0, added = 0;
  const w = makeWriter({ force: true, dryRun, root });

  const LABELS = { workflows: "Workflows", rules: "Craft rules", adapters: "Gate adapters" } as const;
  for (const dir of ["workflows", "rules", "adapters"] as const) {
    console.log(section(LABELS[dir]));
    const dest = join(root, "runward", dir);
    for (const file of readdirSync(join(TEMPLATES, dir))) {
      const src = readFileSync(join(TEMPLATES, dir, file), "utf8");
      const destPath = join(dest, file);
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
        console.log(`  ${c.warning("drift")} ${c.white(`runward/${dir}/${file}`)} ${c.darkGray("(locally modified — --force to overwrite)")}`);
      }
    }
  }

  console.log(section("Summary"));
  console.log(`  ${status.success(`${same} up to date`)}   ${added ? status.info(`${added} added`) + "   " : ""}${drifted ? status.warning(`${drifted} drifted${opts.force ? " (overwritten)" : ""}`) : ""}`);
  console.log(c.darkGray("\n  Mission state (framing, architecture, ADRs, governance) is never touched by update."));

  // Transmission surface: name the next gesture.
  console.log(section("Next"));
  console.log(`  Re-run ${c.primary("runward check")} to re-verify the gate against the refreshed rules and workflows.`);
  console.log();
}
