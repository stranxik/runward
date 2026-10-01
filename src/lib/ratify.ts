// The ratification core (ADR-0066, P3) — pure, so a test can reach every decision without a
// terminal (the ADR-0047 discipline: the command is a shell, the decisions live here).
//
// What ratification IS: the human gesture that turns a proposal into the operator's decision, made
// against DISPLAYED evidence — the dominant cost today is hunting the proof, so the proposal
// arrives with its pointer pre-resolved and the human answers bytes shown, not an assertion. What
// it records is DECLARED provenance (by/proposer, like `sealedAt` and an ADR's Deciders: runward
// holds no key, ADR-0021) in the deliverable's own `### Ratification` block — no side file, the
// ADR-0038 precedent: the deliverable is the state, the block is the history.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { GATED_DELIVERABLES, parseManifest, proposedStatus, ruleSignatures, rowDigest, unboundRatifications, accountableRelation, type UnboundCause } from "./conformance.js";
import type { Identities } from "./identity.js";
import { parseEvidencePointers, resolutionBases, resolveEvidencePath, symbolPresent, unsafeSignature } from "./evidence.js";

export interface Proposal {
  deliverable: string;
  label: string;
  rule: string;
  /** The underlying status the proposal proposes (applied | deviated | n/a). */
  status: string;
  /** The evidence cell WITHOUT the proposer segment. */
  evidence: string;
  /** The declared proposer segment, when the cell carried one. */
  proposer: string | null;
  /** ADR-0088 decision 4: the person accountable for the proposer, the cell's `; for:` segment
   *  (`propose --for`), when it carries one. */
  proposerFor?: string;
  /** True when the rule is signed and its signature matches nowhere in the cited evidence —
   *  the alarm shape: an en-bloc sample must always include these. */
  signatureAlarm: boolean;
  /** The rule's signature (regex source) when the rule is signed — what the excerpt anchors on and
   *  what the alarm names, so the reader sees the shape being looked for. */
  signature?: string;
  /** An `applied` row on a signed rule that cites no file (only `adr:` or prose): there is nothing
   *  to look the signature up in, which is not the same fact as "the file lacks it" — the gate
   *  refuses such a row on its own, so ratify says so without raising the alarm. */
  signatureUnchecked?: boolean;
  /** ADR-0080: set when the row is already DECIDED (by hand, or its ratification no longer binds
   *  to it) — ratifying it records a trace, it does not change the row. Absent for a proposal. */
  unbound?: UnboundCause;
}

/** Split an evidence cell into the evidence proper and the declared proposer segment the
 *  `propose` grammar appends (`… ; proposer: <text>`), and, after it, the person accountable for
 *  the proposer (`… ; proposer: <text> ; for: <person>`, ADR-0088 decision 4). Prose to the pointer
 *  grammar either way, and a reader that predates `; for:` keeps it inside the proposer's text. */
export function splitProposer(cell: string): { evidence: string; proposer: string | null; proposerFor?: string } {
  const idx = cell.indexOf("; proposer:");
  if (idx === -1) return { evidence: cell.trim(), proposer: null };
  const rest = cell.slice(idx + "; proposer:".length);
  const f = rest.indexOf("; for:");
  const proposerFor = f === -1 ? "" : rest.slice(f + "; for:".length).trim();
  // Present only when the cell carries one, so a cell written before `; for:` reads as it always did.
  return { evidence: cell.slice(0, idx).replace(/\s+$/, "").trim(), proposer: (f === -1 ? rest : rest.slice(0, f)).trim(), ...(proposerFor ? { proposerFor } : {}) };
}

/** Every pending proposal in the mission, in gated-deliverable order — the same order every other
 *  reader walks, so "the third proposal" means the same row to every invocation. */
