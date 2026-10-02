#!/usr/bin/env node
// The stop (ADR-0088 decision 9, stage 1): the logic of `.github/workflows/delegation-stop.yml`.
//
// A repository variable only an administrator can set, `RUNWARD_DELEGATION_STOP`, read by a required
// check. When it is on, the check fails on every pull request a delegate identity opened or pushed to,
// or whose commits a delegate authored or committed, so nothing an agent opens under its own identity
// can merge. When it is off (unset, or `off`), the check passes and says so. Any other value is read
// as on: a mistyped stop stops.
//
// Who is a delegate: the App's forge identity, `runward-steward[bot]`, always; plus every name in the
// `delegates:` list of `runward/delegation.md` as the DEFAULT branch holds it (the workflow runs on
// `pull_request_target`, "in the context of the default branch of the base repository", and checks
// out that branch, never the pull request's code, so a pull request cannot take itself off the list
// or edit this file to pass).
//
// Who can set the variable: on a personal-account repository GitHub lets any repository collaborator
// create a repository variable; runward's only collaborator is the owner (admin), and the App holds
// no `variables` permission (ADR-0088 decision 3). A second collaborator would make the stop settable
// by that person too.
//
// What it does not do, stage 1, printed in the run summary: an agent that holds the maintainer's
// credential can clear the variable, and an agent acting under the maintainer's account is not a
// delegate identity and is not stopped. The escalation budget (decision 9: 3 consecutive refusals,
// 20 per period) is published by the charter, not counted here: counting it needs a population this
// check does not see (every refusal of an agent's act, on every check, outside this repository's
// workflow logs too) and an escalation channel outside the repository (ADR-0084), so in stage 1 the
// budget is published, not enforced.
//
// Pure functions are exported for test/unit/delegation-stop.test.js; the CLI part reads the
// environment the workflow sets and exits 1 on a refusal. No dependency, no network.
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const STOP_VARIABLE = "RUNWARD_DELEGATION_STOP";
/** The App every delegated act runs under (ADR-0088 decision 3). */
export const BUILTIN_DELEGATES = ["runward-steward[bot]"];
export const STAGE1_NOTE =
  "stage 1: an agent holding the maintainer's credential can clear this variable, and an agent acting under the maintainer's account is not a delegate identity; the stop binds delegate identities only (ADR-0088 decision 9)";
export const BUDGET_NOTE =
  "escalation budget: published by the charter, not enforced by this check in stage 1";

/** Unset or `off`: no stop. Anything else, `on` included, is a stop (fails closed on a typo). */
export function isStopOn(value) {
  const v = (value ?? "").trim().toLowerCase();
  return !(v === "" || v === "off");
}

const fold = (s) => s.trim().toLowerCase();

function unquote(v) {
  const t = v.trim();
  return t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'"))) ? t.slice(1, -1) : t;
}

/** The `delegates:` of a charter, in the gate's grammar (src/lib/delegation.ts): the frontmatter
 *  between the first two `---` lines, `delegates: [a, b]` (one bracket stripped at each end, so
 *  `runward-steward[bot]` survives) or `delegates:` then `  - item` lines. [] when unreadable. */
export function charterDelegates(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return [];
  const end = lines.indexOf("---", 1);
  if (end === -1) return [];
  const fm = lines.slice(1, end);
  const i = fm.findIndex((l) => l.startsWith("delegates:"));
  if (i === -1) return [];
  const rest = fm[i].slice("delegates:".length).trim();
  if (rest !== "") {
    if (!rest.startsWith("[") || !rest.endsWith("]")) return [];
    return rest.slice(1, -1).split(",").map(unquote).filter((x) => x !== "");
  }
  const out = [];
  for (const l of fm.slice(i + 1)) {
    const t = l.trimStart();
    if (!l.startsWith(" ") || !t.startsWith("- ")) break;
    const item = unquote(t.slice(2));
    if (item !== "") out.push(item);
  }
  return out;
}

/**
 * The decision. `identities` are the pull request's: its author, the account that triggered this run
 * (opened, reopened or pushed), and the logins of its commits' authors and committers.
 * Returns { stop, refuse, delegates, matched } — refuse only when the stop is on and one identity is
 * a delegate, compared case-insensitively (forge logins are).
 */
export function decide({ stopValue, charterText, identities }) {
  const stop = isStopOn(stopValue);
  const delegates = [...BUILTIN_DELEGATES];
  for (const d of charterText ? charterDelegates(charterText) : []) if (!delegates.some((x) => fold(x) === fold(d))) delegates.push(d);
  const set = new Set(delegates.map(fold));
  const matched = [...new Set(identities.filter((x) => x && set.has(fold(x))).map((x) => x.trim()))];
  return { stop, refuse: stop && matched.length > 0, delegates, matched };
}

function main() {
  const charterPath = resolve(process.argv[2] ?? "runward/delegation.md");
  const charterText = existsSync(charterPath) ? readFileSync(charterPath, "utf8") : null;
  const commitsFile = process.env.COMMIT_LOGINS_FILE;
  const commitLogins = commitsFile && existsSync(commitsFile)
    ? readFileSync(commitsFile, "utf8").split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : [];
  const identities = [process.env.PR_AUTHOR ?? "", process.env.SENDER ?? "", ...commitLogins];
  const r = decide({ stopValue: process.env[STOP_VARIABLE], charterText, identities });
  const out = [
    `${STOP_VARIABLE}: ${r.stop ? "on" : "off"}${r.stop && fold(process.env[STOP_VARIABLE] ?? "") !== "on" ? ` (read "${(process.env[STOP_VARIABLE] ?? "").trim()}", any value other than off is a stop)` : ""}`,
    `delegate identities: ${r.delegates.join(", ")}${charterText === null ? " (no charter on the default branch: the App only)" : ""}`,
    `this pull request: ${[...new Set(identities.filter(Boolean))].join(", ") || "(none read)"}`,
    r.refuse
      ? `REFUSED: the stop is on and ${r.matched.join(", ")} is a delegate identity; nothing an agent opens or pushes merges until an administrator turns the stop off`
      : r.stop ? "passed: the stop is on, and no delegate identity opened, pushed or authored this pull request" : "passed: the stop is off",
    STAGE1_NOTE,
    BUDGET_NOTE,
  ];
  for (const l of out) console.log(l);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### delegation stop\n\n${out.map((l) => `- ${l}`).join("\n")}\n`); } catch { /* the log carries it */ }
  }
  if (r.refuse) {
    console.log(`::error::delegation stop: ${r.matched.join(", ")} is a delegate identity and ${STOP_VARIABLE} is on (ADR-0088 decision 9)`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
