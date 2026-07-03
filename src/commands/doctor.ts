import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES, MISSION_LAYOUT, VERSION, WORKFLOWS } from "../lib/paths.js";
import { findMissionRoot } from "../lib/mission.js";
import { c, createHeader, section, status } from "../lib/styles.js";

/**
 * Environment and installation checks.
 * Exit codes: 0 = all good, 1 = warnings, 2 = critical failure.
 */
export async function doctorCommand(): Promise<void> {
  console.log(createHeader(`Runward v${VERSION} — doctor`));
  let warnings = 0;
  let critical = 0;

  const ok = (msg: string) => console.log("  " + status.success(msg));
  const warn = (msg: string) => { warnings++; console.log("  " + status.warning(msg)); };
  const fail = (msg: string) => { critical++; console.log("  " + status.error(msg)); };

  console.log(section("Environment"));
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  nodeMajor >= 20 ? ok(`node ${process.versions.node}`) : fail(`node ${process.versions.node} — v20+ required`);
  try {
    const git = execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
    ok(git);
  } catch {
    warn("git not found — the method assumes versioned mission artifacts");
  }

  console.log(section("Package integrity"));
  const missingTpl = Object.keys(MISSION_LAYOUT).filter((k) => !existsSync(join(TEMPLATES, "mission", k)));
  missingTpl.length === 0 ? ok(`${Object.keys(MISSION_LAYOUT).length} mission templates`) : fail(`missing templates: ${missingTpl.join(", ")}`);
  const missingWf = WORKFLOWS.filter((wf) => !existsSync(join(TEMPLATES, "workflows", `${wf}.md`)));
  missingWf.length === 0 ? ok(`${WORKFLOWS.length} workflows`) : fail(`missing workflows: ${missingWf.join(", ")}`);

  console.log(section("Current directory"));
  const root = findMissionRoot(process.cwd());
  if (!root) {
    warn("no runward/ mission here — `runward init` to scaffold one");
  } else {
    ok(`mission found at ${root}`);
    existsSync(join(root, "AGENTS.md")) ? ok("AGENTS.md charter present") : warn("AGENTS.md missing — re-run `runward init`");
    const gitDir = join(root, ".git");
    existsSync(gitDir) ? ok("mission is under git") : warn("mission is not a git repository — ADRs and gates should be versioned");
    const profiles: string[] = [];
    if (existsSync(join(root, ".claude", "commands")) &&
        readdirSync(join(root, ".claude", "commands")).some((f) => f.startsWith("rw-"))) profiles.push("claude");
    if (existsSync(join(root, ".cursor", "rules", "runward.mdc"))) profiles.push("cursor");
    if (existsSync(join(root, ".github", "copilot-instructions.md"))) profiles.push("copilot");
    if (existsSync(join(root, "GEMINI.md"))) profiles.push("gemini");
    if (existsSync(join(root, ".windsurf", "rules", "runward.md"))) profiles.push("windsurf");
    profiles.length > 0
      ? ok(`tool profiles: ${profiles.join(", ")}`)
      : warn("no tool profile detected — AGENTS.md still works with agents that read it");
  }

  console.log(section("Verdict"));
  if (critical > 0) { console.log("  " + status.error(`${critical} critical issue(s), ${warnings} warning(s)`)); process.exit(2); }
  else if (warnings > 0) { console.log("  " + status.warning(`${warnings} warning(s)`)); process.exitCode = 1; }
  else console.log("  " + status.success("all checks passed"));
  console.log();
}
