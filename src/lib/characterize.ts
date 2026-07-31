import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { deriveAll } from "./territory.js";
import { readTerritoryMap, applyTerritoryMap } from "./territory-map.js";

/**
 * Deterministic, read-only characterization of an existing codebase (ADR-0014).
 * It PARSES artifacts at rest — dependency manifests and lockfiles (pinned versions),
 * nested workspace manifests, CI config, infra/config signals, tests, git-log shape
 * (age, churn, authors) — and never runs, builds, installs, or writes to the target.
 * No LLM: two runs on the same commit agree (every filesystem scan is sorted). The
 * output is `confidence: high` facts, never decisions; reconstructing the *why* is the
 * operator's job (ADR-0013). See ADR-0034/0035/0036/0037/0038 for the extensions.
 */

export interface EcosystemInfo {
  name: string;
  manifest: string;
  lockfile: string | null;
  runtimeDeps: number;
  devDeps: number;
  depNames: string[];
  // ADR-0035: a bounded, sorted sample of resolved versions read from the lockfile (offline), + total.
  pinnedVersions?: { sample: string[]; total: number };
}

// ADR-0034: a dependency manifest found below the root (monorepo / workspace sub-package).
export interface SubPackage { path: string; ecosystem: string }
// ADR-0036: a churn hotspot — raw counts, never an interpretation.
export interface Hotspot { path: string; changes: number; authors: number }

export interface Inventory {
  root: string;
  ecosystems: EcosystemInfo[];
  subPackages: SubPackage[];        // ADR-0034
  workspaceMarkers: string[];       // ADR-0034
  entrypoints: string[];
  ci: string[];
  containers: string[];
  infra: string[];                  // ADR-0037
  frameworkConfig: string[];        // ADR-0037
  tests: { dirs: string[]; files: number };
  git: { commits: number; first: string; last: string; authors: number; hotspots: Hotspot[]; churnRead: boolean } | null; // ADR-0036
  fileCount: number;
  subPackagesCapped: boolean;       // ADR-0034: true if the sub-package list was capped
}

/** Territory coverage — the instrument ADR-0043's trigger (b) needs and that `rules --for`
 *  structurally cannot be: it only ever sees the paths its caller hands it, so it can never say
 *  which map rows matched NO file. `characterize` already walks the tree under a bounded,
 *  SKIP_DIRS-pruned traversal and exists to state facts about an inventory at rest, so the
 *  measure belongs here — read at a groom, not per pull request. Counts, never interpretation. */
export interface TerritoryCoverage {
  walked: number;                   // files considered
  covered: number;                  // files carrying at least one category
  byCategory: Array<{ category: string; files: number }>;
  /** Map rows that matched no walked file. This is the FSE-style rot signal: a declaration that
   *  affects nothing, kept because deleting it silently would lose the record that it was made. */
  inertRows: Array<{ line: number; pattern: string; category: string }>;
  mapRows: number;
  mapPresent: boolean;
}

const SKIP_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "out", "coverage", "vendor",
  ".next", ".nuxt", ".venv", "venv", "__pycache__", "target", ".turbo", ".cache",
  ".terraform", // vendored third-party modules after `terraform init` — not the repo's own IaC
]);

// Deterministic string order: plain code-unit comparison. NEVER localeCompare — its result
// depends on the machine's system locale (ICU + LANG/LC_ALL), which breaks "same repo,
// same output" across machines (ADR-0034's byte-for-byte contract).
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
// Posix-stable relative paths: identical output on Windows and POSIX (ADR-0034).
const toPosix = (p: string): string => p.split("\\").join("/");

const SUB_PACKAGE_CAP = 50;
const SUB_PACKAGE_DEPTH = 3;
const PINNED_SAMPLE_CAP = 12;
const HOTSPOT_CAP = 10;
const PER_FAMILY_CAP = 6;
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

/** Bounded recursive walk (skips heavy dirs, caps depth) — read-only.
 *  Sorted (readdirSync order is filesystem-dependent) and symlink-safe: lstat, never
 *  followed — a versioned symlink's TARGET varies by machine, so traversing it would
 *  break determinism (and can escape the repo or loop). The link itself is a file fact. */
