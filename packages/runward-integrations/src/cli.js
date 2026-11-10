#!/usr/bin/env node
// runward-integrations (runward ADR-0122): the recipes' step, their controls and their count.
//
//   runward-integrations regenerate --recipe <id> --report <path> --command <json argv> [--cwd <dir>]
//                                   [--github-output <file>] [--summary <file>]
//       The step every forge runs: the project's command writes its report to {raw}, outside the tree; the
//       recipe normalises it and replaces <cwd>/<path>. Exit 0 written and the tool green, 1 written and the
//       tool red (or a coverage report that measured nothing), 2 a usage error, 3 refused: the command wrote
//       no report of the recipe's format, and the cited report was removed.
//   runward-integrations fixture --out <dir> [--runward <cli.js>] [--lockfile <path>]
//       The shipped example as the controls build it: init --example by that runward, with its lockfile.
//   runward-integrations sabotage --recipe <id> --tree <dir>
//       Plants a recipe's sabotage in a tree (the CI job of runward's repository uses it on the GitHub steps).
//   runward-integrations control [--recipe <id> ...] [--runward <cli.js>] [--lockfile <path>] [--json <file>]
//                                [--work <dir>] [--keep] [--record]
//       Runs the controls for real. Exit 0 every control passed, 1 one failed, 2 the laboratory could not be
//       built. --record writes the date and runward version into each passing recipe's manifest.
//   runward-integrations count --check [--results <file>] | --write | --json
//       The count in every text that carries it (ADR-0122 decision 3).
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { regenerate, RegenerateError, RECIPES } from "./regenerate.js";
import { readManifests, manifestPath } from "./manifest.js";
import { plant } from "./sabotages.js";
import { buildFixture, defaultLockfile, defaultRunward, recordPassing, runControls } from "./control.js";
import { checkCount, countData, REPO_ROOT, writeCount } from "./count.js";

const argv = process.argv.slice(2);
const cmd = argv.shift();
const flag = (name) => argv.includes(name);
const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
const opts = (name) => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []));
const fail = (code, message) => { console.error(`runward-integrations: ${message}`); process.exit(code); };
const treeVersion = () => JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).version;

if (cmd === "regenerate") {
  const recipe = opt("--recipe");
  const report = opt("--report");
  const command = opt("--command");
  if (!recipe || !report || !command) fail(2, `usage: regenerate --recipe <${RECIPES.join("|")}> --report <path> --command <json argv> [--cwd <dir>]`);
  try {
    const r = regenerate({ recipe, cwd: opt("--cwd") ?? ".", report, command });
    console.log(r.message);
    if (opt("--github-output")) appendFileSync(opt("--github-output"), `tool-exit=${r.toolExit}\nreport=${report}\n`);
    if (opt("--summary")) appendFileSync(opt("--summary"), `- ${r.message}\n`);
    process.exit(r.exit);
  } catch (e) {
    if (!(e instanceof RegenerateError)) throw e;
    if (opt("--summary")) appendFileSync(opt("--summary"), `- runward-integrations ${recipe}: ${e.message}\n`);
    fail(e.kind === "usage" ? 2 : 3, e.message);
  }
} else if (cmd === "fixture") {
  const out = opt("--out");
  if (!out) fail(2, "usage: fixture --out <dir> [--runward <cli.js>] [--lockfile <path>]");
  const runward = resolve(opt("--runward") ?? defaultRunward() ?? fail(2, "no runward: pass --runward <cli.js>"));
  const lockfile = opt("--lockfile") ?? defaultLockfile(runward) ?? fail(2, "no lockfile for the example: pass --lockfile");
  buildFixture({ runward, lockfile, out: resolve(out) });
  console.log(`runward-integrations: the shipped example, with its lockfile, in ${out}`);
} else if (cmd === "sabotage") {
  const recipe = opt("--recipe");
  const tree = opt("--tree");
  if (!recipe || !tree) fail(2, "usage: sabotage --recipe <id> --tree <dir>");
  try {
    const s = plant(recipe, resolve(tree));
    const m = readManifests().find((x) => x.id === recipe);
    console.log(`runward-integrations: planted ${s.id} in ${tree}${m ? `: ${m.control.sabotage.summary}` : ""}`);
  } catch (e) { fail(2, e.message); }
} else if (cmd === "control") {
  let results;
  try {
    results = runControls({
      runward: opt("--runward") ?? defaultRunward(), lockfile: opt("--lockfile"),
      recipes: opts("--recipe").length ? opts("--recipe") : undefined,
      work: opt("--work"), keep: flag("--keep"), log: (l) => console.log(l),
    });
  } catch (e) { fail(2, e.message); }
  if (opt("--json")) writeFileSync(opt("--json"), `${JSON.stringify(results, null, 2)}\n`);
  for (const r of results.recipes) console.log(`${r.passed ? "passed" : "FAILED"}  ${r.id}${r.passed ? "" : `: ${r.reason}`}`);
  if (flag("--record")) {
    const written = recordPassing(results, { manifestPath });
    console.log(`recorded ${results.date}, runward ${results.runward}, in ${written.length ? written.join(", ") : "no manifest"}`);
  }
  process.exit(results.recipes.every((r) => r.passed) ? 0 : 1);
} else if (cmd === "count") {
  const manifests = readManifests();
  const version = opt("--runward-version") ?? treeVersion();
  if (flag("--json")) { console.log(JSON.stringify(countData(manifests, version), null, 2)); process.exit(0); }
  if (flag("--write")) {
    const changed = writeCount({ manifests, version });
    console.log(changed.length ? `rewrote the count in ${changed.join(", ")}` : "every count block is already the rendering");
    process.exit(0);
  }
  if (!flag("--check")) fail(2, "usage: count --check [--results <file>] | --write | --json");
  const results = opt("--results") ? JSON.parse(readFileSync(opt("--results"), "utf8")) : null;
  const problems = checkCount({ manifests, version, results });
  if (problems.length === 0) {
    const d = countData(manifests, version);
    console.log(`runward-integrations: every text counts ${d.counted.length} recipe(s) (${d.counted.map((c) => c.id).join(", ") || "none"}), as the manifests${results ? " and this run's controls" : ""} hold on runward ${version}`);
    process.exit(0);
  }
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
} else {
  fail(2, "usage: runward-integrations <regenerate|fixture|sabotage|control|count> …");
}
