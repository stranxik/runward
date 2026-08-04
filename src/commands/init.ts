import { join, resolve } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { checkbox, input, select } from "@inquirer/prompts";
import { existingSkillDirs, skillsForDir } from "../lib/tools.js";
import { TEMPLATES, EXAMPLE_MISSION, EXAMPLE_CODE, MISSION_LAYOUT, VERSION } from "../lib/paths.js";
import { TOOL_PROFILES, TOOL_IDS, baselineSkills } from "../lib/tools.js";
import { makeWriter } from "../lib/write.js";
import { hashText, renderScaffoldLock, SCAFFOLD_LOCK } from "../lib/scaffold-lock.js";
import { checkCommand } from "./check.js";
import { c, createHeader, isNonInteractive, section, status } from "../lib/styles.js";

interface InitOptions {
  path?: string;
  tools?: string;
  force?: boolean;
  example?: boolean;
}

type Writer = ReturnType<typeof makeWriter>;

/** Recursively copy a shipped directory tree (used to lay down the filled reference mission). */
const COPY_SKIP = new Set(["node_modules", "package-lock.json", ".DS_Store"]);
function copyTree(w: Writer, srcDir: string, destDir: string): void {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (COPY_SKIP.has(entry.name)) continue;
    const src = join(srcDir, entry.name);
    const dest = join(destDir, entry.name);
    if (entry.isDirectory()) copyTree(w, src, dest);
    else w.copy(src, dest);
  }
}

