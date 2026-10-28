#!/usr/bin/env node
// Says, before a tag, whether the mutation register still describes the code it was measured on.
// ADR-0103.
//
// ADR-0059 says a stale register blocks a release. The instrument that decides it, the ratchet of
// .github/workflows/mutation-ratchet.yml, starts on `release: published`, the same event that starts
// the npm publish, and runs for hours. So it answers after the release exists: on 0.45.0 it signed
// `refused` hours after publication (docs/compliance/ratchet-summaries/ratchet-summary-0.45.0.json),
// because three modules had changed after their last filing and nothing had looked before the tag.
//
// This script is the cheap half of that question, and it runs in seconds. The register now records,
// per module, the SHA-256 of the built file the measurement mutated (the source Stryker embeds in its
// report): docs/compliance/mutation-measured-sources.json, written by
// scripts/mutation-record-source.mjs. Here each module's current dist/lib/<module>.js is hashed and
// compared with that record.
//
//   npm run build && npm run mutation:fresh
//
// It builds nothing itself: it reads dist/ as it stands, which is what a release packs.
//
//   0  every module of the perimeter is FRESH: the built file is the one the register was measured on
//   1  at least one module is STALE (its built file changed since its measurement) or UNKNOWN (no
//      measurement recorded, or one recorded with no digest); each is named with the command that
//      re-measures it
//   2  REFUSED: an input is missing or unreadable (no dist/, a module not built, the record or
//      stryker.config.json absent or malformed). Nothing was compared, and that is not a pass.
//
// What FRESH does not say. The ratchet keys survivors on (module, function, mutator, replacement,
// line text) and also reports a filed survivor the tree no longer produces, which a STRONGER test can
// cause without touching the module. A fresh module therefore means "its code is the code measured",
// not "the ratchet will answer describes": the test net is outside this digest (ADR-0103, What this
// does not catch).

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const RECORD = "docs/compliance/mutation-measured-sources.json";
export const CONFIG = "stryker.config.json";
export const WORKFLOW = "mutation-ratchet.yml";

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** dist/lib/evidence.js[:range] -> { module: "evidence", file: "dist/lib/evidence.js" } */
export function perimeterOf(config) {
  if (!config || !Array.isArray(config.mutate)) throw new Error(`${CONFIG} carries no \`mutate\` array`);
  return config.mutate.map((entry) => {
    const file = String(entry).replace(/:.*$/, "");
    return { module: file.replace(/^.*\//, "").replace(/\.js$/, ""), file };
  });
}

/** The command that re-measures one module, as the workflow's dispatch inputs name it. */
export const remeasureCommand = (m) => `gh workflow run ${WORKFLOW} -f module=${m} -f mode=measure`;

class Refused extends Error {}

function readJson(root, rel) {
  const p = resolve(root, rel);
  if (!existsSync(p)) throw new Refused(`${rel} is missing`);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    throw new Refused(`${rel} is not readable JSON (${e.message})`);
  }
}

/**
 * Compares every module of the perimeter with the record. Throws Refused on an input it cannot read;
 * otherwise returns one row per module: { module, state: fresh|stale|unknown, recorded, current, run,
 * measuredAt, reason }.
 */
export function freshness(root = process.cwd()) {
  const perimeter = perimeterOf(readJson(root, CONFIG));
  const record = readJson(root, RECORD);
  if (!Array.isArray(record.modules)) throw new Refused(`${RECORD} carries no \`modules\` array`);
  const byModule = new Map();
  for (const e of record.modules) {
    if (!e || typeof e.module !== "string") throw new Refused(`${RECORD}: an entry carries no module name`);
    if (byModule.has(e.module)) throw new Refused(`${RECORD}: ${e.module} is recorded twice`);
    byModule.set(e.module, e);
  }
  if (!existsSync(resolve(root, "dist"))) throw new Refused("dist/ is missing: run `npm run build` first");

  const rows = [];
  for (const { module, file } of perimeter) {
    const p = resolve(root, file);
    if (!existsSync(p)) throw new Refused(`${file} is not built: run \`npm run build\` first`);
    let current;
    try {
      current = sha256(readFileSync(p));
    } catch (e) {
      throw new Refused(`${file} is not readable (${e.message})`);
    }
    const e = byModule.get(module);
    const base = { module, current, recorded: e?.sha256 ?? null, run: e?.run ?? null, measuredAt: e?.measuredAt ?? null };
    if (!e) rows.push({ ...base, state: "unknown", reason: "no measurement recorded" });
    else if (typeof e.sha256 !== "string") rows.push({ ...base, state: "unknown", reason: e.reason ?? "recorded without a digest" });
    else if (e.sha256 === current) rows.push({ ...base, state: "fresh" });
    else rows.push({ ...base, state: "stale", reason: "the built file changed since this measurement" });
  }
  const extra = [...byModule.keys()].filter((m) => !perimeter.some((p) => p.module === m)).sort();
  return { rows, extra };
}

function main() {
  let result;
  try {
    result = freshness(process.cwd());
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    console.error(`mutation-fresh: ${e.message}`);
    console.error("\nREFUSED — nothing was compared. This is not a passing outcome.");
    process.exit(2);
  }
  const { rows, extra } = result;
  const width = Math.max(...rows.map((r) => r.module.length));
  for (const r of rows) {
    const where = r.run ? ` (run ${r.run}, ${r.measuredAt})` : "";
    const why = r.state === "fresh" ? "" : ` — ${r.reason}`;
    console.log(`${r.module.padEnd(width)}  ${r.state.padEnd(7)}  ${r.current.slice(0, 12)}${where}${why}`);
  }
  for (const m of extra) console.log(`note: ${m} is recorded in ${RECORD} and is not in the perimeter; ignored`);

  const behind = rows.filter((r) => r.state !== "fresh");
  if (behind.length === 0) {
    console.log(`\n${rows.length} of ${rows.length} module(s) fresh: the register was measured on this build.`);
    process.exit(0);
  }
  console.error(`\n${behind.length} of ${rows.length} module(s) not fresh. Re-measure each, file it, record it:`);
  for (const r of behind) console.error(`  ${remeasureCommand(r.module)}`);
  console.error("Then, per module, from the run's `merged-<module>` artifact (docs/compliance/mutation-register.md, Filing a measurement):");
  console.error("  file the survivors, `node scripts/mutation-register.mjs`, and");
  console.error("  node scripts/mutation-record-source.mjs --module <m> --report <m>-merged.json --run <run id> --measured-at <YYYY-MM-DD>");
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
