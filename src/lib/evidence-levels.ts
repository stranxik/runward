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
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { GATED_DELIVERABLES, adrIdExists, parseManifest } from "./conformance.js";
import { normalizedFileSha256, parseEvidencePointers, requiresReading, resolutionBases, resolveEvidencePath, type EvidencePointer } from "./evidence.js";
import { isCoberturaReport, isCycloneDxSbom, isEslintReport, isJUnitReport, isLcovReport, isLoadTestReport, isRunwardJUnit, isSarifReport } from "./tool-adapters.js";
import { analysisScope, type AnalysisReading } from "./analyze.js";
import { IN_TOTO_STATEMENT_TYPE, RUNWARD_RUN_PREDICATE_TYPE, digestOfFiles, rawFileSha256 } from "./attestation.js";
import { toPosix } from "./paths.js";

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
        cache.set(rel, isRegularFile(abs) ? normalizedFileSha256(abs) : "absent");
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
}

export interface LevelsReading {
  /** The level the run requires, where it was asked, and whether the verdict meets it. */
  required: RequiredLevel;
  source: "flag" | "default";
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
  };
}

export interface LevelsContext {
  required: RequiredLevel;
  source: "flag" | "default";
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
    else if (candidates.length === 0) r = { level: "declared", why: `no run Statement in ${toPosix(relative(tree.root, dirname(abs))) || "."}/ has its digest among its subjects` };
    else {
      const unbound = candidates.find((s) => !s.bound);
      r = unbound
        ? { level: "declared", statement: unbound.path, why: `the run Statement ${unbound.path} does not bind to this tree: ${unbound.problems.join("; ")}` }
        : { level: "declared", statement: candidates[0].path, why: `the run Statement ${candidates[0].path} carries no signature` };
    }
    reportReading.set(abs, r);
    return r;
  };

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
    const execution = pieces.filter((x) => x.kind === "execution");
    const isProse = prose.has(`${row.deliverable}\u0000${row.rule}`);
    const level: ProofLevel = isProse ? "declared" : execution.length > 0 && execution.every((x) => x.level === "attested") ? "attested" : "re-derived";
    for (const x of pieces) {
      x.setsLevel = level === "declared" ? x.level === "declared"
        : level === "attested" ? x.kind === "execution"
          : x.kind === "static" && x.level === "re-derived";
    }
    const nature = requires.requirements[row.rule];
    const req = nature && nature !== "adr"
      ? { nature, attested: pieces.some((x) => x.kind === "execution" && x.nature === nature && x.level === "attested") }
      : undefined;
    const proof: RowProof = { deliverable: row.deliverable, rule: row.rule, level, pieces, ...(req ? { requires: req } : {}) };
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
  const reDerived = ctx.mechanical && territory.analysed && byLevel.declared.length === 0;
  const met = ctx.required === "re-derived" ? reDerived
    : ctx.required === "attested" ? reDerived && below.length === 0
      : true;
  const anyMutation = statements.some((s) => s.bound && s.mutation);
  return {
    required: ctx.required, source: ctx.source, met,
    sentence: ATTESTED_SENTENCE, signatureVerified: false,
    rows: byLevel, territory, below,
    execution: {
      statements, expected,
      mutation: anyMutation
        ? "a run Statement bound here carries a mutation leg, which this version does not read: its facts are not part of the level (ADR-0120 R2)"
        : "no mutation fact: no run Statement bound here carries a mutation leg, so a row reaches attested without one (ADR-0119 decision 2)",
    },
  };
}

/** The `levels` block of the payload, ONE implementation for `check` and `verify`. */
export function levelsPayload(l: LevelsReading): Record<string, unknown> {
  return {
    required: l.required, source: l.source, met: l.met,
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
