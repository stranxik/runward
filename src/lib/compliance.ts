import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseManifest } from "./conformance.js";
import { TEMPLATES } from "./paths.js";

/**
 * Deterministic, read-only assembly of a regime-framed compliance evidence pack (ADR-0016).
 * It reads the mission's real artifacts at rest — the rule→OWASP ASI mapping, the rule-conformance
 * manifests, the ADR journal, and the governance-doc presence — and assembles an assessment-readiness
 * *draft*. No model call, no live-state scraping, nothing runs. It populates the technical-evidence
 * layer and its index, and explicitly lists what only the operator/organization can supply. It is
 * never a compliance claim.
 */

/** OWASP Top 10 for Agentic Applications (ASI01–ASI10), the universal security grammar (ADR-0009). */
export const ASI_LABELS: Record<string, string> = {
  ASI01: "Agent Goal Hijack",
  ASI02: "Tool Misuse & Exploitation",
  ASI03: "Identity & Privilege Abuse",
  ASI04: "Agentic Supply Chain Vulnerabilities",
  ASI05: "Unexpected Code Execution",
  ASI06: "Memory & Context Poisoning",
  ASI07: "Insecure Inter-Agent Communication",
  ASI08: "Cascading Failures",
  ASI09: "Human-Agent Trust Exploitation",
  ASI10: "Rogue Agents",
};

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

export interface RuleAsi { slug: string; title: string; impact: string; asi: string[]; }
export interface ConfRow { rule: string; status: string; evidence: string; source: string; }
export interface AdrEntry { file: string; title: string; status: string; }

export interface ComplianceInputs {
  rules: RuleAsi[];
  asiCoverage: Map<string, string[]>; // ASI id -> rule slugs
  conformance: ConfRow[];
  adrs: AdrEntry[];
  threatModel: boolean;
  evalRubric: boolean;
}

function readRules(missionDir: string): RuleAsi[] {
  // The mission's own rules if present (possibly customized), else the package rules — where the
  // shipped OWASP ASI mapping lives (mirrors expectedRules in conformance.ts).
  const missionRules = join(missionDir, "rules");
  const dir = existsSync(missionRules) ? missionRules : join(TEMPLATES, "rules");
  if (!existsSync(dir)) return [];
  const out: RuleAsi[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    let fm = "";
    try { fm = readFileSync(join(dir, f), "utf8").match(FRONTMATTER)?.[1] ?? ""; } catch { continue; }
    const title = (fm.match(/^title:\s*(.+)$/m)?.[1] ?? f.replace(/\.md$/, "")).trim();
    const impact = (fm.match(/^impact:\s*(.+)$/m)?.[1] ?? "").trim();
    const asiRaw = fm.match(/^asi:\s*\[(.*)\]/m)?.[1] ?? "";
    const asi = asiRaw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^ASI\d{2}$/.test(s));
    out.push({ slug: f.replace(/\.md$/, ""), title, impact, asi });
  }
  return out;
}

/** The three build-phase deliverables that carry a `## Rule conformance` manifest (as `check --strict`). */
const CONFORMANCE_DELIVERABLES: Array<[string, string]> = [
  ["Architect", "architecture.md"],
  ["Floor", "floor.md"],
  ["Govern", "governance/threat-model.md"],
];

function readConformance(missionDir: string): ConfRow[] {
  const out: ConfRow[] = [];
  for (const [label, deliverable] of CONFORMANCE_DELIVERABLES) {
    const p = join(missionDir, deliverable);
    if (!existsSync(p)) continue;
    let body = "";
    try { body = readFileSync(p, "utf8"); } catch { continue; }
    for (const row of parseManifest(body)) {
      if (/^\[.*\]$/.test(row.rule)) continue; // skip template placeholder rows
      out.push({ ...row, source: label });
    }
  }
  return out;
}

