// The decision reading of runward-fleet (ADR-0125): a plain-language projection of the index, written
// from a closed lexicon in both languages, with no model and nothing computed. Each property is held with
// its planted control:
//   - the closed lists of docs/spec/runward-closed-values.json are the values the CLI of this tree writes,
//     read from its code (its declared types, and the literals of the table it builds), and every value
//     has a sentence in both languages; a value the lexicon does not know is shown as written;
//   - the reading's words: none runward never says, in any form, none of the method's, no state named as
//     a decision taken, "nothing is blocking" never without the team's requirements and the date;
//   - the refusal's text is shown character for character and never read: no sentence moves with it;
//   - the line of a refusal and the groupings n / N of how rows were endorsed come from the index;
//   - a row endorsed by an agent is never worded as a person's, and names can be left out of an index;
//   - a mission received as digests only has its own state, and no history is shown;
//   - the readings of real exports are golden, in both languages, and the same through the package's exports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { build, indexFrom, manifestOf, missionWith, pageFor, PKG, realCheck, ROOT, rules, site, views } from "../support/fleet.js";

const DECISION = join(ROOT, "test", "fixtures", "fleet", "decision");
const fx = (name) => readFileSync(join(DECISION, name));
const CLOSED = JSON.parse(readFileSync(join(ROOT, "docs", "spec", "runward-closed-values.json"), "utf8"));
const listOf = (name) => [...CLOSED.lists[name].published, ...CLOSED.lists[name].unreleased];
const own = (html) => rules.ownText(html).replace(/\s+/g, " ").trim();
const sha = (s) => createHash("sha256").update(s).digest("hex");
/** The text of a view as a reader sees it, data included: one line per list item or paragraph. */
const ENTITY = { "#39": "'", quot: '"', lt: "<", gt: ">", amp: "&" };
/** Tags are removed until none is left, then each entity is decoded once, in one pass: the result is text for an assertion, never HTML. */
const decoded = (html) => {
  let s = String(html).replace(/<\/(li|p|h[1-3])>/g, "\n");
  for (let prev = null; prev !== s;) { prev = s; s = s.replace(/<[^>]+>/g, ""); }
  return s.replace(/&(#39|quot|lt|gt|amp);/g, (_, e) => ENTITY[e]).replace(/[ \t]+/g, " ").split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
};

/** The decision portfolio of the golden inventory: four real exports, a silent mission, one received as a digest only. */
function goldenFleet(lang = "fr", extra = {}) {
  return indexFrom(manifestOf([
    { id: "demo-renamed", name: "runward-demo-renaming · a name changed in the code", repository: "github.com/stranxik/runward-demo-renaming", exports: { check: { file: "renamed.json", at: "2026-11-10" } } },
    { id: "demo-repaired", name: "runward-demo-renaming · the record follows the new name", repository: "github.com/stranxik/runward-demo-renaming", exports: { check: { file: "repaired.json", at: "2026-11-10" } } },
    { id: "hosted", name: "runward-hosted", repository: "github.com/stranxik/runward-hosted", exports: { check: { file: "hosted.json" } } },
    { id: "agent", name: "example · two rows endorsed by an agent", repository: "github.com/example/agent", exports: { check: { file: "agent.json", at: "2026-11-10" } } },
    { id: "level", name: "example · a level required and not met", repository: "github.com/example/level", exports: { check: { file: "level.json", at: "2026-11-10" } } },
    { id: "silent", name: "example · declared, nothing received", repository: "github.com/example/silent", exports: { check: { file: "missing.json" } } },
    { id: "digest", name: "example · fingerprints only", repository: "github.com/example/digest", exports: { check: { sha256: sha(fx("demo-renamed.check.json")), at: "2026-11-09" } } },
  ], { lang, ...extra }), {
    "renamed.json": fx("demo-renamed.check.json"), "repaired.json": fx("demo-repaired.check.json"), "hosted.json": fx("hosted-proposed.check.json"),
    "agent.json": fx("agent-ratified.check.json"), "level.json": fx("level-not-met.check.json"),
  });
}

// ------------------------------------------------------------------ the closed lists, read from the CLI's code
const source = (rel, text) => ts.createSourceFile(rel, text ?? readFileSync(join(ROOT, rel), "utf8"), ts.ScriptTarget.Latest, true);
/** Every string literal type under a node. */
function literalTypes(node) {
  const out = [];
  const visit = (n) => { if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal)) out.push(n.literal.text); ts.forEachChild(n, visit); };
  if (node) visit(node);
  return out;
}
const typeAlias = (sf, name) => sf.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === name)?.type;
const fn = (sf, name) => sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === name);
const member = (members, name) => members?.find((m) => m.name && ts.isIdentifier(m.name) && m.name.text === name);
/** The string a `kind:` or `scope:` initializer names: a literal, the default of `??`, or a literal `as const`. */
function literalOf(e) {
  if (!e) return null;
  if (ts.isAsExpression(e)) return literalOf(e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return literalOf(e.right);
  return null;
}
/** A `kind` the CLI reads from a value whose type is one of the unions read above (`viol.kind`, `c.kind`). */
const typedKind = (e) => e && ts.isPropertyAccessExpression(e) && e.name.text === "kind";
/**
 * The kinds and scopes a function of the CLI writes into the table of refusals, read from its code. A
 * `kind` it cannot read as a literal, a default of `??`, a typed `x.kind` or the analyzers' template is
 * reported in `unread`, never skipped: a value the extraction does not see would be a value the list misses.
 */
function writtenBy(node) {
  const kinds = [], scopes = [], templates = [], unread = [];
  const kindOf = (e) => {
    const v = literalOf(e);
    if (v !== null) kinds.push(v);
    else if (ts.isTemplateExpression(e)) templates.push(e.head.text);
    else if (!(typedKind(e) || (ts.isBinaryExpression(e) && typedKind(e.left) && literalOf(e.right) !== null))) unread.push(e.getText());
  };
  const visit = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name)) {
      if (n.name.text === "kind") kindOf(n.initializer);
      if (n.name.text === "scope") { const v = literalOf(n.initializer); if (v !== null) scopes.push(v); else if (!ts.isPropertyAccessExpression(n.initializer)) unread.push(n.initializer.getText()); }
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "whole") {
      const [scope, , , kind] = n.arguments;
      if (scope && literalOf(scope) !== null) scopes.push(literalOf(scope)); else if (scope) unread.push(scope.getText());
      if (kind) kindOf(kind);
    }
    ts.forEachChild(n, visit);
  };
  if (node) visit(node);
  return { kinds, scopes, templates, unread };
}

