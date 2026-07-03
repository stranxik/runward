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

export const TOOL_PROFILES: ToolProfile[] = [
  {
    id: "claude",
    label: "Claude Code (.claude/commands/rw-*)",
    files: (root) =>
      WORKFLOWS.map((wf) => ({ path: join(root, ".claude", "commands", `rw-${wf}.md`), content: pointer(wf) })),
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
];

export const TOOL_IDS = TOOL_PROFILES.map((t) => t.id);
