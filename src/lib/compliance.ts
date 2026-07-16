import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseManifest, GATED_DELIVERABLES } from "./conformance.js";
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

function readConformance(missionDir: string): ConfRow[] {
  const out: ConfRow[] = [];
  // The same gated (phase, deliverable) pairs `check --strict` verifies — one source (conformance.ts).
  for (const { label, deliverable } of GATED_DELIVERABLES) {
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

// ── Shared table blocks (used by every regime lens) ──

function asiTableLines(inputs: ComplianceInputs): string[] {
  const L = ["| ASI | Risk | Rules addressing it |", "|---|---|---|"];
  for (const id of Object.keys(ASI_LABELS)) {
    const slugs = inputs.asiCoverage.get(id) ?? [];
    L.push(`| ${id} | ${ASI_LABELS[id]} | ${slugs.length ? slugs.map((s) => `\`${s}\``).join(", ") : "**no rule mapped — gap to assess**"} |`);
  }
  return L;
}
function confCounts(inputs: ComplianceInputs): Record<string, number> {
  const c: Record<string, number> = { applied: 0, deviated: 0, "n/a": 0 };
  for (const r of inputs.conformance) if (c[r.status] !== undefined) c[r.status]++;
  return c;
}
function confTableLines(inputs: ComplianceInputs): string[] {
  if (inputs.conformance.length === 0) return ["_No filled `Rule conformance` manifest found yet — fill the architect/floor/govern deliverables (`runward check --strict`)._"];
  const L = ["| Rule | Status | Evidence | Phase |", "|---|---|---|---|"];
  for (const r of inputs.conformance) L.push(`| \`${r.rule}\` | ${r.status} | ${r.evidence || "—"} | ${r.source} |`);
  return L;
}
function adrTableLines(inputs: ComplianceInputs): string[] {
  if (inputs.adrs.length === 0) return ["_No ratified ADR found in `runward/adr/`._"];
  const L = ["| ADR | Status |", "|---|---|"];
  for (const a of inputs.adrs) L.push(`| ${a.title} (\`${a.file}\`) | ${a.status || "—"} |`);
  return L;
}

/** Render the NIST AI RMF assessment-readiness draft — an ASI↔AI-RMF crosswalk, the MEASURE/TEVV
 *  documentation, and the design decisions; GOVERN and risk-tolerance stay the operator's. */
export function renderNistAiRmf(inputs: ComplianceInputs, generatedAt: string): string {
  const c = confCounts(inputs);
  const L: string[] = [];
  L.push("# NIST AI RMF — assessment-readiness draft");
  L.push("");
  L.push(`> **Draft, incomplete — not a compliance claim.** Assembled by \`runward compliance nist-ai-rmf\` on ${generatedAt},`);
  L.push("> deterministically from ratified engineering artifacts (no model call). The AI RMF is **voluntary guidance**");
  L.push("> with no pass/fail and no certification; this populates the MEASURE/documentation evidence and an ASI crosswalk,");
  L.push("> while GOVERN, risk tolerance and go/no-go stay the operator's. Verify the current AI RMF text before use.");
  L.push("");
  L.push("## 1. Agentic-risk crosswalk (OWASP ASI → AI RMF)");
  L.push("");
  L.push("An indicative engineering crosswalk (not NIST-endorsed): each agentic-security risk lands primarily under **MEASURE** (test & evaluate, esp. security & resilience) and **MANAGE** (risk treatment). Confirm subcategory selection against AI RMF §5.");
  L.push("");
  L.push(...asiTableLines(inputs));
  L.push("");
  L.push("## 2. MEASURE / TEVV documentation");
  L.push("");
  L.push(`Feeds MEASURE 2.x — documented, repeatable test methodology and results. From your mission: **${c.applied} applied · ${c.deviated} deviated · ${c["n/a"]} n/a** across ${inputs.conformance.length} rule(s).`);
  L.push(`- Evaluation rubric (test sets, metrics, tooling): ${inputs.evalRubric ? "**present** — confirm it is filled" : "**missing**"}`);
  L.push(`- Threat model (adversarial / risk-source analysis): ${inputs.threatModel ? "**present** — confirm it is filled" : "**missing**"}`);
  L.push("");
  L.push(...confTableLines(inputs));
  L.push("");
  L.push("## 3. Design decisions (ADR journal)");
  L.push("");
  L.push(...adrTableLines(inputs));
  L.push("");
  L.push("## Required from the operator / organization (runward cannot produce this)");
  L.push("");
  L.push("- **GOVERN** — policies, roles, accountability, **risk tolerance** (almost entirely organizational).");
  L.push("- **MAP** — intended purpose, business/legal context, use-case risk enumeration.");
  L.push("- **MANAGE** — the **go/no-go acceptance** decision, resourcing, response planning.");
  L.push("- **Profiles** — Current/Target selection, prioritization, the risk-tolerance choices behind them.");
  L.push("");
  L.push("_Indicative engineering framing, not legal advice; NIST prescribes no report template — confirm against AI 100-1 and the Playbook._");
  L.push("");
  return L.join("\n") + "\n";
}

/** Render the EU AI Act Annex IV assessment-readiness draft — strong on Point 2 (design/architecture/
 *  validation) and the design-rationale/change history (the ADR journal); RMS, standards, declaration
 *  and post-market plan stay the provider's. */
export function renderEuAiAct(inputs: ComplianceInputs, generatedAt: string): string {
  const L: string[] = [];
  L.push("# EU AI Act — Annex IV technical documentation — assessment-readiness draft");
  L.push("");
  L.push(`> **Draft, incomplete — not a conformity assessment.** Assembled by \`runward compliance eu-ai-act\` on ${generatedAt},`);
  L.push("> deterministically from ratified engineering artifacts (no model call). High-risk obligations bind from");
  L.push("> **2 August 2026** (Annex III). This populates Annex IV Point 2 (design & validation) and the design-rationale");
  L.push("> history; it does **not** satisfy art. 12 runtime logging, and it is not a signed declaration of conformity.");
  L.push("> Verify against the Official Journal text before filing.");
  L.push("");
  L.push("## Annex IV coverage map");
  L.push("");
  L.push("| Annex IV point | runward supplies | Required from the provider |");
  L.push("|---|---|---|");
  L.push("| 1. General description | UI, HW/SW/firmware notes | intended purpose, provider, versioning, distribution |");
  L.push("| 2. Elements & development | **architecture, validation procedures + metrics, cybersecurity (manifest + rubric + threat model); design choices, alternatives, assumptions, pre-determined changes = the ADR journal** | third-party sourcing/licensing, sign-off on test logs |");
  L.push("| 3. Monitoring & control | accuracy characterization, input-data specs, oversight tooling | fundamental-rights / discrimination risk sourcing |");
  L.push("| 4. Performance metrics | metric-choice justification (rubric) | — |");
  L.push("| 5. Risk management (art. 9) | technical inputs (threat model, testing) | **risk acceptance / RMS governance** |");
  L.push("| 6. Lifecycle changes | engineering change record (ADR journal) | release/change-management governance |");
  L.push("| 7. Harmonised standards | technical notes | **standards selection** (compliance strategy) |");
  L.push("| 8. Declaration of conformity | — | **signed legal act (art. 47)** |");
  L.push("| 9. Post-market monitoring | telemetry/logging backbone | **post-market monitoring plan (art. 72)** |");
  L.push("");
  L.push("## Point 2 — design decisions (ADR journal, near-verbatim to the Annex IV requirement)");
  L.push("");
  L.push(...adrTableLines(inputs));
  L.push("");
  L.push("## Agentic-risk coverage (OWASP ASI → Point 2 cybersecurity / Point 5 risk)");
  L.push("");
  L.push(...asiTableLines(inputs));
  L.push("");
  L.push("## Control-implementation status (feeds Point 2 validation)");
  L.push("");
  L.push(...confTableLines(inputs));
  L.push("");
  L.push("## Required from the provider (runward cannot produce this)");
  L.push("");
  L.push("- **Point 1** general description (intended purpose, provider, versioning) · **Point 5** RMS governance & risk acceptance (art. 9).");
  L.push("- **Point 7** harmonised-standards selection · **Point 8** the signed **EU declaration of conformity** (art. 47) · **Point 9** the **post-market monitoring plan** (art. 72).");
  L.push("- **Art. 12 runtime event logs** — produced by the running system, not by runward.");
  L.push("");
  L.push("_Engineering framing, not legal advice; Annex IV wording moves — confirm against the Official Journal (Reg. (EU) 2024/1689) before filing._");
  L.push("");
  return L.join("\n") + "\n";
}

// ── OSCAL export (ADR-0016) — the machine-readable interop layer, so the evidence flows into GRC/auditor tools ──

/** A deterministic RFC-4122-shaped UUID derived from a stable seed (SHA-256), so two runs on the same
 *  artifacts produce byte-identical OSCAL — no random UUIDs to break the determinism invariant. */
function detUuid(seed: string): string {
  const b = createHash("sha256").update(`runward-oscal:${seed}`).digest("hex").slice(0, 32).split("");
  b[12] = "5"; // version 5 (name-based)
  b[16] = ((parseInt(b[16], 16) & 0x3) | 0x8).toString(16); // RFC-4122 variant
  const s = b.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

const OSCAL_VERSION = "1.1.2";
const ASI_CATALOG = "https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/";

/**
 * Render the OWASP ASI control coverage as an OSCAL component-definition (JSON) — regime-neutral, the
 * universal machine-readable layer. Each ASI category is a control whose implementation-status is
 * derived from the mission's conformance manifest; evidence links back to the readiness draft. It is
 * labelled a DRAFT / supporting evidence in the metadata remarks — never a compliance claim.
 */
export function renderOscal(inputs: ComplianceInputs, missionName: string, generatedAt: string): string {
  const ns = missionName || "mission";
  const irs = Object.keys(ASI_LABELS).map((id) => {
    const slugs = inputs.asiCoverage.get(id) ?? [];
    const statuses = slugs.map((s) => inputs.conformance.find((c) => c.rule === s)?.status).filter(Boolean) as string[];
    let impl: string;
    if (slugs.length === 0) impl = "planned";                                   // no rule maps this risk — a gap
    else if (statuses.length > 0 && statuses.every((s) => s === "applied")) impl = "implemented";
    else impl = "partial";                                                       // mapped, but deviated / n-a / not yet in a manifest
    return {
      uuid: detUuid(`${ns}:ir:${id}`),
      "control-id": `asi-${id.slice(3)}`,
      description: `${id} ${ASI_LABELS[id]}. ${slugs.length ? "Addressed by rules: " + slugs.join(", ") + "." : "No rule mapped — gap to assess."}`,
      props: [{ name: "implementation-status", value: impl }],
      links: [{ href: "./iso-42001-readiness.md", rel: "reference", text: "runward assessment-readiness draft" }],
    };
  });

  const doc = {
    "component-definition": {
      uuid: detUuid(`${ns}:component-definition`),
      metadata: {
        title: `runward — agentic-security control evidence (${missionName})`,
        "last-modified": `${generatedAt}T00:00:00Z`,
        version: generatedAt,
        "oscal-version": OSCAL_VERSION,
        remarks: "Assessment-readiness DRAFT, assembled deterministically by runward from ratified engineering artifacts (rule to OWASP ASI mapping, conformance manifest, ADR journal). Supporting evidence only — NOT a compliance claim, NOT a certification, NOT a conformity assessment. Applicability, risk acceptance and management sign-off are the operator's.",
      },
      components: [{
        uuid: detUuid(`${ns}:component`),
        type: "software",
        title: missionName,
        description: "The agentic system governed by this runward mission.",
        "control-implementations": [{
          uuid: detUuid(`${ns}:control-implementation`),
          source: ASI_CATALOG,
          description: "OWASP Top 10 for Agentic Applications (ASI01–ASI10) coverage, derived from the mission's craft-rule mapping and conformance manifest.",
          "implemented-requirements": irs,
        }],
      }],
    },
  };
  return JSON.stringify(doc, null, 2) + "\n";
}
