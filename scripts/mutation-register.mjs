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

const out = [];
out.push(MARKER, "");
out.push("## Module: evidence", "");
out.push(`Survivors: ${all.length}`, "");
out.push(`Holes: ${count(all, "hole")} · Equivalent: ${count(all, "equivalent")} · ` +
  `Display-only: ${count(all, "display-only")}`, "");
out.push("Every row survived the unit suite AND the whole net — the self-gate, OSCAL validation, the",
  "smoke test, in-toto schema validation and the audit corpus. Two further mutants were caught by the",
  "self-gate alone and are filed as defence in depth rather than listed here.", "");
out.push("The `Note` column is a summary. The full evidence for every verdict — what was run, what was",
  "observed, and the argument for each equivalence — is in",
  "[`mutation-survivors/`](mutation-survivors/), one file per function.", "");

for (const j of fns) {
  const rows = [...j.verdicts].sort((a, b) => a.line - b.line || a.mutator.localeCompare(b.mutator));
  out.push(`### ${j.function} — ${rows.length} survivor(s): ` +
    `${count(rows, "hole")} hole · ${count(rows, "equivalent")} equivalent · ` +
    `${count(rows, "display-only")} display-only`, "");
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

const existing = readFileSync(OUT, "utf8");
const preamble = existing.includes(MARKER) ? existing.slice(0, existing.indexOf(MARKER)) : existing;
writeFileSync(OUT, `${preamble.replace(/\s+$/, "")}\n\n${out.join("\n").replace(/\s+$/, "")}\n`);

console.log(`${OUT}: ${all.length} survivors across ${fns.length} functions ` +
  `(${count(all, "hole")} hole, ${count(all, "equivalent")} equivalent, ` +
  `${count(all, "display-only")} display-only)`);
