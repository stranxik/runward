import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * Deterministic, read-only characterization of an existing codebase (ADR-0014).
 * It PARSES artifacts at rest — dependency manifests, CI config, tests, git-log
 * shape — and never runs, builds, installs, or writes to the target. No LLM: two
 * runs on the same commit agree. The output is `confidence: high` facts, never
 * decisions; reconstructing the *why* is the operator's job (ADR-0013).
 */

export interface EcosystemInfo {
  name: string;
  manifest: string;
  lockfile: string | null;
  runtimeDeps: number;
  devDeps: number;
  depNames: string[];
}

export interface Inventory {
  root: string;
  ecosystems: EcosystemInfo[];
  entrypoints: string[];
  ci: string[];
  containers: string[];
  tests: { dirs: string[]; files: number };
  git: { commits: number; first: string; last: string; authors: number } | null;
  fileCount: number;
}

const SKIP_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "out", "coverage", "vendor",
  ".next", ".nuxt", ".venv", "venv", "__pycache__", "target", ".turbo", ".cache",
]);

/** Bounded recursive walk (skips heavy dirs, caps depth) — read-only. */
function walk(dir: string, depth: number, onFile: (path: string, name: string) => void): void {
  if (depth < 0) return;
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(p, depth - 1, onFile);
    } else {
      onFile(p, name);
    }
  }
}

function firstExisting(root: string, names: string[]): string | null {
  for (const n of names) if (existsSync(join(root, n))) return n;
  return null;
}

