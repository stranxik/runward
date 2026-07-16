import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { GATED_DELIVERABLES } from "../lib/conformance.js";
import { syncManifest } from "../lib/manifest-sync.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Rule-conformance manifest plumbing (ADR-0023). Read-only overview by default;
 * --sync scaffolds the FORM (missing rows with empty status, renamed slugs migrated,
 * missing sections created) and never touches the content: no status set, no evidence
 * written, no row deleted. The decision stays the operator's.
 * Exit codes: 0 = done, 2 = no mission found.
 */
export async function manifestCommand(opts: { path?: string; sync?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  console.log(createHeader(`Runward v${VERSION} — manifest ${opts.sync ? "sync" : "overview"}`, root));

  let toFill = 0;
  for (const { phase, deliverable, label } of GATED_DELIVERABLES) {
    const r = syncManifest(mission, phase, deliverable, label);
    console.log(section(`${label} (runward/${deliverable})`));
    if (r.fileMissing) { console.log("  " + c.darkGray("deliverable missing — `runward init` scaffolds it; sync only edits existing files")); continue; }
    if (r.migrated.length) for (const m of r.migrated) console.log(`  ${c.warning("◑")} renamed slug: ${c.white(`${m.from} → ${m.to}`)}${opts.sync ? c.darkGray(" — rewritten, status and evidence untouched") : c.darkGray(" — --sync rewrites it")}`);
    if (r.removed.length) for (const m of r.removed) console.log(`  ${c.warning("◑")} ${c.white(m.slug)}${c.darkGray(` — removed in ${m.since} (${m.reason}); delete the row yourself`)}`);
    if (r.duplicates.length) for (const d of r.duplicates) console.log(`  ${c.warning("◑")} duplicate: ${c.white(d)}`);
    if (r.unknown.length) for (const u of r.unknown) console.log(`  ${c.warning("◑")} unknown rule slug: ${c.white(u)}${c.darkGray(" — typo? not in runward/rules/; fix or remove the row yourself")}`);
    if (r.added.length) {
      toFill += r.added.length;
      const verb = opts.sync ? (r.sectionCreated ? "section created, rows scaffolded" : "rows scaffolded (empty status — the gate refuses them until you decide)") : "missing — --sync scaffolds the rows";
      console.log(`  ${opts.sync ? c.success("✓") : c.error("✗")} ${c.white(`${r.added.length} expected rule(s) not accounted for`)} ${c.darkGray("— " + verb)}`);
      for (const a of r.added) console.log(`     ${c.darkGray("·")} ${c.white(a)}`);
    }
    if (!r.migrated.length && !r.removed.length && !r.duplicates.length && !r.unknown.length && !r.added.length) {
      console.log("  " + status.success("table in sync with the mapped rule set"));
    }
    if (opts.sync && r.content !== null) {
      if (dryRun) console.log("  " + c.info("dry-run — would rewrite ") + c.white(`runward/${deliverable}`));
      else writeFileSync(join(mission, deliverable), r.content);
    }
  }

  console.log(section("Next"));
  if (opts.sync && toFill > 0) {
    console.log(`  Fill each scaffolded row — a status (${c.primary("applied | deviated | n/a")}) and its evidence (${c.primary("file:PATH[:LINE][#SYMBOL]")}, ${c.primary("test:PATH[::NAME]")}, ${c.primary("adr:NNNN")} or prose) — then ${c.primary("runward check --strict")}.`);
  } else if (!opts.sync && toFill > 0) {
    console.log(`  Run ${c.primary("runward manifest --sync")} to scaffold the missing rows, then fill them and ${c.primary("runward check --strict")}.`);
  } else {
    console.log(`  Nothing to scaffold. ${c.primary("runward check --strict")} ${c.darkGray("verifies the decisions themselves.")}`);
  }
  console.log();
}
