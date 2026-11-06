#!/usr/bin/env node
// runward-fleet build <fleet.json> [--out <dir>]
// runward-fleet verify-run <bundle|envelope> --policy <trust-policy.json> --repository <host/owner/repo>
//                          --commit <sha> [--ref <ref>] [--statement <run.intoto.json>] [--json]
//
// Reads fleet.json and the files it declares, verifies the declared signatures against the trust
// policy it names, and writes <dir>/index.json (runward-fleet-index/0) and <dir>/index.html (one
// page, the index inlined, nothing loaded from elsewhere). Exit codes: 0 written, 1 refused (a
// manifest or a policy it cannot read, a private path, a view rule broken; nothing is written),
// 2 a usage error. It reads no clock, opens no connection and spawns nothing.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BuildError, buildIndex } from "./build.js";
import { readPolicy } from "./trust.js";
import { REASON_TEXT, verifyRunSignature } from "./run-signature.js";
import { renderSite } from "./site.js";
import * as api from "../ui/views.js";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "usage: runward-fleet build <fleet.json> [--out <dir>]\n       runward-fleet verify-run <bundle|envelope> --policy <trust-policy.json> --repository <host/owner/repo> --commit <sha> [--ref <ref>] [--statement <run.intoto.json>] [--json]";
const FONTS = [
  { family: "Inter", weight: 300, file: "inter-latin-300-normal.woff2" },
  { family: "Inter", weight: 400, file: "inter-latin-400-normal.woff2" },
  { family: "Inter", weight: 500, file: "inter-latin-500-normal.woff2" },
  { family: "Inter", weight: 600, file: "inter-latin-600-normal.woff2" },
  { family: "Departure Mono", weight: 400, file: "DepartureMono-Regular.woff2" },
];

export function version() {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")).version;
}

/** A reader of the files fleet.json names, relative to it; null when absent or not a file. */
export function readerFor(base) {
  return (rel) => {
    if (typeof rel !== "string" || isAbsolute(rel)) return null;
    try { return readFileSync(resolve(base, ...rel.split("/"))); } catch { return null; }
  };
}

/** The first JSON document of a file: a bundle, an envelope, or the first line of a JSON Lines file. */
function readDocument(bytes) {
  const t = bytes.toString("utf8").replace(/^\uFEFF/, "").trim();
  try { return JSON.parse(t); } catch { /* JSON Lines */ }
  return JSON.parse(t.split(/\r?\n/).find((l) => l.trim()) ?? "");
}

/**
 * `verify-run`: the identity half of runward's `attested` (ADR-0119 decision 5, ADR-0120 D4a). It reads
 * files only, opens no connection and runs nothing; exit 0 accepted, 1 refused or not verifiable, 2 a
 * usage error (a policy it cannot read is one: the question cannot be asked).
 */
function verifyRun(file, rest, out) {
  const opts = {};
  const FLAGS = { "--policy": "policy", "--repository": "repository", "--commit": "commit", "--ref": "ref", "--statement": "statement" };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--json") { opts.json = true; continue; }
    const k = FLAGS[rest[i]];
    if (!k || rest[i + 1] === undefined) { out.error(USAGE); return 2; }
    opts[k] = rest[++i];
  }
  if (!file || !opts.policy || !opts.repository || !opts.commit) { out.error(USAGE); return 2; }
  let doc, policy, unsigned = null;
  try { doc = readDocument(readFileSync(file)); } catch { out.error(`runward-fleet: ${file} is not a readable bundle or envelope`); return 2; }
  try {
    const policyPath = resolve(opts.policy);
    policy = readPolicy(JSON.parse(readFileSync(policyPath, "utf8")), readerFor(dirname(policyPath)));
  } catch (e) { out.error(`runward-fleet: the trust policy cannot be read: ${e.message}`); return 2; }
  if (opts.statement) {
    try { unsigned = JSON.parse(readFileSync(opts.statement, "utf8")); } catch { out.error(`runward-fleet: --statement ${opts.statement} is not a readable Statement`); return 2; }
  }
  let r;
  try { r = verifyRunSignature({ document: doc, policy, expect: { repository: opts.repository, commit: opts.commit, ref: opts.ref }, unsigned }); }
  catch (e) { out.error(`runward-fleet: ${e.message}`); return 2; }
  if (opts.json) {
    const { statement, ...shown } = r;
    out.log(JSON.stringify({ ...shown, file, statement: statement ? { predicateType: statement.predicateType, subjects: statement.subject?.length ?? 0 } : null }, null, 2));
  } else if (r.accepted) {
    const who = r.via === "sigstore" ? `${r.identity?.buildSignerURI} at ${r.identity?.buildSignerDigest}` : `the key ${r.identity?.key}`;
    out.log(`runward-fleet: accepted: ${file} is signed by ${r.signer} (${who}), for ${r.vouched.repository} at ${r.vouched.commit} (read from its ${r.vouched.from}); ${r.landing ? `signed on ${r.vouched.ref}: a landing` : `ref ${r.vouched.ref ?? "unnamed"}: verified, not a landing (only the protected ref raises one)`}`);
  } else {
    out.error(`runward-fleet: refused (${r.state}): ${file}`);
    for (const x of r.reasons) out.error(`  - ${(REASON_TEXT[x.code] ?? (() => x.code))(x)}`);
  }
  return r.accepted ? 0 : 1;
}

export async function main(argv, out = console) {
  const [cmd, manifestPath, ...rest] = argv;
  if (cmd === "--version") { out.log(version()); return 0; }
  if (cmd === "verify-run") return verifyRun(manifestPath, rest, out);
  if (cmd !== "build" || !manifestPath) { out.error(USAGE); return 2; }
  let outDir = "runward-fleet-site";
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--out" && rest[i + 1]) outDir = rest[++i];
    else { out.error(USAGE); return 2; }
  }
  let bytes;
  try { bytes = readFileSync(manifestPath); } catch (e) { out.error(`runward-fleet: ${manifestPath} not readable (${e?.code ?? "error"})`); return 2; }
  try {
    const index = buildIndex({ manifest: { name: manifestPath.split(/[\\/]/).pop(), bytes }, read: readerFor(dirname(resolve(manifestPath))), version: version() });
    const html = renderSite(index, {
      template: readFileSync(join(PKG, "ui", "template.html"), "utf8"),
      views: readFileSync(join(PKG, "ui", "views.js"), "utf8"),
      api,
      fonts: FONTS.map((f) => ({ ...f, bytes: readFileSync(join(PKG, "ui", "fonts", f.file)) })),
    });
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
    writeFileSync(join(outDir, "index.html"), html);
    const shown = relative(process.cwd(), resolve(outDir)).split(sep).join("/") || ".";
    const sigs = index.fleet.signatures;
    out.log(`runward-fleet: ${index.missions.length} mission(s), ${index.sources.length} source(s), ${sigs.declared} signature(s) declared → ${shown}/index.html (${html.length} bytes)`);
    return 0;
  } catch (e) {
    if (e instanceof BuildError) { out.error(`runward-fleet: refused, nothing written: ${e.message}`); return 1; }
    throw e;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
