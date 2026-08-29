#!/usr/bin/env node
// Derives the survivor register from a Stryker JSON report.
//
// ADR-0046 decision 2 makes the survivor list a ratchet, and decision 4 makes each
// survivor a filed entry rather than a backlog item. Both require the list to be an
// artifact someone can diff. This script is how that artifact is produced: it is read
// out of a real measurement, never typed by hand.
//
//   node scripts/mutation-survivors.mjs                  # summary per module
//   node scripts/mutation-survivors.mjs --markdown       # rows for the register
//   node scripts/mutation-survivors.mjs --json           # keyed entries, for the guard
//   node scripts/mutation-survivors.mjs --module evidence
//
// The key is (module, mutator, replacement, source line text) — deliberately not the
// line number, which moves whenever anything above it moves and would make the register
// churn on edits that changed nothing about the survivor.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const REPORT = "reports/mutation/mutation.json";

/** Stryker statuses that mean "the suite did not kill this mutant". */
const SURVIVING = new Set(["Survived", "NoCoverage"]);

function readReport(path) {
  if (!existsSync(path)) {
    console.error(`no report at ${path} — run \`npm run mutation\` first`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/** dist/lib/evidence.js -> evidence */
function moduleName(file) {
  return file.replace(/^.*\//, "").replace(/\.js$/, "");
}

/**
 * The source line a mutant sits on, trimmed and collapsed.
 * Stryker embeds the file source in the report, so this needs no filesystem access
 * and stays correct even if the working tree moved on since the run.
 */
function sourceLine(fileEntry, line) {
  const lines = (fileEntry.source ?? "").split("\n");
  return (lines[line - 1] ?? "").trim().replace(/\s+/g, " ");
}

/** One line of prose is worth more than a long one that gets truncated mid-token. */
function clip(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function collect(report, only) {
  const out = [];
  for (const [file, entry] of Object.entries(report.files)) {
    const mod = moduleName(file);
    if (only && mod !== only) continue;
    for (const m of entry.mutants) {
      if (!SURVIVING.has(m.status)) continue;
      const line = m.location.start.line;
      out.push({
        module: mod,
        mutator: m.mutatorName,
        replacement: (m.replacement ?? "").replace(/\s+/g, " ").trim(),
        line,
        column: m.location.start.column,
        source: sourceLine(entry, line),
        status: m.status,
      });
    }
  }
  // Sorted by position so the register reads in file order, and so two runs of the
  // same tree emit byte-identical output.
  out.sort((a, b) =>
    a.module.localeCompare(b.module) || a.line - b.line || a.column - b.column ||
    a.mutator.localeCompare(b.mutator) || a.replacement.localeCompare(b.replacement));
  return out;
}

function scores(report, only) {
  const per = new Map();
  for (const [file, entry] of Object.entries(report.files)) {
    const mod = moduleName(file);
    if (only && mod !== only) continue;
    const tally = { killed: 0, survived: 0, noCoverage: 0, timeout: 0, error: 0, ignored: 0 };
    for (const m of entry.mutants) {
      if (m.status === "Killed") tally.killed++;
      else if (m.status === "Survived") tally.survived++;
      else if (m.status === "NoCoverage") tally.noCoverage++;
      else if (m.status === "Timeout") tally.timeout++;
      else if (m.status === "Ignored") tally.ignored++;
      else tally.error++;
    }
    const detected = tally.killed + tally.timeout;
    const valid = detected + tally.survived + tally.noCoverage;
    tally.total = valid + tally.error + tally.ignored;
    tally.score = valid === 0 ? null : (detected / valid) * 100;
    per.set(mod, tally);
  }
  return per;
}

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

/**
 * Merges the per-chunk reports written by scripts/mutation-chunked.sh into one report.
 *
 * Chunks cover disjoint line ranges, so a mutant appearing twice means the ranges
 * overlapped — deduplication keeps the merge total honest rather than double-counting a
 * survivor and inflating the register.
 */
function readChunks(dir, mod) {
  if (!existsSync(dir)) {
    console.error(`no chunk directory at ${dir} — run scripts/mutation-chunked.sh first`);
    process.exit(2);
  }
  // EXACT, not by prefix. A module name contains dashes too, so `startsWith("territory-")` also
  // accepts `territory-map-0001-0060.json`, and the merge then carries a second module's mutants
  // — measured 2026-08-29, RWD-2026-0089. What separates the two names is that a chunk's suffix is
  // DIGITS: `scripts/mutation-chunked.sh` writes `<module>-<4>-<4>.json` (a line range) and the
  // workflow copies collected artifacts as `<module>-<4>.json` (a counter), so both shapes are
  // accepted and `territory-map-…` is not, because `m` is not a digit.
  const chunkName = new RegExp(`^${mod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d{4}(?:-\\d{4})?\\.json$`);
  const files = readdirSync(dir).filter((f) => chunkName.test(f)).sort();
  if (files.length === 0) {
    console.error(`no chunk reports for "${mod}" in ${dir}`);
    process.exit(2);
  }
  const merged = { schemaVersion: "1.0", files: {} };
  const seen = new Set();
  let duplicates = 0;
  // Each chunk is verified for timeouts on its own — scripts/mutation-timeouts.mjs re-runs them
  // alone, mutation-apply-verdicts.mjs stamps `_runwardTimeoutsVerified` on the chunk. That stamp
  // is what mutation-ratchet.mjs reads before it will compare anything, and until 2026-08-25 this
  // merge dropped it on the floor: thirty chunks came back, every one of them verified, and the
  // ratchet refused the merged report for carrying eight unverified timeouts. The work had been
  // done and the evidence of it discarded one line above here.
  const verifiedChunks = [];
  const unverifiedChunks = [];
  const rollup = { verdicts: 0, confirmedHangs: 0, refiledSurviving: 0, refiledKilled: 0 };
  for (const f of files) {
    const chunk = JSON.parse(readFileSync(join(dir, f), "utf8"));
    // A chunk with no timeouts owes no stamp — the clean case must not be the one that breaks the
    // chain, which is the mistake this workflow already made once with `paths`. Only a chunk that
    // still files a Timeout owes it.
    const chunkTimeouts = Object.values(chunk.files)
      .reduce((n, e) => n + e.mutants.filter((m) => m.status === "Timeout").length, 0);
    const stamp = chunk._runwardTimeoutsVerified;
    if (stamp) {
      verifiedChunks.push(f);
      for (const k of Object.keys(rollup)) rollup[k] += stamp[k] ?? 0;
    } else if (chunkTimeouts > 0) {
      unverifiedChunks.push(`${f} (${chunkTimeouts} Timeout)`);
    }
    for (const [path, entry] of Object.entries(chunk.files)) {
      merged.files[path] ??= { source: entry.source, mutants: [] };
      for (const m of entry.mutants) {
        const key = [path, m.location.start.line, m.location.start.column,
          m.location.end.line, m.location.end.column, m.mutatorName, m.replacement].join("|");
        if (seen.has(key)) { duplicates++; continue; }
        seen.add(key);
        merged.files[path].mutants.push(m);
      }
    }
  }
  console.error(`merged ${files.length} chunk report(s)` +
    (duplicates ? `, ${duplicates} duplicate mutant(s) dropped` : ""));

  // ONE unverified chunk leaves the whole merge unverified, and the stamp is simply absent rather
  // than qualified. A partial "29 of 30 were checked" is the shape that gets read as "checked":
  // the ratchet's question is whether a Timeout in THIS report can be hiding a survivor, and a
  // single unchecked chunk answers yes for the report as a whole.
  if (unverifiedChunks.length > 0) {
    console.error(`${unverifiedChunks.length} chunk(s) file a Timeout and carry no verification:`);
    for (const c of unverifiedChunks) console.error(`  - ${c}`);
    console.error("the merged report is left unstamped, so the ratchet will refuse it");
  } else if (verifiedChunks.length > 0) {
    merged._runwardTimeoutsVerified = { ...rollup, chunks: verifiedChunks.length, ledger: "per chunk" };
    console.error(`timeouts verified in ${verifiedChunks.length} chunk(s): ` +
      `${rollup.confirmedHangs} confirmed hang(s), ${rollup.refiledSurviving} re-filed as surviving`);
  }
  return merged;
}

const chunkModule = value("chunks");
const report = chunkModule
  ? readChunks(resolve(process.cwd(), "reports/mutation/chunks"), chunkModule)
  : readReport(resolve(process.cwd(), value("report") ?? REPORT));
const only = value("module");
const survivors = collect(report, only);
const per = scores(report, only);

// A merged report is a real Stryker report, so the whole-net pass reads it with --report
// and needs no merging logic of its own.
if (value("emit-merged")) {
  writeFileSync(resolve(process.cwd(), value("emit-merged")), JSON.stringify(report));
  console.error(`merged report written to ${value("emit-merged")}`);
}

if (flag("json")) {
  console.log(JSON.stringify(survivors, null, 2));
} else if (flag("markdown")) {
  // Column widths are fixed rather than computed: a register whose table reflows on
  // every run produces diffs that hide the one row that actually changed.
  console.log("| Line | Mutator | Becomes | On | Filed as |");
  console.log("| ---: | ------- | ------- | -- | -------- |");
  for (const s of survivors) {
    console.log(
      `| ${s.line} | ${s.mutator} | \`${clip(s.replacement, 40)}\` | \`${clip(s.source, 60)}\` | |`,
    );
  }
} else {
  for (const [mod, t] of per) {
    const score = t.score === null ? "n/a" : `${t.score.toFixed(1)} %`;
    const surviving = t.survived + t.noCoverage;
    console.log(
      `${mod.padEnd(20)} ${score.padStart(7)}  ${String(surviving).padStart(4)} surviving  ` +
      `(${t.killed} killed, ${t.timeout} timeout, ${t.error} error, ${t.total} total)`,
    );
  }
  const totalSurviving = [...per.values()].reduce((n, t) => n + t.survived + t.noCoverage, 0);
  console.log(`\n${totalSurviving} survivors to file — \`--markdown\` for register rows.`);
}
