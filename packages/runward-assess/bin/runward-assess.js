#!/usr/bin/env node
// runward-assess: the repeatable assessment grid (grille@1).
//
//   snapshot   the only command that reads the network: writes a snapshot directory and its manifest
//   measure    one commit, offline, under a sandbox that denies the network
//   score      the canonical record (JSON), its Markdown and HTML reports; a pure function of its inputs
//   diff       the evolution between records
//   selftest   the same inputs scored under two time zones, two locales and two runtimes: same bytes
//   grid       the grid's structural check
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import net from "node:net";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = join(HERE, "runward-assess.js");
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const flag = (k) => argv.includes(k);
const die = (msg, code = 2) => { process.stderr.write(`runward-assess: ${msg}\n`); process.exit(code); };
const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeOut = (p, text) => { mkdirSync(dirname(resolve(p)), { recursive: true }); writeFileSync(p, text); };

const USAGE = `runward-assess 0.1.0, the repeatable assessment grid (grille@1)

  runward-assess snapshot --repo <git-dir> --slug <owner/name> --profile <file> [--commit <rev>] [--since <rev>] --out <dir> [--no-gate]
  runward-assess measure  --repo <git-dir> --slug <owner/name> --profile <file> [--commit <rev>] [--since <rev>] [--snapshot <dir>] [--alt-node <node>] --out <file>
  runward-assess score    --measure <file> --profile <file> [--snapshot <dir>] [--previous <record>] [--label <text>] [--trigger <t>] --out <record.json> [--md <file>] [--html <file>]
  runward-assess diff     --out <file.md> [--json <file>] [--html <file>] <label>=<record.json> ...
  runward-assess selftest --measure <file> --profile <file> [--snapshot <dir>] [--previous <record>] [--label <text>] [--trigger <t>] [--alt-node <node>]
  runward-assess grid     [--check]

snapshot is the only command that reads the network. measure refuses to run when the network is
reachable (it re-runs itself under sandbox-exec on macOS, unshare on Linux). score reads no clock,
no environment and no network: the same inputs give the same bytes anywhere.`;

if (!cmd || cmd === "--help" || cmd === "-h") { process.stdout.write(USAGE + "\n"); process.exit(cmd ? 0 : 2); }
if (cmd === "--version") { process.stdout.write("0.1.0\n"); process.exit(0); }

const { loadGrid, gridProblems } = await import("../src/grid.js");
const G = loadGrid();
const gridBundle = { grid: G.grid, catalogue: G.catalogue, data: G.data, digests: G.digests };

function loadProfile(p) {
  if (!p) die("--profile is required");
  const prof = readJSON(p);
  if (prof.schema !== "runward-assess-profile/1") die(`${p} is not a runward-assess profile (schema runward-assess-profile/1)`);
  return prof;
}

async function probeNetwork() {
  return new Promise((res) => {
    const s = net.connect({ host: "1.1.1.1", port: 443 });
    const done = (v) => { s.destroy(); res(v); };
    s.setTimeout(3000, () => done("timeout"));
    s.on("connect", () => done("connected"));
    s.on("error", (e) => done(e.code || "error"));
  });
}

