#!/usr/bin/env node
// Builds the qualification kit of one release: `runward-qualification-kit-X.Y.Z.tgz` (ADR-0087,
// decision 1).
//
// The kit is evidence material for the person who uses runward in a regulated process: the tests
// the requirements document cites, a runner that executes them against THEIR installation, the
// requirements document of that version, its open anomalies and the attack corpus. It decides
// nothing for anyone. Its README opens with that line, and the runner never prints a word that
// would say otherwise (ADR-0087, decision 4).
//
// Usage:
//   node scripts/build-qualification-kit.mjs --tarball <runward-X.Y.Z.tgz> [--ref <git ref>]
//       [--out <dir>] [--anomalies-ref <git ref>]
//
//   --tarball        the npm tarball of that version (in the release chain, the cross-checked
//                    builder tarball). The kit carries the SHA-256 of every file in it; the runner
//                    compares the installation against that list.
//   --ref            the tree the kit is built from (default HEAD). Every file of the kit except the
//                    runner and its README comes from this tree, read through git, so an untracked
//                    or modified file in the checkout can never enter a kit.
//   --anomalies-ref  where the defect register and `scripts/open-anomalies.mjs` are read from
//                    (default: --ref). A tree older than the register's machine-readable versions
//                    (ADR-0087, decision 6) has no anomaly list of its own; naming a later tree here
//                    lists, for the kit's version, what that later register knows. The manifest
//                    records which commit answered.
//   --out            the directory the .tgz is written to (default: the current directory).
//
// Determinism: entries are sorted, every mtime is the source commit's committer time, owners are
// zero, modes are 0644 (0755 for run.mjs), and the gzip header carries no time and no OS. Two builds
// of the same inputs are byte-identical, so the release's determinism cross-check (ADR-0049) extends
// to the kit.
//
// Case kinds and the source-tree marking are DERIVED here from the test files, never written by
// hand, so they cannot drift from what the tests do. The derivation is described next to
// `classifyCases`; where it is unsure it labels a case `internal` rather than `interface`.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, realpathSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname, resolve, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync, gzipSync, constants as zc } from "node:zlib";
import ts from "typescript";
import { withoutYamlCheck } from "./qualification-kit/run.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const KIT_SOURCES = join(HERE, "qualification-kit");
export const KIT_SCHEMA = 1;
export const TOR_DOC = "docs/compliance/tool-operational-requirements.md";

// ── git, read-only ─────────────────────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  return execFileSync("git", args, { cwd: opts.cwd ?? REPO, encoding: opts.encoding ?? "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

/** A read-only view of one commit's tree. */
export function treeAt(ref, cwd = REPO) {
  const commit = git(["rev-parse", "--verify", `${ref}^{commit}`], { cwd }).trim();
  const time = Number(git(["show", "-s", "--format=%ct", commit], { cwd }).trim());
  const paths = git(["ls-tree", "-r", "--name-only", "-z", commit], { cwd }).split("\0").filter(Boolean);
  const set = new Set(paths);
  return {
    commit,
    time,
    paths,
    has: (p) => set.has(p),
    read: (p) => git(["show", `${commit}:${p}`], { cwd, encoding: "buffer" }),
    text: (p) => git(["show", `${commit}:${p}`], { cwd }),
    topLevel: () => [...new Set(paths.map((p) => p.split("/")[0]))].sort(),
  };
}