function detectEcosystems(root: string): EcosystemInfo[] {
  const out: EcosystemInfo[] = [];

  // Node / TypeScript — parsed in full.
  if (existsSync(join(root, "package.json"))) {
    let runtime = 0, dev = 0, names: string[] = [];
    try {
      const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      names = Object.keys(pkg.dependencies ?? {});
      runtime = names.length;
      dev = Object.keys(pkg.devDependencies ?? {}).length;
    } catch { /* malformed manifest: still recorded, deps unknown */ }
    out.push({
      name: "Node / JavaScript / TypeScript",
      manifest: "package.json",
      lockfile: firstExisting(root, ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"]),
      runtimeDeps: runtime, devDeps: dev, depNames: names,
    });
  }

  // Python.
  const pyManifest = firstExisting(root, ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"]);
  if (pyManifest) {
    let runtime = 0;
    if (pyManifest === "requirements.txt") {
      try { runtime = readFileSync(join(root, "requirements.txt"), "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).length; } catch { /* unreadable */ }
    }
    out.push({ name: "Python", manifest: pyManifest, lockfile: firstExisting(root, ["poetry.lock", "Pipfile.lock", "uv.lock"]), runtimeDeps: runtime, devDeps: 0, depNames: [] });
  }

  // Go.
  if (existsSync(join(root, "go.mod"))) {
    let runtime = 0;
    try { runtime = readFileSync(join(root, "go.mod"), "utf8").split("\n").filter((l) => /^\s+[\w.\/-]+\s+v\d/.test(l)).length; } catch { /* unreadable */ }
    out.push({ name: "Go", manifest: "go.mod", lockfile: firstExisting(root, ["go.sum"]), runtimeDeps: runtime, devDeps: 0, depNames: [] });
  }

  // Rust, Java, Ruby, PHP — presence + lockfile (rough).
  const simple: Array<[string, string, string[]]> = [
    ["Rust", "Cargo.toml", ["Cargo.lock"]],
    ["Java (Maven)", "pom.xml", []],
    ["Java (Gradle)", "build.gradle", ["gradle.lockfile"]],
    ["Ruby", "Gemfile", ["Gemfile.lock"]],
    ["PHP", "composer.json", ["composer.lock"]],
  ];
  for (const [name, manifest, locks] of simple) {
    if (existsSync(join(root, manifest))) {
      out.push({ name, manifest, lockfile: firstExisting(root, locks), runtimeDeps: 0, devDeps: 0, depNames: [] });
    }
  }

  return out;
}

function detectEntrypoints(root: string): string[] {
  const found = new Set<string>();
  // Declared entrypoints in package.json.
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    if (typeof pkg.main === "string") found.add(pkg.main);
    if (typeof pkg.bin === "string") found.add(pkg.bin);
    else if (pkg.bin && typeof pkg.bin === "object") for (const v of Object.values(pkg.bin)) if (typeof v === "string") found.add(v);
  } catch { /* no/invalid package.json */ }
  // Common convention files.
  for (const f of ["index.ts", "index.js", "src/index.ts", "src/index.js", "src/main.ts", "main.py", "app.py", "src/main.rs", "cmd", "main.go"]) {
    if (existsSync(join(root, f))) found.add(f);
  }
  return [...found];
}

function detectCI(root: string): string[] {
  const out: string[] = [];
  const wf = join(root, ".github", "workflows");
  if (existsSync(wf)) {
    try { for (const f of readdirSync(wf)) if (/\.ya?ml$/.test(f)) out.push(`.github/workflows/${f}`); } catch { /* unreadable */ }
  }
  for (const f of [".gitlab-ci.yml", "azure-pipelines.yml", ".circleci/config.yml", "Jenkinsfile", ".drone.yml"]) {
    if (existsSync(join(root, f))) out.push(f);
  }
  return out;
}

function detectContainers(root: string): string[] {
  const out: string[] = [];
  for (const f of ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yaml", "vercel.json", "netlify.toml", "fly.toml", "Procfile", "Chart.yaml"]) {
    if (existsSync(join(root, f))) out.push(f);
  }
  return out;
}

function detectTests(root: string): { dirs: string[]; files: number } {
  const dirs = new Set<string>();
  let files = 0;
  for (const d of ["test", "tests", "__tests__", "spec"]) if (existsSync(join(root, d))) dirs.add(d);
  walk(root, 5, (_p, name) => {
    if (/\.(test|spec)\.[jt]sx?$/.test(name) || /_test\.go$/.test(name) || /^test_.*\.py$/.test(name) || /Test\.java$/.test(name)) files++;
  });
  return { dirs: [...dirs], files };
}

function gitShape(root: string): Inventory["git"] {
  const git = (args: string[]): string => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    git(["rev-parse", "--is-inside-work-tree"]); // throws if not a repo / git absent
    const commits = parseInt(git(["rev-list", "--count", "HEAD"]), 10) || 0;
    const last = git(["log", "-1", "--format=%as"]);
    const first = git(["log", "--max-parents=0", "-1", "--format=%as"]);
    const authors = git(["shortlog", "-sne", "HEAD"]).split("\n").filter((l) => l.trim()).length;
    return { commits, first, last, authors };
  } catch {
    return null;
  }
}

/** Build the read-only inventory of an existing codebase. */
export function buildInventory(root: string): Inventory {
  let fileCount = 0;
  walk(root, 6, () => { fileCount++; });
  return {
    root,
    ecosystems: detectEcosystems(root),
    entrypoints: detectEntrypoints(root),
    ci: detectCI(root),
    containers: detectContainers(root),
    tests: detectTests(root),
    git: gitShape(root),
    fileCount,
  };
}

/** Render the inventory as `characterization.md` — facts only, never decisions. */
export function renderCharacterization(inv: Inventory, generatedAt: string): string {
  const L: string[] = [];
  L.push(`# Characterization — ${basename(inv.root) || "system"}`);
  L.push("");
  L.push(`> \`confidence: high\` · generated by \`runward characterize\` on ${generatedAt} · **read-only, deterministic (no LLM).**`);
  L.push("> This is a factual inventory of an existing system, not a set of decisions. Nothing here explains *why* the");
  L.push("> system is the way it is — reconstructing that is the operator's job (see next steps). Re-run to refresh.");
  L.push("");

  L.push("## Languages & build");
  L.push("");
  if (inv.ecosystems.length === 0) L.push("_No dependency manifest found at the root._");
  else {
    L.push("| Ecosystem | Manifest | Lockfile | Runtime deps | Dev deps |");
    L.push("|---|---|---|---|---|");
    for (const e of inv.ecosystems) {
      L.push(`| ${e.name} | \`${e.manifest}\` | ${e.lockfile ? `\`${e.lockfile}\`` : "**none** (unpinned)"} | ${e.runtimeDeps || "—"} | ${e.devDeps || "—"} |`);
    }
  }
  L.push("");

  const withNames = inv.ecosystems.find((e) => e.depNames.length);
  if (withNames) {
    L.push(`## Runtime dependencies (${withNames.manifest})`);
    L.push("");
    L.push(withNames.depNames.map((n) => `\`${n}\``).join(" · "));
    L.push("");
  }

  L.push("## Entrypoints");
  L.push("");
  L.push(inv.entrypoints.length ? inv.entrypoints.map((e) => `- \`${e}\``).join("\n") : "_None detected by convention._");
  L.push("");

  L.push("## CI / pipelines");
  L.push("");
  L.push(inv.ci.length ? inv.ci.map((f) => `- \`${f}\``).join("\n") : "_No CI configuration detected._");
  L.push("");

  L.push("## Containers / deployment");
  L.push("");
  L.push(inv.containers.length ? inv.containers.map((f) => `- \`${f}\``).join("\n") : "_No container/deploy descriptor detected._");
  L.push("");

  L.push("## Tests");
  L.push("");
  L.push(`- Test directories: ${inv.tests.dirs.length ? inv.tests.dirs.map((d) => `\`${d}/\``).join(", ") : "_none_"}`);
  L.push(`- Test files (by naming convention): **${inv.tests.files}**`);
  L.push("");

  L.push("## Git history (shape only)");
  L.push("");
  if (inv.git) {
    L.push(`- Commits: **${inv.git.commits}** · Span: ${inv.git.first} → ${inv.git.last} · Distinct authors: **${inv.git.authors}**`);
    L.push("- Counts only — the log tells you *what* changed and *when*, rarely *why*. The *why* is a decision to reconstruct, not a fact to read.");
  } else {
    L.push("_Not a git repository, or git unavailable — history shape could not be read._");
  }
  L.push("");
  L.push(`_Scanned ~${inv.fileCount} files (heavy directories skipped)._`);
  L.push("");

  L.push("## Next steps (operator)");
  L.push("");
  L.push("1. This inventory is **facts**, not decisions. Nothing here has been ratified.");
  L.push("2. Run the **brownfield** workflow (`runward/workflows/brownfield.md`) with your agent: reconstruct the architecture note and the retroactive ADRs — each starts as a *hypothesis* until you confirm its *why* and set its re-evaluation trigger.");
  L.push("3. Then `runward check` (and `--strict` once you have manifests) — the gate stays red until each reconstructed decision is ratified by you, not your agent.");
  L.push("");
  return L.join("\n") + "\n";
}

// ── Candidate ADR-mining (`--mine`) — deterministic git archaeology, no model call (ADR-0014) ──

export interface MineCandidate {
  slug: string;
  title: string;
  evidence: string[];
}

const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const DEP_FAMILIES: Array<{ match: RegExp; family: string }> = [
  { match: /^(express|fastify|koa|@nestjs\/core|next|nuxt|react|vue|svelte|@angular\/core|django|flask|fastapi|rails|sinatra|laravel|symfony|spring-boot)/i, family: "web framework / UI" },
  { match: /^(pg|mysql2?|mongodb|mongoose|@prisma\/client|prisma|typeorm|sequelize|redis|ioredis|sqlalchemy|gorm|diesel)/i, family: "data store / ORM" },
  { match: /^(bullmq|bull|amqplib|kafkajs|celery|sidekiq|nats)/i, family: "queue / messaging" },
  { match: /^(openai|@anthropic-ai\/sdk|anthropic|langchain|@langchain\/|llamaindex|@ai-sdk\/|cohere-ai)/i, family: "AI / model provider" },
  { match: /^(@aws-sdk\/|aws-sdk|@google-cloud\/|@azure\/|firebase|stripe)/i, family: "external service SDK" },
];

function firstSeen(root: string, file: string): string | null {
  try {
    const out = execFileSync("git", ["-C", root, "log", "--diff-filter=A", "--reverse", "--format=%as", "--", file], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return out.split("\n")[0] || null;
  } catch { return null; }
}

/**
 * Propose *candidate* structural decisions from evidence at rest — deterministic, no model call.
 * Covers the stack/language choice, containerization, the CI pipeline, and notable dependency
 * families. Each is a hypothesis with provenance; the *why* is left for the operator (ADR-0013).
 */
export function mineDrafts(root: string, inv: Inventory): MineCandidate[] {
  const out: MineCandidate[] = [];

  for (const eco of inv.ecosystems) {
    const seen = firstSeen(root, eco.manifest);
    out.push({
      slug: `stack-${slugify(eco.name.split(/[ /]/)[0])}`,
      title: `Adopt ${eco.name} as the core stack`,
      evidence: [`\`${eco.manifest}\`${eco.lockfile ? ` + \`${eco.lockfile}\`` : " (no lockfile — unpinned)"}`, seen ? `first seen ${seen}` : "manifest at repo root"],
    });
  }

  if (inv.containers.length) {
    out.push({ slug: "deployment-target", title: `Deploy/package via ${inv.containers[0]}`, evidence: inv.containers.map((f) => `\`${f}\``) });
  }
  if (inv.ci.length) {
    out.push({ slug: "ci-pipeline", title: "Gate delivery through a CI pipeline", evidence: inv.ci.map((f) => `\`${f}\``) });
  }

  let depCount = 0;
  for (const eco of inv.ecosystems) {
    for (const dep of eco.depNames) {
      if (depCount >= 8) break;
      const fam = DEP_FAMILIES.find((f) => f.match.test(dep));
      if (!fam) continue;
      depCount++;
      out.push({ slug: `dep-${slugify(dep)}`, title: `Depend on ${dep} (${fam.family})`, evidence: [`\`${dep}\` in \`${eco.manifest}\``] });
    }
  }

  return out;
}

