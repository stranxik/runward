// report-md.js: the record, in Markdown. A view: it computes nothing the record does not carry.
import { show } from "./predicates.js";
import { percentText } from "./canon.js";

const W = { met: "met", "not-met": "not met", na: "n/a", "not-observed": "not observed", error: "error", indicator: "indicator" };
const MARK = { met: "●", "not-met": "◆", na: "○", "not-observed": "◌", error: "✕", indicator: "·" };
const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
const cut = (s, n = 140) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const short = (h) => (h ? String(h).slice(0, 12) : "none");

export function valueText(v) {
  if (!v) return "";
  if ("value" in v) {
    const x = v.value;
    if (x && typeof x === "object" && Number.isInteger(x.n) && Number.isInteger(x.d)) return `${x.n}/${x.d}${x.d ? ` (${percentText(x)})` : ""}`;
    return show(x);
  }
  if (v.notObserved) return "not observed";
  if (v.error) return "error";
  return "";
}

export function criterionLine(c) {
  const tiers = Object.entries(c.tiers ?? {}).map(([t, r]) => `${t} ${MARK[r.state]}`).join(" ");
  const vals = Object.entries(c.values ?? {}).map(([k, v]) => `${k.split(".").pop()} ${valueText(v)}`).filter((s) => !s.endsWith(" ")).join(" · ");
  const open = Object.values(c.tiers ?? {}).find((r) => r.state !== "met" && r.state !== "na");
  const why = c.state === "na" ? c.na?.reason : (c.why ?? open?.why ?? []).join("; ");
  return `| ${c.id} r${c.rev} ${esc(c.title)} | ${c.class.join(" ")} | ${MARK[c.state]} ${W[c.state]} | ${c.reached ?? "none"} | ${tiers || "–"} | ${esc(cut(vals, 90))} | ${esc(cut(why, 160))} |`;
}

export function faceTable(face) {
  const rows = face.axes.map((a) => {
    const per = ["P1", "P2", "P3"].map((t) => a.perTier[t].N ? `${a.perTier[t].n}/${a.perTier[t].N}` : "–").join(" | ");
    const blocked = a.blockedBy.length ? a.blockedBy.map((b) => `${b.id} ${b.tier} ${W[b.state]}`).join(", ") : a.cappedAt ? `capped: no applicable criterion defines ${a.cappedAt}` : a.tier === "na" ? "every criterion n/a" : "";
    return `| ${a.axis} ${esc(a.title)} | **${a.tier}** | ${per} | ${a.na} | ${a.notObserved} | ${a.error} | ${esc(blocked)} |`;
  });
  return ["| Axis | Tier | P1 met | P2 met | P3 met | n/a | not observed | error | first tier blocked by |", "|---|---|---|---|---|---|---|---|---|", ...rows].join("\n");
}

