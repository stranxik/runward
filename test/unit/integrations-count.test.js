// The count of runward-integrations (runward ADR-0122 decision 3): only the recipes whose control passed on
// the current runward are counted, in the README, the docs and the package's own page; one whose control
// failed or has not run reads "not counted", with the reason; no total is written without its list.
//
// Every surface holds a block rendered from the manifests. This file holds, offline:
//   - every surface of this tree carries the rendering, and no total of recipes outside it;
//   - the checker refuses each way a text can say more than the controls hold (planted texts and results),
//     and the rendering reads "not counted" for each reason a recipe is not counted.
// What it cannot hold offline is a live run of the controls: the `integrations` job of
// .github/workflows/ci.yml runs them, then `count --check --results`, which refuses a text that counts a
// recipe whose control did not pass in that run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "../support/run-lab.js";

const PKG = join(ROOT, "packages", "runward-integrations");
const C = await import(pathToFileURL(join(PKG, "src", "count.js")).href);
const { readManifests } = await import(pathToFileURL(join(PKG, "src", "manifest.js")).href);
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const manifests = readManifests();
const passed = (m, v = VERSION) => ({ ...m, maintainer: { ...m.maintainer, lastPassingControl: { date: "2026-11-06", runward: v } } });
const block = (body) => `${C.begin("count")}\n${body}\n${C.end("count")}`;

