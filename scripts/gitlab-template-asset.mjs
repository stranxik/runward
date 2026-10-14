#!/usr/bin/env node
// The GitLab template as a release asset (ADR-0094 question 2, answer (a)).
//
//   node scripts/gitlab-template-asset.mjs --version X.Y.Z --out <dir>
//
// Writes <dir>/runward-gitlab-gate-X.Y.Z.yml: templates/ci/gitlab/runward-gate.yml with ONE change,
// the `version` input's default pinned from "latest" to "X.Y.Z", so a project that includes the
// asset by `include: remote` + `integrity:` runs the runward version the release names. Prints the
// file name and its `integrity:` value (sha256-<base64>, the form GitLab's include reads). The
// output is a pure function of the template and the version: two runs give the same bytes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const TEMPLATE = join(ROOT, "templates", "ci", "gitlab", "runward-gate.yml");
const DEFAULT_LINE = /^(    version:\n(?:      [^\n]*\n)*?      default: )"latest"$/m;

/** The asset's bytes for a version, or throws on a version that is not x.y.z or a template whose
 *  version default cannot be found exactly once. */
export function assetFor(version, template = readFileSync(TEMPLATE, "utf8")) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) throw new Error(`version must be x.y.z, got "${version}"`);
  const hits = template.match(new RegExp(DEFAULT_LINE.source, "gm")) ?? [];
  if (hits.length !== 1) throw new Error(`the template's version default was found ${hits.length} times, expected once`);
  return template.replace(DEFAULT_LINE, `$1"${version}"`);
}

export const assetName = (version) => `runward-gitlab-gate-${version}.yml`;
export const integrityOf = (bytes) => "sha256-" + createHash("sha256").update(bytes).digest("base64");

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    const version = arg("--version");
    const out = arg("--out") ?? ".";
    const bytes = assetFor(version);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, assetName(version)), bytes);
    console.log(`${assetName(version)} ${integrityOf(bytes)}`);
  } catch (e) {
    console.error(`gitlab-template-asset: ${e.message}`);
    process.exit(2);
  }
}
