import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { parseManifest, evidencePathTokens, adrIdExists, GATED_DELIVERABLES } from "./conformance.js";
import type { Violation } from "./conformance.js";

/**
 * The evidence layer (ADR-0019/0020/0021): deterministic checks on what an `applied`
 * pointer points at. Existence, non-vacuity, line count, substring, hash — bytes,
 * never judgment. It reads files; it never executes anything and never calls a model.
 *
 * Pointer grammar (opt-in per row, several per cell separated by `;`, prose untouched):
 *   file:PATH[:LINE][#SYMBOL] · test:PATH[::NAME] · adr:NNNN
 */

export interface EvidencePointer {
  kind: "file" | "test" | "adr";
  raw: string;
  path?: string;
  line?: number;
  symbol?: string;
  testName?: string;
  adrId?: string;
}

const POINTER_PREFIX = /\b(file|test|adr):(\S.*)$/;

/** Parse the typed pointers out of an Evidence cell. One pointer per `;`-separated segment. */
export function parseEvidencePointers(evidence: string): EvidencePointer[] {
  const out: EvidencePointer[] = [];
  for (const segment of evidence.split(";")) {
    const m = segment.trim().match(POINTER_PREFIX);
    if (!m) continue;
    const kind = m[1] as EvidencePointer["kind"];
    const rest = m[2];
    const raw = `${kind}:${rest.split(/\s/)[0]}`;
    if (kind === "adr") {
      const id = rest.match(/^(\d{1,6})\b/)?.[1];
      if (id) out.push({ kind, raw: `adr:${id}`, adrId: id });
      continue;
    }
    if (kind === "test") {
      const sep = rest.indexOf("::");
      const firstWs = rest.search(/\s/);
      if (sep !== -1 && (firstWs === -1 || sep < firstWs)) {
        const name = rest.slice(sep + 2).trim().replace(/^["']|["']$/g, "");
        out.push({ kind, raw, path: clean(rest.slice(0, sep)), testName: name || undefined });
      } else {
        out.push({ kind, raw, path: clean(rest.split(/\s/)[0]) });
      }
      continue;
    }
    // file:PATH[:LINE][#SYMBOL]
    let token = clean(rest.split(/\s/)[0]);
    let symbol: string | undefined;
    const hash = token.indexOf("#");
    if (hash !== -1) { symbol = token.slice(hash + 1) || undefined; token = token.slice(0, hash); }
    let line: number | undefined;
    const ln = token.match(/:(\d+)$/);
    if (ln) { line = Number(ln[1]); token = token.slice(0, -ln[0].length); }
    out.push({ kind, raw, path: token, line, symbol });
  }
  return out;
}

/** Strip the trailing punctuation prose leaves on a token (`src/x.ts),` → `src/x.ts`). */
function clean(token: string): string {
  return token.replace(/[),.:]+$/, "");
}

/** The same three resolution bases as the drift pass (ADR-0004). */
export function resolutionBases(missionDir: string, deliverable: string): string[] {
  return [dirname(missionDir), missionDir, dirname(join(missionDir, deliverable))];
}

function resolveFile(p: string, bases: string[]): string | null {
  if (isAbsolute(p)) return existsSync(p) ? p : null;
  for (const b of bases) {
    const abs = join(b, p);
    if (existsSync(abs)) return abs;
  }
  return null;
}

function isRegularFile(abs: string): boolean {
  try { return statSync(abs).isFile(); } catch { return false; }
}

/**
 * Blocking evidence checks for one gated deliverable (ADR-0019/0020):
 * typed pointers verified per type, resolvable pointed files non-empty,
 * signed rules matched against their signature.
 */
export function evidenceReport(missionDir: string, deliverable: string, signatures: Record<string, string>): Violation[] {
  const path = join(missionDir, deliverable);
  if (!existsSync(path)) return [];
  const bases = resolutionBases(missionDir, deliverable);
  const out: Violation[] = [];

  for (const row of parseManifest(readFileSync(path, "utf8"))) {
    if (row.status !== "applied") continue;
    if (/^\[.*\]$/.test(row.rule)) continue; // template placeholder row
    const pointers = parseEvidencePointers(row.evidence);
    const resolvedFiles = new Map<string, string>(); // abs path → content (read once)

    for (const p of pointers) {
      if (p.kind === "adr") {
        if (!adrIdExists(missionDir, `ADR-${p.adrId}`)) {
          out.push({ rule: row.rule, problem: `typed pointer adr:${p.adrId} — no matching ADR in runward/adr/` });
        }
        continue;
      }
      const abs = p.path ? resolveFile(p.path, bases) : null;
      if (!abs) { out.push({ rule: row.rule, problem: `typed pointer does not resolve: ${p.raw} — update it or remove the row` }); continue; }
      if (!isRegularFile(abs)) { out.push({ rule: row.rule, problem: `typed pointer resolves to a directory, not a file: ${p.raw}` }); continue; }
      const content = readFileSync(abs, "utf8");
      resolvedFiles.set(abs, content);
      if (!/\S/.test(content)) { out.push({ rule: row.rule, problem: `typed pointer resolves to an empty file: ${p.raw} — an empty file is not evidence` }); continue; }
      if (p.line !== undefined && content.split("\n").length < p.line) {
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the file has fewer than ${p.line} lines` });
      }
      if (p.symbol !== undefined && !content.includes(p.symbol)) {
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — symbol "${p.symbol}" not found in the file (moved or renamed? update the pointer)` });
      }
      if (p.testName !== undefined && !content.includes(p.testName)) {
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — test named "${p.testName}" not found in the file` });
      }
    }

    // Non-vacuity for every row (ADR-0019): a path token that resolves must resolve to real content.
    for (const t of evidencePathTokens(row.evidence)) {
      const abs = resolveFile(t, bases);
      if (!abs || !isRegularFile(abs) || resolvedFiles.has(abs)) continue;
      const content = readFileSync(abs, "utf8");
      resolvedFiles.set(abs, content);
      if (!/\S/.test(content)) {
        out.push({ rule: row.rule, problem: `evidence points at an empty file: ${t} — an empty file is not evidence` });
      }
    }

    // Signature (ADR-0020): a signed rule's applied evidence must contain the rule's shape.
    const sig = signatures[row.rule];
    if (sig) {
      let re: RegExp;
      try { re = new RegExp(sig, "i"); }
      catch { out.push({ rule: row.rule, problem: `invalid signature regex in the rule file: /${sig}/ — fix runward/rules/${row.rule}.md` }); continue; }
      if (resolvedFiles.size === 0) {
        out.push({ rule: row.rule, problem: `this rule declares an evidence signature — point the applied evidence at a file (file: or test:) whose content matches /${sig}/i` });
      } else if (![...resolvedFiles.values()].some((c) => re.test(c))) {
        out.push({ rule: row.rule, problem: `evidence does not match the rule's signature /${sig}/i — the pointed content lacks the rule's shape (cited, not applied?)` });
      }
    }
  }
  return out;
}

// ── Evidence sealing (ADR-0021) — an opt-in SHA-256 seal of a green gate ──

export const EVIDENCE_LOCK = "evidence-lock.json";

function sha256(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

/** Every evidence file that resolves across the gated manifests, keyed by project-root-relative path. */
export function collectSealableEvidence(missionDir: string): Record<string, string> {
  const root = dirname(missionDir);
  const files = new Map<string, string>();
  for (const { deliverable } of GATED_DELIVERABLES) {
    const path = join(missionDir, deliverable);
    if (!existsSync(path)) continue;
    const bases = resolutionBases(missionDir, deliverable);
    for (const row of parseManifest(readFileSync(path, "utf8"))) {
      if (row.status !== "applied" || /^\[.*\]$/.test(row.rule)) continue;
      const candidates = [
        ...parseEvidencePointers(row.evidence).map((p) => p.path).filter((p): p is string => !!p),
        ...evidencePathTokens(row.evidence),
      ];
      for (const t of candidates) {
        const abs = resolveFile(t, bases);
        if (abs && isRegularFile(abs)) files.set(relative(root, abs), "");
      }
    }
  }
  const out: Record<string, string> = {};
  for (const rel of [...files.keys()].sort()) out[rel] = sha256(join(root, rel));
  return out;
}

/** The lock file content — stable order, byte-idempotent on unchanged evidence. */
export function renderEvidenceLock(missionDir: string, sealedAt: string): string {
  return JSON.stringify({ version: 1, sealedAt, files: collectSealableEvidence(missionDir) }, null, 2) + "\n";
}

/** Verify an existing seal. No lock file → no seal check (opt-in by construction). */
export function verifyEvidenceLock(missionDir: string): { present: boolean; sealedAt?: string; count: number; violations: Violation[] } {
  const lockPath = join(missionDir, EVIDENCE_LOCK);
  if (!existsSync(lockPath)) return { present: false, count: 0, violations: [] };
  const root = dirname(missionDir);
  let lock: { sealedAt?: string; files?: Record<string, string> };
  try { lock = JSON.parse(readFileSync(lockPath, "utf8")); }
  catch { return { present: true, count: 0, violations: [{ rule: "(seal)", problem: `runward/${EVIDENCE_LOCK} is not valid JSON — re-seal with \`runward check --freeze\` or remove it` }] }; }
  const files = lock.files ?? {};
  const violations: Violation[] = [];
  for (const [rel, hash] of Object.entries(files)) {
    const abs = join(root, rel);
    if (!existsSync(abs) || !isRegularFile(abs)) {
      violations.push({ rule: "(seal)", problem: `sealed evidence missing: ${rel} — the file the gate crossed on is gone. Re-verify the pointer, then re-seal with \`runward check --freeze\`` });
    } else if (sha256(abs) !== hash) {
      violations.push({ rule: "(seal)", problem: `sealed evidence changed: ${rel} — re-read the pointer, confirm the evidence still holds, then re-seal with \`runward check --freeze\`` });
    }
  }
  return { present: true, sealedAt: lock.sealedAt, count: Object.keys(files).length, violations };
}