export function reportMarkdown(record, grid) {
  const r = record;
  const s = r.snapshot;
  const crit = [...r.internal.criteria, ...r.external.criteria];
  const byAxis = (axis) => crit.filter((c) => c.axis === axis).sort((a, b) => (a.id < b.id ? -1 : 1));
  const L = [];
  L.push(`# ${r.subject.repo}${r.subject.label ? ` · ${r.subject.label}` : ""} · ${r.grid.id}`, "");
  L.push(`Commit \`${r.subject.commit}\` (tree \`${short(r.subject.tree)}\`), committed ${r.subject.committedAt}. Window: ${r.window.commits} first-parent commit(s), ${r.window.basis}${r.window.from ? ` from \`${short(r.window.from)}\`` : ""}.`, "");
  L.push(s ? `Snapshot of ${s.asOfDate}, ${s.concordant ? "concordant: taken while the default branch pointed at this commit" : `not concordant: taken while the default branch pointed at \`${short(s.headAtCapture)}\`, so every repository setting it read is not observed for this commit`}.` : "No snapshot: every external fact is not observed.", "");
  L.push(`Record \`${r.digest}\` · internal part \`${short(r.internal.digest)}\` · external part \`${short(r.external.digest)}\` · ${r.tool.name} ${r.tool.version} · grid \`${short(r.grid.digest)}\`.`, "");
  L.push("## The face", "");
  L.push("Each axis reads the highest tier whose every applicable criterion is met, tiers cumulative. No global score, no average, no composite percentage. n/a does not block; not observed and error block, and are counted apart from not met.", "");
  L.push(faceTable(r.face), "");
  if (r.face.regressions.length) {
    L.push(`Against the previous record (${r.face.previous?.label ?? short(r.face.previous?.commit)}):`, "");
    for (const g of r.face.regressions) L.push(`- ${g.axis} ${g.from} → ${g.to}, ${g.kind === "real" ? "a real loss" : "a loss by observation only"} (${g.blockedBy.map((b) => `${b.id} ${b.tier} ${W[b.state]}`).join(", ")})`);
    L.push("");
  } else if (r.face.previous) L.push(`No axis lost a tier against the previous record (${r.face.previous.label ?? short(r.face.previous.commit)}).`, "");
  L.push("## The profile", "");
  L.push(`Declared profiles: ${r.profile.profiles.map((p) => `${p} (${r.profile.bases[p] ?? "declared"})`).join(", ") || "none"}. A fact the commit or the snapshot does not show is marked declared; one they contradict is marked contradicted.`, "");
  L.push("| Fact | Value | Basis | Note |", "|---|---|---|---|");
  for (const [k, f] of Object.entries(r.profile.facts)) L.push(`| ${k} | ${esc(cut(show(f.value), 60))} | ${f.basis} | ${esc(cut(f.note ?? "", 100))} |`);
  if (r.profile.contradictions.length) { L.push("", "Contradictions:", ""); for (const c of r.profile.contradictions) L.push(`- ${c.fact}: declared ${esc(show(c.declared))}, observed ${esc(c.observed.join(", "))}`); }
  L.push("");
  L.push("## Criteria", "");
  L.push(`Legend: ${Object.entries(MARK).map(([k, m]) => `${m} ${W[k]}`).join(" · ")}. Internal criteria read the commit alone; the others read the snapshot too.`, "");
  for (const a of grid.axes) {
    const ax = r.face.axes.find((x) => x.axis === a.id);
    L.push(`### ${a.id} · ${a.title} · ${ax.tier}`, "");
    L.push("| Criterion | Class | State | Reached | Tiers | Values | Why |", "|---|---|---|---|---|---|---|");
    for (const c of byAxis(a.id)) L.push(criterionLine(c));
    L.push("");
  }
  L.push("## Not mechanized in runward-assess 0.1.0", "");
  if (r.notMechanized.length) {
    L.push("These criteria read at least one fact this version does not collect. It is never inferred: the tier that needs it reads not observed, and blocks.", "");
    for (const n of r.notMechanized) L.push(`- ${n.id}: ${n.facts.join(", ")} (${n.tiers.join(", ")})`);
  } else L.push("None.");
  L.push("", "## Judged annex", "", r.annex.note, "");
  for (const i of r.annex.items) L.push(`- ${i.id}: ${i.question} (${i.scale.join(" / ")}): not judged`);
  L.push("", "## Inputs", "");
  L.push(`- measure \`${short(r.measure.digest)}\`, facts \`${short(r.measure.factsDigest)}\`, by ${r.measure.tool.name} ${r.measure.tool.version} (tool \`${short(r.measure.tool.digest)}\`) on ${r.measure.environment.os}/${r.measure.environment.arch}, Node.js ${r.measure.environment.node}, network ${r.measure.environment.network}`);
  if (s) L.push(`- snapshot \`${short(s.digest)}\`, ${s.unavailable.length} external fact(s) not observed: ${s.unavailable.join(", ") || "none"}`);
  L.push(`- profile \`${short(r.profile.declaredDigest)}\` · trigger ${r.trigger} · origin ${r.origin}`, "");
  return L.join("\n");
}
