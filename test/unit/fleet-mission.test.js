// The mission projections of runward-fleet (ADR-0126): the six steps of each application, the portfolio
// map of applications by step, one version's point, and the series of points over the versions a
// service received. Each property is held with its planted control:
//   - the steps of the five real exports agree with the CLI's own words for them: the current step it
//     names, the phases where it says the gate is red, nothing crossed under a level not met;
//   - step 4 is never said crossed, and no step is crossed under a check that does not read the answers;
//   - every grouping is n / N with the index path of each item it counts, and the groupings partition
//     what they count; every number a view shows is the projection's value at the path it names;
//   - every closed value has its sentence in both languages, which hold the same keys; no word runward
//     never says, no reading named as a decision taken; the specification shows the lexicon as it ships;
//   - an index written before refusals carried their phase reads the same steps; an unknown value is
//     shown as written;
//   - the series is the versions received, in the order of seq; a hole breaks a run; a change of the
//     judging version is marked;
//   - the documents and pages of real exports are golden, in both languages, and the same through the
//     package's exports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { indexFrom, manifestOf, missionWith, mission, PKG, ROOT, rules } from "../support/fleet.js";

const DECISION = join(ROOT, "test", "fixtures", "fleet", "decision");
const GOLDEN = join(ROOT, "test", "fixtures", "golden", "fleet");
const fx = (name) => readFileSync(join(DECISION, name));
const fxJson = (name) => JSON.parse(fx(name).toString("utf8"));
const CLOSED = JSON.parse(readFileSync(join(ROOT, "docs", "spec", "runward-closed-values.json"), "utf8"));
const listOf = (name) => [...CLOSED.lists[name].published, ...CLOSED.lists[name].unreleased];
const sha = (s) => createHash("sha256").update(s).digest("hex");
const SRC = readFileSync(join(PKG, "ui", "mission.js"), "utf8");
const EXPORTS = { renamed: "demo-renamed.check.json", repaired: "demo-repaired.check.json", hosted: "hosted-proposed.check.json", agent: "agent-ratified.check.json", level: "level-not-met.check.json" };

/** The inventory of the decision reading's goldens: the five real exports, a silent mission, one received as a digest only. */
function goldenFleet(lang = "fr") {
  return indexFrom(manifestOf([
    { id: "demo-renamed", name: "runward-demo-renaming · a name changed in the code", repository: "github.com/stranxik/runward-demo-renaming", exports: { check: { file: "renamed.json", at: "2026-11-10" } } },
    { id: "demo-repaired", name: "runward-demo-renaming · the record follows the new name", repository: "github.com/stranxik/runward-demo-renaming", exports: { check: { file: "repaired.json", at: "2026-11-10" } } },
    { id: "hosted", name: "runward-hosted", repository: "github.com/stranxik/runward-hosted", exports: { check: { file: "hosted.json" } } },
    { id: "agent", name: "example · two rows endorsed by an agent", repository: "github.com/example/agent", exports: { check: { file: "agent.json", at: "2026-11-10" } } },
    { id: "level", name: "example · a level required and not met", repository: "github.com/example/level", exports: { check: { file: "level.json", at: "2026-11-10" } } },
    { id: "silent", name: "example · declared, nothing received", repository: "github.com/example/silent", exports: { check: { file: "missing.json" } } },
    { id: "digest", name: "example · fingerprints only", repository: "github.com/example/digest", exports: { check: { sha256: sha(fx(EXPORTS.renamed)), at: "2026-11-09" } } },
  ], { lang }), {
    "renamed.json": fx(EXPORTS.renamed), "repaired.json": fx(EXPORTS.repaired), "hosted.json": fx(EXPORTS.hosted),
    "agent.json": fx(EXPORTS.agent), "level.json": fx(EXPORTS.level),
  });
}

/** One application whose check is `check` (an object or bytes), in an inventory of one. */
const single = (check, lang = "en") => indexFrom(manifestOf([missionWith("a", { exports: { check: { file: "exports/a/check.json", at: "2026-11-10" } } })], { lang }), { "exports/a/check.json": check });
const readings = (doc) => doc.steps.map((s) => s.reading);

