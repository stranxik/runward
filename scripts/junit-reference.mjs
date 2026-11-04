// The reference environment of runward's committed JUnit report (ADR-0112).
//
// The committed report is evidence the gate re-opens, and what a test runner writes depends on the
// runner: Node.js's junit reporter wrote a `"` of a test name `&amp;quot;` up to 24.21.x and `&quot;`
// from 24.22.0 (nodejs/node#65971, RWD-2026-0187), and a case that needs a case-insensitive filesystem
// is run on macOS and skipped on Linux. A report regenerated on another machine differs from the
// committed one without the suite having changed. So the committed report is written in ONE
// environment: the Node.js version of `.nvmrc`, on `darwin`. `package.json` `engines` stays the floor
// users need; this is only the machine that writes the file runward commits.
//
// `scripts/junit-committable.mjs` writes the environment into the report as a comment, before the root
// element; comments are outside what the gate and the seal read (`junitTestCases` reads `<testcase>`
// tags, `junitProjection` skips comments). `npm run test:reports` refuses a committed report whose
// comment names another environment, or none.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

export const REFERENCE_PLATFORM = "darwin";

/** The Node.js version of `.nvmrc`, as `vX.Y.Z`. */
export function referenceNode(root = ROOT) {
  const v = readFileSync(join(root, ".nvmrc"), "utf8").trim();
  return v.startsWith("v") ? v : `v${v}`;
}

/** The comment the generator writes: `<!-- generated: node vX.Y.Z <platform> -->`. */
export function generatedComment(node = process.version, platform = process.platform) {
  return `<!-- generated: node ${node} ${platform} -->`;
}

/** Put the comment after the XML declaration (or first, when there is none), replacing one already
 *  there. Nothing else of the report is touched. */
export function withGeneratedComment(xml, comment = generatedComment()) {
  const bare = xml.replace(/^[ \t]*<!-- generated: [^>]*-->\r?\n/m, "");
  const decl = /^﻿?<\?xml[^>]*\?>\r?\n?/.exec(bare);
  if (!decl) return `${comment}\n${bare}`;
  const head = decl[0].endsWith("\n") ? decl[0] : `${decl[0]}\n`;
  return `${head}${comment}\n${bare.slice(decl[0].length)}`;
}

/** What is wrong with the committed report's environment, or null when it names the reference. */
export function referenceProblem(xml, node = referenceNode(), platform = REFERENCE_PLATFORM) {
  const m = /<!-- generated: node (\S+) (\S+) -->/.exec(xml);
  const how = `regenerate it in the reference environment (ADR-0112): on macOS, with the Node.js of .nvmrc (\`nvm install && nvm use\`, ${node}), run \`npm run test:junit\` and commit reports/junit.xml`;
  if (!m) return `junit: reports/junit.xml says nothing of the environment that wrote it (no \`<!-- generated: node … -->\` comment) — ${how}`;
  if (m[1] !== node || m[2] !== platform) return `junit: reports/junit.xml was written by node ${m[1]} on ${m[2]}, not by the reference environment, node ${node} on ${platform} — ${how}`;
  return null;
}