/** The closed values the CLI of this tree can write, read from its code. `edit` plants a change in one file. */
const parsed = new Map(); // each file of the CLI is parsed once; a planted edit parses its own copy
async function cliValues(edit = {}) {
  const sf = (rel) => {
    if (edit[rel]) return source(rel, edit[rel](readFileSync(join(ROOT, rel), "utf8")));
    if (!parsed.has(rel)) parsed.set(rel, source(rel));
    return parsed.get(rel);
  };
  const conformance = sf("src/lib/conformance.ts"), delegation = sf("src/lib/delegation.ts"), analyze = sf("src/lib/analyze.ts");
  const contract = sf("src/lib/check-contract.ts"), verdict = sf("src/lib/verdict.ts"), mission = sf("src/lib/mission.ts");
  const table = writtenBy(fn(contract, "conformanceEntries"));
  const verdictKinds = writtenBy(verdict).kinds;
  assert.deepEqual(table.templates, ["analysis-"], "the only kind built from a value is analysis-<family>");
  assert.deepEqual(table.unread, [], "every kind and scope the table writes is read as a closed value");
  const families = literalTypes(typeAlias(analyze, "AnalysisFamily"));
  const { GATED_DELIVERABLES } = await import(pathToFileURL(join(ROOT, "dist", "lib", "conformance.js")).href);
  const { PHASES } = await import(pathToFileURL(join(ROOT, "dist", "lib", "mission.js")).href);
  const row = conformance.statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === "RatificationRow");
  return {
    verdict: literalTypes(member(fn(verdict, "verdictOutcome").type.members, "verdict").type),
    deliverableState: literalTypes(typeAlias(mission, "ArtifactState")),
    deliverableCause: literalTypes(typeAlias(mission, "InProgressCause")),
    deliverable: PHASES.flatMap((p) => p.artifacts.map((a) => a.relPath)),
    phase: [...new Set([...PHASES.map((p) => p.id), ...GATED_DELIVERABLES.map((g) => g.phase)])],
    conformanceKind: [...new Set([...literalTypes(typeAlias(conformance, "ViolationKind")), ...literalTypes(typeAlias(delegation, "CharterGapKind")),
      ...families.map((f) => `analysis-${f}`), ...table.kinds, ...verdictKinds])],
    conformanceScope: [...new Set([...GATED_DELIVERABLES.map((g) => g.label), ...table.scopes])],
    ratificationState: literalTypes(member(row.members, "state").type),
    ratificationMode: literalTypes(typeAlias(conformance, "LedgerMode")),
  };
}
const differences = (code) => Object.entries(code).flatMap(([name, values]) => {
  const listed = new Set(listOf(name));
  return [...values.filter((v) => !listed.has(v)).map((v) => `${name}: the CLI writes "${v}", the list does not name it`),
    ...[...listed].filter((v) => !values.includes(v)).map((v) => `${name}: the list names "${v}", the CLI of this tree does not write it`)];
});

test("the closed lists are the values the CLI of this tree writes, read from its code; a planted value reddens", async () => {
  assert.deepEqual(differences(await cliValues()), [], "docs/spec/runward-closed-values.json and the CLI agree on every closed field");
  assert.equal(listOf("conformanceKind").length, 39);
  // The published list is the record of a survey of the 0.46.0 tarball (docs/spec/runward-closed-values.json
  // names its integrity); the suite reads no registry, so it holds the record, not the tarball.
  assert.equal(CLOSED.lists.conformanceKind.published.length, 31);
  // A kind the extraction cannot read is reported, not skipped.
  const hidden = writtenBy(fn(source("x.ts", 'function conformanceEntries(v) { const k = v.flag ? "a-kind" : "b-kind"; rows.push({ scope: "corpus", kind: k }); whole("corpus", f, "p", pick(v), "file"); }'), "conformanceEntries"));
  assert.deepEqual(hidden.unread, ["k", "pick(v)"]);
  // Planted, one per way a value enters the table: a member of a declared union, a literal of the table's
  // own scopes, a default, a family of the analyzers.
  for (const [rel, from, to, expect] of [
    ["src/lib/conformance.ts", '| "evidence-refused" | "requires-unmet";', '| "evidence-refused" | "requires-unmet" | "planted-kind";', /conformanceKind: the CLI writes "planted-kind"/],
    ["src/lib/check-contract.ts", 'whole("corpus", f, "rule not written by runward", "corpus-extra",', 'whole("corpus", f, "rule not written by runward", "planted-corpus",', /the CLI writes "planted-corpus"[\s\S]*the list names "corpus-extra"/],
    ["src/lib/check-contract.ts", 'kind: viol.kind ?? "rule-violation"', 'kind: viol.kind ?? "planted-default"', /the CLI writes "planted-default"/],
    ["src/lib/analyze.ts", '| "linkage" | "policy";', '| "linkage" | "policy" | "planted";', /the CLI writes "analysis-planted"/],
    ["src/lib/mission.ts", '"missing" | "untouched" | "in-progress" | "filled"', '"missing" | "untouched" | "in-progress" | "filled" | "planted"', /deliverableState: the CLI writes "planted"/],
  ]) {
    const planted = differences(await cliValues({ [rel]: (s) => { assert.ok(s.includes(from), `the plant applies in ${rel}`); return s.replace(from, to); } }));
    assert.match(planted.join("\n"), expect, `${rel}: ${to}`);
  }
});

