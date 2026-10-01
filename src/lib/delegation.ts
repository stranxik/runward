// The delegation charter (ADR-0088 decision 5): `runward/delegation.md`, read by the gate, proving
// nothing by itself.
//
// What it is. The policy under which agents act for one accountable person: who answers (a canonical
// id and its aliases), which agents may act (the delegates), which class of act is delegated (R, H, I,
// D, ADR-0088 decision 2), the budgets and the sample size of the weekly control, the window it is in
// force for (`effective:` to `expires:`, at most 90 days), and the pre-merge escalation list
// (decision 7), as data. It is written by the audited party, so the gate says it is declared, never
// proved, on every surface that reads it: `operator-role.md` refused a "validated by" field for that
// exact reason, and this file is that kind of artifact (ADR-0080).
//
// What the gate does with it. Reads it, validates its schema, and names every way it fails as a strict
// gap; refuses class I while stage 1 holds; names an agent ratification by an agent the charter does
// not list as a delegate, and one dated after the charter expired. It never compares `expires:` with
// the wall clock: the verdict path has no clock by design (ADR-0054, "same working tree, same
// verdict"), so a charter expiring overnight must not turn yesterday's green tree red. Expiry is read
// against the dates the tree itself declares (each agent ratification entry's date), which re-runs
// identically on any day; `runward doctor`, outside the verdict path, sets `expires:` beside the clock.
//
// The grammar is the workflow contract's (hand-parsed `key: value`, `key: [a, b]`), plus block lists
// (`key:` then `  - item` lines) for entries that carry commas. No new dependency enters the verdict
// path, and no pattern is built from input (string slicing, CodeQL's lesson on partial escaping).
//
// Pure: it reads one file and returns data. No process, no socket, no git (ADR-0054).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { foldName, readIdentities, type Identities } from "./identity.js";

/** Mission-relative, like every deliverable the gate names. */
export const CHARTER_FILE = "delegation.md";
export const CHARTER_FORMAT = "runward-delegation/1";
/** ADR-0088 decision 5: `expires:` at most 90 days after `effective:`. */
export const CHARTER_MAX_DAYS = 90;

/** ADR-0088 decision 1, at the character: the stage-1 banner every surface prints. */
export const DELEGATION_STAGE1_BANNER = "delegation: declared, not proved — the maintainer's credential is within agent reach";
/** ADR-0088 decision 5, the part that exists today (the signed sample is a later change). */
export const CHARTER_BANNER = "charter: declared, not proved";

export type ActClass = "R" | "H" | "I" | "D";
export const ACT_CLASSES: readonly ActClass[] = ["R", "H", "I", "D"];

/** Why a charter, or an act under it, is a strict gap. Values are only ever added (ADR-0030).
 *  - `charter-malformed`     a field is missing, unknown, duplicated or does not have its shape.
 *  - `charter-class-refused` a class is delegated that may not be: R and H never, I not in stage 1.
 *  - `charter-stage-unread`  stage 2 declared; this version reads none of stage 2's evidence.
 *  - `charter-expired`       an agent ratification dated after the charter's `expires:`.
 *  - `agent-not-delegate`    an agent ratification by an agent the charter does not list. */
export type CharterGapKind = "charter-malformed" | "charter-class-refused" | "charter-stage-unread" | "charter-expired" | "agent-not-delegate";

export interface CharterProblem { kind: CharterGapKind; problem: string }

export interface Charter {
  stage: 1 | 2 | null;
  accountable: string | null;
  aliases: string[];
  delegates: string[];
  classes: Record<ActClass, string | null>;
  scopes: Partial<Record<ActClass, string[]>>;
  budgets: { consecutiveRefusals: number | null; refusalsPerPeriod: number | null };
  sample: { size: number | null; seeds: number | null; periodDays: number | null };
  effective: string | null;
  expires: string | null;
  preMerge: { paths: string[]; events: string[] };
  /** Everything wrong with the charter itself, named; empty when its schema holds. */
  problems: CharterProblem[];
}

