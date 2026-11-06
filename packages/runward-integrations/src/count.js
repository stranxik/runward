// The count (runward ADR-0122 decision 3): only the recipes whose control passed on the current runward
// are counted, on every surface that counts them, and no total is written without its list.
//
// The surfaces never write the count by hand. Each one holds a block between two markers, rendered from
// the recipes' manifests (`count --write`); `count --check` refuses a block that is not the rendering, and
// a total of recipes written anywhere else in the text. A recipe reads "counted" only when its manifest
// records a control that passed with this runward version, and is not withdrawn; otherwise "not counted",
// with the reason. With the results of a live run of the controls (`--results`), `count --check` also
// refuses a text that counts a recipe whose control did not pass on this tree: this is what CI runs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PACKAGE_DIR } from "./manifest.js";

/** The repository root, two levels above the package. */
export const REPO_ROOT = resolve(PACKAGE_DIR, "..", "..");
const BLOB = "https://github.com/stranxik/runward/blob/main/packages/runward-integrations";

/** The surfaces of this repository that count recipes, and the blocks each one must carry. */
export const DEFAULT_TEXTS = [
  { path: "packages/runward-integrations/README.md", blocks: ["count", "controls"] },
  { path: "docs/recipes/junit-freshness-in-ci.md", blocks: ["count"] },
  { path: "README.md", blocks: ["count"] },
];

const GENERATED = {
  count: "generated from the recipes' manifests by `node packages/runward-integrations/src/cli.js count --write`; CI refuses a text that counts a recipe whose control does not pass on the tree (runward ADR-0122 decision 3)",
  controls: "generated from the recipes' manifests by `node packages/runward-integrations/src/cli.js count --write`; each row is what that recipe's control asserts, and CI runs the controls (runward ADR-0122 decision 1)",
};
export const begin = (block) => `<!-- runward-integrations:${block} — ${GENERATED[block]} -->`;
export const end = (block) => `<!-- /runward-integrations:${block} -->`;

/** Whether a recipe is counted, and why not when it is not. */
export function statusOf(m, version) {
  if (m.withdrawn) return { counted: false, reason: `withdrawn until its control passes again: ${m.withdrawn}` };
  const last = m.maintainer?.lastPassingControl;
  if (!last) return { counted: false, reason: "its control has not passed yet" };
  if (last.runward !== version) return { counted: false, reason: `its control has not passed with runward ${version} yet (last passed on ${last.date}, with runward ${last.runward})` };
  return { counted: true, last };
}

const forges = (m) => [m.steps?.github && "GitHub Actions", m.steps?.gitlab && "GitLab CI"].filter(Boolean).join(", ");
const code = (s) => `\`${s}\``;
/** What the report reaches, said on every surface (ADR-0122 decision 5). */
const level = (m) => `${code(m.level.ciStep)} as a CI step; ${code(m.level.runwardRunLeg)} as a runward-run leg, once the run is signed`;
const cell = (s) => String(s).replaceAll("|", "\\|").replace(/\s*\n\s*/g, " ");

/** The count block: one row per recipe, then the total with its list, counted and not counted. */
export function renderCount(manifests, version) {
  const rows = manifests.map((m) => {
    const s = statusOf(m, version);
    return { m, s, line: `| [${code(m.id)}](${BLOB}/recipes/${m.id}/manifest.json) | ${m.report.format} | ${m.rows.map((r) => code(r.nature)).join(", ")} | ${forges(m)} | ${level(m)} | ${cell(m.maintainer.name)} | ${s.counted ? `counted: its control passed on ${s.last.date}, with runward ${s.last.runward}` : `not counted: ${cell(s.reason)}`} |` };
  });
  const counted = rows.filter((r) => r.s.counted).map((r) => code(r.m.id));
  const not = rows.filter((r) => !r.s.counted);
  return [
    "| Recipe | Report | `requires:` | Steps | Level of its report | Maintainer | Count |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((r) => r.line),
    "",
    `**Counted: ${counted.length}**${counted.length ? ` (${counted.join(", ")})` : ""}. **Not counted: ${not.length}**${not.length ? ` (${not.map((r) => `${code(r.m.id)}: ${cell(r.s.reason)}`).join("; ")})` : ""}.`,
  ].join("\n");
}

