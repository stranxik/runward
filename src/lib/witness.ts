/**
 * The witness of a strict verdict (ADR-0089, increment 1, step 3).
 *
 * What this module is. The facts a `check --strict` verdict relied on, written down so that a small
 * program sharing no code with runward can re-check them against the tree: each row the manifests
 * carry, each pointer with what it resolved to and that file's digest, each rule file's digest, the
 * expected rule sets, the cited ADRs and their status words, and the verdict itself with every term
 * that counted against it. Its only specification is `docs/spec/witness.md`; a checker is written from
 * that document, never from this file.
 *
 * What this module is NOT. It is not a second verdict and must never become one. It decides nothing:
 * `verdict`, `causes` and every count are copied from the `Verdict` the command already computed, and
 * the facts below are read with the same exported functions the verdict path calls, on the same
 * arguments (`readManifest`, `expectedRules`, `parseEvidencePointers`, `resolveEvidencePath`,
 * `adrDecision`, `symbolPresent`, `junitTestCases`, …). Where a function returned only a boolean and
 * the witness needs a location, the location is found with the same function applied line by line,
 * or read from a list the verdict's own function now returns (`outsideManifestLines`,
 * `junitTestCases`); nothing here re-implements a check.
 *
 * Purity. Reads only, like the verdict (ADR-0054): no clock, no network, no spawn, no git, and no
 * absolute path in the output, so the same tree and the same runward version give the same bytes.
 * Writing the file is the command's gesture (`check.ts`), not this module's.
 */
