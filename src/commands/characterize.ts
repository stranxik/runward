import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildInventory, renderCharacterization, mineDrafts, renderDraft } from "../lib/characterize.js";
import { makeWriter } from "../lib/write.js";
import { c, createHeader, generationDate, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Characterize an existing codebase (ADR-0014) — deterministic, zero-LLM, and it never modifies
 * the code it reads. It DOES write, into runward/ only, and says so: runward/characterization.md: a factual inventory (dependencies, entrypoints,
 * CI, tests, git-log shape). It parses artifacts at rest; it never runs, builds,
 * installs, or writes to the target — only into runward/. The output is facts, not
 * decisions: reconstructing the *why* stays the operator's job (ADR-0013).
 * Exit codes: 0 = inventory produced, 2 = no readable target directory, or --mine refused on an
 * already-governed mission (nothing written).
 */
export async function characterizeCommand(opts: { path?: string; mine?: boolean; force?: boolean }): Promise<void> {
  const root = resolve(process.cwd(), opts.path ?? ".");
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(status.error(`No readable directory at ${root}.`));
    process.exit(2);
  }

  const governed = existsSync(join(root, "runward", "framing.md"));
  // RWD-2026-0141: on a governed mission every DRAFT the miner writes is a strict-gate refusal
  // (check refuses a DRAFT until it is accepted or rejected). A green mission turned red by a
  // command the operator — or an agent under the armed hook — ran to LOOK is a write they did not
  // choose, so --mine there needs the explicit --force, and the refusal comes before any write.
  // A --dry-run writes nothing, so it may still show what --mine would propose.
  if (governed && opts.mine && !opts.force && process.env.RUNWARD_DRY_RUN !== "1") {
    console.error(status.error("This repo already has a runward/ mission. --mine would add DRAFT ADRs to runward/adr/, and check --strict refuses every DRAFT until it is set to accepted or rejected."));
    console.error("  " + c.darkGray("Nothing was written. Re-run with --mine --force to write them anyway (on a branch is safer), or run ") + c.primary("runward status") + c.darkGray(" to resume the mission."));
    process.exit(2);
  }

  console.log(createHeader(`Runward v${VERSION} — characterize`, root));

  // Aiguillage (ADR-0033): a fact picks the mode, not instinct. If this repo already carries a governed
  // mission, characterize is the wrong first move — `runward status` (M1) reconstructs its real state and
  // names what to reopen. Nudge, never block: the read-only inventory still runs.
  if (governed) {
    console.log(section("Already a governed mission (M1)"));
    console.log("  " + status.info("This repo has a runward/ mission. To resume it — state and what to reopen — run ") + c.primary("runward status") + c.darkGray("."));
    console.log("  " + c.darkGray("Characterize is for an ungoverned codebase; continuing the inventory anyway (it rewrites runward/characterization.md)."));
    if (opts.mine && !opts.force) console.log("  " + status.warning("Dry run only: a real --mine here is refused without --force (each DRAFT keeps check --strict red)."));
  }

  // It reads the code without changing it, and writes into runward/: the heading says both, because
  // "read-only" followed by `write` lines is what an agent allowed only read-only commands trusts.
  console.log(section("Reading your code (never modified; writes into runward/)"));
  const inv = buildInventory(root);
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  const generatedAt = generationDate();
  const md = renderCharacterization(inv, generatedAt);

  // Generated artifact, not mission state: always refresh it (idempotent).
  const w = makeWriter({ force: true, dryRun, root });
  w.write(join(root, "runward", "characterization.md"), md);

  // --mine: deterministic git archaeology → candidate DRAFT ADRs (no model call, ADR-0014).
  // force:false — never clobber a DRAFT the operator has started editing.
  let drafts = 0;
  if (opts.mine) {
    console.log(section("Candidate ADR-mining (--mine)"));
    const candidates = mineDrafts(root, inv);
    drafts = candidates.length;
    if (candidates.length === 0) {
      console.log("  " + status.skip("no candidate decision found in the evidence at rest."));
    } else {
      const dw = makeWriter({ force: false, dryRun, root });
      for (const cand of candidates) dw.write(join(root, "runward", "adr", `DRAFT-${cand.slug}.md`), renderDraft(cand, generatedAt));
      // Honest count: candidates whose DRAFT file already exists are left untouched (never clobber
      // an operator's edits), and said so — not folded into "proposed".
      const skippedNote = dw.stats.skipped > 0 ? ` (${dw.stats.skipped} already present, left untouched)` : "";
      console.log("  " + status.info(`${dw.stats.written} candidate decision(s) ${dryRun ? "planned" : "written"} as DRAFT hypotheses${skippedNote} — set each to \`Status: accepted\` or \`Status: rejected\` (they are not decisions until you own them).`));
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
  // The next steps follow what was actually mined: no candidate, no DRAFT to review.
  if (opts.mine && drafts > 0) {
    console.log("  " + c.white("2.") + " Review the " + c.primary("runward/adr/DRAFT-*.md") + " candidates with your agent: for each, write the real");
    console.log("     " + c.white("why") + " and a trigger, set " + c.white("Status: accepted") + " and rename to " + c.primary("ADR-NNNN-*.md") + c.darkGray(" — or set "));
    console.log("     " + c.white("Status: rejected") + c.darkGray(" and keep the file (deletion is not durable: the next --mine would re-propose it)."));
  } else {
    console.log("  " + c.white("2.") + " Run the " + c.primary("brownfield") + " workflow with your agent: reconstruct the architecture note and");
    console.log("     retroactive ADRs. Each is a " + c.warning("hypothesis") + " until you confirm its " + c.white("why") + " and set its trigger.");
  }
  console.log("  " + c.white("3.") + " Then " + c.primary("runward check --strict") + c.darkGray(opts.mine && drafts > 0
    ? " — each DRAFT keeps the gate red until you set it to accepted or rejected."
    : " — each reconstructed decision is a hypothesis until you accept it."));
  console.log();
}
