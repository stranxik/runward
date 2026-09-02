// The workflow contract (ADR-0067, W1): the frontmatter a procedure opens with, and its readers.
//
// For two months the 11 workflows were copied, counted and cited — never read: 10,071 words of
// method whose only mechanical property was existing. The contract makes a procedure's promises
// data: which phase it serves, which deliverables it produces (and which of those the gate seals),
// which artifacts must be filled before its phase is judged, which committed reports its imposed
// controls must leave, and the one sentence it does not claim. Same head-grammar discipline as the
// rules corpus (hand-parsed `key: value` and `key: [a, b]` lines — no new dependency enters the
// verdict path), same precedence (mission copy over package copy), same confinement (a path with
// `..` or a leading `/` makes the contract malformed and is never followed — the evidence.ts
// posture, restated where a second grammar begins).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES } from "./paths.js";
import { GATED_DELIVERABLES } from "./conformance.js";

/** The natures a control may demand — exactly the strict adapters already shipped (ADR-0067). */
export const CONTROL_KINDS = new Set(["junit", "sarif", "lcov", "cobertura", "eslint", "cyclonedx"]);

export interface WorkflowContract {
  /** The slug — must equal the filename stem. */
  workflow: string;
  /** The gate it serves, or "none" for advisory procedures (verify, review, method…). */
  phase: string;
  gate: "strict" | "none";
  /** Mission-relative paths this procedure produces; `gated` marks a sealed deliverable. */
  produces: Array<{ path: string; gated: boolean }>;
  /** Artifacts that must read `filled` before this procedure's phase is judged. */
  requires: string[];
  /** The committed reports the procedure's imposed controls must leave. */
  controls: Array<{ kind: string; report: string }>;
  nonScope: string;
  /** Everything wrong with the contract, named — a malformed contract is a violation, never a
   *  silence (the `malformed`-pointer precedent). Empty = the contract holds. */
  malformed: string[];
  /** Where the contract was read from (the precedence made visible). */
  source: "mission" | "package";
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

function field(fm: string, key: string): string | null {
  const m = fm.match(new RegExp(`^${key}\\s*:\\s*(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

function listField(fm: string, key: string): string[] {
  const raw = field(fm, key);
  if (!raw) return [];
  const inner = raw.replace(/^\[/, "").replace(/\]$/, "");
  return inner.split(",").map((x) => x.trim()).filter(Boolean);
}

/** A mission-relative path stays inside the judged tree, or the contract is malformed. */
function confined(p: string): boolean {
  return !p.startsWith("/") && !/^[A-Za-z]:/.test(p) && !p.split("/").includes("..");
}

/** Parse one workflow file's contract. A file with NO frontmatter returns null — "no contract" is
 *  a state the callers surface (W2 poses the 11; until then absence is the measured truth, not an
 *  error invented retroactively). */
export function parseWorkflowContract(filename: string, content: string): WorkflowContract | null {
  const fm = content.match(FRONTMATTER)?.[1];
  if (!fm) return null;
  const malformed: string[] = [];
  const stem = filename.replace(/\.md$/, "");
  const workflow = field(fm, "workflow") ?? "";
  if (workflow !== stem) malformed.push(`workflow: "${workflow}" does not match the filename "${stem}" — the slug is the join key, never a label`);
  const phase = field(fm, "phase") ?? "";
  if (!phase) malformed.push("phase: missing — the gate it serves, or none");
  const gateRaw = field(fm, "gate") ?? "";
  if (gateRaw !== "strict" && gateRaw !== "none") malformed.push(`gate: "${gateRaw}" — strict or none, nothing else`);
  const produces = listField(fm, "produces").map((entry) => {
    const gated = /#gated$/.test(entry);
    const path = entry.replace(/#gated$/, "").trim();
    if (!confined(path)) malformed.push(`produces: "${path}" escapes the judged tree — confined paths only`);
    return { path, gated };
  });
  const requires = listField(fm, "requires");
  for (const r of requires) if (!confined(r)) malformed.push(`requires: "${r}" escapes the judged tree`);
  const controls = listField(fm, "controls").map((entry) => {
    const i = entry.indexOf(":");
    const kind = i === -1 ? entry : entry.slice(0, i).trim();
    const report = i === -1 ? "" : entry.slice(i + 1).trim();
    if (!CONTROL_KINDS.has(kind)) malformed.push(`controls: "${kind}" is not a kind the strict adapters read (${[...CONTROL_KINDS].join(" | ")})`);
    if (!report) malformed.push(`controls: "${entry}" names no committed report path`);
    else if (!confined(report)) malformed.push(`controls: report "${report}" escapes the judged tree`);
    return { kind, report };
  });
  const nonScope = field(fm, "nonScope") ?? "";
  if (!nonScope) malformed.push("nonScope: missing — every contract says the one sentence it does not claim");
  return { workflow: stem, phase, gate: gateRaw === "strict" ? "strict" : "none", produces, requires, controls, nonScope, malformed, source: "package" };
}

/** Every workflow's contract, mission copy taking precedence over the package copy — the
 *  rules-corpus precedence, applied to the second corpus. `null` entries are files with no
 *  frontmatter yet. Sorted by filename: same tree, same order, every OS (RWD-2026-0101). */
export function readWorkflowContracts(missionDir: string): Array<{ file: string; contract: WorkflowContract | null }> {
  const missionWf = join(missionDir, "workflows");
  const packageWf = join(TEMPLATES, "workflows");
  const files = new Set<string>();
  for (const dir of [packageWf, missionWf]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".md")) files.add(f);
  }
  return [...files].sort().map((f) => {
    const missionPath = join(missionWf, f);
    const fromMission = existsSync(missionPath);
    const content = readFileSync(fromMission ? missionPath : join(packageWf, f), "utf8");
    const contract = parseWorkflowContract(f, content);
    if (contract) contract.source = fromMission ? "mission" : "package";
    return { file: f, contract };
  });
}

/** The produces↔gate join, both ways, by descriptor and never by position (RWD-2026-0089's
 *  family): every `#gated` path must be a gated deliverable, and every gated deliverable must be
 *  claimed by exactly one contract. Returns the named breaks; empty when the join holds — and
 *  silent while NO contract exists yet (the pre-W2 state is absence, not breakage). */
export function producesGateJoin(contracts: Array<{ file: string; contract: WorkflowContract | null }>): string[] {
  const present = contracts.filter((c) => c.contract !== null);
  if (present.length === 0) return [];
  const out: string[] = [];
  const claims = new Map<string, string[]>();
  for (const { file, contract } of present) {
    for (const p of contract!.produces.filter((x) => x.gated)) {
      claims.set(p.path, [...(claims.get(p.path) ?? []), file]);
      if (!GATED_DELIVERABLES.some((g) => `runward/${g.deliverable}` === p.path)) {
        out.push(`${file}: produces "${p.path}" as gated, and the gate seals no such deliverable`);
      }
    }
  }
  for (const g of GATED_DELIVERABLES) {
    const path = `runward/${g.deliverable}`;
    const owners = claims.get(path) ?? [];
    if (owners.length === 0) out.push(`no contract claims the gated deliverable "${path}" — a sealed artifact nobody promises is an orphan`);
    else if (owners.length > 1) out.push(`"${path}" is claimed by ${owners.join(" and ")} — a sealed deliverable has exactly one producing procedure`);
  }
  return out;
}
