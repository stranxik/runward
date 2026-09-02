import { join } from "node:path";
import { existsSync } from "node:fs";
import { WORKFLOWS } from "./paths.js";

/**
 * Tool profiles. AGENTS.md is always written: it is the vendor-neutral standard read by
 * Codex, Cursor, Copilot, Windsurf, Cline, Zed, Amp, opencode, goose, Junie, Warp and a
 * long list of agents. The vendor-neutral phase skills (`.agents/skills/`, see baselineSkills)
 * are also always written. Profiles below add tool-specific wiring on top of both.
 */
export interface ToolProfile {
  id: string;
  label: string;
  files: (root: string) => Array<{ path: string; content: string }>;
}

const pointer = (wf: string) =>
  [
    "---",
    `description: Runward — run the ${wf} workflow against the current mission state`,
    "---",
    "",
    `Read \`runward/workflows/${wf}.md\` and execute it against the current mission state in \`runward/\`.`,
    "Respect the charter in `AGENTS.md`. Do not mark the phase done unless its Definition of Done is demonstrably met.",
    "",
  ].join("\n");

const rulesBody = [
  "This project follows the Runward method (after the spec: ship and run).",
  "The agent charter is `AGENTS.md` — its boundaries are non-negotiable.",
  "The method lives in `runward/workflows/` (start with `method.md`); the mission state lives in `runward/`.",
  "Every structural decision goes through `runward/workflows/decision-loop.md` and is locked as an ADR in `runward/adr/`,",
  "with a dated re-evaluation trigger. Complexity is added only on an objective trigger — no trigger, no change.",
  "",
].join("\n");

/**
 * Phase skills (ADR-0018): the craft rules of a build phase, surfaced *by relevance* at the
 * point of action — a layer above the gated core, never a replacement for it. The SKILL.md
 * open format is a converged standard: one canonical set under `.agents/skills/` is read by
 * 14+ harnesses (Codex, Cursor, Copilot, Gemini, Windsurf, Cline, Zed, Amp, opencode, Roo,
 * Kilo, Warp, Devin, Augment), no harness privileged. A few harnesses need their own path
 * (Claude Code, Junie, Trae) or their own idiom (Continue.dev); Aider and goose have no
 * relevance surface, so AGENTS.md is their honest ceiling.
 */
interface PhaseSkill {
  phase: string;
  label: string;
  when: string; // the self-activating trigger — the description an agent matches on
}

const PHASE_SKILLS: PhaseSkill[] = [
  {
    phase: "architect", label: "architecture",
    when: "posing the architecture of an agentic system: domain ports, the model boundary, the integration protocol, or any structural design decision taken before the stack",
  },
  {
    phase: "topology", label: "execution topology",
    when: "deciding where each port's adapter runs and under which data sovereignty: placement family, the secrets/network boundary, or third-party trace export",
  },
  {
    phase: "floor", label: "the executable floor",
    when: "building the smallest executable floor: the single orchestrator, the model port, deterministic guards, persistence, or baseline observability",
  },
  {
    phase: "govern", label: "governance",
    when: "governing an agentic system: the threat model, prompt-injection defense, evaluation, observability, resilience, or any sensitive-action approval",
  },
  {
    phase: "handover", label: "hand-over",
    when: "preparing or executing a succession: the recovery runbook, finalizing the agent charter as a leave-behind, the redone-task proof, or naming the owner who inherits the system",
  },
];

