#!/usr/bin/env node
/**
 * measure-analyzers.mjs: collects the findings of runward's built-in analyzers (ADR-0118) on real
 * repositories that runward did not write, for ADR-0117 "What would settle it", criterion 2.
 *
 * COLLECTION ONLY. It classifies nothing and fixes nothing. A separate reviewer, who wrote neither the
 * analyzers nor this harness, classifies each finding true or false; the subject of the measurement is
 * runward's reading and its false reds, never the measured projects.
 *
 * Published with its classification (ADR-0117 asks for both): docs/compliance/analyzers-on-real-repositories.md
 * names the repositories, the commands, the method and the reviewers' files. The repositories and their
 * commits are scripts/measure-analyzers.repos.json.
 *
 * WHAT IT DOES, for each repository of measure-analyzers.repos.json, pinned at a commit SHA:
 *   1. fetches that commit once (git, depth 1) into <work>/src/<name>, or reuses a pristine clone there;
 *   2. for each profile, copies it to <work>/run-<label>/<profile>/<name> and sets the mission up the
 *      supported way, `runward --yes init --path <tree>`: a new mission, born with the analysis policy
 *      pinned in runward/scaffold-lock.json (ADR-0118 decision 4). If the build's init writes no pin,
 *      or --policy names another one, the harness writes the pin the way an existing mission opts in
 *      (one line in the lock), and says so in the output;
 *        - profile `default`: nothing else. This is the configuration of a new mission;
 *        - profile `declared`: the harness also writes runward/territory.md (a `domain-core` declared on
 *          the repository's own library source, from repos.json) and replaces the placeholder row of the
 *          Rule conformance table of runward/architecture.md with `applied` rows citing the top-level
 *          declarations of those files. On a blank mission the boundary and symbol families have
 *          nothing to check; these declarations, written by the harness and not by the project, make
 *          them read real code. The files written are copied to <out>/declared/overlay/;
 *   3. runs `runward check --strict --json --path <tree>` and reads its `analysis` block;
 *   4. writes into <out>, sorted, without timestamps or local paths: findings.json, findings.md,
 *      hypotheses.md, raw/<profile>/<name>.analysis.json and declared/overlay/<name>/runward/*.
 *      Two runs with the same build and the same repos.json write the same bytes.
 *
 * Network: `git fetch` from the repositories' URLs, nothing else. It installs nothing in the measured
 * trees and runs none of their code: runward reads their files at rest.
 *
 * USAGE
 *   node scripts/measure-analyzers.mjs --build <runward checkout | path/to/dist/cli.js> --out <dir>
 *        --out <dir>                    the directory the findings are written to (required)
 *        [--work <dir>]                 default: a new temporary directory, removed at the end
 *        [--keep]                       keep the temporary directory (a --work directory is always kept)
 *        [--repos express,hono]         a subset of repos.json, by name
 *        [--profiles default,declared]  default: both
 *        [--policy <id>]                pin this analysis policy instead of the one init writes
 *        [--config <repos.json>]        default: measure-analyzers.repos.json beside this script
 *   Run it with the Node.js version the build's .nvmrc names (it warns otherwise): the runward CLI is run
 *   with the same node binary as this script.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = ["default", "declared"];
const FALLBACK_POLICY = "runward-analysis/1";
const ANALYSED = /\.(?:[cm]?[jt]sx?)$/;

function die(msg) {
  console.error(`measure-analyzers: ${msg}`);
  process.exit(2);
}

function usage() {
  console.log("node scripts/measure-analyzers.mjs --build <runward checkout | dist/cli.js> --out DIR [--work DIR] [--keep] [--repos a,b] [--profiles default,declared] [--policy ID] [--config FILE]");
}

function parseArgs(argv) {
  const o = { profiles: [...PROFILES], keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) die(`${a} needs a value`);
      return v;
    };
    if (a === "--build") o.build = val();
    else if (a === "--out") o.out = val();
    else if (a === "--work") o.work = val();
    else if (a === "--keep") o.keep = true;
    else if (a === "--repos") o.repos = val().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--profiles") o.profiles = val().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--policy") o.policy = val();
    else if (a === "--config") o.config = val();
    else if (a === "-h" || a === "--help") { usage(); process.exit(0); }
    else die(`unknown argument ${a}`);
  }
  if (!o.build) { usage(); die("--build is required"); }
  if (!o.out) { usage(); die("--out is required: the directory the findings are written to"); }
  for (const p of o.profiles) if (!PROFILES.includes(p)) die(`unknown profile ${p} (known: ${PROFILES.join(", ")})`);
  o.profiles = PROFILES.filter((p) => o.profiles.includes(p));
  return o;
}

// The environment every child process gets: no RUNWARD_* variable of the caller's shell (RUNWARD_NOW,
// RUNWARD_DRY_RUN would change what runward writes), no colour, no git prompt.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("RUNWARD_")));
Object.assign(ENV, { NO_COLOR: "1", FORCE_COLOR: "0", GIT_TERMINAL_PROMPT: "0" });

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, env: ENV, ...opts });
  if (r.error) die(`${cmd} ${args.join(" ")}: ${r.error.message}`);
  return r;
}

const GIT_FLAGS = ["-c", "core.autocrlf=false", "-c", "core.symlinks=true", "-c", "advice.detachedHead=false"];
function git(dir, args, what) {
  const r = run("git", [...GIT_FLAGS, "-C", dir, ...args]);
  if (r.status !== 0) die(`git ${args.join(" ")} in ${dir} (${what}): exit ${r.status}\n${r.stderr}`);
  return r.stdout;
}

/** Remove a directory only when it lies strictly inside `base`. */
function removeInside(base, target) {
  const b = resolve(base);
  const t = resolve(target);
  if (t === b || !t.startsWith(b + sep)) die(`refusing to remove ${t}: not inside ${b}`);
  rmSync(t, { recursive: true, force: true });
}

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ── The build under test ──────────────────────────────────────────────────────────────────────────