export function listProposals(missionDir: string, _root?: string): Proposal[] {
  const signatures = ruleSignatures(missionDir);
  const out: Proposal[] = [];
  for (const g of GATED_DELIVERABLES) {
    const path = join(missionDir, g.deliverable);
    if (!existsSync(path)) continue;
    for (const row of parseManifest(readFileSync(path, "utf8"))) {
      const status = proposedStatus(row.status);
      if (!status) continue;
      const { evidence, proposer, proposerFor } = splitProposer(row.evidence || "");
      const sig = signatures[row.rule];
      const signatureAlarm = alarmFor(sig, status, evidence, missionDir, g.deliverable);
      out.push({ deliverable: g.deliverable, label: g.label, rule: row.rule, status, evidence, proposer, ...(proposerFor ? { proposerFor } : {}), signatureAlarm,
        ...signatureFacts(sig, status, evidence) });
    }
  }
  return out;
}

/** The alarm judges the CITED evidence, not the world: a signed row none of whose cited files
 *  carries the signature is the row the sample must never skip. Unresolvable counts as alarming —
 *  a pointer nobody can open is not reassurance. Only an `applied` row cites evidence the signature
 *  can be looked for in: an `n/a` reason or a `deviated` ADR has no file to match, and alarming on
 *  it raised the alarm on every such row (RWD-2026-0123).
 *
 *  The files are the ones the gate reads for the same rule (ADR-0020): every `file:` AND `test:`
 *  pointer, resolved against the same three bases, matched case-insensitively. Looking only at the
 *  first `file:` from the project root alarmed on a `test:` pointer whose file carries the
 *  signature, and on a row citing only `adr:` — a row with no file to look in is not a file that
 *  lacks the shape (RWD-2026-0126). */
function alarmFor(sig: string | undefined, status: string, evidence: string, missionDir: string, deliverable: string): boolean {
  if (!sig || status !== "applied") return false;
  const paths = parseEvidencePointers(evidence).filter((p) => p.kind !== "adr" && p.path).map((p) => p.path as string);
  if (paths.length === 0) return false; // nothing to look in: `signatureUnchecked`, never the alarm
  // The gate refuses a signature it will not run (catastrophic backtracking); ratify must not run it
  // either, and a signature nobody can safely check stays alarming.
  if (unsafeSignature(sig)) return true;
  let re: RegExp;
  try { re = new RegExp(sig, "i"); } catch { return true; /* an uncompilable signature stays alarming */ }
  const bases = resolutionBases(missionDir, deliverable);
  return !paths.some((p) => {
    const abs = resolveEvidencePath(p, bases);
    if (!abs || !existsSync(abs)) return false;
    try { return re.test(readFileSync(abs, "utf8")); } catch { return false; /* unreadable stays alarming */ }
  });
}

/** The signature facts a reader is shown beside the alarm, computed once for both listings. */
function signatureFacts(sig: string | undefined, status: string, evidence: string): { signature?: string; signatureUnchecked?: boolean } {
  if (!sig) return {};
  const cites = parseEvidencePointers(evidence).some((p) => p.kind !== "adr" && p.path);
  return status === "applied" && !cites ? { signature: sig, signatureUnchecked: true } : { signature: sig };
}

/** ADR-0080: the DECIDED rows whose ratification does not bind to their current content, in the
 *  same order as every other reader — what `ratify --decided` puts in front of the operator. */
export function listDecidedUnbound(missionDir: string, _root?: string): Proposal[] {
  const signatures = ruleSignatures(missionDir);
  const label = new Map(GATED_DELIVERABLES.map((g) => [g.deliverable, g.label]));
  const out: Proposal[] = [];
  for (const u of unboundRatifications(missionDir)) {
    const row = parseManifest(readFileSync(join(missionDir, u.deliverable), "utf8")).find((x) => x.rule === u.rule);
    if (!row) continue;
    const { evidence, proposer, proposerFor } = splitProposer(row.evidence || "");
    const sig = signatures[u.rule];
    out.push({ deliverable: u.deliverable, label: label.get(u.deliverable) ?? u.deliverable, rule: u.rule,
      status: row.status, evidence, proposer, ...(proposerFor ? { proposerFor } : {}), signatureAlarm: alarmFor(sig, row.status, evidence, missionDir, u.deliverable),
      ...signatureFacts(sig, row.status, evidence), unbound: u.cause });
  }
  return out;
}