/** Render one candidate as a DRAFT-*.md — a hypothesis with provenance, `why: UNKNOWN`, no verdict. */
export function renderDraft(cand: MineCandidate, generatedAt: string): string {
  const L: string[] = [];
  L.push(`# DRAFT — ${cand.title}`);
  L.push("");
  L.push("**Status**: hypothesis");
  L.push(`**Date**: ${generatedAt}`);
  L.push("**Deciders**: (unratified — the operator must own this)");
  L.push("");
  L.push("> Reconstructed by `runward characterize --mine` from evidence at rest — a **candidate decision**,");
  L.push("> not a fact. Ratify it: write the real *why* and the alternatives you rejected, set a re-evaluation");
  L.push("> trigger, put your name in Deciders, set `Status: accepted`, and rename this file to");
  L.push("> `ADR-NNNN-<slug>.md`. Or delete it if it was never a real decision. `runward check --strict` stays");
  L.push("> red until you do.");
  L.push("");
  L.push("## Evidence");
  L.push("");
  for (const e of cand.evidence) L.push(`- ${e}`);
  L.push("");
  L.push("## Decision (reconstructed — confirm or correct)");
  L.push("");
  L.push(`${cand.title}.`);
  L.push("");
  L.push("## Why");
  L.push("");
  L.push("why: UNKNOWN — the operator must supply the rationale; it is not recoverable from code or history.");
  L.push("");
  L.push("## Reevaluation trigger (mandatory)");
  L.push("");
  L.push("TODO — under what objective signal should this decision be reopened?");
  L.push("");
  return L.join("\n") + "\n";
}
