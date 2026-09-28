import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { GATED_DELIVERABLES, parseManifest } from "../lib/conformance.js";
import { syncManifest } from "../lib/manifest-sync.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";
import { emitJson, humanLog, noMissionPayload } from "../lib/machine-output.js";

/**
 * Rule-conformance manifest plumbing (ADR-0023). Read-only overview by default;
 * --sync scaffolds the FORM (missing rows with empty status, renamed slugs migrated,
 * missing sections created) and never touches the content: no status set, no evidence
 * written, no row deleted. The decision stays the operator's.
 * `--json` (ADR-0030): the same overview as one document on stdout — every row of every gated
 * manifest with its status, what is missing, and with --sync what was appended; no prose.
 * Exit codes: 0 = done, 2 = no mission found.
 */
export async function manifestCommand(opts: { path?: string; sync?: boolean; json?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    if (opts.json) emitJson(noMissionPayload(VERSION));
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  const log = humanLog(opts.json);
  const deliverables: Array<Record<string, unknown>> = [];
  log(createHeader(`Runward v${VERSION} — manifest ${opts.sync ? "sync" : "overview"}`, root));

  let toFill = 0;
  for (const { phase, deliverable, label } of GATED_DELIVERABLES) {
    const r = syncManifest(mission, phase, deliverable, label);
    log(section(`${label} (runward/${deliverable})`));
    if (r.fileMissing) {
      deliverables.push({ deliverable: `runward/${deliverable}`, phase, label, fileMissing: true, rows: [], missing: [], added: [], migrated: [], removed: [], duplicates: [], unknown: [], sectionCreated: false, written: false });
      log("  " + c.darkGray("deliverable missing — `runward init` scaffolds it; sync only edits existing files"));
      continue;
    }
    if (r.migrated.length) for (const m of r.migrated) log(`  ${c.warning("◑")} renamed slug: ${c.white(`${m.from} → ${m.to}`)}${opts.sync ? c.darkGray(" — rewritten, status and evidence untouched") : c.darkGray(" — --sync rewrites it")}`);
    if (r.removed.length) for (const m of r.removed) log(`  ${c.warning("◑")} ${c.white(m.slug)}${c.darkGray(` — removed in ${m.since} (${m.reason}); delete the row yourself`)}`);
    if (r.duplicates.length) for (const d of r.duplicates) log(`  ${c.warning("◑")} duplicate: ${c.white(d)}`);
    if (r.unknown.length) for (const u of r.unknown) log(`  ${c.warning("◑")} unknown rule slug: ${c.white(u)}${c.darkGray(" — typo? not in runward/rules/; fix or remove the row yourself")}`);
    if (r.added.length) {
      toFill += r.added.length;
      const verb = opts.sync ? (r.sectionCreated ? "section created, rows scaffolded" : "rows scaffolded (empty status — the gate refuses them until you decide)") : "missing — --sync scaffolds the rows";
      log(`  ${opts.sync ? c.success("✓") : c.error("✗")} ${c.white(`${r.added.length} expected rule(s) not accounted for`)} ${c.darkGray("— " + verb)}`);
      for (const a of r.added) log(`     ${c.darkGray("·")} ${c.white(a)}`);
    }
    if (!r.migrated.length && !r.removed.length && !r.duplicates.length && !r.unknown.length && !r.added.length) {
      log("  " + status.success("table in sync with the mapped rule set"));
    }
    const writes = !!opts.sync && r.content !== null && !dryRun;
    if (opts.sync && r.content !== null) {
      if (dryRun) log("  " + c.info("dry-run — would rewrite ") + c.white(`runward/${deliverable}`));
      else writeFileSync(join(mission, deliverable), r.content!);
    }
    // The rows as the file now reads (after a --sync write), with their status and evidence.
    const rows = parseManifest(writes ? r.content! : readFileSync(join(mission, deliverable), "utf8"))
      .map((row) => ({ rule: row.rule, status: row.status, evidence: row.evidence }));
    deliverables.push({
      deliverable: `runward/${deliverable}`, phase, label, fileMissing: false, rows,
      missing: r.added, added: writes ? r.added : [],
      migrated: r.migrated, removed: r.removed, duplicates: r.duplicates, unknown: r.unknown,
      sectionCreated: writes && r.sectionCreated, written: writes,
    });
  }

  if (opts.json) {
    emitJson({ runward: VERSION, mission: root, sync: !!opts.sync, dryRun, missingRows: toFill, deliverables });
    return;
  }

  log(section("Next"));
  if (opts.sync && toFill > 0) {
    log(`  Fill each scaffolded row — a status (${c.primary("applied | deviated | n/a")}) and its evidence (${c.primary("file:PATH[:LINE][#SYMBOL]")}, ${c.primary("test:PATH[::NAME]")}, ${c.primary("adr:NNNN")} or prose) — then ${c.primary("runward check --strict")}.`);
  } else if (!opts.sync && toFill > 0) {
    log(`  Run ${c.primary("runward manifest --sync")} to scaffold the missing rows, then fill them and ${c.primary("runward check --strict")}.`);
  } else {
    log(`  Nothing to scaffold. ${c.primary("runward check --strict")} ${c.darkGray("verifies the decisions themselves.")}`);
  }
  log();
}
