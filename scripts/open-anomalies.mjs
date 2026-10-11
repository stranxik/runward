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
//
// Each entry also says whether it has a published security advisory (ADR-0086, decision 2), in the
// same fixed form: `advisory=GHSA-xxxx-xxxx-xxxx`, or `none:<the criterion it fails>`, or
// `unclassified` where nobody has read it against the criteria yet. A listed entry with an advisory
// names it, so a reader of the open anomalies of a version learns which of them a dependency scanner
// can also report.
import { readFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REGISTER = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "compliance", "known-defects.md");

/** The closed vocabularies. A semver is X.Y.Z; anything else must be one of these words. */
export const AFFECTED_FROM_WORDS = Object.freeze(["unknown", "none"]);
export const FIXED_IN_WORDS = Object.freeze(["unknown", "unreleased", "not-fixed", "not-applicable"]);
const SEMVER = /^\d+\.\d+\.\d+$/;

/**
 * The `advisory` vocabulary (ADR-0086, decision 2). A published GitHub security advisory, or the
 * reason there is none, as the first of ADR-0086's conditions the entry fails, tried in this order.
 */
export const ADVISORY_NONE = Object.freeze([
  "none:not-shipped",      // decision 1: no published release carried it (affected-from=none)
  "none:unsupported-only", // decision 4: its whole range lies at or below 0.36.x (fixed in 0.37.0 or earlier)
  "none:declared-limit",   // decision 1, "Not advised": a declared limit with no fix (fixed-in=not-fixed)
  "none:fix-not-shipped",  // ADR-0086 amendment: the fix is outside the published package (RWD-2026-0113)
  "none:not-S1-S4",        // decision 1: it meets none of the four criteria
]);
export const ADVISORY_WORDS = Object.freeze([...ADVISORY_NONE, "unclassified"]);
/** GitHub's advisory identifier: three groups of four from its reduced alphabet. */
export const GHSA = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;
/** The first line ADR-0086 decision 4 lets an advisory speak for: 0.37.x is the oldest supported. */
export const FIRST_SUPPORTED = "0.37.0";

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
 * Every entry of the register, in file order: { id, affectedFrom, fixedIn, advisory, summary,
 * workaround, line }. `affectedFrom` and `fixedIn` are null when the row does not carry the fixed
 * form, `advisory` when it carries no `advisory=` tag (the register test refuses both). `workaround` is the cell under a "Workaround" column, null where the
 * entry's table has none.
 */
export function readRegister(text) {
  const out = [];
  let header = null;
  text.split("\n").forEach((line, i) => {
    if (/^\| id \|/i.test(line)) { header = cells(line); return; }
    const m = line.match(/^\| (RWD-\d{4}-\d{4}) \|/);
    if (!m) return;
    const v = line.match(/^\| RWD-\d{4}-\d{4} \| `affected-from=([^`]+)` `fixed-in=([^`]+)`(?: `advisory=([^`]+)`)? · /);
    const row = cells(line);
    // Every table that has a Workaround column has it last, and the last cell is the one a pipe
    // quoted inside a code span cannot displace.
    const workaround = header && /^workaround/i.test(header[header.length - 1]) ? row[row.length - 1] : null;
    const body = (row[1] ?? "").replace(/^`affected-from=[^`]+` `fixed-in=[^`]+`(?: `advisory=[^`]+`)? · /, "");
    const summary = body.replace(/\*\*/g, "").split(/(?<=\.)\s/)[0].slice(0, 240);
    out.push({ id: m[1], affectedFrom: v?.[1] ?? null, fixedIn: v?.[2] ?? null, advisory: v?.[3] ?? null, summary, workaround, line: i + 1 });
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

/**
 * Every way an entry's `advisory` tag breaks the vocabulary, ADR-0086 or the other entries, as
 * sentences. The mechanical reasons are held both ways: an entry no release carried says
 * `none:not-shipped` and nothing else does; an entry fixed in 0.37.0 or earlier says
 * `none:unsupported-only` and nothing else does. An advisory needs a range that reaches a supported
 * line (decision 4) and a patched version (decision 2), and names one entry only.
 */
export function advisoryProblems(entries, packageVersion) {
  const out = [], seen = new Map();
  for (const e of entries) {
    const { id, affectedFrom: a, fixedIn: f, advisory: v } = e;
    if (v === null || v === undefined) { out.push(`${id}: no \`advisory=…\` after its versions`); continue; }
    const isGhsa = GHSA.test(v);
    if (!isGhsa && !ADVISORY_WORDS.includes(v)) {
      out.push(`${id}: advisory "${v}" is neither a GHSA identifier (GHSA-xxxx-xxxx-xxxx) nor one of ${ADVISORY_WORDS.join(", ")}`);
      continue;
    }
    if (isGhsa) {
      if (seen.has(v)) out.push(`${id}: ${v} is already the advisory of ${seen.get(v)}; one advisory per entry`);
      else seen.set(v, id);
      if (a === "none") out.push(`${id}: ${v} on an entry no release carried (affected-from=none)`);
      if (!isSemver(f)) out.push(`${id}: ${v} needs a patched version, fixed-in is ${f}`);
      else if (compareVersions(f, FIRST_SUPPORTED) <= 0) out.push(`${id}: ${v} on a range that ends before ${FIRST_SUPPORTED} (fixed in ${f}); decision 4 gives it no advisory`);
      else if (packageVersion && compareVersions(f, packageVersion) > 0) out.push(`${id}: ${v} names a patched version ${f} later than the package ${packageVersion}`);
      continue;
    }
    const notShipped = a === "none";
    const unsupportedOnly = !notShipped && isSemver(f) && compareVersions(f, FIRST_SUPPORTED) <= 0;
    if (notShipped !== (v === "none:not-shipped")) out.push(notShipped
      ? `${id}: no release carried it (affected-from=none), so its advisory is none:not-shipped, not ${v}`
      : `${id}: none:not-shipped, while affected-from is ${a}`);
    else if (unsupportedOnly !== (v === "none:unsupported-only")) out.push(unsupportedOnly
      ? `${id}: fixed in ${f}, so its whole range is unsupported and its advisory is none:unsupported-only, not ${v}`
      : `${id}: none:unsupported-only, while fixed-in is ${f} (the range reaches ${FIRST_SUPPORTED} or later, or is not known)`);
    if (v === "none:declared-limit" && f !== "not-fixed") out.push(`${id}: none:declared-limit is a limit with no fix, while fixed-in is ${f}`);
    if (v === "none:fix-not-shipped" && !isSemver(f)) out.push(`${id}: none:fix-not-shipped needs the release the fix was expected in, fixed-in is ${f}`);
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
  const shape = (e) => ({ id: e.id, affectedFrom: e.affectedFrom, fixedIn: e.fixedIn, advisory: e.advisory, summary: e.summary, workaround: e.workaround });
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
    for (const e of list) {
      const adv = e.advisory && GHSA.test(e.advisory) ? ` advisory=${e.advisory}` : "";
      console.log(`  ${e.id}  affected-from=${e.affectedFrom} fixed-in=${e.fixedIn}${adv}  ${e.summary}`);
    }
  }
  const advised = [...open, ...undetermined].filter((e) => e.advisory && GHSA.test(e.advisory)).length;
  if (advised) console.log(`\nEntries above with a published security advisory: ${advised} (https://github.com/stranxik/runward/security/advisories)`);
}

const invokedDirectly = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) main(process.argv.slice(2));