/** The shared body — identical guidance across harnesses; only the packaging frontmatter differs. */
const skillBody = (s: PhaseSkill) =>
  [
    `# Runward — ${s.label} craft`,
    "",
    `Use this when ${s.when}.`,
    "",
    `Confront the CRITICAL/HIGH craft rules mapped to the \`${s.phase}\` phase, at the point of action and not from memory. Ask for them rather than guessing: \`runward rules --phase ${s.phase}\` lists them, and \`runward rules --for <paths>\` narrows to the rules whose declared territory covers the files you are touching. Then read what comes back — \`runward explain <rule>\` prints a rule's why and full text. Naming a rule is not confronting it. Account for each in the deliverable's \`## Rule conformance\` manifest — \`runward manifest --sync\` scaffolds the missing rows; you fill the decision: \`applied\` with a typed pointer the gate verifies (\`file:PATH[:LINE][#SYMBOL]\`, \`test:PATH[::NAME]\`) or prose, \`deviated\` with an ADR, or \`n/a\` with a real reason. Signed rules (frontmatter \`signature:\`) need evidence whose content matches their signature.`,
    "",
    "This skill helps you *apply* the rules; it does not enforce them. `runward check --strict` is the sole authority and verifies the manifest deterministically. A rule surfaced here but not accounted for still fails the gate.",
    "",
  ].join("\n");

/** A YAML-safe double-quoted scalar. The description embeds the `when` trigger, which carries
 *  colons (and apostrophes) — left bare, a spec-conformant YAML parser (PyYAML safe_load,
 *  js-yaml) rejects the frontmatter, even though today's lenient line-based harness readers
 *  tolerate it. Double quotes take colons and apostrophes without escaping. */
const yamlStr = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** SKILL.md open-format: name + description (the relevance trigger) + body. */
const skillMd = (s: PhaseSkill) =>
  [
    "---",
    `name: runward-${s.phase}`,
    `description: ${yamlStr(`Runward ${s.label} craft rules. Use when ${s.when}.`)}`,
    "---",
    "",
    skillBody(s),
  ].join("\n");

/** Emit the five phase skills as SKILL.md folders under `<root>/<...dir>/runward-<phase>/SKILL.md`. */
const skillsAt = (root: string, ...dir: string[]) =>
  PHASE_SKILLS.map((s) => ({ path: join(root, ...dir, `runward-${s.phase}`, "SKILL.md"), content: skillMd(s) }));

/** Every directory where phase skills ALREADY exist under `root`, relative to it.
 *  Detected on disk, never inferred from a profile: `update` refreshes what is there and
 *  creates no new home. These files are wholly generated from `PHASE_SKILLS` — an operator has
 *  no field to personalise — so leaving them frozen at the version that ran `init` was a
 *  classification mistake, not a decision. A field report had them 17 releases behind, silently. */
export function existingSkillDirs(root: string): string[] {
  // The candidate homes are DERIVED from what init actually writes, never restated: a new tool
  // profile that ships skills is covered the day it is added. A hand-kept list is a list that can
  // be incomplete without failing, which is how these files escaped `update` in the first place.
  const probe = "/__rw_probe__";
  const dirs = new Set<string>([join(".agents", "skills")]);
  for (const profile of TOOL_PROFILES) {
    for (const f of profile.files(probe)) {
      const m = f.path.slice(probe.length + 1).match(/^(.*skills)[/\\]/);
      if (m) dirs.add(m[1]);
    }
  }
  return [...dirs].sort().filter((rel) => PHASE_SKILLS.some(
    (s) => existsSync(join(root, rel, `runward-${s.phase}`, "SKILL.md"))));
}

/** The skills that belong at `rel` under `root`, with their root-relative keys. */
export function skillsForDir(root: string, rel: string): Array<{ key: string; path: string; content: string }> {
  return PHASE_SKILLS.map((s) => ({
    // The key is RECORDED in scaffold-lock.json, and the lock is committed: it travels between
    // operating systems with the repository. `join` writes the OS's own separator, so a lock
    // written on Windows carried `.agents\skills\…` keys that a Linux reader — the CI, a
    // teammate — could never look up again: `update` saw every skill as never-recorded, on a tree
    // that had not moved (RWD-2026-0102, the RWD-2026-0075 family). A recorded key is a NAME, not
    // a path; it is spelled with forward slashes on every OS. `path` below stays `join`ed — it is
    // handed to the filesystem, where the OS separator is exactly right.
    key: [rel.split("\\").join("/"), `runward-${s.phase}`, "SKILL.md"].join("/"),
    path: join(root, rel, `runward-${s.phase}`, "SKILL.md"),
    content: skillMd(s),
  }));
}

