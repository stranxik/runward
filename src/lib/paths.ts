import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Artifact paths are POSIX by contract (locks, bundles, attestations, reports): what runward
 *  EMITS must not depend on the OS that emitted it, or "same tree => same verdict" dies across
 *  machines (first windows-latest leg, 2026-08-17: bundle subjects and lock keys came out with
 *  backslashes). No-op on POSIX. */
export const toPosix = (p: string): string => p.split(sep).join("/");

/** Package root (works from dist/lib/ at runtime). */
export const PKG_ROOT = join(HERE, "..", "..");
export const TEMPLATES = join(PKG_ROOT, "templates");
/** Filled reference mission (shipped) — used by `init --example`. */
export const EXAMPLE_MISSION = join(PKG_ROOT, "examples", "request-triage", "runward");
/** The reference floor the mission's manifests point at — shipped with it, so the evidence resolves (ADR-0019). */
export const EXAMPLE_CODE = join(PKG_ROOT, "examples", "request-triage", "code");
const PACKAGE_JSON = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as { name: string; version: string };
export const VERSION: string = PACKAGE_JSON.version;
/** The registry name this binary is published under: with VERSION, what retrieves it (ADR-0113). */
export const PACKAGE_NAME: string = PACKAGE_JSON.name;

/** Mission layout: template file -> destination inside runward/ */
export const MISSION_LAYOUT: Record<string, string> = {
  "framing.md": "framing.md",
  "architecture.md": "architecture.md",
  "decision-matrix.md": "decision-matrix.md",
  "mission-contract.md": "mission-contract.md",
  "reference-stack.md": "reference-stack.md",
  "shared-bricks.md": "shared-bricks.md",
  "execution-topology.md": "execution-topology.md",
  "floor.md": "floor.md",
  "gap-analysis.md": "gap-analysis.md",
  "adr/ADR-0000-template.md": "adr/ADR-0000-template.md",
  "threat-model.md": "governance/threat-model.md",
  "evaluation-rubric.md": "governance/evaluation-rubric.md",
  "observability-schema.md": "governance/observability-schema.md",
  "usage-registry.md": "governance/usage-registry.md",
  "port-contract.md": "contracts/port-contract.md",
  "runbook.md": "runbook.md",
  "handover.md": "handover.md",
};

export const WORKFLOWS = [
  "method", "frame", "architect", "floor", "iterate",
  "govern", "handover", "brownfield", "review", "decision-loop", "verify",
] as const;
