import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildInventory, renderCharacterization, mineDrafts, renderDraft } from "../lib/characterize.js";
import { makeWriter } from "../lib/write.js";
import { c, createHeader, isNonInteractive, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Characterize an existing codebase (ADR-0014) — read-only, deterministic, zero-LLM.
 * Emits runward/characterization.md: a factual inventory (dependencies, entrypoints,
 * CI, tests, git-log shape). It parses artifacts at rest; it never runs, builds,
 * installs, or writes to the target — only into runward/. The output is facts, not
 * decisions: reconstructing the *why* stays the operator's job (ADR-0013).
 * Exit codes: 0 = inventory produced, 2 = no readable target directory.
 */
export async function characterizeCommand(opts: { path?: string; mine?: boolean; force?: boolean }): Promise<void> {
  const root = resolve(process.cwd(), opts.path ?? ".");
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(status.error(`No readable directory at ${root}.`));
    process.exit(2);
  }

  console.log(createHeader(`Runward v${VERSION} — characterize`, root));

  console.log(section("Reading (read-only)"));
  const inv = buildInventory(root);
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  const generatedAt = isNonInteractive() && process.env.RUNWARD_NOW ? process.env.RUNWARD_NOW : new Date().toISOString().slice(0, 10);
  const md = renderCharacterization(inv, generatedAt);

  // Generated artifact, not mission state: always refresh it (idempotent).
  const w = makeWriter({ force: true, dryRun, root });
  w.write(join(root, "runward", "characterization.md"), md);

  // --mine: deterministic git archaeology → candidate DRAFT ADRs (no model call, ADR-0014).
  // force:false — never clobber a DRAFT the operator has started editing.
  if (opts.mine) {
    console.log(section("Candidate ADR-mining (--mine)"));
    const candidates = mineDrafts(root, inv);
    if (candidates.length === 0) {
      console.log("  " + status.skip("no candidate decision found in the evidence at rest."));
    } else {
      const dw = makeWriter({ force: false, dryRun, root });
      for (const cand of candidates) dw.write(join(root, "runward", "adr", `DRAFT-${cand.slug}.md`), renderDraft(cand, generatedAt));
      console.log("  " + status.info(`${candidates.length} candidate decision(s) proposed as DRAFT hypotheses — ratify or delete each (they are not decisions until you own them).`));
    }
  }

  console.log(section("Inventory"));
  console.log(`  ${c.primaryBold("Ecosystems")}   ${c.white(inv.ecosystems.map((e) => e.name.split(" ")[0]).join(", ") || "none")}`);
  console.log(`  ${c.primaryBold("Entrypoints")}  ${c.white(String(inv.entrypoints.length))}`);
  console.log(`  ${c.primaryBold("CI")}           ${c.white(String(inv.ci.length))}`);
  console.log(`  ${c.primaryBold("Tests")}        ${c.white(String(inv.tests.files))} file(s)`);
  console.log(`  ${c.primaryBold("Git")}          ${c.white(inv.git ? `${inv.git.commits} commit(s), ${inv.git.authors} author(s)` : "not a git repo")}`);

  console.log(section("Next steps"));
  console.log("  " + c.white("1.") + " Review " + c.primary("runward/characterization.md") + c.darkGray(" — facts (confidence: high), not decisions."));
  if (opts.mine) {
    console.log("  " + c.white("2.") + " Review the " + c.primary("runward/adr/DRAFT-*.md") + " candidates with your agent: for each, write the real");
    console.log("     " + c.white("why") + " and a trigger, set " + c.white("Status: accepted") + " and rename to " + c.primary("ADR-NNNN-*.md") + c.darkGray(", or delete it."));
  } else {
    console.log("  " + c.white("2.") + " Run the " + c.primary("brownfield") + " workflow with your agent: reconstruct the architecture note and");
    console.log("     retroactive ADRs. Each is a " + c.warning("hypothesis") + " until you confirm its " + c.white("why") + " and set its trigger.");
  }
  console.log("  " + c.white("3.") + " Then " + c.primary("runward check --strict") + c.darkGray(" — the gate stays red until you ratify each reconstructed decision."));
  console.log();
}
