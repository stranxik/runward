// The recipes, read from their manifests (runward ADR-0122 decision 1). One directory per recipe under
// recipes/, holding manifest.json and the step for each forge. The schema is schema/recipe-manifest.schema.json;
// runward's repository validates every manifest against it in its tests. Reading here checks only what the
// code below relies on, and refuses a manifest that would make the control or the count say something
// it did not measure.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RECIPES_DIR = join(PACKAGE_DIR, "recipes");
export const SCHEMA = join(PACKAGE_DIR, "schema", "recipe-manifest.schema.json");
export const MANIFEST_FORMAT = "runward-integrations-recipe/0";
/** The order of ADR-0122 decision 2: the report formats first, SARIF, JUnit, LCOV. */
export const ORDER = ["sarif", "junit", "coverage"];

export const manifestPath = (id) => join(RECIPES_DIR, id, "manifest.json");

/** Every recipe's manifest, in the order of ADR-0122 decision 2, then by id. */
export function readManifests(dir = RECIPES_DIR) {
  if (!existsSync(dir)) return [];
  const ids = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  return ids.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "en")).map((id) => readManifest(join(dir, id, "manifest.json"), id));
}

export function readManifest(path, id) {
  let m;
  try { m = JSON.parse(readFileSync(path, "utf8")); } catch (e) { throw new Error(`${path}: not a JSON manifest (${e.message})`); }
  const bad = (what) => { throw new Error(`${path}: ${what}`); };
  if (m.format !== MANIFEST_FORMAT) bad(`format must be "${MANIFEST_FORMAT}"`);
  if (m.id !== id) bad(`id ${JSON.stringify(m.id)} is not its directory's name ${JSON.stringify(id)}`);
  if (!Array.isArray(m.rows) || m.rows.length === 0) bad("rows must list the requires: natures the report satisfies");
  if (typeof m.maintainer?.name !== "string" || m.maintainer.name === "") bad("maintainer.name is missing: a recipe without a named maintainer is not shipped (ADR-0122)");
  const c = m.control;
  if (!c?.sabotage?.id || !c.command?.argv || !c.expect || !Array.isArray(c.doesNotCatch)) bad("control must name its sabotage, its command, its expected exits and what it does not catch");
  if (c.expect.withRecipe?.exit !== 1 || !Array.isArray(c.expect.withRecipe.refuses) || c.expect.withRecipe.refuses.length === 0) bad("control.expect.withRecipe must be a refusal (exit 1) naming at least one refused row");
  if (c.expect.withoutRecipe !== 0 || c.expect.healthy !== 0) bad("control.expect: the sabotage passes without the recipe (0) and the healthy tree passes with it (0)");
  return { ...m, dir: dirname(path) };
}
