import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The behavioral-proof pointer, read from floor.md (ADR-0018 sibling, roadmap 4.2).
 *
 * The gate proves the *documentary* proof — the decisions are traced. It never runs the code:
 * runward is not a runtime. The *behavioral* proof is the operator's test suite. This reader
 * makes the two proofs legible together: it reads a declared pointer and, if an artifact is
 * named, reports whether it is present and fresh — **strictly read-only, never executed,
 * never parsed for pass/fail** (that stays the code's job and the operator's judgment).
 */
export interface BehavioralProof {
  declared: boolean;
  command?: string;
  artifact?: string; // relative to the mission root, as declared
  present?: boolean;
  date?: string; // artifact last-modified, YYYY-MM-DD, in UTC (the caller labels it so)
  fresh?: boolean; // artifact newer than the newest source under sourceRoot (undefined when not computed)
  sourceRoot?: string; // the directory freshness was measured against, relative to the root
  freshnessNotComputed?: string; // why `fresh` is undefined, in words the operator reads
}

/** Source extensions whose mtime counts. Wider than the first list (RWD-2026-0180), never "every file":
 *  a lockfile or a generated report under the root must not make the proof look stale. */
const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|scala|rb|php|cs|fs|swift|c|h|cc|cpp|hpp|ex|exs|clj|dart|lua|sh)$/;

/** A relative directory inside the root, or undefined: absolute, `..` or `~` are never followed
 *  (the judged tree only, ADR-0067 crossing 4). */
function insideRoot(root: string, rel: string | undefined): string | undefined {
  if (!rel) return undefined;
  const clean = rel.replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (clean === "" || clean === "." || clean.startsWith("/") || clean.startsWith("~") || /^[A-Za-z]:/.test(clean)) return undefined;
  if (clean.split(/[\\/]/).some((s) => s === "..")) return undefined;
  const abs = join(root, clean);
  try { return statSync(abs).isDirectory() ? clean : undefined; } catch { return undefined; }
}

/**
 * Where the proof's sources live (RWD-2026-0180). Until this, freshness was measured against
 * `<root>/code/` only, and a mission whose code lives elsewhere lost the mention with no word said.
 * In order: the directory the command enters (`cd X && …`), the legacy `code/`, then the artifact's
 * top-level directory. None found is a stated state, never a silent one.
 */
export function proofSourceRoot(root: string, command: string | undefined, artifact: string | undefined): string | undefined {
  const cd = command?.match(/^\s*cd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))\s*(?:&&|;|$)/);
  const fromCd = insideRoot(root, cd?.[1] ?? cd?.[2] ?? cd?.[3]);
  if (fromCd) return fromCd;
  if (insideRoot(root, "code")) return "code";
  const top = artifact?.replace(/^\.\/+/, "").split(/[\\/]/);
  return top && top.length > 1 ? insideRoot(root, top[0]) : undefined;
}

export function behavioralProof(mission: string, root: string): BehavioralProof {
  const floor = join(mission, "floor.md");
  if (!existsSync(floor)) return { declared: false };
  const text = readFileSync(floor, "utf8");
  const cmd = text.match(/^\s*[*_]*Behavioral proof[*_]*\s*:\s*`?([^`\n]+?)`?\s*$/mi);
  const art = text.match(/^\s*[*_]*Proof artifact[*_]*\s*:\s*`?([^`\n]+?)`?\s*$/mi);
  if (!cmd && !art) return { declared: false };

  const proof: BehavioralProof = { declared: true, command: cmd?.[1]?.trim(), artifact: art?.[1]?.trim() };
  if (proof.artifact) {
    const abs = join(root, proof.artifact);
    proof.present = existsSync(abs);
    if (proof.present) {
      const st = statSync(abs);
      proof.date = st.mtime.toISOString().slice(0, 10);
      const src = proofSourceRoot(root, proof.command, proof.artifact);
      if (!src) proof.freshnessNotComputed = "no source root found";
      else {
        proof.sourceRoot = src;
        const newest = newestSourceMtime(join(root, src));
        if (newest === 0) proof.freshnessNotComputed = `no source file under ${src}/`;
        else proof.fresh = st.mtimeMs >= newest;
      }
    }
  }
  return proof;
}

/** Newest mtime of a tracked source file under a dir — read-only, node_modules and dotfiles skipped. */
function newestSourceMtime(dir: string): number {
  let newest = 0;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) newest = Math.max(newest, newestSourceMtime(p));
    else if (SOURCE.test(e.name)) newest = Math.max(newest, statSync(p).mtimeMs);
  }
  return newest;
}
