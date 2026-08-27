import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { TEMPLATES, VERSION } from "../lib/paths.js";
import { findMissionRoot } from "../lib/mission.js";
import { makeWriter } from "../lib/write.js";
import { classify, hashText, readScaffoldLock, renderScaffoldLock, SCAFFOLD_LOCK } from "../lib/scaffold-lock.js";
import { corpusStamp } from "../lib/rules.js";
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
export async function updateCommand(opts: { path?: string; force?: boolean; corpus?: string }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found. Run `runward init` first."));
    process.exit(2);
  }

  // ADR-0057: --corpus vendors runward/rules/ from an ALREADY-VENDORED local directory (an org's
  // policy corpus), through the identical vendoring loop below. It takes a filesystem PATH and
  // NEVER a registry coordinate: the moment runward resolved "what @org/rules resolves to" it would
  // be a registry client — a wire by proxy (ADR-0054 crossing 1). The fetch is the operator's
  // install step, before and outside this command. Workflows and adapters still come from the
  // runward package: the corpus is the org's rules, not runward's harness.
  let corpusDir: string | null = null;
  if (opts.corpus !== undefined) {
    // The version suffix was the hole: `@acme/rules` matched and `@acme/rules@1.2.3` did not, because
    // `[\w.-]+` stops at the second `@`. So the spelling an operator ACTUALLY types — the one with a
    // version, the one npm prints — fell through to the generic "path not found", and the sentence
    // that explains the boundary was shown only to someone who had already dropped the version.
    // Measured 2026-08-26. A range spelling (`^1.2`, `~1.2`, `>=1`) lands here too.
    if (/^@?[\w.-]+\/[\w.-]+(@[\w.^~><=*|\s-]+)?$/.test(opts.corpus) && !existsSync(resolve(process.cwd(), opts.corpus))) {
      console.error(status.error(`--corpus takes a filesystem path, not a registry coordinate like "${opts.corpus}". Vendor the corpus first (your install step, outside runward), then point --corpus at the resulting directory. runward resolves no package specifiers.`));
      process.exit(2);
    }
    corpusDir = resolve(process.cwd(), opts.corpus);
    if (!existsSync(corpusDir) || !statSync(corpusDir).isDirectory()) {
      console.error(status.error(`--corpus path not found or not a directory: ${corpusDir}. It must be an already-vendored corpus directory of *.md rules (plus optional corpus.json, migrations.json).`));
      process.exit(2);
    }
    if (!readdirSync(corpusDir).some((f) => f.endsWith(".md"))) {
      console.error(status.error(`--corpus directory holds no *.md rules: ${corpusDir}. Nothing to vendor.`));
      process.exit(2);
    }
  }

  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  console.log(createHeader(`Runward v${VERSION} — update workflows & rules`, root));
  if (corpusDir) console.log(c.darkGray(`  Vendoring rules from ${corpusDir} (org corpus). Workflows and adapters still come from the runward package.`));

  const mission = join(root, "runward");
  const lock = readScaffoldLock(mission);
  const recorded = lock?.files ?? {};
  const nextFiles: Record<string, string> = {};

  let same = 0, refreshed = 0, added = 0, local = 0, unknown = 0;
  let replaced = 0;
  const w = makeWriter({ force: true, dryRun, root });

  const LABELS = { workflows: "Workflows", rules: "Craft rules", adapters: "Gate adapters" } as const;
  for (const dir of ["workflows", "rules", "adapters"] as const) {
    console.log(section(LABELS[dir]));
    const dest = join(root, "runward", dir);
    // ADR-0057: only the RULES source is redirected to the vendored org corpus; workflows and
    // adapters remain runward's own. readdirSync of the corpus dir naturally carries corpus.json and
    // migrations.json alongside the *.md — all vendored and recorded, so the pin travels with them.
    const srcDir = dir === "rules" && corpusDir ? corpusDir : join(TEMPLATES, dir);
    for (const file of readdirSync(srcDir)) {
      const src = readFileSync(join(srcDir, file), "utf8");
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
        // Pristine since runward last wrote it, and the source moved: exactly the change `update`
        // exists to deliver. No --force needed, and none should be.
        //
        // WITH --corpus THE SOURCE IS NOT RUNWARD, and calling it "changed upstream" was false in a
        // way that mattered. Measured 2026-08-26: vendoring a fork of runward's own corpus with one
        // `signature:` line deleted takes a mission from `check --strict` exit 1 to exit 0, and the
        // only word the operator sees is the one runward uses for its own refreshes. Recording the
        // org's bytes as the reference is right — a later edit to them must still be caught — but
        // SUBSTITUTING a rule runward ships is a different event from an upstream refresh, and it
        // is the one a reviewer needs to see.
        const shadowsPackaged = dir === "rules" && corpusDir !== null
          && existsSync(join(TEMPLATES, "rules", file))
          && readFileSync(join(TEMPLATES, "rules", file), "utf8") !== src;
        w.write(destPath, src); nextFiles[key] = hashText(src);
        if (shadowsPackaged) {
          replaced++;
          console.log(`  ${c.warning("replaced")} ${c.white(`runward/${key}`)} ${c.darkGray("(the org corpus carries its own version of a rule runward ships)")}`);
        } else {
          refreshed++;
          console.log(`  ${c.primary("updated")} ${c.white(`runward/${key}`)} ${c.darkGray(corpusDir ? "(changed in the org corpus)" : "(changed upstream)")}`);
        }
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

  // A RULE THE VENDORING DID NOT MENTION IS STILL ON DISK, so its record survives.
  //
  // `nextFiles` is built from `readdirSync(srcDir)`, and with --corpus that source is the org's
  // directory. Every rule runward wrote and the corpus does not carry therefore fell out of the
  // lock while its FILE stayed exactly where it was; `scaffold-lock.ts` derives "known" from the
  // lock, so each one became `extra`. Measured 2026-08-26 on the shipped binary: vendoring a
  // one-rule house corpus onto a green example mission dropped the lock from 64 entries to 1 and
  // made `check --strict` refuse 31 rules runward had scaffolded thirty seconds earlier, accusing
  // the operator of authoring them, while `update` reported success. The documented ADR-0057
  // gesture bricked the gate of a green mission in one command.
  //
  // The lock's job is to record what runward wrote so a LATER edit is attributable. A file nobody
  // touched has not stopped being attributable because a different directory was vendored beside
  // it. The record is therefore carried forward, and the rules the corpus does not manage are
  // NAMED rather than silently kept: the operator may want to delete them, and that is their
  // gesture to make, not update's.
  if (corpusDir) {
    const rulesDir = join(root, "runward", "rules");
    const orphaned: string[] = [];
    for (const file of existsSync(rulesDir) ? readdirSync(rulesDir) : []) {
      const key = `rules/${file}`;
      if (nextFiles[key] !== undefined) continue;
      if (recorded[key] === undefined) continue;   // never runward's to begin with
      nextFiles[key] = recorded[key];
      if (file.endsWith(".md")) orphaned.push(file);
    }
    if (orphaned.length) {
      console.log(c.darkGray(`\n  ${orphaned.length} rule(s) runward wrote are absent from this corpus and were left in place, still recorded:`));
      console.log(c.darkGray(`  ${orphaned.slice(0, 6).join(", ")}${orphaned.length > 6 ? `, and ${orphaned.length - 6} more` : ""}`));
      console.log(c.darkGray("  They keep gating this mission. Delete the ones your corpus supersedes, then re-run runward check."));
    }
  }

  // Record what is now on disk, so the next update can tell upstream from local. Deterministic
  // and sorted; re-running on an unchanged scaffold rewrites the same bytes.
  // ADR-0057: when vendoring an org corpus, record its self-described pin from the source's
  // corpus.json; on an ordinary update, PRESERVE any pin already recorded (never silently wiped).
  const corpusPin = corpusDir ? corpusStamp(corpusDir) : (lock?.corpus ?? null);
  if (!dryRun) w.write(join(mission, SCAFFOLD_LOCK), renderScaffoldLock(VERSION, nextFiles, corpusPin));

  console.log(section("Summary"));
  const parts = [status.success(`${same} up to date`)];
  if (added) parts.push(status.info(`${added} added`));
  if (refreshed) parts.push(status.info(`${refreshed} refreshed`));
  if (replaced) parts.push(status.warning(`${replaced} replaced by the org corpus`));
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
