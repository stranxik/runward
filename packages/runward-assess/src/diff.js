// diff.js: the evolution between records. Reads records only; pure.
//
// Two results compare only when (id, rev) are equal and the grid is the same; a change of the
// external part is shown with its date and never read as a change of the commit. A tier lost because
// a fact is not observed is a loss by observation, listed apart from a real loss.
import { cmp } from "./canon.js";
import { page, mark } from "./report-html.js";

const RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };
const W = { met: "met", "not-met": "not met", na: "n/a", "not-observed": "not observed", error: "error", indicator: "indicator" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const short = (h) => (h ? String(h).slice(0, 12) : "none");

function allCriteria(r) { return new Map([...r.internal.criteria, ...r.external.criteria].map((c) => [c.id, c])); }

export function evolution(records, grid) {
  const rows = records.map(({ label, record }) => ({
    commit: record.subject.commit, committedAt: record.subject.committedAt, digest: record.digest, external: record.external.digest,
    face: Object.fromEntries(record.face.axes.map((a) => [a.axis, a.tier])), grid: record.grid.id, internal: record.internal.digest, label,
    snapshot: record.snapshot ? { asOfDate: record.snapshot.asOfDate, concordant: record.snapshot.concordant } : null,
  }));
  const sameGrid = new Set(records.map(({ record }) => `${record.grid.id}|${record.grid.digest}`)).size === 1;
  const axisChanges = [];
  const transitions = [];
  for (let i = 1; i < records.length; i++) {
    const a = records[i - 1], b = records[i];
    const from = a.label, to = b.label;
    if (a.record.grid.id !== b.record.grid.id) { axisChanges.push({ from, kind: "not-comparable", to, why: `${a.record.grid.id} then ${b.record.grid.id}` }); continue; }
    for (const ax of b.record.face.axes) {
      const pa = a.record.face.axes.find((x) => x.axis === ax.axis);
      if (!pa || pa.tier === ax.tier) continue;
      let kind;
      if (pa.tier === "na" || ax.tier === "na") kind = "applicability";
      else if (RANK[ax.tier] > RANK[pa.tier]) kind = "gain";
      else kind = ax.blockedBy.length && ax.blockedBy.every((x) => x.state === "not-observed" || x.state === "error") ? "observation-loss" : "real-loss";
      axisChanges.push({ axis: ax.axis, blockedBy: ax.blockedBy, from, kind, tierFrom: pa.tier, tierTo: ax.tier, to });
    }
    const ca = allCriteria(a.record), cb = allCriteria(b.record);
    for (const id of [...new Set([...ca.keys(), ...cb.keys()])].sort(cmp)) {
      const x = ca.get(id), y = cb.get(id);
      if (!x || !y) { transitions.push({ from, id, kind: x ? "removed" : "added", to }); continue; }
      if (x.rev !== y.rev) { transitions.push({ from, id, kind: "not-comparable", to, why: `rev ${x.rev} then ${y.rev}` }); continue; }
      if (x.state === y.state && x.reached === y.reached) continue;
      const rx = RANK[x.reached ?? "P0"], ry = RANK[y.reached ?? "P0"];
      const blind = (st) => st === "not-observed" || st === "error";
      const kind = ry > rx || (x.state !== "met" && y.state === "met") ? "gain"
        : blind(y.state) && (ry < rx || x.state === "met") ? "observation-loss"
        : ry < rx || (x.state === "met" && y.state !== "met") ? "real-loss"
        : blind(x.state) && !blind(y.state) ? "now-observed"
        : !blind(x.state) && blind(y.state) ? "no-longer-observed" : "change";
      transitions.push({ from, id, kind, reachedFrom: x.reached, reachedTo: y.reached, stateFrom: x.state, stateTo: y.state, title: y.title, to });
    }
  }
  return { axisChanges, records: rows, sameGrid, schema: "runward-assess-evolution/1", transitions };
}

export function evolutionMarkdown(ev, grid) {
  const L = [];
  const repos = [...new Set(ev.records.map((r) => r.label))];
  L.push(`# Evolution · ${repos.join(" → ")}`, "");
  L.push(ev.sameGrid ? "Every record was produced under the same grid, byte for byte: a difference comes from the repository or from the date of a snapshot." : "**The records were not produced under the same grid**: a difference may come from the grid.", "");
  L.push("| | " + ev.records.map((r) => esc(r.label)).join(" | ") + " |", "|---|" + ev.records.map(() => "---").join("|") + "|");
  L.push("| commit | " + ev.records.map((r) => `\`${short(r.commit)}\``).join(" | ") + " |");
  L.push("| committed | " + ev.records.map((r) => r.committedAt.slice(0, 10)).join(" | ") + " |");
  L.push("| snapshot | " + ev.records.map((r) => (r.snapshot ? `${r.snapshot.asOfDate}${r.snapshot.concordant ? "" : " (not concordant)"}` : "none")).join(" | ") + " |");
  L.push("| internal part | " + ev.records.map((r) => `\`${short(r.internal)}\``).join(" | ") + " |");
  for (const a of grid.axes) L.push(`| **${a.id}** ${a.title} | ` + ev.records.map((r) => `**${r.face[a.id]}**`).join(" | ") + " |");
  L.push("", "## Axis changes", "");
  if (!ev.axisChanges.length) L.push("- none");
  const blockers = (c) => (c.blockedBy?.length ? `${c.kind === "gain" ? "; the next tier is blocked by" : ", blocked by"} ${c.blockedBy.map((b) => `${b.id} ${b.tier} ${W[b.state]}`).join(", ")}` : "");
  for (const c of ev.axisChanges) L.push(c.kind === "not-comparable" ? `- ${c.from} → ${c.to}: not comparable (${c.why})` : `- ${c.from} → ${c.to} · ${c.axis} ${c.tierFrom} → ${c.tierTo}, ${c.kind.replace(/-/g, " ")}${blockers(c)}`);
  L.push("", "## Criterion transitions", "");
  if (!ev.transitions.length) L.push("- none");
  for (const t of ev.transitions) {
    if (t.kind === "added" || t.kind === "removed" || t.kind === "not-comparable") { L.push(`- ${t.from} → ${t.to} · ${t.id} ${t.kind}${t.why ? ` (${t.why})` : ""}`); continue; }
    L.push(`- ${t.from} → ${t.to} · ${t.id} ${t.title}: ${W[t.stateFrom]} (${t.reachedFrom ?? "none"}) → ${W[t.stateTo]} (${t.reachedTo ?? "none"}), ${t.kind.replace(/-/g, " ")}`);
  }
  L.push("");
  return L.join("\n");
}

export function evolutionHtml(ev, grid) {
  const head = ev.records.map((r) => `<th>${esc(r.label)}<br><span class="rv">${esc(short(r.commit))} · ${esc(r.committedAt.slice(0, 10))}</span></th>`).join("");
  const axisRows = grid.axes.map((a) => `<tr><td><span class="rv"><b>${esc(a.id)}</b></span> ${esc(a.title)}</td>${ev.records.map((r) => `<td><span class="tier-s">${esc(r.face[a.id])}</span></td>`).join("")}</tr>`).join("\n");
  const kindMark = (k) => ({ gain: "met", "real-loss": "not-met", "observation-loss": "not-observed", "no-longer-observed": "not-observed", "now-observed": "indicator", applicability: "na", change: "indicator", "not-comparable": "error", added: "indicator", removed: "indicator" }[k] ?? "indicator");
  const changes = ev.axisChanges.length ? `<ul class="plain">${ev.axisChanges.map((c) => `<li>${mark(kindMark(c.kind), c.kind.replace(/-/g, " "))} ${esc(c.from)} → ${esc(c.to)} · ${esc(c.axis ?? "")} ${esc(c.tierFrom ?? "")} → ${esc(c.tierTo ?? "")}${c.why ? ` (${esc(c.why)})` : ""}</li>`).join("")}</ul>` : `<p class="soft">No axis changed tier.</p>`;
  const trans = ev.transitions.length ? `<div class="tw"><table class="t"><thead><tr><th>Between</th><th>Criterion</th><th>From</th><th>To</th><th>Kind</th></tr></thead><tbody>${ev.transitions.map((t) => `<tr><td>${esc(t.from)} → ${esc(t.to)}</td><td><span class="rv"><b>${esc(t.id)}</b></span> ${esc(t.title ?? "")}</td><td>${t.stateFrom ? mark(t.stateFrom, `${W[t.stateFrom]} · ${t.reachedFrom ?? "none"}`) : ""}</td><td>${t.stateTo ? mark(t.stateTo, `${W[t.stateTo]} · ${t.reachedTo ?? "none"}`) : ""}</td><td>${mark(kindMark(t.kind), t.kind.replace(/-/g, " "))}</td></tr>`).join("\n")}</tbody></table></div>` : `<p class="soft">No criterion changed.</p>`;
  const body = `<header class="top"><div class="wrap"><span class="brand">runward<span>-assess</span></span><span class="rv">evolution · ${ev.records.length} records · ${ev.sameGrid ? "same grid" : "<b>grids differ</b>"}</span></div></header>
<main class="wrap">
<h1>${esc(ev.records.map((r) => r.label).join(" → "))}</h1>
<p class="lede">${ev.sameGrid ? "Every record was produced under the same grid: a difference comes from the repository, or from the date of a snapshot." : "The records were not produced under the same grid: a difference may come from the grid."}</p>
<h2>Axis tiers</h2>
<div class="tw"><table class="t"><thead><tr><th>Axis</th>${head}</tr></thead><tbody>
${axisRows}
</tbody></table></div>
<h2>Axis changes</h2>
${changes}
<h2>Criterion transitions</h2>
${trans}
</main>`;
  return page("Assessment evolution", `Evolution of ${ev.records.length} grid records: axis tiers and criterion transitions.`, body).replace("</style>", ".tier-s{ font-weight:300; font-size:26px; letter-spacing:-.02em; }\n</style>");
}
