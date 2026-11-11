#!/usr/bin/env node
// runward-run run --policy <run-policy.json> --tree <checkout> --check <check.json> --out <dir>
//                 [--runtime docker|podman|<path>] [--scratch <dir>] [--repository <host/path>] [--commit <sha>] [--ref <ref>]
//
// Executes the legs of the run policy on a copy of the checkout, in a container pinned by digest with
// the network cut, and writes into <dir> the normalised reports at their project-relative paths, the
// unsigned run Statement and its test-result Statement beside them. Exit codes:
//   0  written, every leg exited 0
//   1  written, at least one leg exited non-zero (recorded in the Statement: a red run is a fact)
//   2  a usage error, nothing written
//   3  refused, fail closed, nothing written: the image is not pinned or not named by its digest, the
//      network cannot be cut, the policy lives in the judged tree, the lockfile is absent, install
//      scripts are not disabled, the expected set does not match the tree, a leg wrote no report
// It signs nothing and holds no key: the operator's CI signs the Statement in another job.
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RunRefused, RunUsage, runPolicy, version } from "./run.js";

const USAGE = "usage: runward-run run --policy <run-policy.json> --tree <dir> --check <check.json> --out <dir> [--runtime <bin>] [--scratch <dir>] [--repository <host/path>] [--commit <sha>] [--ref <ref>]";
const FLAGS = { "--policy": "policyPath", "--tree": "tree", "--check": "checkPath", "--out": "out", "--runtime": "runtimeBin", "--scratch": "scratchDir", "--repository": "repository", "--commit": "commit", "--ref": "ref" };

export function main(argv, out = console) {
  const [cmd, ...rest] = argv;
  if (cmd === "--version") { out.log(version()); return 0; }
  if (cmd !== "run") { out.error(USAGE); return 2; }
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const key = FLAGS[rest[i]];
    if (!key || rest[i + 1] === undefined || rest[i + 1].startsWith("--")) { out.error(USAGE); return 2; }
    opts[key] = rest[++i];
  }
  if (opts.commit !== undefined && !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(opts.commit)) { out.error("runward-run: --commit must be a full git commit digest (40 or 64 hex)"); return 2; }
  const mission = opts.repository || opts.commit || opts.ref
    ? { repository: opts.repository ?? null, commit: opts.commit ?? null, ref: opts.ref ?? null }
    : null;
  try {
    const r = runPolicy({ ...opts, mission, log: (l) => out.log(l) });
    return r.exitCode;
  } catch (e) {
    if (e instanceof RunUsage) { out.error(`runward-run: ${e.message}`); out.error(USAGE); return 2; }
    if (e instanceof RunRefused) { out.error(`runward-run: refused, nothing written: ${e.message}`); return 3; }
    throw e;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
