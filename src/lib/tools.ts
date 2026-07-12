import { join } from "node:path";
import { WORKFLOWS } from "./paths.js";

/**
 * Tool profiles. AGENTS.md is always written: it is the vendor-neutral
 * standard read by Codex CLI, opencode, Amp, Jules and a growing list of
 * agents. Profiles below add tool-specific wiring on top of it.
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
 * Phase skills (ADR-0018): opt-in application adapters that surface the craft rules of a
 * build phase *by relevance*, at the point of action — a layer above the gated core, never
 * a replacement for it. Content is single-sourced here; each harness gets its native idiom
 * (Claude Code SKILL.md, Cursor "Agent Requested" rule, Windsurf "Model Decision" rule).
 * Copilot and Gemini have no relevance mechanism, so they get no phase skill.
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
];

/** The shared body — identical guidance across harnesses; only the packaging frontmatter differs. */
const skillBody = (s: PhaseSkill) =>
  [
    `# Runward — ${s.label} craft`,
    "",
    `Use this when ${s.when}.`,
    "",
    `Confront the CRITICAL/HIGH craft rules mapped to the \`${s.phase}\` phase in \`runward/rules/\` — each rule's \`phases:\` frontmatter declares where it applies — at the point of action, not from memory. Account for each in the deliverable's \`## Rule conformance\` manifest: \`applied\` with a \`file:line\` or test, \`deviated\` with an ADR, or \`n/a\` with a reason.`,
    "",
    "This skill helps you *apply* the rules; it does not enforce them. `runward check --strict` is the sole authority and verifies the manifest deterministically. A rule surfaced here but not accounted for still fails the gate.",
    "",
  ].join("\n");

/** Claude Code Agent Skill: .claude/skills/runward-<phase>/SKILL.md (loaded by relevance via its description). */
const claudeSkill = (root: string, s: PhaseSkill) => ({
  path: join(root, ".claude", "skills", `runward-${s.phase}`, "SKILL.md"),
  content: [
    "---",
    `name: runward-${s.phase}`,
    `description: Runward ${s.label} craft rules. Use when ${s.when}.`,
    "---",
    "",
    skillBody(s),
  ].join("\n"),
});

/** Cursor "Agent Requested" rule: description present, alwaysApply false, no globs → pulled by relevance. */
const cursorSkill = (root: string, s: PhaseSkill) => ({
  path: join(root, ".cursor", "rules", `runward-${s.phase}.mdc`),
  content: [
    "---",
    `description: Runward ${s.label} craft rules. Use when ${s.when}.`,
    "alwaysApply: false",
    "---",
    "",
    skillBody(s),
  ].join("\n"),
});

/** Windsurf "Model Decision" rule: the model decides relevance from the description. */
const windsurfSkill = (root: string, s: PhaseSkill) => ({
  path: join(root, ".windsurf", "rules", `runward-${s.phase}.md`),
  content: [
    "---",
    "trigger: model_decision",
    `description: Runward ${s.label} craft rules. Use when ${s.when}.`,
    "---",
    "",
    skillBody(s),
  ].join("\n"),
});

export const TOOL_PROFILES: ToolProfile[] = [
  {
    id: "claude",
    label: "Claude Code (.claude/commands/rw-* + .claude/skills/runward-*)",
    files: (root) => [
      ...WORKFLOWS.map((wf) => ({ path: join(root, ".claude", "commands", `rw-${wf}.md`), content: pointer(wf) })),
      ...PHASE_SKILLS.map((s) => claudeSkill(root, s)),
    ],
  },
  {
    id: "cursor",
    label: "Cursor (.cursor/rules/runward.mdc + phase skills)",
    files: (root) => [
      {
        path: join(root, ".cursor", "rules", "runward.mdc"),
        content: ["---", "description: Runward delivery method", "alwaysApply: true", "---", "", rulesBody].join("\n"),
      },
      ...PHASE_SKILLS.map((s) => cursorSkill(root, s)),
    ],
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
    label: "Windsurf (.windsurf/rules/runward.md + phase skills)",
    files: (root) => [
      {
        path: join(root, ".windsurf", "rules", "runward.md"),
        content: "# Runward\n\n" + rulesBody,
      },
      ...PHASE_SKILLS.map((s) => windsurfSkill(root, s)),
    ],
  },
];

export const TOOL_IDS = TOOL_PROFILES.map((t) => t.id);
/** The gated build phases that get a relevance-loaded phase skill (ADR-0018). */
export const SKILL_PHASES = PHASE_SKILLS.map((s) => s.phase);
