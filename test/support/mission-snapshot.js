// The canonical mission snapshot (ADR-0089, increment 1, step 1). Test support: never shipped, never
// in the verdict path, imports nothing from `src/` or `dist/`.
//
// A snapshot is what the verdict depends on, written down so that two trees can be compared without
// running anything:
//
//   - `files`: every regular file under the project root (the parent of `runward/`), as a map from a
//     POSIX path to its bytes, sorted. `.git/` and `node_modules/` are left out. This is a superset of
//     what the verdict reads (the mission plus the evidence its rows cite, both inside the root).
//     Text is normalised the way the seal and the corpus hash already normalise it (`evidence.ts`
//     `sha256`, `scaffold-lock.ts` `hashText`): a file with no NUL byte has CRLF folded to LF, a file
//     with a NUL byte keeps its bytes. A Windows checkout and a POSIX checkout of one commit therefore
//     have one snapshot.
//   - `version`: the runward version that judges it (`package.json`).
//   - `templates`: the SHA-256 of every file under `templates/`, which the verdict compares
//     deliverables and rules against (`artifactState`, `corpusDivergence`).
//   - `markersAbove`: the repository markers found above the project root, which move the root the
//     verdict resolves pointers against (`repoRootAbove` in `evidence.ts`).
//
// ADR-0054's contract in its exact form is "same tree and same runward version, same verdict"; the
// snapshot is that sentence as data, and `test/unit/verdict-metamorphic.test.js` asserts it.
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep as platformSep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKIP_DIRS = new Set([".git", "node_modules"]);
// The markers `repoRootAbove` looks for, and its depth. Restated, not imported: this module must not
// share code with what it describes.
const MARKERS = [".git", "pnpm-workspace.yaml", "lerna.json", "turbo.json", "nx.json"];
const MARKER_DEPTH = 24;

/** A path relative to the root, in the snapshot's spelling: forward slashes whatever the platform. */
export function toSnapshotPath(rel, sep = platformSep) {
  return rel.split(sep).join("/");
}

/** The snapshot's normalisation of one file's bytes. */
export function normaliseBytes(buf) {
  if (buf.includes(0)) return Buffer.from(buf);
  return Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Every regular file under `dir`, raw bytes, keyed by snapshot path, sorted. Symlinks are refused:
 *  the generated missions carry none, and a snapshot that followed one would read outside the tree. */
export function readTree(dir) {
  const out = new Map();
  const walk = (abs) => {
    for (const name of readdirSync(abs).sort()) {
      const p = join(abs, name);
      const st = lstatSync(p);
      if (st.isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p); continue; }
      if (st.isSymbolicLink()) throw new Error(`a snapshot does not follow symlinks: ${p}`);
      if (st.isFile()) out.set(toSnapshotPath(relative(dir, p)), readFileSync(p));
    }
  };
  walk(dir);
  return sortTree(out);
}

/** A tree (path to bytes) with its keys in code-point order, which is the snapshot's order. */
export function sortTree(tree) {
  return new Map([...tree.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

let templates = null;
/** Read once per process: the templates are the installed package's, not the mission's. */
function templateDigests() {
  templates ??= Object.fromEntries([...readTree(join(ROOT, "templates"))].map(([p, b]) => [p, sha256(b)]));
  return templates;
}

function markersAbove(dir) {
  const found = [];
  let d = dirname(dir);
  for (let depth = 1; depth <= MARKER_DEPTH; depth++) {
    for (const m of MARKERS) if (existsSync(join(d, m))) found.push({ depth, marker: m });
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return found;
}

/** The snapshot of a tree already in memory. `above` is the marker list of where it would live. */
export function snapshotOfTree(tree, above = []) {
  const files = new Map([...sortTree(tree)].map(([p, b]) => [p, normaliseBytes(b)]));
  return {
    version: JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version,
    templates: templateDigests(),
    markersAbove: above,
    files,
  };
}

/** The snapshot of a project directory (the parent of `runward/`). */
export function snapshot(dir) {
  return snapshotOfTree(readTree(dir), markersAbove(dir));
}

/** Write a tree (or a snapshot's files) into `dir`, which must be empty or absent. */
export function materialize(treeOrSnapshot, dir) {
  const files = treeOrSnapshot instanceof Map ? treeOrSnapshot : treeOrSnapshot.files;
  mkdirSync(dir, { recursive: true });
  if (readdirSync(dir).length) throw new Error(`materialize writes into an empty directory: ${dir}`);
  for (const [p, b] of files) {
    if (p.startsWith("/") || p.split("/").includes("..")) throw new Error(`not a relative snapshot path: ${p}`);
    const abs = join(dir, ...p.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, b);
  }
}

/** One string for a snapshot: equal strings, equal snapshots. File bytes enter as digests. */
export function renderSnapshot(s) {
  return JSON.stringify({
    version: s.version,
    templates: s.templates,
    markersAbove: s.markersAbove,
    files: Object.fromEntries([...s.files].map(([p, b]) => [p, sha256(b)])),
  });
}

/** A value with every object's keys sorted and every list sorted by its own canonical rendering, so a
 *  result that holds "up to list order" compares byte for byte. Multiplicity is kept: sorting a list
 *  never merges two equal entries. */
export function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical).map((v) => [JSON.stringify(v), v])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}

/** The canonical rendering of a `Verdict` (or of any result): one string, every list sorted. */
export function renderVerdict(v) {
  return JSON.stringify(canonical(v));
}
