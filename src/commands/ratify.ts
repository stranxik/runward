// `runward ratify` — the decision becomes yours (ADR-0066, P3). The shell only: TTY, display,
// prompts. Every decision the command takes lives in src/lib/ratify.ts where a test reaches it.
//
// A ratification is an answer to DISPLAYED evidence, never a flag: the command refuses a
// non-interactive terminal. The one escape is explicit and self-marking — `--attest-blind`
// ratifies without display and RECORDS the mode as BLIND; every later check discloses it and the
// attestation carries it (the ADR-0060 posture: legitimate in real cases, never silent).
//
// `by:` defaults to the OS user name, always labelled `(declared)`. The design sketch said
// `git config user.name`; that would put a child-process call in a fourth command and the
// ADR-0054 boundary test pins the current three (characterize, hooks, doctor) — an identity that
// is DECLARED either way does not justify widening that surface. `--by` overrides.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { userInfo } from "node:os";
import { createInterface } from "node:readline/promises";
import { findMissionRoot } from "../lib/mission.js";
import { missionStateDigest } from "../lib/attestation.js";
import { listProposals, listDecidedUnbound, applyDecisions, sampleForBloc, blocOutcome, excerptAnchor, type Decision, type Proposal, type SampleAnswer } from "../lib/ratify.js";
import { parseEvidencePointers, resolutionBases, resolveEvidencePath } from "../lib/evidence.js";
import { UNBOUND_CAUSE_TEXT } from "../lib/conformance.js";
import { c, createHeader, section, status, generationDate } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

function excerpt(mission: string, p: Proposal): string[] {
  // The first cited file — `file:` or `test:`, resolved on the gate's own three bases — and the
  // passage the row actually cites (RWD-2026-0125: `excerptAnchor` decides where, and says why).
  const ptr = parseEvidencePointers(p.evidence).find((x) => x.kind !== "adr" && x.path);
  if (!ptr?.path) return [];
  const abs = resolveEvidencePath(ptr.path, resolutionBases(mission, p.deliverable));
  if (!abs || !existsSync(abs)) return [`  ${c.error("✗")} ${c.darkGray(`${ptr.path} does not resolve`)}`];
  let text: string;
  try { text = readFileSync(abs, "utf8"); } catch { return [`  ${c.error("✗")} ${c.darkGray(`${ptr.path} cannot be read`)}`]; }
  const lines = text.split("\n");
  const { line: at, note } = excerptAnchor(text, { line: ptr.line, symbol: ptr.symbol }, p.signature);
  const from = Math.max(1, at - 1), to = Math.min(lines.length, at + 1);
  const out: string[] = note ? [`  ${c.darkGray(`(${note})`)}`] : [];
  for (let i = from; i <= to; i++) out.push(`  ${c.darkGray("│")} ${c.darkGray(String(i).padStart(4))}  ${lines[i - 1] ?? ""}`);
  return out;
}

function show(mission: string, p: Proposal, index: number, total: number): void {
  console.log(`\n[${index}/${total}] ${c.white(p.rule)} — ${p.unbound ? `${p.status} ${c.darkGray(`(${UNBOUND_CAUSE_TEXT[p.unbound]})`)}` : `proposed:${p.status}`}`);
  // What the alarm IS, in words a reader can act on — "the alarm shape" was the design's own name.
  const sig = p.signatureAlarm
    ? ` ${c.error(`· the cited file does not contain this rule's signature (/${p.signature}/): check it before accepting`)}`
    : p.signatureUnchecked ? ` ${c.warning(`· signed rule, but no file: or test: pointer to check the signature (/${p.signature}/) against — the gate refuses it as is`)}` : "";
  console.log(`  evidence  ${c.primary(p.evidence || "(none)")}${sig}`);
  for (const l of excerpt(mission, p)) console.log(l);
  if (p.proposer) console.log(`  proposer  ${c.darkGray(`${p.proposer} (declared)`)}`);
}

