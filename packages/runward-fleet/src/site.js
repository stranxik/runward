// The static site: one page, the index and the views inlined, the fonts embedded, nothing loaded
// from elsewhere. A pure function of its inputs: the same index gives the same bytes.
//
// Exported as `runward-fleet/site` (ADR-0121 decision 1): a hosted deployment renders the page the
// static build writes, or reads the same template, views and fonts, from the package it pins instead
// of a copy of them. `renderPage(index)` is what `runward-fleet build` writes to index.html.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BuildError } from "./build.js";
import { checkIndex, checkLexicon, checkPage, checkReading, checkRefusals, checkView } from "./rules.js";
import * as api from "../ui/views.js";

const UI = join(dirname(fileURLToPath(import.meta.url)), "..", "ui");
const FONTS = [
  { family: "Inter", weight: 300, file: "inter-latin-300-normal.woff2" },
  { family: "Inter", weight: 400, file: "inter-latin-400-normal.woff2" },
  { family: "Inter", weight: 500, file: "inter-latin-500-normal.woff2" },
  { family: "Inter", weight: 600, file: "inter-latin-600-normal.woff2" },
  { family: "Departure Mono", weight: 400, file: "DepartureMono-Regular.woff2" },
];
const NOSCRIPT = {
  en: "This page renders its index with JavaScript; the same index is in index.json, next to it.",
  fr: "Cette page affiche son index avec JavaScript ; le même index est dans index.json, à côté d'elle.",
};
const THEME = { en: "theme", fr: "thème" };

/**
 * What the page is made of, read from this package's own files: `template` (ui/template.html, the
 * shell and the identity's tokens), `views` (the source text of ui/views.js), `api` (the same module,
 * imported) and `fonts` ({ family, weight, file, bytes }). It reads those files and nothing else.
 */
export function siteAssets() {
  return {
    template: readFileSync(join(UI, "template.html"), "utf8"),
    views: readFileSync(join(UI, "views.js"), "utf8"),
    api,
    fonts: FONTS.map((f) => ({ ...f, bytes: readFileSync(join(UI, "fonts", f.file)) })),
  };
}

/** The page `runward-fleet build` writes for this index, byte for byte; refused as renderSite refuses. */
export function renderPage(index) {
  return renderSite(index, siteAssets());
}

/**
 * Assemble the page. `views` is the source text of ui/views.js and `api` the same module, imported:
 * every view the page can show is rendered here first and checked against the view rules, and a page
 * that breaks one is not written. `fonts` are { family, weight, format, bytes }.
 */
export function renderSite(index, { template, views, api, fonts }) {
  // The lexicon of the decision reading is held whatever this index holds (ADR-0125): every sentence of
  // both languages, not only the ones this page shows.
  const problems = [...checkIndex(index), ...(api.LEXICON ? checkLexicon(api.LEXICON) : [])];
  for (const [route, arg] of api.allViews(index)) {
    const where = `#/${route}${arg ? `/${arg}` : ""}`;
    let html;
    try { html = api.renderView(index, route, arg ?? undefined, { strict: true }); } catch (e) { problems.push(`${where}: the view cannot be built from this index (${e.message})`); continue; }
    problems.push(...checkView(html, index, where));
    if (route === "decision") problems.push(...checkReading(html, where), ...(arg ? checkRefusals(html, index, arg, where) : []));
  }
  if (/<\/script/i.test(views)) problems.push("ui/views.js holds a closing script tag");
  const fontCss = fonts.map((f) => `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(data:font/woff2;base64,${f.bytes.toString("base64")}) format("woff2")}`).join("\n");
  const lang = api.lang(index);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const slots = ["/*LANG*/", "/*TITLE*/", "/*FONTS*/", "/*THEME*/", "/*NOSCRIPT*/", "/*INDEX*/", "/*VIEWS*/"];
  for (const s of slots) if (!template.includes(s)) throw new BuildError(`the template lacks its ${s} slot`);
  const html = template
    .replace("/*LANG*/", () => lang)
    .replace("/*TITLE*/", () => esc(index.title))
    .replace("/*FONTS*/", () => fontCss)
    .replace("/*THEME*/", () => THEME[lang])
    .replace("/*NOSCRIPT*/", () => NOSCRIPT[lang])
    .replace("/*INDEX*/", () => JSON.stringify(index).replace(/</g, "\\u003c"))
    .replace("/*VIEWS*/", () => views);
  problems.push(...checkPage(html));
  if (problems.length) throw new BuildError(`the page breaks ${problems.length} view rule(s):\n  - ${problems.join("\n  - ")}`);
  return html;
}