/**
 * The vendor-neutral phase skills at `.agents/skills/` — the converged SKILL.md alias read by
 * 14+ harnesses, no agent privileged. Always written alongside AGENTS.md, like the rules.
 */
export function baselineSkills(root: string): Array<{ path: string; content: string }> {
  return skillsAt(root, ".agents", "skills");
}

export const TOOL_PROFILES: ToolProfile[] = [
  {
    id: "claude",
    label: "Claude Code (.claude/commands/rw-* + .claude/skills/)",
    files: (root) => [
      ...WORKFLOWS.map((wf) => ({ path: join(root, ".claude", "commands", `rw-${wf}.md`), content: pointer(wf) })),
      ...skillsAt(root, ".claude", "skills"),
    ],
  },
  {
    id: "cursor",
    label: "Cursor (.cursor/rules/runward.mdc)",
    files: (root) => [{
      path: join(root, ".cursor", "rules", "runward.mdc"),
      content: ["---", "description: Runward delivery method", "alwaysApply: true", "---", "", rulesBody].join("\n"),
    }],
  },
  {
    id: "copilot",
    label: "GitHub Copilot (.github/copilot-instructions.md)",
    files: (root) => [{
      path: join(root, ".github", "copilot-instructions.md"),
      content: "# Runward\n\n" + rulesBody,
    }],
  },
  {
    id: "gemini",
    label: "Gemini CLI (GEMINI.md)",
    files: (root) => [{
      path: join(root, "GEMINI.md"),
      content: "# Runward\n\n" + rulesBody,
    }],
  },
  {
    id: "windsurf",
    label: "Windsurf (.windsurf/rules/runward.md)",
    files: (root) => [{
      path: join(root, ".windsurf", "rules", "runward.md"),
      content: "# Runward\n\n" + rulesBody,
    }],
  },
  {
    id: "continue",
    label: "Continue.dev (.continue/rules/runward-*)",
    files: (root) => PHASE_SKILLS.map((s) => ({
      path: join(root, ".continue", "rules", `runward-${s.phase}.md`),
      content: ["---", `name: ${yamlStr(`Runward ${s.label} craft`)}`, `description: ${yamlStr(`Use when ${s.when}.`)}`, "alwaysApply: false", "---", "", skillBody(s)].join("\n"),
    })),
  },
  {
    id: "junie",
    label: "JetBrains Junie (.junie/skills/)",
    files: (root) => skillsAt(root, ".junie", "skills"),
  },
  {
    id: "trae",
    label: "Trae (.trae/skills/)",
    files: (root) => skillsAt(root, ".trae", "skills"),
  },
  {
    id: "kiro",
    label: "Kiro (.kiro/steering/runward-*)",
    // Kiro reads AGENTS.md natively (the charter is already covered); this mirrors the phase
    // skills as steering files. `inclusion: auto` + name + description is Kiro's idiom for
    // relevance-loaded guidance — the same semantics as the SKILL.md description trigger.
    files: (root) => PHASE_SKILLS.map((s) => ({
      path: join(root, ".kiro", "steering", `runward-${s.phase}.md`),
      content: ["---", "inclusion: auto", `name: runward-${s.phase}`, `description: ${yamlStr(`Runward ${s.label} craft rules. Use when ${s.when}.`)}`, "---", "", skillBody(s)].join("\n"),
    })),
  },
];

export const TOOL_IDS = TOOL_PROFILES.map((t) => t.id);
/** The gated build phases that get a relevance-loaded phase skill (ADR-0018). */
export const SKILL_PHASES = PHASE_SKILLS.map((s) => s.phase);