export async function ratifyCommand(opts: { path?: string; all?: boolean; by?: string; attestBlind?: boolean; decided?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  // The ratifier's name is the one thing the block records about WHO; an empty one wrote
  // `by:  (declared)`, a trace naming nobody (RWD-2026-0128). Refused before anything is shown.
  if (opts.by !== undefined && opts.by.trim() === "") {
    console.error(status.error("--by needs a name (it is recorded as the declared ratifier); nothing written."));
    process.exit(2);
  }
  const by = opts.by?.trim() ?? userInfo().username;
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  const where = (ds: string[]) => ds.map((d) => `runward/${d}`).join(", ") || "no deliverable";
  const date = generationDate();
  // ADR-0080: `--decided` puts the rows already decided in front of the operator — the ones whose
  // ratification does not bind to their current content. Same gesture, same record.
  const proposals = opts.decided ? listDecidedUnbound(mission, root) : listProposals(mission, root);

  console.log(createHeader(`Runward v${VERSION} — ratify (the decision becomes yours)`, root));
  if (proposals.length === 0) {
    console.log("  " + status.success(opts.decided
      ? "every decided row carries a ratification bound to its current content — nothing to ratify."
      : "no pending proposal — nothing awaits ratification."));
    console.log();
    return;
  }

  if (opts.attestBlind) {
    const decisions: Decision[] = proposals.map((p) => ({ rule: p.rule, deliverable: p.deliverable, decision: "accept" }));
    const r = applyDecisions(mission, proposals, decisions, { by, date, mode: "BLIND" }, { dryRun });
    if (dryRun) {
      console.log(`  ${c.darkGray(`dry-run — would ratify ${r.accepted} row(s) BLIND in ${where(r.deliverables)}; nothing written.`)}`);
      console.log();
      return;
    }
    console.log(`  ${c.warning("◑")} ${c.white(`${r.accepted} row(s) ratified BLIND`)} ${c.darkGray("— without displayed evidence, recorded as such: every later check and the attestation will carry the mode.")}`);
    if (opts.decided) console.log(`  ${c.darkGray("Under the regulated tier (ADR-0080) a BLIND ratification does not bind: these rows still count against the verdict.")}`);
    console.log();
    return;
  }

  if (!process.stdin.isTTY) {
    console.error(status.error(
      "refusing to ratify without a terminal — a ratification is an answer to displayed evidence, not a flag. " +
      "If you must (migrating a historical mission), `--attest-blind` ratifies anyway and RECORDS the mode as blind; " +
      "every later check and the attestation will carry it."));
    process.exit(2);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (p: Proposal, i: number, total: number): Promise<Decision | "skip" | "quit"> => {
    show(mission, p, i, total);
    for (;;) {
      // ADR-0080: a decided row is the operator's own decision. Declining to ratify it is a skip,
      // never a reject — emptying it would destroy the decision and leave no trace in the block.
      const menu = p.unbound ? "[a]ccept  [e]dit  [s]kip (leave it decided, unratified)  [q]uit" : "[a]ccept  [e]dit  [r]eject (empty the row)  [s]kip  [q]uit";
      const a = (await rl.question(`  ${c.primary(menu)} > `)).trim().toLowerCase();
      if (a === "a") return { rule: p.rule, deliverable: p.deliverable, decision: "accept" };
      if (a === "r" && !p.unbound) return { rule: p.rule, deliverable: p.deliverable, decision: "reject" };
      if (a === "s") return "skip";
      if (a === "q") return "quit";
      if (a === "e") {
        const st = (await rl.question("  status (applied | deviated | n/a) > ")).trim();
        const ev = (await rl.question("  evidence > ")).trim();
        if (["applied", "deviated", "n/a"].includes(st)) return { rule: p.rule, deliverable: p.deliverable, decision: "edit", status: st, evidence: ev };
        console.log("  " + c.darkGray("not a status — applied | deviated | n/a"));
      }
    }
  };

  try {
    if (opts.all) {
      const digest = missionStateDigest(root, mission);
      const sample = sampleForBloc(proposals, digest);
      const alarms = sample.filter((s) => s.signatureAlarm).length;
      console.log(`\nEn-bloc ratification covers ${c.white(String(proposals.length))} row(s). A sample is mandatory — ${c.white(String(sample.length))} row(s), drawn deterministically`);
      console.log(`from the mission digest (re-running draws the same ${sample.length}):`);
      if (alarms) console.log(`  ${c.darkGray(`· ${alarms} applied row(s) whose cited file does not contain the rule's signature (always sampled)`)}`);
      console.log(`  ${c.darkGray(`· ${sample.length - alarms} of the remaining ${proposals.length - alarms}`)}`);
      const answers: SampleAnswer[] = [];
      for (let i = 0; i < sample.length; i++) {
        const d = await ask(sample[i], i + 1, sample.length);
        if (d === "quit") { console.log("  " + c.darkGray("stopped — nothing applied.")); return; }
        answers.push(d);
      }
      const o = blocOutcome(proposals, sample, answers);
      const r = applyDecisions(mission, proposals, o.decisions, { by, date, mode: o.mode }, { dryRun });
      if (dryRun) {
        console.log(`\n  ${c.darkGray(`dry-run — would ratify ${r.accepted} row(s) (${o.onSight} on sight, ${o.enBloc} en bloc) and reject ${r.rejected} in ${where(r.deliverables)}; nothing written.`)}`);
      } else if (o.cancelledBy === "reject") {
        console.log(`\n  ${c.warning("!")} a sampled row was rejected — the bloc is cancelled for the ${o.unseen} unseen row(s); they stay ${opts.decided ? "decided, unratified" : "proposed"}. ${r.accepted} sampled row(s) ratified, ${r.rejected} rejected.`);
      } else if (o.cancelledBy === "skip") {
        console.log(`\n  ${c.warning("!")} ${o.skipped} sampled row(s) skipped: the bloc is not applied to the ${o.unseen} unseen row(s); they stay ${opts.decided ? "decided, unratified" : "proposed"}. ${r.accepted} row(s) ratified on sight.`);
      } else {
        console.log(`\n${status.success(`${r.accepted} row(s) ratified — ${o.onSight} on sight, ${o.enBloc} en bloc. Recorded in each deliverable's Ratification block.`)}`);
        console.log("  " + c.darkGray(opts.decided
          ? "Skipping a sampled row keeps the whole bloc unratified."
          : "A rejected or skipped sampled row would have cancelled the bloc for the unseen rows."));
      }
    } else {
      const decisions: Decision[] = [];
      for (let i = 0; i < proposals.length; i++) {
        const d = await ask(proposals[i], i + 1, proposals.length);
        if (d === "quit") break;
        if (d === "skip") continue;
        decisions.push(d);
      }
      const r = applyDecisions(mission, proposals, decisions, { by, date, mode: "line-by-line" }, { dryRun });
      if (dryRun) console.log(`\n  ${c.darkGray(`dry-run — would ratify ${r.accepted} row(s) and reject ${r.rejected} in ${where(r.deliverables)}; nothing written.`)}`);
      else console.log(`\n${status.success(`${r.accepted} row(s) ratified, ${r.rejected} rejected — recorded in each deliverable's Ratification block.`)}`);
    }
  } finally { rl.close(); }
  console.log(section("Next"));
  console.log(`  ${c.primary("runward check --strict")} ${c.darkGray("— the gate re-judges the rows that are now yours.")}`);
  console.log();
}