export async function initCommand(opts: InitOptions): Promise<void> {
  console.log(createHeader(`Runward v${VERSION}`, "After the spec: ship and run"));

  const yes = isNonInteractive();
  const example = opts.example ?? false;
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";

  // ── Gather answers (wizard, or defaults with --yes) ──────────────
  const dir = opts.path
    ?? (yes ? "." : await input({ message: "Project directory", default: "." }));

  // The idea seeds the framing note: you arrive with a project, not with paperwork.
  // In example mode the framing is already filled from the reference, so we skip it.
  const idea = (yes || example) ? "" : await input({
    message: "What are you building? (one line — it seeds your framing note)",
    default: "",
  });

  // Vendor-neutral by default (ADR-0030): with no explicit --tools, write only the neutral
  // baseline (AGENTS.md + .agents/skills). No harness is privileged — under --yes the profile
  // list is empty, and the wizard pre-checks nothing. A per-harness channel is an opt-in the
  // operator adds afterward (the agent may recommend one for the detected harness, on approval).
  const tools = opts.tools !== undefined
    ? opts.tools.split(",").map((s) => s.trim()).filter(Boolean)
    : yes
      ? []
      : await checkbox({
          message: "Tool profiles (optional — AGENTS.md + .agents/skills are always written)",
          choices: TOOL_PROFILES.map((t) => ({ value: t.id, name: t.label, checked: false })),
        });

  const entryMode = (yes || example) ? "greenfield" : await select({
    message: "Entry mode",
    choices: [
      { value: "greenfield", name: "Greenfield — new system, run the chain from the top" },
      { value: "brownfield", name: "Brownfield — existing system, characterize before touching" },
    ],
  });

  const tier = (yes || example) ? "floor" : await select({
    message: "Stopping tier (the sponsor's choice — can be revised)",
    choices: [
      { value: "framing", name: "Framing only" },
      { value: "floor", name: "Executable floor, proven on real traffic" },
      { value: "full chain", name: "Full chain through handover" },
    ],
  });

  const unknown = tools.filter((t) => !TOOL_IDS.includes(t));
  for (const t of unknown) console.log(status.warning(`Unknown tool profile "${t}" — supported: ${TOOL_IDS.join(", ")}`));

  // ── Write ─────────────────────────────────────────────────────────
  const root = resolve(process.cwd(), dir);
  const mission = join(root, "runward");
  const w = makeWriter({ force: opts.force ?? false, dryRun, root });

  console.log(section(example ? "Mission structure (filled reference)" : "Mission structure"));
  if (example) {
    // Lay down the filled request-triage reference: every gate is green out of the box.
    copyTree(w, EXAMPLE_MISSION, mission);
    // The manifests carry verified evidence pointers into code/ (ADR-0019): ship the reference
    // floor with them, so the gate is green because the evidence resolves — not unchecked.
    if (existsSync(EXAMPLE_CODE)) copyTree(w, EXAMPLE_CODE, join(root, "code"));
    // The reference ships its FINALIZED charter (ADR-0026): laid down first, so the scaffold
    // write below skips it — the example demonstrates the leave-behind, not the starting text.
    const exampleCharter = join(EXAMPLE_CODE, "..", "AGENTS.md");
    if (existsSync(exampleCharter)) w.copy(exampleCharter, join(root, "AGENTS.md"));
    // The reference omits the three non-gated scaffolding notes; add them as blank templates so the scaffold stays complete.
    for (const extra of ["reference-stack.md", "shared-bricks.md", "gap-analysis.md"]) {
      w.copy(join(TEMPLATES, "mission", extra), join(mission, extra));
    }
  } else {
    const prefill = (s: string) => {
      let out = s
        .replace("[greenfield | brownfield M1–M4]", entryMode)
        .replace("[framing | floor | full chain]", tier);
      if (idea) {
        out = out
          .replace("[system or mission name]", idea)
          .replace(
            "## 1. Problem\n",
            `## 1. Problem\n\n> Seed idea (from init): "${idea}" — now replace this with the process as actually observed.\n`,
          );
      }
      return out;
    };
    for (const [src, dest] of Object.entries(MISSION_LAYOUT)) {
      w.copy(join(TEMPLATES, "mission", src), join(mission, dest), src === "framing.md" ? prefill : undefined);
    }
  }

  console.log(section("Workflows"));
  for (const wf of readdirSync(join(TEMPLATES, "workflows"))) {
    w.copy(join(TEMPLATES, "workflows", wf), join(mission, "workflows", wf));
  }

  console.log(section("Craft rules"));
  const rules = readdirSync(join(TEMPLATES, "rules"));
  for (const r of rules) {
    w.copy(join(TEMPLATES, "rules", r), join(mission, "rules", r));
  }

  console.log(section("Gate adapters"));
  for (const a of readdirSync(join(TEMPLATES, "adapters"))) {
    w.copy(join(TEMPLATES, "adapters", a), join(mission, "adapters", a));
  }

  console.log(section("Agent charter"));
  w.copy(join(TEMPLATES, "targets", "AGENTS.md"), join(root, "AGENTS.md"));

  // Vendor-neutral phase skills (ADR-0018): the converged SKILL.md alias read by 14+ harnesses.
  console.log(section("Phase skills (.agents/skills — vendor-neutral, relevance-loaded)"));
  for (const f of baselineSkills(root)) w.write(f.path, f.content);

  for (const profile of TOOL_PROFILES.filter((p) => tools.includes(p.id))) {
    console.log(section(`Profile · ${profile.label}`));
    for (const f of profile.files(root)) w.write(f.path, f.content);
  }

  // Record what was scaffolded, so a later `update` can tell an UPSTREAM change from a local edit.
  // Without it, every release that touches a shipped rule reports "locally modified" on files the
  // operator never opened, and withholds the refresh behind --force.
  //
  // Written HERE, after the skills and the tool profiles, and not with the rules: the skill keys
  // are discovered on disk, so recording them before they exist silently recorded nothing. That
  // is how they escaped the lock in the first place.
  {
    const files: Record<string, string> = {};
    for (const dir of ["workflows", "rules", "adapters"] as const) {
      for (const f of readdirSync(join(TEMPLATES, dir))) {
        files[`${dir}/${f}`] = hashText(readFileSync(join(TEMPLATES, dir, f), "utf8"));
      }
    }
    for (const rel of existingSkillDirs(root)) {
      for (const f of skillsForDir(root, rel)) files[f.key] = hashText(f.content);
    }
    w.write(join(mission, SCAFFOLD_LOCK), renderScaffoldLock(VERSION, files));
  }

  // ── Summary ───────────────────────────────────────────────────────
  console.log(section("Done"));
  console.log(status.success(`${w.stats.written} file(s) ${dryRun ? "planned" : "written"}, ${w.stats.skipped} skipped`));
  if (example) {
    console.log(`
${c.primaryBold("Filled reference mission — the gate audit runs on it right below.")}
  1. See the deterministic guard refuse a fabricated value: ${c.primary("cd code && npm install && npm run demo")} ${c.gray("(req-005 carries an account reference the model invented — refused, fail-closed).")}
  2. Run ${c.primary("runward compliance iso-42001")} — an audit-ready evidence pack (OSCAL) derived from the traced decisions.
  3. Read ${c.white("runward/framing.md")}, the ADRs in ${c.white("runward/adr/")}, and ${c.white("runward/governance/threat-model.md")} to see how a real mission is traced end to end.

${c.gray("Start your own mission with")} ${c.primary("runward init")} ${c.gray("(without --example) to get blank templates.")}`);
    // One command, whole chain: the scaffold ends by auditing itself, so the first
    // contact with runward is the strict gate going green — not a promise to run it later.
    if (!dryRun) {
      console.log();
      await checkCommand({ path: dir, strict: true });
    }
  } else {
    console.log(`
${c.primaryBold("Next steps")}
  1. Fill ${c.white("runward/framing.md")} — do not architect before the framing gate passes.
  2. Point your agent at ${c.white("AGENTS.md")} and ${c.white("runward/workflows/method.md")}.
  3. Run ${c.primary("runward check")} anytime to see which gate you are at.
${entryMode === "brownfield" ? c.warning("\n  Brownfield entry: start with runward/workflows/brownfield.md — characterize before touching.\n") : ""}`);
  }
}
