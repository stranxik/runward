import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { TEMPLATES, VERSION } from "../lib/paths.js";
import { findMissionRoot } from "../lib/mission.js";
import { makeWriter } from "../lib/write.js";
import { classify, hashText, readScaffoldLock, renderScaffoldLock, SCAFFOLD_LOCK } from "../lib/scaffold-lock.js";
import { existingSkillDirs, skillsForDir } from "../lib/tools.js";
import { c, createHeader, section, status } from "../lib/styles.js";

/**
 * Refresh runward/workflows/, rules/ and adapters/ from the installed package.
 * Never touches mission state (framing, architecture, ADRs, governance).
 *
 * An UPSTREAM change is not a local edit. Before the scaffold lock, `update` compared the
 * mission's copy to the current template and called every difference "locally modified" — so any
 * release that changed a shipped rule told operators they had edited files they never touched,
 * and withheld the refresh behind `--force`. A mission following the instruction not to edit its
 * rules copy never received the change. The lock records what runward wrote, which is what makes
 * the two distinguishable; where there is no record, `update` says it cannot tell rather than
 * assigning blame.
 */
export async function updateCommand(opts: { path?: string; force?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found. Run `runward init` first."));
    process.exit(2);
  }
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  console.log(createHeader(`Runward v${VERSION} — update workflows & rules`, root));

  const mission = join(root, "runward");
  const lock = readScaffoldLock(mission);
  const recorded = lock?.files ?? {};
  const nextFiles: Record<string, string> = {};

  let same = 0, refreshed = 0, added = 0, local = 0, unknown = 0;
  const w = makeWriter({ force: true, dryRun, root });

  const LABELS = { workflows: "Workflows", rules: "Craft rules", adapters: "Gate adapters" } as const;
  for (const dir of ["workflows", "rules", "adapters"] as const) {
    console.log(section(LABELS[dir]));
    const dest = join(root, "runward", dir);
    for (const file of readdirSync(join(TEMPLATES, dir))) {
      const src = readFileSync(join(TEMPLATES, dir, file), "utf8");
      const destPath = join(dest, file);
      const key = `${dir}/${file}`;
      const exists = existsSync(destPath);
      const destText = exists ? readFileSync(destPath, "utf8") : null;
      const verdict = classify(exists, destText, src, recorded[key]);

      if (verdict === "added") {
        w.write(destPath, src); added++; nextFiles[key] = hashText(src);
      } else if (verdict === "same") {
        same++; nextFiles[key] = hashText(src);
      } else if (verdict === "upstream") {
        // Pristine since runward last wrote it, and the template moved: this is exactly the
        // change `update` exists to deliver. No --force needed, and none should be.
        w.write(destPath, src); refreshed++; nextFiles[key] = hashText(src);
        console.log(`  ${c.primary("updated")} ${c.white(`runward/${key}`)} ${c.darkGray("(changed upstream)")}`);
      } else if (opts.force) {
        w.write(destPath, src); refreshed++; nextFiles[key] = hashText(src);
        console.log(`  ${c.warning("overwritten")} ${c.white(`runward/${key}`)} ${c.darkGray(verdict === "local" ? "(your edit replaced)" : "(unattributable difference replaced)")}`);
      } else if (verdict === "local") {
        local++; nextFiles[key] = recorded[key];
        console.log(`  ${c.warning("kept")} ${c.white(`runward/${key}`)} ${c.darkGray("(you edited it — --force to take the package version)")}`);
      } else {
        unknown++;
        console.log(`  ${c.warning("kept")} ${c.white(`runward/${key}`)} ${c.darkGray("(differs from the package, and runward cannot tell whether you edited it or it changed upstream — no record for this file)")}`);
      }
    }
  }

  // Harness phase skills (.agents/skills, and any tool profile's copy). These are WHOLLY generated
  // from PHASE_SKILLS: an operator has no field to personalise, so leaving them frozen at the
  // version that ran `init` was a classification mistake, not the deliberate boundary that keeps
  // `update` off AGENTS.md (ADR-0010, a deliverable the operator owns). A field report found them
  // 17 releases behind — the skill still described evidence in prose, so a whole mission wrote 24
  // untyped rows the gate could not verify. Refreshed where they ALREADY live, on disk, never in
  // a new home: `update` reads the mission repo, it does not decide the harness layout.
  const skillDirs = existingSkillDirs(root);
  if (skillDirs.length) {
    console.log(section("Phase skills"));
    for (const rel of skillDirs) {
      for (const f of skillsForDir(root, rel)) {
        const exists = existsSync(f.path);
        const destText = exists ? readFileSync(f.path, "utf8") : null;
        const verdict = classify(exists, destText, f.content, recorded[f.key]);
        if (verdict === "added") {
          w.write(f.path, f.content); added++; nextFiles[f.key] = hashText(f.content);
          console.log(`  ${c.success("added")} ${c.white(f.key)}`);
        } else if (verdict === "same") {
          same++; nextFiles[f.key] = hashText(f.content);
        } else if (verdict === "upstream" || opts.force) {
          w.write(f.path, f.content); refreshed++; nextFiles[f.key] = hashText(f.content);
          console.log(`  ${c.success("refreshed")} ${c.white(f.key)} ${c.darkGray(verdict === "upstream" ? "(changed upstream)" : "(overwritten)")}`);
        } else if (verdict === "local") {
          local++; nextFiles[f.key] = recorded[f.key];
          console.log(`  ${c.warning("kept")} ${c.white(f.key)} ${c.darkGray("(you edited it — --force to take the package version)")}`);
        } else {
          // No record: this mission predates skill tracking. The file is generated and carries no
          // operator field, so refreshing it cannot destroy anyone's work — and leaving it stale is
          // exactly the failure this block exists to end.
          w.write(f.path, f.content); refreshed++; nextFiles[f.key] = hashText(f.content);
          console.log(`  ${c.success("refreshed")} ${c.white(f.key)} ${c.darkGray("(no record — generated file, refreshed)")}`);
        }
      }
    }
  }

  // Record what is now on disk, so the next update can tell upstream from local. Deterministic
  // and sorted; re-running on an unchanged scaffold rewrites the same bytes.
  if (!dryRun) w.write(join(mission, SCAFFOLD_LOCK), renderScaffoldLock(VERSION, nextFiles));

  console.log(section("Summary"));
  const parts = [status.success(`${same} up to date`)];
  if (added) parts.push(status.info(`${added} added`));
  if (refreshed) parts.push(status.info(`${refreshed} refreshed`));
  if (local) parts.push(status.warning(`${local} kept (your edits)`));
  if (unknown) parts.push(status.warning(`${unknown} kept (unattributable)`));
  console.log("  " + parts.join("   "));
  if (unknown) {
    console.log(c.darkGray(`\n  This mission predates ${SCAFFOLD_LOCK}, so differences could not be attributed. From now on they can:`));
    console.log(c.darkGray(`  review the diffs, then re-run with --force to take the package version where you had not edited.`));
  }
  console.log(c.darkGray("\n  Mission state (framing, architecture, ADRs, governance) is never touched by update."));

  // Transmission surface: name the next gesture.
  console.log(section("Next"));
  console.log(`  Re-run ${c.primary("runward check")} to re-verify the gate against the refreshed rules and workflows.`);
  console.log();
}
