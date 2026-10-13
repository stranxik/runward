#!/usr/bin/env node
// The documented-commands guard (ADR-0090, M6): the commands of docs/verifying-a-release.md, read
// from the document itself and executed against a published release.
//
//   node scripts/documented-commands.mjs run --tag <vX.Y.Z> [--repo stranxik/runward] [--work <dir>]
//                                            [--guide <copy of the guide>] [--only 3,8]
//
// with RUNWARD_OFFLINE_WRAPPER set to a JSON array that runs a command with the network cut, for
// instance '["sudo","unshare","-n"]' on a Linux runner. Without it the run refuses: an offline step
// executed online would pass for the wrong reason.
//
// WHY THIS EXISTS. ADR-0090 measured that no control executed the guide's commands at pull-request
// time: `verify-release.yml` runs COPIES of them, after a release. The first sample period's seed was a
// false sentence in Step 3 (the trusted root "not needed offline"), and nothing in the machine net
// could have refused it. This module gives the guide two machine readers:
//
//   1. a parser, shared with the unit test `test/unit/documented-commands.test.js`, which holds the
//      guide's command blocks and the workflow's commands in parity (no network);
//   2. this runner, which extracts each executed step's block from the guide, substitutes the
//      version, runs it (the bundle-based verifications with the network cut), and runs a positive
//      control for each: a tampered asset must fail.
//
// WHAT IT DOES NOT DO. It judges commands, never prose. A sentence that changes and leaves every
// command intact passes here; the unit test adds one narrow prose check (the "N files suffice: ..."
// claims against the files the offline command names), and nothing more. See ADR-0090 decision 5.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const GUIDE = "docs/verifying-a-release.md";
export const REPO = "stranxik/runward";

// The declared normalisation. The guide writes its commands for example releases; these are the
// placeholders a reader substitutes ("Substitute the version you are verifying for 0.33.3
// throughout"). Any other version-like token left in a command after substitution is an error, so a
// new example version must be declared here before it can pass.
export const EXAMPLE_VERSIONS = ["0.33.3", "0.33.4", "0.33.5", "X.Y.Z"];

// Every step of the guide is classified: executed by the runner, or not, with the reason. A step the
// guide gains is refused until it is classified here (the unit test checks it, and so does `run`).
export const EXECUTED = ["0", "2", "2c", "3", "7", "8"];
export const NOT_EXECUTED = {
  "1": "`npm audit signatures` reads a project's whole dependency tree; its expected counts describe that tree, not runward",
  "4": "needs cosign, which the runner does not carry and this repository pins no installer for",
  "5": "prints the registry's JSON; it has no pass or fail to check",
  "6": "its input is a CI artifact of the release's ratchet run, kept 90 days, not a release asset",
};
// The steps whose verification the guide says works offline. Each must yield at least one command
// the runner executes with the network cut (a command carrying `--bundle`).
export const OFFLINE_STEPS = ["3", "8"];
// The programs an executed block may call. A block calling anything else is refused before it runs:
// the runner executes what the guide says, and the guide's commands are these.
const PROGRAMS = new Set(["gh", "curl", "shasum"]);