// ── tar (ustar), read and write ───────────────────────────────────────────────────────────────

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Every regular file of a .tgz: [{ path, data }]. Handles ustar prefixes and pax path records. */
export function readTgz(buf) {
  const tar = gunzipSync(buf);
  const out = [];
  let off = 0, paxPath = null, longName = null;
  const str = (b, s, n) => b.subarray(s, s + n).toString("utf8").replace(/\0.*$/s, "");
  while (off + 512 <= tar.length) {
    const h = tar.subarray(off, off + 512);
    if (h.every((x) => x === 0)) break;
    const size = parseInt(str(h, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(h[156] || 48);
    const prefix = str(h, 345, 155);
    let name = (prefix ? `${prefix}/` : "") + str(h, 0, 100);
    const data = tar.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") { const m = data.toString("utf8").match(/\d+ path=([^\n]*)\n/); paxPath = m ? m[1] : null; continue; }
    if (type === "L") { longName = data.toString("utf8").replace(/\0.*$/s, ""); continue; }
    if (paxPath) { name = paxPath; paxPath = null; }
    if (longName) { name = longName; longName = null; }
    if (type === "0" || type === "\0") out.push({ path: name, data: Buffer.from(data) });
  }
  return out;
}

function octal(n, width) {
  return n.toString(8).padStart(width - 1, "0") + "\0";
}

/** One ustar header. Names over 100 bytes are split on a slash into prefix + name. */
function tarHeader(path, size, mode, mtime) {
  const h = Buffer.alloc(512);
  let name = path, prefix = "";
  if (Buffer.byteLength(path) > 100) {
    const cut = path.lastIndexOf("/", 155);
    if (cut <= 0 || Buffer.byteLength(path.slice(cut + 1)) > 100) throw new Error(`path too long for ustar: ${path}`);
    prefix = path.slice(0, cut); name = path.slice(cut + 1);
  }
  h.write(name, 0, 100, "utf8");
  h.write(octal(mode, 8), 100, 8, "ascii");
  h.write(octal(0, 8), 108, 8, "ascii");
  h.write(octal(0, 8), 116, 8, "ascii");
  h.write(octal(size, 12), 124, 12, "ascii");
  h.write(octal(mtime, 12), 136, 12, "ascii");
  h.fill(0x20, 148, 156);
  h.write("0", 156, 1, "ascii");
  h.write("ustar\0", 257, 6, "ascii");
  h.write("00", 263, 2, "ascii");
  h.write(prefix, 345, 155, "utf8");
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return h;
}

/** A deterministic .tgz: sorted entries, fixed mtime, zero owners, no time and no OS in gzip. */
export function writeTgz(entries, mtime) {
  const parts = [];
  for (const e of [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    parts.push(tarHeader(e.path, e.data.length, e.mode ?? 0o644, mtime), e.data);
    const pad = (512 - (e.data.length % 512)) % 512;
    if (pad) parts.push(Buffer.alloc(pad));
  }
  parts.push(Buffer.alloc(1024));
  const gz = gzipSync(Buffer.concat(parts), { level: zc.Z_BEST_COMPRESSION });
  gz.writeUInt32LE(0, 4); // MTIME: none
  gz[9] = 0xff; // OS: unknown, so a build on another platform gives the same bytes
  return gz;
}

// ── the requirements document ────────────────────────────────────────────────────────────────

/** Every citation of the requirements document: { tor, file, caseName, note }. The pattern is the
 *  one `test/unit/tor-traceability.test.js` checks, so the kit reads the document as its guard does. */
export function parseRequirements(text) {
  const out = [];
  for (const block of text.split(/^### /m).slice(1)) {
    const head = block.slice(0, block.indexOf("\n"));
    const id = (head.match(/^(TOR-\d{3})/) ?? [])[1];
    if (!id) continue;
    for (const m of block.matchAll(/\*\*Verified by\.\*\*\s*`([^`]+)`(?:\s*—\s*"([^"]+)")?([^\n]*)/g)) {
      const note = m[2] ? null : (m[3] ?? "").replace(/^\s*—\s*/, "").trim() || null;
      out.push({ tor: id, file: m[1], caseName: m[2] ?? null, note });
    }
  }
  return out;
}

// ── case classification, derived from the test source ────────────────────────────────────────
//
// For each cited case the builder takes the test call and, transitively, every top-level
// declaration of its file that the call names (helpers, fixtures, constants), plus the file's
// top-level `before`/`beforeEach` hooks. Over that closure:
//
//   internal   it names something imported from the package's `dist/` modules, or spells a path
//              into `dist/lib/` or `dist/commands/` (a module loaded by path). Counted wherever it
//              occurs, fixture included: the derivation does not judge which line is the assertion,
//              so a case whose fixture alone uses a module is labelled internal, never interface.
//   interface  otherwise, it runs the binary (`dist/cli.js`).
//   static     neither: it reads files as text.
//
// A case NEEDS THE SOURCE TREE when its closure reads, relative to the repository root, a path
// whose first segment exists at the top of the source tree but not in the installed package
// (`.github`, `docs`, `src`, `action.yml`, …) or the checkout's `node_modules`. "Relative to the
// root" is read from the code, not guessed from a word: a string argument after the root constant
// in a call (`join(ROOT, "docs", …)`), the root-prefixed template, a helper whose parameter is
// joined to the root, and an array of names iterated into one of those. Such a case is reported
// `not-run-here` with a pointer to the release's committed `reports/junit.xml`.
//
// A case NEEDS A PACKAGE when it imports one that the installation cannot provide: a bare specifier
// that is neither a Node built-in nor a runtime dependency of the installed runward (its package.json
// `dependencies`), nor runward itself. The import graph is read, not a list of names: the cited file's
// static imports (the file cannot load without them, so every case in it needs them), the dynamic
// `import("…")` calls inside the case's closure, and, transitively, every import of the test support
// files it reaches through relative imports (static or dynamic, whole file: the builder does not follow
// which helper is called). A support file's relative import into the source tree marks the case as
// needing the source tree, as the cited file's own does. Such a case is `not-run-here` too, with the
// package named and the same pointer, and is never counted as passed.

const BUILTINS = new Set(builtinModules);

/** The package a bare specifier names, or null for a relative, absolute, URL or built-in one. */
export function packageOf(spec) {
  if (!spec || spec.startsWith(".") || spec.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(spec)) return null;
  const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
  return BUILTINS.has(name) || BUILTINS.has(spec) ? null : name;
}

function isDynamicImport(n) {
  return ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments.length > 0;
}

const HOOKS = new Set(["before", "beforeEach"]);
const TEST_CALLEES = new Set(["test", "it"]);

function stringValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) return e.expression.text;
  return null;
}

function walk(node, fn) {
  fn(node);
  ts.forEachChild(node, (c) => walk(c, fn));
}

/** Top-level structure of one test file. */
function fileModel(text, fileName) {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const decls = new Map(); // name -> node
  const distImports = new Set();
  const relativeImports = []; // repository paths this file imports, resolved from its own place
  const packages = new Set(); // packages this file imports statically: it cannot load without them
  const hooks = [];
  const noteSpecifier = (spec) => {
    if (spec.startsWith("./") || spec.startsWith("../")) relativeImports.push(posix.normalize(posix.join(posix.dirname(fileName), spec)));
    const pkg = packageOf(spec);
    if (pkg) packages.add(pkg);
  };
  for (const st of sf.statements) {
    if (ts.isExportDeclaration(st) && st.moduleSpecifier) noteSpecifier(stringValue(st.moduleSpecifier) ?? "");
    else if (ts.isImportDeclaration(st)) {
      const spec = stringValue(st.moduleSpecifier) ?? "";
      noteSpecifier(spec);
      if (!/(^|\/)dist\//.test(spec)) continue;
      const cl = st.importClause;
      if (cl?.name) distImports.add(cl.name.text);
      const nb = cl?.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) distImports.add(nb.name.text);
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) distImports.add(el.name.text);
    } else if (ts.isFunctionDeclaration(st) && st.name) decls.set(st.name.text, st);
    else if (ts.isClassDeclaration(st) && st.name) decls.set(st.name.text, st);
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        walk(d.name, (n) => { if (ts.isIdentifier(n)) decls.set(n.text, d); });
      }
    } else if (ts.isExpressionStatement(st) && ts.isCallExpression(st.expression) && HOOKS.has(calleeName(st.expression) ?? "")) {
      hooks.push(st.expression);
    }
  }
  // The repository root: a top-level constant computed from this file's own URL, which is not the
  // binary's path.
  const rootNames = new Set();
  for (const [name, d] of decls) {
    if (!ts.isVariableDeclaration(d) || !d.initializer) continue;
    const init = d.initializer.getText(sf);
    if (init.includes("import.meta.url") && !init.includes("cli.js")) rootNames.add(name);
  }
  // Helpers that join one of their parameters to the root: name -> parameter index.
  const readers = new Map();
  for (const [name, d] of decls) {
    const fnNode = ts.isFunctionDeclaration(d) ? d
      : ts.isVariableDeclaration(d) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) ? d.initializer : null;
    if (!fnNode) continue;
    const params = fnNode.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : null));
    walk(fnNode, (n) => {
      if (!ts.isCallExpression(n)) return;
      const args = n.arguments;
      const k = args.findIndex((a) => ts.isIdentifier(a) && rootNames.has(a.text));
      if (k < 0) return;
      for (const a of args.slice(k + 1)) if (ts.isIdentifier(a) && params.includes(a.text)) readers.set(name, params.indexOf(a.text));
    });
  }
  // Every test call, by its literal name.
  const cases = [];
  walk(sf, (n) => {
    if (!ts.isCallExpression(n) || !TEST_CALLEES.has(calleeName(n) ?? "")) return;
    const first = n.arguments[0];
    const name = first ? stringValue(first) : null;
    if (name !== null) cases.push({ name, node: n });
  });
  // Every package named by a dynamic import anywhere in the file (read for support files only).
  const dynamicPackages = new Set();
  const dynamicRelative = [];
  walk(sf, (n) => {
    if (!isDynamicImport(n)) return;
    const s = stringValue(n.arguments[0]);
    if (s !== null && (s.startsWith("./") || s.startsWith("../"))) dynamicRelative.push(posix.normalize(posix.join(posix.dirname(fileName), s)));
    const pkg = s === null ? null : packageOf(s);
    if (pkg) dynamicPackages.add(pkg);
  });
  return { sf, decls, distImports, relativeImports, packages, dynamicPackages, dynamicRelative, hooks, rootNames, readers, cases };
}

/** The nodes a case depends on: the call, the hooks, and every top-level declaration reached. */
function closureOf(model, roots) {
  const seen = new Set();
  const nodes = [];
  const queue = [...roots];
  while (queue.length) {
    const n = queue.shift();
    if (seen.has(n)) continue;
    seen.add(n);
    nodes.push(n);
    walk(n, (x) => {
      if (!ts.isIdentifier(x)) return;
      const d = model.decls.get(x.text);
      if (d && !seen.has(d)) queue.push(d);
    });
  }
  return nodes;
}

/** String literals of an array initializer bound to a top-level name. */
function arrayLiterals(model, name) {
  const d = model.decls.get(name);
  if (!d || !ts.isVariableDeclaration(d) || !d.initializer || !ts.isArrayLiteralExpression(d.initializer)) return [];
  return d.initializer.elements.map(stringValue).filter((s) => s !== null);
}

/** The for-of iterable a loop variable comes from, when it is a top-level name. */
function loopSource(identifier) {
  for (let p = identifier.parent; p; p = p.parent) {
    if (ts.isForOfStatement(p) && ts.isVariableDeclarationList(p.initializer)) {
      const bound = p.initializer.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === identifier.text);
      if (bound && ts.isIdentifier(p.expression)) return p.expression.text;
    }
  }
  return null;
}

function classifyNodes(model, nodes, sourceOnly) {
  let internal = false, binary = false;
  const anchored = new Set();
  const packages = new Set();
  const anchor = (s) => { if (typeof s === "string" && s) anchored.add(s.replace(/^\.\//, "")); };
  for (const root of nodes) {
    walk(root, (n) => {
      if (ts.isIdentifier(n) && model.distImports.has(n.text) && !(ts.isImportSpecifier(n.parent))) internal = true;
      const s = stringValue(n);
      if (s !== null) {
        if (/(^|\/)dist\/(lib|commands)\//.test(s)) internal = true;
        if (/(^|\/)cli\.js$/.test(s)) binary = true;
      }
      if (ts.isTemplateExpression(n) && n.head.text === "" && n.templateSpans.length
        && ts.isIdentifier(n.templateSpans[0].expression) && model.rootNames.has(n.templateSpans[0].expression.text)) {
        anchor(n.templateSpans[0].literal.text.replace(/^\//, ""));
      }
      if (!ts.isCallExpression(n)) return;
      if (isDynamicImport(n)) { const pkg = packageOf(stringValue(n.arguments[0]) ?? ""); if (pkg) packages.add(pkg); }
      const args = n.arguments;
      // join(ROOT, "dist", "lib", …): a module reached by path.
      const vals = args.map(stringValue);
      for (let i = 0; i + 1 < vals.length; i++) if (vals[i] === "dist" && (vals[i + 1] === "lib" || vals[i + 1] === "commands")) internal = true;
      const k = args.findIndex((a) => ts.isIdentifier(a) && model.rootNames.has(a.text));
      if (k >= 0) {
        // join(ROOT, "templates", "targets", "AGENTS.md") names templates/targets/AGENTS.md: the
        // string arguments after the root are ONE path, read up to the first non-string.
        const parts = [];
        for (const a of args.slice(k + 1)) {
          const v = stringValue(a);
          if (v === null) {
            if (!parts.length && ts.isIdentifier(a)) { const src = loopSource(a); if (src) arrayLiterals(model, src).forEach(anchor); }
            break;
          }
          parts.push(v);
        }
        if (parts.length) anchor(parts.join("/"));
      }
      const callee = calleeName(n);
      if (callee && model.readers.has(callee) && ts.isIdentifier(n.expression)) {
        const a = args[model.readers.get(callee)];
        if (a) {
          const v = stringValue(a);
          if (v !== null) anchor(v);
          else if (ts.isIdentifier(a)) { const src = loopSource(a); if (src) arrayLiterals(model, src).forEach(anchor); }
        }
      }
      // NAMES.flatMap(reader) / .map / .forEach / .filter
      if (ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression)
        && ["map", "flatMap", "forEach", "filter", "some", "every"].includes(n.expression.name.text)
        && args[0] && ts.isIdentifier(args[0]) && model.readers.get(args[0].text) === 0) {
        arrayLiterals(model, n.expression.expression.text).forEach(anchor);
      }
    });
  }
  const needs = [...anchored].filter((p) => sourceOnly.has(p.split("/")[0])).sort();
  const kind = internal ? "internal" : binary ? "interface" : "static";
  return { kind, sourceTree: needs, packages: [...packages] };
}

/**
 * Classify every citation. `files` maps a test path (cited files and the support files they import)
 * to its source text; `sourceOnly` is the set of top-level names the source tree has and the installed
 * package does not; `available` is the set of packages an installation provides (the installed
 * runward's runtime dependencies and runward itself). Any other non-built-in package a case needs
 * makes it `not-run-here`.
 */
export function classifyCases(citations, files, sourceOnly, available = new Set()) {
  const models = new Map();
  const model = (f) => {
    if (!models.has(f)) models.set(f, files.has(f) ? fileModel(files.get(f), f) : null);
    return models.get(f);
  };
  // What a file needs through its imports, at file level: its source-tree imports and its static
  // packages, plus, for every support file it reaches, all of that file's imports. Memoised per file.
  const reach = new Map();
  const fileNeeds = (f) => {
    if (reach.has(f)) return reach.get(f);
    const tree = new Set(), pkgs = new Set();
    const seen = new Set([f]);
    const queue = [[f, true]];
    while (queue.length) {
      const [g, cited] = queue.shift();
      const gm = model(g);
      if (!gm) continue;
      for (const p of gm.packages) pkgs.add(p);
      if (!cited) for (const p of gm.dynamicPackages) pkgs.add(p);
      for (const r of cited ? gm.relativeImports : [...gm.relativeImports, ...gm.dynamicRelative]) {
        if (sourceOnly.has(r.split("/")[0])) tree.add(r);
        else if (!seen.has(r) && files.has(r)) { seen.add(r); queue.push([r, false]); }
      }
    }
    const out = { tree: [...tree], pkgs: [...pkgs] };
    reach.set(f, out);
    return out;
  };
  return citations.map((c) => {
    const m = model(c.file);
    if (!m) return { ...c, kind: null, sourceTree: [c.file], packages: [], basis: "the cited file is not a test the kit can carry" };
    // A file that imports a module of the source tree (a script, say), or a package the installation
    // does not have, cannot even load on an installation: every case in it needs that, whatever its
    // body reads. The same holds through the support files it imports.
    const needs = fileNeeds(c.file);
    const withImports = (r) => ({ ...r, sourceTree: [...new Set([...needs.tree, ...r.sourceTree])].sort(),
      packages: [...new Set([...needs.pkgs, ...r.packages])].filter((p) => !available.has(p)).sort() });
    if (c.caseName === null) {
      const r = withImports(classifyNodes(m, [m.sf], sourceOnly));
      return { ...c, ...r, basis: "file-level citation: the whole file" };
    }
    const hits = m.cases.filter((t) => t.name === c.caseName);
    if (!hits.length) throw new Error(`${c.tor}: "${c.caseName}" is not a test call in ${c.file}`);
    const r = withImports(classifyNodes(m, closureOf(m, [...hits.map((h) => h.node), ...m.hooks]), sourceOnly));
    return { ...c, ...r, basis: "the case, its hooks and the top-level declarations it names" };
  });
}

// ── the kit's contents ────────────────────────────────────────────────────────────────────────

/** Relative imports of a test file that stay inside test/ (helpers), transitively. */
function testClosure(tree, start) {
  const out = new Set();
  const queue = [...start];
  while (queue.length) {
    const f = queue.shift();
    if (out.has(f) || !tree.has(f)) continue;
    out.add(f);
    const text = tree.text(f);
    for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
      const target = posix.normalize(posix.join(posix.dirname(f), m[1]));
      if (target.startsWith("test/")) queue.push(target);
    }
  }
  return [...out].sort();
}

/** Corpus description, from the corpus file's own header and, when it exports them, its cases. */
async function corpusDescription(tree, version) {
  const text = tree.text("test/audit-corpus.js");
  const header = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("//")) break;
    header.push(line.replace(/^\/\/ ?/, ""));
  }
  const lines = [`# The attack corpus of runward ${version}`, "",
    "Generated by the kit builder from `test/audit-corpus.js` of the source commit. Run it from the kit with",
    "`node run.mjs`, or alone with `node tests/audit-corpus.js --cli <installed>/dist/cli.js --json -`",
    "(the `--json` option exists from the version that introduced it; an older corpus prints text only).", "",
    "## What the file says about itself", "", "```text", ...header, "```", ""];
  if (/^export const cases\b/m.test(text) && /invokedDirectly/.test(text)) {
    const dir = mkdtempSync(join(tmpdir(), "rw-kit-corpus-"));
    try {
      writeFileSync(join(dir, "audit-corpus.mjs"), text);
      const { cases } = await import(pathToFileURL(join(dir, "audit-corpus.mjs")).href);
      lines.push("## The cases", "", "| Id | Direction | Case | Origin |", "|---|---|---|---|");
      for (const c of cases) lines.push(`| ${c.id} | ${c.want} | ${c.name.replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} | ${(c.origin ?? []).join(", ")} |`);
      lines.push("", `${cases.length} cases. A pass means the case was handled as it was when its defect was fixed; the`,
        "total is a regression result on this fixed set, not a detection rate on vectors nobody has found.", "");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  } else {
    lines.push("This version's corpus has no stable identifiers or exported case list (they arrived with",
      "ADR-0087, decision 3); its cases are named in the file itself.", "");
  }
  return lines.join("\n");
}

/** Open anomalies for the version, generated by the register's own reader. */
function openAnomalies(tree, version) {
  const script = "scripts/open-anomalies.mjs", register = "docs/compliance/known-defects.md";
  if (!tree.has(script) || !tree.has(register)) {
    return { available: false, reason: `the tree at ${tree.commit} has no ${script}`, json: null };
  }
  const dir = mkdtempSync(join(tmpdir(), "rw-kit-anomalies-"));
  try {
    for (const p of [script, register]) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), tree.read(p)); }
    const json = execFileSync(process.execPath, [join(dir, script), version, "--json"], { encoding: "utf8" });
    return { available: true, reason: null, json: JSON.parse(json) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function anomaliesMarkdown(version, a, commit) {
  const out = [`# Open anomalies of runward ${version}`, ""];
  if (!a.available) {
    out.push(`Not generated: ${a.reason}. The defect register of that tree states its entries' versions in prose`,
      "only; read `docs/compliance/known-defects.md` at the source commit, or build the kit with",
      "`--anomalies-ref` naming a tree whose register carries machine-readable versions.", "");
    return out.join("\n");
  }
  const j = a.json;
  out.push(`Generated by \`scripts/open-anomalies.mjs ${version}\` from the defect register at commit \`${commit}\`,`,
    `which describes runward ${j.registerDescribes ?? "an unnamed version"}. An entry is open when it affected a version at or`,
    `before ${version} and was not fixed at or before it; undetermined when the register gives no version on one side.`, "");
  if (j.beyondRegister) out.push(`${version} is later than the version the register describes: defects found after it are not listed.`, "");
  for (const [title, list] of [["Open", j.open], ["Undetermined", j.undetermined]]) {
    out.push(`## ${title} (${list.length})`, "");
    if (!list.length) { out.push("None listed.", ""); continue; }
    out.push("| Id | Affected from | Fixed in | Summary | Workaround |", "|---|---|---|---|---|");
    for (const e of list) out.push(`| ${e.id} | ${e.affectedFrom} | ${e.fixedIn} | ${(e.summary ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} | ${(e.workaround ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`);
    out.push("");
  }
  return out.join("\n");
}

function parseArgs(argv) {
  const opts = { ref: "HEAD", tarball: null, out: ".", anomaliesRef: null };
  const keys = { "--ref": "ref", "--tarball": "tarball", "--out": "out", "--anomalies-ref": "anomaliesRef" };
  for (let i = 0; i < argv.length; i++) {
    const k = keys[argv[i]];
    if (!k || i + 1 >= argv.length) throw new UsageError(`unknown or incomplete argument: ${argv[i]}`);
    opts[k] = argv[++i];
  }
  if (!opts.tarball) throw new UsageError("--tarball <runward-X.Y.Z.tgz> is required");
  return opts;
}

class UsageError extends Error {}

/** Build the kit. Returns { file, name, sha256, manifest }. */
export async function buildKit({ ref = "HEAD", tarball, out = ".", anomaliesRef = null, repo = REPO }) {
  const tree = treeAt(ref, repo);
  const pkgJson = JSON.parse(tree.text("package.json"));
  const version = pkgJson.version;
  const tarBytes = readFileSync(tarball);
  const pkgFiles = readTgz(tarBytes)
    .filter((e) => e.path.startsWith("package/"))
    .map((e) => ({ path: e.path.slice("package/".length), sha256: sha256(e.data), size: e.data.length }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  const tarPkg = pkgFiles.find((f) => f.path === "package.json");
  if (!tarPkg) throw new Error(`${tarball} holds no package/package.json`);
  const tarPkgJson = JSON.parse(readTgz(tarBytes).find((e) => e.path === "package/package.json").data.toString("utf8"));
  const tarVersion = tarPkgJson.version;
  if (tarVersion !== version) throw new Error(`the tarball is runward ${tarVersion}, the tree at ${tree.commit} is ${version}: refusing to build a kit that pairs them`);
  if (!tree.has(TOR_DOC)) throw new Error(`the tree at ${tree.commit} has no ${TOR_DOC}`);

  const torText = tree.text(TOR_DOC);
  const citations = parseRequirements(torText);
  const citedFiles = [...new Set(citations.map((c) => c.file))].sort();
  const runnable = citedFiles.filter((f) => f.startsWith("test/") && f.endsWith(".js") && tree.has(f));
  const testFiles = testClosure(tree, [...runnable, "test/smoke.js", "test/audit-corpus.js"].filter((f) => tree.has(f)));
  // The classifier reads the text the runner will execute: smoke.js without its one js-yaml check,
  // which the runner removes and reports as skipped. A shape the runner does not recognise is read
  // as it is, so the js-yaml import then makes the smoke citations `not-run-here`.
  const runText = (f) => {
    const text = tree.text(f);
    if (f !== "test/smoke.js") return text;
    try { return withoutYamlCheck(text).text; } catch { return text; }
  };
  const sources = new Map([...new Set([...runnable, ...testFiles])].map((f) => [f, runText(f)]));
  const shippedTop = new Set(pkgFiles.map((f) => f.path.split("/")[0]));
  const sourceOnly = new Set([...tree.topLevel().filter((n) => !shippedTop.has(n) && n !== "test"), "node_modules"]);
  // What an installation provides: the tarball's own runtime dependencies, and runward itself (a
  // test can reach the package by its name from inside the work directory's package scope).
  const runtimeDependencies = Object.keys(tarPkgJson.dependencies ?? {}).sort();
  const available = new Set([...runtimeDependencies, tarPkgJson.name]);
  const devDependencies = Object.keys(pkgJson.devDependencies ?? {}).sort();
  const cases = classifyCases(citations, sources, sourceOnly, available);

  const fixtureRefs = tree.paths.filter((p) => p.startsWith("test/fixtures/")
    && testFiles.some((f) => tree.text(f).includes(p.slice("test/".length))));

  const root = `runward-qualification-kit-${version}`;
  const entries = [];
  const add = (path, data, mode) => entries.push({ path, data: Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8"), mode });
  for (const f of [...testFiles, ...fixtureRefs]) add(`tests/${f.slice("test/".length)}`, tree.read(f));
  add("run.mjs", readFileSync(join(KIT_SOURCES, "run.mjs")), 0o755);
  add("README.md", readFileSync(join(KIT_SOURCES, "README.md"), "utf8").replaceAll("{{VERSION}}", version).replaceAll("{{COMMIT}}", tree.commit));
  add("docs/tool-operational-requirements.md", tree.read(TOR_DOC));
  const aTree = anomaliesRef ? treeAt(anomaliesRef, repo) : tree;
  const anomalies = openAnomalies(aTree, version);
  add("docs/open-anomalies.md", anomaliesMarkdown(version, anomalies, aTree.commit));
  if (anomalies.available) add("docs/open-anomalies.json", JSON.stringify(anomalies.json, null, 2) + "\n");
  if (tree.has("test/audit-corpus.js")) add("docs/attack-corpus.md", await corpusDescription(tree, version));
  for (const p of tree.paths.filter((x) => x.startsWith("docs/compliance/qualification/"))) {
    add(`docs/qualification/${p.slice("docs/compliance/qualification/".length)}`, tree.read(p));
  }

  // The commit of the builder itself (this script, the runner and the README it copies). In the
  // release chain it is the source commit; it differs only when an older tree is built by a newer builder.
  const builderCommit = (() => { try { return git(["rev-parse", "HEAD"]).trim(); } catch { return null; } })();
  const manifest = {
    kit: "runward-qualification-kit",
    schemaVersion: KIT_SCHEMA,
    version,
    sourceCommit: tree.commit,
    builderCommit,
    requirements: {
      document: "docs/tool-operational-requirements.md",
      head: torText.split("\n").find((l) => l.startsWith("**Register date**")) ?? null,
      requirementCount: new Set(citations.map((c) => c.tor)).size,
      citationCount: citations.length,
    },
    anomalies: { available: anomalies.available, fromCommit: aTree.commit, reason: anomalies.reason },
    package: {
      name: pkgJson.name,
      version,
      tarball: { name: `runward-${version}.tgz`, sha256: sha256(tarBytes) },
      files: pkgFiles,
    },
    sourceTreeOnly: [...sourceOnly].sort(),
    runtimeDependencies,
    devDependencies,
    junitPointer: `https://github.com/stranxik/runward/blob/${tree.commit}/reports/junit.xml`,
    cases: cases.map((c) => ({
      tor: c.tor, file: c.file, case: c.caseName, note: c.note, kind: c.kind,
      runsHere: c.sourceTree.length === 0 && c.packages.length === 0, needs: c.sourceTree, needsPackages: c.packages, basis: c.basis,
    })),
    files: entries.map((e) => ({ path: e.path, sha256: sha256(e.data), size: e.data.length }))
      .sort((a, b) => (a.path < b.path ? -1 : 1)),
  };
  add("kit-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  const tgz = writeTgz(entries.map((e) => ({ ...e, path: `${root}/${e.path}` })), tree.time);
  mkdirSync(resolve(out), { recursive: true });
  const file = join(resolve(out), `${root}.tgz`);
  writeFileSync(file, tgz);
  return { file, name: `${root}.tgz`, sha256: sha256(tgz), manifest };
}

const invokedDirectly = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (!existsSync(opts.tarball)) throw new UsageError(`no such tarball: ${opts.tarball}`);
    const r = await buildKit(opts);
    const k = r.manifest.cases;
    const count = (pred) => k.filter(pred).length;
    console.log(`${r.name}  sha256:${r.sha256}`);
    console.log(`  source commit ${r.manifest.sourceCommit}, ${r.manifest.requirements.requirementCount} requirements, ${k.length} citations`);
    console.log(`  kinds: ${count((c) => c.kind === "interface")} interface, ${count((c) => c.kind === "internal")} internal, ${count((c) => c.kind === "static")} static; ${count((c) => c.needs.length > 0)} need the source tree, ${count((c) => c.needsPackages.length > 0)} need a package the installation does not have`);
    console.log(`  open anomalies: ${r.manifest.anomalies.available ? `from ${r.manifest.anomalies.fromCommit}` : r.manifest.anomalies.reason}`);
  } catch (e) {
    console.error(`build-qualification-kit: ${e.message}`);
    process.exit(e instanceof UsageError ? 2 : 1);
  }
}
