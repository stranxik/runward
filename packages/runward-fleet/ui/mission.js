// The mission projections of runward-fleet (ADR-0126): for each application, the six steps of the
// method and where it stands in them; the portfolio map of applications by step; one version's point,
// for a history; and the series of points over the versions a service received.
//
// One interface, two deployments (ADR-0121), as for the decision reading (ADR-0125): pure functions of
// the index, in a module that imports nothing but the views of this package, reads no clock, fetches
// nothing and calls no model, so the same code runs where an index is assembled, in the browser of a
// hosted deployment and in the tests. They read the index as it is: every field they use has been in
// runward-fleet-index/0 since its first version, or is read with the fallback named where it is used,
// so a version kept from before this module has its path and its point without being built again.
//
// What they compute, and nothing else: the groupings of each step, each n / N with the index path of
// every item it counts; the reading of each step, by the one rule `readingOf` writes; and, over the
// versions received, the first version of the last run of an equal state and position ("since when").
// A view prints the projection and computes nothing. Every sentence comes from the lexicon below, keyed
// on a closed value, or from the decision reading's lexicon for what both name (a document, its state
// and cause, a refusal's kind, an application's state), so one thing is never named two ways.
import { LEXICON as READING, decide, lexiconAt as readingAt } from "./views.js";

export const PATH_FORMAT = "runward-fleet-path/0";
export const PORTFOLIO_FORMAT = "runward-fleet-portfolio/0";
export const POINT_FORMAT = "runward-fleet-point/0";
export const SERIES_FORMAT = "runward-fleet-series/0";

/**
 * The six steps of the method, in order, each with the phases of `check --json` it holds (the `phaseId`
 * of a document or a refusal, a closed list: docs/spec/runward-closed-values.json). The CLI's phase
 * list folds `topology` under step 2, as its own `2 · Architect` groups execution-topology.md. Step 4,
 * iterate, holds no phase: the gate asks for no document there (ADR-0033), so it is never said crossed.
 */
export const STEPS = [
  { step: 1, id: "frame", phases: ["frame"] },
  { step: 2, id: "architect", phases: ["architect", "topology"] },
  { step: 3, id: "floor", phases: ["floor"] },
  { step: 4, id: "iterate", phases: [] },
  { step: 5, id: "govern", phases: ["govern"] },
  { step: 6, id: "handover", phases: ["handover"] },
];
/** For an index written before a refusal carried its `phaseId` (ADR-0125): the phase its gated scope
 *  names, as the CLI's table of gated deliverables labels it. Any other scope belongs to no step. */
export const SCOPE_PHASE = { Architect: "architect", Topology: "topology", Floor: "floor", Govern: "govern", Handover: "handover" };
/** How a step reads, a closed list (ADR-0126 decision 2). */
export const READINGS = ["crossed", "complete", "refused", "current", "ahead", "not-asked", "not-listed"];
/** Why a step whose documents are filled and where nothing is refused is not said crossed. */
export const COMPLETE_CAUSES = ["not-strict", "level-not-met", "no-state", "other"];
/** The states of an application whose check was not read: it has no step. */
const UNREAD = ["not-observed", "not-available"];
/** A version received whose point cannot be read: erased by the service (declared), or unreadable. */
export const HOLES = ["erased", "unreadable"];
const STATE_ORDER = ["clean", "gaps", "level-not-met", "no-state", "not-observed", "not-available"];

