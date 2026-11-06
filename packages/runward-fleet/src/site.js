// The static site: one page, the index and the views inlined, the fonts embedded, nothing loaded
// from elsewhere. A pure function of its inputs: the same index gives the same bytes.
import { BuildError } from "./build.js";
import { checkIndex, checkPage, checkView } from "./rules.js";

const NOSCRIPT = {
  en: "This page renders its index with JavaScript; the same index is in index.json, next to it.",
  fr: "Cette page affiche son index avec JavaScript ; le même index est dans index.json, à côté d'elle.",
};
const THEME = { en: "theme", fr: "thème" };

/**
 * Assemble the page. `views` is the source text of ui/views.js and `api` the same module, imported:
 * every view the page can show is rendered here first and checked against the view rules, and a page
 * that breaks one is not written. `fonts` are { family, weight, format, bytes }.
 */
export function renderSite(index, { template, views, api, fonts }) {
  const problems = [...checkIndex(index)];
  for (const [route, arg] of api.allViews(index)) {
    const where = `#/${route}${arg ? `/${arg}` : ""}`;
    let html;
    try { html = api.renderView(index, route, arg ?? undefined, { strict: true }); } catch (e) { problems.push(`${where}: the view cannot be built from this index (${e.message})`); continue; }
    problems.push(...checkView(html, index, where));
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
