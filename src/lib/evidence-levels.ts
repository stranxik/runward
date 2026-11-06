/**
 * The levels of proof (ADR-0119) and the binding of execution evidence to the tree (ADR-0120 decision 6).
 *
 * WHAT THIS IS. A pure reading of files at rest, like the rest of the verdict: the manifests, the reports
 * the applied rows cite, the files the analyzers read, and the run Statements `runward-run` (a sibling
 * package, never imported here) wrote beside the reports it produced. It runs nothing, fetches nothing,
 * holds no key and verifies no signature (ADR-0054, ADR-0093): it re-derives the binding of a run
 * Statement to this tree, and it COUNTS the signatures carried with it.
 *
 * THE THREE LEVELS (ADR-0119 decision 1), for each piece of evidence an applied row cites:
 *   re-derived  runward recomputes the fact from the tree: a pointer that resolves, a symbol present, an
 *               ADR that resolves. These are the static pieces.
 *   attested    a fact that takes an execution: a report a test runner, a linter, a scanner or a coverage
 *               tool wrote. It is attested when a run Statement found beside the report has the report's
 *               digest among its subjects, records the mission's manifests and the expected source set as
 *               this tree holds them, says the network was cut, and carries at least one signature. The
 *               signature is counted here and verified outside the CLI, against the operator's trust policy
 *               (`runward-fleet verify-run`, ADR-0120 D4a): ATTESTED_SENTENCE says so wherever the word is
 *               read, and `signatureVerified` is false in every payload.
 *   declared    what rests on someone's word: a prose cell, a report no run Statement binds, a Statement
 *               that carries no signature.
 *
 * THE EXPECTED SET (ADR-0120 decision 4, ADR-0117 note E). A run Statement records the digest of each
 * source file of the expected set, hashed from the checkout before any leg ran. The set is derived from
 * the tree, never chosen by the writer: the files the analyzers read under the pinned policy, the files the
 * applied rows cite and the tests they cite, less the execution reports themselves (they are the subjects)
 * and the in-toto documents (Statements, envelopes, bundles), which are about the tree, not part of it. A
 * Statement whose recorded set is narrower than the one this module derives does not bind.
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { GATED_DELIVERABLES, adrIdExists, parseManifest } from "./conformance.js";
import { normalizedFileSha256, parseEvidencePointers, requiresReading, resolutionBases, resolveEvidencePath, type EvidencePointer } from "./evidence.js";
import { isCoberturaReport, isCycloneDxSbom, isEslintReport, isJUnitReport, isLcovReport, isLoadTestReport, isRunwardJUnit, isSarifReport } from "./tool-adapters.js";
import { analysisScope, type AnalysisReading } from "./analyze.js";
import { IN_TOTO_STATEMENT_TYPE, RUNWARD_RUN_PREDICATE_TYPE, digestOfFiles, rawFileSha256 } from "./attestation.js";
import { toPosix } from "./paths.js";
import { ANALYSIS_POLICIES, DEFAULT_ANALYSIS_POLICY } from "./analysis-policy.js";
import { MUTATOR_LANGUAGES, canonicalTarget, citedLines, extensionOf, isTestPath, mutationOutcome, type MutationTarget, type RowMutation } from "./mutation-targets.js";

/**
 * ADR-0114 and ADR-0119 decision 2: the levels a strict verdict may require, from the least to the most
 * demanding; each includes the one below it. `traced` accepts a green that rests on judgment alone;
 * `mechanical` asks for one applied row the gate verified; `re-derived` asks that no applied row rest on
 * a declaration and that the declared territory be analysed; `attested` asks, beyond it, that every
 * execution piece an applied row cites be bound to this tree by a signed run Statement.
 */
export type RequiredLevel = "traced" | "mechanical" | "re-derived" | "attested";
export const REQUIRED_LEVELS: readonly RequiredLevel[] = ["traced", "mechanical", "re-derived", "attested"];
export type ProofLevel = "re-derived" | "attested" | "declared";
export type ExecutionNature = "junit" | "sarif" | "eslint" | "coverage" | "sbom" | "loadtest";

/**
 * ADR-0119 decision 4: the level the mission's lock asks for (`"requiredLevel"` in
 * runward/scaffold-lock.json), a lock opt-in like `structureContract`. `null` when the lock holds none;
 * `{ invalid }` when it holds a value that is not a level, which `check` refuses as a misuse (exit 2)
 * rather than guess a weaker one.
 */
export function lockRequiredLevel(missionDir: string): { level: RequiredLevel } | { invalid: unknown } | null {
  let j: unknown;
  try { j = JSON.parse(readFileSync(join(missionDir, "scaffold-lock.json"), "utf8")); } catch { return null; }
  if (!j || typeof j !== "object" || !("requiredLevel" in (j as Record<string, unknown>))) return null;
  const v = (j as Record<string, unknown>).requiredLevel;
  return typeof v === "string" && (REQUIRED_LEVELS as readonly string[]).includes(v) ? { level: v as RequiredLevel } : { invalid: v };
}

/**
 * ADR-0119 decision 4: the level `runward init` writes into a new mission's lock. It is `re-derived`
 * from the first release that both ships ADR-0118's analyzers and meets ADR-0117's criterion 2: the
 * findings of the analyzers measured on three real repositories runward did not write, classified by
 * reviewer sessions that did not write them, zero false reds (docs/compliance/analyzers-on-real-repositories.md,
 * measured at 51675dc). A new mission asks for another level, or none, by editing the line in its lock.
 * Existing missions never move: `update` preserves what the lock says and never writes the line on its own.
 */
