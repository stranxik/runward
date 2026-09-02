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
import { GATED_DELIVERABLES, parseManifest, proposedStatus, ruleSignatures } from "./conformance.js";

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
  /** True when the rule is signed and its signature matches nowhere in the cited evidence —
   *  the alarm shape: an en-bloc sample must always include these. */
  signatureAlarm: boolean;
}

/** Split an evidence cell into the evidence proper and the declared proposer segment the
 *  `propose` grammar appends (`… ; proposer: <text>`). Prose to the pointer grammar either way. */
export function splitProposer(cell: string): { evidence: string; proposer: string | null } {
  const idx = cell.indexOf("; proposer:");
  if (idx === -1) return { evidence: cell.trim(), proposer: null };
  return { evidence: cell.slice(0, idx).replace(/\s+$/, "").trim(), proposer: cell.slice(idx + "; proposer:".length).trim() };
}

/** Every pending proposal in the mission, in gated-deliverable order — the same order every other
 *  reader walks, so "the third proposal" means the same row to every invocation. */
export function listProposals(missionDir: string, root: string): Proposal[] {
  const signatures = ruleSignatures(missionDir);
  const out: Proposal[] = [];
  for (const g of GATED_DELIVERABLES) {
    const path = join(missionDir, g.deliverable);
    if (!existsSync(path)) continue;
    for (const row of parseManifest(readFileSync(path, "utf8"))) {
      const status = proposedStatus(row.status);
      if (!status) continue;
      const { evidence, proposer } = splitProposer(row.evidence || "");
      let signatureAlarm = false;
      const sig = signatures[row.rule];
      if (sig) {
        // The alarm judges the CITED evidence, not the world: a signed proposal whose first file
        // pointer does not carry the signature is the row the sample must never skip. Unresolvable
        // counts as alarming — a pointer nobody can open is not reassurance.
        const m = evidence.match(/file:([^\s;:#]+)/);
        signatureAlarm = true;
        if (m) {
          try {
            const target = join(root, m[1]);
            if (existsSync(target) && new RegExp(sig).test(readFileSync(target, "utf8"))) signatureAlarm = false;
          } catch { /* unreadable stays alarming */ }
        }
      }
      out.push({ deliverable: g.deliverable, label: g.label, rule: row.rule, status, evidence, proposer, signatureAlarm });
    }
  }
  return out;
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
  meta: { by: string; date: string; mode: string },
): { accepted: number; rejected: number } {
  let accepted = 0, rejected = 0;
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
    for (const d of ds) {
      const p = proposals.find((x) => x.deliverable === deliverable && x.rule === d.rule);
      if (!p) continue;
      const rowRe = new RegExp(`^\\|\\s*${d.rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\| proposed:[^|]*\\|[^\\n]*$`, "m");
      if (d.decision === "accept") {
        content = content.replace(rowRe, `| ${d.rule} | ${p.status} | ${p.evidence} |`);
        acceptedRules.push(d.rule);
        if (p.proposer) proposers.add(p.proposer);
        accepted++;
      } else if (d.decision === "reject") {
        content = content.replace(rowRe, `| ${d.rule} |  |  |`);
        rejected++;
      } else {
        content = content.replace(rowRe, `| ${d.rule} | ${d.status} | ${d.evidence} |`);
        acceptedRules.push(d.rule);
        accepted++;
      }
    }
    if (acceptedRules.length > 0) {
      if (!/^### Ratification$/m.test(content)) content = content.replace(/\s*$/, "\n\n### Ratification\n");
      const proposer = proposers.size === 1 ? [...proposers][0] : null;
      content = content.replace(/\s*$/, "\n") +
        `- ${meta.date} · rows: ${acceptedRules.join(", ")} · by: ${meta.by} (declared)` +
        (proposer ? ` · proposer: ${proposer} (declared)` : "") +
        ` · mode: ${meta.mode}\n`;
    }
    writeFileSync(path, content);
  }
  return { accepted, rejected };
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