function identifyBuild(arg) {
  const p = resolve(arg);
  const cli = existsSync(p) && statSync(p).isDirectory() ? join(p, "dist", "cli.js") : p;
  if (!existsSync(cli)) die(`no runward CLI at ${cli} (build it first: npm ci && npm run build)`);
  const root = resolve(dirname(cli), "..");
  const v = run(process.execPath, [cli, "--version"]);
  if (v.status !== 0) die(`${cli} --version: exit ${v.status}\n${v.stderr}`);
  let commit = null;
  let dirty = null;
  const g = run("git", ["-C", root, "rev-parse", "HEAD"]);
  if (g.status === 0) {
    commit = g.stdout.trim();
    dirty = run("git", ["-C", root, "status", "--porcelain"]).stdout.trim().length > 0;
  }
  let nvmrc = null;
  try { nvmrc = readFileSync(join(root, ".nvmrc"), "utf8").trim(); } catch { /* no .nvmrc */ }
  return { cli, root, version: v.stdout.trim(), commit, dirty, nvmrc, node: process.version };
}

// ── The repositories ──────────────────────────────────────────────────────────────────────────────

function ensureClone(dir, repo) {
  if (existsSync(dir)) {
    if (!existsSync(join(dir, ".git"))) {
      if (readdirSync(dir).length > 0) die(`${dir} exists and is not a clone; remove it or choose another --work`);
    } else {
      const head = run("git", ["-C", dir, "rev-parse", "HEAD"]).stdout.trim();
      const status = run("git", ["-C", dir, "status", "--porcelain", "--ignored"]).stdout.trim();
      if (head === repo.sha && status === "") return "reused";
      die(`${dir} is not a pristine checkout of ${repo.sha} (HEAD ${head || "none"}); remove it or choose another --work`);
    }
  }
  mkdirSync(dir, { recursive: true });
  git(dir, ["init", "-q"], "init");
  git(dir, ["fetch", "-q", "--depth", "1", repo.url, repo.sha], "fetch the pinned commit");
  git(dir, ["checkout", "-q", "FETCH_HEAD"], "checkout");
  const head = git(dir, ["rev-parse", "HEAD"], "verify").trim();
  if (head !== repo.sha) die(`${repo.name}: fetched ${head}, expected ${repo.sha}`);
  return "fetched";
}

function trackedFiles(tree) {
  return git(tree, ["ls-files", "-z"], "list tracked files").split("\0").filter(Boolean).sort(byText);
}

/** A file the conventions of policy runward-analysis/1 call a test (mirrored here only to leave tests
 *  out of the harness's citations; the analyzers decide for themselves). */
function isTestPath(rel) {
  const parts = rel.split("/");
  const base = parts[parts.length - 1];
  if (/^.+[._-](?:test|spec)\.[cm]?[jt]sx?$/.test(base) || /^(?:test|spec)\.[cm]?[jt]sx?$/.test(base) || /^test-.+\.[cm]?[jt]sx?$/.test(base)) return true;
  return parts.slice(0, -1).some((d) => d === "test" || d === "tests" || d === "__tests__");
}

