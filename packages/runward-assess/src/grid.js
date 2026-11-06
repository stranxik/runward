// grid.js: reading the grid's data files. The pure half lives in grid-model.js.
//
// The grid is read, never computed: every threshold of every tier is a value in grid/grille-1.json,
// and every auxiliary list (secret patterns, lexicon, bots, domains, the OSV control, model SDKs) is a
// versioned file beside it, digested into every record.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmp } from "./canon.js";
import { digestOf, gridDataDigest } from "./grid-model.js";

export * from "./grid-model.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const GRID_DIR = join(HERE, "..", "grid");
const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));

export function loadGrid(dir = GRID_DIR) {
  const grid = readJSON(join(dir, "grille-1.json"));
  const catalogue = readJSON(join(dir, "facts-1.json"));
  const data = {
    secrets: readJSON(join(dir, "secret-patterns-1.json")),
    lexicon: readJSON(join(dir, "overpromise-1.json")),
    bots: readJSON(join(dir, "bots-1.json")),
    domains: readJSON(join(dir, "domains-1.json")),
    osvControl: readJSON(join(dir, "osv-control-1.json")),
    sdks: readJSON(join(dir, "model-sdks-1.json")),
  };
  const lock = readJSON(join(dir, "grille-1.lock.json"));
  const digests = {
    grid: digestOf(grid),
    catalogue: digestOf(catalogue),
    data: Object.fromEntries(Object.keys(data).sort(cmp).map((k) => [k, digestOf(data[k])])),
  };
  digests.gridData = gridDataDigest(grid, data);
  return { grid, catalogue, data, lock, digests };
}