const SCALAR_KEYS = new Set([
  "charter", "stage", "accountable", "class-R", "class-H", "class-I", "class-D",
  "budget-consecutive-refusals", "budget-refusals-per-period", "sample-size", "sample-seeds", "sample-period-days",
  "effective", "expires",
]);
const LIST_KEYS = new Set(["aliases", "delegates", "scope-R", "scope-H", "scope-I", "scope-D", "pre-merge-paths", "pre-merge-events"]);

/** A key is letters, digits and hyphens, starting with a letter: checked by character, not by a
 *  pattern built from anything the file says. */
function isKey(k: string): boolean {
  if (k === "" || !/[A-Za-z]/.test(k[0])) return false;
  for (const ch of k) if (!/[A-Za-z0-9-]/.test(ch)) return false;
  return true;
}

function unquote(v: string): string {
  const t = v.trim();
  return t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'"))) ? t.slice(1, -1) : t;
}

/** `[a, b]` → [a, b]: exactly one bracket stripped at each end, so `runward-steward[bot]` survives. */
function inlineList(v: string): string[] | null {
  const t = v.trim();
  if (!t.startsWith("[") || !t.endsWith("]")) return null;
  return t.slice(1, -1).split(",").map(unquote).filter((x) => x !== "");
}

/** The frontmatter between the first two `---` lines, or null when the file opens with none. */
function frontmatter(content: string): string[] | null {
  const lines = content.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.indexOf("---", 1);
  return end === -1 ? null : lines.slice(1, end);
}

/** A real calendar date written YYYY-MM-DD, as a UTC day number; null otherwise. */
export function isoDay(v: string | null): number | null {
  if (v === null || v.length !== 10 || v[4] !== "-" || v[7] !== "-") return null;
  for (const i of [0, 1, 2, 3, 5, 6, 8, 9]) if (v[i] < "0" || v[i] > "9") return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? Math.round(d.getTime() / 86_400_000) : null;
}

function positiveInt(v: string | undefined): number | null {
  if (v === undefined || v === "" || v.length > 6) return null;
  for (const ch of v) if (ch < "0" || ch > "9") return null;
  const n = Number(v);
  return n >= 1 ? n : null;
}

/** A mission-relative path or glob stays inside the judged tree (the workflow-contract posture). */
function confined(p: string): boolean {
  return !p.startsWith("/") && !(p.length > 1 && p[1] === ":") && !p.split("/").includes("..");
}

