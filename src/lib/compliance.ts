import { createHash } from "node:crypto";
import { GATE_NON_SCOPE } from "./rules.js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseManifest, GATED_DELIVERABLES } from "./conformance.js";
import { TEMPLATES } from "./paths.js";
import { regimeLensId, type RegimeMapping } from "./regimes.js";

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
  /**
   * The gate's own answer on this mission, when the caller has one.
   *
   * The pack used to be assembled without ever asking. Measured 2026-08-26 by two independent
   * auditors: the OSCAL was BYTE-IDENTICAL between a green gate and the same mission with every
   * `applied` pointer redirected to files that do not exist (18 conformance gaps, exit 1), and it
   * still declared controls `implemented`. `grep -ic 'verdict|exit|failed'` over the pack returned
   * zero. This is the artifact that leaves the building for a third-party GRC tool, where no prose
   * follows it, and its own remarks assert the evidence RESOLVES.
   */
  verdict?: { clean: boolean; strict: boolean; exitCode: number; conformanceGaps: number; typed: number; prose: number } | null;
}

function readRules(missionDir: string): RuleAsi[] {
  // The mission's own rules if present (possibly customized), else the package rules — where the
  // shipped OWASP ASI mapping lives (mirrors expectedRules in conformance.ts).
  const missionRules = join(missionDir, "rules");
  const dir = existsSync(missionRules) ? missionRules : join(TEMPLATES, "rules");
  if (!existsSync(dir)) return [];
  const out: RuleAsi[] = [];
  // Sorted: the ASI coverage lists and the OSCAL derive from this order, so it must be deterministic
  // across filesystems (readdirSync order is not guaranteed) for the byte-identity invariant to hold.
  for (const f of readdirSync(dir).sort()) {
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

/** Render the ISO/IEC 42001 assessment-readiness draft — the technical-evidence layer + the human-gap
 *  list. The clause references and the operator-required list come from the versioned lens (ADR-0022). */
export function renderIso42001Readiness(inputs: ComplianceInputs, generatedAt: string, lens: RegimeMapping): string {
  const cl = lens.clauses ?? {};
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
  L.push(`> Lens: ${lens.label} (mapping version ${lens.version}) — \`${regimeLensId(lens)}\`.`);
  L.push("");

  // ADR-0040: the verdict travels with its declared blind zone — an assessor reading green also
  // reads what green does not prove, once, gate-wide (per-rule nonScope narrows it in rules --json).
  L.push("> **Declared non-scope of every green row (ADR-0040).** " + GATE_NON_SCOPE);
  L.push("");

  L.push("## 1. Agentic-risk coverage (OWASP ASI → your rules)");
  L.push("");
  L.push(`Feeds the ISO 42001 risk assessment (${cl.riskAssessment}) and control selection (${cl.controlSelection}): which agentic-security risks are addressed by named engineering rules.`);
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
  L.push(`Feeds the Statement of Applicability's implementation-status + evidence columns (${cl.controlSelection}). From your mission's manifests: **${counts.applied} applied · ${counts.deviated} deviated · ${counts["n/a"]} n/a** across ${inputs.conformance.length} accounted rule(s).`);
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
  L.push(`The "key design choices, alternatives, and re-evaluation triggers" an ISO 42001 auditor expects (records under ${cl.annexControls} control groups).`);
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
  L.push(`- Threat model (feeds risk assessment ${cl.riskAssessment}): ${inputs.threatModel ? "**present** — confirm it is filled, not a raw template" : "**missing**"}`);
  L.push(`- Evaluation rubric (feeds impact/validation analysis): ${inputs.evalRubric ? "**present** — confirm it is filled" : "**missing**"}`);
  L.push("");

  L.push("## Required from the operator / organization (runward cannot produce this)");
  L.push("");
  L.push("These sections are managerial, legal or organizational — no tool can assemble them from engineering artifacts:");
  L.push("");
  for (const item of lens.operatorRequired) L.push(`- ${item}`);
  L.push("");
  L.push(`_Regime mapping is dated engineering framing, not legal advice; ${lens.disclaimerTail}_`);
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
 *  documentation, and the design decisions; GOVERN and risk-tolerance stay the operator's.
 *  The crosswalk targets and the operator-required functions come from the versioned lens (ADR-0022). */
export function renderNistAiRmf(inputs: ComplianceInputs, generatedAt: string, lens: RegimeMapping): string {
  const c = confCounts(inputs);
  const L: string[] = [];
  L.push("# NIST AI RMF — assessment-readiness draft");
  L.push("");
  L.push(`> **Draft, incomplete — not a compliance claim.** Assembled by \`runward compliance nist-ai-rmf\` on ${generatedAt},`);
  L.push("> deterministically from ratified engineering artifacts (no model call). The AI RMF is **voluntary guidance**");
  L.push("> with no pass/fail and no certification; this populates the MEASURE/documentation evidence and an ASI crosswalk,");
  L.push("> while GOVERN, risk tolerance and go/no-go stay the operator's. Verify the current AI RMF text before use.");
  L.push(`> Lens: ${lens.label} (mapping version ${lens.version}) — \`${regimeLensId(lens)}\`.`);
  L.push("");
  // ADR-0040: the verdict travels with its declared blind zone, in EVERY pack and not only the ISO
  // one. Measured on 2026-08-06: this reservation appeared once in the ISO/IEC 42001 draft and zero
  // times in the NIST AI RMF draft, the EU AI Act draft and the OSCAL component-definition. The pack
  // that leaves for a third-party GRC tool was the one that carried no caveat, which is how a
  // qualified statement becomes an unqualified one on the way out.
  L.push("> **Declared non-scope of every green row (ADR-0040).** " + GATE_NON_SCOPE);
  L.push("");
  L.push("## 1. Agentic-risk crosswalk (OWASP ASI → AI RMF)");
  L.push("");
  L.push(`An indicative engineering crosswalk (not NIST-endorsed): ${lens.crosswalk?.primary}. Confirm subcategory selection against ${lens.crosswalk?.confirmAgainst}.`);
  L.push("");
  L.push(...asiTableLines(inputs));
  L.push("");
  L.push("## 2. MEASURE / TEVV documentation");
  L.push("");
  L.push(`Feeds ${lens.measureRef} — documented, repeatable test methodology and results. From your mission: **${c.applied} applied · ${c.deviated} deviated · ${c["n/a"]} n/a** across ${inputs.conformance.length} rule(s).`);
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
  for (const item of lens.operatorRequired) L.push(`- ${item}`);
  L.push("");
  L.push(`_Indicative engineering framing, not legal advice; ${lens.disclaimerTail}_`);
  L.push("");
  return L.join("\n") + "\n";
}

/** Render the EU AI Act Annex IV assessment-readiness draft — strong on Point 2 (design/architecture/
 *  validation) and the design-rationale/change history (the ADR journal); RMS, standards, declaration
 *  and post-market plan stay the provider's. The applicability date, article references, Annex IV
 *  rows and provider-required list come from the versioned lens (ADR-0022). */
export function renderEuAiAct(inputs: ComplianceInputs, generatedAt: string, lens: RegimeMapping): string {
  const L: string[] = [];
  L.push("# EU AI Act — Annex IV technical documentation — assessment-readiness draft");
  L.push("");
  L.push(`> **Draft, incomplete — not a conformity assessment.** Assembled by \`runward compliance eu-ai-act\` on ${generatedAt},`);
  L.push("> deterministically from ratified engineering artifacts (no model call). High-risk obligations bind from");
  L.push(`> **${lens.highRisk?.bindFrom}** (${lens.highRisk?.scope}). This populates Annex IV Point 2 (design & validation) and the design-rationale`);
  L.push(`> history; it does **not** satisfy ${lens.articles?.runtimeLogging} runtime logging, and it is not a signed declaration of conformity.`);
  L.push("> Verify against the Official Journal text before filing.");
  L.push(`> Lens: ${lens.label} (mapping version ${lens.version}) — \`${regimeLensId(lens)}\`.`);
  L.push("");
  // ADR-0040: the verdict travels with its declared blind zone, in EVERY pack. Measured 2026-08-06:
  // this reservation appeared only in the ISO/IEC 42001 draft. The pack a regulated buyer files is
  // the one that carried no caveat.
  L.push("> **Declared non-scope of every green row (ADR-0040).** " + GATE_NON_SCOPE);
  L.push("");
  L.push("## Annex IV coverage map");
  L.push("");
  L.push("| Annex IV point | runward supplies | Required from the provider |");
  L.push("|---|---|---|");
  for (const r of lens.annexIv ?? []) L.push(`| ${r.point} | ${r.supplies} | ${r.provider} |`);
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
  for (const item of lens.operatorRequired) L.push(`- ${item}`);
  L.push("");
  L.push(`_Engineering framing, not legal advice; ${lens.disclaimerTail}_`);
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

const OSCAL_VERSION = "1.2.2";
const ASI_CATALOG = "https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/";

/**
 * Render the OWASP ASI control coverage as an OSCAL component-definition (JSON) — regime-neutral, the
 * universal machine-readable layer. Each ASI category is a control whose implementation-status is
 * derived from the mission's conformance manifest; evidence links back to the readiness draft. It is
 * labelled a DRAFT / supporting evidence in the metadata remarks — never a compliance claim.
 * `lensId` stamps which regime mapping version framed the pack (metadata prop, ADR-0022); the
 * control structure itself stays regime-neutral.
 */
export function renderOscal(inputs: ComplianceInputs, missionName: string, generatedAt: string, lensId?: string): string {
  const ns = missionName || "mission";
  // The link points at the readiness draft co-generated with this pack — the one whose lens framed it.
  const regime = lensId ? lensId.split("@")[0] : "iso-42001";
  const readinessHref = `./${regime}-readiness.md`;
  // `implemented` IS OSCAL'S WORD FOR "THE CONTROL IS IMPLEMENTED", and it may not rest on a status
  // column alone. A row reads `applied` whether the gate opened its evidence or accepted a sentence
  // on the operator's judgment, and it reads `applied` on a mission the gate refuses outright. So
  // the strongest status this pack can carry requires the gate to have RUN, in strict mode, and to
  // have accepted — anything else is `partial`, which is the honest word for "declared, not
  // verified". When no verdict was supplied the pack cannot claim more than `partial` either: an
  // unasked gate is not a passed one.
  const gateAccepts = inputs.verdict?.clean === true && inputs.verdict?.strict === true;
  const irs = Object.keys(ASI_LABELS).map((id) => {
    const slugs = inputs.asiCoverage.get(id) ?? [];
    // Aggregate EVERY manifest row of EVERY rule mapping this ASI, across all gated deliverables —
    // a rule can appear in more than one manifest (spec §3). `find` (first row) made the status depend
    // on deliverable order and could report `implemented` where a later `deviated` row means `partial`.
    const statuses = slugs.flatMap((s) => inputs.conformance.filter((c) => c.rule === s).map((c) => c.status));
    let impl: string;
    if (slugs.length === 0) impl = "planned";                                   // no rule maps this risk — a gap
    else if (statuses.length > 0 && statuses.every((s) => s === "applied") && gateAccepts) impl = "implemented";
    else impl = "partial";                                                       // mapped, but deviated / n-a / not yet in a manifest, or a gate that refuses
    return {
      uuid: detUuid(`${ns}:ir:${id}`),
      "control-id": `asi-${id.slice(3)}`,
      description: `${id} ${ASI_LABELS[id]}. ${slugs.length ? "Addressed by rules: " + slugs.join(", ") + "." : "No rule mapped — gap to assess."}`,
      props: [
        { name: "implementation-status", value: impl },
        // THE LIMIT TRAVELS ON THE REQUIREMENT, not only in a document-root remark. sarif.ts already
        // applies this discipline — it repeats the caveat in EVERY rule's fullDescription "so a
        // consumer that keeps the findings and drops the non-scope has to drop it deliberately" —
        // and this pack, the one that leaves for a third party, kept it at the root where an
        // ingesting tool never looks. compliance.ts's own comment states the principle: "A caveat
        // that stays home is a caveat that was not made."
        { name: "runward-gate-non-scope", value: GATE_NON_SCOPE },
        // What the gate ACTUALLY answered on this mission, beside the status derived from it. An
        // assessor reading `implemented` can now see, in the same object, whether the gate ran, in
        // which mode, and whether it accepted.
        { name: "runward-gate-verdict", value: inputs.verdict
            ? `${inputs.verdict.clean ? "clean" : "gaps"} (${inputs.verdict.strict ? "--strict" : "presence"}, exit ${inputs.verdict.exitCode}, ${inputs.verdict.conformanceGaps} conformance gap(s))`
            : "not run for this pack" },
      ],
      links: [{ href: readinessHref, rel: "reference", text: "runward assessment-readiness draft" }],
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
        ...(lensId ? { props: [{ name: "runward-regime-lens", value: lensId }] } : {}),
        // ADR-0040: the declared non-scope travels with the pack, and this pack most of all. Measured
        // on 2026-08-06, the reservation appeared only in the ISO/IEC 42001 markdown draft and NOT
        // here — yet this is the artifact that leaves for a third-party GRC tool, where the prose
        // around it does not follow. A caveat that stays home is a caveat that was not made.
        remarks: "Assessment-readiness DRAFT, assembled deterministically by runward from ratified engineering artifacts (rule to OWASP ASI mapping, conformance manifest, ADR journal). Supporting evidence only — NOT a compliance claim, NOT a certification, NOT a conformity assessment. Applicability, risk acceptance and management sign-off are the operator's."
          + " DECLARED NON-SCOPE OF EVERY GREEN ROW (ADR-0040): " + GATE_NON_SCOPE,
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
