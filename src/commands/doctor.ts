import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TEMPLATES, MISSION_LAYOUT, VERSION, WORKFLOWS } from "../lib/paths.js";
import { EXPECTED_RULES, EXPECTED_MAPPED, EXPECTED_ADAPTERS } from "../lib/constants.js";
import { expectedRules } from "../lib/conformance.js";
import { findMissionRoot } from "../lib/mission.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { parseWorkflowContract } from "../lib/workflow-contract.js";
import { emitJson, humanLog } from "../lib/machine-output.js";

/**
 * Environment and installation checks.
 * `-p` points the mission checks at a project other than the working directory, like every other
 * command; `--json` (ADR-0030) publishes each check with its status as one document on stdout.
 * Exit codes: 0 = all good, 1 = warnings, 2 = critical failure.
 */
export async function doctorCommand(opts: { path?: string; json?: boolean } = {}): Promise<void> {
  const log = humanLog(opts.json);
  log(createHeader(`Runward v${VERSION} — doctor`));
  let warnings = 0;
  let critical = 0;
  // The section a check belongs to, as a stable identifier for the machine form.
  let area = "environment";
  const checks: Array<{ section: string; status: "ok" | "warning" | "critical"; message: string }> = [];
  const heading = (id: string, title: string) => { area = id; log(section(title)); };

  const ok = (msg: string) => { checks.push({ section: area, status: "ok", message: msg }); log("  " + status.success(msg)); };
  const warn = (msg: string) => { warnings++; checks.push({ section: area, status: "warning", message: msg }); log("  " + status.warning(msg)); };
  const fail = (msg: string) => { critical++; checks.push({ section: area, status: "critical", message: msg }); log("  " + status.error(msg)); };

  heading("environment", "Environment");
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  nodeMajor >= 20 ? ok(`node ${process.versions.node}`) : fail(`node ${process.versions.node} — v20+ required`);
  try {
    const git = execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
    ok(git);
  } catch {
    warn("git not found — the method assumes versioned mission artifacts");
  }

  heading("package", "Package integrity");
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
    ? ok(`every gated phase maps at least its minimum number of rules (${Object.entries(EXPECTED_MAPPED).map(([p, f]) => `${p}≥${f}`).join(", ")})`)
    : fail(`rule mapping below floor: ${belowFloor.map(([p, f]) => `${p} ${expectedRules(TEMPLATES, p).length}/${f}`).join(", ")}`);

  heading("mission", opts.path ? "Project" : "Current directory");
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
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

  if (opts.json) {
    const exitCode = critical > 0 ? 2 : warnings > 0 ? 1 : 0;
    emitJson({ runward: VERSION, mission: root, health: critical > 0 ? "critical" : warnings > 0 ? "warnings" : "ok", exitCode, warnings, critical, checks });
    process.exitCode = exitCode;
    return;
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