test("every surface of this tree carries the count rendered from the manifests, and no total outside it", () => {
  const r = spawnSync(process.execPath, [join(PKG, "src", "cli.js"), "count", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(C.DEFAULT_TEXTS.map((t) => t.path), ["packages/runward-integrations/README.md", "docs/recipes/junit-freshness-in-ci.md", "README.md"],
    "the package's page, the docs page that carries regeneration in CI, and the README");
  for (const t of C.DEFAULT_TEXTS) {
    const text = readFileSync(join(ROOT, t.path), "utf8");
    assert.ok(text.includes(C.begin("count")), `${t.path} carries the count block`);
    const body = text.slice(text.indexOf(C.begin("count")), text.indexOf(C.end("count")));
    for (const m of manifests) assert.ok(body.includes(`[\`${m.id}\`]`), `${t.path}: ${m.id} is listed, counted or not`);
  }
});

test("a recipe is counted only with a control passed on this runward, and not while withdrawn; the total carries its list", () => {
  const counted = manifests.map((m) => passed(m));
  const all = C.renderCount(counted, VERSION);
  assert.match(all, new RegExp(`\\*\\*Counted: ${manifests.length}\\*\\* \\(${manifests.map((m) => `\`${m.id}\``).join(", ")}\\)\\. \\*\\*Not counted: 0\\*\\*\\.`));
  assert.match(all, /counted: its control passed on 2026-11-06, with runward /);
  const older = C.renderCount([passed(manifests[0], "0.1.0"), ...counted.slice(1)], VERSION);
  assert.match(older, new RegExp(`not counted: its control has not passed with runward ${VERSION.replace(/\./g, "\\.")} yet \\(last passed on 2026-11-06, with runward 0\\.1\\.0\\)`));
  assert.match(older, new RegExp(`\\*\\*Counted: ${manifests.length - 1}\\*\\*`));
  const withdrawn = C.renderCount([{ ...counted[0], withdrawn: "its control fails on Node.js 26: the reporter changed" }, ...counted.slice(1)], VERSION);
  assert.match(withdrawn, /not counted: withdrawn until its control passes again: its control fails on Node\.js 26/);
  assert.match(C.renderCount([{ ...manifests[0], maintainer: { ...manifests[0].maintainer, lastPassingControl: null } }], VERSION), /\*\*Counted: 0\*\*\. \*\*Not counted: 1\*\* \(`sarif`: its control has not passed yet\)/);
  assert.deepEqual(C.countData(counted, VERSION).counted.map((c) => c.id), manifests.map((m) => m.id), "the count as data, for a surface rendered elsewhere");
});

test("positive controls: each way a text can say more than the controls hold is refused", () => {
  const counted = manifests.map((m) => passed(m));
  const good = `# page\n\n${block(C.renderCount(counted, VERSION))}\n`;
  assert.deepEqual(C.textProblems("p.md", good, ["count"], counted, VERSION, null), [], "the rendering itself is accepted");
  // A block that is not the rendering: the text counts a recipe the manifests do not hold as counted.
  const stale = C.textProblems("p.md", good, ["count"], [{ ...counted[0], maintainer: { ...counted[0].maintainer, lastPassingControl: null } }, ...counted.slice(1)], VERSION, null);
  assert.match(stale.join("\n"), /the count block is not what the manifests say/);
  // A total outside the block, with no list.
  for (const total of ["runward ships three recipes.", "3 recipes are maintained", "with 12 integrations", "more than 1,000 out-of-the-box integrations"]) {
    assert.match(C.textProblems("p.md", `${good}\n${total}\n`, ["count"], counted, VERSION, null).join("\n"), /a total of recipes outside the count block/, total);
  }
  assert.deepEqual(C.textProblems("p.md", `${good}\nEach recipe is counted only while its control passes.\n`, ["count"], counted, VERSION, null), [], "but a sentence about counting is not a total");
  // A surface that must carry the block and does not.
  assert.match(C.textProblems("p.md", "# page\n", ["count"], counted, VERSION, null).join("\n"), /no count block/);
  // A hand-edited marker.
  assert.match(C.textProblems("p.md", good.replace(C.begin("count"), "<!-- runward-integrations:count -->"), ["count"], counted, VERSION, null).join("\n"), /opening marker is not the generated one/);
  // Live results: a counted recipe whose control did not pass, or did not run, on this tree.
  const results = { runward: VERSION, recipes: counted.map((m, i) => ({ id: m.id, passed: i !== 1, ...(i === 1 ? { reason: "sabotaged tree, with the recipe: the gate exited 0" } : {}) })) };
  const live = C.textProblems("p.md", good, ["count"], counted, VERSION, results).join("\n");
  assert.match(live, new RegExp(`counts ${counted[1].id}, whose control did not pass on this tree \\(sabotaged tree, with the recipe: the gate exited 0\\)`));
  const absent = C.textProblems("p.md", good, ["count"], counted, VERSION, { runward: VERSION, recipes: results.recipes.slice(1) }).join("\n");
  assert.match(absent, new RegExp(`counts ${counted[0].id}, whose control did not run in these results`));
  assert.deepEqual(C.textProblems("p.md", good, ["count"], counted, VERSION, { runward: VERSION, recipes: counted.map((m) => ({ id: m.id, passed: true })) }), [], "every counted recipe passed: accepted");
  assert.match(C.checkCount({ manifests: counted, version: VERSION, texts: [], results: { runward: "0.0.1", recipes: [] } }).join("\n"), /the control results are for runward 0\.0\.1/);
});

test("writing the blocks renders them, and a text with no block to write into is refused", () => {
  const counted = manifests.map((m) => passed(m));
  const text = `# page\n\n${C.begin("count")}\nold\n${C.end("count")}\n\nafter\n`;
  const out = C.writeBlocks(text, ["count"], counted, VERSION);
  assert.ok(out.includes(C.renderCount(counted, VERSION)) && out.endsWith("\n\nafter\n"));
  assert.equal(C.writeBlocks(out, ["count"], counted, VERSION), out, "idempotent");
  assert.throws(() => C.writeBlocks("# page\n", ["count"], counted, VERSION), /no count block/);
});

// The words this repository does not use in public (AGENTS.md, docs/positioning.md): the package's own
// texts are held to them, with the list's own positive control.
const BANNED = /\b(compliant|certified|certify|certifies|guarantees?|guaranteed|tamper-proof|mathematical proof|no human|platforms?|sovereign)\b/i;
test("the package's public texts use none of the words runward does not use in public", () => {
  const texts = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(md|json|ya?ml)$/.test(e.name)) texts.push(p); } };
  walk(PKG);
  assert.ok(texts.length >= 12, `the texts were walked (${texts.length})`);
  for (const p of texts) assert.doesNotMatch(readFileSync(p, "utf8"), BANNED, p);
  for (const w of ["compliant", "certified", "a guarantee", "tamper-proof", "no human", "platform", "sovereign"]) assert.match(w, BANNED, `the list catches ${w}`);
});
