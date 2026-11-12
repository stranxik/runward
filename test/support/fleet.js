// Shared helpers of the runward-fleet tests: the package's modules, the real exports kept in
// test/fixtures/fleet/, and a build over files held in memory (the build is a pure function of the
// files fleet.json declares, so a test hands it a map instead of a directory).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PKG = join(ROOT, "packages", "runward-fleet");
export const FIX = join(ROOT, "test", "fixtures", "fleet");

export const fixture = (...p) => readFileSync(join(FIX, ...p));
export const fixtureJson = (...p) => JSON.parse(fixture(...p).toString("utf8"));

const load = (...p) => import(pathToFileURL(join(PKG, ...p)).href);
export const build = await load("src", "build.js");
export const trust = await load("src", "trust.js");
export const sigstore = await load("src", "sigstore.js");
export const rules = await load("src", "rules.js");
export const site = await load("src", "site.js");
export const views = await load("ui", "views.js");
export const documents = await load("ui", "documents.js");
export const mission = await load("ui", "mission.js");

const asBuf = (v) => (Buffer.isBuffer(v) ? v : Buffer.from(typeof v === "string" ? v : JSON.stringify(v)));

/** Build an index from a manifest object and a map of files named relative to fleet.json. */
export function indexFrom(manifest, files = {}) {
  const map = new Map(Object.entries(files).map(([k, v]) => [k, asBuf(v)]));
  return build.buildIndex({ manifest: { name: "fleet.json", bytes: asBuf(manifest) }, read: (rel) => map.get(rel) ?? null, version: "test" });
}

/** A mission whose check export is one of the real fixtures. */
export function missionWith(id, extra = {}) {
  return { id, name: `example/${id}`, repository: `github.com/example/${id}`, exports: { check: { file: `exports/${id}/check.json` } }, ...extra };
}

export const manifestOf = (missions, extra = {}) => ({ format: "runward-fleet-manifest/0", title: "test fleet", asOf: "2026-11-06", missions, ...extra });

export const realCheck = () => fixture("exports", "runward.check.json");
export const exampleCheck = () => fixture("exports", "example.check.json");

/** Every view of an index, rendered: [where, html]. */
export function allRendered(index) {
  return views.allViews(index).map(([route, arg]) => [`#/${route}${arg ? `/${arg}` : ""}`, views.renderView(index, route, arg ?? undefined)]);
}

/** The page the CLI would write for this index. */
export function pageFor(index) {
  return site.renderSite(index, {
    template: readFileSync(join(PKG, "ui", "template.html"), "utf8"),
    views: readFileSync(join(PKG, "ui", "views.js"), "utf8"),
    api: views,
    fonts: [{ family: "Inter", weight: 400, bytes: readFileSync(join(PKG, "ui", "fonts", "inter-latin-400-normal.woff2")) }],
  });
}
