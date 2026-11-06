// score.js: the record, as a pure function of its inputs.
//
//   score({ grid, catalogue, digests, measure, snapshot, profile, previous, trigger, label }) -> record
//
// Inputs only: no file, no clock, no environment variable, no randomness, no network, no model. The
// as-of date is read in the snapshot's manifest; a date an M criterion needs is the commit's committer
// date. The record has two scored parts, each with its own digest:
//   internal: criteria that read the commit alone; valid for that commit for ever.
//   external: criteria that read the snapshot too; valid at the snapshot's date only. A repository
//             setting read today is never applied to a past commit (scope repo-now, concordance).
// The face is the vector of axis tiers, cumulative, with no global score and no average.
// The judged annex is a separate section: no tier reads it.
import { canonJSON, sha256, cmp, ratio } from "./canon.js";
import { evaluate, lookup, show } from "./predicates.js";
import { partOf, TOOL, digestOf, criterionFacts } from "./grid-model.js";

export class CoverageError extends Error {}
export class InputError extends Error {}

const TIERS = ["P1", "P2", "P3"];
const RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };

// ------------------------------------------------------------------------------------ dates
/** Seconds since 1970 of an ISO 8601 date-time with an offset, by arithmetic: no Date object. */
export function isoSeconds(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(String(s ?? ""));
  if (!m) return null;
  const [y, mo, d, h = "0", mi = "0", se = "0"] = m.slice(1, 7);
  // days from civil (H. Hinnant), exact for the proleptic Gregorian calendar
  let Y = Number(y); const M = Number(mo); const D = Number(d);
  Y -= M <= 2 ? 1 : 0;
  const era = Math.floor(Y / 400);
  const yoe = Y - era * 400;
  const doy = Math.floor((153 * (M + (M > 2 ? -3 : 9)) + 2) / 5) + D - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  const days = era * 146097 + doe - 719468;
  let off = 0;
  const z = m[7];
  if (z && z !== "Z") { const sign = z[0] === "-" ? -1 : 1; const hh = Number(z.slice(1, 3)); const mm = Number(z.slice(-2)); off = sign * (hh * 3600 + mm * 60); }
  return days * 86400 + Number(h) * 3600 + Number(mi) * 60 + Number(se) - off;
}
export const DAY = 86400;

// ------------------------------------------------------------------------------------ versions
const semver = (v) => { const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(v ?? "")); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
const lineOf = (v) => { const s = semver(v); return s ? `${s[0]}.${s[1]}` : null; };
const lineLess = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]); };

// ------------------------------------------------------------------------------------ inputs
function unobserved(reason) { return { $unobserved: reason }; }
const missing = (v) => v && typeof v === "object" && !Array.isArray(v) && ("$unobserved" in v || "$error" in v);

/** The snapshot facts this commit may read, by scope (catalogue): never a setting of another day's head. */
function snapshotFacts(snapshot, measure, catalogue) {
  const out = {};
  if (!snapshot) return { facts: out, concordant: null };
  const m = snapshot.manifest;
  if (m.subject.commit !== measure.subject.commit) throw new InputError(`the snapshot was taken for ${m.subject.commit}, the measure is of ${measure.subject.commit}`);
  if (m.grid?.id && m.grid.id !== measure.grid?.id) throw new InputError(`the snapshot is of ${m.grid.id}, the measure of ${measure.grid?.id}`);
  const concordant = m.subject.headAtCapture === measure.subject.commit;
  const sameWindow = (m.window?.from ?? null) === (measure.window?.from ?? null) && m.window?.to === measure.window?.to;
  for (const [path, value] of Object.entries(snapshot.facts)) {
    const scope = catalogue.facts[path]?.scope ?? "commit";
    if (scope === "repo-now" && !concordant) {
      out[path] = unobserved(`read when ${m.subject.defaultBranch ?? "the default branch"} pointed at ${String(m.subject.headAtCapture).slice(0, 12)}: a repository setting of ${m.asOfDate} does not describe ${measure.subject.commit.slice(0, 12)}`);
    } else if (scope === "window" && !sameWindow) {
      out[path] = unobserved("the snapshot's window is not the measure's");
    } else out[path] = value;
  }
  return { facts: out, concordant };
}

