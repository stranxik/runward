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
import { listProposals, applyDecisions, sampleForBloc, type Decision, type Proposal } from "../lib/ratify.js";
import { c, createHeader, section, status, generationDate } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

function excerpt(root: string, evidence: string): string[] {
  const m = evidence.match(/file:([^\s;#:]+)(?::(\d+))?/);
  if (!m) return [];
  const abs = join(root, m[1]);
  if (!existsSync(abs)) return [`  ${c.error("✗")} ${c.darkGray(`${m[1]} does not resolve`)}`];
  const lines = readFileSync(abs, "utf8").split("\n");
  const at = m[2] ? Number(m[2]) : 1;
  const from = Math.max(1, at - 1), to = Math.min(lines.length, at + 1);
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(`  ${c.darkGray("│")} ${c.darkGray(String(i).padStart(4))}  ${lines[i - 1] ?? ""}`);
  return out;
}

function show(root: string, p: Proposal, index: number, total: number): void {
  console.log(`\n[${index}/${total}] ${c.white(p.rule)} — proposed:${p.status}`);
  console.log(`  evidence  ${c.primary(p.evidence || "(none)")}${p.signatureAlarm ? ` ${c.error("· signature does NOT match — the alarm shape")}` : ""}`);
  for (const l of excerpt(root, p.evidence)) console.log(l);
  if (p.proposer) console.log(`  proposer  ${c.darkGray(`${p.proposer} (declared)`)}`);
}

export async function ratifyCommand(opts: { path?: string; all?: boolean; by?: string; attestBlind?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const by = opts.by ?? userInfo().username;
  const date = generationDate();
  const proposals = listProposals(mission, root);

  console.log(createHeader(`Runward v${VERSION} — ratify (the decision becomes yours)`, root));
  if (proposals.length === 0) {
    console.log("  " + status.success("no pending proposal — nothing awaits ratification."));
    console.log();
    return;
  }

  if (opts.attestBlind) {
    const decisions: Decision[] = proposals.map((p) => ({ rule: p.rule, deliverable: p.deliverable, decision: "accept" }));
    const r = applyDecisions(mission, proposals, decisions, { by, date, mode: "BLIND" });
    console.log(`  ${c.warning("◑")} ${c.white(`${r.accepted} row(s) ratified BLIND`)} ${c.darkGray("— without displayed evidence, recorded as such: every later check and the attestation will carry the mode.")}`);
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
    show(root, p, i, total);
    for (;;) {
      const a = (await rl.question(`  ${c.primary("[a]ccept  [e]dit  [r]eject (empty the row)  [s]kip  [q]uit")} > `)).trim().toLowerCase();
      if (a === "a") return { rule: p.rule, deliverable: p.deliverable, decision: "accept" };
      if (a === "r") return { rule: p.rule, deliverable: p.deliverable, decision: "reject" };
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
      if (alarms) console.log(`  ${c.darkGray(`· ${alarms} signed row(s) whose signature does NOT match (always sampled)`)}`);
      console.log(`  ${c.darkGray(`· ${sample.length - alarms} of the remaining ${proposals.length - alarms}`)}`);
      const decisions: Decision[] = [];
      let rejected = false;
      for (let i = 0; i < sample.length; i++) {
        const d = await ask(sample[i], i + 1, sample.length);
        if (d === "quit") { console.log("  " + c.darkGray("stopped — nothing applied.")); return; }
        if (d === "skip") continue;
        decisions.push(d);
        if (d.decision === "reject") rejected = true;
      }
      if (rejected) {
        const r = applyDecisions(mission, proposals, decisions, { by, date, mode: `line-by-line (bloc cancelled by a sampled reject)` });
        console.log(`\n  ${c.warning("!")} a sampled row was rejected — the bloc is cancelled for the ${proposals.length - sample.length} unseen row(s); they stay proposed. ${r.accepted} sampled row(s) ratified, ${r.rejected} rejected.`);
      } else {
        const sampled = new Set(decisions.map((d) => `${d.deliverable}|${d.rule}`));
        const blocRest: Decision[] = proposals
          .filter((p) => !sampled.has(`${p.deliverable}|${p.rule}`))
          .map((p) => ({ rule: p.rule, deliverable: p.deliverable, decision: "accept" as const }));
        const r = applyDecisions(mission, proposals, [...decisions, ...blocRest],
          { by, date, mode: `en bloc (sample ${sample.length}/${proposals.length}, sampled rows accepted ${decisions.filter((d) => d.decision !== "reject").length}/${sample.length})` });
        console.log(`\n${status.success(`${r.accepted} row(s) ratified — ${decisions.length} on sight, ${blocRest.length} en bloc. Recorded in each deliverable's Ratification block.`)}`);
        console.log("  " + c.darkGray("A rejected sampled row would have cancelled the bloc for the unseen rows."));
      }
    } else {
      const decisions: Decision[] = [];
      for (let i = 0; i < proposals.length; i++) {
        const d = await ask(proposals[i], i + 1, proposals.length);
        if (d === "quit") break;
        if (d === "skip") continue;
        decisions.push(d);
      }
      const r = applyDecisions(mission, proposals, decisions, { by, date, mode: "line-by-line" });
      console.log(`\n${status.success(`${r.accepted} row(s) ratified, ${r.rejected} rejected — recorded in each deliverable's Ratification block.`)}`);
    }
  } finally { rl.close(); }
  console.log(section("Next"));
  console.log(`  ${c.primary("runward check --strict")} ${c.darkGray("— the gate re-judges the rows that are now yours.")}`);
  console.log();
}