import { accessSync, constants, existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import {
  GATED_DELIVERABLES, adrDecision, adrPath, adrStatusWord, evidencePathTokens, expectedRules,
  manifestSections, proposedStatus, readManifest, rowDigest, ruleSignatures, rulesDir,
} from "./conformance.js";
import {
  normalizedFileSha256, outsideManifestLines, parseEvidencePointers, prosePointerSpellings, repoRootAbove,
  resolutionBases, resolveEvidencePath, symbolPresent, type EvidencePointer,
} from "./evidence.js";
import {
  coberturaFileResult, eslintFileResult, isCoberturaReport, isCycloneDxSbom, isEslintReport, isJUnitReport,
  isK6Summary, isLcovReport, isLoadTestReport, isSarifReport, jtlSamplesResult, junitTestCases, k6ThresholdsResult,
  lcovFileResult, sarifRuleResult, sbomComponentPresent,
} from "./tool-adapters.js";
import { readScaffoldLock, readPublishedRuleHashes, hashText } from "./scaffold-lock.js";
import { ruleSetDir } from "./rules.js";
import { EXPECTED_MAPPED } from "./constants.js";
import { PHASES } from "./mission.js";
import { TEMPLATES, toPosix } from "./paths.js";
import type { Verdict } from "./verdict.js";

/** The schema identifier. Expand only (ADR-0030): a field may be added under this identifier, never
 *  renamed, removed or given a new meaning; a change of meaning is `runward-witness/2`. */
export const WITNESS_SCHEMA = "runward-witness/1";

/** The families of the strict verdict this version of the witness does not carry the facts of, so a
 *  checker cannot re-check them. Named, so that "the checker agreed" is never read as covering them. */
export const NOT_WITNESSED: Record<string, string> = {
  "deliverable-state": "whether a deliverable is filled is judged against the package's templates (placeholders, divergence floor); the witness carries each deliverable's digest and the state the verdict read, not the template comparison",
  "corpus-history": "whether a rule's text is one runward published, and which rules the package ships, are read from the installed package (templates/rule-history.json, templates/rules/); the witness pins their digests and does not carry them",
  "signatures": "a signed rule's evidence is matched against its `signature:` regex over the cited text outside the manifest; the witness says which rules are signed, not the match",
  "report-natures": "the result of a symbol read through a SARIF, ESLint, CycloneDX, load-test or coverage report; the witness carries the nature and the result the verdict read, not the facts behind it",
  "on-disk-spelling": "whether a pointer's spelling matches the case the file system holds (a case-insensitive checkout); the verdict's spelling ladder is not witnessed",
  "scaffold-identical": "whether a cited file is still byte for byte a file runward scaffolded; the comparison set comes from the package and the lock",
  "unreadable": "a cited file that exists and cannot be read; the witness records no digest for it",
  "seal": "the evidence seal (evidence-lock.json) and its drift",
  "regulated": "the regulated tier's ratification binding (ADR-0080)",
  "charter": "the delegation charter and the sample ledger (ADR-0088)",
  "workflow-contract": "the workflow contracts (ADR-0067)",
  "hooks": "the operator's hooks; their failures are an input to the verdict, never re-checkable from the tree",
  "disclosures": "readings that never count: the ratification ledger, unmet evidence natures (`requires:`), the critical-scope disclosure",
};

/** Where a pointer resolved from: the three bases, in the order the verdict tries them. */
const BASE_NAMES = ["project", "mission", "deliverable"] as const;

/** Where a path resolved to: the base it resolved from and the real path, project-relative. The
 *  facts about the file itself are in the witness's `files` table, once per file. */
interface Target {
  base: (typeof BASE_NAMES)[number];
  real: string;
}

/** One entry of the `files` table: what the verdict could read in a file a pointer resolved to. */
interface FileFacts {
  within: "project" | "repository";
  regular: boolean;
  sha256: string | null;
  nonEmpty: boolean | null;
  lines: number | null;
  natures: string[];
}

export interface WitnessContext {
  version: string;
  through: string | null;
  hooks: boolean;
  /** The failed hooks, as `check` counted them (one entry per failure, an invalid config being one). */
  hookFailures: string[];
  /** The exit code `check` exits on: the witness's verdict must be this number. */
  exitCode: 0 | 1;
}

const sha256Hex = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

function realpathOr(p: string): string {
  try { return realpathSync(p); } catch { return p; }
}

function isRegularFile(abs: string): boolean {
  try { return statSync(abs).isFile(); } catch { return false; }
}

/** The report detectors that match a text, by the names the spec uses. */
function naturesOf(content: string): string[] {
  const out: string[] = [];
  if (isSarifReport(content)) out.push("sarif");
  if (isEslintReport(content)) out.push("eslint");
  if (isCycloneDxSbom(content)) out.push("sbom");
  if (isLoadTestReport(content)) out.push("loadtest");
  if (isLcovReport(content) || isCoberturaReport(content)) out.push("coverage");
  if (isJUnitReport(content)) out.push("junit");
  return out;
}

/** The result a report-shaped file gives for a symbol, as the verdict reads it (evidence.ts routing
 *  order). Null when the symbol is read as text. */
function reportResult(content: string, symbol: string): { nature: string; result: string } | null {
  if (isSarifReport(content)) return { nature: "sarif", result: sarifRuleResult(content, symbol) };
  if (isEslintReport(content)) return { nature: "eslint", result: eslintFileResult(content, symbol) };
  if (isCycloneDxSbom(content)) return { nature: "sbom", result: sbomComponentPresent(content, symbol) };
  if (isLoadTestReport(content)) return { nature: "loadtest", result: isK6Summary(content) ? k6ThresholdsResult(content, symbol) : jtlSamplesResult(content, symbol) };
  if (isLcovReport(content)) return { nature: "coverage", result: lcovFileResult(content, symbol) };
  if (isCoberturaReport(content)) return { nature: "coverage", result: coberturaFileResult(content, symbol) };
  return null;
}

/** 1-based line of a UTF-16 offset in a text split on LF. */
function lineOf(content: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) n++;
  return n;
}

/** A project-relative POSIX spelling of an absolute real path (may start with `../` when the file
 *  lies in the repository above the project). */
function rel(projectReal: string, abs: string): string {
  return toPosix(relative(projectReal, abs));
}

interface Ctx {
  mission: string;
  projectReal: string;
  /** The `files` table, filled as pointers resolve: real path → facts. */
  files: Map<string, FileFacts>;
}