const NB = " "; // French puts a no-break space before a colon
export const MISSION_LEXICON = {
  en: {
    step: { frame: "Frame", architect: "Architect", floor: "Floor", iterate: "Iterate", govern: "Govern", handover: "Hand over" },
    number: "Step {step}",
    reading: {
      crossed: "Crossed",
      complete: "Documents complete",
      refused: "Refused at this step",
      current: "Current step",
      ahead: "Not reached yet",
      "not-asked": "Not asked by the gate",
      "not-listed": "Not listed by the check received",
    },
    why: {
      crossed: "Its documents are filled in and the check received refuses nothing at this step.",
      complete: {
        "not-strict": "Its documents are filled in, but the check received reads the documents only, not the answers: it is not said crossed.",
        "level-not-met": "Its documents are filled in and nothing is refused at this step, but the evidence does not reach the level the team requires: it is not said crossed.",
        "no-state": "Its documents are filled in and nothing is refused at this step, but the check received writes no state: it is not said crossed.",
        other: "Its documents are filled in and nothing is refused at this step, but the check received writes a state this reading does not know: it is not said crossed.",
      },
      refused: "Its documents are filled in, and the check refuses answers at this step.",
      current: "The first step whose documents are not all filled in: this is where the application stands.",
      ahead: "Its documents are not all filled in, and an earlier step is not finished either.",
      "not-asked": "The gate asks for no document at this step: it is never said crossed.",
      "not-listed": "The check received lists no document: this step cannot be read.",
    },
    path: {
      title: "The six steps",
      lede: "Where this application stands in the six steps of the method, read from its last check received.",
      position: "Where the check places it, as it writes it: {gate}",
      documents: "{count} documents filled in",
      refusals: "{count} refusals of the check at this step",
      missing: "What is missing",
      outside: "Refusals that belong to no step",
      outsideLede: "They bear on the record as a whole, not on one step.",
      outsideCount: "{count} refusals of the check outside the steps",
      unplaced: "Documents the check places outside the six steps",
      notStrict: "The check received reads the documents only, not the answers: no step is said crossed.",
      notListed: "The check received lists no document: no step can be read.",
      back: "All applications",
      received: "Over the versions received",
    },
    portfolio: {
      title: "Applications by step",
      lede: "Where each application stands in the six steps of the method, read from its last check received.",
      application: "Application",
      group: "{reading}: {count}",
      documents: "{count} documents",
      refusals: "{count} refusals",
    },
    series: {
      title: "Over the versions received",
      lede: "Each version of the inventory the service received, in the order it received them.",
      origin: "Versions received, never mixed with a replay of earlier states; each date is the receiving service's clock: declared, not verified.",
      since: "The same state and the same position since version {version}, received {at}",
      sinceNone: "Not in the last version received.",
      group: "{state}: {count}",
      state: { "no-state": "Check received, no state written", erased: "Content erased", unreadable: "Not readable" },
      erased: "Content erased: nothing of this version is read.",
      unreadable: "Nothing of this version could be read.",
      otherJudge: "Checked with another version of runward than the version before.",
      notWritten: "not written",
      chart: "Refusals of the check, version by version",
      cols: { version: "Version", received: "Received", state: "State", position: "Where the check places it", documents: "Documents missing", refusals: "Refusals", judge: "Checked with" },
    },
  },
  fr: {
    step: { frame: "Cadrer", architect: "Architecturer", floor: "Plancher", iterate: "Itérer", govern: "Gouverner", handover: "Transmettre" },
    number: "Étape {step}",
    reading: {
      crossed: "Franchie",
      complete: "Pièces complètes",
      refused: "Refusée à cette étape",
      current: "Étape en cours",
      ahead: "Pas encore atteinte",
      "not-asked": "Non demandée par la porte",
      "not-listed": "Non listée par le contrôle reçu",
    },
    why: {
      crossed: "Ses pièces sont remplies et le contrôle reçu ne refuse rien à cette étape.",
      complete: {
        "not-strict": `Ses pièces sont remplies, mais le contrôle reçu ne lit que les pièces, pas les réponses${NB}: elle n'est pas dite franchie.`,
        "level-not-met": `Ses pièces sont remplies et rien n'est refusé à cette étape, mais le niveau de preuve que l'équipe exige n'est pas atteint${NB}: elle n'est pas dite franchie.`,
        "no-state": `Ses pièces sont remplies et rien n'est refusé à cette étape, mais le contrôle reçu n'écrit pas d'état${NB}: elle n'est pas dite franchie.`,
        other: `Ses pièces sont remplies et rien n'est refusé à cette étape, mais le contrôle reçu écrit un état que cette lecture ne connaît pas${NB}: elle n'est pas dite franchie.`,
      },
      refused: "Ses pièces sont remplies, et le contrôle refuse des réponses à cette étape.",
      current: `La première étape dont les pièces ne sont pas toutes remplies${NB}: c'est là qu'en est l'application.`,
      ahead: "Ses pièces ne sont pas toutes remplies, et une étape antérieure n'est pas finie non plus.",
      "not-asked": `La porte ne demande aucune pièce à cette étape${NB}: elle n'est jamais dite franchie.`,
      "not-listed": `Le contrôle reçu ne liste aucune pièce${NB}: cette étape ne peut pas être lue.`,
    },
    path: {
      title: "Les six étapes",
      lede: "Où en est cette application dans les six étapes de la méthode, d'après son dernier contrôle reçu.",
      position: `Où le contrôle la place, tel qu'il l'écrit${NB}: {gate}`,
      documents: "{count} pièces remplies",
      refusals: "{count} refus du contrôle à cette étape",
      missing: "Ce qui manque",
      outside: "Refus qui ne relèvent d'aucune étape",
      outsideLede: "Ils portent sur le dossier entier, pas sur une étape.",
      outsideCount: "{count} refus du contrôle hors des étapes",
      unplaced: "Pièces que le contrôle place hors des six étapes",
      notStrict: `Le contrôle reçu ne lit que les pièces, pas les réponses${NB}: aucune étape n'est dite franchie.`,
      notListed: `Le contrôle reçu ne liste aucune pièce${NB}: aucune étape ne peut être lue.`,
      back: "Toutes les applications",
      received: "Au fil des versions reçues",
    },
    portfolio: {
      title: "Les applications par étape",
      lede: "Où en est chaque application dans les six étapes de la méthode, d'après son dernier contrôle reçu.",
      application: "Application",
      group: `{reading}${NB}: {count}`,
      documents: "{count} pièces",
      refusals: "{count} refus",
    },
    series: {
      title: "Au fil des versions reçues",
      lede: "Chaque version de l'inventaire que le service a reçue, dans l'ordre où il l'a reçue.",
      origin: `Des versions reçues, jamais mêlées à un rejeu d'états antérieurs ; chaque date est l'horloge du service qui reçoit${NB}: déclarée, non vérifiée.`,
      since: "Même état et même position depuis la version {version}, reçue le {at}",
      sinceNone: "Absente de la dernière version reçue.",
      group: `{state}${NB}: {count}`,
      state: { "no-state": "Contrôle reçu, sans état écrit", erased: "Contenu effacé", unreadable: "Illisible" },
      erased: `Contenu effacé${NB}: rien de cette version n'est lu.`,
      unreadable: "Rien de cette version n'a pu être lu.",
      otherJudge: "Contrôlée avec une autre version de runward que la version précédente.",
      notWritten: "non écrit",
      chart: "Refus du contrôle, version par version",
      cols: { version: "Version", received: "Reçue le", state: "État", position: "Où le contrôle la place", documents: "Pièces manquantes", refusals: "Refus", judge: "Contrôlée avec" },
    },
  },
};

// The rules of the mission projections (ADR-0126), numbered apart from ADR-0093's eighteen and from
// the decision reading's five, which hold here too where they apply (the words, "nothing is blocking").
export const MISSION_RULES = [
  { id: "M1", held: "test", en: "Every count is n / N with the list it counts, each item named by its index path; every number a view shows is its projection's value at the path it names.", fr: "Chaque compte est n / N avec la liste qu'il compte, chaque élément nommé par son chemin dans l'index ; chaque nombre qu'une vue montre est la valeur de sa projection au chemin qu'il nomme." },
  { id: "M2", held: "test", en: "A step's reading follows one written rule from closed fields of the index, the same in every deployment; the current step is the CLI's own, the first whose documents are not all filled in.", fr: "La lecture d'une étape suit une seule règle écrite, à partir de champs fermés de l'index, la même dans chaque déploiement ; l'étape en cours est celle du CLI, la première dont les pièces ne sont pas toutes remplies." },
  { id: "M3", held: "test", en: "Step 4 is never said crossed: while the check expects no document there, it reads not asked by the gate.", fr: "L'étape 4 n'est jamais dite franchie : tant que le contrôle n'y attend aucune pièce, elle se lit non demandée par la porte." },
  { id: "M4", held: "test", en: "No step is said crossed unless the check received reads the answers, refuses nothing at that step, and does not report the level the team requires as unmet.", fr: "Aucune étape n'est dite franchie si le contrôle reçu ne lit pas les réponses, refuse quelque chose à cette étape, ou dit le niveau exigé par l'équipe non atteint." },
  { id: "M5", held: "test", en: "Every closed value has its sentence in both languages, which hold the same keys; a value the lexicon does not know is shown as written; no word runward never says, and no reading names a decision taken.", fr: "Chaque valeur fermée a sa phrase dans les deux langues, qui tiennent les mêmes clés ; une valeur inconnue s'affiche telle qu'écrite ; aucun mot que runward ne dit jamais, et aucune lecture ne nomme une décision prise." },
  { id: "M6", held: "test", en: "The history holds the versions received only, never mixed with a replay, each dated by the receiving service's clock and said declared; a change of the judging version is marked; since when is computed once, in the projection, never by a view; an erased version is a hole that breaks a run.", fr: "L'historique ne tient que les versions reçues, jamais mêlées à un rejeu, chacune datée par l'horloge du service qui reçoit et dite déclarée ; un changement de la version qui juge est marqué ; depuis quand se calcule une fois, dans la projection, jamais par une vue ; une version effacée est un trou qui rompt une série." },
];

