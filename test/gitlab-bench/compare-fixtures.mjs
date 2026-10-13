// Compares the API responses a bench run just recorded with the fixtures committed under
// test/fixtures/gitlab/ (recorded or documentation examples): same fixture names, same HTTP status, same response shape (the set of key
// paths; values are expected to differ: ids, dates, SHAs). Prints a Markdown section for the job
// summary. It exits 1 on a difference, which the workflow reports without failing the bench: a
// difference is the signal to re-record (docs/gitlab-bench.md), not a broken bench.
//
// Usage: node test/gitlab-bench/compare-fixtures.mjs <recorded dir> <committed dir>
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const load = (dir) => Object.fromEntries(
  (existsSync(dir) ? readdirSync(dir) : [])
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f.replace(/\.json$/, ""), JSON.parse(readFileSync(join(dir, f), "utf8"))]),
);

// The key paths of a value: objects by key, arrays by the shape of their first element.
export function shape(value, prefix = "$") {
  if (Array.isArray(value)) return value.length ? shape(value[0], `${prefix}[]`) : [`${prefix}[]`];
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return [`${prefix}{}`];
    return keys.flatMap((k) => [`${prefix}.${k}`, ...shape(value[k], `${prefix}.${k}`)]);
  }
  return [];
}

// Run as a script only; the unit tests import shape() alone.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [recordedDir, committedDir] = process.argv.slice(2);
  const recorded = load(recordedDir);
  const committed = load(committedDir);
  const rows = [];
  for (const name of [...new Set([...Object.keys(recorded), ...Object.keys(committed)])].sort()) {
    const r = recorded[name], c = committed[name];
    if (!r) { rows.push([name, "committed, not recorded by this run"]); continue; }
    if (!c) { rows.push([name, "recorded, not committed"]); continue; }
    const notes = [];
    if (r.response.status !== c.response.status) notes.push(`status ${c.response.status} -> ${r.response.status}`);
    const rs = new Set(shape(r.response.body)), cs = new Set(shape(c.response.body));
    const added = [...rs].filter((k) => !cs.has(k)), removed = [...cs].filter((k) => !rs.has(k));
    if (added.length) notes.push(`new keys: ${added.slice(0, 8).join(", ")}${added.length > 8 ? " ..." : ""}`);
    if (removed.length) notes.push(`missing keys: ${removed.slice(0, 8).join(", ")}${removed.length > 8 ? " ..." : ""}`);
    // Against a documentation example, a difference is expected (the docs show an Enterprise
    // response; Community Edition returns fewer keys on some endpoints): it is the measurement.
    if (notes.length) rows.push([name, `${c.source === "docs-example" ? "(committed: docs example) " : ""}${notes.join("; ")}`]);
  }

  console.log("\n### Recorded API responses against the committed fixtures\n");
  if (!rows.length) {
    console.log(`Same ${Object.keys(recorded).length} fixtures, same statuses, same shapes.`);
  } else {
    console.log("| fixture | difference |\n|---|---|");
    for (const [n, d] of rows) console.log(`| ${n.replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} | ${d.replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`);
  }
  process.exitCode = rows.length ? 1 : 0;
}