/** The declared profile, each fact with the basis that supports it. */
export function resolveProfile(profile, measure, snapshot, concordant) {
  const decl = profile?.facts ?? {};
  const ev = measure.profileEvidence ?? {};
  const xs = snapshot?.profileEvidence ?? {};
  const now = concordant === true;
  const facts = {};
  const contradictions = [];
  const set = (name, value, basis, note) => { facts[name] = { basis, note: note ?? null, value: value ?? null }; };
  const profiles = [...new Set(profile?.profiles ?? [])].filter((p) => ["L", "W", "A"].includes(p)).sort(cmp);

  // publie_paquet
  const pkg = decl.publie_paquet ?? null;
  if (pkg === null) set("publie_paquet", null, "declared", "the profile declares no published package");
  else if (xs.registry?.[pkg] === true) set("publie_paquet", pkg, "snapshot", `the registry holds ${pkg}`);
  else if (xs.registryStatus?.[pkg] === "http-404") { set("publie_paquet", pkg, "contradicted", `the registry answers 404 for ${pkg}: nothing is published under that name`); contradictions.push({ fact: "publie_paquet", declared: pkg, observed: ["registry 404"] }); }
  else if (ev.publishable?.includes?.(pkg)) set("publie_paquet", pkg, "commit", `a package.json of the commit names ${pkg} and is not private`);
  else { set("publie_paquet", pkg, "declared", `neither the commit nor the registry shows ${pkg}`); }

  const urls = Array.isArray(decl.deploie_service) ? decl.deploie_service.slice().sort(cmp) : [];
  const urlsOk = urls.length > 0 && now && urls.every((u) => xs.urls?.[u] === true);
  set("deploie_service", urls, urlsOk ? "snapshot" : "declared", urls.length ? (urlsOk ? "every URL answered" : "not every URL was fetched for this commit") : "no service declared");

  const sdks = [...(ev.modelSdks ?? [])].sort(cmp);
  const tools = [...(ev.toolSdks ?? [])].sort(cmp);
  const calls = decl.appelle_modele === true;
  if (!calls && sdks.length) { set("appelle_modele", false, "contradicted", `the commit depends on ${sdks.join(", ")}`); contradictions.push({ fact: "appelle_modele", declared: false, observed: sdks }); }
  else if (calls && sdks.length) set("appelle_modele", true, "commit", `the commit depends on ${sdks.join(", ")}`);
  else set("appelle_modele", calls, "declared", sdks.length ? null : "no model SDK among the commit's dependencies");

  const gate = decl.gate_declare ?? null;
  if (gate === null) set("gate_declare", null, "declared", "no gate declared");
  else set("gate_declare", gate, ev.gateRuns ? "commit" : "declared", ev.gateRuns ? `the commit runs runward check --strict (${ev.gateRuns})` : "the commit's scripts and workflows do not run it");

  const docs = Array.isArray(decl.docs_conformite) ? decl.docs_conformite.slice().sort(cmp) : [];
  const docsMissing = docs.filter((d) => ev.paths?.[d] !== true);
  if (docs.length && docsMissing.length) { set("docs_conformite", docs, "contradicted", `absent from the tree: ${docsMissing.join(", ")}`); contradictions.push({ fact: "docs_conformite", declared: docs, observed: docsMissing.map((d) => `${d} absent`) }); }
  else set("docs_conformite", docs, docs.length ? "commit" : "declared", docs.length ? "every document exists in the tree" : "no conformity document declared");

  const build = decl.build_cmd ?? null;
  set("build_cmd", build, build && ev.buildScript ? "commit" : "declared", build ? (ev.buildScript ? `package.json has the script ${ev.buildScript}` : null) : "no build step declared");
  const mut = decl.perimetre_mutation ?? null;
  if (mut && ev.paths?.[mut] !== true) { set("perimetre_mutation", mut, "contradicted", `${mut} is not in the tree`); contradictions.push({ fact: "perimetre_mutation", declared: mut, observed: ["absent"] }); }
  else set("perimetre_mutation", mut, mut ? "commit" : "declared", mut ? `${mut} exists` : "no mutation perimeter declared");

  set("coverage_tool_absent", decl.coverage_tool_absent === true, "declared", null);
  set("image_published", decl.image_published === true, "declared", null);
  const versions = decl.versions_published ?? (profiles.includes("L"));
  if (versions === true && xs.registryStatus?.[pkg] === "http-404") { set("versions_published", true, "contradicted", `the registry holds no version of ${pkg}`); contradictions.push({ fact: "versions_published", declared: true, observed: ["registry 404"] }); }
  else set("versions_published", versions === true, xs.registryVersions?.[pkg] > 0 ? "snapshot" : "declared", xs.registryVersions?.[pkg] > 0 ? `${xs.registryVersions[pkg]} versions in the registry` : null);
  const pub = decl.repo_public;
  if (now && typeof xs.visibility === "string") {
    const isPub = xs.visibility === "public";
    if (typeof pub === "boolean" && pub !== isPub) { set("repo_public", pub, "contradicted", `the forge says ${xs.visibility}`); contradictions.push({ fact: "repo_public", declared: pub, observed: [xs.visibility] }); }
    else set("repo_public", isPub, "snapshot", `the forge says ${xs.visibility}`);
  } else set("repo_public", pub === true, "declared", "visibility not read for this commit");

  // profiles themselves
  const bases = {};
  for (const p of ["A", "L", "W"]) {
    if (!profiles.includes(p)) continue;
    if (p === "L") bases.L = facts.publie_paquet.basis === "snapshot" || facts.publie_paquet.basis === "commit" ? facts.publie_paquet.basis : "declared";
    if (p === "W") bases.W = facts.deploie_service.basis === "snapshot" ? "snapshot" : "declared";
    if (p === "A") bases.A = sdks.length || tools.length ? "commit" : "declared";
  }
  if (!profiles.includes("A") && sdks.length) contradictions.push({ fact: "profiles", declared: profiles, observed: [`model SDK ${sdks.join(", ")} without profile A`] });

  const p = {
    "p.is_L": profiles.includes("L"), "p.is_W": profiles.includes("W"), "p.is_A": profiles.includes("A"),
    "p.publie_paquet": facts.publie_paquet.value, "p.deploie_service": facts.deploie_service.value,
    "p.appelle_modele": decl.appelle_modele === true, "p.gate_declare": facts.gate_declare.value,
    "p.docs_conformite": facts.docs_conformite.value, "p.build_cmd": facts.build_cmd.value,
    "p.perimetre_mutation": facts.perimetre_mutation.value, "p.coverage_tool_absent": facts.coverage_tool_absent.value,
    "p.image_published": facts.image_published.value, "p.versions_published": facts.versions_published.value,
    "p.repo_public": typeof pub === "boolean" ? pub : facts.repo_public.value,
  };
  return { profiles, bases, facts, contradictions, p };
}

