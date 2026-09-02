// Every runward invocation a template cites must exist in the CLI it ships with.
//
// The 2026-09-02 investigation measured the risk this guards: the proof half of the product took
// ~800 file touches while templates/mission slept since 07-16 and templates/workflows since 07-31.
// Nothing tied the two — a renamed flag or a retired subcommand would leave every scaffolded
// mission citing a command that no longer answers, and `update` PROPAGATES workflows into living
// missions, so the lie would travel. docs/first-mission.md already showed the failure shape: a
// guide instructing version 0.6.0 gestures against a 0.37.x binary.
//
// The inventory comes from src/cli.ts SOURCE, not from `--help` and not from importing dist/cli.js
// (its module top level calls program.parseAsync(): importing it RUNS the CLI). Commander
// registrations in this repository are fully declarative — `.command("name")` then `.option("…")`
// lines — so a sequential scan is exact, and the test asserts its own extraction floor so an empty
// sweep can never pass as a clean one (a zero without a positive control does not distinguish
// "nothing" from "blind").
//
// In scope: inline code spans and fenced code blocks in templates/{workflows,mission,targets}.
// Prose ("runward traces this decision") stays out by construction — only backticked or fenced
// text is a citation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ── the CLI inventory, from the source of truth ──────────────────────────────────────────────────
function cliInventory() {
  const src = readFileSync(join(ROOT, "src", "cli.ts"), "utf8");
  const inv = new Map([["__global__", new Set()]]);
  let current = "__global__";
  for (const line of src.split("\n")) {
    const cmd = line.match(/\.command\("([a-z-]+)"\)/);
    if (cmd) { current = cmd[1]; inv.set(current, new Set()); continue; }
    if (!line.includes(".option(")) continue;
    for (const m of line.matchAll(/"(-{1,2}[a-zA-Z-]+)(?:[ ,]|")/g)) inv.get(current).add(m[1].replace(/,$/, ""));
  }
  return inv;
}

// ── the citations, from the templates ────────────────────────────────────────────────────────────
function* templateFiles() {
  for (const sub of ["workflows", "mission", "targets"]) {
    const walk = (dir, prefix) => readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => e.isDirectory() ? walk(join(dir, e.name), `${prefix}/${e.name}`)
        : e.name.endsWith(".md") ? [[`templates/${sub}${prefix}/${e.name}`, join(dir, e.name)]] : []);
    yield* walk(join(ROOT, "templates", sub), "");
  }
}

function citationsIn(text) {
  const cites = new Set();
  for (const m of text.matchAll(/`((?:npx )?runward [^`]*)`/g)) cites.add(m[1]);
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (!fenced) continue;
    const m = line.match(/^\s*\$?\s*((?:npx )?runward\s+\S.*)$/);
    if (m) cites.add(m[1].trim());
  }
  return cites;
}

/** The stale citations in one text, against the inventory. Placeholders (`<cmd>`, `[flag]`) are
 *  documentation of a SHAPE, never a citation of a name, and are skipped where they appear. */
function staleIn(text, inv) {
  const stale = [];
  for (const cite of citationsIn(text)) {
    const tokens = cite.replace(/^npx /, "").split(/\s+/).slice(1);
    let i = 0;
    while (i < tokens.length && tokens[i].startsWith("-")) i++; // global flags before the subcommand
    if (i >= tokens.length) continue;                            // `runward --version` style: global only
    const cmd = tokens[i];
    if (cmd.includes("<") || cmd.startsWith("[")) continue;
    if (!inv.has(cmd)) { stale.push(`\`${cite}\` — unknown subcommand "${cmd}"`); continue; }
    for (const t of tokens.slice(i + 1)) {
      if (!t.startsWith("--") || t.includes("<") || t.includes("[")) continue;
      const flag = t.split("=")[0].replace(/[.,;:)`]+$/, "");
      if (!inv.get(cmd).has(flag) && !inv.get("__global__").has(flag)) {
        stale.push(`\`${cite}\` — "${flag}" is not a flag of \`runward ${cmd}\``);
      }
    }
  }
  return stale;
}

test("the inventory reader sees the CLI it must see", () => {
  const inv = cliInventory();
  // A floor, not a pin: the exact command list has its own owners (smoke, --help). What this
  // guards is the READER — a parse that returns two commands would wave every citation through.
  assert.ok(inv.size >= 13, `only ${inv.size - 1} subcommands parsed from src/cli.ts — the reader went blind`);
  assert.ok(inv.get("check").has("--strict"), "check --strict must be in the inventory");
  assert.ok(inv.get("__global__").has("--yes"), "global flags must be collected too");
});

test("the extractor catches what it exists to catch (positive control)", () => {
  const inv = cliInventory();
  const stale = staleIn(
    "Run `runward check --nonexistent-flag` then `runward polish --all`.\n```\n$ runward check --also-fake\n```\n",
    inv,
  );
  assert.equal(stale.length, 3,
    `the control text carries exactly three fabrications and the extractor saw ${stale.length} — ` +
    "a sweep this blind would report every template clean");
});

test("every runward citation in templates/ names a subcommand and flags the CLI actually has", () => {
  const inv = cliInventory();
  const all = [];
  let cited = 0;
  for (const [rel, abs] of templateFiles()) {
    const text = readFileSync(abs, "utf8");
    cited += citationsIn(text).size;
    for (const s of staleIn(text, inv)) all.push(`${rel}: ${s}`);
  }
  assert.ok(cited >= 20,
    `only ${cited} citations extracted across all templates — the extraction floor is 20 ` +
    "(26 measured on 2026-09-02); a lower count means the extractor stopped seeing, not that templates stopped citing");
  assert.deepEqual(all, [],
    "a template cites a command or flag this CLI does not have — the scaffold is teaching a gesture that no longer answers:\n  " + all.join("\n  "));
});
