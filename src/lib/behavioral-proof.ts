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
  date?: string; // artifact last-modified, YYYY-MM-DD
  fresh?: boolean; // artifact newer than the newest source under <root>/code/ (undefined if no code/)
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
      const codeDir = join(root, "code");
      const newest = existsSync(codeDir) ? newestSourceMtime(codeDir) : 0;
      proof.fresh = newest === 0 ? undefined : st.mtimeMs >= newest;
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
    else if (/\.(ts|tsx|js|jsx|py|go|rs|java|rb)$/.test(e.name)) newest = Math.max(newest, statSync(p).mtimeMs);
  }
  return newest;
}