/** ADR-0082: a name an agent path records. It lives inside a ` · `-separated line, so it may carry
 *  neither the separator nor a line break nor a table pipe; empty is refused by the command. */
export function unsafeDeclaredName(name: string): string | null {
  if (name.trim() === "") return "is empty";
  if (/[·|\r\n]/.test(name)) return "contains `·`, `|` or a line break, which the Ratification line cannot hold";
  return null;
}

/** ADR-0082 (and its amendment), ADR-0088 decision 4: an agent never ratifies a row it proposed,
 *  and never one whose proposer answers to the same person as the agent, except as `agent (single
 *  accountable)`. Accountable persons are compared by canonical id (`accountableRelation`), on
 *  DECLARED names: it stops the honest mistake, not the liar. `agent` = the agent is the proposer;
 *  `accountable` = one accountable person on both sides. */
export function proposerConflict(p: Pick<Proposal, "proposer" | "proposerFor">, agent: string, accountable: string, identities: Identities = {}): "agent" | "accountable" | null {
  if (!p.proposer && !p.proposerFor) return null;
  const r = accountableRelation({ agent, accountable, proposer: p.proposer, proposerFor: p.proposerFor }, identities);
  return r.relation === "agent-proposed" ? "agent" : r.relation === "same-accountable" ? "accountable" : null;
}

/** ADR-0082: the stable identifier an agent names a row by in `--accept`: `<deliverable>:<rule>`. */
export function rowId(p: Pick<Proposal, "deliverable" | "rule">): string {
  return `${p.deliverable}:${p.rule}`;
}

/** ADR-0082: resolve the rows an agent names against the rows CURRENTLY listed. All or nothing: one
 *  name that is not listed, or one row the agent or its accountable person proposed, refuses the
 *  whole call, and nothing is written. Accepts `runward/` before the deliverable, and lists
 *  separated by commas.
 *
 *  ADR-0088 decision 4: with `singleAccountable`, a row whose proposer answers to the agent's own
 *  accountable person is accepted as `agent (single accountable)` and returned in `single`; a row
 *  the agent itself proposed stays refused. */
