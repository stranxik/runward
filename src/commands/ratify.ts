// `runward ratify` — the decision becomes yours (ADR-0066, P3). The shell only: TTY, display,
// prompts. Every decision the command takes lives in src/lib/ratify.ts where a test reaches it.
//
// A ratification is an answer to DISPLAYED evidence, never a flag: the command refuses a
// non-interactive terminal. The one escape is explicit and self-marking — `--attest-blind`
// ratifies without display and RECORDS the mode as BLIND; every later check discloses it and the
// attestation carries it (the ADR-0060 posture: legitimate in real cases, never silent).
//
// ADR-0082: an agent ratifies as itself, never under a person's name. `--agent <name> --for <person>`
// takes a path of its own with no terminal and no prompt: `--list` shows what a person would be
// shown and writes nothing, `--accept <deliverable>:<rule>` ratifies only the rows it names.
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
import { listProposals, listDecidedUnbound, applyDecisions, sampleForBloc, blocOutcome, excerptAnchor, proposerConflict, resolveAgentAccept, rowId, unsafeDeclaredName, type Decision, type Proposal, type SampleAnswer } from "../lib/ratify.js";
import { parseEvidencePointers, resolutionBases, resolveEvidencePath } from "../lib/evidence.js";
import { UNBOUND_CAUSE_TEXT } from "../lib/conformance.js";
import { regulatedOptIn, agentRatificationOptIn } from "../lib/mission.js";
import { c, createHeader, section, status, generationDate } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";
import { emitJson, errorPayload, noMissionPayload } from "../lib/machine-output.js";

/** The excerpt as data: what the terminal prints and what `--list --json` carries are the same
 *  bytes, so an agent is shown exactly what a person would be (ADR-0082). */
interface Excerpt { path: string; problem?: string; note?: string | null; lines?: Array<{ n: number; text: string }> }

function excerptData(mission: string, p: Proposal): Excerpt | null {
  // The first cited file — `file:` or `test:`, resolved on the gate's own three bases — and the
  // passage the row actually cites (RWD-2026-0125: `excerptAnchor` decides where, and says why).
  const ptr = parseEvidencePointers(p.evidence).find((x) => x.kind !== "adr" && x.path);
  if (!ptr?.path) return null;
  const abs = resolveEvidencePath(ptr.path, resolutionBases(mission, p.deliverable));
  if (!abs || !existsSync(abs)) return { path: ptr.path, problem: "does not resolve" };
  let text: string;
  try { text = readFileSync(abs, "utf8"); } catch { return { path: ptr.path, problem: "cannot be read" }; }
  const lines = text.split("\n");
  const { line: at, note } = excerptAnchor(text, { line: ptr.line, symbol: ptr.symbol }, p.signature);
  const from = Math.max(1, at - 1), to = Math.min(lines.length, at + 1);
  const out: Array<{ n: number; text: string }> = [];
  for (let i = from; i <= to; i++) out.push({ n: i, text: lines[i - 1] ?? "" });
  return { path: ptr.path, note, lines: out };
}

function excerpt(mission: string, p: Proposal): string[] {
  const e = excerptData(mission, p);
  if (!e) return [];
  if (e.problem) return [`  ${c.error("✗")} ${c.darkGray(`${e.path} ${e.problem}`)}`];
  const out: string[] = e.note ? [`  ${c.darkGray(`(${e.note})`)}`] : [];
  for (const l of e.lines ?? []) out.push(`  ${c.darkGray("│")} ${c.darkGray(String(l.n).padStart(4))}  ${l.text}`);
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
  // "(signature matched) (declared)" stacked two parentheses (RWD-2026-0161).
  if (p.proposer) console.log(`  proposer  ${c.darkGray(`${p.proposer} · declared in the row, not verified`)}`);
}

export interface RatifyOptions {
  path?: string; all?: boolean; by?: string; attestBlind?: boolean; decided?: boolean;
  /** ADR-0082: the agent path. */
  agent?: string; for?: string; list?: boolean; accept?: string[]; json?: boolean;
}