// ── parsing ─────────────────────────────────────────────────────────────────────────────────────
/** Split the guide into `## Step <id> — <title>` sections, each with its prose and its `sh` blocks. */
export function parseGuide(text) {
  const steps = [];
  let cur = null;
  let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const f = line.match(/^```(\w*)\s*$/);
    if (f) {
      if (!fence) fence = { lang: f[1], lines: [] };
      else {
        if (cur && fence.lang === "sh") cur.blocks.push(commandsOfBlock(fence.lines));
        fence = null;
      }
      continue;
    }
    if (fence) { fence.lines.push(line); continue; }
    const h = line.match(/^## Step (\w+) — (.*)$/);
    if (h) { cur = { id: h[1], title: h[2], prose: [], blocks: [] }; steps.push(cur); continue; }
    if (/^## /.test(line)) { cur = null; continue; }
    if (cur) cur.prose.push(line);
  }
  if (fence) throw new Error(`${GUIDE}: unterminated code fence`);
  return steps;
}

/** One shell block to commands: continuations joined, full-line comments dropped, trailing comments kept apart. */
export function commandsOfBlock(lines) {
  const out = [];
  let buf = "";
  for (const raw of lines) {
    if (buf === "" && /^\s*#/.test(raw)) continue;
    const cont = /\\\s*$/.test(raw);
    buf += (buf ? " " : "") + raw.replace(/\\\s*$/, "").trim();
    if (!cont) { if (buf.trim()) out.push(splitComment(buf)); buf = ""; }
  }
  if (buf.trim()) out.push(splitComment(buf));
  return out;
}

function splitComment(s) {
  const i = s.search(/\s#\s/);
  return i < 0 ? { text: s.trim(), comment: "" } : { text: s.slice(0, i).trim(), comment: s.slice(i).replace(/^\s*#\s*/, "").trim() };
}

/** The guide's command for a given version: placeholders substituted, whitespace collapsed. */
export function forVersion(text, version) {
  let t = text.replace(/\bvX\.Y\.Z\b/g, `v${version}`);
  for (const ex of EXAMPLE_VERSIONS) t = t.split(ex).join(version);
  return t.replace(/\s+/g, " ").trim();
}

/** Shell-ish tokens: whitespace split, surrounding quotes removed (the guide's commands quote nothing else). */
export function tokens(text) {
  return text.trim().split(/\s+/).map((t) => t.replace(/^["']|["']$/g, ""));
}

/**
 * The form two commands are compared in: the positional words in order, then the flags as sorted
 * `--flag value` pairs. Flag order is not content; a dropped flag, a changed value or a changed
 * subject is.
 */
export function canonical(text) {
  const t = tokens(text);
  const pos = [];
  const flags = [];
  for (let i = 0; i < t.length; i++) {
    if (!t[i].startsWith("--")) { pos.push(t[i]); continue; }
    if (t[i + 1] !== undefined && !t[i + 1].startsWith("-")) { flags.push(`${t[i]} ${t[i + 1]}`); i++; }
    else flags.push(t[i]);
  }
  return [pos.join(" "), ...flags.sort()].join(" | ");
}

/** The guide's steps, read from the repository. */
export function readGuide(path = join(ROOT, GUIDE)) {
  return parseGuide(readFileSync(path, "utf8"));
}

/** Every step is classified exactly once; returns the problems found, empty when none. */
export function classificationProblems(steps) {
  const ids = steps.map((s) => s.id);
  const known = new Set([...EXECUTED, ...Object.keys(NOT_EXECUTED)]);
  const problems = [];
  for (const id of ids) if (!known.has(id)) problems.push(`Step ${id} is in the guide but neither executed nor declared not executed`);
  for (const id of known) if (!ids.includes(id)) problems.push(`Step ${id} is classified but the guide has no such step`);
  for (const id of EXECUTED) if (NOT_EXECUTED[id]) problems.push(`Step ${id} is declared both executed and not executed`);
  return problems;
}

/** The commands the runner will execute for one step, at one version, each marked online or offline. */
export function executablePlan(step, version) {
  const cmds = step.blocks.flat().map((c) => {
    const text = forVersion(c.text, version);
    const left = text.match(/\b\d+\.\d+\.\d+\b/g)?.filter((v) => v !== version) ?? [];
    if (left.length) throw new Error(`Step ${step.id}: undeclared example version ${left[0]} in \`${text}\` (declare it in EXAMPLE_VERSIONS)`);
    const program = tokens(text)[0];
    if (!PROGRAMS.has(program)) throw new Error(`Step ${step.id}: \`${program}\` is not a program the runner executes (${[...PROGRAMS].join(", ")})`);
    const offline = /(^|\s)--bundle\s/.test(text);
    const fetch = program === "curl" || /^gh attestation trusted-root\b/.test(text);
    return { text, offline, fetch };
  });
  if (OFFLINE_STEPS.includes(step.id) && !cmds.some((c) => c.offline)) {
    throw new Error(`Step ${step.id} says its verification works offline, and no command of it carries --bundle`);
  }
  return cmds;
}