// ------------------------------------------------------------------ sentences
const ptr = (...keys) => `/${keys.map((k) => String(k).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
const unptr = (raw) => raw.replace(/~1/g, "/").replace(/~0/g, "~");

/**
 * The sentence a JSON Pointer (RFC 6901) names, in one language: under `/decision/…`, in the decision
 * reading's lexicon (ADR-0125), so a document or a refusal is named as that reading names it; else in
 * this module's.
 */
export function missionLexiconAt(lang, pointer) {
  const l = lang === "fr" ? "fr" : "en";
  const p = String(pointer);
  if (p.startsWith("/decision/")) return readingAt(l, p.slice("/decision".length));
  let cur = MISSION_LEXICON[l];
  for (const raw of p.split("/").slice(1)) cur = cur?.[unptr(raw)];
  return typeof cur === "string" ? cur : undefined;
}

/** A sentence: its pointer, the index path of the closed value it was read from, its arguments, its text. */
function sentence(lang, keys, args = {}, from = null) {
  const key = ptr(...keys);
  const template = missionLexiconAt(lang, key);
  if (template === undefined) return null;
  const text = template.replace(/\{([A-Za-z]+)\}/g, (_, k) => String(args[k]?.text ?? ""));
  return { key, text, ...(from ? { from } : {}), ...(Object.keys(args).length ? { args } : {}) };
}
const nested = (s) => ({ text: s.text, sentence: s });
const datum = (text, path) => ({ text: String(text ?? ""), path, verbatim: true });
const plain = (text) => ({ text: String(text) });
/** A sentence of the decision reading, keyed into this module's lexicon under `/decision`. */
function fromReading(s) {
  if (!s) return null;
  const args = s.args ? Object.fromEntries(Object.entries(s.args).map(([k, a]) => [k, a?.sentence ? { ...a, sentence: fromReading(a.sentence) } : a])) : null;
  return { ...s, key: `/decision${s.key}`, ...(args ? { args } : {}) };
}

/**
 * A grouping: n of N, the list it counts (each item labelled as the build labels it), the index path of
 * each item (`at`), and its own path in the projection document, which the view's numbers name.
 */
function grouping(items, N, path, src, label) {
  return { text: `${items.length} / ${N}`, n: items.length, N, list: items.map(label), at: items.map((x) => x.at), path, src };
}
const refusalLabel = (x) => `${x.c?.scope} · ${x.c?.rule}`;
const docLabel = (x) => String(x.d?.relPath);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const isLatest = (m) => typeof m?.latest === "object" && m.latest !== null;

// ------------------------------------------------------------------ the steps of one check
const STEP_OF = new Map(STEPS.flatMap((s) => s.phases.map((p) => [p, s])));

/** The phase a refusal belongs to: its `phaseId` when the index carries the field (null: none), else the
 *  phase its gated scope names (an index built before ADR-0125), else none. */
export function refusalPhase(c) {
  if (c && Object.prototype.hasOwnProperty.call(c, "phaseId")) return typeof c.phaseId === "string" ? c.phaseId : null;
  return SCOPE_PHASE[c?.scope] ?? null;
}

/**
 * How a step reads (ADR-0126 decision 2), from the closed fields of the check received: the states and
 * phases of its documents, the phases of its refusals, the verdict and whether the check was strict.
 * In order: no document listed at all, `not-listed`; no document and no refusal at this step,
 * `not-asked`; a document not filled, `current` for the first such step and `ahead` after it (the CLI's
 * own current phase, `runward status`); a refusal at this step, `refused`; else `crossed` when the check
 * read the answers and its state is one that judges them (`clean` or `gaps`), and `complete` otherwise.
 */
export function readingOf(step, isCurrent, { listed, verdict, strict }) {
  if (!listed) return "not-listed";
  if (step.docs.length === 0 && step.refusals.length === 0) return "not-asked";
  if (step.open) return isCurrent ? "current" : "ahead";
  if (step.refusals.length > 0) return "refused";
  return strict === true && (verdict === "clean" || verdict === "gaps") ? "crossed" : "complete";
}

/** Why a step with its documents filled and nothing refused is `complete`, not `crossed`. */
function completeCause(L) {
  if (L.strict !== true) return "not-strict";
  if (L.verdict === "level-not-met") return "level-not-met";
  if (typeof L.verdict !== "string" || L.verdict === "not-observed") return "no-state";
  return "other";
}

/** The documents and refusals of each step of one check, with the index path of each, and its reading. */
function place(L, b) {
  const docs = (Array.isArray(L.deliverables?.list) ? L.deliverables.list : []).map((d, i) => ({ d, at: `${b}.deliverables.list[${i}]` }));
  const refusals = (Array.isArray(L.conformance) ? L.conformance : []).map((c, i) => ({ c, at: `${b}.conformance[${i}]`, phase: refusalPhase(c) }));
  const listed = docs.length > 0;
  let current = null;
  const steps = STEPS.map((def, k) => {
    const mine = docs.filter((x) => def.phases.includes(x.d?.phaseId));
    const open = mine.some((x) => x.d?.state !== "filled");
    if (open && current === null) current = k;
    return { def, docs: mine, refusals: refusals.filter((x) => def.phases.includes(x.phase)), open };
  });
  for (const [k, s] of steps.entries()) s.reading = readingOf(s, k === current, { listed, verdict: L.verdict, strict: L.strict });
  return {
    steps, current, listed, refusals,
    outside: refusals.filter((x) => !STEP_OF.has(x.phase)),
    unplaced: docs.filter((x) => !STEP_OF.has(x.d?.phaseId)),
  };
}

/** A document's line, as the decision reading words it: "{document}: {state}[, {cause}]". */
function pieceLine(lang, d, at) {
  const piece = sentence(lang, ["decision", "pieces", "piece", d?.relPath], {}, `${at}.relPath`)
    ?? sentence(lang, ["decision", "unknown", "piece"], { value: datum(d?.artifact ?? d?.relPath, `${at}.artifact`) }, `${at}.relPath`);
  const state = sentence(lang, ["decision", "pieces", "state", d?.state], {}, `${at}.state`)
    ?? sentence(lang, ["decision", "unknown", "pieceState"], { value: datum(d?.state, `${at}.state`) }, `${at}.state`);
  const cause = d?.cause ? sentence(lang, ["decision", "pieces", "cause", d.cause], {}, `${at}.cause`)
    ?? sentence(lang, ["decision", "unknown", "cause"], { value: datum(d.cause, `${at}.cause`) }, `${at}.cause`) : null;
  return sentence(lang, ["decision", "pieces", cause ? "itemCause" : "item"], { piece: nested(piece), state: nested(state), ...(cause ? { cause: nested(cause) } : {}) }, at);
}
const pieceOf = (lang, x) => ({ relPath: x.d?.relPath ?? null, state: x.d?.state ?? null, cause: x.d?.cause ?? null, at: x.at, line: pieceLine(lang, x.d, x.at) });

/** A sentence whose `{count}` is a grouping: the grouping is held once, in the sentence, at `path.args.count`. */
function counted(lang, keys, items, N, path, src, label, extra = {}, from = null) {
  return sentence(lang, keys, { ...extra, count: grouping(items, N, `${path}.args.count`, src, label) }, from);
}

/** Refusals grouped by kind, in the order the export lists them, each n of the refusals given, with the
 *  decision reading's sentence for its kind (or the kind as written). */
function kindsOf(lang, items, path, src) {
  const by = new Map();
  for (const x of items) {
    const k = typeof x.c?.kind === "string" ? x.c.kind : "not-observed";
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(x);
  }
  return [...by.entries()].map(([kind, list], i) => {
    const from = `${list[0].at}.kind`;
    const reason = sentence(lang, ["decision", "kind", kind], {}, from) ?? sentence(lang, ["decision", "unknown", "kind"], { value: datum(kind, from) }, from);
    return { kind, line: counted(lang, ["decision", "problems", "byKind"], list, items.length, `${path}[${i}].line`, src, refusalLabel, { reason: nested(reason) }, from) };
  });
}

/** The reading of a step and why, as sentences, with the index path the reading was read from. */
function readingSentences(lang, s, L, b) {
  const from = s.reading === "refused" ? `${b}.conformance` : s.reading === "crossed" || s.reading === "complete" ? `${b}.verdict` : `${b}.deliverables.list`;
  const why = s.reading === "complete"
    ? (() => { const cause = completeCause(L); return sentence(lang, ["why", "complete", cause], {}, cause === "not-strict" ? `${b}.strict` : `${b}.verdict`); })()
    : sentence(lang, ["why", s.reading], {}, from);
  return { readingWord: sentence(lang, ["reading", s.reading], {}, from), why };
}

/** The application's own lines, read from the decision reading of the same index (ADR-0125). */
function applicationOf(m, r) {
  return {
    id: m.id, path: `missions[id=${m.id}]`, name: datum(m.name, `missions[id=${m.id}].name`), state: r.state,
    stateWord: fromReading(r.stateWord), qualifier: fromReading(r.qualifier), date: fromReading(r.date),
  };
}
const headOf = (idx, format, lang) => ({ format, lang, index: { format: idx.format ?? null, builtBy: idx.builtBy ?? null } });
const langOf = (idx) => (idx?.lang === "fr" ? "fr" : "en");

// ------------------------------------------------------------------ path
/**
 * The six steps of one application, `runward-fleet-path/0`: for each step, its name, its reading and why,
 * its documents filled n / N, what is missing (each document not filled, with its state and cause), its
 * refusals n / N and their kinds; the refusals that belong to no step; the documents the check places
 * outside the six steps; and where the check places the application, as it writes it. Null when the
 * index declares no application `id`.
 */
export function path(index, id) {
  const idx = index ?? {};
  const lang = langOf(idx);
  const at = (idx.missions ?? []).findIndex((x) => x.id === id);
  if (at === -1) return null;
  const m = idx.missions[at];
  const r = decide(idx).applications[at];
  const application = applicationOf(m, r);
  const head = { ...headOf(idx, PATH_FORMAT, lang), title: sentence(lang, ["path", "title"]), application };
  if (!isLatest(m)) return { ...head, observed: false, reason: fromReading(r.reason), position: null, note: null, current: null, steps: [], outside: null, unplaced: [] };
  const L = m.latest, b = `missions[id=${m.id}].latest`, src = L.src;
  const P = place(L, b);
  const R = P.refusals.length;
  const steps = P.steps.map((s, k) => {
    const sp = `steps[${k}]`;
    return {
      step: s.def.step, id: s.def.id, path: sp,
      number: sentence(lang, ["number"], { step: plain(s.def.step) }),
      name: sentence(lang, ["step", s.def.id]),
      reading: s.reading,
      ...readingSentences(lang, s, L, b),
      documents: s.docs.length ? counted(lang, ["path", "documents"], s.docs.filter((x) => x.d?.state === "filled"), s.docs.length, `${sp}.documents`, src, docLabel) : null,
      missing: s.docs.filter((x) => x.d?.state !== "filled").map((x) => pieceOf(lang, x)),
      refusals: s.refusals.length ? counted(lang, ["path", "refusals"], s.refusals, R, `${sp}.refusals`, src, refusalLabel) : null,
      kinds: kindsOf(lang, s.refusals, `${sp}.kinds`, src),
    };
  });
  const byNature = new Map();
  for (const x of P.unplaced) {
    const phase = typeof x.d?.phaseId === "string" && x.d.phaseId !== "" ? x.d.phaseId : null;
    if (!byNature.has(phase)) byNature.set(phase, []);
    byNature.get(phase).push(x);
  }
  return {
    ...head,
    observed: true,
    reason: null,
    position: typeof L.currentGate === "string" ? sentence(lang, ["path", "position"], { gate: datum(L.currentGate, `${b}.currentGate`) }, `${b}.currentGate`) : null,
    note: !P.listed ? sentence(lang, ["path", "notListed"], {}, `${b}.deliverables.list`) : L.strict !== true ? sentence(lang, ["path", "notStrict"], {}, `${b}.strict`) : null,
    current: P.current === null ? null : STEPS[P.current].step,
    steps,
    outside: P.outside.length ? { line: counted(lang, ["path", "outsideCount"], P.outside, R, "outside.line", src, refusalLabel), kinds: kindsOf(lang, P.outside, "outside.kinds", src) } : null,
    unplaced: [...byNature.entries()].map(([phase, items]) => ({
      phaseId: phase,
      label: phase === null ? sentence(lang, ["decision", "pieces", "natureNone"], {}, `${items[0].at}.phaseId`)
        : sentence(lang, ["decision", "unknown", "nature"], { value: datum(phase, `${items[0].at}.phaseId`) }, `${items[0].at}.phaseId`),
      items: items.map((x) => pieceOf(lang, x)),
    })),
  };
}

// ------------------------------------------------------------------ portfolio
/**
 * Applications by step, `runward-fleet-portfolio/0`: one row per application, in the inventory's order,
 * with its state (the decision reading's) and the reading of each of its six steps; and for each step,
 * the applications grouped by reading, n / N of the applications declared, so an application with no
 * check read is counted under its own state, never left out.
 */
export function portfolio(index) {
  const idx = index ?? {};
  const lang = langOf(idx);
  const reading = decide(idx);
  const s0 = idx.manifest?.src ?? "fleet.json";
  const applications = (idx.missions ?? []).map((m, a) => {
    const r = reading.applications[a];
    const app = applicationOf(m, r);
    if (!isLatest(m)) return { ...app, reason: fromReading(r.reason), cells: null };
    const L = m.latest, b = `missions[id=${m.id}].latest`;
    const P = place(L, b);
    return {
      ...app, reason: null,
      cells: P.steps.map((s, k) => {
        const cp = `applications[${a}].cells[${k}]`;
        return {
          step: s.def.step, id: s.def.id, reading: s.reading,
          readingWord: readingSentences(lang, s, L, b).readingWord,
          documents: s.docs.length ? counted(lang, ["portfolio", "documents"], s.docs.filter((x) => x.d?.state === "filled"), s.docs.length, `${cp}.documents`, L.src, docLabel) : null,
          refusals: s.refusals.length ? counted(lang, ["portfolio", "refusals"], s.refusals, P.refusals.length, `${cp}.refusals`, L.src, refusalLabel) : null,
        };
      }),
    };
  });
  const N = applications.length;
  const columns = STEPS.map((def, k) => {
    const by = new Map([...READINGS, ...UNREAD].map((x) => [x, []]));
    for (const app of applications) {
      const key = app.cells ? app.cells[k].reading : String(app.state);
      if (!by.has(key)) by.set(key, []);
      by.get(key).push({ at: app.path, id: app.id });
    }
    // The groups that hold an application, in the order of the readings, then the states of an
    // application whose check was not read: together they count every application declared.
    return {
      step: def.step, id: def.id,
      number: sentence(lang, ["number"], { step: plain(def.step) }),
      name: sentence(lang, ["step", def.id]),
      byReading: [...by.entries()].filter(([, list]) => list.length > 0).map(([state, list], i) => {
        const label = READINGS.includes(state) ? sentence(lang, ["reading", state])
          : sentence(lang, ["decision", "state", state]) ?? sentence(lang, ["decision", "unknown", "state"], { value: datum(state, `missions[id=${list[0].id}].latest`) });
        return { state, line: counted(lang, ["portfolio", "group"], list, N, `columns[${k}].byReading[${i}].line`, s0, (x) => x.id, { reading: nested(label) }) };
      }),
    };
  });
  return {
    ...headOf(idx, PORTFOLIO_FORMAT, lang),
    title: sentence(lang, ["portfolio", "title"]),
    declared: { text: String(N), value: N, path: "declared", src: s0 },
    columns,
    applications,
  };
}

// ------------------------------------------------------------------ point and series
/**
 * One version's point, `runward-fleet-point/0`: what a history needs of an index, compact, and a pure
 * function of it, so a service writes it once, when it publishes the version, and computes it again
 * from the same bytes when a version has none. For each application: its state (the index's verdict;
 * `no-state` for a check received that writes none), the runward version that judged, the commit the
 * inventory declares, where the check places it (as written), its exit code, the CLI's own counts of
 * documents missing and refusals, the digest of the check read, and the reading of its six steps.
 */
export function point(index) {
  const idx = index ?? {};
  const digest = new Map((idx.sources ?? []).map((s) => [s.id, s.sha256 ?? null]));
  return {
    format: POINT_FORMAT,
    lang: langOf(idx),
    index: { format: idx.format ?? null, builtBy: idx.builtBy ?? null },
    asOf: idx.asOf?.label ?? null,
    missions: (idx.missions ?? []).map((m) => {
      const L = isLatest(m) ? m.latest : null;
      const srcId = L ? L.src : m.latest === "not-available" ? [`${m.id}:check`, `${m.id}:attestation`].find((x) => digest.has(x)) ?? null : null;
      const state = L ? (typeof L.verdict === "string" && L.verdict !== "not-observed" ? L.verdict : "no-state") : typeof m.latest === "string" ? m.latest : "not-observed";
      return {
        id: m.id,
        name: typeof m.name === "string" ? m.name : null,
        state,
        runward: typeof L?.runward === "string" ? L.runward : null,
        commit: typeof m.commit?.value === "string" ? m.commit.value : null,
        gate: typeof L?.currentGate === "string" ? L.currentGate : null,
        exitCode: num(L?.exitCode),
        gaps: L ? { deliverables: num(L.gaps?.deliverables), conformance: num(L.gaps?.conformance) } : null,
        check: srcId ? digest.get(srcId) ?? null : null,
        steps: L ? place(L, `missions[id=${m.id}].latest`).steps.map((s) => s.reading) : null,
      };
    }),
  };
}

/**
 * The series of points over the versions a service received, `runward-fleet-series/0`. `entries` is
 * `[{ version, seq, at, point }]`, `at` being the date the service received the version (its clock,
 * declared), or `{ version, seq, at, erased: true }` for a version whose content was erased. They are
 * read in the order of `seq` when every entry carries one, else as given. One series per application,
 * those of the last version received first, in its order: each point received (an erased or unreadable
 * version is a hole in every series), the runward versions that judged them (a change from one point to
 * the next is marked), the points grouped by state, and since when the last state and position hold:
 * the first point of the last run of points with an equal state and an equal position, a hole or a
 * version without the application breaking the run. Labelled `received`: never mixed with a replay.
 */
export function series(entries) {
  const given = (Array.isArray(entries) ? entries : []).map((e, i) => ({ e: e ?? {}, i }));
  const ordered = given.length && given.every(({ e }) => typeof e.seq === "number" && Number.isFinite(e.seq)) ? [...given].sort((x, y) => x.e.seq - y.e.seq || x.i - y.i) : given;
  const rows = ordered.map(({ e }) => {
    const hole = e.erased === true ? "erased" : e.point && typeof e.point === "object" && Array.isArray(e.point.missions) ? null : "unreadable";
    // An application is read by its id: an entry of a point without one is not an application's.
    const point = hole ? null : { ...e.point, missions: e.point.missions.filter((m) => m && typeof m.id === "string") };
    return { version: e.version ?? null, seq: typeof e.seq === "number" ? e.seq : null, at: typeof e.at === "string" ? e.at : null, hole, point };
  });
  const read = rows.filter((x) => !x.hole);
  const last = read.at(-1)?.point;
  const ids = [];
  for (const m of last?.missions ?? []) if (!ids.includes(m.id)) ids.push(m.id);
  for (const x of read) for (const m of x.point.missions) if (!ids.includes(m.id)) ids.push(m.id);
  const lang = last?.lang === "fr" ? "fr" : "en";
  return {
    format: SERIES_FORMAT,
    lang,
    origin: "received",
    size: rows.length,
    series: ids.map((id, k) => {
      const points = [];
      const judgedBy = [];
      let name = null, previous = null, run = null, runOpen = false;
      for (const x of rows) {
        const m = x.hole ? null : x.point.missions.find((y) => y.id === id) ?? null;
        if (x.hole) { points.push({ version: x.version, seq: x.seq, at: x.at, state: x.hole, hole: true }); runOpen = false; continue; }
        if (!m) { runOpen = false; continue; }
        name = m.name ?? name;
        if (m.runward !== null && m.runward !== undefined && !judgedBy.includes(m.runward)) judgedBy.push(m.runward);
        const p = {
          version: x.version, seq: x.seq, at: x.at, state: m.state, runward: m.runward ?? null, commit: m.commit ?? null, gate: m.gate ?? null,
          gaps: m.gaps ?? null, steps: m.steps ?? null, check: m.check ?? null,
          judgeChanged: previous !== null && (previous.runward ?? null) !== (m.runward ?? null),
        };
        if (!runOpen || run.state !== p.state || run.gate !== p.gate) run = { version: p.version, seq: p.seq, at: p.at, state: p.state, gate: p.gate };
        runOpen = true;
        points.push(p);
        previous = p;
      }
      // "Since when" speaks of the last version received: an application absent from it, or a last version
      // that is a hole, has none.
      const lastRow = rows.at(-1);
      const holdsLast = lastRow && !lastRow.hole && lastRow.point.missions.some((y) => y.id === id);
      const since = holdsLast && runOpen ? run : null;
      const sp = `series[${k}]`;
      for (const [j, p] of points.entries()) p.stateWord = stateWord(lang, p.state, `${sp}.points[${j}].state`);
      // The states that hold a point, in the order of the states, then the holes, then any other value.
      const by = new Map([...STATE_ORDER, ...HOLES].map((x) => [x, []]));
      for (const [j, p] of points.entries()) {
        if (!by.has(p.state)) by.set(p.state, []);
        by.get(p.state).push({ at: `${sp}.points[${j}]`, version: p.version });
      }
      return {
        id, name, judgedBy, points, since,
        sinceLine: since ? sentence(lang, ["series", "since"], { version: datum(since.version, `${sp}.since.version`), at: datum(since.at ?? "", `${sp}.since.at`) }, `${sp}.since`) : sentence(lang, ["series", "sinceNone"]),
        byState: [...by.entries()].filter(([, list]) => list.length > 0).map(([state, list], i) => ({
          state,
          line: counted(lang, ["series", "group"], list, points.length, `${sp}.byState[${i}].line`, "received", (x) => String(x.version), { state: nested(stateWord(lang, state, `${sp}.byState[${i}].state`)) }),
        })),
      };
    }),
  };
}

/** The word of a point's state: the decision reading's group label (so "nothing is blocking" carries the
 *  team's requirements), the series' own for a hole or a check that writes no state, or the value as written. */
function stateWord(lang, state, from) {
  if (HOLES.includes(state) || state === "no-state") return sentence(lang, ["series", "state", state], {}, from);
  return sentence(lang, ["decision", "group", state], {}, from) ?? sentence(lang, ["decision", "unknown", "state"], { value: datum(state, from) }, from);
}

// ------------------------------------------------------------------ views
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const verb = (s) => `<span data-verbatim>${esc(s)}</span>`;
/** A number, with its source and its path in the projection document the view renders. */
function numberSpan(v, src, path, lang) {
  if (v === null || v === undefined) return `<span class="n na" data-src="${esc(src)}" data-index="${esc(path)}" title="${esc(src)}">${esc(missionLexiconAt(lang, "/series/notWritten"))}</span>`;
  return `<span class="n" data-src="${esc(src)}" data-index="${esc(path)}" title="${esc(src)}">${esc(v)}</span>`;
}
/** A count is never alone: n / N, both from the projection, the list it counts one hover away. */
const frac = (g) => `<span class="frac" data-index="${esc(g.path)}" title="${esc((g.list ?? []).join(" · "))}">${numberSpan(g.n, g.src, `${g.path}.n`)} / ${numberSpan(g.N, g.src, `${g.path}.N`)}</span>`;
function say(lang, s) {
  if (!s) return "";
  const template = missionLexiconAt(lang, s.key) ?? "";
  let html = "", at = 0;
  for (const m of template.matchAll(/\{([A-Za-z]+)\}/g)) {
    html += esc(template.slice(at, m.index)) + arg(lang, s.args?.[m[1]]);
    at = m.index + m[0].length;
  }
  return html + esc(template.slice(at));
}
function arg(lang, a) {
  if (!a) return "";
  if (a.sentence) return say(lang, a.sentence);
  if (a.N !== undefined) return frac(a);
  if (a.verbatim) return verb(a.text);
  return esc(a.text);
}
const p = (role, inner, attrs = "") => `<p data-role="${role}"${attrs}>${inner}</p>`;
const mark = '<span data-role="mark" aria-hidden="true"></span>';

/** The state of an application, as the decision reading shows it: its word, then, after "nothing is
 *  blocking", the team's requirements and the date of the last check received (ADR-0125 R4). */
function stateBlock(lang, app) {
  return `<p data-role="state" data-state="${esc(app.state)}">${mark}<span data-role="state-word">${say(lang, app.stateWord)}</span></p>${app.qualifier ? p("qualifier", say(lang, app.qualifier)) : ""}${app.date ? p("date", say(lang, app.date)) : ""}`;
}
const readingLine = (lang, s) => `<p data-role="reading" data-reading="${esc(s.reading)}">${mark}<span data-role="reading-word">${say(lang, s.readingWord)}</span></p>`;
const kindsList = (lang, kinds) => (kinds.length ? `<ul data-role="kinds">${kinds.map((x) => `<li data-role="kind" data-kind="${esc(x.kind)}">${say(lang, x.line)}</li>`).join("")}</ul>` : "");
const piecesList = (lang, items) => (items.length ? `<ul data-role="missing">${items.map((x) => `<li data-role="piece" data-state="${esc(x.state)}">${say(lang, x.line)}</li>`).join("")}</ul>` : "");

function stepView(lang, s, current) {
  const X = MISSION_LEXICON[lang];
  const counts = [s.documents ? `<li data-role="documents">${say(lang, s.documents)}</li>` : "", s.refusals ? `<li data-role="refusals">${say(lang, s.refusals)}</li>` : ""].join("");
  return `<li data-role="step" data-step="${esc(s.step)}" data-reading="${esc(s.reading)}"${s.step === current ? ' aria-current="step"' : ""}>
      <h2 data-role="step-name"><span data-role="step-number">${say(lang, s.number)}</span> <span data-role="step-word">${say(lang, s.name)}</span></h2>
      ${readingLine(lang, s)}
      ${p("why", say(lang, s.why))}
      ${counts ? `<ul data-role="counts">${counts}</ul>` : ""}
      ${s.missing.length ? `<h3 data-role="missing-title">${esc(X.path.missing)}</h3>${piecesList(lang, s.missing)}` : ""}
      ${kindsList(lang, s.kinds)}
    </li>`;
}

/**
 * The HTML of one application's six steps, or of the portfolio when the index declares no application
 * `id`. Each element carries a role (`data-role`), never a look; a number's `data-index` is its path in
 * the projection document (`runward-fleet-path/0`), whose groupings name the index path of each item.
 */
export function renderPath(index, id) {
  const doc = path(index, id);
  if (!doc) return renderPortfolio(index);
  const lang = doc.lang, X = MISSION_LEXICON[lang], R = READING[lang], a = doc.application;
  const links = `<p data-role="links"><a href="#/decision/${esc(a.id)}">${esc(R.read)}</a> · <a href="#/received/${esc(a.id)}">${esc(X.path.received)}</a> · <a href="#/mission/${esc(a.id)}">${esc(R.technical)}</a></p>`;
  const top = `<section data-projection="${PATH_FORMAT}" data-view="path" data-mission="${esc(a.id)}">
    <p data-role="back"><a href="#/steps">${esc(X.path.back)}</a></p>
    <h1 data-role="name">${verb(a.name.text)}</h1>
    ${stateBlock(lang, a)}`;
  if (!doc.observed) return `${top}
    ${doc.reason ? p("reason", say(lang, doc.reason)) : ""}
    ${links}
  </section>`;
  const outside = doc.outside ? `<section data-role="outside"><h2>${esc(X.path.outside)}</h2>${p("lede", esc(X.path.outsideLede))}${p("outside-count", say(lang, doc.outside.line))}${kindsList(lang, doc.outside.kinds)}</section>` : "";
  const unplaced = doc.unplaced.length ? `<section data-role="unplaced"><h2>${esc(X.path.unplaced)}</h2>${doc.unplaced.map((g) => `<div data-role="nature"><h3>${say(lang, g.label)}</h3>${piecesList(lang, g.items)}</div>`).join("")}</section>` : "";
  return `${top}
    <h2 data-role="title">${say(lang, doc.title)}</h2>
    ${p("lede", esc(X.path.lede))}
    ${doc.position ? p("position", say(lang, doc.position)) : ""}
    ${doc.note ? p("note", say(lang, doc.note)) : ""}
    <ol data-role="steps">${doc.steps.map((s) => stepView(lang, s, doc.current)).join("")}</ol>
    ${outside}${unplaced}
    ${links}
  </section>`;
}

/** The HTML of the portfolio map: a table of applications by step, each cell a reading with its word and
 *  shape, each column's groupings n / N above it. Numbers name their path in `runward-fleet-portfolio/0`. */
export function renderPortfolio(index) {
  const doc = portfolio(index);
  const lang = doc.lang, X = MISSION_LEXICON[lang], R = READING[lang];
  const headers = doc.columns.map((c) => `<th scope="col" data-step="${esc(c.step)}"><span data-role="step-number">${say(lang, c.number)}</span> <span data-role="step-word">${say(lang, c.name)}</span>
        <ul data-role="column">${c.byReading.map((g) => `<li data-role="group" data-reading="${esc(g.state)}">${say(lang, g.line)}</li>`).join("")}</ul></th>`).join("");
  const rows = doc.applications.map((a) => {
    const name = `<th scope="row" data-role="application"><a href="#/steps/${esc(a.id)}">${verb(a.name.text)}</a>${stateBlock(lang, a)}</th>`;
    if (!a.cells) return `<tr data-mission="${esc(a.id)}" data-state="${esc(a.state)}">${name}<td colspan="${doc.columns.length}" data-role="unread">${a.reason ? say(lang, a.reason) : ""}</td></tr>`;
    const cells = a.cells.map((c) => `<td data-step="${esc(c.step)}" data-reading="${esc(c.reading)}">${mark}<span data-role="reading-word">${say(lang, c.readingWord)}</span>${c.documents ? p("documents", say(lang, c.documents)) : ""}${c.refusals ? p("refusals", say(lang, c.refusals)) : ""}</td>`).join("");
    return `<tr data-mission="${esc(a.id)}" data-state="${esc(a.state)}">${name}${cells}</tr>`;
  }).join("");
  return `<section data-projection="${PORTFOLIO_FORMAT}" data-view="portfolio">
    <h1 data-role="title">${say(lang, doc.title)}</h1>
    ${p("lede", esc(X.portfolio.lede))}
    ${p("note", esc(R.order))}
    <div data-role="map-wrap"><table data-role="map"><thead><tr><th scope="col" data-role="corner">${esc(X.portfolio.application)}</th>${headers}</tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function chart(S, k, lang) {
  const w = 600, h = 64, pts = S.points;
  if (pts.length === 0) return "";
  const max = Math.max(1, ...pts.map((x) => x.gaps?.conformance ?? 0));
  const bw = w / pts.length;
  const bars = pts.map((x, j) => {
    const v = x.hole ? 0 : x.gaps?.conformance ?? 0;
    const bh = x.hole ? 0 : v === 0 ? 2 : Math.max(3, (v / max) * (h - 18));
    const cx = j * bw + bw / 2;
    const shape = x.hole ? `<line x1="${cx.toFixed(1)}" y1="${h - 14}" x2="${cx.toFixed(1)}" y2="${h - 2}" stroke="currentColor" stroke-dasharray="2 2"/>`
      : x.state === "clean" ? `<circle cx="${cx.toFixed(1)}" cy="${h - 6}" r="3" fill="currentColor"/>`
        : `<rect x="${(cx - 3).toFixed(1)}" y="${h - 9}" width="6" height="6" fill="currentColor" transform="rotate(45 ${cx.toFixed(1)} ${h - 6})"/>`;
    return `<g data-point="${j}"><rect x="${(j * bw + 1).toFixed(1)}" y="${(h - 14 - bh).toFixed(1)}" width="${Math.max(1, bw - 3).toFixed(1)}" height="${bh.toFixed(1)}" fill="currentColor" opacity="${v === 0 ? 0.3 : 0.9}"><title>${esc(x.version)} · ${esc(x.at ?? "")} · ${esc(x.state)}</title></rect>${shape}</g>`;
  }).join("");
  return `<svg data-role="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(missionLexiconAt(lang, "/series/chart"))}" data-series="${k}">${bars}</svg>`;
}

