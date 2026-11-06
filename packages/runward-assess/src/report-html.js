// report-html.js: the record as one self-contained page in the identity of the other packages,
// "archive minérale": basalt and lime, pale stone, sage mist, soft ink; gold once per page, on the
// proof (the record's digest); Inter for text, Departure Mono only for the mono survey marks; a
// subtle grain. States read by shape and word, never by colour alone. No script, no network, no
// font fetched: the page is a pure function of the record, byte for byte.
import { show } from "./predicates.js";
import { valueText } from "./report-md.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const W = { met: "met", "not-met": "not met", na: "n/a", "not-observed": "not observed", error: "error", indicator: "indicator" };
const SHAPE = { met: "full", "not-met": "inv", na: "void", "not-observed": "half", error: "cross", indicator: "dot" };
const short = (h) => (h ? String(h).slice(0, 12) : "none");
const cut = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

export function mark(state, label) {
  const shape = SHAPE[state] ?? "half";
  const word = esc(label ?? W[state] ?? state);
  if (shape === "inv") return `<span class="st chip-inv"><span class="mk mk-full" aria-hidden="true"></span>${word}</span>`;
  return `<span class="st"><span class="mk mk-${shape}" aria-hidden="true"></span>${word}</span>`;
}

export const CSS = `
:root{
  --basalte:#191715; --chaux:#E9E4DB; --pierre:#E1DCD2; --sauge:#C9D2C6; --encre:#2A2622; --or:#C9A45C; --term:#131110;
  --bg:var(--chaux); --fg:var(--basalte); --panel:var(--pierre); --mist:var(--sauge);
  --soft:rgb(25 23 21 / .66); --hair:rgb(25 23 21 / .16); --hair2:rgb(25 23 21 / .30);
  --font:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:"Departure Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --code:ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --gut:16px; --max:1180px;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){ --bg:var(--basalte); --fg:var(--chaux); --panel:var(--encre); --mist:rgb(201 210 198 / .16);
    --soft:rgb(233 228 219 / .66); --hair:rgb(233 228 219 / .14); --hair2:rgb(233 228 219 / .30); }
}
:root[data-theme="dark"]{ --bg:var(--basalte); --fg:var(--chaux); --panel:var(--encre); --mist:rgb(201 210 198 / .16);
  --soft:rgb(233 228 219 / .66); --hair:rgb(233 228 219 / .14); --hair2:rgb(233 228 219 / .30); }
@media (min-width: 760px){ :root{ --gut:32px; } }
*{ box-sizing:border-box; }
html{ -webkit-text-size-adjust:100%; }
body{ margin:0; background:var(--bg); color:var(--fg); font-family:var(--font); font-size:16px; line-height:1.5; -webkit-font-smoothing:antialiased; overflow-x:hidden; }
body::after{ content:""; position:fixed; inset:0; pointer-events:none; z-index:90; opacity:.06;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0 0.08  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>"); }
a{ color:inherit; text-decoration-thickness:1px; text-underline-offset:3px; }
.wrap{ max-width:var(--max); margin:0 auto; padding:0 var(--gut); }
.rv{ font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--soft); }
.rv b{ color:var(--fg); font-weight:400; text-transform:none; }
header.top{ border-bottom:1px solid var(--hair); }
.top .wrap{ display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 18px; padding-top:18px; padding-bottom:12px; }
.brand{ font-weight:600; letter-spacing:-.01em; font-size:17px; }
.brand span{ font-weight:300; }
main{ padding:28px 0 72px; }
.head{ display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:8px 0; border-top:1px solid var(--hair2); border-bottom:1px solid var(--hair); margin-bottom:28px; }
h1{ font-weight:300; font-size:clamp(2rem,5vw,3.8rem); line-height:1.04; letter-spacing:-.025em; margin:0 0 14px; overflow-wrap:anywhere; }
.lede{ font-weight:300; font-size:clamp(1.1rem,2.2vw,1.5rem); line-height:1.3; letter-spacing:-.01em; margin:0 0 30px; max-width:60ch; }
h2{ font-weight:500; font-size:13px; letter-spacing:.02em; margin:38px 0 12px; }
h3{ font-weight:500; font-size:17px; letter-spacing:-.01em; margin:26px 0 8px; }
p{ margin:0 0 12px; max-width:78ch; }
.soft{ color:var(--soft); }
.face{ display:grid; gap:14px; grid-template-columns:1fr; }
@media (min-width: 640px){ .face{ grid-template-columns:repeat(2,1fr); } }
@media (min-width: 980px){ .face{ grid-template-columns:repeat(4,1fr); } }
.cell{ background:var(--panel); padding:16px 16px 14px; border-radius:2px; min-width:0; }
.cell .tier{ font-weight:300; font-size:44px; line-height:1; letter-spacing:-.03em; margin:8px 0 6px; }
.cell .name{ font-size:14px; margin:0 0 10px; }
.cell .per{ display:flex; gap:12px; font-size:13px; color:var(--soft); font-variant-numeric:tabular-nums; }
.cell .blk{ font-size:13px; margin-top:10px; border-top:1px solid var(--hair); padding-top:8px; }
.st{ display:inline-flex; align-items:center; gap:7px; white-space:nowrap; }
.mk{ width:.72em; height:.72em; border-radius:50%; display:inline-block; flex:none; border:1.5px solid currentColor; }
.mk-full{ background:currentColor; }
.mk-half{ background:linear-gradient(90deg,currentColor 50%,transparent 50%); }
.mk-void{ border-style:dashed; background:transparent; }
.mk-dot{ width:.4em; height:.4em; background:currentColor; border:0; }
.mk-cross{ border-radius:1px; background:transparent; position:relative; }
.mk-cross::before,.mk-cross::after{ content:""; position:absolute; left:50%; top:-1px; bottom:-1px; width:1.5px; background:currentColor; transform:rotate(45deg); }
.mk-cross::after{ transform:rotate(-45deg); }
.chip-inv{ background:var(--fg); color:var(--bg); padding:1px 8px 1px 6px; border-radius:2px; }
.chip-inv .mk{ border-radius:1px; transform:rotate(45deg); }
.tw{ overflow-x:auto; -webkit-overflow-scrolling:touch; margin:0 0 8px; }
table.t{ width:100%; border-collapse:collapse; font-size:14px; }
table.t th{ text-align:left; font-weight:500; font-size:12px; color:var(--soft); padding:6px 10px 6px 0; border-bottom:1px solid var(--hair2); vertical-align:bottom; }
table.t td{ padding:7px 10px 7px 0; border-bottom:1px solid var(--hair); vertical-align:top; }
table.t td.why{ color:var(--soft); font-size:13px; min-width:16ch; }
code,.hash{ font-family:var(--code); font-size:.86em; overflow-wrap:anywhere; }
.proof{ display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; padding:12px 14px; border:1px solid var(--hair2); border-radius:2px; margin:0 0 28px; }
.proof .mk{ border-radius:1px; transform:rotate(45deg); border-color:var(--or); background:var(--or); }
ul.plain{ margin:0 0 12px; padding-left:18px; }
ul.plain li{ margin:0 0 4px; }
footer{ border-top:1px solid var(--hair); padding:18px 0 40px; }
@media print{ body::after{ display:none; } }
`;

