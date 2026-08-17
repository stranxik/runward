import { readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { parseEvidencePointers, symbolPresent, type EvidencePointer } from "./evidence.js";
import { isJUnitReport, junitTestResult, isSarifReport, sarifRuleResult, isLcovReport, lcovFileResult } from "./tool-adapters.js";

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
  "Checks that each acceptance criterion is LINKED to a present, non-empty artifact, at the depth the pointer declares (#SYMBOL at an identifier boundary — or, on a committed SARIF log, a rule with no open finding; on a committed lcov report, a source file something actually exercised; ::NAME recorded green in a committed JUnit report) — never that the artifact satisfies the criterion. Semantic satisfaction stays the operator's judgment (with the advisory verify workflow, ADR-0007); it is never mechanized here.";

export interface SpecCriterion { line: number; text: string; linked: boolean; reason: string; }
export interface SpecReport { hasSection: boolean; criteria: SpecCriterion[]; unlinked: number; }

const CRITERIA_HEADING = /^#{1,6}\s.*\b(acceptance|criteria)\b/i;
const LIST_ITEM = /^(?:[-*]\s|\d+\.\s)/;

/**
 * Verify ONE pointer at the depth it declares — the same checks, at the same depth, as the gate's
 * evidence layer (evidence.ts). The first version verified presence + non-vacuity of the PATH only
 * and silently dropped `#SYMBOL` and `::NAME`: a criterion linked to an absent symbol or a red test
 * case read "linked" — the exact silent degradation `symbolDeclared` was created to refuse
 * ("a symbol was requested and lost", evidence.ts), reproduced in the newest feature and caught by
 * the 2026-08-14 audit. Reuses `symbolPresent` and `junitTestResult`; never re-implements them.
 */
function pointerLinks(p: EvidencePointer, baseDir: string): { ok: boolean; reason?: string } {
  if (p.malformed) return { ok: false, reason: `${p.raw} — ${p.malformed}` };
  const base = resolve(baseDir);
  const abs = resolve(base, p.path!);
  const rel = relative(base, abs);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return { ok: false, reason: `${p.raw} — points outside the project tree` }; // never link out of the tree
  let content: string;
  try {
    if (!statSync(abs).isFile()) return { ok: false, reason: `${p.raw} — not a file` };
    content = readFileSync(abs, "utf8");
  } catch { return { ok: false, reason: `${p.raw} — the artifact is not present` }; }
  if (content.trim().length === 0) return { ok: false, reason: `${p.raw} — the artifact is empty` };
  if (p.line !== undefined && content.split("\n").length < p.line) return { ok: false, reason: `${p.raw} — the file has fewer than ${p.line} lines` };
  // A `#` / `::` the author WROTE must verify or fail loud — never be silently dropped.
  if (p.symbolDeclared && (p.symbol === undefined || p.symbol.trim().length < 2)) return { ok: false, reason: `${p.raw} — the \`#\` names no usable symbol` };
  if (p.symbol !== undefined) {
    // ADR-0056: a `#ruleId` on a committed SARIF log resolves structurally (the scan knows the rule
    // and records no open finding), never by substring — the id is in the JSON precisely because
    // there are findings. Same routing as the gate's evidence layer, always.
    if (isSarifReport(content)) {
      const s = sarifRuleResult(content, p.symbol);
      if (s === "unparseable") return { ok: false, reason: `${p.raw} — the file looks like SARIF but is not valid JSON` };
      if (s === "absent") return { ok: false, reason: `${p.raw} — no rule "${p.symbol}" in the committed scan` };
      if (s === "findings") return { ok: false, reason: `${p.raw} — the committed scan records open finding(s) for rule "${p.symbol}" — a red scan is not evidence` };
    } else if (isLcovReport(content)) {
      const l = lcovFileResult(content, p.symbol);
      if (l === "absent") return { ok: false, reason: `${p.raw} — no record for "${p.symbol}" in the committed coverage report` };
      if (l === "uncovered") return { ok: false, reason: `${p.raw} — "${p.symbol}" is measured but nothing executed it (0 covered lines)` };
    } else if (!symbolPresent(content, p.symbol)) {
      return { ok: false, reason: `${p.raw} — symbol "${p.symbol}" not found (identifier-boundary match)` };
    }
  }
  if (p.testNameDeclared && (p.testName === undefined || p.testName.trim().length === 0)) return { ok: false, reason: `${p.raw} — the \`::\` names no test` };
  if (p.testName !== undefined) {
    if (isJUnitReport(content)) {
      const r = junitTestResult(content, p.testName);
      if (r === "absent") return { ok: false, reason: `${p.raw} — no JUnit test case named "${p.testName}" in the committed report` };
      if (r === "fail") return { ok: false, reason: `${p.raw} — the JUnit case "${p.testName}" is present but not green — a red test is not evidence` };
    } else if (!content.includes(p.testName)) {
      return { ok: false, reason: `${p.raw} — test named "${p.testName}" not found in the file` };
    }
  }
  return { ok: true };
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
    // EVERY pointer must verify at its declared depth. The previous `some()` let one green path
    // pointer mask a broken `#SYMBOL` beside it — a written check silently not performed.
    const failures = pointers.map((p) => pointerLinks(p, baseDir)).filter((r) => !r.ok);
    criteria.push(failures.length === 0
      ? { line, text, linked: true, reason: "linked" }
      : { line, text, linked: false, reason: failures.map((f) => f.reason).join(" · ") });
  }
  return { hasSection: true, criteria, unlinked: criteria.filter((c) => !c.linked).length };
}