// ------------------------------------------------------------------------------------ derived facts
function derive(f, measure, windowDates) {
  const out = {};
  const need = (...paths) => {
    for (const k of paths) {
      if (!(k in f)) return unobserved(`derived from ${k}, absent from the record`);
      if (missing(f[k])) return "$error" in f[k] ? { $error: `derived from ${k}: ${f[k].$error}` } : unobserved(`derived from ${k}: ${f[k].$unobserved}`);
    }
    return null;
  };
  const commitAt = isoSeconds(measure.subject.committedAt);
  const pub = (f["x.gou06.published"] && !missing(f["x.gou06.published"])) ? f["x.gou06.published"] : null;
  const before = pub ? pub.filter((v) => isoSeconds(v.time) !== null && isoSeconds(v.time) <= commitAt) : null;
  out["d.gou06.published_before_commit"] = need("x.gou06.published") ?? before.length;
  out["d.gou06.published_without_tag"] = need("x.gou06.published", "m.gou06.tags") ?? before.filter((v) => !f["m.gou06.tags"].includes(v.version)).length;
  out["d.gou06.published_without_changelog"] = need("x.gou06.published", "m.gou06.changelog_versions") ?? before.filter((v) => !f["m.gou06.changelog_versions"].includes(v.version)).length;
  out["d.gou06.support_consistent"] = need("m.gou06.support_policy") ?? (f["m.gou06.support_policy"] !== true ? false
    : (need("x.gou06.published", "m.gou06.support_lines") ?? (f["m.gou06.support_lines"].length > 0 && f["m.gou06.support_lines"].every((l) => pub.some((v) => lineOf(v.version) === l)))));
  out["d.gou06.backport_in_window"] = need("x.gou06.published") ?? (() => {
    if (windowDates.from === null) return unobserved("the window has no lower bound date");
    const sorted = pub.filter((v) => semver(v.version) && isoSeconds(v.time) !== null).map((v) => ({ ...v, t: isoSeconds(v.time), line: lineOf(v.version) })).sort((a, b) => a.t - b.t);
    for (const v of sorted) {
      if (v.t <= windowDates.from || v.t > windowDates.to) continue;
      const newest = sorted.filter((x) => x.t < v.t).reduce((m, x) => (m === null || lineLess(m, x.line) ? x.line : m), null);
      if (newest && lineLess(v.line, newest)) return true;
    }
    return false;
  })();
  const sumRatio = (a, b) => need(a, b) ?? ratio(f[a].n + f[b].n, f[a].d + f[b].d);
  const sumInt = (a, b) => need(a, b) ?? f[a] + f[b];
  out["d.pro01.captured"] = sumRatio("m.pro01.repo_surfaces", "x.pro01.site_surfaces");
  out["d.pro01.untagged"] = sumInt("m.pro01.untagged_repo", "x.pro01.untagged_site");
  out["d.pro03.hits"] = sumInt("m.pro03.repo_hits", "x.pro03.site_hits");
  out["d.pro03.negated"] = sumInt("m.pro03.repo_negated", "x.pro03.site_negated");
  const pf = need("m.pro02.repo", "x.pro02.site");
  if (pf) { out["d.pro02.checked"] = pf; out["d.pro02.mismatches"] = pf; }
  else {
    let checked = 0, mismatches = 0;
    const site = new Map((f["x.pro02.site"] ?? []).map((s) => [s.fact, s.values]));
    for (const r of f["m.pro02.repo"]) {
      if (r.truth === null) continue;
      for (const v of [...r.values, ...(site.get(r.fact) ?? [])]) { checked++; if (v !== r.truth) mismatches++; }
    }
    out["d.pro02.checked"] = checked;
    out["d.pro02.mismatches"] = mismatches;
  }
  return out;
}