function faceCells(face) {
  return face.axes.map((a) => {
    const per = ["P1", "P2", "P3"].map((t) => `<span>${t} ${a.perTier[t].N ? `${a.perTier[t].n}/${a.perTier[t].N}` : "–"}</span>`).join("");
    const blocked = a.blockedBy.length
      ? `<div class="blk">${a.blockedBy.slice(0, 6).map((b) => `<div>${mark(b.state, `${b.id} ${b.tier} ${W[b.state]}`)}</div>`).join("")}${a.blockedBy.length > 6 ? `<div class="soft">and ${a.blockedBy.length - 6} more</div>` : ""}</div>`
      : a.cappedAt ? `<div class="blk soft">capped: no applicable criterion defines ${esc(a.cappedAt)}</div>` : a.tier === "na" ? `<div class="blk soft">every criterion of the axis is n/a</div>` : "";
    return `<div class="cell"><div class="rv"><b>${esc(a.axis)}</b> · n/a ${a.na} · not observed ${a.notObserved} · error ${a.error}</div><div class="tier">${esc(a.tier)}</div><p class="name">${esc(a.title)}</p><div class="per">${per}</div>${blocked}</div>`;
  }).join("\n");
}

function criteriaTable(list) {
  const rows = list.map((c) => {
    const tiers = Object.entries(c.tiers ?? {}).map(([t, r]) => `<div>${mark(r.state, `${t} ${W[r.state]}`)}</div>`).join("") || `<span class="soft">–</span>`;
    const vals = Object.entries(c.values ?? {}).map(([k, v]) => { const t = valueText(v); return t ? `<div><span class="soft">${esc(k.split(".").pop())}</span> ${esc(cut(t, 60))}</div>` : ""; }).join("");
    const open = Object.values(c.tiers ?? {}).find((r) => r.state !== "met" && r.state !== "na");
    const why = c.state === "na" ? c.na?.reason : (c.why ?? open?.why ?? []).join("; ");
    return `<tr><td><span class="rv"><b>${esc(c.id)}</b> r${c.rev} · ${esc(c.class.join(" "))}</span><br>${esc(c.title)}</td><td>${mark(c.state)}</td><td>${esc(c.reached ?? "none")}</td><td>${tiers}</td><td>${vals}</td><td class="why">${esc(cut(why, 220))}</td></tr>`;
  }).join("\n");
  return `<div class="tw"><table class="t"><thead><tr><th>Criterion</th><th>State</th><th>Reached</th><th>Tiers</th><th>Values</th><th>Why</th></tr></thead><tbody>\n${rows}\n</tbody></table></div>`;
}