/** Every closed value without its sentence, in one language of a lexicon. */
function missingSentences(lexicon, lang) {
  const L = lexicon[lang];
  const need = [
    ...[...listOf("verdict"), ...CLOSED.index.verdict].flatMap((v) => [["state", v], ["group", v], ["reason", v]]),
    ...listOf("deliverableState").map((v) => ["pieces", "state", v]),
    ...listOf("deliverableCause").map((v) => ["pieces", "cause", v]),
    ...listOf("deliverable").map((v) => ["pieces", "piece", v]),
    ...listOf("phase").map((v) => ["pieces", "nature", v]),
    ...[...listOf("conformanceKind"), ...CLOSED.index.conformanceKind].map((v) => ["kind", v]),
    ...listOf("conformanceScope").map((v) => ["scope", v]),
    // how a row was endorsed: the mode of a ratified row, or the state of any other
    ...[...listOf("ratificationMode"), ...listOf("ratificationState").filter((s) => s !== "ratified")].map((v) => ["endorsement", "mode", v]),
    ...CLOSED.index.implemented.map((v) => ["origin", v]),
  ];
  return need.filter((keys) => typeof keys.reduce((o, k) => o?.[k], L) !== "string" || !keys.reduce((o, k) => o?.[k], L).trim()).map((k) => `${lang}: ${k.join(" › ")}`);
}

