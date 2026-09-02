import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES, MISSION_LAYOUT, VERSION, WORKFLOWS } from "../lib/paths.js";
import { EXPECTED_RULES, EXPECTED_MAPPED, EXPECTED_ADAPTERS } from "../lib/constants.js";
import { expectedRules } from "../lib/conformance.js";
import { findMissionRoot } from "../lib/mission.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { parseWorkflowContract } from "../lib/workflow-contract.js";

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
  // ADR-0067: a package template whose contract is malformed ships a broken promise. Absence is
  // legal until W2 poses the 11; malformation never is.
  {
    const badContracts = WORKFLOWS.map((wf) => {
      const p2 = join(TEMPLATES, "workflows", `${wf}.md`);
      if (!existsSync(p2)) return null;
      const c2 = parseWorkflowContract(`${wf}.md`, readFileSync(p2, "utf8"));
      return c2 && c2.malformed.length > 0 ? `${wf}: ${c2.malformed[0]}` : null;
    }).filter(Boolean);
    badContracts.length === 0 ? ok("workflow contracts parse (declared ones)") : fail(`malformed workflow contract(s): ${badContracts[0]}`);
  }
  const rulesDir = join(TEMPLATES, "rules");
  const ruleCount = existsSync(rulesDir) ? readdirSync(rulesDir).filter((f) => f.endsWith(".md")).length : 0;
  ruleCount === EXPECTED_RULES ? ok(`${ruleCount} craft rules`) : fail(`craft rules mismatch: ${ruleCount}/${EXPECTED_RULES}`);
  const adaptersDir = join(TEMPLATES, "adapters");
  // Count real adapters, not the README — else substituting an adapter for a stray file passes.
  const adapterCount = existsSync(adaptersDir) ? readdirSync(adaptersDir).filter((f) => f !== "README.md").length : 0;
  adapterCount === EXPECTED_ADAPTERS ? ok(`${adapterCount} gate adapters`) : fail(`gate adapters mismatch: ${adapterCount}/${EXPECTED_ADAPTERS}`);
  // Routed-count floor (ADR-0002): the phases: mapping must not be stripped below its pinned minimum.
  const belowFloor = Object.entries(EXPECTED_MAPPED).filter(([phase, floor]) => expectedRules(TEMPLATES, phase).length < floor);
  belowFloor.length === 0
    ? ok(`rule mapping floors met (${Object.entries(EXPECTED_MAPPED).map(([p, f]) => `${p}≥${f}`).join(", ")})`)
    : fail(`rule mapping below floor: ${belowFloor.map(([p, f]) => `${p} ${expectedRules(TEMPLATES, p).length}/${f}`).join(", ")}`);

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

  // Transmission surface: name the next gesture.
  console.log(section("Next"));
  console.log("  " + (root
    ? `Run ${c.primary("runward check")} to see which gate this mission is at.`
    : `Run ${c.primary("runward init")} to scaffold a mission, then ${c.primary("runward check")} to see where you stand.`));
  console.log();
}