/** What one path resolved to, read with the verdict's own resolver, base by base. */
function resolveTarget(ctx: Ctx, path: string, bases: string[]): { target: Target | null; unresolved: "absolute" | "outside" | "missing" | null; content: string | null; self: boolean } {
  if (isAbsolute(path)) return { target: null, unresolved: "absolute", content: null, self: false };
  for (let i = 0; i < bases.length; i++) {
    const abs = resolveEvidencePath(path, [bases[i]]);
    if (abs === null) continue;
    const real = rel(ctx.projectReal, abs);
    const regular = isRegularFile(abs);
    let content: string | null = null;
    if (regular) { try { content = readFileSync(abs, "utf8"); } catch { content = null; } }
    if (!ctx.files.has(real)) {
      ctx.files.set(real, {
        within: real === ".." || real.startsWith("../") ? "repository" : "project",
        regular,
        sha256: content === null ? null : normalizedFileSha256(abs),
        nonEmpty: content === null ? null : /\S/.test(content),
        lines: content === null ? null : content.split("\n").length,
        natures: content === null ? [] : naturesOf(content),
      });
    }
    return { target: { base: BASE_NAMES[i], real }, unresolved: null, content, self: false };
  }
  const exists = bases.some((b) => existsSync(resolve(resolve(b), path)));
  return { target: null, unresolved: exists ? "outside" : "missing", content: null, self: false };
}

function pointerFacts(ctx: Ctx, p: EvidencePointer, bases: string[], deliverable: string): Record<string, unknown> {
  // The fields of a pointer depend on its kind, and only the kind's own fields are written
  // (docs/spec/witness.md, "Pointers"): an `adr:` pointer has no path, a `file:` pointer no test name.
  if (p.kind === "adr") {
    return { kind: p.kind, raw: p.raw, malformed: p.malformed ?? null, adr: p.adrId === undefined ? null : adrFacts(ctx, `ADR-${p.adrId}`) };
  }
  const { target, unresolved, content } = resolveTarget(ctx, p.path!, bases);
  const lines = content === null ? [] : content.split("\n");
  if (p.kind === "test") {
    // Where the named test is: each JUnit case the name selects, or the first line carrying it.
    let testAt: number | null = null;
    let junit: Array<{ line: number; green: boolean }> | null = null;
    if (content !== null && p.testName !== undefined) {
      if (isJUnitReport(content)) junit = junitTestCases(content, p.testName).map((x) => ({ line: lineOf(content, x.index), green: x.green }));
      else {
        const i = lines.findIndex((l) => l.includes(p.testName!));
        testAt = i === -1 ? null : i + 1;
      }
    }
    return { kind: p.kind, raw: p.raw, path: p.path!, testName: p.testName ?? null, testNameDeclared: p.testNameDeclared === true,
      target, unresolved, testAt, junit };
  }
  // A `file:` pointer. Locations are read with the verdict's own predicates, line by line.
  let symbolAt: number | null = null, outsideAt: number | null = null;
  let report: { nature: string; result: string } | null = null;
  if (content !== null && p.symbol !== undefined) {
    report = reportResult(content, p.symbol);
    if (report === null) {
      const i = lines.findIndex((l) => symbolPresent(l, p.symbol!));
      symbolAt = i === -1 ? null : i + 1;
    }
    if (target?.real === deliverable) {
      outsideAt = outsideManifestLines(content).find((n) => lines[n - 1].includes(p.symbol!)) ?? null;
    }
  }
  return { kind: p.kind, raw: p.raw, path: p.path!, line: p.line ?? null, symbol: p.symbol ?? null, symbolDeclared: p.symbolDeclared === true,
    target, unresolved, symbolAt, outsideManifestAt: outsideAt, report };
}

/** The ADR behind an id, as `adrDecision` reads it. */
function adrFacts(ctx: Ctx, id: string): Record<string, unknown> {
  const abs = adrPath(ctx.mission, id);
  const refusal = adrDecision(ctx.mission, id);
  let status: string | null = null, sha: string | null = null;
  if (abs !== null && isRegularFile(abs)) {
    try { status = adrStatusWord(readFileSync(abs, "utf8")); sha = normalizedFileSha256(abs); } catch { /* unreadable: the refusal says so */ }
  }
  return { id, file: abs === null ? null : rel(ctx.projectReal, realpathOr(abs)), sha256: sha, status, refusal };
}