function readAdrs(missionDir: string): AdrEntry[] {
  const dir = join(missionDir, "adr");
  if (!existsSync(dir)) return [];
  const out: AdrEntry[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md") || f === "ADR-0000-template.md" || f.toUpperCase() === "README.MD" || /^DRAFT-/i.test(f)) continue;
    let body = "";
    try { body = readFileSync(join(dir, f), "utf8"); } catch { continue; }
    const title = (body.match(/^#\s+(.+)$/m)?.[1] ?? f.replace(/\.md$/, "")).trim();
    const status = (body.match(/^\*\*status\*\*\s*:\s*(.+)$/im)?.[1] ?? "").trim();
    out.push({ file: f, title, status });
  }
  return out;
}

export function gatherComplianceInputs(missionDir: string): ComplianceInputs {
  const rules = readRules(missionDir);
  const asiCoverage = new Map<string, string[]>();
  for (const id of Object.keys(ASI_LABELS)) asiCoverage.set(id, []);
  for (const r of rules) for (const id of r.asi) if (asiCoverage.has(id)) asiCoverage.get(id)!.push(r.slug);
  return {
    rules,
    asiCoverage,
    conformance: readConformance(missionDir),
    adrs: readAdrs(missionDir),
    threatModel: existsSync(join(missionDir, "governance", "threat-model.md")),
    evalRubric: existsSync(join(missionDir, "governance", "evaluation-rubric.md")),
  };
}

/** Render the ISO/IEC 42001 assessment-readiness draft — the technical-evidence layer + the human-gap list. */
export function renderIso42001Readiness(inputs: ComplianceInputs, generatedAt: string): string {
  const L: string[] = [];
  const counts = { applied: 0, deviated: 0, "n/a": 0 } as Record<string, number>;
  for (const r of inputs.conformance) if (counts[r.status] !== undefined) counts[r.status]++;

  L.push("# ISO/IEC 42001 — assessment-readiness draft");
  L.push("");
  L.push(`> **Draft, incomplete — not a compliance claim.** Assembled by \`runward compliance iso-42001\` on ${generatedAt},`);
  L.push("> deterministically from ratified engineering artifacts (no model call, nothing scraped or run). It populates the");
  L.push("> **technical-evidence layer and its index**; the applicability, risk-acceptance, policy and management sign-off it");
  L.push("> cannot invent are listed under \"Required from the operator\". This is **supporting evidence**, never certification —");
  L.push("> only an accredited body certifies an AI management system. Verify the current ISO/IEC 42001 text before an audit.");
  L.push("");

  L.push("## 1. Agentic-risk coverage (OWASP ASI → your rules)");
  L.push("");
  L.push("Feeds the ISO 42001 risk assessment (6.1.2) and control selection (6.1.3): which agentic-security risks are addressed by named engineering rules.");
  L.push("");
  L.push("| ASI | Risk | Rules addressing it |");
  L.push("|---|---|---|");
  for (const id of Object.keys(ASI_LABELS)) {
    const slugs = inputs.asiCoverage.get(id) ?? [];
    L.push(`| ${id} | ${ASI_LABELS[id]} | ${slugs.length ? slugs.map((s) => `\`${s}\``).join(", ") : "**no rule mapped — gap to assess**"} |`);
  }
  L.push("");

  L.push("## 2. Control-implementation status (rule conformance)");
  L.push("");
  L.push(`Feeds the Statement of Applicability's implementation-status + evidence columns (6.1.3). From your mission's manifests: **${counts.applied} applied · ${counts.deviated} deviated · ${counts["n/a"]} n/a** across ${inputs.conformance.length} accounted rule(s).`);
  L.push("");
  if (inputs.conformance.length === 0) {
    L.push("_No filled `Rule conformance` manifest found yet — fill the architect/floor/govern deliverables (see `runward check --strict`)._");
  } else {
    L.push("| Rule | Status | Evidence | Phase |");
    L.push("|---|---|---|---|");
    for (const r of inputs.conformance) L.push(`| \`${r.rule}\` | ${r.status} | ${r.evidence || "—"} | ${r.source} |`);
  }
  L.push("");

  L.push("## 3. Design decisions (ADR journal)");
  L.push("");
  L.push("The \"key design choices, alternatives, and re-evaluation triggers\" an ISO 42001 auditor expects (records under Annex A control groups).");
  L.push("");
  if (inputs.adrs.length === 0) {
    L.push("_No ratified ADR found in `runward/adr/`._");
  } else {
    L.push("| ADR | Status |");
    L.push("|---|---|");
    for (const a of inputs.adrs) L.push(`| ${a.title} (\`${a.file}\`) | ${a.status || "—"} |`);
  }
  L.push("");

  L.push("## 4. Risk & impact inputs (presence)");
  L.push("");
  L.push(`- Threat model (feeds risk assessment 6.1.2): ${inputs.threatModel ? "**present** — confirm it is filled, not a raw template" : "**missing**"}`);
  L.push(`- Evaluation rubric (feeds impact/validation analysis): ${inputs.evalRubric ? "**present** — confirm it is filled" : "**missing**"}`);
  L.push("");

  L.push("## Required from the operator / organization (runward cannot produce this)");
  L.push("");
  L.push("These sections are managerial, legal or organizational — no tool can assemble them from engineering artifacts:");
  L.push("");
  L.push("- **AI policy** (5.2) and **AIMS scope** (4.3).");
  L.push("- **Statement of Applicability — the applicability decisions and inclusion/exclusion justifications** (6.1.3): runward supplies the status + evidence columns; the *applicability* judgment is yours.");
  L.push("- **Risk methodology, acceptance criteria and risk-acceptance decisions** (6.1.2, 8.3).");
  L.push("- **AI system impact assessment report and deployment authorization** (6.1.4).");
  L.push("- **Objectives and targets** (6.2), **roles and competence** (A.3, 7.2).");
  L.push("- **Internal audit** (9.2) and **management review** minutes (9.3).");
  L.push("- **Runtime AI event logs** (A.6.2.8) — produced by the running system, not by runward.");
  L.push("");
  L.push("_Regime mapping is dated engineering framing, not legal advice; ISO Annex A control counts/templates are behind the paywalled standard — confirm against the purchased text._");
  L.push("");
  return L.join("\n") + "\n";
}
