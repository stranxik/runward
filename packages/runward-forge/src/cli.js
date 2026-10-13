#!/usr/bin/env node
// runward-forge post-summary <file.md> [--forge github|gitlab]
//
// Posts a summary the operator's pipeline already rendered (runward renders, runward-forge only
// posts: a connector renames, it never computes). Exit codes: 0 whether the summary was posted or
// not (ADR-0094 decision 3: the summary is a convenience, it stays an artifact), 2 a usage error.
import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ADAPTERS, detectForge } from "./index.js";

const USAGE = "usage: runward-forge post-summary <file.md> [--forge github|gitlab]";

export async function main(argv, env = process.env, out = console) {
  const [cmd, file, ...rest] = argv;
  if (cmd !== "post-summary" || !file) { out.error(USAGE); return 2; }
  let forge = detectForge(env);
  const i = rest.indexOf("--forge");
  if (i >= 0) forge = rest[i + 1] ?? null;
  if (!forge || !Object.hasOwn(ADAPTERS, forge)) { out.error(`${USAGE}\nforge: ${forge ?? "not detected"}`); return 2; }
  let markdown;
  try { markdown = await readFile(file, "utf8"); } catch (e) {
    out.log(`summary not posted: ${file} not readable (${e?.code ?? "error"})`);
    return 0;
  }
  const adapter = ADAPTERS[forge];
  const r = await adapter.postSummary(markdown, adapter.contextFromEnv(env));
  out.log(r.message);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
