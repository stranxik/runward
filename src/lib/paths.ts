import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Package root (works from dist/lib/ at runtime). */
export const PKG_ROOT = join(HERE, "..", "..");
export const TEMPLATES = join(PKG_ROOT, "templates");
export const VERSION: string = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")).version;

/** Mission layout: template file -> destination inside runward/ */
export const MISSION_LAYOUT: Record<string, string> = {
  "framing.md": "framing.md",
  "architecture.md": "architecture.md",
  "floor.md": "floor.md",
  "adr/ADR-0000-template.md": "adr/ADR-0000-template.md",
  "threat-model.md": "governance/threat-model.md",
  "evaluation-rubric.md": "governance/evaluation-rubric.md",
  "observability-schema.md": "governance/observability-schema.md",
  "port-contract.md": "contracts/port-contract.md",
  "runbook.md": "runbook.md",
};

export const WORKFLOWS = [
  "method", "frame", "architect", "floor", "iterate",
  "govern", "handover", "brownfield", "review", "decision-loop",
] as const;