/** The controls block: what each recipe's control plants, and the exits it asserts. */
export function renderControls(manifests) {
  const refusals = (m) => m.control.expect.withRecipe.refuses.map((x) => `${code(x.rule)} in ${code(x.file)}`).join(", ");
  return [
    "| Recipe | Planted sabotage | Gate, without the recipe | Gate, after the recipe's step | Healthy tree, after the step | The other sabotages, after this step |",
    "|---|---|---|---|---|---|",
    ...manifests.map((m) => `| ${code(m.id)} | ${cell(m.control.sabotage.summary)} | exit ${m.control.expect.withoutRecipe}: accepted | exit ${m.control.expect.withRecipe.exit}: ${refusals(m)} refused | exit ${m.control.expect.healthy}: accepted | ${m.control.doesNotCatch.map((d) => `${code(d.sabotage)}'s: exit 0, not caught (${cell(d.why)})`).join("; ") || "none planted"} |`),
  ].join("\n");
}

const RENDER = { count: (ms, v) => renderCount(ms, v), controls: (ms) => renderControls(ms) };

/** A total of recipes or integrations written outside a block: a total without its list. */
const TOTAL = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a dozen|dozens of|hundreds of)\s+(?:(?:counted|shipped|tested|maintained|working|out-of-the-box)\s+)?(?:recipes?|integrations?)\b/gi;

function locate(text, block) {
  const b = text.indexOf(`<!-- runward-integrations:${block} `);
  const e = text.indexOf(end(block));
  if (b === -1 || e === -1 || e < b) return null;
  const bodyStart = text.indexOf("\n", b) + 1;
  return { b, e, header: text.slice(b, bodyStart - 1), body: text.slice(bodyStart, e).replace(/\n$/, "") };
}

/** Replaces every block of a text with its rendering. */
export function writeBlocks(text, blocks, manifests, version) {
  let out = text;
  for (const block of blocks) {
    const at = locate(out, block);
    if (!at) throw new Error(`no ${block} block (${begin(block).slice(0, 40)}… ${end(block)}) to write into`);
    out = `${out.slice(0, at.b)}${begin(block)}\n${RENDER[block](manifests, version)}\n${out.slice(at.e)}`;
  }
  return out;
}

/**
 * The problems of one text: a block that is not its rendering, a block missing, a total outside the
 * blocks, and (with live results) a recipe counted whose control did not pass.
 */
export function textProblems(path, text, blocks, manifests, version, results) {
  const problems = [];
  let outside = text;
  for (const block of ["count", "controls"]) {
    const at = locate(text, block);
    if (!at) { if (blocks.includes(block)) problems.push(`${path}: no ${block} block: write the markers and run count --write`); continue; }
    outside = outside.replace(text.slice(at.b, at.e + end(block).length), "");
    if (at.header !== begin(block)) problems.push(`${path}: the ${block} block's opening marker is not the generated one`);
    if (at.body !== RENDER[block](manifests, version)) problems.push(`${path}: the ${block} block is not what the manifests say on runward ${version}: run \`node packages/runward-integrations/src/cli.js count --write\``);
  }
  for (const m of outside.matchAll(TOTAL)) problems.push(`${path}: "${m[0]}" is a total of recipes outside the count block, with no list: write it in the block, or not at all`);
  if (results) {
    const counted = manifests.filter((m) => statusOf(m, version).counted);
    for (const m of counted) {
      const r = results.recipes?.find((x) => x.id === m.id);
      if (!r) problems.push(`${path}: counts ${m.id}, whose control did not run in these results: it reads "not counted" until it does`);
      else if (!r.passed) problems.push(`${path}: counts ${m.id}, whose control did not pass on this tree (${r.reason}): fix the recipe, or withdraw it (the manifest's "withdrawn", with the reason) and run count --write`);
    }
  }
  return problems;
}

/** Every problem across the texts. `results` is the document a live `control --json` wrote. */
export function checkCount({ manifests, version, root = REPO_ROOT, texts = DEFAULT_TEXTS, results = null }) {
  const problems = [];
  if (results && results.runward !== version) problems.push(`the control results are for runward ${results.runward}, this tree is runward ${version}`);
  for (const t of texts) {
    const p = join(root, t.path);
    if (!existsSync(p)) { problems.push(`${t.path}: not found`); continue; }
    problems.push(...textProblems(t.path, readFileSync(p, "utf8"), t.blocks, manifests, version, results));
  }
  return problems;
}

/** Re-renders every block of every text. Returns the texts it changed. */
export function writeCount({ manifests, version, root = REPO_ROOT, texts = DEFAULT_TEXTS }) {
  const changed = [];
  for (const t of texts) {
    if (t.blocks.length === 0) continue;
    const p = join(root, t.path);
    const before = readFileSync(p, "utf8");
    const after = writeBlocks(before, t.blocks, manifests, version);
    if (after !== before) { writeFileSync(p, after); changed.push(t.path); }
  }
  return changed;
}

/** The count as data, for a surface that renders it elsewhere (the site): counted and not, each with why. */
export function countData(manifests, version) {
  return {
    runward: version,
    counted: manifests.filter((m) => statusOf(m, version).counted).map((m) => ({ id: m.id, report: m.report.format, maintainer: m.maintainer.name, lastPassingControl: m.maintainer.lastPassingControl })),
    notCounted: manifests.filter((m) => !statusOf(m, version).counted).map((m) => ({ id: m.id, report: m.report.format, maintainer: m.maintainer.name, reason: statusOf(m, version).reason })),
  };
}