/** A copy of ui/mission.js with each [from, to] applied (each must apply), importing the package's own views. */
async function planted(...edits) {
  let s = SRC;
  for (const [from, to] of edits) {
    assert.ok(s.includes(from), `the plant applies: ${from.slice(0, 70)}`);
    s = s.replace(from, to);
  }
  s = s.replace('from "./views.js"', `from ${JSON.stringify(pathToFileURL(join(PKG, "ui", "views.js")).href)}`);
  const dir = mkdtempSync(join(tmpdir(), "rw-fleet-mission-"));
  const file = join(dir, `mission-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, s);
  try { return await import(pathToFileURL(file).href); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ------------------------------------------------------------------ the CLI's own words
test("the steps of the five real exports agree with the CLI's own words: the current step it names, the phases it says are red, nothing crossed below the level required", async () => {
  const { PHASES } = await import(pathToFileURL(join(ROOT, "dist", "lib", "mission.js")).href);
  const { GATED_DELIVERABLES } = await import(pathToFileURL(join(ROOT, "dist", "lib", "conformance.js")).href);
  const stepOf = (phase) => mission.STEPS.find((s) => s.phases.includes(phase))?.step;
  const byLabel = new Map(PHASES.map((p) => [p.label, stepOf(p.id)]));
  const byGated = new Map(GATED_DELIVERABLES.map((g) => [g.label, stepOf(g.phase)]));
  const idx = goldenFleet("en");
  const seen = new Set();
  for (const m of idx.missions.filter((x) => typeof x.latest === "object")) {
    const doc = mission.path(idx, m.id);
    const gate = m.latest.currentGate;
    const red = /^deliverables filled, gate red at (.+)$/.exec(gate);
    const refusedSteps = doc.steps.filter((s) => s.reading === "refused").map((s) => s.step);
    if (byLabel.has(gate)) {
      seen.add("phase");
      assert.equal(doc.current, byLabel.get(gate), `${m.id}: the CLI places it at ${gate}`);
    } else assert.equal(doc.current, null, `${m.id}: the CLI names no open phase (${gate})`);
    if (red) {
      seen.add("red");
      assert.deepEqual(refusedSteps, [...new Set(red[1].split(", ").map((l) => byGated.get(l)))].sort(), `${m.id}: red at ${red[1]}`);
    }
    if (gate === "all gates passed") {
      seen.add("passed");
      assert.deepEqual(readings(doc), ["crossed", "crossed", "crossed", "not-asked", "crossed", "crossed"], m.id);
    }
    if (/^deliverables filled, (below the level|nothing verified)/.test(gate)) {
      seen.add("level");
      assert.deepEqual(readings(doc), ["complete", "complete", "complete", "not-asked", "complete", "complete"], m.id);
      assert.ok(doc.steps.filter((s) => s.reading === "complete").every((s) => s.why.key === "/why/complete/level-not-met"));
    }
  }
  assert.deepEqual([...seen].sort(), ["level", "passed", "phase", "red"], "each of the CLI's four kinds of label is met on a real export");
  // The hosted product's own record: frame crossed, three steps refused for their proposals, the hand-over current.
  assert.deepEqual(readings(mission.path(idx, "hosted")), ["crossed", "refused", "refused", "not-asked", "refused", "current"]);
  // The six steps are numbered as the CLI numbers its phases, and topology is folded where the CLI folds it.
  for (const p of PHASES) assert.equal(stepOf(p.id), Number(p.label.split(" · ")[0]), p.label);
  assert.equal(stepOf("topology"), 2);
  assert.deepEqual(mission.SCOPE_PHASE, Object.fromEntries(GATED_DELIVERABLES.map((g) => [g.label, g.phase])), "a gated scope names its phase as the CLI's table does");
});

/** Rule M3 and M4, read on a path document and the index it comes from. */
function crossingProblems(doc, idx) {
  const L = idx.missions.find((m) => m.id === doc.application.id)?.latest;
  const out = [];
  for (const s of doc.steps) {
    if (s.step === 4 && !["not-asked", "not-listed"].includes(s.reading)) out.push(`step 4 reads ${s.reading}`);
    if (s.reading !== "crossed") continue;
    if (L.strict !== true) out.push(`step ${s.step} crossed under a check that does not read the answers`);
    if (!["clean", "gaps"].includes(L.verdict)) out.push(`step ${s.step} crossed under ${L.verdict}`);
    if (s.refusals) out.push(`step ${s.step} crossed with refusals at it`);
    if (s.missing.length) out.push(`step ${s.step} crossed with documents missing`);
  }
  return out;
}

test("step 4 is never said crossed, and no step is crossed under a check that does not read the answers or below the level required; planted, both redden", async () => {
  const idx = goldenFleet("en");
  for (const m of idx.missions) {
    const doc = mission.path(idx, m.id);
    assert.deepEqual(crossingProblems(doc, idx), [], m.id);
    if (doc.steps.length) assert.equal(doc.steps[3].reading, "not-asked", `${m.id}: step 4`);
  }
  // A check that reads the documents only: nothing crossed, and the application says why.
  const presence = fxJson(EXPORTS.repaired);
  presence.strict = false;
  const p = single(presence, "en");
  const pd = mission.path(p, "a");
  assert.deepEqual(readings(pd), ["complete", "complete", "complete", "not-asked", "complete", "complete"]);
  assert.equal(pd.note.key, "/path/notStrict");
  assert.ok(pd.steps.filter((s) => s.reading === "complete").every((s) => s.why.key === "/why/complete/not-strict" && s.why.from === "missions[id=a].latest.strict"));
  // A check received that writes no state, and one whose state this reading does not know.
  const none = fxJson(EXPORTS.repaired);
  delete none.verdict;
  assert.equal(mission.path(single(none), "a").steps[0].why.key, "/why/complete/no-state");
  const tomorrow = fxJson(EXPORTS.repaired);
  tomorrow.verdict = "a-state-from-tomorrow";
  assert.equal(mission.path(single(tomorrow), "a").steps[0].why.key, "/why/complete/other");
  // Planted in the module's own rule: a step without a document read as any other, and a crossing that
  // does not ask what the check read. Each is caught on a real export.
  const noStep4 = await planted(['  if (step.docs.length === 0 && step.refusals.length === 0) return "not-asked";\n', ""]);
  assert.ok(crossingProblems(noStep4.path(idx, "demo-repaired"), idx).includes("step 4 reads crossed"));
  const anyCrossing = await planted(['return strict === true && (verdict === "clean" || verdict === "gaps") ? "crossed" : "complete";', 'return "crossed";']);
  assert.ok(crossingProblems(anyCrossing.path(idx, "level"), idx).some((x) => /crossed under level-not-met/.test(x)));
  assert.ok(crossingProblems(anyCrossing.path(p, "a"), p).some((x) => /does not read the answers/.test(x)));
});

// ------------------------------------------------------------------ the groupings
/** Rule M1 on a path document: each grouping n / N with the index path of each item; the steps and what
 *  lies outside them partition the documents and the refusals of the check. */
function groupingProblems(doc, idx) {
  const out = [];
  const L = idx.missions.find((m) => m.id === doc.application.id)?.latest;
  const check = (g, where) => {
    if (!g) return;
    if (g.n !== g.list.length || g.n !== g.at.length) out.push(`${where}: n is not the length of what it counts`);
    for (const at of g.at) if (rules.resolvePath(idx, at) === undefined) out.push(`${where}: ${at} does not resolve in the index`);
  };
  const docs = [], refs = [];
  for (const s of doc.steps) {
    check(s.documents?.args.count, `${s.path}.documents`);
    check(s.refusals?.args.count, `${s.path}.refusals`);
    for (const k of s.kinds) check(k.line.args.count, `${s.path}.kinds.${k.kind}`);
    if (s.documents) docs.push(...s.documents.args.count.at, ...s.missing.map((x) => x.at));
    if (s.refusals) refs.push(...s.refusals.args.count.at);
  }
  check(doc.outside?.line.args.count, "outside");
  refs.push(...(doc.outside?.line.args.count.at ?? []));
  for (const g of doc.unplaced) docs.push(...g.items.map((x) => x.at));
  const filledOnce = new Set(docs);
  const allDocs = (L.deliverables.list ?? []).map((_, i) => `missions[id=${doc.application.id}].latest.deliverables.list[${i}]`);
  const allRefs = (L.conformance ?? []).map((_, i) => `missions[id=${doc.application.id}].latest.conformance[${i}]`);
  if (filledOnce.size !== allDocs.length || allDocs.some((x) => !filledOnce.has(x))) out.push("the steps do not partition the documents");
  if (refs.length !== allRefs.length || new Set(refs).size !== refs.length || allRefs.some((x) => !refs.includes(x))) out.push("the steps do not partition the refusals");
  return out;
}

test("every grouping is n / N with the index path of each item it counts, and the steps partition the documents and the refusals; a planted count reddens", () => {
  const idx = goldenFleet("en");
  for (const m of idx.missions.filter((x) => typeof x.latest === "object")) assert.deepEqual(groupingProblems(mission.path(idx, m.id), idx), [], m.id);
  const hosted = mission.path(idx, "hosted");
  assert.deepEqual(hosted.steps.map((s) => s.refusals?.args.count.n ?? 0), [0, 10, 15, 0, 17, 4], "46 refusals, each on its step");
  assert.deepEqual(hosted.steps[5].missing.map((x) => [x.relPath, x.state]), [["handover.md", "untouched"]]);
  assert.equal(hosted.steps[5].missing[0].line.text, "Handover note: missing document", "a document named as the decision reading names it");
  // Each item names the index path of what it counts.
  const first = hosted.steps[1].refusals.args.count;
  assert.equal(rules.resolvePath(idx, first.at[0]).rule, first.list[0].split(" · ")[1]);
  // Planted: a count that is not the length of its list, and a refusal moved out of every step.
  const wrong = structuredClone(hosted);
  wrong.steps[1].refusals.args.count.n = 11;
  assert.ok(groupingProblems(wrong, idx).some((x) => /n is not the length/.test(x)));
  const lost = structuredClone(hosted);
  lost.steps[5].refusals.args.count.at.pop();
  assert.ok(groupingProblems(lost, idx).some((x) => /partition the refusals/.test(x)));
  // The portfolio counts every application declared in every column, under its reading or its own state.
  const pf = mission.portfolio(idx);
  for (const c of pf.columns) {
    assert.equal(c.byReading.reduce((t, g) => t + g.line.args.count.n, 0), pf.declared.value, `step ${c.step}`);
    for (const g of c.byReading) assert.ok(g.line.args.count.N === idx.missions.length && g.line.args.count.n > 0);
  }
  assert.deepEqual(pf.columns[3].byReading.map((g) => [g.state, g.line.args.count.list]), [["not-asked", ["demo-renamed", "demo-repaired", "hosted", "agent", "level"]], ["not-observed", ["silent"]], ["not-available", ["digest"]]]);
});

test("every number a view shows is the projection's value at the path it names, in both languages, with its denominator; planted, a number and a bare count redden", () => {
  for (const lang of ["fr", "en"]) {
    const idx = goldenFleet(lang);
    for (const m of idx.missions) assert.deepEqual(rules.checkView(mission.renderPath(idx, m.id), mission.path(idx, m.id), `path ${m.id}`), [], `${lang} ${m.id}`);
    assert.deepEqual(rules.checkView(mission.renderPortfolio(idx), mission.portfolio(idx), "portfolio"), [], lang);
    const S = goldenSeries(lang);
    assert.deepEqual(rules.checkView(mission.renderSeries(S), S, "series"), [], lang);
  }
  const idx = goldenFleet("en");
  const html = mission.renderPath(idx, "hosted");
  const doc = mission.path(idx, "hosted");
  assert.match(html, /data-index="steps\[2\]\.refusals\.args\.count\.n"[^>]*>15<\/span>/);
  assert.ok(rules.checkView(html.replace(/(steps\[2\]\.refusals\.args\.count\.n"[^>]*>)15</, "$114<"), doc, "planted").some((x) => /steps\[2\]\.refusals\.args\.count\.n is shown as "14"/.test(x)));
  assert.ok(rules.checkView(html.replace(/<span class="n" data-src="hosted:check" data-index="steps\[2\]\.refusals\.args\.count\.N"[^>]*>46<\/span>/, ""), doc, "planted").some((x) => /without its denominator/.test(x)));
});

// ------------------------------------------------------------------ the words
function* strings(value, path) {
  if (typeof value === "string") { yield [path, value]; return; }
  for (const [k, v] of Object.entries(value ?? {})) yield* strings(v, `${path}.${k}`);
}
/** Rule M5 on a lexicon: no word runward never says, no reading or reason named as a decision taken, the same keys in both languages. */
function lexiconProblems(lexicon) {
  const out = [];
  const keys = (lang) => new Set([...strings(lexicon[lang], "")].map(([p]) => p));
  for (const lang of Object.keys(lexicon)) {
    for (const [p, text] of strings(lexicon[lang], "")) {
      const own = text.replace(/\{[A-Za-z]+\}/g, " ");
      for (const re of rules.BANNED) { const m = own.match(re); if (m) out.push(`${lang}${p}: a word runward does not use about itself: "${m[0]}"`); }
      if (/^\.(reading|why)\./.test(p)) for (const re of rules.NOT_A_STATE) { const m = own.match(re); if (m) out.push(`${lang}${p}: a reading names a decision taken: "${m[0]}"`); }
    }
    for (const other of Object.keys(lexicon)) if (other !== lang) for (const k of keys(lang)) if (!keys(other).has(k)) out.push(`${lang}${k} has no sentence in ${other}`);
  }
  return out;
}

test("the lexicon holds no word runward never says and names no reading as a decision taken, in both languages, which hold the same keys; each planted breach reddens", () => {
  assert.deepEqual(lexiconProblems(mission.MISSION_LEXICON), []);
  for (const r of mission.MISSION_RULES) for (const lang of ["en", "fr"]) for (const re of rules.BANNED) assert.ok(!re.test(r[lang]), `${r.id} ${lang}`);
  for (const [lang, at, text, expect] of [
    ["en", ["reading", "crossed"], "Ready", /reading names a decision taken: "Ready"/],
    ["fr", ["reading", "complete"], "Prête", /reading names a decision taken: "Prête"/],
    ["en", ["why", "refused"], "Its documents are blocked.", /decision taken: "blocked"/],
    ["fr", ["path", "lede"], "Une étape tracée.", /does not use about itself: "tracée"/],
    ["en", ["series", "origin"], "A guaranteed history.", /does not use about itself: "guaranteed"/],
  ]) {
    const lex = structuredClone(mission.MISSION_LEXICON);
    lex[lang][at[0]][at[1]] = text;
    assert.match(lexiconProblems(lex).join("\n"), expect, `${lang} ${at.join(".")}`);
  }
  const cut = structuredClone(mission.MISSION_LEXICON);
  delete cut.fr.why.complete.other;
  assert.ok(lexiconProblems(cut).includes("en.why.complete.other has no sentence in fr"));
  // On the rendered views: the words (BANNED, held by checkView above), the state words, and "nothing is
  // blocking" never without the team's requirements and the date of the last check (ADR-0125 R4). The
  // method's own words are this view's on purpose: it names the six steps.
  const R4 = (html) => rules.checkReading(html).filter((x) => !/a word of the method/.test(x));
  for (const lang of ["fr", "en"]) {
    const idx = goldenFleet(lang);
    for (const m of idx.missions) assert.deepEqual(R4(mission.renderPath(idx, m.id)), [], `${lang} ${m.id}`);
    const pf = mission.renderPortfolio(idx);
    assert.deepEqual(R4(pf), [], lang);
    assert.ok(R4(pf.replace(/<p data-role="qualifier">[^<]*<\/p>/, "")).some((x) => /without the team's requirements/.test(x)), `${lang}: a planted bare "nothing is blocking" is caught`);
  }
});

test("the specification shows the lexicon as it ships, in both languages; a sentence changed in the code and not in the specification reddens", () => {
  const spec = readFileSync(join(ROOT, "docs", "spec", "runward-fleet-mission.md"), "utf8");
  const shown = (lexicon) => ["en", "fr"].flatMap((lang) => [...strings(lexicon[lang], "")].map(([, t]) => t))
    .filter((t) => !spec.includes(t.replace(/ /g, " ").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")));
  assert.deepEqual(shown(mission.MISSION_LEXICON), [], "docs/spec/runward-fleet-mission.md holds every sentence");
  const changed = structuredClone(mission.MISSION_LEXICON);
  changed.fr.reading.crossed = "Passée";
  assert.deepEqual(shown(changed), ["Passée"]);
  for (const r of mission.MISSION_RULES) assert.ok(spec.includes(r.en), `${r.id} is in the specification`);
});

// ------------------------------------------------------------------ the closed values
test("the closed values of the projections are the module's, every phase the CLI writes is on exactly one step, and every value has its sentence in both languages; a phase without a step reddens", () => {
  const C = CLOSED.mission;
  assert.deepEqual(C.steps, mission.STEPS);
  assert.deepEqual(C.scopePhase, mission.SCOPE_PHASE);
  assert.deepEqual(C.reading, mission.READINGS);
  assert.deepEqual(C.completeCause, mission.COMPLETE_CAUSES);
  assert.deepEqual(C.hole, mission.HOLES);
  const unplaced = (phases) => phases.filter((ph) => mission.STEPS.filter((s) => s.phases.includes(ph)).length !== 1);
  assert.deepEqual(unplaced(listOf("phase")), [], "each phase the CLI writes is on one step");
  assert.deepEqual(unplaced([...listOf("phase"), "a-phase-from-tomorrow"]), ["a-phase-from-tomorrow"], "planted: a phase the list gains without a step");
  for (const scope of Object.keys(mission.SCOPE_PHASE)) assert.ok(listOf("conformanceScope").includes(scope), scope);
  const need = [
    ...mission.STEPS.map((s) => ["step", s.id]), ...mission.READINGS.map((r) => ["reading", r]),
    ...mission.READINGS.filter((r) => r !== "complete").map((r) => ["why", r]), ...mission.COMPLETE_CAUSES.map((c) => ["why", "complete", c]),
    ...[...mission.HOLES, ...C.pointState].map((h) => ["series", "state", h]), ...mission.HOLES.map((h) => ["series", h]),
  ];
  for (const lang of ["en", "fr"]) {
    const missing = need.filter((keys) => typeof keys.reduce((o, k) => o?.[k], mission.MISSION_LEXICON[lang]) !== "string");
    assert.deepEqual(missing, [], lang);
  }
});

// ------------------------------------------------------------------ older indexes, unknown values
test("an index written before refusals carried their phase reads the same steps; an explicit null phase belongs to no step", () => {
  const idx = goldenFleet("en");
  const old = structuredClone(idx);
  for (const m of old.missions) if (typeof m.latest === "object") for (const c of m.latest.conformance) delete c.phaseId;
  for (const m of idx.missions.filter((x) => typeof x.latest === "object")) {
    const [now, then] = [mission.path(idx, m.id), mission.path(old, m.id)];
    assert.deepEqual(readings(then), readings(now), m.id);
    assert.deepEqual(then.steps.map((s) => s.refusals?.args.count.at ?? []), now.steps.map((s) => s.refusals?.args.count.at ?? []), m.id);
    assert.deepEqual(mission.point(old).missions.find((x) => x.id === m.id).steps, mission.point(idx).missions.find((x) => x.id === m.id).steps);
  }
  // Control: the fallback reads a scope only where the field is absent. A null phase is the export's own word: no step.
  const none = structuredClone(idx);
  for (const c of none.missions.find((m) => m.id === "demo-renamed").latest.conformance) c.phaseId = null;
  const nd = mission.path(none, "demo-renamed");
  assert.deepEqual(readings(nd), ["crossed", "crossed", "crossed", "not-asked", "crossed", "crossed"]);
  assert.equal(nd.outside.line.args.count.text, "2 / 2");
  assert.deepEqual(nd.outside.kinds.map((k) => k.line.text), ["2 / 2 refusals of this kind: a cited piece of evidence is refused by the check."]);
});

test("a value the lexicon does not know is shown as written, escaped, never dropped and never guessed", () => {
  const odd = fxJson(EXPORTS.renamed);
  odd.deliverables[0].phaseId = "<b>phase</b>";
  odd.deliverables[1].phaseId = null;
  odd.conformance[0].kind = 'a&"kind';
  const idx = single(odd, "en");
  const doc = mission.path(idx, "a");
  assert.equal(doc.steps[0].documents, null, "frame lost both its documents to the unknown phases");
  assert.equal(doc.steps[0].reading, "not-asked");
  assert.deepEqual(doc.unplaced.map((g) => [g.phaseId, g.label.text]), [["<b>phase</b>", "Kind of document as the check names it: <b>phase</b>"], [null, "Documents with no kind written"]]);
  const html = mission.renderPath(idx, "a");
  assert.ok(html.includes("<span data-verbatim>&lt;b&gt;phase&lt;/b&gt;</span>"), "escaped, as data");
  assert.ok(!html.includes("<b>phase</b>"));
  assert.match(html, /detail of the check, as written: <span data-verbatim>a&amp;&quot;kind<\/span>\./);
  assert.deepEqual(rules.checkView(html, doc, "odd"), []);
  // An export that lists no document: no step can be read, and none is guessed.
  const bare = fxJson(EXPORTS.repaired);
  bare.deliverables = [];
  const bd = mission.path(single(bare), "a");
  assert.deepEqual(readings(bd), Array(6).fill("not-listed"));
  assert.equal(bd.note.key, "/path/notListed");
});

test("an application without a check read has its own state and no step, and is listed and counted, never filtered", () => {
  for (const [lang, words] of [["en", ["No check received", "Content not shared"]], ["fr", ["Aucun contrôle reçu", "Contenu non partagé"]]]) {
    const idx = goldenFleet(lang);
    for (const [id, word] of [["silent", words[0]], ["digest", words[1]]]) {
      const doc = mission.path(idx, id);
      assert.equal(doc.observed, false);
      assert.deepEqual(doc.steps, []);
      assert.equal(doc.application.stateWord.text, word);
      assert.match(mission.renderPath(idx, id), new RegExp(`data-role="state-word">${word}<`));
    }
    const html = mission.renderPortfolio(idx);
    for (const m of idx.missions) assert.ok(html.includes(`<tr data-mission="${m.id}"`), `${lang}: ${m.id} is a row`);
    assert.match(html, /<tr data-mission="silent" data-state="not-observed">[\s\S]*?<td colspan="6" data-role="unread">/);
  }
  assert.equal(mission.path(goldenFleet("en"), "nobody"), null);
  assert.equal(mission.renderPath(goldenFleet("en"), "nobody"), mission.renderPortfolio(goldenFleet("en")), "an id the inventory does not declare shows the portfolio");
});

// ------------------------------------------------------------------ point and series
/** Four versions of an inventory as a service would receive them, the second one erased. */
function versions(lang = "en") {
  const inv = (apps) => indexFrom(manifestOf(apps.map(([id, file]) => ({ id, name: `example/${id}`, repository: `github.com/example/${id}`, exports: { check: { file: `${id}.json` } } })), { lang }),
    Object.fromEntries(apps.filter(([, f]) => f).map(([id, f]) => [`${id}.json`, fx(f)])));
  return [
    { version: 11, seq: 1, at: "2026-11-08", point: mission.point(inv([["demo", EXPORTS.renamed], ["hosted", EXPORTS.hosted], ["silent", null]])) },
    { version: 12, seq: 2, at: "2026-11-09", erased: true },
    { version: 13, seq: 3, at: "2026-11-10", point: mission.point(inv([["demo", EXPORTS.repaired], ["hosted", EXPORTS.hosted], ["silent", null]])) },
    { version: 14, seq: 4, at: "2026-11-11", point: mission.point(inv([["demo", EXPORTS.repaired], ["hosted", EXPORTS.hosted], ["level", EXPORTS.level], ["silent", null]])) },
  ];
}
/** The series of those versions, given out of order. */
function goldenSeries(lang = "en") {
  const v = versions(lang);
  return mission.series([v[2], v[0], v[3], v[1]]);
}

test("the point of a version is compact, a pure function of the index, and reads an index built before refusals carried their phase", () => {
  const idx = goldenFleet("en");
  const pt = mission.point(idx);
  assert.deepEqual(mission.point(JSON.parse(`${JSON.stringify(idx, null, 2)}\n`)), pt, "the same from the bytes of index.json");
  assert.equal(pt.format, "runward-fleet-point/0");
  const by = Object.fromEntries(pt.missions.map((m) => [m.id, m]));
  assert.deepEqual(by.hosted, {
    id: "hosted", name: "runward-hosted", state: "gaps", runward: "0.46.0", commit: null, gate: "6 · Hand over", exitCode: 1,
    gaps: { deliverables: 1, conformance: 46 }, check: sha(fx(EXPORTS.hosted)), steps: ["crossed", "refused", "refused", "not-asked", "refused", "current"],
  });
  assert.deepEqual([by.silent.state, by.silent.check, by.silent.steps, by.silent.gaps], ["not-observed", null, null, null]);
  assert.deepEqual([by.digest.state, by.digest.check], ["not-available", sha(fx(EXPORTS.renamed))], "the digest the inventory declares");
  const bytes = JSON.stringify(pt).length;
  assert.ok(bytes < JSON.stringify(idx).length / 20 && bytes < 4096, `compact: ${bytes} bytes`);
  const none = fxJson(EXPORTS.repaired);
  delete none.verdict;
  assert.equal(mission.point(single(none)).missions[0].state, "no-state", "a check received that writes no state is not one never received");
});

test("the series: the versions received in the order of seq, since when from the last run, a hole breaking it, a change of judging version marked", () => {
  const S = goldenSeries("en");
  assert.deepEqual([S.format, S.origin, S.size], ["runward-fleet-series/0", "received", 4]);
  const by = Object.fromEntries(S.series.map((x) => [x.id, x]));
  assert.deepEqual(S.series.map((x) => x.id), ["demo", "hosted", "level", "silent"], "the last version's applications, in its order");
  assert.deepEqual(by.demo.points.map((x) => [x.version, x.state]), [[11, "gaps"], [12, "erased"], [13, "clean"], [14, "clean"]]);
  assert.deepEqual(by.demo.since, { version: 13, seq: 3, at: "2026-11-10", state: "clean", gate: "all gates passed" });
  assert.equal(by.hosted.since.version, 13, "the same state on both sides of an erased version: the hole breaks the run");
  assert.equal(by.level.since.version, 14);
  assert.equal(by.silent.since.version, 13);
  assert.deepEqual(by.demo.byState.map((g) => [g.state, g.line.args.count.text]), [["clean", "2 / 4"], ["gaps", "1 / 4"], ["erased", "1 / 4"]]);
  // Without seq, the order given; an application absent from the last version has no since.
  const v = versions();
  const noSeq = mission.series([v[3], v[0]].map(({ seq, ...e }) => e));
  assert.deepEqual(noSeq.series.find((x) => x.id === "demo").points.map((x) => x.version), [14, 11]);
  assert.equal(mission.series([v[3], { ...v[0], seq: 5 }]).series.find((x) => x.id === "level").since, null);
  // A last version that is a hole: no since for anyone; an unreadable version is a hole too.
  assert.ok(mission.series([v[0], { version: 15, seq: 9, at: "2026-11-12", point: { format: "something-else" } }]).series.every((x) => x.since === null && x.points.at(-1).state === "unreadable"));
  // Rule 7: a change of the judging version is marked, on the point and on the page; one judge, no marker.
  assert.ok(S.series.every((x) => x.points.every((pt) => pt.judgeChanged !== true)) && !mission.renderSeries(S).includes("other-judge"));
  const judged = structuredClone(v);
  judged[3].point.missions.find((x) => x.id === "demo").runward = "0.47.0";
  const J = mission.series(judged);
  const demo = J.series.find((x) => x.id === "demo");
  assert.deepEqual(demo.judgedBy, ["0.46.0", "0.47.0"]);
  assert.deepEqual(demo.points.filter((x) => x.judgeChanged).map((x) => x.version), [14]);
  assert.match(mission.renderSeries(J, "demo"), /data-marker="other-judge"/);
  // Rule 6: received, never mixed with a replay; dated by the service's clock, said declared.
  const html = mission.renderSeries(S);
  assert.match(html, /data-origin="received"/);
  assert.ok(!/replayed/.test(html));
  assert.match(rules.ownText(html), /declared, not verified/);
  // The view prints since when as the projection holds it: it computes nothing.
  const moved = structuredClone(S);
  moved.series[0].sinceLine.args.version.text = "99";
  assert.match(mission.renderSeries(moved, "demo"), /since version <span data-verbatim>99<\/span>/);
});

// ------------------------------------------------------------------ golden, and one interface
test("the projections of real exports are golden, in both languages, and the same through the package's exports", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-fleet-mission-pkg-"));
  try {
    mkdirSync(join(dir, "node_modules"));
    symlinkSync(PKG, join(dir, "node_modules", "runward-fleet"), "junction");
    writeFileSync(join(dir, "consumer.mjs"), 'export * from "runward-fleet/mission";\n');
    const hosted = await import(pathToFileURL(join(dir, "consumer.mjs")).href);
    assert.deepEqual(["path", "portfolio", "point", "series", "renderPath", "renderPortfolio", "renderSeries", "missionLexiconAt"].filter((k) => typeof hosted[k] !== "function"), [], "runward-fleet/mission exports the projections and their views");
    for (const lang of ["fr", "en"]) {
      const idx = goldenFleet(lang);
      const received = JSON.parse(`${JSON.stringify(idx, null, 2)}\n`);
      const S = goldenSeries(lang);
      const pages = [["portfolio", mission.renderPortfolio(idx)], ...idx.missions.map((m) => [m.id, mission.renderPath(idx, m.id)]), ["series", mission.renderSeries(S)]];
      assert.equal(hosted.renderPortfolio(received), pages[0][1], `${lang} portfolio`);
      for (const m of idx.missions) assert.equal(hosted.renderPath(received, m.id), mission.renderPath(idx, m.id), `${lang} ${m.id}`);
      assert.equal(hosted.renderSeries(hosted.series(versions(lang).map((e, i, all) => all[[2, 0, 3, 1][i]]))), pages.at(-1)[1], `${lang} series`);
      const doc = `${JSON.stringify({ portfolio: mission.portfolio(idx), paths: Object.fromEntries(idx.missions.map((m) => [m.id, mission.path(idx, m.id)])), point: mission.point(idx), series: S }, null, 2)}\n`;
      const hashes = `${pages.map(([name, html]) => `${sha(html)}  ${name}`).join("\n")}\n`;
      const [docFile, hashFile] = [join(GOLDEN, `mission.${lang}.json`), join(GOLDEN, `mission.${lang}.sha256`)];
      if (process.env.UPDATE_GOLDEN === "1") { writeFileSync(docFile, doc); writeFileSync(hashFile, hashes); }
      for (const f of [docFile, hashFile]) assert.ok(existsSync(f), `${f} is missing: run with UPDATE_GOLDEN=1 once, then read the diff`);
      assert.equal(doc, readFileSync(docFile, "utf8"), `${lang}: a projection moved: regenerate with UPDATE_GOLDEN=1 and read the diff`);
      assert.equal(hashes, readFileSync(hashFile, "utf8"), `${lang}: a page moved: regenerate with UPDATE_GOLDEN=1 and read the diff`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the module imports the package's views and nothing else, and reads no clock", () => {
  const specifiers = [...SRC.matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(specifiers, ["./views.js"]);
  assert.ok(!/\bimport\s*\(/.test(SRC), "no dynamic import");
  assert.ok(!rules.CLOCK.test(SRC), "no clock");
});