export function resolveAgentAccept(
  listed: Proposal[], names: string[], agent: string, accountable: string,
  opts: { identities?: Identities; singleAccountable?: boolean } = {},
): { rows: Proposal[]; single: Proposal[]; unlisted: string[]; conflicts: Array<{ id: string; party: "agent" | "accountable"; proposer: string }> } {
  const byId = new Map(listed.map((p) => [rowId(p), p]));
  const wanted = [...new Set(names.flatMap((n) => n.split(",")).map((n) => n.trim().replace(/^runward\//, "")).filter(Boolean))];
  const rows: Proposal[] = [], single: Proposal[] = [], unlisted: string[] = [];
  const conflicts: Array<{ id: string; party: "agent" | "accountable"; proposer: string }> = [];
  for (const id of wanted) {
    const p = byId.get(id);
    if (!p) { unlisted.push(id); continue; }
    const party = proposerConflict(p, agent, accountable, opts.identities ?? {});
    if (party === "accountable" && opts.singleAccountable) { rows.push(p); single.push(p); }
    else if (party) conflicts.push({ id, party, proposer: [p.proposer, p.proposerFor ? `for ${p.proposerFor}` : ""].filter(Boolean).join(", ") });
    else rows.push(p);
  }
  return { rows, single, unlisted, conflicts };
}

export type Decision =
  | { rule: string; deliverable: string; decision: "accept" }
  | { rule: string; deliverable: string; decision: "reject" }
  | { rule: string; deliverable: string; decision: "edit"; status: string; evidence: string };

/**
 * Apply decisions and append ONE Ratification entry per deliverable that gained accepted rows.
 * Accept: the `proposed:` prefix falls and the proposer segment moves from the row into the block
 * — the table says the state, the block says the history. Reject: status and evidence are emptied,
 * a frank hole again. Rows not decided stay proposed, untouched.
 */
export function applyDecisions(
  missionDir: string,
  proposals: Proposal[],
  decisions: Decision[],
  meta: { by: string; date: string; mode: string;
    /** ADR-0082: set when an agent ratifies under its own name. The trace then says so twice: the
     *  ratifier is labelled `(declared, agent)`, the accountable person `for:`, the mode `agent`.
     *  ADR-0088 decision 4: `single` names the rules ratified as `agent (single accountable)`. */
    agent?: { for: string; single?: ReadonlySet<string> } },
  opts: { dryRun?: boolean } = {},
): { accepted: number; rejected: number; deliverables: string[] } {
  let accepted = 0, rejected = 0;
  const touched: string[] = [];
  const byDeliverable = new Map<string, Decision[]>();
  for (const d of decisions) {
    byDeliverable.set(d.deliverable, [...(byDeliverable.get(d.deliverable) ?? []), d]);
  }
  for (const [deliverable, ds] of byDeliverable) {
    const path = join(missionDir, deliverable);
    if (!existsSync(path)) continue;
    let content = readFileSync(path, "utf8");
    const acceptedRules: string[] = [];
    const proposers = new Set<string>();
    // ADR-0082: each accepted row's own proposer, so an agent entry can name the proposer of every
    // row it lists (the regulated tier compares it with the accountable person, row by row).
    const proposerOf = new Map<string, string | null>();
    // ADR-0088 decision 4: and the person accountable for that proposer, when the row records one.
    const proposerForOf = new Map<string, string | null>();
    // A cell is written back with its pipes escaped, or the table would grow a column.
    const cell = (x: string) => x.replace(/(?<!\\)\|/g, "\\|");
    for (const d of ds) {
      const p = proposals.find((x) => x.deliverable === deliverable && x.rule === d.rule);
      if (!p) continue;
      // A proposal's row carries `proposed:`; a decided row (ADR-0080) carries its status as is.
      // Spacing is the operator's: `|rule|applied|…|` is the same row as `| rule | applied | … |`.
      const rowRe = new RegExp(`^\\|\\s*${d.rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\|\\s*${p.unbound ? "" : "proposed:"}[^|]*\\|[^\\n]*$`, "m");
      if (!rowRe.test(content)) continue; // nothing written, nothing recorded as ratified
      // Replacements go through a FUNCTION: a string would read `$&`, `$$` in the evidence as
      // replacement patterns and corrupt the deliverable.
      if (d.decision === "accept") {
        // A decided row keeps its own bytes when it carries no proposer segment to move out.
        if (!(p.unbound && !p.proposer)) content = content.replace(rowRe, () => `| ${d.rule} | ${p.status} | ${cell(p.evidence)} |`);
        acceptedRules.push(d.rule);
        if (p.proposer) proposers.add(p.proposer);
        proposerOf.set(d.rule, p.proposer);
        proposerForOf.set(d.rule, p.proposerFor ?? null);
        accepted++;
      } else if (d.decision === "reject") {
        content = content.replace(rowRe, () => `| ${d.rule} |  |  |`);
        rejected++;
      } else {
        content = content.replace(rowRe, () => `| ${d.rule} | ${d.status} | ${cell(d.evidence)} |`);
        acceptedRules.push(d.rule);
        accepted++;
      }
    }
    // ADR-0080: each ratified row's digest, of the row AS THE GATE WILL READ IT BACK (backticks
    // stripped, `\|` unescaped by the manifest reader) — never of the value held in memory.
    const written = new Map(parseManifest(content).map((r) => [r.rule, r]));
    const bound = acceptedRules.flatMap((r) => { const w = written.get(r); return w ? [`${r}@${rowDigest(w)}`] : []; });
    if (acceptedRules.length > 0) {
      if (!/^### Ratification$/m.test(content)) content = content.replace(/\s*$/, "\n\n### Ratification\n");
      if (meta.agent) {
        // ADR-0082: one entry per distinct proposer, so the `proposer:` segment an entry carries is
        // the proposer of EVERY row it lists, never a guess across rows proposed by different parties.
        // ADR-0088: the group key also carries the proposer's accountable person and the
        // single-accountable mark, so every segment of an entry is true of every row it lists.
        const groups = new Map<string, { proposer: string; proposerFor: string; single: boolean; rules: string[] }>();
        for (const r of acceptedRules) {
          const g = { proposer: proposerOf.get(r) ?? "", proposerFor: proposerForOf.get(r) ?? "", single: meta.agent.single?.has(r) === true };
          const k = `${g.proposer}\u0000${g.proposerFor}\u0000${g.single}`;
          groups.set(k, { ...g, rules: [...(groups.get(k)?.rules ?? []), r] });
        }
        for (const { proposer, proposerFor, single, rules } of groups.values()) {
          const b = bound.filter((x) => rules.includes(x.slice(0, x.lastIndexOf("@"))));
          content = content.replace(/\s*$/, "\n") +
            `- ${meta.date} · rows: ${rules.join(", ")} · by: ${meta.by} (declared, agent)` +
            ` · for: ${meta.agent.for} (declared, accountable)` +
            (proposer ? ` · proposer: ${proposer} (declared)` : "") +
            (proposerFor ? ` · proposer-for: ${proposerFor} (declared, accountable)` : "") +
            (single ? " · independence: single accountable" : "") +
            ` · bound: ${b.join(", ")}` +
            ` · mode: agent\n`;
        }
      } else {
        const proposer = proposers.size === 1 ? [...proposers][0] : null;
        content = content.replace(/\s*$/, "\n") +
          `- ${meta.date} · rows: ${acceptedRules.join(", ")} · by: ${meta.by} (declared)` +
          (proposer ? ` · proposer: ${proposer} (declared)` : "") +
          ` · bound: ${bound.join(", ")}` +
          ` · mode: ${meta.mode}\n`;
      }
    }
    // The global `--dry-run` promises "without writing", and a ratification is the gesture that can
    // least afford to break that promise: a BLIND block is carried by every later check and the
    // attestation. Everything above runs, so the counts are the ones a real run would print; only
    // the write is withheld (RWD-2026-0127).
    if (content !== readFileSync(path, "utf8")) touched.push(deliverable);
    if (!opts.dryRun) writeFileSync(path, content);
  }
  return { accepted, rejected, deliverables: touched };
}

/**
 * The mandatory en-bloc sample, drawn deterministically from the mission-state digest: same tree,
 * same sample — there is no re-rolling until an easy one comes up. Composition: every
 * signature-alarm proposal (the alarm never gets sampled OUT), plus 20 % of the rest rounded up,
 * minimum 3 overall (or every proposal when fewer exist).
 */
export function sampleForBloc(proposals: Proposal[], digest: string): Proposal[] {
  const alarms = proposals.filter((p) => p.signatureAlarm);
  const rest = proposals.filter((p) => !p.signatureAlarm);
  const ranked = [...rest].sort((a, b) => {
    const ha = createHash("sha256").update(`${digest}${a.deliverable}${a.rule}`).digest("hex");
    const hb = createHash("sha256").update(`${digest}${b.deliverable}${b.rule}`).digest("hex");
    return ha < hb ? -1 : 1;
  });
  const wanted = Math.max(3 - alarms.length, Math.ceil(rest.length * 0.2));
  return [...alarms, ...ranked.slice(0, Math.max(0, Math.min(rest.length, wanted)))];
}

export type SampleAnswer = Decision | "skip";

/**
 * What an en-bloc run does with the answers given on its sample (ADR-0066 decision 5). The bloc is
 * justified by the sample and by nothing else: "a bloc with no witnessed row is `--attest-blind`
 * wearing a suit". A sampled row the operator SKIPPED is a row seen and not vouched for, so the
 * sample no longer vouches for the lot — the bloc is cancelled exactly as a reject cancels it, and
 * the unseen rows stay as they were. Before, `skip` fell through to the bloc and the skipped row was
 * ratified en bloc under the operator's name; under `--decided` there is no `[r]eject`, so the bloc
 * could never be cancelled at all (RWD-2026-0124). Only the rows accepted or edited on sight are
 * ratified when the bloc is cancelled; a skipped row is never written, never recorded.
 */
export function blocOutcome(
  proposals: Proposal[],
  sample: Proposal[],
  answers: SampleAnswer[],
): { decisions: Decision[]; cancelledBy: "reject" | "skip" | null; skipped: number; onSight: number; enBloc: number; unseen: number; mode: string } {
  const decisions = answers.filter((a): a is Decision => a !== "skip");
  const skipped = answers.length - decisions.length;
  const rejected = decisions.some((d) => d.decision === "reject");
  const unseen = proposals.length - sample.length;
  const cancelledBy = rejected ? "reject" : skipped > 0 ? "skip" : null;
  if (cancelledBy) {
    return { decisions, cancelledBy, skipped, onSight: decisions.length, enBloc: 0, unseen,
      mode: `line-by-line (bloc cancelled by a sampled ${cancelledBy})` };
  }
  const sampled = new Set(decisions.map((d) => `${d.deliverable}|${d.rule}`));
  const blocRest: Decision[] = proposals
    .filter((p) => !sampled.has(`${p.deliverable}|${p.rule}`))
    .map((p) => ({ rule: p.rule, deliverable: p.deliverable, decision: "accept" as const }));
  return { decisions: [...decisions, ...blocRest], cancelledBy: null, skipped: 0, onSight: decisions.length, enBloc: blocRest.length, unseen,
    mode: `en bloc (sample ${sample.length}/${proposals.length}, sampled rows accepted ${decisions.length}/${sample.length})` };
}

/**
 * Where the displayed excerpt of a cited file is centred, and why (ADR-0066 decision 4: the
 * ratifier answers DISPLAYED evidence, so what is displayed must be the passage the row cites). In
 * order: the pointer's `:LINE`; the first line carrying its `#SYMBOL` (the gate's own identifier
 * boundary, `symbolPresent`); the first line matching the rule's signature; otherwise the top of the
 * file, SAID to be the top. The excerpt used to ignore `#SYMBOL` and the signature and always showed
 * lines 1-2 — the file's header, not the evidence (RWD-2026-0125).
 */
export function excerptAnchor(content: string, pointer: { line?: number; symbol?: string }, signature?: string): { line: number; note: string | null } {
  const lines = content.split("\n");
  if (pointer.line && pointer.line >= 1) return { line: Math.min(pointer.line, lines.length), note: null };
  if (pointer.symbol) {
    const i = lines.findIndex((l) => symbolPresent(l, pointer.symbol as string));
    if (i >= 0) return { line: i + 1, note: null };
    return { line: 1, note: `#${pointer.symbol} not found in the file: showing the top of the file` };
  }
  if (signature && !unsafeSignature(signature)) {
    let re: RegExp | null = null;
    try { re = new RegExp(signature, "i"); } catch { re = null; }
    const i = re ? lines.findIndex((l) => (re as RegExp).test(l)) : -1;
    if (i >= 0) return { line: i + 1, note: `first line matching the rule's signature /${signature}/` };
  }
  return { line: 1, note: "no line or symbol cited: showing the top of the file" };
}
