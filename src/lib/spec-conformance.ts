import { readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { parseEvidencePointers } from "./evidence.js";

/**
 * Deterministic spec/constitution conformance (ADR-0056): the hard verdict the SDD ecosystem
 * (spec-kit, OpenSpec, BMAD) structurally cannot produce, because their gates are LLM prose judgment.
 *
 * It checks LINKAGE, and only linkage: does every declared acceptance criterion carry a typed
 * pointer to a delivered artifact that is present and non-empty. It NEVER judges whether the artifact
 * satisfies the criterion — that is semantic, forever the operator's (with the advisory `verify`
 * loop, ADR-0007). A green criterion means "this criterion is linked to a present artifact", never
 * "this criterion is met". The instant it judged meaning, it would need a model and GATE_NON_SCOPE
 * would break; this module refuses that by construction.
 *
 * Convention, tool-agnostic: acceptance criteria are list items under a heading naming "acceptance"
 * or "criteria"; a criterion is linked when its line carries a resolving `file:`/`test:` pointer.
 */

/** What a spec-conformance check never claims — carried with the verdict, like GATE_NON_SCOPE. */
export const SPEC_NON_SCOPE =
  "Checks that each acceptance criterion is LINKED to a present, non-empty artifact — never that the artifact satisfies the criterion. Semantic satisfaction stays the operator's judgment (with the advisory verify workflow, ADR-0007); it is never mechanized here.";

export interface SpecCriterion { line: number; text: string; linked: boolean; reason: string; }
export interface SpecReport { hasSection: boolean; criteria: SpecCriterion[]; unlinked: number; }

const CRITERIA_HEADING = /^#{1,6}\s.*\b(acceptance|criteria)\b/i;
const LIST_ITEM = /^(?:[-*]\s|\d+\.\s)/;

/** Resolve a project-relative pointer path against the base, contained to the tree, present, non-empty. */
function resolvesPresent(path: string, baseDir: string): boolean {
  const base = resolve(baseDir);
  const abs = resolve(base, path);
  const rel = relative(base, abs);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return false; // never link out of the tree
  try { return statSync(abs).isFile() && readFileSync(abs, "utf8").trim().length > 0; } catch { return false; }
}

export function specConformance(specContent: string, baseDir: string): SpecReport {
  const lines = specContent.split("\n");
  const start = lines.findIndex((l) => CRITERIA_HEADING.test(l));
  if (start === -1) return { hasSection: false, criteria: [], unlinked: 0 };

  const criteria: SpecCriterion[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break; // the next heading of any level ends the section
    const t = lines[i].trim();
    if (!LIST_ITEM.test(t)) continue;
    const line = i + 1;
    const text = t.length > 100 ? t.slice(0, 99) + "…" : t;
    const pointers = parseEvidencePointers(t).filter((p) => (p.kind === "file" || p.kind === "test") && !!p.path);
    if (pointers.length === 0) {
      criteria.push({ line, text, linked: false, reason: "no file:/test: pointer — link this criterion to a delivered artifact" });
      continue;
    }
    const linked = pointers.some((p) => resolvesPresent(p.path!, baseDir));
    criteria.push(linked
      ? { line, text, linked: true, reason: "linked" }
      : { line, text, linked: false, reason: "the linked artifact does not resolve to a present, non-empty file" });
  }
  return { hasSection: true, criteria, unlinked: criteria.filter((c) => !c.linked).length };
}