// ------------------------------------------------------------------------------------ criteria
function evalCriterion(c, facts, catalogue, profile) {
  const part = partOf(c, catalogue);
  const base = { axis: c.axis, class: c.class.slice(), id: c.id, part, rev: c.rev, title: c.title };
  const values = Object.fromEntries((c.values ?? []).map((path) => {
    const got = lookup(facts, path, catalogue);
    return [path, got.missing ? { [got.missing === "error" ? "error" : "notObserved"]: got.reason } : { value: got.value }];
  }));
  // applicability: a profile first, then the condition
  const applicableProfiles = c.applies.profiles.filter((p) => profile.profiles.includes(p));
  if (!applicableProfiles.length) {
    return { ...base, na: { basis: profile.profiles.map((p) => `${p}:${profile.bases[p] ?? "declared"}`).sort(cmp).join(" "), reason: `applies to ${c.applies.profiles.join(", ")}; the profile declares ${profile.profiles.join(", ") || "none"}` }, reached: null, state: "na", tiers: {}, values };
  }
  if (c.applies.when) {
    const w = evaluate(c.applies.when, facts, catalogue);
    if (w.state === "not-met") return { ...base, na: { facts: w.read.map((r) => ({ fact: r.fact, value: r.value })), reason: c.applies.naReason }, reached: null, state: "na", tiers: {}, values };
    if (w.state !== "met") return { ...base, reached: null, state: w.state, tiers: {}, values, why: [`applicability: ${w.reasons.join("; ")}`] };
  }
  if (c.indicator) return { ...base, reached: null, state: "indicator", tiers: {}, values };
  const tiers = {};
  for (const t of TIERS) {
    const def = c.tiers[t];
    if (!def) continue;
    if (def.na) {
      const n = evaluate(def.na.when, facts, catalogue);
      if (n.state === "met") { tiers[t] = { reason: def.na.reason, state: "na" }; continue; }
    }
    const r = evaluate(def, facts, catalogue);
    tiers[t] = { read: r.read.map((x) => ({ fact: x.fact, ...(x.missing ? { missing: x.missing } : { value: x.value }) })), state: r.state, ...(r.reasons.length ? { why: r.reasons } : {}) };
  }
  let reached = null;
  for (const t of TIERS) {
    if (!tiers[t]) continue;
    if (tiers[t].state === "met" || tiers[t].state === "na") { if (tiers[t].state === "met") reached = t; continue; }
    break;
  }
  const firstOpen = TIERS.find((t) => tiers[t] && tiers[t].state !== "met" && tiers[t].state !== "na");
  const state = firstOpen ? tiers[firstOpen].state : "met";
  return { ...base, reached, state, tiers, values };
}

