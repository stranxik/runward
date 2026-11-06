#!/usr/bin/env node
// The release's SBOM, written from the package itself (ADR-0116, decision 2).
//
//   node scripts/package-sbom.mjs --tarball <runward-X.Y.Z.tgz> --lock <package-lock.json>
//                                 [--timestamp <ISO 8601 date-time>] [--out <file>]
//
// It reads the npm tarball and the lockfile of the commit the tarball was packed from, and writes a
// CycloneDX 1.6 JSON document: the package as `metadata.component` (name, version, purl, licence, the
// SHA-256 and SHA-512 of the tarball), every package the tarball bundles as a component (version, purl,
// declared licence, the SHA-512 of the registry tarball the lockfile names, its path in the package),
// and the dependency graph resolved inside the bundle.
//
// It refuses, with exit 1 and nothing written, a tarball whose bundle is not the lockfile's runtime
// tree: a package missing or added, another path, another version, another declared licence, a
// dependency the bundle cannot satisfy. That refusal is the check that what a user installs is what the
// release tested: the tests ran on the tree `npm ci` installed from this lockfile, and the bundle is
// packed from it. Exit 2: an input missing or unreadable.
//
// Deterministic: the same tarball, lockfile and timestamp give the same bytes, so anyone re-derives the
// release's SBOM from the tag and compares (docs/verifying-a-release.md, Step 10). The serial number is
// a name-based UUID (version 5) of the tarball's SHA-256; the timestamp is the one given (the release
// passes the commit's), and the document carries none when none is given. Node.js built-ins only: the
// release job that runs it installs nothing.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readTgz } from "./tgz.mjs";

export const SPEC_VERSION = "1.6";
const SCHEMA = "http://cyclonedx.org/schema/bom-1.6.schema.json";
const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"; // RFC 9562, the URL namespace
// Licence identifiers written as `license.id`; any other single identifier is written as a `name`, and
// an expression as an `expression`, so the document validates whatever a dependency declares.
const SPDX_IDS = new Set(["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "BlueOak-1.0.0",
  "MPL-2.0", "Unlicense", "CC0-1.0", "Python-2.0", "Zlib", "CC-BY-4.0", "BSD-3-Clause-Clear"]);

export class InputError extends Error {}

const hex = (alg, buf) => createHash(alg).update(buf).digest("hex");

