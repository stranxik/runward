#!/usr/bin/env node
// Generates docs/compliance/mutation-register.md from the instructed verdicts.
//
// ADR-0046 decision 2 makes the survivor list a ratchet, which needs an artifact a later run can be
// diffed against; decision 4 makes each survivor a FILED entry rather than a queued one. This
// script produces that artifact from the verdicts in docs/compliance/mutation-survivors/, so the
// register is derived from measurements and never typed by hand.
//
//   node scripts/mutation-register.mjs
//
// Rows are sorted by line, and the note column is truncated on purpose: the register is what a
// reviewer diffs, and the full evidence for every verdict lives beside it in the JSON.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { netDigest, readWholeNetRecord } from "./mutation-net.mjs";
import { SEP } from "./mutation-key.mjs";

const SRC = "docs/compliance/mutation-survivors";
const OUT = "docs/compliance/mutation-register.md";
const MARKER = "<!-- GENERATED BELOW — scripts/mutation-register.mjs -->";

/** The mutant's replacement, recovered from its key: line|col|endLine|endCol|mutator|replacement. */
const replacementOf = (key) => key.split("|").slice(5).join("|");

/** One line of prose beats a long one truncated mid-token. */
function clip(text, max) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Markdown table cells cannot carry a raw pipe or a newline. */
const cell = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

const code = (text) => {
  const t = cell(text);
  return t === "" ? "`` ` ``" : `\`${t.replace(/`/g, "ˋ")}\``;
};

const files = readdirSync(SRC).filter((f) => f.endsWith(".json")).sort();
const fns = files.map((f) => JSON.parse(readFileSync(`${SRC}/${f}`, "utf8")));

const all = fns.flatMap((j) => j.verdicts.map((v) => ({ ...v, function: j.function })));
const count = (list, filing) => list.filter((v) => v.filing === filing).length;

// Biggest first: a reader scanning the register wants the concentrations, not the alphabet.
fns.sort((a, b) => b.verdicts.length - a.verdicts.length || a.function.localeCompare(b.function));

// The module is READ off the key, never assumed. This header said "evidence" for as long as
// evidence was the only module measured; the day compliance entered the perimeter that line
// filed 300 compliance survivors under evidence, and the register stated something false about
// every one of them. A count stated separately from its rows is what catches a dropped row; a
// module stated separately from its keys is what catches this.
const moduleOf = (v) => String(v.stableKey ?? "").split(SEP)[0] || "(unknown)";
const byModule = new Map();
for (const j of fns) {
  const mods = new Set(j.verdicts.map(moduleOf));
  if (mods.size !== 1) {
    console.error(`${j.function}: verdicts span ${[...mods].join(", ")} — one file, one module`);
    process.exit(1);
  }
  const m = [...mods][0];
  if (!byModule.has(m)) byModule.set(m, []);
  byModule.get(m).push(j);
}
const modules = [...byModule.entries()]
  .map(([name, list]) => ({ name, list, rows: list.reduce((n, j) => n + j.verdicts.length, 0) }))
  .sort((a, b) => b.rows - a.rows || a.name.localeCompare(b.name));

const out = [];
out.push(MARKER, "");
out.push("Rows filed `hole`, `equivalent` or `display-only` survived the unit suite AND the whole net —",
  "the self-gate, OSCAL validation, the smoke test, in-toto schema validation, the spelling corpus,",
  "the SARIF shape check and the audit corpus. Rows filed `defence-in-depth` survived the unit suite",
  "and were caught by one of those legs, so something does watch them, just not the tests. They are",
  "listed rather than set aside: leaving them out was a prose exception that made the ratchet report",
  "them as new survivors on every run.", "");
out.push("The `Note` column is a summary. The full evidence for every verdict — what was run, what was",
  "observed, and the argument for each equivalence — is in",
  "[`mutation-survivors/`](mutation-survivors/), one file per function.", "");

