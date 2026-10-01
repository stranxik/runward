#!/usr/bin/env node
// Open anomalies per version, read from the defect register (ADR-0087).
//
// docs/compliance/known-defects.md states each entry's versions twice: in its prose, where the
// detail lives ("0.34.0 (when the realpath rung was added) through 0.36.2"), and in a fixed form at
// the head of the entry, `affected-from=X` `fixed-in=Y`, which is what this file reads. The fixed
// form is filled from the entry's own text, the npm version list and the git tags, never inferred
// beyond them; where the entry does not give a version, it says `unknown`, and this reader keeps
// those entries apart instead of guessing which side of the line they fall on.
//
// Usage: node scripts/open-anomalies.mjs <version> [--json]
//
// For <version>, an entry is OPEN when its affected-from is at or before <version> and it was not
// fixed at or before <version> (fixed later, `unreleased`, or `not-fixed`). It is UNDETERMINED when
// the register cannot answer for that version: affected-from `unknown` and not fixed at or before
// it, or affected at or before it with fixed-in `unknown`. Entries whose affected-from is `none` (no
// published release carried them, per their own text) are never listed. The register describes the
// package version its header names; a later version is outside what it can speak for.
import { readFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REGISTER = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "compliance", "known-defects.md");

/** The closed vocabularies. A semver is X.Y.Z; anything else must be one of these words. */
export const AFFECTED_FROM_WORDS = Object.freeze(["unknown", "none"]);
export const FIXED_IN_WORDS = Object.freeze(["unknown", "unreleased", "not-fixed", "not-applicable"]);
const SEMVER = /^\d+\.\d+\.\d+$/;

export function isSemver(v) { return SEMVER.test(v); }

/** Numeric comparison of two X.Y.Z versions: negative, zero or positive. */
export function compareVersions(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Split a markdown table row on its unescaped pipes; the outer empty cells are dropped. */
function cells(line) {
  return line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
}

/**
 * Every entry of the register, in file order: { id, affectedFrom, fixedIn, summary, workaround,
 * line }. `affectedFrom` and `fixedIn` are null when the row does not carry the fixed form (the
 * register test refuses that). `workaround` is the cell under a "Workaround" column, null where the
 * entry's table has none.
 */
export function readRegister(text) {
  const out = [];
  let header = null;
  text.split("\n").forEach((line, i) => {
    if (/^\| id \|/i.test(line)) { header = cells(line); return; }
    const m = line.match(/^\| (RWD-\d{4}-\d{4}) \|/);
    if (!m) return;
    const v = line.match(/^\| RWD-\d{4}-\d{4} \| `affected-from=([^`]+)` `fixed-in=([^`]+)` · /);
    const row = cells(line);
    // Every table that has a Workaround column has it last, and the last cell is the one a pipe
    // quoted inside a code span cannot displace.
    const workaround = header && /^workaround/i.test(header[header.length - 1]) ? row[row.length - 1] : null;
    const body = (row[1] ?? "").replace(/^`affected-from=[^`]+` `fixed-in=[^`]+` · /, "");
    const summary = body.replace(/\*\*/g, "").split(/(?<=\.)\s/)[0].slice(0, 240);
    out.push({ id: m[1], affectedFrom: v?.[1] ?? null, fixedIn: v?.[2] ?? null, summary, workaround, line: i + 1 });
  });
  return out;
}

/** Every way an entry's fixed form breaks the vocabulary or its own logic, as sentences. */
export function versionProblems(entries, packageVersion) {
  const out = [];
  for (const e of entries) {
    const { id, affectedFrom: a, fixedIn: f } = e;
    if (a === null || f === null) { out.push(`${id}: no \`affected-from=…\` \`fixed-in=…\` at the head of the entry`); continue; }
    if (!isSemver(a) && !AFFECTED_FROM_WORDS.includes(a)) out.push(`${id}: affected-from "${a}" is neither X.Y.Z nor one of ${AFFECTED_FROM_WORDS.join(", ")}`);
    if (!isSemver(f) && !FIXED_IN_WORDS.includes(f)) out.push(`${id}: fixed-in "${f}" is neither X.Y.Z nor one of ${FIXED_IN_WORDS.join(", ")}`);
    if (isSemver(a) && isSemver(f) && compareVersions(a, f) >= 0) out.push(`${id}: fixed in ${f}, which is not after affected-from ${a}`);
    if (f === "not-applicable" && a !== "none") out.push(`${id}: fixed-in is not-applicable only when no release was affected (affected-from=none), here ${a}`);
    if (packageVersion && isSemver(f) && compareVersions(f, packageVersion) > 0) out.push(`${id}: fixed in ${f}, later than the package version ${packageVersion}; write \`unreleased\``);
    if (packageVersion && isSemver(a) && compareVersions(a, packageVersion) > 0) out.push(`${id}: affected from ${a}, later than the package version ${packageVersion}`);
  }
  return out;
}

/** For one version: { open, undetermined }, each a list of entries, in register order. */
export function openAnomalies(entries, version) {
  if (!isSemver(version)) throw new Error(`not a version: ${JSON.stringify(version)} (expected X.Y.Z)`);
  const open = [], undetermined = [];
  for (const e of entries) {
    const { affectedFrom: a, fixedIn: f } = e;
    if (a === null || f === null || a === "none") continue;
    if (isSemver(f) && compareVersions(f, version) <= 0) continue; // fixed at or before it
    if (isSemver(a) && compareVersions(a, version) > 0) continue; // not yet affected
    if (a === "unknown" || f === "unknown") undetermined.push(e);
    else open.push(e); // affected at or before it; fixed later, unreleased, or not fixed
  }
  return { open, undetermined };
}

function main(argv) {
  const json = argv.includes("--json");
  const version = argv.find((a) => !a.startsWith("--"));
  if (!version || !isSemver(version)) {
    console.error("usage: node scripts/open-anomalies.mjs <X.Y.Z> [--json]");
    process.exit(2);
  }
  const text = readFileSync(REGISTER, "utf8");
  const describes = text.match(/\*\*Describes\*\*: runward (\S+)/)?.[1] ?? null;
  const { open, undetermined } = openAnomalies(readRegister(text), version);
  const shape = (e) => ({ id: e.id, affectedFrom: e.affectedFrom, fixedIn: e.fixedIn, summary: e.summary, workaround: e.workaround });
  const beyond = describes && isSemver(describes) && compareVersions(version, describes) > 0;
  if (json) {
    process.stdout.write(JSON.stringify({ version, registerDescribes: describes, beyondRegister: Boolean(beyond),
      open: open.map(shape), undetermined: undetermined.map(shape) }, null, 2) + "\n");
    return;
  }
  console.log(`runward ${version}: ${open.length} open, ${undetermined.length} undetermined (register describes ${describes ?? "an unnamed version"})`);
  if (beyond) console.log(`  ${version} is later than the version the register describes: entries found after ${describes} are not in it.`);
  for (const [title, list] of [["Open", open], ["Undetermined (the register gives no version on one side)", undetermined]]) {
    if (!list.length) continue;
    console.log(`\n${title}:`);
    for (const e of list) console.log(`  ${e.id}  affected-from=${e.affectedFrom} fixed-in=${e.fixedIn}  ${e.summary}`);
  }
}

const invokedDirectly = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) main(process.argv.slice(2));