test("every closed value has its sentence, in both languages; a sentence taken out reddens, and an unknown value is shown as written", () => {
  for (const lang of ["en", "fr"]) assert.deepEqual(missingSentences(views.LEXICON, lang), [], lang);
  const cut = structuredClone(views.LEXICON);
  delete cut.fr.kind["evidence-refused"];
  delete cut.en.pieces.piece["governance/threat-model.md"];
  assert.deepEqual([...missingSentences(cut, "en"), ...missingSentences(cut, "fr")], ["en: pieces › piece › governance/threat-model.md", "fr: kind › evidence-refused"]);
  assert.ok(rules.checkLexicon(cut).some((p) => /has no sentence in en/.test(p)), "and the two languages no longer hold the same keys");
  // A kind, a scope, a state of a document and a mode the lexicon does not know: shown as written, never dropped, never guessed.
  const idx = structuredClone(goldenFleet("fr"));
  const L = idx.missions.find((m) => m.id === "demo-renamed").latest;
  L.conformance[0].kind = "a-kind-from-tomorrow";
  L.conformanceByKind = [{ state: "a-kind-from-tomorrow", n: 1, N: 2, list: [`${L.conformance[0].scope} · ${L.conformance[0].rule}`] }, { ...L.conformanceByKind[0], n: 1, list: L.conformanceByKind[0].list.slice(1) }];
  L.conformance[1].file = "runward/a-document-from-tomorrow.md";
  L.conformance[1].scope = "a-scope-from-tomorrow";
  const html = views.renderView(idx, "decision", "demo-renamed");
  assert.match(html, /détail du contrôle, tel quel\u00a0: <span data-verbatim>a-kind-from-tomorrow<\/span>\./);
  assert.match(html, /Partie du dossier telle que le contrôle la nomme\u00a0: <span data-verbatim>a-scope-from-tomorrow<\/span>/);
  assert.deepEqual(rules.checkView(html, idx, "unknown"), []);
  // Built, not refused: an unknown kind holding what HTML escapes, a deliverable with no phase.
  const odd = JSON.parse(fx("demo-renamed.check.json").toString("utf8"));
  odd.conformance[0].kind = 'a&"kind]';
  odd.deliverables[0].phaseId = null;
  odd.deliverables[0].state = "untouched";
  const oi = indexFrom(manifestOf([missionWith("a")], { lang: "en" }), { "exports/a/check.json": odd });
  assert.doesNotThrow(() => pageFor(oi));
  const ot = decoded(views.renderView(oi, "decision", "a"));
  assert.match(ot, /detail of the check, as written: a&"kind\]\./);
  assert.match(ot, /Documents with no kind written/);
});

test("the specification shows the lexicon as it ships, in both languages; a sentence changed in the code and not in the specification reddens", () => {
  const spec = readFileSync(join(ROOT, "docs", "spec", "runward-fleet-decision.md"), "utf8");
  const shown = (lexicon) => [["state"], ["reason"], ["kind"], ["scope"], ["origin"], ["unknown"], ["pieces", "piece"], ["pieces", "nature"], ["pieces", "state"], ["pieces", "cause"], ["endorsement", "mode"]]
    .flatMap((path) => ["en", "fr"].flatMap((lang) => Object.values(path.reduce((o, k) => o[k], lexicon[lang]))))
    .filter((t) => !spec.includes(t.replace(/\u00a0/g, " ").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")));
  assert.deepEqual(shown(views.LEXICON), [], "docs/spec/runward-fleet-decision.md section 3 holds every sentence");
  const changed = structuredClone(views.LEXICON);
  changed.fr.kind["evidence-refused"] = "une preuve citée ne tient plus.";
  assert.deepEqual(shown(changed), ["une preuve citée ne tient plus."]);
});

// ------------------------------------------------------------------ the words
test("the lexicon holds no word runward never says, in any form, in either language; each form planted reddens, the masculine singular after an accent included", () => {
  assert.deepEqual(rules.checkLexicon(views.LEXICON), []);
  // Each form, planted in a sentence of either language (a lexicon of one key in each, so the test reads
  // each plant alone).
  const one = (en, fr) => ({ en: { reason: { gaps: en } }, fr: { reason: { gaps: fr } } });
  assert.deepEqual(rules.checkLexicon(one("The check refuses this version.", "Le contrôle refuse cette version.")), [], "control: a clean pair passes");
  for (const forms of rules.BANNED_FORMS) {
    for (const form of forms) {
      for (const lang of ["en", "fr"]) {
        const plant = `Le relevé ${form}, en clair.`;
        const problems = rules.checkLexicon(lang === "en" ? one(plant, "Rien.") : one("Nothing.", plant));
        assert.ok(problems.some((p) => p.startsWith(`lexicon.${lang}.reason.gaps: a word runward does not use about itself`)), `${lang}: "${form}" is caught`);
      }
    }
  }
  // The defect this list had: an ASCII \b saw no boundary after an accented letter, so this form passed.
  assert.ok(rules.BANNED.some((re) => re.test("un relevé certifié.")) && rules.BANNED.some((re) => re.test("certifié")));
  assert.ok(!rules.BANNED.some((re) => re.test("un certificat de signature")), "control: a word that only starts like one is not caught");
  assert.ok(!rules.BANNED.some((re) => re.test("untraced")), "control: the name of a closed value is not a word of the list");
});

test("the reading holds none of the method's words, in either language; each form planted in a sentence or a view reddens", () => {
  for (const lang of ["en", "fr"]) {
    const idx = goldenFleet(lang);
    for (const [route, arg] of views.allViews(idx).filter(([r]) => r === "decision")) assert.deepEqual(rules.checkReading(views.renderView(idx, route, arg ?? undefined), `${lang} #/${route}/${arg ?? ""}`), []);
  }
  for (const forms of rules.INTERNAL_FORMS) {
    for (const form of forms) {
      const planted = { en: { endorsement: { declared: `These ${form} are declared.` } }, fr: { endorsement: { declared: "Déclarés." } } };
      assert.ok(rules.checkLexicon(planted).some((p) => p.includes("a word of the method")), `"${form}" is caught in the lexicon`);
      assert.ok(rules.checkReading(`<p data-role="reason">The ${form} is refused.</p>`).length > 0, `"${form}" is caught in a view`);
    }
  }
  // A word of the method inside data (a mission named after its gate) is the data's.
  assert.deepEqual(rules.checkReading('<h2 data-role="name"><span data-verbatim>gate-keeper</span></h2>'), []);
});

test("no state reads as a decision taken: a planted Go reddens, in the lexicon and on the page; the title before your go / no-go passes", async () => {
  assert.equal(views.LEXICON.fr.title, "Avant votre go / no-go");
  assert.deepEqual(rules.checkLexicon(views.LEXICON), [], "the title names the reader's decision and passes");
  for (const [lang, word] of [["en", "Go"], ["fr", "Go"], ["en", "Ready to ship"], ["fr", "Bloquée"], ["fr", "Prête"], ["en", "Blocked"]]) {
    const planted = structuredClone(views.LEXICON);
    planted[lang].state.clean = word;
    assert.ok(rules.checkLexicon(planted).some((p) => /reads as a decision taken/.test(p)), `${lang}: ${word}`);
  }
  const html = views.renderView(goldenFleet("fr"), "decision");
  assert.deepEqual(rules.checkReading(html), []);
  assert.ok(rules.checkReading(html.replace('data-role="state-word">Rien ne bloque<', 'data-role="state-word">Go<')).some((p) => /"Go"/.test(p)));
});

test("nothing is blocking is never shown without the team's requirements and the date of the last check; taken out, it reddens", () => {
  // The fleet's line for its applications with nothing blocking carries the requirements too.
  for (const lang of ["fr", "en"]) assert.ok(views.LEXICON[lang].group.clean.includes(views.LEXICON[lang].qualifier.clean), lang);
  const cut = structuredClone(views.LEXICON);
  cut.en.group.clean = "Nothing is blocking";
  assert.ok(rules.checkLexicon(cut).some((p) => /group\.clean: nothing blocking is said without the team's requirements/.test(p)));
  for (const lang of ["fr", "en"]) {
    const idx = goldenFleet(lang);
    const html = views.renderView(idx, "decision", "demo-repaired");
    const q = views.LEXICON[lang].qualifier.clean;
    assert.match(own(html), new RegExp(`${views.LEXICON[lang].state.clean} ${q} ${lang === "fr" ? "Dernier contrôle reçu" : "Last check received"}`));
    assert.deepEqual(rules.checkReading(html), []);
    assert.ok(rules.checkReading(html.replace(/<p data-role="qualifier">[^<]*<\/p>/, "")).some((p) => /without the team's requirements/.test(p)));
    assert.ok(rules.checkReading(html.replace(/<p data-role="date">[\s\S]*?<\/p>/, "")).some((p) => /without the team's requirements/.test(p)));
  }
});

// ------------------------------------------------------------------ the renaming demonstration, refused (ADR-0125 fact 4)
test("the refused state of the renaming demonstration: every sentence from closed fields, the check's text shown as written and never read", () => {
  const idx = goldenFleet("fr");
  const doc = views.decide(idx);
  const app = doc.applications.find((a) => a.id === "demo-renamed");
  assert.equal(app.stateWord.text, "Refusée par le contrôle");
  assert.equal(app.stateWord.from, "missions[id=demo-renamed].latest.verdict");
  assert.deepEqual(app.problems.map((p) => p.line.text), [
    "Mesures de la première version\u00a0: une preuve citée est refusée par le contrôle.",
    "Dossier de sécurité\u00a0: une preuve citée est refusée par le contrôle.",
  ]);
  for (const p of app.problems) {
    const [subject, reason] = [p.line.args.subject.sentence, p.line.args.reason.sentence];
    assert.match(subject.from, /\.conformance\[\d\]\.file$/, "the document comes from the refusal's file, matched to the documents");
    assert.match(reason.from, /\.conformance\[\d\]\.kind$/, "the sentence comes from the refusal's kind");
  }
  const check = JSON.parse(fx("demo-renamed.check.json").toString("utf8"));
  // Shown character for character: the escaped text in the page decodes to the export's own.
  const html = views.renderView(idx, "decision", "demo-renamed");
  const shown = [...html.matchAll(/<p data-role="verbatim" lang="en">([^<]*)<\/p>/g)].map((m) => m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
  assert.deepEqual(shown, check.conformance.map((c) => c.problem));
  assert.equal(shown[0], 'typed pointer file:code/src/core/domain/guard.ts#guardFields — symbol "guardFields" not found in the file (moved or renamed? update the pointer)');
  // Never read: another wording of the same refusal changes the detail and no sentence.
  const reworded = structuredClone(idx);
  reworded.missions.find((m) => m.id === "demo-renamed").latest.conformance.forEach((c) => { c.problem = "the CLI wrote this another way"; });
  const again = views.decide(reworded).applications.find((a) => a.id === "demo-renamed");
  assert.deepEqual(again.problems.map((p) => p.line.text), app.problems.map((p) => p.line.text));
  assert.deepEqual(again.kinds.map((k) => k.line.text), app.kinds.map((k) => k.line.text));
  assert.ok(views.renderView(reworded, "decision", "demo-renamed").includes("the CLI wrote this another way"));
});

test("the line of each refusal is the export's, projected into the index and tied to it on the page; a planted line reddens", () => {
  const idx = goldenFleet("en");
  const L = idx.missions.find((m) => m.id === "demo-renamed").latest;
  assert.deepEqual(L.conformance.map((c) => [c.file, c.line, c.phaseId]), [["runward/floor.md", 22, "floor"], ["runward/governance/threat-model.md", 50, "govern"]]);
  const html = views.renderView(idx, "decision", "demo-renamed");
  assert.match(html, /data-index="missions\[id=demo-renamed\]\.latest\.conformance\[0\]\.line"[^>]*>22<\/span>/);
  assert.deepEqual(rules.checkView(html, idx, "lines"), []);
  assert.ok(rules.checkView(html.replace(/(conformance\[0\]\.line"[^>]*>)22</, "$123<"), idx, "planted").some((p) => /conformance\[0\]\.line is shown as "23"/.test(p)));
  // An export written before the field (a CLI before 0.42.3) reads null, and the page shows no line.
  const old = JSON.parse(realCheck().toString("utf8"));
  old.conformance = [{ scope: "Floor", rule: "x", problem: "y" }];
  const o = indexFrom(manifestOf([missionWith("a")]), { "exports/a/check.json": old });
  assert.deepEqual(o.missions[0].latest.conformance[0], { scope: "Floor", rule: "x", kind: null, problem: "y", file: null, line: null, phaseId: null });
});

// ------------------------------------------------------------------ how the rows were endorsed (ADR-0125 fact 5)
test("how rows were endorsed: groups n / N from the index, partitioning the decided rows; no view computes a denominator", async () => {
  const idx = goldenFleet("en");
  const r = idx.missions.find((m) => m.id === "agent").latest.ratification;
  assert.deepEqual(r.byMode.map((g) => [g.state, g.n, g.N]), [["line-by-line", 17, 46], ["en bloc", 0, 46], ["agent", 1, 46], ["agent (single accountable)", 1, 46], ["blind", 0, 46], ["changed", 0, 46], ["untraced", 27, 46]]);
  assert.equal(r.byMode.reduce((t, g) => t + g.n, 0), 46, "the groups partition the decided rows");
  for (const g of r.byMode) assert.equal(g.list.length, g.n);
  const html = views.renderView(idx, "decision", "agent");
  assert.deepEqual(rules.checkView(html, idx, "endorsement"), []);
  // A view that prints a group's count without its denominator is caught.
  const bare = html.replace(/<span class="n" data-src="agent:check" data-index="missions\[id=agent\]\.latest\.ratification\.byMode\[0\]\.N"[^>]*>46<\/span>/, "");
  assert.ok(rules.checkView(bare, idx, "planted").some((p) => /byMode\[0\] is shown without its denominator/.test(p)));
  // An export that lists no row (a CLI before ADR-0095) is said as not detailed, with the count it carries.
  const old = JSON.parse(fx("agent-ratified.check.json").toString("utf8"));
  delete old.ratification.byRow;
  const o = indexFrom(manifestOf([missionWith("a")], { lang: "fr" }), { "exports/a/check.json": old });
  assert.equal(o.missions[0].latest.ratification.byMode, "not-observed");
  assert.match(own(views.renderView(o, "decision", "a")), /Mode de validation non détaillé\./);
  // An export with no ratification at all builds, and says the same, with no number the index does not hold.
  const none = JSON.parse(fx("agent-ratified.check.json").toString("utf8"));
  delete none.ratification;
  const n0 = indexFrom(manifestOf([missionWith("a")], { lang: "en" }), { "exports/a/check.json": none });
  assert.doesNotThrow(() => pageFor(n0));
  assert.match(own(views.renderView(n0, "decision", "a")), /Endorsement mode not detailed\./);
  // A ratified row whose mode is not written is said so, never counted with the rows nobody endorsed.
  const nomode = JSON.parse(fx("agent-ratified.check.json").toString("utf8"));
  nomode.ratification.byRow.filter((x) => x.mode === "line-by-line").slice(0, 3).forEach((x) => { delete x.mode; });
  const nm = indexFrom(manifestOf([missionWith("a")], { lang: "en" }), { "exports/a/check.json": nomode }).missions[0].latest.ratification.byMode;
  assert.deepEqual(nm.filter((g) => ["untraced", "not-observed"].includes(g.state)).map((g) => [g.state, g.n]), [["untraced", 27], ["not-observed", 3]]);
});

test("a row endorsed by an agent is worded as an agent's, under the person declared, never as a person's mode; a planted one is caught", async () => {
  const idx = goldenFleet("fr");
  const html = views.renderView(idx, "decision", "agent");
  const text = own(html);
  const raw = decoded(html);
  assert.match(raw, /1 \/ 46 points validés par un agent relecteur \(review-bot, nom déclaré\), sous la responsabilité de la personne déclarée Alice$/m);
  assert.match(raw, /la même personne répond de l'agent qui les a proposés et de celui qui les a validés/);
  assert.match(text, /17 \/ 46 points validés point par point/, "the person's own rows, in a person's mode");
  // The agent's rows are in no person's group: neither line by line, nor at once.
  const check = JSON.parse(fx("agent-ratified.check.json").toString("utf8"));
  const agentRows = new Set(check.ratification.byRow.filter((x) => /^agent/.test(x.mode)).map((x) => `${x.deliverable} · ${x.rule}`));
  assert.equal(agentRows.size, 2);
  const asPerson = (index) => index.missions.find((m) => m.id === "agent").latest.ratification.byMode
    .filter((g) => ["line-by-line", "en bloc"].includes(g.state)).flatMap((g) => g.list).filter((x) => agentRows.has(x));
  assert.deepEqual(asPerson(idx), []);
  const planted = structuredClone(idx);
  const groups = planted.missions.find((m) => m.id === "agent").latest.ratification.byMode;
  const agentGroup = groups.find((g) => g.state === "agent"), lbl = groups.find((g) => g.state === "line-by-line");
  lbl.list.push(...agentGroup.list); lbl.n = lbl.list.length; agentGroup.list = []; agentGroup.n = 0;
  assert.equal(asPerson(planted).length, 1, "control: an agent's row moved into a person's mode is seen");
  // Planted in the view's own code: the agent's rows said with a person's sentence. The rule reads the
  // document: a line drawn from an agent's rows is keyed on an agent's sentence, or it is a breach.
  const agentAsPersonLine = (doc) => doc.applications.flatMap((a) => a.endorsement?.lines ?? [])
    .filter((l) => l && /\.agentRows\[\d+\]/.test(l.from ?? "") && !l.key.startsWith("/endorsement/agent"));
  assert.deepEqual(agentAsPersonLine(views.decide(idx)), []);
  const SRC = readFileSync(join(PKG, "ui", "views.js"), "utf8");
  const from = 'lines.push(sentence(lang, ["endorsement", key], { count: count(a, ap, L.src), agent: datum(a.agent, `${ap}.agent`), ...(person ? { person } : {}) }, `${ap}.state`));';
  assert.ok(SRC.includes(from), "the plant applies");
  const tmp = mkdtempSync(join(tmpdir(), "rw-fleet-r5-"));
  try {
    writeFileSync(join(tmp, "views.mjs"), SRC.replace(from, 'lines.push(sentence(lang, ["endorsement", "mode", "line-by-line"], { count: count(a, ap, L.src) }, `${ap}.state`));'));
    const plantedViews = await import(pathToFileURL(join(tmp, "views.mjs")).href);
    assert.equal(agentAsPersonLine(plantedViews.decide(idx)).length, 2, "control: the agent's rows said in a person's words are seen");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  // And the CLI's own disclosure is shown as written, beside the agent's line.
  assert.ok(html.includes("single accountable person; agent ratifications are disclosed throughput, not independent approval"));
});

test("names can be left out of an index: no declared person reaches it, the agent's line says the name is not published; a name left in a text is refused", () => {
  const idx = goldenFleet("en", { names: "omitted" });
  assert.deepEqual(idx.names, { state: "omitted", source: "fleet.json" });
  const json = JSON.stringify(idx);
  for (const name of ["Alice", "Carol Example"]) assert.ok(!json.includes(name), `${name} is not in the index`);
  const r = idx.missions.find((m) => m.id === "agent").latest.ratification;
  assert.deepEqual(r.ratifiers, []);
  assert.deepEqual(r.agents, [{ agent: "review-bot", for: null, rows: 2 }]);
  const html = views.renderView(idx, "decision", "agent");
  assert.match(decoded(html), /endorsed by a reviewing agent \(review-bot, declared name\), under the responsibility of a declared person whose name is not published here/);
  assert.match(own(views.renderView(idx, "mission", "agent")), /Names declared: not published on this page/);
  assert.doesNotThrow(() => pageFor(idx));
  // Control: without the option, the names are there.
  assert.ok(JSON.stringify(goldenFleet("en")).includes("Carol Example"));
  // A name that would still reach the page through another field stops the build, and says where.
  const leaking = JSON.parse(fx("agent-ratified.check.json").toString("utf8"));
  leaking.gateNonScope = "reviewed with Carol Example";
  assert.throws(() => indexFrom(manifestOf([missionWith("a")], { names: "omitted" }), { "exports/a/check.json": leaking }),
    (e) => e instanceof build.BuildError && /missions\[id=a\]\.latest\.gateNonScope/.test(e.message));
  // Wrapped across a line, in another mission's export: refused too.
  const wrapped = JSON.parse(fx("demo-renamed.check.json").toString("utf8"));
  wrapped.gateNonScope = "reviewed with Carol\n  Example";
  assert.throws(() => indexFrom(manifestOf([missionWith("a"), missionWith("b")], { names: "omitted" }), { "exports/a/check.json": fx("agent-ratified.check.json"), "exports/b/check.json": wrapped }),
    (e) => e instanceof build.BuildError && /missions\[id=b\]\.latest\.gateNonScope/.test(e.message));
  // An agent whose export declares no person reads so, with names omitted or not: never "not published".
  const unattributed = JSON.parse(fx("agent-ratified.check.json").toString("utf8"));
  unattributed.ratification.byRow.filter((x) => /^agent/.test(x.mode)).forEach((x) => { x.for = null; });
  unattributed.ratification.agents.forEach((x) => { x.for = "(undeclared)"; });
  for (const extra of [{}, { names: "omitted" }]) {
    const u = indexFrom(manifestOf([missionWith("a")], { lang: "en", ...extra }), { "exports/a/check.json": unattributed });
    const text = decoded(views.renderView(u, "decision", "a"));
    assert.match(text, /with no person declared as responsible/);
    assert.doesNotMatch(text, /not published/);
  }
  assert.throws(() => indexFrom(manifestOf([], { names: "hidden" })), /names must be "shown" or "omitted"/);
});

// ------------------------------------------------------------------ digests only, and what is not there
test("a mission received as digests only has its own state, in both languages, and none of the others", () => {
  for (const [lang, word] of [["fr", "Contenu non partagé"], ["en", "Content not shared"]]) {
    const idx = goldenFleet(lang);
    const m = idx.missions.find((x) => x.id === "digest");
    assert.equal(m.latest, "not-available");
    assert.deepEqual(m.findings, [{ what: "check", state: "not-available", why: "digest-only", src: "digest:check" }]);
    const src = idx.sources.find((s) => s.id === "digest:check");
    assert.deepEqual([src.path, src.bytes, src.origin, src.content, src.sha256], [null, null, "declared", "digest-only", sha(fx("demo-renamed.check.json"))]);
    const g = idx.fleet.byVerdict.find((x) => x.state === "not-available");
    assert.deepEqual([g.n, g.N, g.list], [1, 7, ["digest"]]);
    const html = views.renderView(idx, "decision", "digest");
    assert.match(html, new RegExp(`data-role="state-word">${word}<`));
    for (const other of ["clean", "gaps", "level-not-met", "not-observed"]) assert.ok(!html.includes(`data-state="${other}"`), `${lang}: ${other} is not shown for it`);
    for (const [where, view] of views.allViews(idx).map(([r, a]) => [`#/${r}/${a ?? ""}`, views.renderView(idx, r, a ?? undefined, { strict: true })])) assert.deepEqual(rules.checkView(view, idx, where), [], where);
  }
  // Refused, nothing built: a digest that is not one, a file and a digest both.
  assert.throws(() => indexFrom(manifestOf([{ ...missionWith("a"), exports: { check: { sha256: "abc" } } }])), /64 lowercase hexadecimal/);
  assert.throws(() => indexFrom(manifestOf([{ ...missionWith("a"), exports: { check: { file: "x.json", sha256: "a".repeat(64) } } }])), /never both/);
});

test("a check received whose export writes no verdict says so, never that nothing was received", () => {
  const noVerdict = JSON.parse(fx("demo-repaired.check.json").toString("utf8"));
  delete noVerdict.verdict;
  const idx = indexFrom(manifestOf([missionWith("a", { exports: { check: { file: "exports/a/check.json", at: "2026-11-10" } } })], { lang: "en" }), { "exports/a/check.json": noVerdict });
  const text = decoded(views.renderView(idx, "decision", "a"));
  assert.match(text, /Check received, no state written\nLast check received: 2026-11-10\nThe check received for this application writes no state\./);
  assert.doesNotMatch(text, /No check (received|has been received)/);
});

test("the reading shows no history of states: the index holds the last check only, and nothing of a replay reaches it", () => {
  const records = readFileSync(join(ROOT, "test", "fixtures", "fleet", "exports", "runward.records.jsonl"));
  const idx = indexFrom(manifestOf([{ ...missionWith("a"), exports: { check: { file: "c.json" }, history: { file: "r.jsonl" } } }], { lang: "fr" }), { "c.json": realCheck(), "r.jsonl": records });
  assert.equal(idx.missions[0].history.series[0].size, 40, "control: the index carries a replayed history");
  const doc = JSON.stringify(views.decide(idx));
  assert.ok(!doc.includes("history"), "the decision document reads nothing of it");
  for (const [route, arg] of [["decision", null], ["decision", "a"]]) assert.ok(!views.renderView(idx, route, arg ?? undefined).includes(".history"), `#/${route}`);
});

// ------------------------------------------------------------------ golden, and one interface
const GOLDEN = join(ROOT, "test", "fixtures", "golden", "fleet");

test("the decision readings of the real exports are golden, in both languages, and the same through the package's exports", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-fleet-decision-"));
  try {
    mkdirSync(join(dir, "node_modules"));
    symlinkSync(PKG, join(dir, "node_modules", "runward-fleet"), "junction");
    writeFileSync(join(dir, "consumer.mjs"), 'export * from "runward-fleet/views";\n');
    const hosted = await import(pathToFileURL(join(dir, "consumer.mjs")).href);
    assert.deepEqual(["decide", "renderDecision", "lexiconAt"].filter((k) => typeof hosted[k] !== "function"), [], "runward-fleet/views exports the reading");
    for (const lang of ["fr", "en"]) {
      const idx = goldenFleet(lang);
      // A hosted deployment receives index.json as bytes: from those, it renders the same reading.
      const received = JSON.parse(`${JSON.stringify(idx, null, 2)}\n`);
      const pages = views.allViews(idx).filter(([r]) => r === "decision").map(([r, a]) => [a ?? "portfolio", views.renderView(idx, r, a ?? undefined)]);
      for (const [name, html] of pages) assert.equal(hosted.renderDecision(received, name === "portfolio" ? undefined : name), html, `${lang} ${name}`);
      const doc = `${JSON.stringify(views.decide(idx), null, 2)}\n`;
      const hashes = `${pages.map(([name, html]) => `${sha(html)}  ${name}`).join("\n")}\n`;
      const [docFile, hashFile] = [join(GOLDEN, `decision.${lang}.json`), join(GOLDEN, `decision.${lang}.sha256`)];
      if (process.env.UPDATE_GOLDEN === "1") { writeFileSync(docFile, doc); writeFileSync(hashFile, hashes); }
      for (const f of [docFile, hashFile]) assert.ok(existsSync(f), `${f} is missing: run with UPDATE_GOLDEN=1 once, then read the diff`);
      assert.equal(doc, readFileSync(docFile, "utf8"), `${lang}: the reading moved: regenerate with UPDATE_GOLDEN=1 and read the diff`);
      assert.equal(hashes, readFileSync(hashFile, "utf8"), `${lang}: a page of the reading moved: regenerate with UPDATE_GOLDEN=1 and read the diff`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the page opens on the decision reading, holds its rules and lexicon before it is written, and lists them on the sources view", async () => {
  const idx = goldenFleet("fr");
  assert.equal(views.ROUTES[0], "decision");
  assert.match(views.renderNav(idx, "decision"), /^<a href="#\/decision" aria-current="page">En clair<\/a>/);
  const template = readFileSync(join(PKG, "ui", "template.html"), "utf8");
  assert.match(template, /const \[route, arg\] = bare \? \["decision"\] : h\.split\("\/"\);/, "no hash opens the reading");
  const page = pageFor(idx);
  assert.deepEqual(rules.checkPage(page), []);
  assert.match(views.renderView(idx, "sources"), /data-reading-rules/);
  // The build refuses a page whose reading breaks a rule: a lexicon with a word of the method.
  const SRC = readFileSync(join(PKG, "ui", "views.js"), "utf8");
  const from = 'lede: "Ce que le contrôle de l\'équipe dit de chaque application. La décision reste la vôtre.",';
  assert.ok(SRC.includes(from));
  const tmp = mkdtempSync(join(tmpdir(), "rw-fleet-reading-"));
  try {
    const file = join(tmp, "views.mjs");
    writeFileSync(file, SRC.replace(from, 'lede: "Ce que la porte dit de chaque mission.",'));
    const planted = await import(pathToFileURL(file).href);
    assert.throws(() => site.renderSite(idx, { template, views: SRC, api: planted, fonts: [] }), (e) => e instanceof build.BuildError && /a word of the method/.test(e.message));
    assert.doesNotThrow(() => site.renderSite(idx, { template, views: SRC, api: views, fonts: [] }), "control: the shipped reading passes");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