/** A criterion identifier as specs actually write them: `AC1`, `AC-12`, `FR-3`, `NFR2`, `REQ-7`.
 *  Deliberately narrow: an over-eager pattern would call every capitalised token an identifier and
 *  turn prose into dangling references, which is the false red this check must not manufacture. */
const CRITERION_ID = /\b((?:AC|FR|NFR|REQ|US)-?\d{1,3})\b/g;

export interface BundleFile { path: string; content: string }
export interface DanglingRef { file: string; line: number; id: string }
export interface BundleReport {
  files: Array<{ path: string; hasSection: boolean; criteria: SpecCriterion[] }>;
  criteria: number;
  unlinked: number;
  /** Declared anywhere in the bundle: `AC3` on a criterion line. */
  declaredIds: string[];
  /** Referenced by a bundle file and declared by none — the delta is internally broken (ADR-0056:51,
   *  "is the spec-delta internally consistent"). A task pointing at a criterion the spec does not
   *  declare is a deterministic inconsistency: no judgment of meaning is needed to see it. */
  dangling: DanglingRef[];
  /** True when at least one file declares an acceptance-criteria section. */
  hasAnySection: boolean;
}

/**
 * Spec conformance across a BUNDLE (spec-kit's `spec.md` + `plan.md` + `tasks.md`, OpenSpec's change
 * directory, a constitution beside them). Two deterministic questions, and only these two:
 *
 *   1. LINKAGE — every acceptance criterion, in every file that declares one, resolves to a present
 *      artifact at the depth its pointer declares (the single-file check, applied file by file).
 *   2. INTERNAL CONSISTENCY — every criterion identifier the bundle REFERENCES is DECLARED by some
 *      file of the bundle. `tasks.md` implementing AC7 when the spec declares AC1..AC5 is broken
 *      whatever AC7 was supposed to mean.
 *
 * Never whether a task implements its criterion, whether the plan follows the spec, or whether the
 * bundle is complete — all semantic, all the operator's (SPEC_NON_SCOPE).
 */
export function specBundleConformance(files: BundleFile[], baseDir: string): BundleReport {
  const per = files.map((f) => {
    const r = specConformance(f.content, baseDir);
    return { path: f.path, hasSection: r.hasSection, criteria: r.criteria };
  });

  // Declared: an identifier appearing ON a criterion line of a file that has a criteria section.
  const declared = new Set<string>();
  for (const f of per) for (const c of f.criteria) for (const m of c.text.matchAll(CRITERION_ID)) declared.add(norm(m[1]));

  // Referenced: an identifier appearing anywhere in a bundle file, EXCEPT on the criterion lines
  // themselves (those are declarations, not references).
  const dangling: DanglingRef[] = [];
  for (const f of files) {
    const declaredLines = new Set(per.find((p) => p.path === f.path)?.criteria.map((c) => c.line) ?? []);
    f.content.split("\n").forEach((line, i) => {
      if (declaredLines.has(i + 1)) return;
      for (const m of line.matchAll(CRITERION_ID)) {
        const id = norm(m[1]);
        if (!declared.has(id) && !dangling.some((d) => d.file === f.path && d.line === i + 1 && d.id === m[1])) {
          dangling.push({ file: f.path, line: i + 1, id: m[1] });
        }
      }
    });
  }

  return {
    files: per,
    criteria: per.reduce((n, f) => n + f.criteria.length, 0),
    unlinked: per.reduce((n, f) => n + f.criteria.filter((c) => !c.linked).length, 0),
    declaredIds: [...declared].sort(),
    dangling,
    hasAnySection: per.some((f) => f.hasSection),
  };
}

/** `AC-3` and `AC3` are the same criterion written twice; comparing them literally would invent a
 *  dangling reference out of a hyphen. */
function norm(id: string): string {
  return id.replace("-", "").toUpperCase();
}