// ------------------------------------------------------------------------------------ axes
function aggregate(grid, results) {
  return grid.axes.map((axis) => {
    const mine = results.filter((r) => r.axis === axis.id);
    const applicable = mine.filter((r) => r.state !== "na" && r.state !== "indicator");
    const count = (s) => mine.filter((r) => r.state === s).length;
    const perTier = {};
    let tier = "P0", cappedAt = null, blockedBy = [];
    let open = true;
    for (const t of TIERS) {
      const pairs = applicable.filter((r) => r.tiers[t] && r.tiers[t].state !== "na");
      const n = pairs.filter((r) => r.tiers[t].state === "met").length;
      perTier[t] = { N: pairs.length, n };
      if (!open) continue;
      if (!pairs.length) { cappedAt = t; open = false; continue; }
      // A criterion that already failed a lower tier still blocks: tiers are cumulative.
      const lower = applicable.filter((r) => TIERS.slice(0, TIERS.indexOf(t)).some((u) => r.tiers[u] && r.tiers[u].state !== "met" && r.tiers[u].state !== "na"));
      const failing = pairs.filter((r) => r.tiers[t].state !== "met");
      if (!failing.length && !lower.length) { tier = t; continue; }
      blockedBy = failing.map((r) => ({ id: r.id, state: r.tiers[t].state, tier: t })).sort((a, b) => cmp(a.id, b.id));
      open = false;
    }
    const allNa = mine.length > 0 && mine.every((r) => r.state === "na" || r.state === "indicator") && mine.some((r) => r.state === "na");
    return {
      axis: axis.id,
      blockedBy,
      cappedAt: allNa ? null : cappedAt,
      error: count("error"),
      na: count("na"),
      notMet: mine.filter((r) => r.state === "not-met").map((r) => r.id),
      notObserved: count("not-observed"),
      perTier,
      tier: allNa ? "na" : tier,
      title: axis.title,
    };
  });
}

