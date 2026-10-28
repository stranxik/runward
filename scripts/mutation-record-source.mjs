#!/usr/bin/env node
// Records which built source a module's filing was measured on. ADR-0103, decision 1.
//
// Run it when a module is filed from a measurement (a release ratchet or a `mode=measure` dispatch of
// .github/workflows/mutation-ratchet.yml), after the survivors are filed and the register regenerated:
//
//   node scripts/mutation-record-source.mjs --module evidence \
//     --report evidence-merged.json --run 40617445462 --measured-at 2026-10-28
//
// `--report` is the run's merged report (artifact `merged-<module>`). The digest written is the
// SHA-256 of the source Stryker embedded for dist/lib/<module>.js, read from the report and never from
// the local build: the record says what was MEASURED. scripts/mutation-fresh.mjs later compares it with
// the build a release packs.
//
// It refuses to record what the register does not describe. Before writing, it replays the ratchet
// (scripts/mutation-ratchet.mjs) on the same report against the committed verdicts; anything but
// "the register describes this tree" (exit 0) writes nothing. An entry therefore always means: this
// source was measured, and the register as committed describes that measurement.
//
//   0  recorded
//   2  refused: bad arguments, an unusable report, a module outside the perimeter, or a ratchet
//      that does not answer "describes" (its own output is shown)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { RECORD, CONFIG, perimeterOf, sha256 } from "./mutation-fresh.mjs";

const argv = process.argv.slice(2);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1] ?? null;
};
function refuse(message) {
  console.error(`mutation-record-source: ${message}`);
  console.error("Nothing was recorded.");
  process.exit(2);
}

const moduleName = value("module");
const reportPath = value("report");
const run = value("run");
const measuredAt = value("measured-at");
if (!moduleName || !reportPath || !run || !measuredAt) {
  refuse("usage: mutation-record-source.mjs --module <m> --report <merged.json> --run <run id> --measured-at <YYYY-MM-DD>");
}
if (!/^\d+$/.test(run)) refuse(`--run must be the numeric id of the workflow run, got "${run}"`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt) || Number.isNaN(Date.parse(`${measuredAt}T00:00:00Z`))) {
  refuse(`--measured-at must be a date YYYY-MM-DD, got "${measuredAt}"`);
}

const root = process.cwd();
let config;
try {
  config = JSON.parse(readFileSync(resolve(root, CONFIG), "utf8"));
} catch (e) {
  refuse(`${CONFIG} is not readable (${e.message})`);
}
const entry = perimeterOf(config).find((p) => p.module === moduleName);
if (!entry) refuse(`${moduleName} is not in the perimeter (${CONFIG} \`mutate\`)`);

let report;
try {
  report = JSON.parse(readFileSync(resolve(root, reportPath), "utf8"));
} catch (e) {
  refuse(`the report ${reportPath} is not readable (${e.message})`);
}
// The exact path, never a prefix or a suffix match: `territory` is a prefix of `territory-map`
// (RWD-2026-0089).
const measured = report?.files?.[entry.file];
if (!measured || typeof measured.source !== "string" || measured.source === "") {
  refuse(`the report carries no source for ${entry.file}, so there is nothing to record`);
}
const digest = sha256(Buffer.from(measured.source, "utf8"));

const ratchet = spawnSync(process.execPath,
  [join(import.meta.dirname, "mutation-ratchet.mjs"), "--module", moduleName, "--report", reportPath],
  { cwd: root, encoding: "utf8" });
if (ratchet.status !== 0) {
  process.stderr.write(ratchet.stdout ?? "");
  process.stderr.write(ratchet.stderr ?? "");
  refuse(`the ratchet does not answer "describes" on this report (exit ${ratchet.status}): ` +
    "file the survivors and regenerate the register first, then record");
}

const recordPath = resolve(root, RECORD);
let record;
if (existsSync(recordPath)) {
  try {
    record = JSON.parse(readFileSync(recordPath, "utf8"));
  } catch (e) {
    refuse(`${RECORD} is not readable JSON (${e.message})`);
  }
  if (!Array.isArray(record.modules)) refuse(`${RECORD} carries no \`modules\` array`);
} else {
  record = { adr: "ADR-0103", modules: [] };
}
const kept = record.modules.filter((e) => e.module !== moduleName);
const previous = record.modules.find((e) => e.module === moduleName);
kept.push({ module: moduleName, sha256: digest, run, measuredAt });
kept.sort((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0));
record.modules = kept;
writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);

const built = resolve(root, entry.file);
const local = existsSync(built) ? sha256(readFileSync(built)) : null;
console.log(`${moduleName}: recorded ${digest.slice(0, 12)}… from run ${run} (${measuredAt})` +
  (previous ? `, replacing run ${previous.run ?? "none"}` : ""));
console.log(local === null ? "  the local build has no such file: run `npm run build` and `npm run mutation:fresh`"
  : local === digest ? "  the local build is that source: fresh"
  : "  the local build differs from that source: `npm run mutation:fresh` will call this module stale");