/** A name-based UUID, version 5 (SHA-1), as RFC 9562 section 5.5 defines it. */
export function uuidV5(name, namespace = URL_NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest().subarray(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const s = h.toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** The purl of an npm package: the scope's `@` percent-encoded, the version too where it needs it. */
export function npmPurl(name, version) {
  const [scope, base] = name.startsWith("@") ? name.split("/") : [null, name];
  const ns = scope ? `${encodeURIComponent(scope)}/` : "";
  return `pkg:npm/${ns}${encodeURIComponent(base)}@${encodeURIComponent(version)}`;
}

/** A package.json `license` as CycloneDX licences, acknowledged as declared. */
export function licensesOf(license) {
  const text = typeof license === "string" ? license.trim() : typeof license?.type === "string" ? license.type.trim() : "";
  if (!text) return undefined;
  if (/[\s()]/.test(text)) return [{ expression: text, acknowledgement: "declared" }];
  if (SPDX_IDS.has(text)) return [{ license: { id: text, acknowledgement: "declared" } }];
  return [{ license: { name: text, acknowledgement: "declared" } }];
}

/** The hex SHA-512 of an npm integrity string (`sha512-<base64>`), or null. */
export function sha512OfIntegrity(integrity) {
  const m = String(integrity ?? "").split(/\s+/).map((s) => s.match(/^sha512-([A-Za-z0-9+/=]+)$/)).find(Boolean);
  return m ? Buffer.from(m[1], "base64").toString("hex") : null;
}

/**
 * The name an author field carries, as npm reads it: an object's `name` as written, and a
 * `"Name <email> (url)"` string up to its first `<` or `(` (`parsePerson` in normalize-package-data and
 * npm's own normalize-data). Until 2026-11-06 the address and the URL were cut out where they closed,
 * so an address left open (`"A <a@b"`) stayed in the name, an object's name lost what it held in
 * parentheses (`"James C. (Jamie) Davis"` became `"James C.  Davis"`), and the cut read the rest of
 * the field again from every `<` that did not close (3.2 s for 64,000 of them, RWD-2026-0208).
 */
export function authorName(author) {
  let name = "";
  if (typeof author === "string") {
    const cut = author.search(/[<(]/);
    name = cut === -1 ? author : author.slice(0, cut);
  } else if (typeof author?.name === "string") name = author.name;
  return name.trim() || null;
}

// `package/` + a chain of `node_modules/<name>/`, each name scoped or not, then `package.json`: the
// package roots of the bundle. A package.json deeper inside a package (`dist/esm/package.json`) is not one.
const BUNDLED_ROOT = /^package\/((?:node_modules\/(?:@[^/]+\/)?[^/]+\/)+)package\.json$/;

/** The package a path names: `node_modules/a/node_modules/@s/b` names `@s/b`. */
const nameAt = (path) => path.split("node_modules/").at(-1).replace(/\/$/, "");

/** Where Node.js finds `name` from the package at `from` (a lockfile path, "" for the root), among `have`. */
export function resolveFrom(from, name, have) {
  let dir = from;
  for (;;) {
    const candidate = `${dir ? `${dir}/` : ""}node_modules/${name}`;
    if (have.has(candidate)) return candidate;
    if (!dir) return null;
    const cut = dir.lastIndexOf("/node_modules/");
    dir = cut === -1 ? "" : dir.slice(0, cut);
  }
}

/** The lockfile's runtime tree: every installed package that is not a development one. */
export function runtimeTree(lock) {
  const out = new Map();
  for (const [path, entry] of Object.entries(lock?.packages ?? {})) {
    if (!path.startsWith("node_modules/") && !path.includes("/node_modules/")) continue;
    if (entry.dev || entry.devOptional || entry.link) continue;
    out.set(path, entry);
  }
  return out;
}

/**
 * The SBOM of a tarball, and every way its bundle differs from the lockfile. `problems` empty means
 * the bundle is the lockfile's runtime tree; the document is only meaningful then.
 */
export function packageSbom({ tarball, lock, timestamp = null }) {
  const files = readTgz(tarball);
  const byPath = new Map(files.map((f) => [f.path, f.data]));
  const readJson = (p) => {
    const d = byPath.get(p);
    if (!d) return null;
    try { return JSON.parse(d.toString("utf8")); } catch { throw new InputError(`${p} in the tarball is not JSON`); }
  };
  const root = readJson("package/package.json");
  if (!root || typeof root.name !== "string" || typeof root.version !== "string") throw new InputError("the tarball holds no package/package.json with a name and a version");
  if (!lock || typeof lock.packages !== "object" || lock.packages === null) throw new InputError("the lockfile has no `packages` map (lockfileVersion 2 or later)");
  let when = null;
  if (timestamp !== null) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) throw new InputError(`--timestamp is not a date-time: ${timestamp}`);
    when = d.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  const problems = [];
  const lockRoot = lock.packages[""] ?? {};
  if (lockRoot.name !== root.name || lockRoot.version !== root.version) {
    problems.push(`the lockfile is of ${lockRoot.name}@${lockRoot.version}, the tarball of ${root.name}@${root.version}`);
  }
  const declared = root.bundleDependencies ?? root.bundledDependencies;
  const runtimeNames = Object.keys(root.dependencies ?? {}).sort();
  const bundledNames = declared === true ? runtimeNames : Array.isArray(declared) ? [...declared].sort() : [];
  for (const n of runtimeNames) if (!bundledNames.includes(n)) problems.push(`the runtime dependency ${n} is not in bundleDependencies: an install would resolve it from the registry`);

  // What the tarball bundles, by path.
  const bundle = new Map();
  for (const f of files) {
    const m = f.path.match(BUNDLED_ROOT);
    if (!m) continue;
    const path = m[1].replace(/\/$/, "");
    bundle.set(path, readJson(f.path));
  }
  const tree = runtimeTree(lock);
  for (const [path, pkg] of bundle) {
    const entry = tree.get(path);
    const expected = nameAt(path);
    if (pkg?.name !== expected) problems.push(`${path}: its package.json names ${pkg?.name}, not ${expected}`);
    if (!entry) { problems.push(`${path}: bundled, and not in the lockfile's runtime tree`); continue; }
    if (pkg?.version !== entry.version) problems.push(`${path}: bundled at ${pkg?.version}, the lockfile says ${entry.version}`);
    if (entry.license !== undefined && pkg?.license !== undefined && JSON.stringify(entry.license) !== JSON.stringify(pkg.license)) {
      problems.push(`${path}: declares the licence ${JSON.stringify(pkg.license)}, the lockfile ${JSON.stringify(entry.license)}`);
    }
    if (!sha512OfIntegrity(entry.integrity)) problems.push(`${path}: the lockfile records no SHA-512 integrity for it`);
  }
  for (const [path, entry] of tree) {
    if (!bundle.has(path) && !entry.optional) problems.push(`${path}: in the lockfile's runtime tree (${entry.version}), and not bundled`);
  }

  // The graph, resolved inside the bundle as Node.js resolves it.
  const have = new Set(bundle.keys());
  const edges = (from, pkg) => {
    const out = new Set();
    const optional = pkg?.optionalDependencies ?? {};
    for (const name of Object.keys({ ...(pkg?.dependencies ?? {}), ...optional }).sort()) {
      const to = resolveFrom(from, name, have);
      if (to) out.add(to);
      else if (!(name in optional)) problems.push(`${from || root.name}: depends on ${name}, which the bundle does not carry`);
    }
    return [...out].sort();
  };

  const rootPurl = npmPurl(root.name, root.version);
  const base = root.name.split("/").at(-1);
  const repo = typeof root.repository === "string" ? root.repository : root.repository?.url;
  const externalReferences = [
    repo && { type: "vcs", url: repo },
    root.homepage && { type: "website", url: root.homepage },
    root.bugs?.url && { type: "issue-tracker", url: root.bugs.url },
    { type: "distribution", url: `https://registry.npmjs.org/${root.name}/-/${base}-${root.version}.tgz` },
  ].filter(Boolean);
  const rootAuthor = authorName(root.author);
  const component = {
    type: "application",
    "bom-ref": rootPurl,
    ...(rootAuthor ? { authors: [{ name: rootAuthor }] } : {}),
    name: root.name,
    version: root.version,
    ...(root.description ? { description: root.description } : {}),
    hashes: [{ alg: "SHA-256", content: hex("sha256", tarball) }, { alg: "SHA-512", content: hex("sha512", tarball) }],
    ...(licensesOf(root.license) ? { licenses: licensesOf(root.license) } : {}),
    purl: rootPurl,
    externalReferences,
  };

  const components = [...bundle.keys()].sort().map((path) => {
    const pkg = bundle.get(path) ?? {};
    const entry = tree.get(path) ?? {};
    const version = String(pkg.version ?? entry.version ?? "");
    const name = String(pkg.name ?? nameAt(path));
    const [group, short] = name.startsWith("@") ? name.split("/") : [null, name];
    const sha512 = sha512OfIntegrity(entry.integrity);
    const author = authorName(pkg.author);
    const licenses = licensesOf(pkg.license);
    return {
      type: "library",
      "bom-ref": path,
      ...(author ? { authors: [{ name: author }] } : {}),
      ...(group ? { group } : {}),
      name: short,
      version,
      scope: "required",
      ...(sha512 ? { hashes: [{ alg: "SHA-512", content: sha512 }] } : {}),
      ...(licenses ? { licenses } : {}),
      purl: npmPurl(name, version),
      ...(entry.resolved ? { externalReferences: [{ type: "distribution", url: entry.resolved }] } : {}),
      properties: [
        { name: "cdx:npm:package:bundled", value: "true" },
        { name: "cdx:npm:package:path", value: path },
      ],
    };
  });

  const dependencies = [
    { ref: rootPurl, dependsOn: edges("", root) },
    ...[...bundle.keys()].sort().map((path) => ({ ref: path, dependsOn: edges(path, bundle.get(path)) })),
  ];

  const bom = {
    $schema: SCHEMA,
    bomFormat: "CycloneDX",
    specVersion: SPEC_VERSION,
    serialNumber: `urn:uuid:${uuidV5(`${rootPurl}?sha256=${component.hashes[0].content}`)}`,
    version: 1,
    metadata: {
      ...(when ? { timestamp: when } : {}),
      lifecycles: [{ phase: "post-build" }],
      tools: { components: [{ type: "application", name: "runward-package-sbom", version: root.version,
        description: "scripts/package-sbom.mjs of the runward repository, at the commit the tarball was packed from" }] },
      component,
    },
    components,
    dependencies,
  };
  return { bom, problems };
}

/** The document as the release writes it: two-space JSON and a final newline. */
export const render = (bom) => `${JSON.stringify(bom, null, 2)}\n`;

function parseArgs(argv) {
  const keys = { "--tarball": "tarball", "--lock": "lock", "--timestamp": "timestamp", "--out": "out" };
  const opts = { tarball: null, lock: null, timestamp: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const k = keys[argv[i]];
    if (!k || i + 1 >= argv.length) throw new InputError(`unknown or incomplete argument: ${argv[i]}`);
    opts[k] = argv[++i];
  }
  if (!opts.tarball || !opts.lock) throw new InputError("--tarball <runward-X.Y.Z.tgz> and --lock <package-lock.json> are required");
  return opts;
}

const invokedDirectly = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) {
  let opts;
  let result;
  try {
    opts = parseArgs(process.argv.slice(2));
    let tarball, lock;
    try { tarball = readFileSync(opts.tarball); } catch { throw new InputError(`cannot read ${opts.tarball}`); }
    try { lock = JSON.parse(readFileSync(opts.lock, "utf8")); } catch { throw new InputError(`cannot read ${opts.lock} as JSON`); }
    result = packageSbom({ tarball, lock, timestamp: opts.timestamp });
  } catch (e) {
    console.error(`package-sbom: ${e.message}`);
    console.error("usage: node scripts/package-sbom.mjs --tarball <runward-X.Y.Z.tgz> --lock <package-lock.json> [--timestamp <date-time>] [--out <file>]");
    process.exit(2);
  }
  if (result.problems.length) {
    console.error(`package-sbom: the tarball's bundle is not the lockfile's runtime tree (${result.problems.length}); no SBOM written:`);
    for (const p of result.problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const text = render(result.bom);
  if (opts.out) writeFileSync(opts.out, text);
  else process.stdout.write(text);
  const c = result.bom.metadata.component;
  console.error(`package-sbom: ${c.name}@${c.version}, ${result.bom.components.length} bundled packages, CycloneDX ${SPEC_VERSION}${opts.out ? ` -> ${opts.out}` : ""}`);
}