/** Parse a charter's text. Never throws: every defect is a named problem. */
export function parseCharter(content: string): Charter {
  const problems: CharterProblem[] = [];
  const bad = (problem: string) => problems.push({ kind: "charter-malformed", problem });
  const scalars = new Map<string, string>();
  const lists = new Map<string, string[]>();
  const fm = frontmatter(content);
  if (fm === null) bad("no frontmatter: the charter opens with a `---` block of `key: value` lines (see templates/delegation/delegation.md)");
  let open: string | null = null;
  for (const raw of fm ?? []) {
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;
    const indented = raw.startsWith(" ") || raw.startsWith("\t");
    const item = raw.trimStart();
    if (indented && item.startsWith("- ")) {
      if (open === null) { bad(`a list item outside a list: "${item}"`); continue; }
      const v = unquote(item.slice(2));
      if (v !== "") lists.get(open)!.push(v);
      continue;
    }
    open = null;
    const at = raw.indexOf(":");
    const key = at === -1 ? "" : raw.slice(0, at).trim();
    if (!isKey(key)) { bad(`a line that is not \`key: value\`: "${raw.trim()}"`); continue; }
    const value = raw.slice(at + 1).trim();
    if (!SCALAR_KEYS.has(key) && !LIST_KEYS.has(key)) { bad(`unknown field "${key}": a field the gate does not read is a promise nobody checks`); continue; }
    if (scalars.has(key) || lists.has(key)) { bad(`field "${key}" declared twice`); continue; }
    if (LIST_KEYS.has(key)) {
      if (value === "") { lists.set(key, []); open = key; continue; }
      const l = inlineList(value);
      if (l === null) { bad(`field "${key}" is a list: \`${key}: [a, b]\`, or \`${key}:\` followed by \`  - item\` lines`); continue; }
      lists.set(key, l);
      continue;
    }
    scalars.set(key, unquote(value));
  }

  // A template placeholder left in place (`<account>`) is a field nobody filled, whatever its shape.
  for (const [k, v] of [...scalars.entries(), ...[...lists.entries()].flatMap(([k2, l]) => l.map((x) => [k2, x] as [string, string]))]) {
    if (v.includes("<") && v.includes(">")) bad(`${k}: "${v}" is a template placeholder — fill it`);
  }

  if (fm !== null) {
    const format = scalars.get("charter");
    if (format !== CHARTER_FORMAT) bad(`charter: "${format ?? ""}" — this version reads "${CHARTER_FORMAT}"`);
  }

  const stageRaw = scalars.get("stage");
  const stage = stageRaw === "1" ? 1 : stageRaw === "2" ? 2 : null;
  if (fm !== null && stage === null) bad(`stage: "${stageRaw ?? ""}" — 1 or 2 (ADR-0088 decision 1)`);
  if (stage === 2) problems.push({ kind: "charter-stage-unread", problem: "stage: 2 declared, and this version reads none of stage 2's evidence (a separate OS user for agents, commits signed by a key in allowedSigners, signed samples): stage 2 is what the gate checks, not what the charter says (ADR-0088 decision 1)" });

  const accountableRaw = scalars.get("accountable") ?? "";
  const accountable = foldName(accountableRaw) === "" ? null : accountableRaw;
  if (fm !== null && accountable === null) bad("accountable: missing — the canonical id of the one person who answers for the delegates (e.g. github:<account>)");
  const aliases = lists.get("aliases") ?? [];

  const delegates = lists.get("delegates") ?? [];
  if (fm !== null && delegates.length === 0) bad("delegates: none listed — the agents (and the App's forge identity) allowed to act under this charter");
  if (accountable !== null) {
    const person = new Set([accountable, ...aliases].map(foldName));
    for (const d of delegates) {
      if (person.has(foldName(d))) bad(`delegates: "${d}" is the accountable person: an agent acts under its own identity, never under a human's (ADR-0082)`);
    }
  }

  const classes = { R: null, H: null, I: null, D: null } as Record<ActClass, string | null>;
  for (const k of ACT_CLASSES) {
    const v = scalars.get(`class-${k}`) ?? null;
    classes[k] = v;
    if (fm === null) continue;
    if (v === null) { bad(`class-${k}: missing — maintainer, delegated or refused`); continue; }
    if (v !== "maintainer" && v !== "delegated" && v !== "refused") { bad(`class-${k}: "${v}" — maintainer, delegated or refused`); continue; }
    if ((k === "R" || k === "H") && v !== "maintainer") {
      problems.push({ kind: "charter-class-refused", problem: `class-${k}: "${v}" — class ${k} (${k === "R" ? "trust roots" : "judgement owed to a third party"}) is the maintainer's in every stage (ADR-0088 decision 2)` });
    }
    if (k === "I" && v === "delegated" && stage !== 2) {
      problems.push({ kind: "charter-class-refused", problem: "class-I: \"delegated\" — irreversible public acts are not delegated in stage 1 (ADR-0088 decisions 1 and 2): write class-I: refused" });
    }
  }
  const scopes: Partial<Record<ActClass, string[]>> = {};
  for (const k of ACT_CLASSES) { const s = lists.get(`scope-${k}`); if (s) scopes[k] = s; }

  const int = (key: string, why: string): number | null => {
    const raw = scalars.get(key);
    const n = positiveInt(raw);
    if (fm !== null && n === null) bad(`${key}: "${raw ?? ""}" — a whole number of at least 1 (${why})`);
    return n;
  };
  const budgets = {
    consecutiveRefusals: int("budget-consecutive-refusals", "ADR-0088 decision 9"),
    refusalsPerPeriod: int("budget-refusals-per-period", "ADR-0088 decision 9"),
  };
  const sample = {
    size: int("sample-size", "acts drawn each period, ADR-0088 decision 6"),
    seeds: int("sample-seeds", "seeded defective items each period, ADR-0088 decision 6"),
    periodDays: int("sample-period-days", "the sampling period, ADR-0088 decision 6"),
  };

  const effective = scalars.get("effective") ?? null;
  const expires = scalars.get("expires") ?? null;
  const e0 = isoDay(effective), e1 = isoDay(expires);
  if (fm !== null && e0 === null) bad(`effective: "${effective ?? ""}" — the date the charter takes effect, YYYY-MM-DD`);
  if (fm !== null && e1 === null) bad(`expires: "${expires ?? ""}" — the date it lapses, YYYY-MM-DD`);
  if (e0 !== null && e1 !== null) {
    if (e1 <= e0) bad(`expires: ${expires} is not after effective: ${effective}`);
    else if (e1 - e0 > CHARTER_MAX_DAYS) bad(`expires: ${expires} is ${e1 - e0} days after effective: ${effective}; at most ${CHARTER_MAX_DAYS} (ADR-0088 decision 5)`);
  }

  const preMerge = { paths: lists.get("pre-merge-paths") ?? [], events: lists.get("pre-merge-events") ?? [] };
  if (fm !== null) {
    if (preMerge.paths.length === 0) bad("pre-merge-paths: none listed — the paths whose changes wait for the maintainer before merge (ADR-0088 decision 7)");
    else if (!preMerge.paths.includes(`runward/${CHARTER_FILE}`)) bad(`pre-merge-paths: runward/${CHARTER_FILE} is not listed — the charter is itself a pre-merge path (ADR-0088 decision 7)`);
    for (const p of preMerge.paths) if (!confined(p)) bad(`pre-merge-paths: "${p}" escapes the repository — repository-relative paths only`);
  }

  return { stage, accountable, aliases, delegates, classes, scopes, budgets, sample, effective, expires, preMerge, problems };
}

