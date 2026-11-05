#!/usr/bin/env node
// runward-fleet build <fleet.json> [--out <dir>]
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
import { renderSite } from "./site.js";
import * as api from "../ui/views.js";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "usage: runward-fleet build <fleet.json> [--out <dir>]";
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

export async function main(argv, out = console) {
  const [cmd, manifestPath, ...rest] = argv;
  if (cmd === "--version") { out.log(version()); return 0; }
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