function walk(dir: string, depth: number, onFile: (path: string, name: string) => void): void {
  if (depth < 0) return;
  let entries: string[];
  try { entries = readdirSync(dir).sort(); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try { st = lstatSync(p); } catch { continue; }
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

// ── Cross-language dependency-name extraction (ADR-0038) — at rest, offline ──

function pyDepNames(root: string, manifest: string): string[] {
  const names = new Set<string>();
  try {
    if (manifest === "requirements.txt") {
      for (const raw of readFileSync(join(root, "requirements.txt"), "utf8").split("\n")) {
        const l = raw.trim();
        if (!l || l.startsWith("#") || l.startsWith("-")) continue;
        // VCS/URL requirement lines (git+https://…, https://…#egg=x) would match their scheme
        // prefix and record a literal "git"/"http" as a dependency — skip them, name unknown at rest.
        if (/^(?:git\+|hg\+|svn\+|bzr\+|https?:\/\/|ssh:|file:)/i.test(l)) continue;
        const m = l.match(/^([A-Za-z0-9._-]+)/);
        if (m) names.add(m[1]);
      }
    } else if (manifest === "pyproject.toml") {
      const text = readFileSync(join(root, "pyproject.toml"), "utf8");
      // Scoped to the [project] section's `dependencies = [...]` array — a bare quoted-string scan
      // over the whole file also captures the project's own name, build requires, tool config…
      // and a fabricated dependency list is not a fact.
      // No /m flag: `$` must mean end-of-INPUT here (with /m it matches every line end and the
      // lazy capture collapses to empty). `(?:^|\n)` stands in for the line anchor.
      const projSec = text.match(/(?:^|\n)\[project\]([\s\S]*?)(?=\n\[|$)/);
      if (projSec) {
        const arr = projSec[1].match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m);
        if (arr) for (const m of arr[1].matchAll(/["']\s*([A-Za-z0-9._-]+)/g)) names.add(m[1]);
      }
      const poetry = text.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/);
      if (poetry) for (const m of poetry[1].matchAll(/^\s*([A-Za-z0-9._-]+)\s*=/gm)) if (m[1].toLowerCase() !== "python") names.add(m[1]);
    }
  } catch { /* unreadable */ }
  return [...names];
}

function goDepNames(root: string): string[] {
  const names = new Set<string>();
  try {
    for (const raw of readFileSync(join(root, "go.mod"), "utf8").split("\n")) {
      const m = raw.match(/^\s+([\w.\-/]+)\s+v\d/);
      if (m) names.add(m[1]);
    }
  } catch { /* unreadable */ }
  return [...names];
}

function tomlDepNames(root: string, file: string): string[] {
  const names = new Set<string>();
  try {
    const text = readFileSync(join(root, file), "utf8");
    for (const m of text.matchAll(/\[(?:dev-)?dependencies\]([\s\S]*?)(?=\n\[|$)/g)) {
      for (const line of m[1].matchAll(/^\s*([A-Za-z0-9._-]+)\s*=/gm)) names.add(line[1]);
    }
  } catch { /* unreadable */ }
  return [...names];
}

function mavenDepNames(root: string): string[] {
  const names = new Set<string>();
  try {
    const text = readFileSync(join(root, "pom.xml"), "utf8");
    // Scoped to <dependencies> blocks — a whole-file <artifactId> scan also captures the
    // project's own artifactId, its <parent> and its <plugin>s, which are not dependencies.
    for (const dm of text.matchAll(/<dependencies>([\s\S]*?)<\/dependencies>/g)) {
      for (const m of dm[1].matchAll(/<artifactId>\s*([\w.\-]+)\s*<\/artifactId>/g)) names.add(m[1]);
    }
  } catch { /* unreadable */ }
  return [...names];
}

// ── Pinned-version extraction from the detected lockfile (ADR-0035) — offline, best-effort ──

function pinnedVersions(root: string, lockfile: string, prefer: string[]): { sample: string[]; total: number } | undefined {
  let pairs: Array<[string, string]> = [];
  try {
    const text = readFileSync(join(root, lockfile), "utf8");
    if (lockfile === "package-lock.json" || lockfile === "composer.lock") {
      const json = JSON.parse(text);
      if (lockfile === "package-lock.json") {
        const pkgs = json.packages ?? {};
        for (const [k, v] of Object.entries<any>(pkgs)) {
          if (!k || !v || typeof v.version !== "string") continue;
          const name = k.replace(/^.*node_modules\//, "");
          if (name) pairs.push([name, v.version]);
        }
        if (pairs.length === 0 && json.dependencies) {
          for (const [name, v] of Object.entries<any>(json.dependencies)) if (v && typeof v.version === "string") pairs.push([name, v.version]);
        }
      } else {
        for (const p of [...(json.packages ?? []), ...(json["packages-dev"] ?? [])]) {
          if (p && typeof p.name === "string" && typeof p.version === "string") pairs.push([p.name, p.version]);
        }
      }
    } else if (/Cargo\.lock|poetry\.lock|uv\.lock/.test(lockfile)) {
      // [[package]]\nname = "x"\nversion = "y" — the same TOML block shape for all three.
      let name: string | null = null;
      for (const raw of text.split("\n")) {
        const n = raw.match(/^name\s*=\s*"([^"]+)"/); if (n) { name = n[1]; continue; }
        const v = raw.match(/^version\s*=\s*"([^"]+)"/); if (v && name) { pairs.push([name, v[1]]); name = null; }
      }
    } else if (lockfile === "Pipfile.lock") {
      // Plain JSON: {"default": {"flask": {"version": "==2.0.1"}}, "develop": {...}}.
      const json = JSON.parse(text);
      for (const sec of ["default", "develop"]) {
        for (const [name, v] of Object.entries<any>(json[sec] ?? {})) {
          if (v && typeof v.version === "string") pairs.push([name, v.version.replace(/^==/, "")]);
        }
      }
    } else if (lockfile === "go.sum") {
      // go.sum is a CHECKSUM DATABASE, not a pin record: it lists every version ever present in
      // the module graph (often several per module), so reading it as "the resolved set" would be
      // false. The pinned requirement set lives in go.mod — read the versions there (offline fact).
      for (const raw of readFileSync(join(root, "go.mod"), "utf8").split("\n")) {
        const m = raw.match(/^\s+([\w.\-/]+)\s+(v\d\S*)/);
        if (m) pairs.push([m[1], m[2]]);
      }
    } else if (lockfile === "Gemfile.lock") {
      for (const raw of text.split("\n")) { const m = raw.match(/^\s{4}([\w.-]+)\s+\(([^)]+)\)/); if (m) pairs.push([m[1], m[2]]); }
    } else if (lockfile === "yarn.lock") {
      // v1: `express@^4.16.0, express@^4.17.1:` then `  version "4.18.2"`.
      // berry: `"express@npm:^4.18.2":` then `  version: 4.18.2`.
      // The RESOLVED version is on the indented `version` line — the entry header carries the
      // requested RANGE, which must never be reported as the pin.
      let current: string | null = null;
      for (const raw of text.split("\n")) {
        if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
        if (!/^\s/.test(raw)) {
          const head = raw.replace(/:\s*$/, "").split(",")[0].trim().replace(/^"|"$/g, "");
          const at = head.lastIndexOf("@");
          current = at > 0 ? head.slice(0, at) : null; // lastIndexOf keeps scoped names (@babel/core) intact
        } else if (current) {
          const v = raw.match(/^\s+version:?\s*"?([^"\s]+)"?\s*$/);
          if (v) { pairs.push([current, v[1]]); current = null; }
        }
      }
    } else if (lockfile === "pnpm-lock.yaml") {
      // Entries are INDENTED under `packages:` — v5 `/name/1.2.3:`, v6 `/name@1.2.3:`,
      // v9 `name@1.2.3:` (possibly quoted, possibly with peer-suffix parens).
      for (const raw of text.split("\n")) {
        const m = raw.match(/^\s+["']?\/?((?:@[\w.-]+\/)?[\w.-]+)[@/](\d[\w.+-]*)(?:\([^)]*\))*["']?:\s*$/);
        if (m) pairs.push([m[1], m[2]]);
      }
    } else if (lockfile === "bun.lock") {
      // JSONC; package entries look like `"express": ["express@4.18.2", …]`.
      for (const m of text.matchAll(/"((?:@[\w.-]+\/)?[\w.-]+)":\s*\[\s*"\1@(\d[\w.+-]*)"/g)) pairs.push([m[1], m[2]]);
    } else {
      // Unrecognised format (bun.lockb is binary; gradle.lockfile has its own grammar…):
      // degrade to "lockfile present, versions unread" (ADR-0035) — never a guessed scan.
      return undefined;
    }
  } catch { return undefined; }
  if (pairs.length === 0) return undefined;
  // Dedupe by name (first version wins), then prefer direct deps, then sort by name.
  const byName = new Map<string, string>();
  for (const [n, v] of pairs) if (!byName.has(n)) byName.set(n, v);
  const preferSet = new Set(prefer);
  const all = [...byName.entries()].sort((a, b) => byCodeUnit(a[0], b[0]));
  const direct = all.filter(([n]) => preferSet.has(n));
  const picked = (direct.length ? direct : all).slice(0, PINNED_SAMPLE_CAP);
  return { sample: picked.map(([n, v]) => `${n}@${v}`), total: byName.size };
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
    const lockfile = firstExisting(root, ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"]);
    out.push({
      name: "Node / JavaScript / TypeScript",
      manifest: "package.json",
      lockfile,
      runtimeDeps: runtime, devDeps: dev, depNames: names,
      pinnedVersions: lockfile ? pinnedVersions(root, lockfile, names) : undefined,
    });
  }

  // Python — names now extracted (ADR-0038).
  const pyManifest = firstExisting(root, ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"]);
  if (pyManifest) {
    const names = pyDepNames(root, pyManifest);
    let runtime = names.length;
    if (pyManifest === "requirements.txt" && runtime === 0) {
      try { runtime = readFileSync(join(root, "requirements.txt"), "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).length; } catch { /* unreadable */ }
    }
    const lockfile = firstExisting(root, ["poetry.lock", "uv.lock", "Pipfile.lock"]);
    out.push({ name: "Python", manifest: pyManifest, lockfile, runtimeDeps: runtime, devDeps: 0, depNames: names, pinnedVersions: lockfile ? pinnedVersions(root, lockfile, names) : undefined });
  }

  // Go — names now captured from go.mod (ADR-0038).
  if (existsSync(join(root, "go.mod"))) {
    const names = goDepNames(root);
    const lockfile = firstExisting(root, ["go.sum"]);
    out.push({ name: "Go", manifest: "go.mod", lockfile, runtimeDeps: names.length, devDeps: 0, depNames: names, pinnedVersions: lockfile ? pinnedVersions(root, lockfile, names) : undefined });
  }

  // Rust, Java, Ruby, PHP — presence + lockfile, with names where cheaply available at rest (ADR-0038).
  const simple: Array<[string, string, string[], (r: string) => string[]]> = [
    ["Rust", "Cargo.toml", ["Cargo.lock"], (r) => tomlDepNames(r, "Cargo.toml")],
    ["Java (Maven)", "pom.xml", [], (r) => mavenDepNames(r)],
    ["Java (Gradle)", "build.gradle", ["gradle.lockfile"], () => []],
    ["Ruby", "Gemfile", ["Gemfile.lock"], () => []],
    ["PHP", "composer.json", ["composer.lock"], () => []],
  ];
  for (const [name, manifest, locks, extract] of simple) {
    if (existsSync(join(root, manifest))) {
      const names = extract(root);
      const lockfile = firstExisting(root, locks);
      out.push({ name, manifest, lockfile, runtimeDeps: names.length, devDeps: 0, depNames: names, pinnedVersions: lockfile ? pinnedVersions(root, lockfile, names) : undefined });
    }
  }

  return out;
}

// ── Monorepo / workspace discovery (ADR-0034) ──

const MANIFEST_ECO: Record<string, string> = {
  "package.json": "Node / JS / TS", "pyproject.toml": "Python", "requirements.txt": "Python",
  "setup.py": "Python", "Pipfile": "Python", "go.mod": "Go", "Cargo.toml": "Rust",
  "pom.xml": "Java (Maven)", "build.gradle": "Java (Gradle)", "build.gradle.kts": "Java (Gradle)",
  "Gemfile": "Ruby", "composer.json": "PHP",
};

function detectSubPackages(root: string): { subPackages: SubPackage[]; capped: boolean } {
  const found = new Map<string, string>(); // relPath -> ecosystem
  walk(root, SUB_PACKAGE_DEPTH, (p, name) => {
    const eco = MANIFEST_ECO[name];
    if (!eco) return;
    const dir = p.slice(0, p.length - name.length - 1);
    if (dir === root) return; // root ecosystems handled separately
    const rel = toPosix(relative(root, p));
    if (!found.has(rel)) found.set(rel, eco);
  });
  const sorted = [...found.entries()].sort((a, b) => byCodeUnit(a[0], b[0])).map(([path, ecosystem]) => ({ path, ecosystem }));
  return { subPackages: sorted.slice(0, SUB_PACKAGE_CAP), capped: sorted.length > SUB_PACKAGE_CAP };
}

function detectWorkspaceMarkers(root: string): string[] {
  const out = new Set<string>();
  for (const f of ["pnpm-workspace.yaml", "turbo.json", "nx.json", "go.work", "lerna.json", "rush.json"]) if (existsSync(join(root, f))) out.add(f);
  try { if (JSON.parse(readFileSync(join(root, "package.json"), "utf8")).workspaces) out.add("package.json (workspaces field)"); } catch { /* none */ }
  try { if (/^\s*\[workspace\]/m.test(readFileSync(join(root, "Cargo.toml"), "utf8"))) out.add("Cargo.toml ([workspace])"); } catch { /* none */ }
  for (const f of ["settings.gradle", "settings.gradle.kts"]) if (existsSync(join(root, f))) out.add(f);
  return [...out].sort();
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
  return [...found].sort();
}

function detectCI(root: string): string[] {
  const out: string[] = [];
  const wf = join(root, ".github", "workflows");
  if (existsSync(wf)) {
    // ADR-0034: sort — readdirSync order is filesystem-dependent; unsorted it breaks "two runs agree".
    try { for (const f of readdirSync(wf).sort()) if (/\.ya?ml$/.test(f)) out.push(`.github/workflows/${f}`); } catch { /* unreadable */ }
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

// ── Infrastructure & framework/DB config signals (ADR-0037) — presence only ──

function detectInfra(root: string): string[] {
  const out = new Set<string>();
  for (const f of ["Pulumi.yaml", "serverless.yml", "serverless.yaml", "template.yaml", "samconfig.toml", "kustomization.yaml", "skaffold.yaml"]) if (existsSync(join(root, f))) out.add(f);
  for (const d of ["k8s", "kubernetes"]) if (existsSync(join(root, d)) && safeIsDir(join(root, d))) out.add(`${d}/`);
  let tf = 0;
  walk(root, SUB_PACKAGE_DEPTH, (_p, name) => { if (/\.tf(\.json)?$/.test(name)) tf++; });
  if (tf) out.add(`Terraform (${tf} .tf file(s))`);
  return [...out].sort();
}

function detectFrameworkConfig(root: string): string[] {
  const out = new Set<string>();
  let entries: string[] = [];
  try { entries = readdirSync(root); } catch { /* unreadable */ }
  for (const e of entries) if (/^(next|vite|nuxt|svelte|astro|tailwind)\.config\.[mc]?[jt]s$/.test(e)) out.add(e);
  for (const f of ["tsconfig.json", "prisma/schema.prisma", "drizzle.config.ts", "drizzle.config.js", "alembic.ini", "knexfile.js", "knexfile.ts"]) if (existsSync(join(root, f))) out.add(f);
  return [...out].sort();
}

function safeIsDir(p: string): boolean {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function detectTests(root: string): { dirs: string[]; files: number } {
  const dirs = new Set<string>();
  let files = 0;
  for (const d of ["test", "tests", "__tests__", "spec"]) if (existsSync(join(root, d))) dirs.add(d);
  walk(root, 5, (_p, name) => {
    if (/\.(test|spec)\.[jt]sx?$/.test(name) || /_test\.go$/.test(name) || /^test_.*\.py$/.test(name) || /Test\.java$/.test(name)) files++;
  });
  return { dirs: [...dirs].sort(), files };
}

// ── Git shape, now with churn hotspots + bus-factor (ADR-0036) ──

// Machine-independent git reads: the user's ~/.gitconfig must not change the output
// (core.quotepath mangles non-ASCII paths into octal escapes; diff.renames alters
// --name-only; log.showSignature injects signature lines into --format output).
const GIT_CONFIG_PIN = ["-c", "core.quotepath=false", "-c", "diff.renames=true", "-c", "log.showSignature=false"];

function churnHotspots(root: string): Hotspot[] {
  const git = (args: string[]): string => execFileSync("git", [...GIT_CONFIG_PIN, "-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: GIT_MAX_BUFFER });
  const counts = new Map<string, number>();
  for (const line of git(["log", "--format=", "--name-only"]).split("\n")) {
    const p = line.trim();
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  // Deterministic order: by change count desc, then path asc (code-unit, locale-independent).
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || byCodeUnit(a[0], b[0])).slice(0, HOTSPOT_CAP);
  return top.map(([path, changes]) => {
    let authors = 0;
    try {
      const names = new Set(git(["log", "--format=%an", "--", path]).split("\n").map((l) => l.trim()).filter(Boolean));
      authors = names.size;
    } catch { authors = 0; }
    return { path, changes, authors };
  });
}

function gitShape(root: string): Inventory["git"] {
  const git = (args: string[]): string => execFileSync("git", [...GIT_CONFIG_PIN, "-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    git(["rev-parse", "--is-inside-work-tree"]); // throws if not a repo / git absent
    // A freshly `git init`-ed repo with zero commits is a REPO (an explicit brownfield target):
    // report it as such — `rev-list HEAD` would throw and falsely render "not a git repository".
    let commits = 0;
    try { commits = parseInt(git(["rev-list", "--count", "HEAD"]), 10) || 0; } catch { commits = 0; }
    if (commits === 0) return { commits: 0, first: "", last: "", authors: 0, hotspots: [], churnRead: true };
    const last = git(["log", "-1", "--format=%as"]);
    // With multiple root commits (merged unrelated histories — a frequent brownfield shape),
    // `-1` would return the MOST RECENT root; take the oldest of all roots (%as sorts lexically).
    const rootDates = git(["log", "--max-parents=0", "--format=%as"]).split("\n").filter(Boolean).sort();
    const first = rootDates[0] ?? "";
    const authors = git(["shortlog", "-sne", "HEAD"]).split("\n").filter((l) => l.trim()).length;
    // Churn is a separate, larger read: a failure there must not lose the basic shape —
    // but it is REPORTED (churnRead:false), never silently rendered as "no hotspots".
    let hotspots: Hotspot[] = [];
    let churnRead = true;
    try { hotspots = churnHotspots(root); } catch { hotspots = []; churnRead = false; }
    return { commits, first, last, authors, hotspots, churnRead };
  } catch {
    return null;
  }
}

/** Build the read-only inventory of an existing codebase. */
export function buildInventory(root: string): Inventory {
  let fileCount = 0;
  walk(root, 6, () => { fileCount++; });
  const { subPackages, capped } = detectSubPackages(root);
  return {
    root,
    ecosystems: detectEcosystems(root),
    subPackages,
    workspaceMarkers: detectWorkspaceMarkers(root),
    entrypoints: detectEntrypoints(root),
    ci: detectCI(root),
    containers: detectContainers(root),
    infra: detectInfra(root),
    frameworkConfig: detectFrameworkConfig(root),
    tests: detectTests(root),
    git: gitShape(root),
    fileCount,
    subPackagesCapped: capped,
  };
}

/** Measure territory coverage across the walked tree (ADR-0043 amendment). Returns null outside a
 *  mission: with no `runward/` there is no map and no rule set to measure against, and inventing a
 *  number would be worse than omitting the section. */
export function territoryCoverage(root: string): TerritoryCoverage | null {
  const walked: string[] = [];
  walk(root, 6, (p) => { walked.push(toPosix(relative(root, p))); });
  const mission = join(root, "runward");
  if (!existsSync(mission)) return null;

  const derived = deriveAll(root).bindings;
  const map = readTerritoryMap(mission);
  const { bindings, usedRows } = applyTerritoryMap(derived, map, walked);

  const byCat = new Map<string, Set<string>>();
  const coveredFiles = new Set<string>();
  for (const b of bindings) {
    if (!walked.includes(b.path)) continue;   // a binding onto a file the walk did not reach
    coveredFiles.add(b.path);
    if (!byCat.has(b.category)) byCat.set(b.category, new Set());
    byCat.get(b.category)!.add(b.path);
  }
  // A row that matched nothing across the WHOLE walked tree — the measure `--for` cannot make,
  // because it only ever sees the paths its caller passed.
  const inertRows = map.rows
    .filter((r) => !usedRows.has(r.line))
    .map((r) => ({ line: r.line, pattern: r.pattern, category: r.category as string }));

  return {
    walked: walked.length,
    covered: coveredFiles.size,
    byCategory: [...byCat.entries()].map(([category, files]) => ({ category, files: files.size }))
      .sort((a, b) => byCodeUnit(a.category, b.category)),
    inertRows,
    mapRows: map.rows.length,
    mapPresent: map.present,
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

  // ADR-0035: pinned versions read from the lockfile (offline). Facts — never "outdated"/"vulnerable".
  const withVersions = inv.ecosystems.filter((e) => e.pinnedVersions && e.pinnedVersions.sample.length);
  const unreadLocks = inv.ecosystems.filter((e) => e.lockfile && !(e.pinnedVersions && e.pinnedVersions.sample.length));
  if (withVersions.length || unreadLocks.length) {
    L.push("## Pinned versions (sample, from lockfiles)");
    L.push("");
    for (const e of withVersions) {
      const pv = e.pinnedVersions!;
      const note = pv.total > pv.sample.length ? ` _(sample of ${pv.sample.length} of ${pv.total} resolved)_` : "";
      L.push(`- **${e.name}**${note}: ${pv.sample.map((v) => `\`${v}\``).join(" · ")}`);
    }
    // ADR-0035: a format not recognised (or unparseable) degrades to a NAMED gap, never silence.
    for (const e of unreadLocks) {
      L.push(`- **${e.name}**: \`${e.lockfile}\` present — versions unread (format not parsed offline).`);
    }
    L.push("_Resolved versions read at rest (for Go: the pinned requirements in `go.mod` — `go.sum` is a checksum database, not the resolved set). Facts; whether a pin is stale is your call: no advisory/network lookup is done._");
    L.push("");
  }

  const withNames = inv.ecosystems.find((e) => e.depNames.length);
  if (withNames) {
    L.push(`## Runtime dependencies (${withNames.manifest})`);
    L.push("");
    L.push(withNames.depNames.map((n) => `\`${n}\``).join(" · "));
    L.push("");
  }

  // ADR-0034: sub-packages / workspaces — the dominant brownfield shape, invisible before.
  if (inv.subPackages.length || inv.workspaceMarkers.length) {
    L.push("## Sub-packages / workspaces");
    // (territory coverage is appended after the tree sections — see renderTerritory below)
    L.push("");
    if (inv.workspaceMarkers.length) {
      L.push(`- Workspace markers: ${inv.workspaceMarkers.map((m) => `\`${m}\``).join(", ")}`);
    }
    if (inv.subPackages.length) {
      // ADR-0034: every cap is disclosed, never a silent truncation — including the depth cap.
      L.push(`- Nested manifests (${inv.subPackages.length}${inv.subPackagesCapped ? `, capped at ${SUB_PACKAGE_CAP} — more exist` : ""}; scanned to depth ${SUB_PACKAGE_DEPTH} — deeper manifests are not listed):`);
      for (const s of inv.subPackages) L.push(`  - \`${s.path}\` — ${s.ecosystem}`);
    }
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

  // ADR-0037: infrastructure & framework/DB config — presence facts feeding the M2 architecture note.
  L.push("## Infrastructure & deployment (IaC)");
  L.push("");
  L.push(inv.infra.length ? inv.infra.map((f) => `- \`${f}\``).join("\n") : "_No infrastructure-as-code descriptor detected._");
  L.push("");

  L.push("## Framework / DB config");
  L.push("");
  L.push(inv.frameworkConfig.length ? inv.frameworkConfig.map((f) => `- \`${f}\``).join("\n") : "_No framework/DB config file detected._");
  L.push("");

  L.push("## Tests");
  L.push("");
  L.push(`- Test directories: ${inv.tests.dirs.length ? inv.tests.dirs.map((d) => `\`${d}/\``).join(", ") : "_none_"}`);
  L.push(`- Test files (by naming convention): **${inv.tests.files}**`);
  L.push("");

  L.push("## Git history (shape only)");
  L.push("");
  if (inv.git && inv.git.commits === 0) {
    L.push("- Git repository with **no commits yet** — no history shape to read.");
  } else if (inv.git) {
    L.push(`- Commits: **${inv.git.commits}** · Span: ${inv.git.first} → ${inv.git.last} · Distinct authors: **${inv.git.authors}**`);
    L.push("- Counts only — the log tells you *what* changed and *when*, rarely *why*. The *why* is a decision to reconstruct, not a fact to read.");
    if (!inv.git.churnRead) {
      L.push("- _Churn could not be read (history too large, or a git error) — hotspots omitted, not empty._");
    }
    if (inv.git.hotspots.length) {
      L.push("");
      L.push(`### Hotspots (churn — top ${inv.git.hotspots.length})`);
      L.push("");
      L.push("| File | Changes | Distinct authors |");
      L.push("|---|---|---|");
      for (const h of inv.git.hotspots) L.push(`| \`${h.path}\` | ${h.changes} | ${h.authors} |`);
      L.push("");
      L.push("_Raw counts, never a verdict: a hotspot is not a \"seam\" or a \"risk\" until you judge it one. High churn × low author count is a concentration fact, not a conclusion._");
    }
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
  // ADR-0038: the first-seen-in-git date — a fact about VISIBLE HISTORY (imports, squashes and
  // renames shift it), quoted as labeled evidence. Never the DRAFT's `**Date**`: the decision
  // date is unknown; the only date runward knows as a fact is the mining date.
  firstSeen?: string | null;
}

const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ADR-0038: families extended soberly to structurally decisive choices; cross-language names revived.
const DEP_FAMILIES: Array<{ match: RegExp; family: string }> = [
  { match: /^(express|fastify|koa|@nestjs\/core|next|nuxt|react|vue|svelte|@angular\/core|django|flask|fastapi|rails|sinatra|laravel|symfony|spring-boot|gin-gonic|github\.com\/gin-gonic)/i, family: "web framework / UI" },
  { match: /^(pg|mysql2?|mongodb|mongoose|@prisma\/client|prisma|typeorm|sequelize|redis|ioredis|sqlalchemy|gorm|diesel)/i, family: "data store / ORM" },
  { match: /^(bullmq|bull|amqplib|kafkajs|celery|sidekiq|nats)/i, family: "queue / messaging" },
  { match: /^(openai|@anthropic-ai\/sdk|anthropic|langchain|@langchain\/|llamaindex|@ai-sdk\/|cohere-ai)/i, family: "AI / model provider" },
  { match: /^(passport|next-auth|@auth\/|jsonwebtoken|jose|bcrypt|argon2|@clerk\/|pyjwt|python-jose|authlib|devise|omniauth|spring-security)/i, family: "auth / identity" },
  { match: /^(@opentelemetry\/|opentelemetry|prom-client|@sentry\/|sentry-sdk|sentry|datadog|dd-trace|winston|pino|structlog)/i, family: "observability / logging" },
  { match: /^(pulumi|@pulumi\/|aws-cdk|@aws-cdk\/|cdktf)/i, family: "infrastructure-as-code" },
  { match: /^(stripe|@stripe\/|braintree|@paypal\/|adyen)/i, family: "payment" },
  { match: /^(@aws-sdk\/|aws-sdk|@google-cloud\/|@azure\/|firebase)/i, family: "external service SDK" },
];

function firstSeen(root: string, file: string): string | null {
  try {
    const out = execFileSync("git", [...GIT_CONFIG_PIN, "-C", root, "log", "--diff-filter=A", "--reverse", "--format=%as", "--", file], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return out.split("\n")[0] || null;
  } catch { return null; }
}

/**
 * Slugs already RESOLVED by the operator — ADR-0038 idempotence: never resurrect one. Three
 * durable, content-derived signals (no mutable ledger): a ratified `ADR-NNNN-<slug>.md` filename,
 * an ADR carrying a `**Draft-slug**: <slug>` provenance line (kept on rename, so ratifying under
 * a different filename still resolves), and a `DRAFT-<slug>.md` marked `**Status**: rejected`
 * (the durable "not a decision" — deletion alone would only make the next `--mine` re-propose it).
 */
function resolvedSlugs(root: string): Set<string> {
  const set = new Set<string>();
  const dir = join(root, "runward", "adr");
  let files: string[] = [];
  try { files = readdirSync(dir); } catch { return set; }
  for (const f of files) {
    const ratified = f.match(/^ADR-\d+-(.+)\.md$/);
    if (ratified) set.add(ratified[1]);
    if (!/\.md$/.test(f)) continue;
    let body = "";
    try { body = readFileSync(join(dir, f), "utf8"); } catch { continue; }
    const prov = body.match(/^\*\*Draft-slug\*\*:\s*(\S+)/m);
    if (prov && /^ADR-\d+/.test(f)) set.add(prov[1]);
    const draft = f.match(/^DRAFT-(.+)\.md$/i);
    if (draft && /^\*\*Status\*\*:\s*rejected\b/im.test(body)) set.add(draft[1]);
  }
  return set;
}

/**
 * Propose *candidate* structural decisions from evidence at rest — deterministic, no model call.
 * Covers the stack/language choice, containerization, the CI pipeline, and notable dependency
 * families (one DRAFT per family — ADR-0038). Each is a hypothesis with provenance; the *why* is
 * left for the operator (ADR-0013). Candidates whose slug is already a ratified ADR are dropped.
 */
export function mineDrafts(root: string, inv: Inventory): MineCandidate[] {
  const out: MineCandidate[] = [];

  // One candidate per stack SLUG: "Java (Maven)" and "Java (Gradle)" share `stack-java`
  // (a migrating build is one stack decision) — merge their evidence instead of emitting a
  // duplicate slug the writer would silently drop from the announced count.
  const bySlug = new Map<string, MineCandidate>();
  for (const eco of inv.ecosystems) {
    const seen = firstSeen(root, eco.manifest);
    const firstWord = eco.name.split(/[ /]/)[0];
    const slug = `stack-${slugify(firstWord)}`;
    const evidence = [
      `\`${eco.manifest}\`${eco.lockfile ? ` + \`${eco.lockfile}\`` : " (no lockfile — unpinned)"}`,
      seen
        ? `first git trace ${seen} (first appearance of \`${eco.manifest}\` in visible history — imports, squashes or renames can shift it; not the decision date)`
        : "manifest at repo root",
    ];
    const prev = bySlug.get(slug);
    if (prev) {
      prev.title = `Adopt ${firstWord} as the core stack`;
      prev.evidence.push(...evidence);
      if (!prev.firstSeen && seen) prev.firstSeen = seen;
    } else {
      bySlug.set(slug, { slug, title: `Adopt ${eco.name} as the core stack`, evidence, firstSeen: seen });
    }
  }
  out.push(...bySlug.values());

  if (inv.containers.length) {
    out.push({ slug: "deployment-target", title: `Deploy/package via ${inv.containers[0]}`, evidence: inv.containers.map((f) => `\`${f}\``) });
  }
  if (inv.infra.length) {
    out.push({ slug: "infrastructure-as-code", title: "Manage infrastructure as code", evidence: inv.infra.map((f) => `\`${f}\``) });
  }
  // ADR-0037: a detected framework/DB config signal becomes a candidate too — a hypothesis
  // with provenance, never an asserted architecture.
  if (inv.frameworkConfig.length) {
    out.push({ slug: "framework-db-config", title: "Build on the detected framework / DB configuration", evidence: inv.frameworkConfig.map((f) => `\`${f}\``) });
  }
  if (inv.ci.length) {
    out.push({ slug: "ci-pipeline", title: "Gate delivery through a CI pipeline", evidence: inv.ci.map((f) => `\`${f}\``) });
  }

  // ADR-0038: one DRAFT per dependency family, members as evidence, per-family cap — not one per dep.
  const families = new Map<string, Set<string>>();
  for (const eco of inv.ecosystems) {
    for (const dep of eco.depNames) {
      const fam = DEP_FAMILIES.find((f) => f.match.test(dep));
      if (!fam) continue;
      if (!families.has(fam.family)) families.set(fam.family, new Set());
      const members = families.get(fam.family)!;
      if (members.size < PER_FAMILY_CAP) members.add(`\`${dep}\` in \`${eco.manifest}\``);
    }
  }
  for (const family of [...families.keys()].sort()) {
    out.push({
      slug: `deps-${slugify(family)}`,
      title: `Adopt ${family} dependencies`,
      evidence: [...families.get(family)!].sort(),
    });
  }

  // Idempotence (ADR-0038): drop any candidate the operator already resolved — ratified
  // (by filename or Draft-slug provenance) or rejected in place.
  const resolved = resolvedSlugs(root);
  return out.filter((c) => !resolved.has(c.slug));
}

/** Render one candidate as a DRAFT-*.md — a hypothesis with provenance, `why: UNKNOWN`, no verdict. */
export function renderDraft(cand: MineCandidate, generatedAt: string): string {
  const L: string[] = [];
  L.push(`# DRAFT — ${cand.title}`);
  L.push("");
  L.push("**Status**: hypothesis");
  // ADR-0038 (honest dating): `**Date**` is the MINING date — the only date runward knows as a
  // fact about the document it writes. The decision's real date is unknown; the git first-seen
  // is quoted in Evidence as a labeled trace, never promoted to Date. The operator confirms or
  // corrects Date at ratification. Keep the literal `**Date**` label — status.ts depends on it.
  L.push(`**Date**: ${generatedAt} (mining date — confirm or correct at ratification)`);
  L.push("**Deciders**: (unratified — the operator must own this)");
  L.push(`**Draft-slug**: ${cand.slug}`);
  L.push("");
  L.push("> Reconstructed by `runward characterize --mine` from evidence at rest — a **candidate decision**,");
  L.push("> not a fact. Ratify it: write the real *why* and the alternatives you rejected, set a re-evaluation");
  L.push("> trigger, put your name in Deciders, confirm or correct **Date**, set `Status: accepted`, and rename");
  L.push("> this file to `ADR-NNNN-<slug>.md` (keep the `**Draft-slug**` line — it is what lets `--mine` know");
  L.push("> this decision is resolved). Or, if it was never a real decision, set `**Status**: rejected` and");
  L.push("> KEEP the file: that records the no durably — deleting it would only make the next `--mine`");
  L.push("> re-propose it. `runward check --strict` stays red until you do one or the other.");
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