/** A glob of the territory map (`**` any depth, `*` within one segment, `?` one character). */
function globRe(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") { re += ".*"; i++; }
    else if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += /[.+^${}()|[\]\\/]/.test(ch) ? `\\${ch}` : ch;
  }
  return new RegExp(`^${re}$`);
}

/** The top-level declarations of a source file, as a mission would cite them (`file:PATH#SYMBOL`):
 *  a line that starts at column 0 and declares a function, a class, an exported binding or type, or
 *  assigns a named function to an exported object. A selection for citing, not a parse. */
const SYMBOL_LINES = [
  /^export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
  /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
  /^export\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
  /^(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
  /^export\s+(?:declare\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/,
  /^export\s+(?:declare\s+)?(?:interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/,
  /^(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/,
  /^[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/,
  /^[A-Za-z_$][\w$]*\.prototype\.([A-Za-z_$][\w$]*)\s*=/,
];
function topLevelSymbols(src) {
  const out = new Set();
  for (const line of src.split(/\r?\n/)) {
    for (const re of SYMBOL_LINES) {
      const m = re.exec(line);
      if (m) out.add(m[1]);
    }
  }
  return [...out].sort(byText);
}

function writeDeclared(tree, repo, declaredWhy) {
  const core = repo.declared?.core ?? [];
  if (core.length === 0) return null;
  const territory = [
    "# Territory",
    "",
    "Written by the measurement harness of runward ADR-0117 (What would settle it, criterion 2), not by this project. It says nothing about the project's architecture.",
    "",
    "| Pattern | Category | Effect | Why |",
    "|---|---|---|---|",
    ...core.map((p) => `| \`${p}\` | \`domain-core\` | declare | ${declaredWhy} |`),
    "",
  ].join("\n");
  writeFileSync(join(tree, "runward", "territory.md"), territory);

  const res = core.map(globRe);
  const files = trackedFiles(tree).filter((f) => ANALYSED.test(f) && !isTestPath(f) && res.some((re) => re.test(f)));
  const cited = [];
  for (const f of files) {
    const symbols = topLevelSymbols(readFileSync(join(tree, f), "utf8"));
    if (symbols.length > 0) cited.push({ path: f, symbols });
  }
  const archPath = join(tree, "runward", "architecture.md");
  const arch = readFileSync(archPath, "utf8");
  const placeholder = /^\| \[rule-slug\] \|.*$/m;
  if (!placeholder.test(arch)) die(`${repo.name}: runward/architecture.md carries no \`| [rule-slug] |\` placeholder row to replace (did the template change?)`);
  const rows = cited.map((c, i) => `| c2-cited-symbols-${String(i + 1).padStart(3, "0")} | applied | ${c.symbols.map((s) => `file:${c.path}#${s}`).join("; ")} |`);
  const architecture = rows.length > 0 ? arch.replace(placeholder, () => rows.join("\n")) : arch;
  writeFileSync(archPath, architecture);
  return { core, coreFiles: files.length, cited, territory, architecture };
}

function prepareTree(src, tree, runDir, repo, profile, build, opts, config, logDir) {
  if (existsSync(tree)) removeInside(runDir, tree);
  mkdirSync(dirname(tree), { recursive: true });
  cpSync(src, tree, { recursive: true, verbatimSymlinks: true });
  const init = run(process.execPath, [build.cli, "--yes", "init", "--path", tree]);
  writeFileSync(join(logDir, `${profile}-${repo.name}-init.log`), `${init.stdout}\n--- stderr ---\n${init.stderr}`);
  if (init.status !== 0) die(`${repo.name} (${profile}): runward init exited ${init.status}; see ${join(logDir, `${profile}-${repo.name}-init.log`)}`);
  const lockPath = join(tree, "runward", "scaffold-lock.json");
  let lock;
  try { lock = JSON.parse(readFileSync(lockPath, "utf8")); } catch (e) { die(`${repo.name} (${profile}): unreadable ${lockPath}: ${e.message}`); }
  let pinnedBy = "runward init";
  if (opts.policy && lock.analysis !== opts.policy) { lock.analysis = opts.policy; pinnedBy = "the harness (--policy)"; }
  else if (!("analysis" in lock)) { lock.analysis = FALLBACK_POLICY; pinnedBy = "the harness (this build's init writes no pin)"; }
  if (pinnedBy !== "runward init") writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  const overlay = profile === "declared" ? writeDeclared(tree, repo, config.declaredWhy) : null;
  return { pinnedBy, policy: lock.analysis, overlay };
}

function runCheck(tree, repo, profile, build, logDir) {
  const r = run(process.execPath, [build.cli, "check", "--strict", "--json", "--path", tree]);
  writeFileSync(join(logDir, `${profile}-${repo.name}-check.stderr.log`), r.stderr);
  if (r.status !== 0 && r.status !== 1) die(`${repo.name} (${profile}): runward check --strict --json exited ${r.status}\n${r.stderr.slice(0, 2000)}`);
  let j;
  try { j = JSON.parse(r.stdout); } catch { die(`${repo.name} (${profile}): check --json printed no JSON (exit ${r.status})`); }
  if (!j.analysis || typeof j.analysis !== "object") die(`${repo.name} (${profile}): the verdict carries no \`analysis\` block (does this build read the pinned policy?)`);
  return { exit: r.status, verdict: j.verdict ?? null, gapsAnalysis: j.gaps?.analysis ?? null, analysis: j.analysis };
}

/** Local paths out of every string: the output must not depend on where the trees were prepared. */
function scrub(value, tree) {
  const spellings = [tree];
  try { const real = realpathSync(tree); if (!spellings.includes(real)) spellings.push(real); } catch { /* the logical path stands */ }
  const fix = (s) => {
    let out = s;
    for (const p of spellings) out = out.split(`${p}/`).join("").split(p).join(".");
    return out;
  };
  const walk = (v) => {
    if (typeof v === "string") return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value);
}

function lineText(tree, f) {
  if (f.family === "secret") return null; // the analyzers never print a credential; neither does this harness
  if (typeof f.line !== "number" || f.line < 1) return null;
  let text;
  try { text = readFileSync(join(tree, f.path), "utf8"); } catch { return null; }
  const line = text.split(/\r?\n/)[f.line - 1];
  if (line === undefined) return null;
  const t = line.replace(/\s+$/, "");
  return t.length > 240 ? `${t.slice(0, 239)}…` : t;
}

// ── Reproduction ──────────────────────────────────────────────────────────────────────────────────

const shq = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
const safeName = (s) => (/^[\w.-]+$/.test(s) ? s : shq(s));

function setupCommand(repo, profile) {
  const d = safeName(repo.name);
  const base = `git init -q ${d} && git -C ${d} fetch -q --depth 1 ${repo.url} ${repo.sha} && git -C ${d} -c advice.detachedHead=false checkout -q FETCH_HEAD && node "$RUNWARD" --yes init --path ${d} > /dev/null`;
  if (profile !== "declared") return base;
  return `${base} && cp "$C2_OUT/declared/overlay/${repo.name}/runward/territory.md" "$C2_OUT/declared/overlay/${repo.name}/runward/architecture.md" ${d}/runward/`;
}

function selectCommand(repo, f, list) {
  const filter = `.analysis.${list}[] | select(.path==${JSON.stringify(f.path)} and .line==${JSON.stringify(f.line ?? null)} and .check==${JSON.stringify(f.check)})`;
  return `node "$RUNWARD" check --strict --json --path ${safeName(repo.name)} | jq -c ${shq(filter)}`;
}

// ── Collection ────────────────────────────────────────────────────────────────────────────────────

const keyOf = (repo, f) => JSON.stringify([repo, f.family, f.check, f.path, f.line ?? null, f.message]);
function order(a, b) {
  return byText(a.repository, b.repository) || byText(a.family, b.family) || byText(a.path, b.path)
    || (a.line ?? 0) - (b.line ?? 0) || byText(a.check, b.check) || byText(a.message, b.message);
}

function records(list, repo, profile, tree, kind) {
  const recs = list.map((f) => ({
    ...f,
    repository: repo.name,
    lineText: lineText(tree, f),
    ...(f.family === "secret" ? { lineTextWithheld: "secret family: the value is never printed" } : {}),
    reproduce: { setup: setupCommand(repo, profile), select: selectCommand(repo, f, kind) },
  }));
  recs.sort(order);
  const seen = new Map();
  for (const r of recs) {
    const k = keyOf(r.repository, r);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    r.id = `${r.repository}-${createHash("sha256").update(n === 0 ? k : `${k}#${n}`).digest("hex").slice(0, 10)}`;
  }
  return recs.map(({ id, repository, family, check, path, line, message, lineText: lt, lineTextWithheld, reproduce, ...rest }) => ({
    id, repository, family, check, path, line: line ?? null, message,
    ...(Object.keys(rest).length > 0 ? { otherFields: rest } : {}),
    lineText: lt, ...(lineTextWithheld ? { lineTextWithheld } : {}), reproduce,
  }));
}

function tally(list) {
  const out = {};
  for (const f of list) {
    out[f.repository] ??= {};
    out[f.repository][f.family] = (out[f.repository][f.family] ?? 0) + 1;
  }
  return out;
}
function tallyChecks(list) {
  const out = {};
  for (const f of list) {
    const k = `${f.family}/${f.check}`;
    out[f.repository] ??= {};
    out[f.repository][k] = (out[f.repository][k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).map(([r, m]) => [r, Object.fromEntries(Object.entries(m).sort(([a], [b]) => byText(a, b)))]));
}

// ── Markdown ──────────────────────────────────────────────────────────────────────────────────────

const cell = (s) => String(s ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
const code = (s) => {
  const t = cell(s);
  return t.includes("`") ? `\`\` ${t} \`\`` : `\`${t}\``;
};
const where = (f) => `${f.path}${f.line ? `:${f.line}` : ""}`;

function tableOf(list) {
  if (list.length === 0) return ["None."];
  return [
    "| ID | Repository | Family | Check | File:line | Message | Reproduce (after the setup line of its repository) |",
    "|---|---|---|---|---|---|---|",
    ...list.map((f) => `| ${f.id} | ${f.repository} | ${f.family} | ${code(f.check)} | ${code(where(f))} | ${cell(f.message)} | ${code(f.reproduce.select)} |`),
  ];
}

function countsTable(doc, kind) {
  const families = new Set();
  for (const p of doc.profilesRun) for (const r of doc.repositories) for (const fam of Object.keys(r.profiles[p]?.[kind === "findings" ? "findingsByFamily" : "hypothesesByFamily"] ?? {})) families.add(fam);
  const fams = [...families].sort(byText);
  const lines = [
    `| Repository | Profile | ${fams.map(cell).join(" | ")}${fams.length ? " | " : ""}Total |`,
    `|---|---|${fams.map(() => "---|").join("")}---|`,
  ];
  for (const r of doc.repositories) for (const p of doc.profilesRun) {
    const m = r.profiles[p]?.[kind === "findings" ? "findingsByFamily" : "hypothesesByFamily"] ?? {};
    const total = Object.values(m).reduce((a, b) => a + b, 0);
    lines.push(`| ${r.name} | ${p} | ${fams.map((f) => m[f] ?? 0).join(" | ")}${fams.length ? " | " : ""}${total} |`);
  }
  return lines;
}

function header(doc) {
  const b = doc.build;
  return [
    `- runward build: ${b.version}${b.commit ? `, commit \`${b.commit}\`${b.dirty ? " (working tree not clean)" : ""}` : ""}; Node.js ${b.node}${b.nvmrc ? ` (the build's .nvmrc: ${b.nvmrc})` : ""}.`,
    `- Analysis policy read: ${[...new Set(doc.repositories.flatMap((r) => doc.profilesRun.map((p) => r.profiles[p]?.policy)).filter(Boolean))].map(code).join(", ")}, pinned in \`runward/scaffold-lock.json\` by ${[...new Set(doc.repositories.flatMap((r) => doc.profilesRun.map((p) => r.profiles[p]?.pinnedBy)).filter(Boolean))].join(", ")}.`,
    "- Profiles: `default` is a new mission exactly as `runward --yes init` writes it. `declared` adds a `domain-core` in `runward/territory.md` and `applied` rows citing symbols in `runward/architecture.md`, both written by the harness and not by the project, so that the boundary and symbol families, which have nothing to check on a blank mission, read real code. Its table lists only the findings the default profile does not have.",
    "- Nothing was installed in the measured trees and none of their code ran: the supported way (`runward init`, then `runward check --strict`) reads the files at rest and needs no install.",
  ];
}

function familyCounts(list, repos) {
  const fams = [...new Set(list.map((f) => f.family))].sort(byText);
  const lines = [`| Repository | ${fams.map(cell).join(" | ")}${fams.length ? " | " : ""}Total |`, `|---|${fams.map(() => "---|").join("")}---|`];
  for (const r of repos) {
    const mine = list.filter((f) => f.repository === r.name);
    lines.push(`| ${r.name} | ${fams.map((fam) => mine.filter((f) => f.family === fam).length).join(" | ")}${fams.length ? " | " : ""}${mine.length} |`);
  }
  return lines;
}

function reproduceSection(doc) {
  const lines = [
    "## Reproduce",
    "",
    "Start in an empty directory (one per profile), with two variables set:",
    "",
    "```sh",
    "export RUNWARD=/path/to/runward/dist/cli.js   # the build above, run with the Node.js version its .nvmrc names",
    "export C2_OUT=/path/to/this/output/directory   # used by the declared profile only (its overlay files)",
    "```",
    "",
    "Run the setup line of a repository and profile once, then, from the same directory, the command of any finding of that repository. Each command prints the finding as JSON; `jq` is the only tool used besides git and node. The whole collection, in one command, from a runward checkout:",
    "",
    "```sh",
    "node scripts/measure-analyzers.mjs --build /path/to/runward --out /path/to/output",
    "```",
    "",
  ];
  for (const r of doc.repositories) for (const p of doc.profilesRun) {
    lines.push(`- **${r.name}**, profile \`${p}\`:`, "", "  ```sh", `  ${r.profiles[p].setup}`, "  ```", "");
  }
  return lines;
}

function scopeSection(doc) {
  const lines = ["## What each run read and did not read", ""];
  for (const r of doc.repositories) for (const p of doc.profilesRun) {
    const s = r.profiles[p];
    lines.push(`- **${r.name}**, \`${p}\`: ${s.files.analysed} source file(s) read (${s.files.core} in the declared domain core, ${s.files.tests} test file(s)), ${s.files.config} configuration file(s) read for secrets; \`check\` exit ${s.checkExit}, \`gaps.analysis\` ${s.gapsAnalysis}.`);
    for (const n of s.notAnalyzed) lines.push(`  - not analysed: ${cell(n.what)}${n.files ? ` (${n.files} file(s)${n.examples?.length ? `, e.g. ${n.examples.map(code).join(", ")}` : ""})` : ""}`);
    for (const e of s.excluded) lines.push(`  - set aside: ${code(e.path)}, by ${cell(e.by)}`);
    if (s.declared) lines.push(`  - declared by the harness: \`domain-core\` = ${s.declared.core.map(code).join(", ")} (${s.declared.coreFiles} non-test source file(s)); ${s.declared.citedSymbols} symbol(s) cited from ${s.declared.citedFiles} file(s)`);
  }
  lines.push("");
  return lines;
}

function renderFindings(doc) {
  const lines = [
    "# Built-in analyzers on repositories runward did not write: the findings to classify",
    "",
    "Collected for runward ADR-0117, What would settle it, criterion 2. Collection only: nothing here is classified. The subject is runward's reading, never the measured projects: a finding says that the code differs from an invariant the mission or the policy declares, never that the code is wrong. A reviewer who wrote neither the analyzers nor this harness classifies each finding true (the reading is right: the code does what the message says) or false (a false red: the reading is wrong).",
    "",
    ...header(doc),
    "",
    "## Repositories",
    "",
    "| Repository | Commit | Licence | Languages | Why |",
    "|---|---|---|---|---|",
    ...doc.repositories.map((r) => `| [${r.name}](${r.url}) | \`${r.sha}\` | ${r.license} | ${r.languages.join(", ")} | ${cell(r.why)} |`),
    "",
    "## Findings per repository and family",
    "",
    ...countsTable(doc, "findings"),
    "",
    "The declared rows count every finding of that run, the default ones included. Hypotheses are reported by the analyzers and never counted: see hypotheses.md.",
    "",
    ...(doc.findings.declaredOnly ? ["Findings that appear only under the harness's declarations (the `declared` run minus the `default` one):", "", ...familyCounts(doc.findings.declaredOnly, doc.repositories), ""] : []),
    ...reproduceSection(doc),
    ...scopeSection(doc),
  ];
  if (doc.profilesRun.includes("default")) lines.push(`## Findings, profile \`default\` (${doc.findings.default.length})`, "", ...tableOf(doc.findings.default), "");
  if (doc.profilesRun.includes("declared")) {
    const d = doc.findings.declaredOnly;
    lines.push(`## Findings only under the harness's declarations, profile \`declared\` (${d.length})`, "", ...tableOf(d), "");
    if (doc.findings.defaultMissingFromDeclared.length > 0) {
      lines.push(`## Default findings absent from the declared run (${doc.findings.defaultMissingFromDeclared.length})`, "", "A declaration should only add checks; these findings of the default run are missing from the declared one.", "", ...tableOf(doc.findings.defaultMissingFromDeclared), "");
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderHypotheses(doc) {
  const lines = [
    "# Built-in analyzers on repositories runward did not write: hypotheses (never counted)",
    "",
    "What the analyzers report as a hypothesis (ADR-0041's labelled class): never counted against a verdict, so never a red. Listed for completeness beside findings.md, with the same reproduction commands (select from `.analysis.hypotheses`).",
    "",
    ...header(doc),
    "",
    ...countsTable(doc, "hypotheses"),
    "",
  ];
  if (doc.profilesRun.includes("default")) lines.push(`## Hypotheses, profile \`default\` (${doc.hypotheses.default.length})`, "", ...tableOf(doc.hypotheses.default), "");
  if (doc.profilesRun.includes("declared")) lines.push(`## Hypotheses only under the harness's declarations, profile \`declared\` (${doc.hypotheses.declaredOnly.length})`, "", ...tableOf(doc.hypotheses.declaredOnly), "");
  return `${lines.join("\n")}\n`;
}

// ── Main ──────────────────────────────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const build = identifyBuild(opts.build);
  if (build.nvmrc && !process.version.startsWith(`v${build.nvmrc.replace(/^v/, "")}`)) {
    console.error(`measure-analyzers: warning: running Node.js ${process.version}, the build's .nvmrc names ${build.nvmrc}`);
  }
  const configPath = resolve(opts.config ?? join(HERE, "measure-analyzers.repos.json"));
  let config;
  try { config = JSON.parse(readFileSync(configPath, "utf8")); } catch (e) { die(`unreadable ${configPath}: ${e.message}`); }
  let repos = config.repositories ?? [];
  if (opts.repos) {
    for (const n of opts.repos) if (!repos.some((r) => r.name === n)) die(`no repository named ${n} in ${configPath}`);
    repos = repos.filter((r) => opts.repos.includes(r.name));
  }
  for (const r of repos) if (!/^[0-9a-f]{40}$/.test(r.sha)) die(`${r.name}: sha must be a full 40-character commit id`);
  repos = [...repos].sort((a, b) => byText(a.name, b.name));

  const label = `${build.version}${build.commit ? `-${build.commit.slice(0, 7)}` : ""}${build.dirty ? "-dirty" : ""}`;
  const out = resolve(opts.out);
  const workGiven = opts.work !== undefined;
  const work = workGiven ? resolve(opts.work) : mkdtempSync(join(tmpdir(), "runward-c2-"));
  mkdirSync(work, { recursive: true });
  const runDir = join(work, `run-${label}`);
  if (existsSync(runDir)) removeInside(work, runDir);
  const logDir = join(runDir, "logs");
  mkdirSync(logDir, { recursive: true });

  console.log(`runward ${build.version}${build.commit ? ` @ ${build.commit.slice(0, 12)}` : ""} (${build.cli}), Node.js ${process.version}`);
  console.log(`work: ${work}\nout:  ${out}`);

  const doc = {
    schema: "runward-c2-findings/1",
    criterion: "runward ADR-0117, What would settle it, criterion 2: false reds measured before the default of new missions moves",
    collectionOnly: "Nothing in this file is classified. A reviewer who wrote neither the analyzers nor this harness classifies each finding true or false.",
    build: { version: build.version, commit: build.commit, dirty: build.dirty, node: build.node, nvmrc: build.nvmrc },
    profilesRun: opts.profiles,
    repositories: [],
    findings: {},
    hypotheses: {},
    counts: {},
  };
  const all = { findings: {}, hypotheses: {} };
  for (const p of opts.profiles) { all.findings[p] = []; all.hypotheses[p] = []; }
  const raw = {};
  const overlays = {};

  for (const repo of repos) {
    const t0 = Date.now();
    const src = join(work, "src", repo.name);
    const how = ensureClone(src, repo);
    const entry = {
      name: repo.name, url: repo.url, sha: repo.sha, license: repo.license, languages: repo.languages ?? [], why: repo.why,
      declaredCore: repo.declared?.core ?? [], profiles: {},
    };
    for (const profile of opts.profiles) {
      const tree = join(runDir, profile, repo.name);
      const prep = prepareTree(src, tree, runDir, repo, profile, build, opts, config, logDir);
      const chk = runCheck(tree, repo, profile, build, logDir);
      const a = scrub(chk.analysis, tree);
      raw[`${profile}/${repo.name}`] = a;
      if (prep.overlay) overlays[repo.name] = prep.overlay;
      const findings = records(a.findings ?? [], repo, profile, tree, "findings");
      const hypotheses = records(a.hypotheses ?? [], repo, profile, tree, "hypotheses");
      all.findings[profile].push(...findings);
      all.hypotheses[profile].push(...hypotheses);
      entry.profiles[profile] = {
        setup: setupCommand(repo, profile),
        policy: a.policy ?? prep.policy, known: a.known ?? null, pinnedBy: prep.pinnedBy,
        checkExit: chk.exit, verdict: chk.verdict, gapsAnalysis: chk.gapsAnalysis,
        files: a.files ?? {}, notAnalyzed: a.notAnalyzed ?? [], excluded: (a.excluded ?? []).slice().sort((x, y) => byText(x.path, y.path)),
        allowances: a.allowances ?? null,
        findingsByFamily: tally(findings)[repo.name] ?? {},
        hypothesesByFamily: tally(hypotheses)[repo.name] ?? {},
        ...(prep.overlay ? { declared: { core: prep.overlay.core, coreFiles: prep.overlay.coreFiles, citedFiles: prep.overlay.cited.length, citedSymbols: prep.overlay.cited.reduce((n, c) => n + c.symbols.length, 0) } } : {}),
      };
      if (chk.gapsAnalysis !== null && chk.gapsAnalysis !== findings.length) die(`${repo.name} (${profile}): gaps.analysis says ${chk.gapsAnalysis}, analysis.findings holds ${findings.length}`);
      console.log(`  ${repo.name} [${profile}]: ${findings.length} finding(s), ${hypotheses.length} hypothesis(es), ${a.files?.analysed ?? "?"} source file(s) read; check exit ${chk.exit}`);
    }
    doc.repositories.push(entry);
    console.log(`  ${repo.name}: clone ${how}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }

  for (const p of opts.profiles) { all.findings[p].sort(order); all.hypotheses[p].sort(order); }
  if (opts.profiles.includes("default")) { doc.findings.default = all.findings.default; doc.hypotheses.default = all.hypotheses.default; }
  if (opts.profiles.includes("declared")) {
    const base = new Set((all.findings.default ?? []).map((f) => keyOf(f.repository, f)));
    const baseH = new Set((all.hypotheses.default ?? []).map((f) => keyOf(f.repository, f)));
    const both = opts.profiles.includes("default");
    doc.findings.declaredOnly = both ? all.findings.declared.filter((f) => !base.has(keyOf(f.repository, f))) : all.findings.declared;
    doc.hypotheses.declaredOnly = both ? all.hypotheses.declared.filter((f) => !baseH.has(keyOf(f.repository, f))) : all.hypotheses.declared;
    const decl = new Set(all.findings.declared.map((f) => keyOf(f.repository, f)));
    doc.findings.defaultMissingFromDeclared = both ? all.findings.default.filter((f) => !decl.has(keyOf(f.repository, f))) : [];
  }
  doc.counts = {
    findingsByRepositoryAndFamily: Object.fromEntries(opts.profiles.map((p) => [p, tally(all.findings[p])])),
    findingsByRepositoryAndCheck: Object.fromEntries(opts.profiles.map((p) => [p, tallyChecks(all.findings[p])])),
    hypothesesByRepositoryAndFamily: Object.fromEntries(opts.profiles.map((p) => [p, tally(all.hypotheses[p])])),
    ...(doc.findings.declaredOnly ? { declaredOnlyByRepositoryAndFamily: tally(doc.findings.declaredOnly) } : {}),
  };

  // Output: the generated entries are replaced as a whole, so a file of an earlier run never lingers.
  mkdirSync(out, { recursive: true });
  for (const name of ["findings.json", "findings.md", "hypotheses.md", "raw", "declared"]) {
    if (existsSync(join(out, name))) removeInside(out, join(out, name));
  }
  writeFileSync(join(out, "findings.json"), `${JSON.stringify(doc, null, 2)}\n`);
  writeFileSync(join(out, "findings.md"), renderFindings(doc));
  writeFileSync(join(out, "hypotheses.md"), renderHypotheses(doc));
  for (const [k, a] of Object.entries(raw).sort(([x], [y]) => byText(x, y))) {
    const [p, n] = k.split("/");
    mkdirSync(join(out, "raw", p), { recursive: true });
    writeFileSync(join(out, "raw", p, `${n}.analysis.json`), `${JSON.stringify(a, null, 2)}\n`);
  }
  for (const [n, o] of Object.entries(overlays).sort(([x], [y]) => byText(x, y))) {
    const d = join(out, "declared", "overlay", n, "runward");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "territory.md"), o.territory);
    writeFileSync(join(d, "architecture.md"), o.architecture);
  }

  const total = (p) => all.findings[p].length;
  console.log(`done: ${opts.profiles.map((p) => `${p} ${total(p)} finding(s)`).join(", ")}${doc.findings.declaredOnly ? `, ${doc.findings.declaredOnly.length} only under the declarations` : ""}`);
  console.log(`  ${join(out, "findings.json")}\n  ${join(out, "findings.md")}\n  ${join(out, "hypotheses.md")}`);
  if (!workGiven && !opts.keep) rmSync(work, { recursive: true, force: true });
  else console.log(`  trees kept in ${runDir}`);
}

main();