export const NEW_MISSION_REQUIRED_LEVEL: RequiredLevel | null = "re-derived";

/** ADR-0119 decision 4, at the character: a `re-derived` the lock asks for, on a territory holding a
 *  language the analyzers do not read. For an `attested` the lock asks for, only the static half falls,
 *  and the line says which half. */
export function languageFallbackLine(languages: readonly string[], required: RequiredLevel = "re-derived"): string {
  const line = `re-derived: not reachable, ${languages.join(", ")} ${languages.length === 1 ? "is" : "are"} not analysed; this run requires mechanical`;
  return required === "attested" ? `${line} for its static half, and attested for its execution` : line;
}

/**
 * ADR-0119 decisions 4 and 6: the level a run that read the levels meets, never overstated. The level it
 * requires when it meets it, except under the language fallback, where the static half is `mechanical`
 * and the ladder (each level includes the one below it) puts the run at `mechanical`. `null` when the
 * run did not read the levels or does not meet them.
 */
export function levelMetOf(l: Pick<LevelsReading, "met" | "required" | "fallback"> | null): RequiredLevel | null {
  if (!l || !l.met) return null;
  return l.fallback ? "mechanical" : l.required;
}

/** ADR-0119 decision 4: the level a run that read the levels requires, as `require.level` spells it:
 *  `mechanical` when a `re-derived` the lock asks for falls back; an `attested` keeps its name, since
 *  only its static half falls. */
export function levelRequiredOf(l: Pick<LevelsReading, "required" | "fallback">): RequiredLevel {
  return l.fallback && l.required === "re-derived" ? "mechanical" : l.required;
}

/** ADR-0119 decision 5, at the character: printed wherever `attested` is read. */
export const ATTESTED_SENTENCE = "attested: the binding is re-derived by this command; the signature is verified outside it";

/** What the expected set is, said in every payload that carries it. */
export const EXPECTED_SET_RULE =
  "the files the built-in analyzers read under the pinned policy (source and configuration files), the files the " +
  "applied rows cite and the tests they cite, less the execution reports (the run's subjects) and the in-toto " +
  "Statements, envelopes and bundles; each hashed by SHA-256 of its content, with CRLF read as LF in a text file";

/** The names a run Statement may carry in the directory of the reports it binds, and their size limit. */
const STATEMENT_FILE = /\.(?:intoto\.jsonl?|dsse\.json|sigstore\.jsonl?|sigstore)$/;
const MAX_STATEMENT_BYTES = 8 * 1024 * 1024;
/** Source files are never execution reports, whatever text they carry (a test that writes `<testcase`). */
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".cs", ".c", ".cc", ".cpp", ".h", ".hpp", ".swift", ".scala", ".md", ".markdown"]);

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function realpathOr(p: string): string {
  try { return realpathSync(p); } catch { return p; }
}
function isRegularFile(abs: string): boolean {
  try { return statSync(abs).isFile(); } catch { return false; }
}
function readText(abs: string): string | null {
  try { return readFileSync(abs, "utf8"); } catch { return null; }
}

/** The nature of a report the gate reads as a recorded execution, by its content (the adapters' own
 *  detection, as `requires:` reads it), or null for a static file. */
export function executionNature(content: string, path = ""): ExecutionNature | null {
  if (SOURCE_EXTENSIONS.has(extname(path).toLowerCase())) return null;
  if (isJUnitReport(content)) return isRunwardJUnit(content) ? null : "junit";
  if (isSarifReport(content)) return "sarif";
  if (isEslintReport(content)) return "eslint";
  if (isLcovReport(content) || isCoberturaReport(content)) return "coverage";
  if (isCycloneDxSbom(content)) return "sbom";
  if (isLoadTestReport(content)) return "loadtest";
  return null;
}

