// The view rules of ADR-0093 decision 11, held on what runward-fleet renders. Each test runs the
// rule on the real views, then on a planted mutation of the views (a copy of ui/views.js with one
// line changed, imported from a temporary directory) or of the index, and the rule must redden on
// the mutation: a rule that stops seeing its violation fails here. The rules the satellite does not
// hold (the CLI verifies no signature, the side channel, the bypass review) are held by runward and
// listed as such on the sources view.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { allRendered, build, exampleCheck, fixture, indexFrom, manifestOf, missionWith, pageFor, PKG, realCheck, rules, site, views } from "../support/fleet.js";

const SRC = readFileSync(join(PKG, "ui", "views.js"), "utf8");
const own = (html) => rules.ownText(html).replace(/\s+/g, " ").trim();
const face = (html, name) => (html.match(new RegExp(`<p class="face" data-face="${name}">([\\s\\S]*?)</p>`)) ?? [])[1] ?? "";

/** A copy of ui/views.js with each [from, to] applied (each must apply), imported fresh. */
async function planted(...edits) {
  let s = SRC;
  for (const [from, to] of edits) {
    assert.ok(s.includes(from), `the plant applies: ${from.slice(0, 60)}`);
    s = s.replace(from, to);
  }
  const dir = mkdtempSync(join(tmpdir(), "rw-fleet-views-"));
  const file = join(dir, `views-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, s);
  try { return await import(pathToFileURL(file).href); } finally { rmSync(dir, { recursive: true, force: true }); }
}

function realIndex(lang = "en") {
  return indexFrom(manifestOf([
    { id: "runward", name: "stranxik/runward", repository: "github.com/stranxik/runward", exports: {
      check: { file: "c.json" }, attestation: { file: "a.json" }, verify: { file: "v.json" }, witness: { file: "w.json" }, summary: { file: "s.md" }, history: { file: "r.jsonl" } } },
    { id: "example", name: "examples/request-triage", repository: "github.com/stranxik/runward", exports: { check: { file: "e.json" } } },
    { id: "silent", name: "example/silent", repository: "github.com/example/silent", exports: { check: { file: "missing.json" } } },
  ], { lang }), {
    "c.json": realCheck(), "a.json": fixture("exports", "runward.verdict.intoto.json"), "v.json": fixture("exports", "runward.verify.json"),
    "w.json": fixture("exports", "runward.witness.json"), "s.md": fixture("exports", "runward.summary.md"), "r.jsonl": fixture("exports", "runward.records.jsonl"), "e.json": exampleCheck(),
  });
}

/** The real index, its fleet counts replaced by distinctive ones whose pairwise sums collide with nothing shown. */
function distinctive() {
  const idx = structuredClone(realIndex());
  const g = (state, n, N) => ({ state, n, N, list: Array.from({ length: n }, (_, i) => `${state}-${i}`) });
  idx.fleet.declared = 18;
  idx.fleet.byVerdict = [g("clean", 2, 18), g("gaps", 5, 18), g("not-observed", 11, 18)];
  idx.fleet.byImplemented = [g("machine-established", 3, 18), g("ci-declared", 4, 18), g("not-observed", 11, 18)];
  return idx;
}

test("rules 1 and 2: every number a view shows is the index's own value at the path it names, in both languages", () => {
  for (const lang of ["en", "fr"]) {
    for (const [where, html] of allRendered(realIndex(lang))) assert.deepEqual(rules.checkView(html, realIndex(lang), where), [], `${lang} ${where}`);
  }
});

test("rule 2, the golden face: the fleet face is a function of the index's fields, word for word", () => {
  const idx = distinctive();
  assert.equal(own(face(views.renderView(idx, ""), "fleet")), "18 missions declared: 2 / 18 clean, 5 / 18 refused, 11 / 18 silent. 3 / 18 machine-established, 4 / 18 ci-declared.");
  idx.lang = "fr";
  assert.equal(own(face(views.renderView(idx, ""), "fleet")), "18 missions déclarées : 2 / 18 sans écart, 5 / 18 refusées, 11 / 18 silencieuses. 3 / 18 machine-established, 4 / 18 ci-declared.");
});

test("rule 1, planted: a view that counts the missions itself instead of reading the index is caught", async () => {
  const idx = distinctive(); // declares 18 missions while the array holds 3: a view that counts shows 3
  const mutant = await planted(['n(F.declared, s0, "missions.length", "fleet.declared")', 'n(IDX.missions.length, s0, "missions.length", "fleet.declared")']);
  const problems = rules.checkView(mutant.renderView(idx, ""), idx, "planted");
  assert.ok(problems.some((p) => /fleet\.declared is shown as "3", the index holds 18/.test(p)), problems.join("\n"));
});

test("rule 3: a face never prints a sum of the states it lists, nor a percentage; planted, both are caught", async () => {
  const idx = distinctive();
  const sums = new Set([2 + 5, 2 + 11, 5 + 11, 3 + 4, 3 + 11, 4 + 11]);
  const numbers = (html) => (own(face(html, "fleet")).match(/\d+/g) ?? []).map(Number);
  assert.deepEqual(numbers(views.renderView(idx, "")).filter((x) => sums.has(x)), []);
  const summed = await planted(['frac(find(F.byVerdict, "clean"), s0, gp(BV, "clean"))', 'n(find(F.byVerdict, "clean").n + find(F.byVerdict, "gaps").n, s0, null, "fleet.byVerdict[state=clean].n")']);
  const html = summed.renderView(idx, "");
  assert.ok(numbers(html).some((x) => sums.has(x)), "the planted sum shows 7");
  assert.ok(rules.checkView(html, idx, "planted").length > 0, "and the tie check sees it");
  const pct = await planted(['<p class="face" data-face="fleet">${t.fleetFace(', '<p class="face" data-face="fleet">${(find(F.byVerdict, "clean").n / F.declared * 100).toFixed(0)}% ${t.fleetFace(']);
  assert.ok(rules.checkView(pct.renderView(idx, ""), idx, "planted").some((p) => /percentage/.test(p)));
  const page = pageFor(realIndex());
  assert.ok(rules.checkPage(page.replace("// ---------------------------------------------------------------- the shell", "const p = (a, b) => `${(a / b * 100).toFixed(1)}%`;")).some((p) => /percentage/.test(p)), "a page script that computes one is refused");
});

test("every count carries its denominator; a planted bare count is caught", async () => {
  for (const [where, html] of allRendered(realIndex())) assert.deepEqual(rules.checkView(html, null, where).filter((p) => /denominator/.test(p)), []);
  const bare = await planted(['frac(find(F.byVerdict, "gaps"), s0, gp(BV, "gaps"))', 'n(find(F.byVerdict, "gaps").n, s0, null, `${gp(BV, "gaps")}.n`)']);
  assert.ok(rules.checkView(bare.renderView(distinctive(), ""), null, "planted").some((p) => /without its denominator/.test(p)));
});

test("rules 4 and 5: a silent mission is listed, counted and named, never filtered; a planted filter is caught", async () => {
  const idx = realIndex();
  const html = views.renderView(idx, "");
  for (const m of idx.missions) assert.ok(html.includes(`data-mission="${m.id}"`), `${m.id} is listed`);
  assert.match(own(face(html, "fleet")), /1 \/ 3 silent/);
  assert.ok(html.includes("example/silent"), "named, verbatim");
  assert.match(own(html), /check --json not observed declared in fleet\.json, file absent \(missing\.json\)/, "and listed among what is not there");
  const filtering = await planted(["const rows = IDX.missions.map((m) => {", 'const rows = IDX.missions.filter((m) => m.latest !== "not-observed").map((m) => {']);
  assert.ok(!filtering.renderView(idx, "").includes('data-mission="silent"'), "the planted filter hides the silent mission, which this test sees");
});

test("rule 6: two origins are two histories, each under its own origin, never one", () => {
  const lines = fixture("exports", "runward.records.jsonl").toString("utf8").trim().split("\n");
  const other = JSON.parse(lines[0]);
  other.origin = "undetermined";
  const idx = indexFrom(manifestOf([{ ...missionWith("a"), exports: { check: { file: "c.json" }, history: { file: "r.jsonl" } } }]), { "c.json": realCheck(), "r.jsonl": `${lines.join("\n")}\n${JSON.stringify(other)}\n` });
  const html = views.renderView(idx, "history");
  assert.equal((html.match(/data-face="history"/g) ?? []).length, 2);
  assert.ok(html.includes('data-state="replayed"') && html.includes('data-state="undetermined"'));
});

test("rule 7: records judged by another version carry a marker, and a version skew with the latest export is said", () => {
  const idx = structuredClone(realIndex());
  const s = idx.missions[0].history.series[0];
  const html = () => views.renderView(idx, "history");
  assert.equal(idx.missions[0].latest.runward, "0.46.0");
  assert.ok(!html().includes('data-marker="other-judge"') && !html().includes('data-marker="version-skew"'), "control: one judge, the latest export's version, no marker");
  idx.missions[0].latest.runward = "0.47.0";
  assert.ok(html().includes('data-marker="version-skew"'), "the latest export judged by another version than the history: said");
  idx.missions[0].latest.runward = "0.46.0";
  s.judgedBy.push("runward@0.46.0 built from 090e411afe2d");
  s.records[0].judge = 1;
  assert.ok(html().includes('data-marker="other-judge"'), "a record judged by another build: marked");
});

test("rule 8: a past green carries no present state: a mission silent today reads silent, whatever its history", () => {
  const idx = indexFrom(manifestOf([{ ...missionWith("a"), exports: { check: { file: "missing.json" }, history: { file: "r.jsonl" } } }]), { "r.jsonl": fixture("exports", "runward.records.jsonl") });
  assert.equal(idx.missions[0].latest, "not-observed");
  assert.deepEqual(idx.fleet.byVerdict.find((g) => g.state === "clean").list, []);
  assert.match(own(face(views.renderView(idx, ""), "fleet")), /0 \/ 1 clean, 0 \/ 1 refused, 1 \/ 1 silent/);
});

test("rule 10: machine-established is the satellite's: an export's own claim is never copied, and a cell raised without a signature is caught", () => {
  const check = JSON.parse(realCheck().toString("utf8"));
  check.implemented = "machine-established";
  const idx = indexFrom(manifestOf([missionWith("a")]), { "exports/a/check.json": check });
  assert.equal(idx.missions[0].latest.implemented, "ci-declared");
  assert.deepEqual(rules.checkIndex(idx), []);
  const forged = structuredClone(idx);
  forged.missions[0].latest.implemented = "machine-established";
  assert.ok(rules.checkIndex(forged).some((p) => /without a raised, verified signature/.test(p)));
});

test("rule 12: no approval of a management body is ever carried; a planted one is caught", () => {
  const idx = realIndex();
  assert.deepEqual(rules.checkIndex(idx), []);
  const planted12 = structuredClone(idx);
  planted12.fleet.managementApproval = true;
  assert.ok(rules.checkIndex(planted12).some((p) => /managementApproval/.test(p)));
});

test("rule 14: under the machine mode, a row without ratification reads machine mode in force, never a gap", () => {
  const idx = realIndex();
  assert.match(idx.missions[0].latest.assurance.inForce, /^machine/);
  assert.match(own(views.renderView(idx, "mission", "runward")), /machine mode in force: a row without ratification is not a gap/);
  const human = structuredClone(idx);
  human.missions[0].latest.assurance.inForce = "human";
  assert.doesNotMatch(own(views.renderView(human, "mission", "runward")), /machine mode in force/, "control: another mode, no such line");
});

test("rule 15 and the words: no view says emergency, nor a word runward refuses, in either language; planted, they are caught", async () => {
  for (const lang of ["en", "fr"]) {
    for (const [where, html] of allRendered(realIndex(lang))) {
      assert.deepEqual(rules.checkView(html, null, where).filter((p) => /emergency|does not use/.test(p)), [], `${lang} ${where}`);
    }
  }
  const copy = await planted(['fleetTitle: "What the fleet proves.",', 'fleetTitle: "What the certified fleet proves in an emergency.",']);
  const problems = rules.checkView(copy.renderView(realIndex(), ""), null, "planted");
  assert.ok(problems.some((p) => /"certified"/.test(p)) && problems.some((p) => /emergency/.test(p)), problems.join("\n"));
  // A word inside data is the data's: a mission named after its product is shown, verbatim, and not refused.
  const named = indexFrom(manifestOf([{ ...missionWith("a"), name: "payments-platform" }]), { "exports/a/check.json": realCheck() });
  const html = views.renderView(named, "");
  assert.ok(html.includes("payments-platform"));
  assert.deepEqual(rules.checkView(html, named, "data").filter((p) => /does not use/.test(p)), []);
});

test("the package's own words: no source of runward-fleet uses a refused word (the list itself excepted)", () => {
  const files = [...readdirSync(join(PKG, "src")).map((f) => join(PKG, "src", f)), join(PKG, "ui", "views.js"), join(PKG, "ui", "template.html"), join(PKG, "README.md")];
  for (const f of files) {
    if (f.endsWith("rules.js")) continue;
    const text = readFileSync(f, "utf8");
    for (const re of rules.BANNED) assert.ok(!re.test(text), `${f} uses ${re}`);
  }
  assert.ok(rules.BANNED.some((re) => re.test("compliant")) && rules.BANNED.some((re) => re.test("plateforme")), "control: the list catches both languages");
});

test("gold, once at most per view: the proof moment, or the raised cells; a planted second gold is caught", async () => {
  for (const [where, html] of allRendered(realIndex())) {
    const golds = rules.checkView(html, null, where).filter((p) => /gold/.test(p));
    assert.deepEqual(golds, [], where);
  }
  const proof = views.renderView(realIndex(), "proof");
  assert.equal((proof.match(/class="[^"]*\bor\b[^"]*"/g) ?? []).length, 1, "the proof view spends its one gold on the verdict that re-derives");
  const twice = await planted(['line(V.digestMatches, esc(t.vDigest)),', 'line(V.digestMatches, esc(t.vDigest), true),']);
  assert.ok(rules.checkView(twice.renderView(realIndex(), "proof"), null, "planted").some((p) => /gold appears 2 times/.test(p)));
  const page = pageFor(realIndex());
  assert.ok(rules.checkPage(page.replace(".or{ color:var(--or); }", ".or{ color:var(--or); }\nh1{ color:var(--or); }")).some((p) => /gold is used outside/.test(p)));
  assert.ok(rules.checkPage(page.replace("--term:#131110;", "--term:#131110; --or2:#C9A45C;")).some((p) => /defined once/.test(p)));
});

test("no private path in a view or a page, and a planted one is caught", () => {
  const html = views.renderView(realIndex(), "");
  assert.deepEqual(rules.checkView(html, null, "fleet").filter((p) => /private/.test(p)), []);
  assert.ok(rules.checkView(`${html}<p>/Users/someone/x</p>`, null, "planted").some((p) => /private/.test(p)));
  assert.ok(rules.checkPage(pageFor(realIndex()).replace("</body>", "<!-- /home/ci/x --></body>")).some((p) => /private/.test(p)));
});

test("no clock in the page script; a planted one is caught", () => {
  const page = pageFor(realIndex());
  assert.deepEqual(rules.checkPage(page).filter((p) => /clock/.test(p)), []);
  for (const plant of ["const now = Date.now();", "const d = new Date();", "performance.now();", "x.toLocaleDateString();"]) {
    assert.ok(rules.checkPage(page.replace("// ---------------------------------------------------------------- the shell", plant)).some((p) => /clock/.test(p)), plant);
  }
});

test("the build refuses to write a page whose views break a rule: the rules are held before anything is written", async () => {
  const twice = await planted(['line(V.digestMatches, esc(t.vDigest)),', 'line(V.digestMatches, esc(t.vDigest), true),']);
  const idx = realIndex();
  const args = { template: readFileSync(join(PKG, "ui", "template.html"), "utf8"), views: SRC, api: twice, fonts: [] };
  assert.throws(() => site.renderSite(idx, args), (e) => e instanceof build.BuildError && /#\/proof: gold appears 2 times/.test(e.message));
  assert.doesNotThrow(() => site.renderSite(idx, { ...args, api: views }), "control: the shipped views pass");
});

test("the sources view lists the eighteen rules of ADR-0093 and where each is held", () => {
  assert.deepEqual(views.RULES.map((r) => r.id), Array.from({ length: 18 }, (_, i) => i + 1));
  assert.deepEqual(views.RULES.filter((r) => r.held === "elsewhere").map((r) => r.id), [9, 13, 16]);
  const html = views.renderView(realIndex(), "sources");
  assert.equal((html.match(/<tr><td>\d+<\/td>/g) ?? []).length, 18);
});

test("a view that cannot be built from the index stops the build; the page alone says so in a sentence", async () => {
  const broken = await planted(["function viewProof() {", "function viewProof() {\n  throw new Error(\"planted\");"]);
  const idx = realIndex();
  assert.match(broken.renderView(idx, "proof"), /could not be built/, "the page shows a sentence");
  assert.throws(() => broken.renderView(idx, "proof", undefined, { strict: true }), /planted/);
  const args = { template: readFileSync(join(PKG, "ui", "template.html"), "utf8"), views: SRC, api: broken, fonts: [] };
  assert.throws(() => site.renderSite(idx, args), (e) => e instanceof build.BuildError && /#\/proof: the view cannot be built/.test(e.message));
});