/** The mission's charter, or null when it has none. No charter: nothing changes (ADR-0088 is opt-in
 *  for every mission; `init` and `wire` never write one, the charter is a class R act). */
export function readCharter(missionDir: string): Charter | null {
  const path = join(missionDir, CHARTER_FILE);
  if (!existsSync(path)) return null;
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch { text = ""; }
  return parseCharter(text);
}

/** Is `agent` (a declared `by:`) one of the charter's delegates? Folded, so `Claude` and `claude`
 *  are one name; never alias-resolved, because a delegate is an agent, not a person. */
export function isDelegate(charter: Charter, agent: string | undefined): boolean {
  if (agent === undefined || foldName(agent) === "") return false;
  const f = foldName(agent);
  return charter.delegates.some((d) => foldName(d) === f);
}

/**
 * The identities the mission declares, the charter's merged over the lock's (ADR-0088 decisions 4 and
 * 5). PRECEDENCE: the charter is the home of the accountable person's canonical id; the lock's
 * `"identities"` (PR #351's interim home) stay read, so nothing a lock declared stops resolving.
 *  1. Every id the lock declares is kept, with its aliases.
 *  2. The charter's `accountable` id gets the union of its own `aliases` and the lock's for that id.
 *  3. An alias the charter gives its accountable person is taken off every OTHER id in the lock: on
 *     the accountable person's own names, the charter wins. (Two ids claiming one alias would
 *     otherwise resolve to neither, and a stale lock entry could unname the maintainer.)
 * A malformed charter still contributes its accountable id and aliases when they are readable: the
 * malformation is a named gap of its own, and dropping the names would change unrelated causes.
 */
export function missionIdentities(missionDir: string, charter: Charter | null = readCharter(missionDir)): Identities {
  const lock = readIdentities(missionDir);
  if (!charter || charter.accountable === null) return lock;
  const id = charter.accountable;
  const own = [...charter.aliases].filter((a) => foldName(a) !== "");
  const ownFolded = new Set([id, ...own].map(foldName));
  const out: Identities = {};
  for (const [other, aliases] of Object.entries(lock)) {
    if (other === id) continue;
    out[other] = aliases.filter((a) => !ownFolded.has(foldName(a)));
  }
  const merged: string[] = [];
  for (const a of [...own, ...(lock[id] ?? [])]) if (!merged.some((m) => foldName(m) === foldName(a))) merged.push(a);
  out[id] = merged;
  return out;
}