switch (cmd) {
  case "grid": {
    const problems = gridProblems(G);
    if (problems.length) { process.stderr.write(problems.map((p) => `✗ ${p}`).join("\n") + "\n"); process.exit(1); }
    process.stdout.write(`${G.grid.grid}: ${G.grid.criteria.length} criteria on ${G.grid.axes.length} axes, digest ${G.digests.grid}\n`);
    break;
  }

  case "snapshot": {
    const { snapshot } = await import("../src/snapshot.js");
    const { realTransport } = await import("../src/transport.js");
    const repo = opt("--repo"), slug = opt("--slug"), out = opt("--out");
    if (!repo || !slug || !out) die("snapshot needs --repo, --slug and --out");
    const profile = loadProfile(opt("--profile"));
    const t = realTransport();
    const { digestOf } = await import("../src/grid-model.js");
    const r = await snapshot({ profileDigest: digestOf(profile), repo, rev: opt("--commit") ?? "HEAD", slug, profile, since: opt("--since"), out, transport: t,
      lexicon: G.data.lexicon, osvControl: G.data.osvControl, bots: G.data.bots, tables: G.grid.tables, acquire: !flag("--no-gate"), gridId: G.grid.grid, gridDigest: G.digests.grid, gridData: G.digests.gridData });
    process.stdout.write(`snapshot ${slug}@${r.manifest.subject.commit.slice(0, 12)} as of ${r.manifest.asOf}: ${r.manifest.entries.length} files, ${r.manifest.unavailable.length} fact(s) not observed, gate ${r.manifest.gate?.version ?? r.manifest.gate?.why ?? "none"}, digest ${r.digest}\n`);
    break;
  }

  case "measure": {
    // The network must be unreachable. On macOS, re-run under sandbox-exec; on Linux, under unshare.
    if (!process.env.RUNWARD_ASSESS_SANDBOXED && !flag("--allow-network")) {
      let wrap = null;
      if (process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec")) wrap = ["/usr/bin/sandbox-exec", "-p", "(version 1)(allow default)(deny network*)", process.execPath, SELF, ...argv];
      else if (process.platform === "linux") {
        const probe = spawnSync("unshare", ["--net", "--map-root-user", "true"]);
        if (probe.status === 0) wrap = ["unshare", "--net", "--map-root-user", process.execPath, SELF, ...argv];
      }
      if (!wrap) die("no network sandbox is available here (sandbox-exec, unshare --net): measure refuses to run with the network reachable; --allow-network runs it anyway and records it");
      const r = spawnSync(wrap[0], wrap.slice(1), { stdio: "inherit", env: { ...process.env, RUNWARD_ASSESS_SANDBOXED: "1" } });
      process.exit(r.status ?? 2);
    }
    const state = await probeNetwork();
    const network = state === "connected" ? "reachable" : `blocked (${state})`;
    if (network === "reachable" && !flag("--allow-network")) die("the network is reachable inside the sandbox: refused");
    const { measure, measureText } = await import("../src/measure.js");
    const repo = opt("--repo"), slug = opt("--slug"), out = opt("--out");
    if (!repo || !slug || !out) die("measure needs --repo, --slug and --out");
    const profile = loadProfile(opt("--profile"));
    const m = measure({ repo, rev: opt("--commit") ?? "HEAD", slug, profile, since: opt("--since"), snapshotDir: opt("--snapshot"), altNode: opt("--alt-node"), grid: G, network });
    const { digestOf } = await import("../src/grid-model.js");
    m.profileDigest = digestOf(profile);
    const text = measureText(m);
    writeOut(out, text);
    const { sha256 } = await import("../src/canon.js");
    process.stdout.write(`measured ${slug}@${m.subject.commit.slice(0, 12)} (${m.inventory.files} files) network=${network} facts=${digestOf(m.facts).slice(0, 16)} sha256=${sha256(text)}\n`);
    break;
  }

  case "score": {
    const { score, recordText, CoverageError, InputError } = await import("../src/score.js");
    const { readSnapshot } = await import("../src/snapshot.js");
    const { reportMarkdown } = await import("../src/report-md.js");
    const { reportHtml } = await import("../src/report-html.js");
    const { digestOf } = await import("../src/grid-model.js");
    const mp = opt("--measure"), out = opt("--out");
    if (!mp || !out) die("score needs --measure and --out");
    const measureObj = readJSON(mp);
    const profile = loadProfile(opt("--profile"));
    if (measureObj.profileDigest && measureObj.profileDigest !== digestOf(profile)) die("the profile given is not the one the measure was taken with");
    let snap = null;
    if (opt("--snapshot")) { try { snap = readSnapshot(opt("--snapshot")); } catch (e) { die(e.message); } }
    if (snap?.manifest.profileDigest && snap.manifest.profileDigest !== digestOf(profile)) die("the profile given is not the one the snapshot was taken with");
    const previous = opt("--previous") ? readJSON(opt("--previous")) : null;
    let record;
    try { record = score({ ...gridBundle, measure: measureObj, snapshot: snap, profile, previous, trigger: opt("--trigger") ?? "manual", label: opt("--label") }); }
    catch (e) { if (e instanceof CoverageError) die(e.message, 3); if (e instanceof InputError) die(e.message, 2); throw e; }
    const text = recordText(record);
    writeOut(out, text);
    if (opt("--md")) writeOut(opt("--md"), reportMarkdown(record, G.grid));
    if (opt("--html")) writeOut(opt("--html"), reportHtml(record, G.grid));
    const face = record.face.axes.map((a) => `${a.axis} ${a.tier}`).join(" · ");
    process.stdout.write(`record ${record.subject.repo}@${record.subject.commit.slice(0, 12)}: ${face} · digest ${record.digest}\n`);
    break;
  }

  case "diff": {
    const { evolution, evolutionMarkdown, evolutionHtml } = await import("../src/diff.js");
    const { canonJSON } = await import("../src/canon.js");
    const out = opt("--out");
    if (!out) die("diff needs --out");
    const skip = new Set(["--out", "--json", "--html"].map((k) => opt(k)));
    const pairs = argv.slice(1).filter((a, i, all) => a.includes("=") && !a.startsWith("--") && !["--out", "--json", "--html"].includes(all[i - 1]) && !skip.has(a));
    if (pairs.length < 2) die("diff needs at least two <label>=<record.json>");
    const records = pairs.map((a) => ({ label: a.slice(0, a.indexOf("=")), record: readJSON(a.slice(a.indexOf("=") + 1)) }));
    const ev = evolution(records, G.grid);
    writeOut(out, evolutionMarkdown(ev, G.grid));
    if (opt("--json")) writeOut(opt("--json"), canonJSON(ev));
    if (opt("--html")) writeOut(opt("--html"), evolutionHtml(ev, G.grid));
    process.stdout.write(`evolution of ${records.length} records: ${ev.transitions.length} criterion transition(s), ${ev.axisChanges.length} axis change(s)\n`);
    break;
  }

  case "selftest": {
    // The same inputs, scored by child processes under other zones, locales and runtimes.
    const mp = opt("--measure"), pp = opt("--profile");
    if (!mp || !pp) die("selftest needs --measure and --profile");
    const alt = opt("--alt-node");
    const runs = [
      { id: "node-a/UTC/C", node: process.execPath, env: { TZ: "UTC", LC_ALL: "C", LANG: "C" } },
      { id: "node-a/Pacific-Kiritimati/fr_FR", node: process.execPath, env: { TZ: "Pacific/Kiritimati", LC_ALL: "fr_FR.UTF-8", LANG: "fr_FR.UTF-8" } },
    ];
    if (alt) runs.push({ id: "node-b/America-St_Johns/de_DE", node: alt, env: { TZ: "America/St_Johns", LC_ALL: "de_DE.UTF-8", LANG: "de_DE.UTF-8" } }, { id: "node-b/UTC/C", node: alt, env: { TZ: "UTC", LC_ALL: "C", LANG: "C" } });
    const { createHash } = await import("node:crypto");
    const h = (b) => createHash("sha256").update(b).digest("hex");
    const work = mkdtempSync(join(tmpdir(), "runward-assess-selftest-"));
    const rows = [];
    try {
      for (const r of runs) {
        const dir = join(work, r.id.replace(/[^A-Za-z0-9]+/g, "-"));
        mkdirSync(dir, { recursive: true });
        const args = [SELF, "score", "--measure", mp, "--profile", pp, "--out", join(dir, "record.json"), "--md", join(dir, "report.md"), "--html", join(dir, "report.html"), "--label", opt("--label") ?? "selftest"];
        if (opt("--snapshot")) args.push("--snapshot", opt("--snapshot"));
        if (opt("--previous")) args.push("--previous", opt("--previous"));
        if (opt("--trigger")) args.push("--trigger", opt("--trigger"));
        const p = spawnSync(r.node, args, { encoding: "utf8", env: { PATH: process.env.PATH ?? "/usr/bin:/bin", ...r.env } });
        if (p.status !== 0) die(`selftest run ${r.id} failed: ${(p.stderr || p.stdout).trim()}`, 1);
        const version = spawnSync(r.node, ["--version"], { encoding: "utf8" }).stdout.trim();
        rows.push({ id: r.id, node: version, record: h(readFileSync(join(dir, "record.json"))), md: h(readFileSync(join(dir, "report.md"))), html: h(readFileSync(join(dir, "report.html"))) });
      }
    } finally { rmSync(work, { recursive: true, force: true }); }
    for (const r of rows) process.stdout.write(`${r.id.padEnd(34)} ${r.node.padEnd(9)} record ${r.record}  md ${r.md.slice(0, 16)}  html ${r.html.slice(0, 16)}\n`);
    const { sameOutputs } = await import("../src/selftest.js");
    const same = sameOutputs(rows);
    const runtimes = new Set(rows.map((r) => r.node)).size;
    process.stdout.write(same ? `✓ ${rows.length} runs, ${runtimes} runtime(s), byte-identical record, Markdown and HTML\n` : "✗ the outputs differ: the score is not deterministic\n");
    process.exit(same ? 0 : 1);
  }

  default:
    die(`unknown command ${cmd}\n\n${USAGE}`);
}
