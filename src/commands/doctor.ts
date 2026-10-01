import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TEMPLATES, MISSION_LAYOUT, VERSION, WORKFLOWS } from "../lib/paths.js";
import { EXPECTED_RULES, EXPECTED_MAPPED, EXPECTED_ADAPTERS } from "../lib/constants.js";
import { expectedRules, GATED_DELIVERABLES, readRatification } from "../lib/conformance.js";
import { byMatchesCommitter, readIdentities } from "../lib/identity.js";
import { readCharter, missionIdentities, isoDay, CHARTER_FILE, DELEGATION_STAGE1_BANNER, CHARTER_BANNER } from "../lib/delegation.js";
import { findMissionRoot } from "../lib/mission.js";
import { c, createHeader, generationDate, section, status } from "../lib/styles.js";
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
  const bindings: Binding[] = [];

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
    if (existsSync(join(root, "runward", CHARTER_FILE))) {
      heading("delegation", "Delegation charter");
      delegationChecks(join(root, "runward"), { ok, warn });
    }
    if (existsSync(gitDir)) {
      heading("ratifiers", "Who committed each ratification");
      ratifierBindings(root, { ok, warn }, bindings);
    }
  }

  if (opts.json) {
    const exitCode = critical > 0 ? 2 : warnings > 0 ? 1 : 0;
    emitJson({ runward: VERSION, mission: root, health: critical > 0 ? "critical" : warnings > 0 ? "warnings" : "ok", exitCode, warnings, critical, checks,
      // ADR-0088 decision 4, additive: each ratification entry's declared `by:` beside the identity
      // git recorded as committing its line. Present only when the mission is under git.
      ...(bindings.length > 0 ? { ratifiers: bindings } : {}) });
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

/** One ratification entry's declared ratifier beside the identity that committed its line. */
interface Binding {
  deliverable: string; line: number; by: string | null; agent: boolean;
  /** null when the line is not committed yet: the `by:` then stays as declared. */
  committer: { name: string; email: string; commit: string } | null;
  /** Does the declared `by:` name the committing identity (folded, alias-resolved)? null when uncommitted. */
  bound: boolean | null;
}

/**
 * ADR-0088 decision 4: `by:` is bound to the git identity that committed the entry, never left a free
 * string where the CLI can read it. It is read HERE, and only here, for a reason: the verdict path
 * may not spawn a process or read git history (ADR-0054, crossings 1 and 4: same working tree, same
 * verdict), and `doctor` is one of the three files that already run `git` read-only
 * (eslint.security.config.js, SPAWN_ALLOWED). So `check`, `report` and the JSON keep printing `by:`
 * as declared, and this section says whether git agrees.
 *
 * What a match is worth, said as it is: git records the name and address the committer configured.
 * In stage 1 of ADR-0088 an agent can commit under any configured identity, and commit signatures
 * are not verified here; a match is a consistency between two declarations, a mismatch is a fact.
 */
function ratifierBindings(root: string, out: { ok: (m: string) => void; warn: (m: string) => void }, bindings: Binding[]): void {
  const identities = missionIdentities(join(root, "runward"));
  for (const g of GATED_DELIVERABLES) {
    const rel = `runward/${g.deliverable}`;
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const lines = readFileSync(abs, "utf8").split("\n");
    const head = lines.findIndex((l) => l === "### Ratification");
    if (head === -1) continue;
    for (let i = head + 1; i < lines.length; i++) {
      if (/^#{1,6}\s/.test(lines[i])) break;
      const [e] = readRatification(`### Ratification\n${lines[i]}`);
      if (!e) continue;
      let porcelain = "";
      try {
        porcelain = execFileSync("git", ["-c", "core.quotepath=false", "-C", root, "blame", "--porcelain", "-L", `${i + 1},${i + 1}`, "--", rel],
          { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      } catch { porcelain = ""; }
      const commit = porcelain.match(/^([0-9a-f]{40}) /)?.[1] ?? "";
      const name = porcelain.match(/^committer (.*)$/m)?.[1] ?? "";
      const email = (porcelain.match(/^committer-mail <(.*)>$/m)?.[1] ?? "");
      const committed = commit !== "" && !/^0+$/.test(commit);
      bindings.push({ deliverable: g.deliverable, line: i + 1, by: e.by ?? null, agent: e.agent === true,
        committer: committed ? { name, email, commit } : null,
        bound: committed ? (e.by !== undefined && byMatchesCommitter(e.by, { name, email }, identities)) : null });
    }
  }
  if (bindings.length === 0) return;
  const committed = bindings.filter((b) => b.committer);
  const bound = committed.filter((b) => b.bound);
  const loose = committed.filter((b) => !b.bound);
  const pending = bindings.length - committed.length;
  const at = (b: Binding) => `${b.deliverable}:${b.line} by: ${b.by ?? "(none)"}${b.agent ? " (agent)" : ""}, committed by ${b.committer!.name} <${b.committer!.email}>`;
  if (bound.length > 0) out.ok(`${bound.length} ratification entr(ies): the declared \`by:\` names the identity git recorded as committing the line (a consistency between two declarations, not a signature: commit signatures are not verified here, ADR-0088 stage 1)`);
  // An agent's entry committed under another identity is the attribution ADR-0082 forbids, seen from
  // git: a warning. A person's OS user name differing from their git name is common and said, not warned.
  const agents = loose.filter((b) => b.agent), people = loose.filter((b) => !b.agent);
  if (agents.length > 0) out.warn(`${agents.length} agent ratification entr(ies) committed under another identity than the declared \`by:\` — ${agents.slice(0, 3).map(at).join("; ")}${agents.length > 3 ? `; and ${agents.length - 3} more (--json)` : ""}`);
  if (people.length > 0) out.ok(`${people.length} entr(ies) whose declared \`by:\` differs from the committing identity (declare both spellings in scaffold-lock.json "identities" if they are one person) — ${people.slice(0, 3).map(at).join("; ")}${people.length > 3 ? `; and ${people.length - 3} more (--json)` : ""}`);
  if (pending > 0) out.ok(`${pending} entr(ies) not committed yet: their \`by:\` stays as declared until a commit records who wrote them`);
}

/**
 * ADR-0088 decisions 1, 5 and 7, the part the gate cannot do. The verdict path reads no clock
 * (ADR-0054: same working tree, same verdict), so `check --strict` judges expiry only against the
 * dates the tree declares. `doctor` is not in the verdict path: it sets `expires:` beside today's
 * date (the clock every runward date honours: RUNWARD_NOW, then SOURCE_DATE_EPOCH, in non-interactive
 * runs) and warns when the charter has lapsed or lapses within 14 days, the notice decision 7 names.
 * The stage banner is a warning on purpose: stage 1 adds attribution and no protection, and says so.
 */
function delegationChecks(mission: string, out: { ok: (m: string) => void; warn: (m: string) => void }): void {
  const charter = readCharter(mission);
  if (!charter) return;
  out.warn(`${DELEGATION_STAGE1_BANNER}; ${CHARTER_BANNER} (runward/${CHARTER_FILE}, stage ${charter.stage ?? "?"})`);
  if (charter.problems.length > 0) {
    out.warn(`${charter.problems.length} charter problem(s), each a gap under \`check --strict\` — ${charter.problems.slice(0, 3).map((p) => p.problem).join("; ")}${charter.problems.length > 3 ? `; and ${charter.problems.length - 3} more` : ""}`);
  }
  const today = generationDate();
  const now = isoDay(today), until = isoDay(charter.expires);
  if (now !== null && until !== null) {
    const left = until - now;
    if (left < 0) out.warn(`the charter expired on ${charter.expires} (${-left} day(s) ago, by this run's clock, ${today}): every agent ratification dated after it is a gap under \`check --strict\`; renewing it is the maintainer's act (class R)`);
    else if (left <= 14) out.warn(`the charter expires on ${charter.expires}, in ${left} day(s) (by this run's clock, ${today}): renewing it is the maintainer's act (class R)`);
    else out.ok(`the charter is in force until ${charter.expires} (${left} day(s) left, by this run's clock, ${today})`);
  }
  // Identity precedence (delegation.ts, missionIdentities): the charter's accountable person merged
  // over the lock's interim `identities`. Said when both declare the person, so a reader can find both.
  const lock = readIdentities(mission);
  if (charter.accountable !== null && lock[charter.accountable] !== undefined) {
    out.ok(`${charter.accountable} is declared in the charter and in scaffold-lock.json "identities": its aliases are merged, the charter's first, and an alias the charter gives this person is read as theirs alone`);
  }
}
