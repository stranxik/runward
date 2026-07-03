// Example tools. Each one is a deterministic function, isolated from any
// cross-cutting infrastructure (the middleware handles that). A tool declares
// its minimum role and whether it requires approval.

import { z } from "zod";
import type { ToolDefinition } from "../../core/ports/out/tool.port.js";

// Read-only tool, available to everyone (viewer). No side effect.
export const wordCountTool: ToolDefinition<{ text: string }, { words: number }> =
  {
    name: "word_count",
    description: "Counts the words of a text. Read-only, no side effect.",
    input: z.object({ text: z.string() }),
    minRole: "viewer",
    requiresApproval: false,
    async execute({ text }) {
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      return { words };
    },
  };

// Impactful tool: "publishes" a note. Requires the operator role AND approval.
// The effect is simulated here (returns an acknowledgment), but it stands for
// a mutation.
export const publishNoteTool: ToolDefinition<
  { content: string },
  { published: boolean; length: number }
> = {
  name: "publish_note",
  description:
    "Publishes a note (simulated mutation). Operator role + approval required.",
  input: z.object({ content: z.string().min(1) }),
  minRole: "operator",
  requiresApproval: true,
  async execute({ content }) {
    return { published: true, length: content.length };
  },
};
