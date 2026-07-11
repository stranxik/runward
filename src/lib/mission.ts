import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES, MISSION_LAYOUT } from "./paths.js";

/**
 * Mission state reading — the gap analysis: which deliverable, expected at
 * which phase, is present / started / still a template.
 */

export type ArtifactState = "missing" | "untouched" | "in-progress" | "filled";

export interface Artifact {
  label: string;
  relPath: string;        // inside runward/
  templateKey?: string;   // key in MISSION_LAYOUT for template comparison
}

export interface PhaseSpec {
  id: string;
  label: string;
  artifacts: Artifact[];
}

export const PHASES: PhaseSpec[] = [
  {
    id: "frame", label: "1 · Frame",
    artifacts: [
      { label: "Framing note", relPath: "framing.md", templateKey: "framing.md" },
      { label: "Steering contract", relPath: "mission-contract.md", templateKey: "mission-contract.md" },
    ],
  },
  {
    id: "architect", label: "2 · Architect",
    artifacts: [
      { label: "Architecture note", relPath: "architecture.md", templateKey: "architecture.md" },
      { label: "Execution topology", relPath: "execution-topology.md", templateKey: "execution-topology.md" },
      { label: "Decision matrix", relPath: "decision-matrix.md", templateKey: "decision-matrix.md" },
      { label: "Decision journal (≥1 ADR)", relPath: "adr" },
      { label: "Port contracts (≥1 filled)", relPath: "contracts" },
    ],
  },
  {
    id: "floor", label: "3 · Floor",
    artifacts: [{ label: "Floor note (measured proof)", relPath: "floor.md", templateKey: "floor.md" }],
  },
  {
    id: "govern", label: "5 · Govern (day zero)",
    artifacts: [
      { label: "Threat model", relPath: "governance/threat-model.md", templateKey: "threat-model.md" },
      { label: "Evaluation rubric", relPath: "governance/evaluation-rubric.md", templateKey: "evaluation-rubric.md" },
      { label: "Observability schema", relPath: "governance/observability-schema.md", templateKey: "observability-schema.md" },
    ],
  },
  {
    id: "handover", label: "6 · Hand over",
    artifacts: [{ label: "Recovery runbook", relPath: "runbook.md", templateKey: "runbook.md" }],
  },
];

export function findMissionRoot(cwd: string): string | null {
  let dir = cwd;
  for (let i = 0; i < 12; i++) {
    // A mission root contains runward/ with at least the framing note —
    // a directory merely named "runward" (e.g. this repository) does not count.
    if (existsSync(join(dir, "runward", "framing.md"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// A placeholder is bracketed prose with whitespace ([the real process as observed…]),
// which distinguishes it from cross-references like [ADR-0001] or [framing.md].
// A closing bracket followed by "(" is a markdown link ([floor note](floor.md)) — never a placeholder.
const PLACEHOLDER = /\[[^\]\n]*\s[^\]\n]{1,80}\](?!\()/g;

export function artifactState(missionDir: string, a: Artifact): ArtifactState {
  const path = join(missionDir, a.relPath);
  if (!existsSync(path)) return "missing";

  // Special case: ADR directory — count real ADRs beyond the template.
  if (a.relPath === "adr") {
    const adrs = readdirSync(path).filter((f) => /^ADR-\d+/.test(f) && !f.includes("0000"));
    return adrs.length > 0 ? "filled" : "untouched";
  }

  // Special case: contracts directory — filled as soon as one .md is not the raw port-contract template.
  if (a.relPath === "contracts") {
    const template = readFileSync(join(TEMPLATES, "mission", "port-contract.md"), "utf8").trim();
    const contracts = readdirSync(path).filter((f) => f.endsWith(".md"));
    if (contracts.length === 0) return "untouched";
    const hasFilled = contracts.some((f) => readFileSync(join(path, f), "utf8").trim() !== template);
    return hasFilled ? "filled" : "untouched";
  }

  const content = readFileSync(path, "utf8");
  if (a.templateKey) {
    const template = readFileSync(join(TEMPLATES, "mission", a.templateKey), "utf8");
    if (content.trim() === template.trim()) return "untouched";
  }
  const placeholders = (content.match(PLACEHOLDER) || []).length;
  if (placeholders >= 3) return "in-progress";
  return "filled";
}

export interface GapReport {
  phases: Array<{
    spec: PhaseSpec;
    artifacts: Array<{ artifact: Artifact; state: ArtifactState }>;
    complete: boolean;
  }>;
  adrCount: number;
  currentPhase: string;
}

export function analyze(missionDir: string): GapReport {
  const phases = PHASES.map((spec) => {
    const artifacts = spec.artifacts.map((artifact) => ({ artifact, state: artifactState(missionDir, artifact) }));
    return { spec, artifacts, complete: artifacts.every((a) => a.state === "filled") };
  });
  const adrDir = join(missionDir, "adr");
  const adrCount = existsSync(adrDir)
    ? readdirSync(adrDir).filter((f) => /^ADR-\d+/.test(f) && !f.includes("0000")).length
    : 0;
  const firstIncomplete = phases.find((p) => !p.complete);
  return { phases, adrCount, currentPhase: firstIncomplete ? firstIncomplete.spec.label : "all gates passed" };
}