/** An in-toto document of any predicate: a Statement, a DSSE envelope of one, or a Sigstore bundle. */
function isInTotoDocument(content: string): boolean {
  const t = content.replace(/^﻿/, "").trimStart();
  if (!t.startsWith("{")) return false;
  const doc = parseDocument(t);
  if (!doc || typeof doc !== "object") return false;
  const o = doc as Record<string, unknown>;
  if (typeof o._type === "string" && /^https:\/\/in-toto\.io\/Statement\//.test(o._type)) return true;
  if (typeof o.payloadType === "string" && typeof o.payload === "string") return true;
  return typeof o.mediaType === "string" && /^application\/vnd\.dev\.sigstore\.bundle/.test(o.mediaType);
}

/** A JSON document, or the first non-empty line of a JSON Lines file (what `actions/attest` writes). */
function parseDocument(text: string): unknown {
  const t = text.replace(/^﻿/, "").trim();
  try { return JSON.parse(t); } catch { /* JSON Lines */ }
  const line = t.split(/\r?\n/).find((l) => l.trim() !== "");
  try { return line === undefined ? null : JSON.parse(line); } catch { return null; }
}

// ── The expected set ─────────────────────────────────────────────────────────────────────────────

export interface ExpectedSet {
  rule: string;
  /** Project-relative, `/`-separated, sorted by code unit. */
  files: string[];
  /** The gated manifests the citations come from, project-relative. */
  manifests: string[];
  /** The digest of the manifests: SHA-256 of the JSON of {path: sha256}, keys sorted (digestOfFiles). */
  manifestsDigest: string;
}

interface Tree {
  root: string;
  missionDir: string;
  rel: (abs: string) => string | null;
  digest: (rel: string) => string;
}

function treeOf(missionDir: string): Tree {
  const root = realpathOr(resolve(dirname(missionDir)));
  const cache = new Map<string, string>();
  return {
    root, missionDir,
    rel: (abs) => {
      const r = toPosix(relative(root, realpathOr(abs)));
      return r === "" || r.startsWith("../") || r === ".." || isAbsolute(r) ? null : r;
    },
    digest: (rel) => {
      if (!cache.has(rel)) {
        const abs = join(root, ...rel.split("/"));
        // A recorded path is followed only while it stays in the project: a link out of it is never
        // opened (ADR-0054 crossing 4), and it reads as a file that differs.
        const target = realpathOr(abs);
        const inside = target === root || target.startsWith(root.endsWith(sep) ? root : root + sep);
        cache.set(rel, !inside ? "outside" : isRegularFile(abs) ? normalizedFileSha256(abs) : "absent");
      }
      return cache.get(rel)!;
    },
  };
}

/** A project-relative path a Statement records, as safe to join: no absolute path, no `..`, no `.`. */
function safeRel(p: unknown): p is string {
  if (typeof p !== "string" || p === "" || p.startsWith("/") || /^[A-Za-z]:/.test(p) || p.includes("\\") || p.includes("\0")) return false;
  return p.split("/").every((s) => s !== "" && s !== "." && s !== "..");
}

/** The manifests of the gated deliverables present in the mission, and their digest. */
function manifestsOf(tree: Tree): { manifests: string[]; manifestsDigest: string } {
  const map: Record<string, string> = {};
  for (const g of GATED_DELIVERABLES) {
    const abs = join(tree.missionDir, g.deliverable);
    if (!existsSync(abs)) continue;
    const rel = tree.rel(abs);
    if (rel) map[rel] = tree.digest(rel);
  }
  return { manifests: Object.keys(map).sort(byCodeUnit), manifestsDigest: digestOfFiles(map) };
}

// ── The applied rows and their pieces ────────────────────────────────────────────────────────────

interface CitedPiece {
  pointer: EvidencePointer;
  /** Absolute real path of what the pointer resolves to, when it is a regular file inside the project. */
  abs: string | null;
  rel: string | null;
  nature: ExecutionNature | null;
}
interface AppliedRow { deliverable: string; phase: string; rule: string; pieces: CitedPiece[] }

function appliedRows(tree: Tree, inHorizon: (phase: string) => boolean): AppliedRow[] {
  const out: AppliedRow[] = [];
  const natureOf = new Map<string, ExecutionNature | null>();
  for (const g of GATED_DELIVERABLES) {
    if (!inHorizon(g.phase)) continue;
    const path = join(tree.missionDir, g.deliverable);
    if (!existsSync(path)) continue;
    const bases = resolutionBases(tree.missionDir, g.deliverable);
    let rows: ReturnType<typeof parseManifest>;
    try { rows = parseManifest(readFileSync(path, "utf8")); } catch { continue; }
    for (const row of rows) {
      if (row.status !== "applied") continue;
      const pieces: CitedPiece[] = [];
      for (const p of parseEvidencePointers(row.evidence || "")) {
        if (p.kind === "adr" || !p.path || p.malformed) { pieces.push({ pointer: p, abs: null, rel: null, nature: null }); continue; }
        const resolved = resolveEvidencePath(p.path, bases);
        const abs = resolved && isRegularFile(resolved) ? realpathOr(resolved) : null;
        const rel = abs ? tree.rel(abs) : null;
        let nature: ExecutionNature | null = null;
        if (abs && rel) {
          if (!natureOf.has(abs)) {
            const text = readText(abs);
            natureOf.set(abs, text === null ? null : executionNature(text, abs));
          }
          nature = natureOf.get(abs) ?? null;
        }
        pieces.push({ pointer: p, abs, rel, nature });
      }
      out.push({ deliverable: g.deliverable, phase: g.phase, rule: row.rule, pieces });
    }
  }
  return out;
}

const OTHER_LANGUAGES = ANALYSIS_POLICIES[DEFAULT_ANALYSIS_POLICY].otherLanguages;

/**
 * ADR-0119 decision 2 (R2): a row's mutation target, when it cites a code location and a test. A code
 * location is a `file:` pointer at a source file that is not a test; a test is a `test:` pointer that
 * names a case of a JUnit report. Its cited lines are the symbol's (`#SYMBOL`), the line (`:LINE`), else the
 * whole file. Cited code in a language runward-run has no mutator for is named in `languages`.
 */
function mutationTargetOf(row: AppliedRow): { target: MutationTarget | null; languages: string[] } {
  const tests = row.pieces.filter((p) => p.pointer.kind === "test" && p.nature === "junit" && p.pointer.testName && p.rel).map((p) => ({ report: p.rel!, name: p.pointer.testName! }));
  if (tests.length === 0) return { target: null, languages: [] };
  const locations: MutationTarget["locations"] = [];
  const languages = new Set<string>();
  for (const p of row.pieces) {
    if (p.pointer.kind !== "file" || p.nature !== null || !p.abs || !p.rel || isTestPath(p.rel)) continue;
    const ext = extensionOf(p.rel);
    if (!Object.hasOwn(MUTATOR_LANGUAGES, ext)) { if (Object.hasOwn(OTHER_LANGUAGES, ext)) languages.add(OTHER_LANGUAGES[ext]); continue; }
    const text = readText(p.abs);
    const lines = text === null ? null : citedLines(text, { line: p.pointer.line, symbol: p.pointer.symbol });
    if (lines) locations.push({ file: p.rel, from: lines.from, to: lines.to });
  }
  const target = locations.length ? canonicalTarget({ deliverable: row.deliverable, rule: row.rule, locations, tests }) : null;
  return { target, languages: target ? [] : [...languages].sort(byCodeUnit) };
}

/** The sentence every surface prints about the mutation of the cited lines (ADR-0119 decision 2). */
function mutationSentence(facts: RowMutation[]): string {
  const asked = facts.filter((m) => m.state !== "no-mutator");
  const none = facts.filter((m) => m.state === "no-mutator");
  const tail = none.length ? `; ${none.length} row(s) cite code in a language runward-run has no mutator for (${[...new Set(none.flatMap((m) => m.languages ?? []))].join(", ")}), and reach attested without it` : "";
  if (asked.length === 0) return `no applied row cites a code location and a test: the mutation of cited lines is asked of none (ADR-0119 decision 2)${tail}`;
  const read = asked.filter((m) => m.statement && !["absent", "unbound", "unsigned"].includes(m.state));
  if (read.length === 0) return `${asked.length} applied row(s) cite a code location and a test, and no signed run Statement bound here carries the mutation of their cited lines (runward-run's mutation leg, ADR-0120 decision 2): none of them reaches attested${tail}`;
  const by = (s: string): number => asked.filter((m) => m.state === s).length;
  const parts = [`${by("killed")} with a mutant killed through a failed assertion`];
  if (by("killed-indistinct")) parts.push(`${by("killed-indistinct")} held to « at least one mutant killed », the runner not telling a failed assertion from an error`);
  if (by("no-mutant")) parts.push(`${by("no-mutant")} whose cited lines hold no operator the mutator changes (below attested: they cite no line that implements what they claim)`);
  const short = asked.filter((m) => !m.met).length;
  return `the mutation of the cited lines, read from ${[...new Set(read.map((m) => m.statement))].join(", ")}: of ${asked.length} row(s) that cite a code location and a test, ${parts.join(", ")}${short ? `, ${short} below attested for it` : ""}${tail}`;
}

/** ADR-0120 decision 4: the expected set this tree implies, derived as EXPECTED_SET_RULE says. */
export function expectedSet(missionDir: string, inHorizon: (phase: string) => boolean = () => true): ExpectedSet {
  const tree = treeOf(missionDir);
  return expectedFrom(tree, appliedRows(tree, inHorizon), analysisScope(missionDir));
}

function expectedFrom(tree: Tree, rows: AppliedRow[], scope: { files: string[] } | null): ExpectedSet {
  const files = new Set<string>();
  const keep = (rel: string): void => {
    const abs = join(tree.root, ...rel.split("/"));
    const text = readText(abs);
    if (text === null) return;
    if (executionNature(text, abs) !== null || isInTotoDocument(text)) return;
    files.add(rel);
  };
  for (const rel of scope?.files ?? []) keep(rel);
  for (const r of rows) for (const p of r.pieces) if (p.rel && p.nature === null) keep(p.rel);
  return { rule: EXPECTED_SET_RULE, files: [...files].sort(byCodeUnit), ...manifestsOf(tree) };
}

// ── Run Statements ───────────────────────────────────────────────────────────────────────────────

export interface RunStatementReading {
  /** Project-relative path of the file that carries it. */
  path: string;
  /** A bare Statement, a DSSE envelope, or a Sigstore bundle around a DSSE envelope. */
  form: "statement" | "dsse" | "sigstore-bundle";
  /** Signatures carried with it, COUNTED: never verified by this command. */
  signatures: number;
  /** The reports of this tree whose digest is one of its subjects. */
  binds: string[];
  /** True when every check of the binding holds for this tree (signatures aside). */
  bound: boolean;
  /** What does not hold, one sentence each. */
  problems: string[];
  /** Whether its run carries a mutation leg (ADR-0120 decision 2; built in R2). */
  mutation: boolean;
}

interface RunDocument { form: RunStatementReading["form"]; statement: Record<string, unknown>; signatures: number }

function countSignatures(env: unknown): number {
  const sigs = (env as { signatures?: unknown } | null)?.signatures;
  return Array.isArray(sigs) ? sigs.filter((s) => s && typeof s === "object" && typeof (s as { sig?: unknown }).sig === "string" && (s as { sig: string }).sig.length > 0).length : 0;
}

function decodeEnvelope(env: unknown): Record<string, unknown> | null {
  const e = env as { payloadType?: unknown; payload?: unknown } | null;
  if (!e || typeof e !== "object" || typeof e.payloadType !== "string" || typeof e.payload !== "string" || !/in-toto/.test(e.payloadType)) return null;
  try {
    const st = JSON.parse(Buffer.from(e.payload, "base64").toString("utf8")) as unknown;
    return st && typeof st === "object" ? st as Record<string, unknown> : null;
  } catch { return null; }
}

const isRunStatement = (st: Record<string, unknown> | null): boolean =>
  !!st && st._type === IN_TOTO_STATEMENT_TYPE && st.predicateType === RUNWARD_RUN_PREDICATE_TYPE;

/** A run Statement, bare, in a DSSE envelope, or in a Sigstore bundle; null for any other document. */
export function readRunDocument(text: string): RunDocument | null {
  const doc = parseDocument(text);
  if (!doc || typeof doc !== "object") return null;
  const o = doc as Record<string, unknown>;
  if (isRunStatement(o)) return { form: "statement", statement: o, signatures: 0 };
  if (typeof o.mediaType === "string" && /^application\/vnd\.dev\.sigstore\.bundle/.test(o.mediaType)) {
    const st = decodeEnvelope(o.dsseEnvelope);
    return st !== null && isRunStatement(st) ? { form: "sigstore-bundle", statement: st, signatures: countSignatures(o.dsseEnvelope) } : null;
  }
  const st = decodeEnvelope(o);
  return st !== null && isRunStatement(st) ? { form: "dsse", statement: st, signatures: countSignatures(o) } : null;
}

/** What of the binding does not hold for this tree, one sentence each (ADR-0120 decision 6). */
function bindingProblems(st: Record<string, unknown>, tree: Tree, expected: ExpectedSet): string[] {
  const problems: string[] = [];
  const p = (st.predicate && typeof st.predicate === "object" ? st.predicate : {}) as Record<string, unknown>;
  if (p.network !== "none") problems.push(`its run did not record the network as cut (network: ${JSON.stringify(p.network ?? null)})`);
  const manifests = (p.manifests && typeof p.manifests === "object" ? p.manifests : {}) as Record<string, unknown>;
  if (manifests.digest !== expected.manifestsDigest) problems.push("the manifests it records are not this tree's: a manifest changed since the run, or the run recorded others");
  const sources = (p.sources && typeof p.sources === "object" ? p.sources : {}) as Record<string, unknown>;
  const recorded = (sources.files && typeof sources.files === "object" && !Array.isArray(sources.files) ? sources.files : null) as Record<string, unknown> | null;
  if (recorded === null) {
    problems.push("it records no source digests");
    return problems;
  }
  const unsafe = Object.keys(recorded).filter((k) => !safeRel(k));
  if (unsafe.length) problems.push(`it records ${unsafe.length} source path(s) that are not project-relative (e.g. ${JSON.stringify(unsafe[0])})`);
  const missing = expected.files.filter((f) => !Object.hasOwn(recorded, f));
  if (missing.length) problems.push(`the source set it records is narrower than the one this tree implies: ${missing.length} file(s) not recorded (e.g. ${missing.slice(0, 3).join(", ")})`);
  const changed = Object.keys(recorded).filter(safeRel).sort(byCodeUnit).filter((k) => recorded[k] !== tree.digest(k));
  if (changed.length) problems.push(`${changed.length} source file(s) differ from what the run hashed before its legs ran (e.g. ${changed.slice(0, 3).join(", ")})`);
  return problems;
}

// ── The reading ──────────────────────────────────────────────────────────────────────────────────

export interface ProofPiece {
  /** The pointer as the cell spells it. */
  pointer: string;
  kind: "static" | "execution";
  level: ProofLevel;
  /** True for the pieces that set the row's level (ADR-0119 decision 6). */
  setsLevel: boolean;
  /** Execution pieces: the report's nature and its project-relative path. */
  nature?: ExecutionNature;
  report?: string;
  /** Execution pieces: the run Statement that attests it, when one does. */
  statement?: string;
  /** Why a piece is declared, when it is. */
  why?: string;
}

export interface RowProof {
  deliverable: string;
  rule: string;
  level: ProofLevel;
  pieces: ProofPiece[];
  /** The `requires:` nature of the row's rule, and whether an attested report carries it. */
  requires?: { nature: string; attested: boolean };
  /** ADR-0119 decision 2 (R2): present on a row that cites a code location and a test, the mutation of
   *  its cited lines as the bound run Statement records it, or why it does not let the row reach
   *  `attested`; on a row whose cited code no mutator reads, that absence, named. */
  mutation?: RowMutation;
  /** ADR-0120 decision 2 (R2): the coverage of its cited lines, by the suite, as a signed bound run
   *  Statement records it. Informational: it sets no level (the mutation fact does). */
  coverage?: { statement: string; locations: Array<{ file: string; from: number; to: number; instrumented: number; executed: number }> };
}

export interface LevelsReading {
  /** The level the run requires, where it was asked, and whether the verdict meets it. */
  required: RequiredLevel;
  source: "flag" | "lock" | "default";
  /** ADR-0119 decision 4: set when the lock asked for an upper level on a territory holding a language the
   *  analyzers do not read, so the static half falls to `mechanical`, said at the character. */
  fallback?: string;
  met: boolean;
  sentence: string;
  signatureVerified: false;
  /** Each applied row at its level, each count with its list (ADR-0095 decision 2). */
  rows: Record<ProofLevel, RowProof[]>;
  /** The static half of `re-derived`: the declared territory analysed under the pinned policy. */
  territory: { analysed: boolean; files: number; languagesNotAnalysed: string[]; why: string | null };
  /** Every applied row below the required level, with what holds it there. */
  below: Array<{ deliverable: string; rule: string; level: ProofLevel; holds: string[] }>;
  execution: {
    statements: RunStatementReading[];
    expected: ExpectedSet;
    /** The mutation fact of ADR-0120 (R2): said whether or not a run carries it. */
    mutation: string;
    /** ADR-0120 decision 2 (R2): the rows whose cited lines `runward-run` mutates, and those lines, derived
     *  from this tree; a run Statement that records other ones binds nothing for the row. */
    mutationTargets: MutationTarget[];
  };
}

export interface LevelsContext {
  required: RequiredLevel;
  source: "flag" | "lock" | "default";
  /** `mechanical` met: at least one applied row carries a pointer the gate verified (ADR-0114). */
  mechanical: boolean;
  /** Rows the evidence breakdown reads as prose: no pointer the gate could open. */
  proseRows: ReadonlyArray<{ deliverable: string; rule: string }>;
  analysis: AnalysisReading | null;
  inHorizon?: (phase: string) => boolean;
}

/**
 * ADR-0119 decisions 1, 2 and 5: each applied row at its level, the run Statements found beside the
 * reports and what of their binding holds, and whether the verdict meets the level the run requires.
 * Computed only when the run requires `re-derived` or `attested` (the payload of every other run keeps
 * its bytes).
 */
export function levelsReading(missionDir: string, ctx: LevelsContext): LevelsReading {
  const tree = treeOf(missionDir);
  const rows = appliedRows(tree, ctx.inHorizon ?? (() => true));
  const scope = analysisScope(missionDir);
  const expected = expectedFrom(tree, rows, scope);
  const requires = requiresReading(missionDir);
  const prose = new Set(ctx.proseRows.map((r) => `${r.deliverable}\u0000${r.rule}`));

  // The run Statements, read once per directory that holds a cited report.
  const statementsByDir = new Map<string, Array<RunStatementReading & { doc: RunDocument }>>();
  const statementsIn = (dirAbs: string): Array<RunStatementReading & { doc: RunDocument }> => {
    if (statementsByDir.has(dirAbs)) return statementsByDir.get(dirAbs)!;
    const found: Array<RunStatementReading & { doc: RunDocument }> = [];
    let names: string[] = [];
    try { names = readdirSync(dirAbs).filter((n) => STATEMENT_FILE.test(n)).sort(byCodeUnit); } catch { names = []; }
    for (const name of names) {
      const abs = join(dirAbs, name);
      let size = 0;
      try { const s = statSync(abs); if (!s.isFile()) continue; size = s.size; } catch { continue; }
      if (size === 0 || size > MAX_STATEMENT_BYTES) continue;
      const text = readText(abs);
      const doc = text === null ? null : readRunDocument(text);
      const rel = tree.rel(abs);
      if (!doc || !rel) continue;
      const legs = (doc.statement.predicate as { legs?: unknown } | undefined)?.legs;
      found.push({
        path: rel, form: doc.form, signatures: doc.signatures, binds: [], bound: false,
        problems: bindingProblems(doc.statement, tree, expected),
        mutation: Array.isArray(legs) && legs.some((l) => (l as { leg?: unknown })?.leg === "mutation"),
        doc,
      });
    }
    for (const s of found) s.bound = s.problems.length === 0;
    statementsByDir.set(dirAbs, found);
    return found;
  };
  const declaredBy = (doc: RunDocument, rel: string): string | null => {
    const list = (doc.statement.predicate as { declared?: unknown } | undefined)?.declared;
    if (!Array.isArray(list)) return null;
    const hit = list.find((d) => (d as { path?: unknown })?.path === rel) as { why?: unknown } | undefined;
    return hit ? (typeof hit.why === "string" && hit.why ? hit.why : "the run Statement names it as produced outside runward-run: declared") : null;
  };
  const subjectsOf = (doc: RunDocument): Set<string> => {
    const out = new Set<string>();
    const subject = doc.statement.subject;
    if (Array.isArray(subject)) for (const s of subject) {
      const h = (s as { digest?: { sha256?: unknown } } | null)?.digest?.sha256;
      if (typeof h === "string") out.add(h.toLowerCase());
    }
    return out;
  };

  // One reading per cited report: which Statement attests it, or why none does.
  const reportReading = new Map<string, { level: ProofLevel; statement?: string; why?: string }>();
  const readReport = (abs: string, rel: string): { level: ProofLevel; statement?: string; why?: string } => {
    if (reportReading.has(abs)) return reportReading.get(abs)!;
    const raw = rawFileSha256(abs);
    const normalized = normalizedFileSha256(abs);
    const candidates = statementsIn(dirname(abs)).filter((s) => { const subj = subjectsOf(s.doc); return subj.has(raw) || subj.has(normalized); });
    for (const s of candidates) if (!s.binds.includes(rel)) s.binds.push(rel);
    const attesting = candidates.find((s) => s.bound && s.signatures > 0);
    let r: { level: ProofLevel; statement?: string; why?: string };
    if (attesting) r = { level: "attested", statement: attesting.path };
    else if (candidates.length === 0) {
      // ADR-0120 decision 2 (R3): an eval that needs a remote model is outside runward-run, which says so
      // in the Statement of the run beside it; the reading names it rather than « no Statement binds it ».
      const naming = statementsIn(dirname(abs)).find((s) => s.bound && declaredBy(s.doc, rel));
      r = naming
        ? { level: "declared", statement: naming.path, why: declaredBy(naming.doc, rel)! }
        : { level: "declared", why: `no run Statement in ${toPosix(relative(tree.root, dirname(abs))) || "."}/ has its digest among its subjects` };
    }
    else {
      const unbound = candidates.find((s) => !s.bound);
      r = unbound
        ? { level: "declared", statement: unbound.path, why: `the run Statement ${unbound.path} does not bind to this tree: ${unbound.problems.join("; ")}` }
        : { level: "declared", statement: candidates[0].path, why: `the run Statement ${candidates[0].path} carries no signature` };
    }
    reportReading.set(abs, r);
    return r;
  };

  // ADR-0119 decision 2 (R2): the rows that cite a code location and a test, their cited lines, and the
  // mutation fact a bound, signed run Statement records for them.
  const mutationTargets: MutationTarget[] = [];
  const mutationOf = new Map<AppliedRow, RowMutation>();
  const coverageOf = new Map<AppliedRow, NonNullable<RowProof["coverage"]>>();
  for (const row of rows) {
    const t = mutationTargetOf(row);
    if (t.target) mutationTargets.push(t.target);
    if (t.languages.length) mutationOf.set(row, { state: "no-mutator", met: true, languages: t.languages, why: `runward-run has no mutator for ${t.languages.join(", ")}: the row reaches attested without the mutation fact (ADR-0119 decision 2)` });
    if (t.target) mutationOf.set(row, readMutation(t.target, row));
    if (t.target) { const c = readCoverage(t.target, row); if (c) coverageOf.set(row, c); }
  }
  function readCoverage(target: MutationTarget, row: AppliedRow): RowProof["coverage"] | null {
    const dirs = [...new Set(row.pieces.filter((p) => p.nature === "junit" && p.abs).map((p) => dirname(p.abs!)))];
    for (const s of dirs.flatMap((d) => statementsIn(d))) {
      if (!s.bound || s.signatures === 0) continue;
      const cov = (s.doc.statement.predicate as { coverage?: { targets?: unknown[] } }).coverage;
      const t = Array.isArray(cov?.targets) ? cov!.targets!.find((x) => (x as MutationTarget)?.deliverable === target.deliverable && (x as MutationTarget)?.rule === target.rule) as { locations?: unknown[] } | undefined : undefined;
      if (!t || !Array.isArray(t.locations)) continue;
      const locations = t.locations.map((l) => l as { file: string; from: number; to: number; instrumented: number; executed: number })
        .filter((l) => target.locations.some((x) => x.file === l.file && x.from === l.from && x.to === l.to) && Number.isInteger(l.instrumented) && Number.isInteger(l.executed))
        .map((l) => ({ file: l.file, from: l.from, to: l.to, instrumented: l.instrumented, executed: l.executed }));
      if (locations.length) return { statement: s.path, locations };
    }
    return null;
  }
  function readMutation(target: MutationTarget, row: AppliedRow): RowMutation {
    const dirs = [...new Set(row.pieces.filter((p) => p.nature === "junit" && p.abs).map((p) => dirname(p.abs!)))];
    const carriers = dirs.flatMap((d) => statementsIn(d)).filter((s) => s.mutation);
    if (carriers.length === 0) return { state: "absent", met: false, why: "no run Statement beside its cited reports carries the mutation of its cited lines (runward-run's mutation leg, ADR-0120 decision 2)" };
    const signed = carriers.find((s) => s.bound && s.signatures > 0);
    if (signed) return mutationOutcome(target, (signed.doc.statement.predicate as { mutation?: unknown }).mutation, signed.path);
    const bound = carriers.find((s) => s.bound);
    if (bound) return { state: "unsigned", met: false, statement: bound.path, why: `the run Statement ${bound.path} carries no signature: the mutation of its cited lines it records is declared` };
    return { state: "unbound", met: false, statement: carriers[0].path, why: `the run Statement ${carriers[0].path} carries the mutation of its cited lines and does not bind to this tree: ${carriers[0].problems.join("; ")}` };
  }

  const byLevel: Record<ProofLevel, RowProof[]> = { "re-derived": [], attested: [], declared: [] };
  const below: LevelsReading["below"] = [];
  for (const row of rows) {
    const pieces: ProofPiece[] = row.pieces.map((p) => {
      if (p.pointer.kind === "adr") {
        const ok = !!p.pointer.adrId && adrIdExists(missionDir, `ADR-${p.pointer.adrId}`);
        return { pointer: p.pointer.raw, kind: "static", level: ok ? "re-derived" : "declared", setsLevel: false, ...(ok ? {} : { why: "the ADR does not resolve" }) };
      }
      if (!p.abs || !p.rel) return { pointer: p.pointer.raw, kind: "static", level: "declared", setsLevel: false, why: "the pointer does not resolve to a file of the project" };
      if (p.nature === null) return { pointer: p.pointer.raw, kind: "static", level: "re-derived", setsLevel: false };
      const r = readReport(p.abs, p.rel);
      return { pointer: p.pointer.raw, kind: "execution", nature: p.nature, report: p.rel, level: r.level, setsLevel: false, ...(r.statement ? { statement: r.statement } : {}), ...(r.why ? { why: r.why } : {}) };
    });
    const isProse = prose.has(`${row.deliverable}\u0000${row.rule}`);
    // A row the evidence breakdown reads as prose has no pointer the gate opened (it may cite the manifest
    // itself, which is circular): every piece of it rests on what the cell declares.
    if (isProse) for (const x of pieces) if (x.level !== "declared") { x.level = "declared"; x.why = "the gate does not open it as evidence (a pointer at the manifest itself, or at nothing it can read)"; }
    const execution = pieces.filter((x) => x.kind === "execution");
    const mutation = isProse ? undefined : mutationOf.get(row);
    const level: ProofLevel = isProse ? "declared" : execution.length > 0 && execution.every((x) => x.level === "attested") && (mutation?.met ?? true) ? "attested" : "re-derived";
    for (const x of pieces) {
      x.setsLevel = level === "declared" ? x.level === "declared"
        : level === "attested" ? x.kind === "execution"
          : x.kind === "static" && x.level === "re-derived";
    }
    const nature = requires.requirements[row.rule];
    const req = nature && nature !== "adr"
      ? { nature, attested: pieces.some((x) => x.kind === "execution" && x.nature === nature && x.level === "attested") }
      : undefined;
    const proof: RowProof = { deliverable: row.deliverable, rule: row.rule, level, pieces, ...(req ? { requires: req } : {}), ...(mutation ? { mutation } : {}), ...(coverageOf.has(row) && !isProse ? { coverage: coverageOf.get(row)! } : {}) };
    byLevel[level].push(proof);

    // What holds the row below the level the run requires.
    const holds: string[] = [];
    if (level === "declared") holds.push(pieces.length ? `rests on what the cell declares: ${pieces.filter((x) => x.level === "declared").map((x) => `${x.pointer}${x.why ? ` (${x.why})` : ""}`).join("; ") || "no pointer the gate could open"}` : "rests on prose: no pointer the gate could open");
    if (ctx.required === "attested" && level !== "declared") {
      const named = new Set<string>();
      for (const x of execution) {
        if (x.level === "attested" || named.has(x.report ?? "")) continue;
        named.add(x.report ?? "");
        holds.push(`execution: declared — ${x.report} (${x.why})`);
      }
      if (req && !req.attested && execution.every((x) => x.level === "attested")) {
        const declaredIn = requires.declared.get(nature);
        holds.push(`requires ${nature}: no attested report of that kind is cited${declaredIn ? ` (the journal declares it uncarriable in ${declaredIn})` : ""}`);
      }
      if (mutation && !mutation.met) holds.push(`mutation: ${mutation.why}`);
    }
    if (holds.length) below.push({ deliverable: row.deliverable, rule: row.rule, level, holds });
  }

  // The static half of `re-derived` (ADR-0119 decision 2): the declared territory analysed, under the
  // pinned policy, in languages the analyzers read.
  const a = ctx.analysis;
  const languages = a && a.known ? scope?.languages ?? [] : [];
  const territoryWhy = a === null ? "the mission pins no analysis policy (`\"analysis\"` in runward/scaffold-lock.json): its declared territory is not analysed (ADR-0118)"
    : !a.known ? `the analysis policy \`${a.policy}\` is not one this runward ships: nothing was analysed`
      : a.files.analysed === 0 ? "the analyzers read no file: the declared territory is empty"
        : languages.length > 0 ? `re-derived: not reachable, ${languages.join(", ")} ${languages.length === 1 ? "is" : "are"} not analysed`
          : null;
  const territory = { analysed: territoryWhy === null, files: a?.files.analysed ?? 0, languagesNotAnalysed: languages, why: territoryWhy };

  const statements = [...statementsByDir.values()].flat().sort((x, y) => byCodeUnit(x.path, y.path)).map(({ doc: _doc, ...s }) => ({ ...s, binds: [...s.binds].sort(byCodeUnit) }));
  // ADR-0119 decision 4: a level the LOCK asks for applies to the languages the analyzers read. On a
  // territory holding another one, the static half falls to `mechanical`, and every surface says so; a
  // level asked by name (`--require`) refuses such a territory instead.
  const fallback = ctx.source === "lock" && a !== null && a.known && a.files.analysed > 0 && languages.length > 0;
  const staticHalf = fallback ? ctx.mechanical : ctx.mechanical && territory.analysed && byLevel.declared.length === 0;
  // Under the fallback a declared row holds nothing (the static half asks for `mechanical`), and is still
  // listed at its level in `rows.declared`; `below` names only what holds the run below its level.
  const holding = !fallback ? below : ctx.required === "attested" ? below.filter((b) => b.level !== "declared") : [];
  const met = ctx.required === "re-derived" ? staticHalf
    : ctx.required === "attested" ? staticHalf && holding.length === 0
      : true;
  return {
    required: ctx.required, source: ctx.source, met,
    ...(fallback ? { fallback: languageFallbackLine(languages, ctx.required) } : {}),
    sentence: ATTESTED_SENTENCE, signatureVerified: false,
    rows: byLevel, territory, below: holding,
    execution: {
      statements, expected,
      mutation: mutationSentence([...mutationOf.values()]),
      mutationTargets,
    },
  };
}

/** The `levels` block of the payload, ONE implementation for `check` and `verify`. */
export function levelsPayload(l: LevelsReading): Record<string, unknown> {
  return {
    required: l.required, source: l.source, met: l.met,
    ...(l.fallback ? { fallback: l.fallback } : {}),
    sentence: l.sentence, signatureVerified: l.signatureVerified,
    counts: { "re-derived": l.rows["re-derived"].length, attested: l.rows.attested.length, declared: l.rows.declared.length },
    rows: l.rows,
    territory: l.territory,
    below: l.below,
    execution: l.execution,
  };
}

/** The name a directory listing needs to be read as a run Statement's file. */
export function isRunStatementFileName(name: string): boolean {
  return STATEMENT_FILE.test(basename(name));
}
