import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildInventory, renderCharacterization, mineDrafts, renderDraft } from "../lib/characterize.js";
import { makeWriter } from "../lib/write.js";
import { c, createHeader, generationDate, section, status } from "../lib/styles.js";
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

  // Aiguillage (ADR-0033): a fact picks the mode, not instinct. If this repo already carries a governed
  // mission, characterize is the wrong first move — `runward status` (M1) reconstructs its real state and
  // names what to reopen. Nudge, never block: the read-only inventory still runs.
  if (existsSync(join(root, "runward", "framing.md"))) {
    console.log(section("Already a governed mission (M1)"));
    console.log("  " + status.info("This repo has a runward/ mission. To resume it — state and what to reopen — run ") + c.primary("runward status") + c.darkGray("."));
    console.log("  " + c.darkGray("Characterize is for an ungoverned codebase; continuing the read-only inventory anyway."));
  }

  console.log(section("Reading (read-only)"));
  const inv = buildInventory(root);
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  const generatedAt = generationDate();
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
      // Honest count: candidates whose DRAFT file already exists are left untouched (never clobber
      // an operator's edits), and said so — not folded into "proposed".
      const skippedNote = dw.stats.skipped > 0 ? ` (${dw.stats.skipped} already present, left untouched)` : "";
      console.log("  " + status.info(`${dw.stats.written} candidate decision(s) ${dryRun ? "planned" : "written"} as DRAFT hypotheses${skippedNote} — ratify each, or mark it \`Status: rejected\` (they are not decisions until you own them).`));
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
    console.log("     " + c.white("why") + " and a trigger, set " + c.white("Status: accepted") + " and rename to " + c.primary("ADR-NNNN-*.md") + c.darkGray(" — or set "));
    console.log("     " + c.white("Status: rejected") + c.darkGray(" and keep the file (deletion is not durable: the next --mine would re-propose it)."));
  } else {
    console.log("  " + c.white("2.") + " Run the " + c.primary("brownfield") + " workflow with your agent: reconstruct the architecture note and");
    console.log("     retroactive ADRs. Each is a " + c.warning("hypothesis") + " until you confirm its " + c.white("why") + " and set its trigger.");
  }
  console.log("  " + c.white("3.") + " Then " + c.primary("runward check --strict") + c.darkGray(" — the gate stays red until you ratify each reconstructed decision."));
  console.log();
}