/** Axis tiers lost against a previous record, real losses apart from losses by observation. */
export function regressions(prevFace, face) {
  if (!prevFace) return [];
  const prev = new Map(prevFace.axes.map((a) => [a.axis, a]));
  const out = [];
  for (const a of face.axes) {
    const p = prev.get(a.axis);
    if (!p || p.tier === "na" || a.tier === "na") continue;
    if (RANK[a.tier] < RANK[p.tier]) {
      const observation = a.blockedBy.length > 0 && a.blockedBy.every((b) => b.state === "not-observed" || b.state === "error");
      out.push({ axis: a.axis, from: p.tier, kind: observation ? "observation" : "real", to: a.tier, blockedBy: a.blockedBy });
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------ record
/** Coverage: every criterion of the version, once, with a state, and nothing else (the witness's cover test). */
export function coverage(grid, results) {
  const got = results.map((r) => r.id);
  const want = grid.criteria.map((c) => c.id);
  const lost = want.filter((id) => !got.includes(id));
  const extra = got.filter((id) => !want.includes(id));
  if (lost.length || extra.length || new Set(got).size !== got.length) throw new CoverageError(`coverage: the record must carry each criterion of ${grid.grid} once (missing: ${lost.join(", ") || "none"}; foreign: ${extra.join(", ") || "none"})`);
  for (const r of results) if (!["met", "not-met", "na", "not-observed", "error", "indicator"].includes(r.state)) throw new CoverageError(`coverage: ${r.id} has no state`);
  return true;
}

export function score({ grid, catalogue, digests, measure, snapshot = null, profile, previous = null, trigger = "manual", label = null, origin = "collected" }) {
  if (!measure || measure.schema !== "runward-assess-measure/1") throw new InputError("not a runward-assess measure (schema runward-assess-measure/1)");
  if (measure.grid?.id !== grid.grid) throw new InputError(`the measure was taken for ${measure.grid?.id}, this grid is ${grid.grid}`);
  if (!profile || profile.schema !== "runward-assess-profile/1") throw new InputError("not a runward-assess profile (schema runward-assess-profile/1)");
  // A count an input computed with other tables or lists is another measurement: never mixed in.
  if (digests.gridData && measure.grid?.data && measure.grid.data !== digests.gridData) throw new InputError("the measure applied other grid tables or lists than this grid's: measure again");
  if (digests.gridData && snapshot?.manifest?.grid?.data && snapshot.manifest.grid.data !== digests.gridData) throw new InputError("the snapshot applied other grid tables or lists than this grid's: take it again");
  const { facts: xf, concordant } = snapshotFacts(snapshot, measure, catalogue);
  const prof = resolveProfile(profile, measure, snapshot, concordant);
  const facts = { ...measure.facts, ...xf, ...prof.p };
  const windowDates = { from: measure.window?.fromDate ? isoSeconds(measure.window.fromDate) : null, to: isoSeconds(measure.window?.toDate ?? measure.subject.committedAt) };
  Object.assign(facts, derive(facts, measure, windowDates));
  // A fact path the catalogue does not define, in the inputs, is an input from another version.
  for (const k of Object.keys(facts)) if (!catalogue.facts[k]) throw new InputError(`the inputs carry ${k}, which ${grid.grid}'s catalogue does not define`);

  // A criterion that reads a fact its version does not define cannot be evaluated: refuse, never skip.
  for (const c of grid.criteria) for (const f of criterionFacts(c)) if (!catalogue.facts[f]) throw new CoverageError(`coverage: ${c.id} reads ${f}, which ${grid.grid}'s fact catalogue does not define`);
  const results = grid.criteria.map((c) => evalCriterion(c, facts, catalogue, prof));
  coverage(grid, results);

  const strip = (r) => { const { part, ...rest } = r; return rest; };
  const internalCriteria = results.filter((r) => r.part === "internal").map(strip);
  const externalCriteria = results.filter((r) => r.part === "external").map(strip);
  const internal = { criteria: internalCriteria };
  internal.digest = digestOf({ criteria: internalCriteria });
  const external = snapshot
    ? { asOf: snapshot.manifest.asOf, asOfDate: snapshot.manifest.asOfDate, concordant, criteria: externalCriteria }
    : { asOf: null, asOfDate: null, concordant: null, criteria: externalCriteria, reason: "no snapshot: every snapshot fact is not-observed" };
  external.digest = digestOf(external);
  const face = { axes: aggregate(grid, results) };
  face.regressions = previous ? regressions(previous.face, face) : [];
  face.previous = previous ? { digest: previous.digest, commit: previous.subject?.commit ?? null, label: previous.subject?.label ?? null, comparable: previous.grid?.id === grid.grid } : null;

  // Criteria of this record whose tiers read a fact this version does not collect: never inferred.
  const notMechanized = results.filter((r) => r.state !== "na").map((r) => {
    const tiers = Object.entries(r.tiers ?? {}).filter(([, t]) => (t.read ?? []).some((x) => catalogue.facts[x.fact]?.mechanized === false)).map(([t]) => t);
    const facts = [...new Set(Object.values(r.tiers ?? {}).flatMap((t) => (t.read ?? []).map((x) => x.fact)).filter((f) => catalogue.facts[f]?.mechanized === false))].sort(cmp);
    return { facts, id: r.id, tiers };
  }).filter((x) => x.facts.length).sort((a, b) => cmp(a.id, b.id));

  const record = {
    schema: "runward-assess-record/1",
    annex: {
      items: grid.annex.items.map((i) => ({ id: i.id, judgments: [], question: i.question, scale: i.scale.slice() })),
      note: "Judged items stay apart from every tier; none was judged in this record.",
    },
    external,
    face,
    grid: { catalogue: digests.catalogue, data: digests.data, digest: digests.grid, id: grid.grid, minor: grid.minor, tablesAndLists: digests.gridData ?? null },
    internal,
    measure: { digest: sha256(canonJSON(measure)), environment: measure.environment, factsDigest: digestOf(measure.facts), tool: measure.tool },
    notMechanized,
    origin,
    profile: { bases: prof.bases, contradictions: prof.contradictions, declaredDigest: digestOf(profile), facts: prof.facts, profiles: prof.profiles },
    snapshot: snapshot ? { asOf: snapshot.manifest.asOf, asOfDate: snapshot.manifest.asOfDate, concordant, digest: snapshot.digest, headAtCapture: snapshot.manifest.subject.headAtCapture, unavailable: snapshot.manifest.unavailable ?? [] } : null,
    subject: { commit: measure.subject.commit, committedAt: measure.subject.committedAt, label, repo: measure.subject.repo, tree: measure.subject.tree },
    tool: { name: TOOL.name, version: TOOL.version },
    trigger,
    window: measure.window,
  };
  record.digest = digestOf(record);
  return record;
}

export const recordText = (record) => canonJSON(record);

/** The axis a criterion belongs to, its result, in a reader's words: shared by both reports. */
export function stateWord(s) {
  return { met: "met", "not-met": "not met", na: "n/a", "not-observed": "not observed", error: "error", indicator: "indicator" }[s] ?? s;
}
export { show };