/**
 * The HTML of `series(entries)`: for each application, or for `id` alone, since when its
 * state and position hold, its points grouped by state, a chart of the refusals, and the table of the
 * versions received. Numbers name their path in `runward-fleet-series/0`.
 */
export function renderSeries(doc, id) {
  const S0 = doc ?? { lang: "en", series: [] };
  const lang = S0.lang === "fr" ? "fr" : "en", X = MISSION_LEXICON[lang];
  const C = X.series.cols;
  const one = (S, k) => {
    const rows = S.points.map((x, j) => {
      const pp = `series[${k}].points[${j}]`;
      if (x.hole) return `<tr data-state="${esc(x.state)}"><td>${verb(x.version)}</td><td>${verb(x.at ?? "")}</td><td colspan="5" data-role="hole">${esc(missionLexiconAt(lang, `/series/${x.state}`))}</td></tr>`;
      const stateCell = `<span data-role="state-word">${say(lang, x.stateWord)}</span>`;
      const judge = `${x.runward === null ? "" : verb(x.runward)}${x.judgeChanged ? ` <span data-marker="other-judge" title="${esc(X.series.otherJudge)}">⧉</span>` : ""}`;
      return `<tr data-state="${esc(x.state)}"${x.judgeChanged ? ' data-marker="other-judge"' : ""}><td>${verb(x.version)}</td><td>${verb(x.at ?? "")}</td><td>${stateCell}</td><td>${x.gate === null ? "" : verb(x.gate)}</td><td>${x.gaps ? numberSpan(x.gaps.deliverables, "received", `${pp}.gaps.deliverables`, lang) : ""}</td><td>${x.gaps ? numberSpan(x.gaps.conformance, "received", `${pp}.gaps.conformance`, lang) : ""}</td><td>${judge}</td></tr>`;
    }).join("");
    return `<section data-role="series" data-mission="${esc(S.id)}">
      <h2 data-role="name">${verb(S.name ?? S.id)}</h2>
      ${p("since", say(lang, S.sinceLine))}
      <ul data-role="groups">${S.byState.map((g) => `<li data-role="group" data-state="${esc(g.state)}">${say(lang, g.line)}</li>`).join("")}</ul>
      ${chart(S, k, lang)}
      <div data-role="table-wrap"><table data-role="points"><thead><tr><th scope="col">${esc(C.version)}</th><th scope="col">${esc(C.received)}</th><th scope="col">${esc(C.state)}</th><th scope="col">${esc(C.position)}</th><th scope="col">${esc(C.documents)}</th><th scope="col">${esc(C.refusals)}</th><th scope="col">${esc(C.judge)}</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>`;
  };
  const shown = S0.series.map((S, k) => [S, k]).filter(([S]) => id === undefined || id === null || id === "" || S.id === id);
  return `<section data-projection="${SERIES_FORMAT}" data-view="series" data-origin="${esc(S0.origin ?? "received")}">
    <h1 data-role="title">${esc(X.series.title)}</h1>
    ${p("lede", esc(X.series.lede))}
    ${p("origin", esc(X.series.origin))}
    ${shown.map(([S, k]) => one(S, k)).join("")}
  </section>`;
}