export function page(title, description, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

export function reportHtml(record, grid) {
  const r = record;
  const s = r.snapshot;
  const crit = [...r.internal.criteria, ...r.external.criteria];
  const byAxis = (axis) => crit.filter((c) => c.axis === axis).sort((a, b) => (a.id < b.id ? -1 : 1));
  const profileRows = Object.entries(r.profile.facts).map(([k, f]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(cut(show(f.value), 70))}</td><td>${mark(f.basis === "contradicted" ? "not-met" : f.basis === "declared" ? "not-observed" : "met", f.basis)}</td><td class="why">${esc(f.note ?? "")}</td></tr>`).join("\n");
  const regress = r.face.regressions.length
    ? `<ul class="plain">${r.face.regressions.map((g) => `<li>${esc(g.axis)} ${esc(g.from)} → ${esc(g.to)}: ${g.kind === "real" ? "a real loss" : "a loss by observation only"} (${esc(g.blockedBy.map((b) => `${b.id} ${b.tier} ${W[b.state]}`).join(", "))})</li>`).join("")}</ul>`
    : r.face.previous ? `<p class="soft">No axis lost a tier against the previous record (${esc(r.face.previous.label ?? short(r.face.previous.commit))}).</p>` : "";
  const nm = r.notMechanized.length
    ? `<ul class="plain">${r.notMechanized.map((n) => `<li><b>${esc(n.id)}</b> ${esc(n.tiers.join(", "))}: <code>${esc(n.facts.join(", "))}</code></li>`).join("")}</ul>`
    : `<p class="soft">None.</p>`;
  const axes = grid.axes.map((a) => {
    const ax = r.face.axes.find((x) => x.axis === a.id);
    return `<h3>${esc(a.id)} · ${esc(a.title)} · ${esc(ax.tier)}</h3>\n${criteriaTable(byAxis(a.id))}`;
  }).join("\n");
  const snapLine = s
    ? `<span>snapshot <b>${esc(s.asOfDate)}</b></span><span>${s.concordant ? "concordant" : `not concordant · head <b>${esc(short(s.headAtCapture))}</b>`}</span>`
    : `<span>no snapshot</span>`;
  const body = `<header class="top"><div class="wrap"><span class="brand">runward<span>-assess</span></span><span class="rv">${esc(r.grid.id)} · <b>${esc(r.tool.name)} ${esc(r.tool.version)}</b> · grid ${esc(short(r.grid.digest))}</span></div></header>
<main class="wrap">
<div class="head rv"><span>commit <b>${esc(short(r.subject.commit))}</b></span><span>committed <b>${esc(r.subject.committedAt)}</b></span><span>window <b>${r.window.commits}</b> · ${esc(r.window.basis)}</span>${snapLine}</div>
<h1>${esc(r.subject.repo)}${r.subject.label ? ` · ${esc(r.subject.label)}` : ""}</h1>
<p class="lede">Each axis reads the highest tier whose every applicable criterion is met. No global score, no average: n/a does not block; not observed and error block, counted apart from not met.</p>
<div class="proof"><span class="mk" aria-hidden="true"></span><span class="rv">record</span><code class="hash">${esc(r.digest)}</code><span class="rv">internal ${esc(short(r.internal.digest))} · external ${esc(short(r.external.digest))}</span></div>
<h2>The face</h2>
<div class="face">
${faceCells(r.face)}
</div>
${regress}
<h2>The profile</h2>
<p>Declared profiles: ${esc(r.profile.profiles.map((p) => `${p} (${r.profile.bases[p] ?? "declared"})`).join(", ") || "none")}. A fact neither the commit nor the snapshot shows is marked declared; one they contradict is marked contradicted.</p>
<div class="tw"><table class="t"><thead><tr><th>Fact</th><th>Value</th><th>Basis</th><th>Note</th></tr></thead><tbody>
${profileRows}
</tbody></table></div>
${r.profile.contradictions.length ? `<ul class="plain">${r.profile.contradictions.map((c) => `<li>${esc(c.fact)}: declared ${esc(show(c.declared))}, observed ${esc(c.observed.join(", "))}</li>`).join("")}</ul>` : ""}
<h2>Criteria</h2>
<p class="soft">Internal criteria read the commit alone and hold for it for ever; the others read the snapshot too and hold at its date only.</p>
${axes}
<h2>Not mechanized in ${esc(r.tool.name)} ${esc(r.tool.version)}</h2>
<p class="soft">A fact this version does not collect is never inferred: the tier that needs it reads not observed, and blocks.</p>
${nm}
<h2>Judged annex</h2>
<p class="soft">${esc(r.annex.note)}</p>
<ul class="plain">${r.annex.items.map((i) => `<li><b>${esc(i.id)}</b> ${esc(i.question)} <span class="soft">(${esc(i.scale.join(" / "))}): not judged</span></li>`).join("")}</ul>
</main>
<footer><div class="wrap rv">measure <b>${esc(short(r.measure.digest))}</b> · facts <b>${esc(short(r.measure.factsDigest))}</b> · ${esc(r.measure.environment.os)}/${esc(r.measure.environment.arch)} · node ${esc(r.measure.environment.node)} · network ${esc(r.measure.environment.network)}${s ? ` · snapshot <b>${esc(short(s.digest))}</b> · ${s.unavailable.length} external fact(s) not observed` : ""} · profile ${esc(short(r.profile.declaredDigest))} · trigger ${esc(r.trigger)}</div></footer>`;
  return page(`${r.subject.repo} assessment`, `${r.grid.id} record of ${r.subject.repo} at ${short(r.subject.commit)}: axis tiers, criteria and the inputs that produced them.`, body);
}