/** The canonical bytes of a witness: keys sorted at every level by UTF-16 code units, no
 *  insignificant whitespace, one LF at the end (docs/spec/witness.md, "Canonical encoding"). */
export function renderWitness(w: unknown): string {
  const canon = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canon);
    if (v !== null && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canon(o[k])]));
    }
    return v;
  };
  return JSON.stringify(canon(w)) + "\n";
}

/** The causes the verdict counted, one entry per unit of `gaps + strictGaps + hookFailed`. */
function causesOf(v: Verdict, hookFailures: string[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const deferred = new Set((v.horizon?.deferred ?? []).map((d) => d.relPath));
  for (const d of v.deliverables) {
    if (d.state === "filled" || deferred.has(d.relPath)) continue;
    out.push({ family: "deliverable-state", path: `runward/${d.relPath}`, rule: null, kind: d.state, problem: `${d.artifact} is ${d.state}` });
  }
  const byLabel = new Map(GATED_DELIVERABLES.map((g) => [g.label, g.deliverable]));
  for (const g of v.gated) {
    if (g.skipped) continue;
    for (const x of g.violations) {
      out.push({ family: "conformance", path: `runward/${byLabel.get(g.label)}`, rule: x.rule, kind: x.kind ?? null, problem: x.problem });
    }
  }
  if (v.corpus.status === "verifiable") {
    for (const f of v.corpus.missing) out.push({ family: "corpus", path: `runward/rules/${f}`, rule: null, kind: "corpus-missing", problem: "a rule runward wrote is gone" });
    for (const f of v.corpus.edited) out.push({ family: "corpus", path: `runward/rules/${f}`, rule: null, kind: "corpus-edited", problem: "edited since runward wrote it" });
    for (const f of v.corpus.extra) out.push({ family: "corpus", path: `runward/rules/${f}`, rule: null, kind: "corpus-extra", problem: "a rule runward never wrote, declaring a gated phase at CRITICAL/HIGH" });
  } else if (v.corpus.status === "unrecorded") {
    out.push({ family: "corpus", path: "runward/rules", rule: null, kind: "corpus-unrecorded", problem: "a local rule corpus with no rule recorded in scaffold-lock.json" });
  }
  if (v.seal.present) for (const x of v.seal.violations) out.push({ family: "seal", path: "runward/evidence-lock.json", rule: x.rule, kind: "seal-violation", problem: x.problem });
  for (const u of [...v.unratified].sort((x, y) => (x.file < y.file ? -1 : x.file > y.file ? 1 : 0))) out.push({ family: "unratified-decision", path: `runward/adr/${u.file}`, rule: null, kind: "unratified-decision", problem: u.reason });
  for (const u of v.regulated.unbound) out.push({ family: "regulated", path: `runward/${u.deliverable}`, rule: u.rule, kind: u.cause, problem: "decided row not ratified (regulated tier)" });
  for (const x of v.delegation?.gaps ?? []) {
    out.push({ family: "charter", path: x.deliverable ? `runward/${x.deliverable}` : x.file ?? "runward/delegation.md", rule: x.rule ?? null, kind: x.kind, problem: x.problem });
  }
  if (v.workflowContract.gating) {
    const wc = v.workflowContract;
    for (const p of [...wc.malformed, ...wc.joinBreaks, ...wc.unmetRequires]) out.push({ family: "workflow-contract", path: null, rule: null, kind: null, problem: p });
  }
  for (const h of hookFailures) out.push({ family: "hooks", path: null, rule: null, kind: null, problem: h });
  return out;
}

/** The digest of the package's shipped rule set: SHA-256 over `<file>\0<sha256>\n` per rule, sorted
 *  by file name, each rule's digest normalised as the corpus check normalises it. */
function packageRulesDigest(): string | null {
  const dir = join(TEMPLATES, "rules");
  if (!existsSync(dir)) return null;
  const lines = readdirSync(dir).filter((f) => f.endsWith(".md")).sort()
    .map((f) => `${f}\u0000${hashText(readFileSync(join(dir, f), "utf8"))}\n`);
  return sha256Hex(lines.join(""));
}

/**
 * Assemble the witness of a strict verdict `v` computed on `mission` (the `runward/` directory).
 * `v` must be the verdict the command rendered and exits on; nothing here recomputes it.
 */
export function buildWitness(mission: string, v: Verdict, ctx: WitnessContext): Record<string, unknown> {
  const project = dirname(mission);
  const projectReal = realpathOr(resolve(project));
  const c: Ctx = { mission, projectReal, files: new Map() };
  const repo = repoRootAbove(projectReal);

  // ── The rule corpus the verdict judged against ──
  const { source } = ruleSetDir(mission);
  const dir = rulesDir(mission);
  const lock = readScaffoldLock(mission);
  const signed = ruleSignatures(mission);
  const rules = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => ({
      slug: f.replace(/\.md$/, ""),
      sha256: hashText(readFileSync(join(dir, f), "utf8")),
      // Against the committed lock: the recorded digest is this file's, another one, or none.
      lock: lock?.files[`rules/${f}`] === undefined ? "none"
        : lock.files[`rules/${f}`] === hashText(readFileSync(join(dir, f), "utf8")) ? "same" : "other",
      signed: f.replace(/\.md$/, "") in signed,
    }))
    : [];
  const history = readPublishedRuleHashes(join(TEMPLATES, "rules"));
  const historyFile = join(TEMPLATES, "rule-history.json");

  // ── The gated deliverables, row by row ──
  const byLabel = new Map(v.gated.map((g) => [g.label, g]));
  const gated = GATED_DELIVERABLES.map(({ phase, deliverable, label }) => {
    const g = byLabel.get(label);
    const path = join(mission, deliverable);
    const present = existsSync(path);
    const base = {
      phase, path: `runward/${deliverable}`, judged: g !== undefined, skipped: g?.skipped ?? false,
      expected: expectedRules(mission, phase), floor: EXPECTED_MAPPED[phase] ?? null,
      present, sha256: present ? normalizedFileSha256(path) : null,
    };
    if (!present) return { ...base, sections: [], problems: [], rows: [] };
    const content = readFileSync(path, "utf8");
    const { rows, problems, lines } = readManifest(content);
    const bases = resolutionBases(mission, deliverable);
    const self = rel(projectReal, realpathOr(resolve(path)));
    return {
      ...base,
      sections: manifestSections(content).map((s) => s.start + 1),
      problems,
      rows: rows.map((row, i) => {
        const r: Record<string, unknown> = { line: lines[i], rule: row.rule, status: row.status, digest: rowDigest(row) };
        const examined = row.status === "applied" || proposedStatus(row.status) === "applied";
        const placeholder = examined && /^\[[^\]]*\s[^\]]*\]$/.test(row.evidence.trim());
        r.pointers = examined && !placeholder ? parseEvidencePointers(row.evidence).map((p) => pointerFacts(c, p, bases, self)) : [];
        // Bare path tokens are recorded on every examined row, a placeholder included: drift reads them
        // whatever the cell says (driftReport), even where the evidence layer stops at the placeholder.
        r.paths = examined ? evidencePathTokens(row.evidence).map((t) => {
          const { target, unresolved } = resolveTarget(c, t, bases);
          return { token: t, target, unresolved };
        }) : [];
        r.prose = prosePointerSpellings(row.evidence);
        if (row.status === "deviated") {
          const id = row.evidence.match(/ADR-\d+/i)?.[0];
          r.adr = id === undefined ? null : adrFacts(c, id);
        } else r.adr = null;
        return r;
      }),
    };
  });

  const causes = causesOf(v, ctx.hookFailures);
  const families = new Map<string, number>();
  for (const x of causes) families.set(x.family as string, (families.get(x.family as string) ?? 0) + 1);

  return {
    witness: WITNESS_SCHEMA,
    runward: ctx.version,
    mode: { strict: true, through: ctx.through, hooks: ctx.hooks },
    verdict: {
      result: ctx.exitCode === 0 ? "clean" : "gaps",
      exitCode: ctx.exitCode,
      gaps: v.gaps,
      strictGaps: v.strictGaps,
      hookFailed: ctx.hookFailures.length,
      deferredGaps: v.deferredGaps,
      checked: v.checked,
      strictBreakdown: v.strictBreakdown,
    },
    repository: repo === null ? null : (rel(projectReal, repo) || "."),
    corpus: {
      source,
      status: v.corpus.status,
      edited: v.corpus.edited, missing: v.corpus.missing, extra: v.corpus.extra,
      lock: lock === null ? null : "runward/scaffold-lock.json",
      rules,
      package: {
        rulesSha256: packageRulesDigest(),
        historySha256: history === null || !existsSync(historyFile) ? null : normalizedFileSha256(historyFile),
      },
    },
    deliverables: v.deliverables.map((d) => {
      const abs = join(mission, d.relPath);
      return {
        phaseId: PHASES.find((p) => p.label === d.phase)?.id ?? null,
        path: `runward/${d.relPath}`, state: d.state, cause: d.cause,
        sha256: isRegularFile(abs) ? normalizedFileSha256(abs) : null,
      };
    }),
    horizon: v.horizon === null ? null : { phase: v.horizon.phase, deferred: v.horizon.deferred.map((d) => `runward/${d.relPath}`) },
    gated,
    files: Object.fromEntries([...c.files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    // Sorted: the verdict lists them in directory order, which is the file system's, not the tree's.
    unratified: v.unratified.map((u) => ({ file: `runward/adr/${u.file}`, reason: u.reason }))
      .sort((x, y) => (x.file < y.file ? -1 : x.file > y.file ? 1 : 0)),
    causes,
    notWitnessed: Object.entries(NOT_WITNESSED).map(([family, why]) => ({ family, why, causes: families.get(family) ?? 0 })),
  };
}

/** Is this file a witness runward wrote? The only kind of existing file `--witness` overwrites. */
export function isWitnessFile(abs: string): boolean {
  try {
    const j = JSON.parse(readFileSync(abs, "utf8")) as { witness?: unknown };
    return typeof j.witness === "string" && j.witness.startsWith("runward-witness/");
  } catch { return false; }
}

/**
 * Why `--witness <file>` cannot be written, asked BEFORE the verdict runs so a refusal writes nothing
 * and prints no partial gate. Null when the path is writable. `out` is absolute; `mission` is the
 * `runward/` directory, inside which a witness would become part of the tree it describes.
 */
export function witnessPathFault(out: string, mission: string): { error: "usage" | "refused"; message: string } | null {
  const shown = out;
  const missionReal = realpathOr(resolve(mission));
  const parent = dirname(out);
  const parentReal = realpathOr(parent);
  const target = join(parentReal, basename(out));
  if (target === missionReal || target.startsWith(missionReal + sep)) {
    return { error: "usage", message: `--witness ${shown} lies inside runward/: the witness describes that tree and would become part of it. Write it outside the mission directory.` };
  }
  let parentIsDir = false;
  try { parentIsDir = statSync(parent).isDirectory(); } catch { parentIsDir = false; }
  if (!parentIsDir) return { error: "usage", message: `--witness ${shown}: the directory ${parent} does not exist. Create it, or give a path in an existing directory.` };
  if (existsSync(out)) {
    let dir = false;
    try { dir = statSync(out).isDirectory(); } catch { dir = false; }
    if (dir) return { error: "usage", message: `--witness ${shown} is a directory: give a file path, e.g. witness.json.` };
    if (!isWitnessFile(out)) return { error: "refused", message: `--witness ${shown} exists and is not a runward witness: refusing to overwrite it. Choose another path, or remove the file yourself.` };
  }
  try { accessSync(parent, constants.W_OK); } catch {
    return { error: "usage", message: `--witness ${shown}: the directory ${parent} is not writable.` };
  }
  if (existsSync(out)) {
    try { accessSync(out, constants.W_OK); } catch {
      return { error: "usage", message: `--witness ${shown} is not writable.` };
    }
  }
  return null;
}