const wholeNet = readWholeNetRecord();
const { digest: currentNet } = netDigest();
for (const mod of modules) {
  const rowsOf = mod.list.flatMap((j) => j.verdicts);
  out.push(`## Module: ${mod.name}`, "");
  out.push(`Survivors: ${rowsOf.length}`, "");
  out.push(`Holes: ${count(rowsOf, "hole")} · Equivalent: ${count(rowsOf, "equivalent")} · ` +
    `Display-only: ${count(rowsOf, "display-only")} · ` +
    `Defence-in-depth: ${count(rowsOf, "defence-in-depth")}`, "");

  // WHICH NET THE SECOND HALF OF THESE FILINGS IS ABOUT. `hole`, `equivalent` and `display-only`
  // each assert that the whole net misses the mutant, and that is a claim about a set of leg files.
  // Change one and the claim is about a net that no longer exists — silently, until this line says
  // so. Disclosed rather than refused (ADR-0060): re-running seven legs over hundreds of survivors
  // because a test file gained a fixture is the kind of instrument that gets switched off.
  const rec = wholeNet[mod.name];
  if (!rec) {
    out.push("**Whole net: never run for this module.** Its `hole` filings rest on the unit suite " +
      "alone, so they claim less than the vocabulary above says — read them as *pass 1 only*.", "");
  } else if (rec.digest !== currentNet) {
    out.push(`**Whole net: last run ${rec.at}, against a net that has since changed** ` +
      `(recorded \`${rec.digest.slice(0, 12)}…\`, current \`${currentNet.slice(0, 12)}…\`). ` +
      "A leg was added or edited after that pass, so every filing here that claims the whole net " +
      "misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.", "");
  } else {
    out.push(`Whole net: last run ${rec.at} against the current net ` +
      `(\`${currentNet.slice(0, 12)}…\`), ${rec.detected} of ${rec.trials} survivor(s) caught.`, "");
  }

  for (const j of mod.list) {
    const rows = [...j.verdicts].sort((a, b) => a.line - b.line || a.mutator.localeCompare(b.mutator));
    const parts = [["hole", "hole"], ["equivalent", "equivalent"],
      ["display-only", "display-only"], ["defence-in-depth", "defence-in-depth"]]
      .map(([f, label]) => [count(rows, f), label])
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}`);
    out.push(`### ${j.function} — ${rows.length} survivor(s): ${parts.join(" · ")}`, "");
    out.push("| Line | Mutator | Becomes | Filed as | Note |");
    out.push("| ---: | ------- | ------- | -------- | ---- |");
    for (const v of rows) {
      // Equivalence must show its argument — that is the filing ADR-0046 says is argued, never
      // assumed, and the one that was wrong three times out of four on the August bench.
      const note = v.filing === "equivalent" ? v.argument
        : v.wrongReason ? `wrong reason: ${v.wrongReason}${v.assertion ? ` — assert: ${v.assertion}` : ""}`
        : v.evidence;
      out.push(`| ${v.line} | ${v.mutator} | ${code(clip(replacementOf(v.key), 44))} | ` +
        `${v.filing} | ${cell(clip(note, 200))} |`);
    }
    out.push("");
  }
}
const existing = readFileSync(OUT, "utf8");
const preamble = existing.includes(MARKER) ? existing.slice(0, existing.indexOf(MARKER)) : existing;
writeFileSync(OUT, `${preamble.replace(/\s+$/, "")}\n\n${out.join("\n").replace(/\s+$/, "")}\n`);

console.log(`${OUT}: ${all.length} survivors across ${fns.length} functions in ${modules.length} module(s)`);
for (const mod of modules) {
  const r = mod.list.flatMap((j) => j.verdicts);
  console.log(`  ${mod.name}: ${r.length} (${count(r, "hole")} hole, ${count(r, "equivalent")} equivalent, ` +
    `${count(r, "display-only")} display-only, ${count(r, "defence-in-depth")} defence-in-depth)`);
}