// ── the runner ──────────────────────────────────────────────────────────────────────────────────
function sh(cmd, cwd, { offline = false, wrapper = null, env = process.env } = {}) {
  const argv = offline ? [...wrapper, "bash", "-c", cmd] : ["bash", "-c", cmd];
  const r = spawnSync(argv[0], argv.slice(1), { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function tamper(file) {
  const b = readFileSync(file);
  b[100] = b[100] ^ 0xff;
  writeFileSync(file, b);
}

async function run(argv) {
  const arg = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
  const tag = arg("--tag");
  const repo = arg("--repo", REPO);
  if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) { console.error("usage: run --tag vX.Y.Z [--repo owner/name] [--work dir]"); return 2; }
  const version = tag.slice(1);
  let wrapper;
  try { wrapper = JSON.parse(process.env.RUNWARD_OFFLINE_WRAPPER ?? "null"); } catch { wrapper = null; }
  if (!Array.isArray(wrapper) || wrapper.length === 0) {
    console.error("RUNWARD_OFFLINE_WRAPPER must be a JSON array that runs a command with the network cut; refusing to run the offline steps online");
    return 2;
  }
  const work = arg("--work") ?? mkdtempSync(join(tmpdir(), "rw-documented-"));
  const results = [];
  const record = (step, what, ok, detail = "") => {
    results.push({ step, what, ok, detail });
    console.log(`${ok ? "ok  " : "FAIL"} Step ${step} — ${what}${detail ? `\n       ${detail.split("\n").slice(-3).join("\n       ")}` : ""}`);
  };

  // --guide reads another copy of the guide (to replay a planted seed); --only restricts the executed
  // steps (the classification is still checked on the whole guide).
  const steps = readGuide(arg("--guide") ? resolve(arg("--guide")) : undefined);
  const only = arg("--only")?.split(",");
  const problems = classificationProblems(steps);
  if (problems.length) { for (const p of problems) console.error(p); return 1; }

  // The cut itself, controlled both ways: the same request answers online and fails inside the wrapper.
  const probe = "curl -sS --max-time 10 -o /dev/null https://api.github.com";
  const online = sh(probe, ROOT);
  const cut = sh(probe, ROOT, { offline: true, wrapper });
  record("-", "the network answers outside the wrapper", online.code === 0, online.code ? online.out : "");
  record("-", "the network is cut inside the wrapper", cut.code !== 0, cut.code === 0 ? "the probe reached api.github.com" : "");
  if (online.code !== 0 || cut.code === 0) return 1;

  const genuine = join(work, "genuine");
  rmSync(genuine, { recursive: true, force: true });
  mkdirSync(genuine, { recursive: true });
  const dl = sh(`gh release download ${tag} --repo ${repo} --dir .`, genuine);
  record("-", `download the assets of ${tag}`, dl.code === 0, dl.code ? dl.out : readdirSync(genuine).join(" "));
  if (dl.code !== 0) return 1;

  const plans = new Map();
  for (const id of EXECUTED.filter((id) => !only || only.includes(id))) {
    const step = steps.find((s) => s.id === id);
    try { plans.set(id, executablePlan(step, version)); } catch (e) { record(id, "extract the commands", false, e.message); }
  }

  // 1. The guide's commands, as written, on the published release.
  for (const [id, plan] of plans) {
    for (const c of plan) {
      const r = sh(c.text, genuine, { offline: c.offline, wrapper });
      record(id, `${c.offline ? "[network cut] " : ""}${c.text}`, r.code === 0, r.code ? r.out : "");
    }
    if (id === "0") {
      const digests = sh(plan.at(-1).text, genuine).out.trim().split("\n").map((l) => l.split(/\s+/)[0]);
      record(id, "both lines print the same digest", digests.length === 2 && digests[0] === digests[1], digests.join(" vs "));
    }
  }

  // 2. Positive controls: the same commands against a tampered asset must fail. Fetching commands are
  //    not re-run (they would overwrite the tampered copy); their output is reused from the genuine run.
  const target = (id) => (id === "8" ? `runward-qualification-kit-${version}.tgz` : `runward-${version}.tgz`);
  for (const [id, plan] of plans) {
    const dir = join(work, `tampered-${id}`);
    rmSync(dir, { recursive: true, force: true });
    cpSync(genuine, dir, { recursive: true });
    tamper(join(dir, target(id)));
    if (id === "0") {
      const digests = sh(plan.at(-1).text, dir).out.trim().split("\n").map((l) => l.split(/\s+/)[0]);
      record(id, `control: a tampered ${target(id)} prints a different digest`, digests.length === 2 && digests[0] !== digests[1]);
      continue;
    }
    for (const c of plan.filter((c) => !c.fetch)) {
      if (!tokens(c.text).includes(target(id))) { console.log(`     Step ${id} — not controlled by tampering (names no asset): ${c.text}`); continue; }
      const r = sh(c.text, dir, { offline: c.offline, wrapper });
      record(id, `control: tampered ${target(id)} refused by ${c.offline ? "[network cut] " : ""}${c.text}`, r.code !== 0, r.code === 0 ? "exit 0 on a tampered asset" : "");
    }
  }

  // 3. The seed's class, executed: Step 3 without the trusted root, network cut, must fail.
  for (const c of plans.get("3")?.filter((c) => c.offline) ?? []) {
    const without = c.text.replace(/\s--custom-trusted-root\s+\S+/, "");
    const r = sh(without, genuine, { offline: true, wrapper });
    record("3", `control: without --custom-trusted-root the offline verification fails: ${without}`, r.code !== 0, r.code === 0 ? "exit 0 offline with no trusted root" : "");
  }

  // 4. Step 7 on a release the guide says is mutable (v0.42.3, "No attestations for tag").
  for (const c of plans.get("7")?.filter((c) => /^gh release verify\s/.test(c.text)) ?? []) {
    const mutable = c.text.replace(tag, "v0.42.3");
    const r = sh(mutable, genuine);
    record("7", `control: a mutable release has no release attestation: ${mutable}`, r.code !== 0, r.code === 0 ? "exit 0 on v0.42.3" : "");
  }

  // 5. Step 8's runner, the way its prose says ("node runward-qualification-kit-X.Y.Z/run.mjs
  //    --package <your installed runward>"); this command shape is written here, not extracted.
  if (plans.has("8")) {
    const kitDir = join(work, "kit");
    rmSync(kitDir, { recursive: true, force: true });
    mkdirSync(join(kitDir, "consumer"), { recursive: true });
    const setup = sh(`tar -xzf ../genuine/runward-qualification-kit-${version}.tgz && cd consumer && npm init -y >/dev/null && npm install --ignore-scripts --no-audit --no-fund ../../genuine/runward-${version}.tgz`, kitDir);
    record("8", "extract the kit and install the release tarball", setup.code === 0, setup.code ? setup.out : "");
    if (setup.code === 0) {
      const runner = `node runward-qualification-kit-${version}/run.mjs --package consumer/node_modules/runward`;
      const r = sh(`${runner} --out report`, kitDir);
      record("8", `${runner} exits 0`, r.code === 0, r.code ? r.out : "");
      tamper(join(kitDir, "consumer", "node_modules", "runward", "dist", "cli.js"));
      const t = sh(`${runner} --out report-tampered`, kitDir);
      record("8", "control: one changed installed byte, the runner exits 3 and reports no test", t.code === 3, `exit ${t.code}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  for (const [id, why] of Object.entries(NOT_EXECUTED)) console.log(`     Step ${id} — not executed: ${why}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = results.map((r) => `| ${r.step} | ${r.ok ? "ok" : "**FAIL**"} | \`${r.what.replace(/\|/g, "\\|")}\` |`);
    const skipped = Object.entries(NOT_EXECUTED).map(([id, why]) => `| ${id} | not executed | ${why} |`);
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, [`### Documented commands, executed against ${tag}`, "", "| Step | Result | Command or control |", "|---|---|---|", ...rows, ...skipped, ""].join("\n"), { flag: "a" });
  }
  console.log(`\n${results.length - failed.length}/${results.length} expectations held against ${tag}${failed.length ? `; ${failed.length} did not` : ""}`);
  return failed.length ? 1 : 0;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd !== "run") { console.error("usage: node scripts/documented-commands.mjs run --tag vX.Y.Z"); process.exitCode = 2; }
  else process.exitCode = await run(rest);
}
