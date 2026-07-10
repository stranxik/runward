import { join, resolve } from "node:path";
import { readdirSync } from "node:fs";
import { checkbox, input, select } from "@inquirer/prompts";
import { TEMPLATES, MISSION_LAYOUT, VERSION } from "../lib/paths.js";
import { TOOL_PROFILES, TOOL_IDS } from "../lib/tools.js";
import { makeWriter } from "../lib/write.js";
import { c, createHeader, isNonInteractive, section, status } from "../lib/styles.js";

interface InitOptions {
  path?: string;
  tools?: string;
  force?: boolean;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  console.log(createHeader(`Runward v${VERSION}`, "After the spec: ship and run"));

  const yes = isNonInteractive();
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";

  // ── Gather answers (wizard, or defaults with --yes) ──────────────
  const dir = opts.path
    ?? (yes ? "." : await input({ message: "Project directory", default: "." }));

  // The idea seeds the framing note: you arrive with a project, not with paperwork.
  const idea = yes ? "" : await input({
    message: "What are you building? (one line — it seeds your framing note)",
    default: "",
  });

  const tools = opts.tools !== undefined
    ? opts.tools.split(",").map((s) => s.trim()).filter(Boolean)
    : yes
      ? ["claude"]
      : await checkbox({
          message: "Tool profiles (AGENTS.md is always written)",
          choices: TOOL_PROFILES.map((t) => ({ value: t.id, name: t.label, checked: t.id === "claude" })),
        });

  const entryMode = yes ? "greenfield" : await select({
    message: "Entry mode",
    choices: [
      { value: "greenfield", name: "Greenfield — new system, run the chain from the top" },
      { value: "brownfield", name: "Brownfield — existing system, characterize before touching" },
    ],
  });

  const tier = yes ? "floor" : await select({
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

  console.log(section("Mission structure"));
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

  for (const profile of TOOL_PROFILES.filter((p) => tools.includes(p.id))) {
    console.log(section(`Profile · ${profile.label}`));
    for (const f of profile.files(root)) w.write(f.path, f.content);
  }

  // ── Summary ───────────────────────────────────────────────────────
  console.log(section("Done"));
  console.log(status.success(`${w.stats.written} file(s) ${dryRun ? "planned" : "written"}, ${w.stats.skipped} skipped`));
  console.log(`
${c.primaryBold("Next steps")}
  1. Fill ${c.white("runward/framing.md")} — do not architect before the framing gate passes.
  2. Point your agent at ${c.white("AGENTS.md")} and ${c.white("runward/workflows/method.md")}.
  3. Run ${c.primary("runward check")} anytime to see which gate you are at.
${entryMode === "brownfield" ? c.warning("\n  Brownfield entry: start with runward/workflows/brownfield.md — characterize before touching.\n") : ""}`);
}
