// No template may cite a runward version other than the one it ships with.
//
// PR-T5 of the stagnant-half harness (2026-09-02). A PREVENTIVE net, declared as such: measured at
// recording time, templates/ outside rules/ carries ZERO semver strings — and that is exactly the
// state worth locking, because the failure it prevents has already happened one directory over:
// docs/first-mission.md instructed `0.6.0` gestures against a 0.37.x binary for six weeks, and the
// only reason it could rot that far is that nothing compared its version strings to package.json.
// The day a template gains an `npx runward@…` example, this net makes it move with every release
// instead of freezing at the release that wrote it.
//
// rules/ stays out of scope deliberately: rule bodies cite versions of THIRD-PARTY tools and
// standards (SARIF 2.1.0, OSCAL 1.2.2…), which have their own owners and their own tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

const walk = (dir, prefix) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory()
    ? (e.name === "rules" && prefix === "" ? [] : walk(join(dir, e.name), `${prefix}${e.name}/`))
    : [[`${prefix}${e.name}`, join(dir, e.name)]]);

test("every semver a template cites is the shipped version — currently: none cited, and that is the pin", () => {
  const offenders = [];
  let scanned = 0;
  for (const [rel, abs] of walk(join(ROOT, "templates"), "")) {
    if (!/\.(md|json|yml|yaml|toml)$/.test(rel)) continue;
    scanned++;
    const text = readFileSync(abs, "utf8");
    for (const m of text.matchAll(/runward@(\d+\.\d+\.\d+)|(?<![\w.])v?(\d+\.\d+\.\d+)(?![\w.])/g)) {
      const cited = m[1] ?? m[2];
      if (cited !== VERSION) offenders.push(`templates/${rel}: cites ${cited}, shipped is ${VERSION}`);
    }
  }
  assert.ok(scanned >= 30, `only ${scanned} template files scanned — the walker went blind`);
  assert.deepEqual(offenders, [],
    "a template cites a version this package is not — it would freeze at the release that wrote " +
    "it, the first-mission.md failure one directory over:\n  " + offenders.join("\n  "));
});
