// Canonical identities of accountable persons (ADR-0088 decision 4).
//
// ADR-0082 compared the person accountable for an agent with a row's proposer as free strings, so
// `--for thibaultsouris` did not match a proposer written `Thibault Souris`, and two agents
// answering to the same person read as independent whenever the proposer's text named the agent
// rather than the person. ADR-0088 decision 4 compares accountable persons by CANONICAL ID instead:
// the forge account plus the aliases it is known by.
//
// Where the ids are declared. ADR-0088 decision 5 puts the accountable person's canonical id in the
// delegation charter, `runward/delegation.md` (delegation.ts). The lock's
// `"identities": { "<canonical id>": ["<alias>", …] }` came first, as an interim home, and is still
// read: `readIdentities` below returns the lock's alone, and delegation.ts `missionIdentities` merges
// the charter's accountable person over it (the precedence is stated there). The id is opaque to
// runward (the forge account, e.g. `github:12345678` or `github:<login>`); runward never resolves it
// against a forge, so it is DECLARED, like every name in a ratification trace (RWD-2026-0119).
//
// Pure, with no process and no socket: conformance.ts imports it, and conformance.ts is in the
// verdict path (ADR-0054).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Identities = Record<string, string[]>;

/** A name folded for comparison: Unicode-normalised, lower-cased, letters and digits only. Folding
 *  is what makes `Thibault Souris`, `thibault-souris` and `thibaultsouris` one spelling; aliases
 *  are what make `stranxik` the same person. */
export function foldName(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** The mission's declared identities, from its committed scaffold-lock.json. Malformed entries are
 *  dropped, never repaired: an alias list that is not a list of strings declares nothing. */
export function readIdentities(missionDir: string): Identities {
  let j: unknown;
  try { j = JSON.parse(readFileSync(join(missionDir, "scaffold-lock.json"), "utf8")); } catch { return {}; }
  const raw = (j as { identities?: unknown } | null)?.identities;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Identities = {};
  for (const [id, aliases] of Object.entries(raw as Record<string, unknown>)) {
    if (!foldName(id) || !Array.isArray(aliases)) continue;
    out[id] = aliases.filter((a): a is string => typeof a === "string" && foldName(a) !== "");
  }
  return out;
}

/** The lock's `singleAccountable` exception (ADR-0088 decision 4): the canonical id of the one
 *  person who answers for both the proposing and the ratifying agent. Absent unless declared. */
export function singleAccountableOptIn(missionDir: string): string | null {
  try {
    const j = JSON.parse(readFileSync(join(missionDir, "scaffold-lock.json"), "utf8"));
    const v = j?.singleAccountable;
    return typeof v === "string" && foldName(v) !== "" ? v : null;
  } catch { return null; }
}

export interface Resolved {
  /** The canonical id when declared, else the folded name itself. */
  id: string;
  /** True when the name is a canonical id or an alias declared in `identities`, for exactly one id. */
  declared: boolean;
}

/** Resolve a declared name to a canonical id. A name that matches two declared ids resolves to
 *  neither: an ambiguous declaration must not decide whose name it is. */
export function resolveIdentity(name: string, identities: Identities): Resolved {
  const f = foldName(name);
  const hits = f === "" ? [] : Object.keys(identities).filter((id) =>
    foldName(id) === f || identities[id].some((a) => foldName(a) === f));
  return hits.length === 1 ? { id: hits[0], declared: true } : { id: f, declared: false };
}

/** Every spelling a canonical id is known by, its own included: what the comparison looks for in a
 *  proposer segment written before `propose` recorded an accountable person. */
export function spellingsOf(r: Resolved, name: string, identities: Identities): string[] {
  return r.declared ? [r.id, ...(identities[r.id] ?? [])] : [name];
}

/** The two disclosures ADR-0088 decision 4 prints, at the character, on every surface. */
export const SINGLE_ACCOUNTABLE_DISCLOSURE =
  "single accountable person; agent ratifications are disclosed throughput, not independent approval";
export const SINGLE_ACCOUNTABLE_REGULATED_NOTE =
  "not a DORA change-approval control; ADR-0080 Part 2 unchanged";

/** A GitHub no-reply address carries the account: `12345+login@users.noreply.github.com` (or the
 *  older `login@users.noreply.github.com`). Returns the login, or null. Used only to SHOW the
 *  committing account beside a declared name; it proves nothing about who typed the commit. */
export function forgeLoginFromEmail(email: string): string | null {
  // String slicing, no pattern: the scan flags a nested quantifier here (RWD-2026-0114's lesson).
  const e = email.trim().toLowerCase();
  const DOMAIN = "@users.noreply.github.com";
  if (!e.endsWith(DOMAIN)) return null;
  const local = e.slice(0, -DOMAIN.length);
  const plus = local.indexOf("+");
  const login = plus !== -1 && /^\d+$/.test(local.slice(0, plus)) ? local.slice(plus + 1) : local;
  return login === "" || /[@+\s]/.test(login) ? null : login;
}

/** Does the declared `by:` of an entry name the identity that committed it? Folded and
 *  alias-resolved on both sides; the committer's name, its no-reply login and its e-mail local part
 *  are each tried. This compares what git recorded with what the entry declares: git records what
 *  the committer configured, so a match is a consistency, not a signature (ADR-0088 stage 1). */
export function byMatchesCommitter(by: string, committer: { name: string; email: string }, identities: Identities): boolean {
  const want = resolveIdentity(by, identities).id;
  const login = forgeLoginFromEmail(committer.email);
  const local = committer.email.split("@")[0] ?? "";
  return [committer.name, login ?? "", local].filter((x) => foldName(x) !== "")
    .some((x) => resolveIdentity(x, identities).id === want);
}