export async function ratifyCommand(opts: RatifyOptions): Promise<void> {
  // ADR-0083: `--json` is the form of `--list`; there, each exit 2 is also a document naming its class.
  const machine = !!opts.json && !!opts.list;
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    if (machine) emitJson(noMissionPayload(VERSION));
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const usage = (m: string): never => {
    if (machine) emitJson(errorPayload(VERSION, "usage", m));
    console.error(status.error(m));
    process.exit(2);
  };
  // The ratifier's name is the one thing the block records about WHO; an empty one wrote
  // `by:  (declared)`, a trace naming nobody (RWD-2026-0128). Refused before anything is shown.
  if (opts.by !== undefined && opts.by.trim() === "") {
    usage("--by needs a name (it is recorded as the declared ratifier); nothing written.");
  }
  // ADR-0082: the agent path is its own, explicit and non-interactive. It is checked before
  // anything is shown, so a malformed call never reaches the human path's prompts or refusals.
  const agentPath = opts.agent !== undefined || opts.for !== undefined;
  if (agentPath) agentPreflight(opts);
  else if (opts.accept !== undefined) {
    usage("--accept is the agent path: it needs --agent <name> --for <person>. A person ratifies at the terminal, against displayed evidence; nothing written.");
  }
  const by = opts.by?.trim() ?? userInfo().username;
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  const where = (ds: string[]) => ds.map((d) => `runward/${d}`).join(", ") || "no deliverable";
  const date = generationDate();
  // ADR-0080: `--decided` puts the rows already decided in front of the operator — the ones whose
  // ratification does not bind to their current content. Same gesture, same record.
  const proposals = opts.decided ? listDecidedUnbound(mission, root) : listProposals(mission, root);

  // `--list` writes nothing and asks nothing: it shows every pending row with its resolved
  // evidence, exactly what a person would be shown, and `--json` carries the same data.
  if (opts.list) return listRows(mission, root, proposals, opts);
  if (agentPath) return agentAccept(mission, root, proposals, opts, { date, dryRun, where });

  console.log(createHeader(`Runward v${VERSION} — ratify (the decision becomes yours)`, root));
  if (proposals.length === 0) {
    console.log("  " + status.success(opts.decided
      ? "every decided row carries a ratification made on its current content — nothing to ratify."
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
    if (opts.decided) console.log(`  ${c.darkGray("Under the regulated tier a BLIND ratification does not count: these rows still count against the verdict (runward ADR-0080).")}`);
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

/** ADR-0082: the agent path's own refusals, all exit 2, all before anything is read or written. */
function agentPreflight(opts: RatifyOptions): void {
  const refuse = (m: string): never => {
    if (opts.json && opts.list) emitJson(errorPayload(VERSION, "refused", `${m}; nothing written.`)); // ADR-0083
    console.error(status.error(`${m}; nothing written.`)); process.exit(2);
  };
  if (opts.agent === undefined || opts.for === undefined) {
    refuse("--agent and --for go together: an agent ratifies under its own name, for the person accountable for it (runward ADR-0082, amended 2026-09-28)");
  }
  const a = unsafeDeclaredName(opts.agent as string), f = unsafeDeclaredName(opts.for as string);
  if (a) refuse(`--agent ${a}: it is recorded as the declared agent`);
  if (f) refuse(`--for ${f}: it is recorded as the declared accountable person`);
  if (opts.by !== undefined) refuse("--by names a person; an agent ratifies under --agent, never under a person's name");
  if (opts.attestBlind) refuse("--attest-blind is a person's recorded escape; an agent is shown the evidence with --list and names each row it accepts");
  if (opts.all) refuse("--all ratifies rows nobody named; an agent names every row it accepts with --accept <deliverable>:<rule>");
  if (!opts.list && (opts.accept === undefined || opts.accept.length === 0)) {
    refuse("an agent does not answer prompts: run `ratify --agent <name> --for <person> --list` to see each pending row and its evidence, then `--accept <deliverable>:<rule>` for each row you accept");
  }
  if (opts.list && opts.accept !== undefined) refuse("--list writes nothing; run it first, then --accept the rows you name");
}

function listRows(mission: string, root: string, proposals: Proposal[], opts: RatifyOptions): void {
  const agent = opts.agent?.trim(), person = opts.for?.trim();
  const rows = proposals.map((p) => {
    const conflict = agent && person ? proposerConflict(p, agent, person) : null;
    return { id: rowId(p), deliverable: p.deliverable, rule: p.rule,
      status: p.unbound ? p.status : `proposed:${p.status}`, evidence: p.evidence, proposer: p.proposer,
      ...(p.unbound ? { unbound: p.unbound, unboundText: UNBOUND_CAUSE_TEXT[p.unbound] } : {}),
      signature: p.signature ?? null, signatureAlarm: p.signatureAlarm, signatureUnchecked: p.signatureUnchecked === true,
      excerpt: excerptData(mission, p),
      ...(conflict ? { refused: `${conflict === "agent" ? "the agent" : "its accountable person"} is this row's declared proposer (declared names compared, not proof)` } : {}) };
  });
  if (opts.json) {
    console.log(JSON.stringify({ runward: VERSION, mission: root, decided: opts.decided === true, rows }, null, 2));
    return;
  }
  console.log(createHeader(`Runward v${VERSION} — ratify --list (nothing is written)`, root));
  if (rows.length === 0) {
    console.log("  " + status.success(opts.decided
      ? "every decided row carries a ratification made on its current content — nothing to ratify."
      : "no pending proposal — nothing awaits ratification."));
    console.log();
    return;
  }
  proposals.forEach((p, i) => {
    show(mission, p, i + 1, proposals.length);
    console.log(`  id        ${c.white(rowId(p))}`);
    if (rows[i].refused) console.log(`  ${c.error("✗")} ${c.darkGray(`not ratifiable by ${agent}: ${rows[i].refused}`)}`);
  });
  console.log(section("Next"));
  const flags = `${opts.decided ? " --decided" : ""}`;
  console.log(`  ${c.primary(`runward ratify${flags} --agent <name> --for <person> --accept <id>`)} ${c.darkGray("— once per row you accept (repeatable, or comma-separated); a row not named stays as it is.")}`);
  console.log();
}

function agentAccept(mission: string, root: string, proposals: Proposal[], opts: RatifyOptions,
  ctx: { date: string; dryRun: boolean; where: (ds: string[]) => string }): void {
  const agent = (opts.agent as string).trim(), person = (opts.for as string).trim();
  const r = resolveAgentAccept(proposals, opts.accept ?? [], agent, person);
  if (r.unlisted.length > 0 || r.conflicts.length > 0) {
    for (const u of r.unlisted) console.error(status.error(`${u} is not a row \`ratify${opts.decided ? " --decided" : ""} --list\` lists now (format <deliverable>:<rule>, e.g. floor.md:config-secrets-boundary)`));
    for (const x of r.conflicts) console.error(status.error(`${x.id}: ${x.party === "agent" ? `the agent "${agent}"` : `the accountable person "${person}"`} is its declared proposer ("${x.proposer}"). An agent never ratifies a row it or its accountable person proposed; this compares declared names, it is not proof of anyone's identity`));
    console.error(status.error("nothing written: every row named must be listed and ratifiable"));
    process.exit(2);
  }
  if (r.rows.length === 0) {
    console.error(status.error("no row named: pass --accept <deliverable>:<rule>; nothing written"));
    process.exit(2);
  }
  const decisions: Decision[] = r.rows.map((p) => ({ rule: p.rule, deliverable: p.deliverable, decision: "accept" }));
  const res = applyDecisions(mission, proposals, decisions, { by: agent, date: ctx.date, mode: "agent", agent: { for: person } }, { dryRun: ctx.dryRun });
  console.log(createHeader(`Runward v${VERSION} — ratify (agent: ${agent}, for ${person})`, root));
  if (ctx.dryRun) {
    console.log(`  ${c.darkGray(`dry-run — would ratify ${res.accepted} row(s) as agent ${agent} for ${person} in ${ctx.where(res.deliverables)}; nothing written.`)}`);
    console.log();
    return;
  }
  console.log(`  ${status.success(`${res.accepted} row(s) ratified by agent ${agent} (declared), for ${person} (declared, accountable)`)} ${c.darkGray("— recorded with mode: agent; every later check, the JSON, the SARIF and the attestation count it apart (ADR-0082).")}`);
  if (regulatedOptIn(mission) && !agentRatificationOptIn(mission)) {
    console.log(`  ${c.warning("!")} ${c.darkGray("this mission is under the regulated tier and its scaffold-lock.json does not declare \"agentRatification\": true — these rows still count against the verdict until a person ratifies them.")}`);
  }
  console.log(section("Next"));
  console.log(`  ${c.primary("runward check --strict")} ${c.darkGray("— the gate re-judges the rows, and discloses who ratified them.")}`);
  console.log();
}
