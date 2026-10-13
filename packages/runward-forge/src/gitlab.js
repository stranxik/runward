// The GitLab adapter (ADR-0094). D1 ships the summary poster (gap analysis G3: one merge request
// note, found by its marker, updated in place, else created), the change identifier and the path
// renderer. The fact reader (G5) and the external control (G7) answer with named refusals until the
// deliveries that ship them.
//
// The token. `CI_JOB_TOKEN` only READS merge request notes, so writing one needs a project access
// token (any licence self-managed; Premium on GitLab.com), passed as RUNWARD_FORGE_TOKEN. A personal
// access token is not recommended: it would make a person's credential the poster's identity
// (ADR-0094, alternatives discarded). Without a token the summary stays an exposed artifact.
import { requestJson } from "./http.js";
import { SUMMARY_MARKER, posted, notPosted, refuseFactsNotShipped, refuseExternalStatusWithoutPolicy } from "./port.js";

export const FORGE = "gitlab";
/** GitLab's limit on a note body, from its notes API documentation (read 2026-10-13). */
export const NOTE_MAX_CHARS = 1_000_000;
const PAGE = 100;
const MAX_PAGES = 20;

/** The context a GitLab CI job provides, read from its predefined variables. */
export function contextFromEnv(env = process.env) {
  return {
    apiUrl: env.CI_API_V4_URL ?? null,
    serverUrl: env.CI_SERVER_URL ?? null,
    projectId: env.CI_PROJECT_ID ?? null,
    projectPath: env.CI_PROJECT_PATH ?? null,
    mrIid: env.CI_MERGE_REQUEST_IID ?? null,
    ref: env.CI_COMMIT_SHA ?? null,
    token: env.RUNWARD_FORGE_TOKEN || null,
  };
}

function failure(r) {
  if (r.status === "timeout") return "timeout";
  if (r.status === "network") return "network error";
  if (r.malformed) return `malformed response (HTTP ${r.status})`;
  return `HTTP ${r.status}`;
}

/**
 * Create or update the one summary note on the merge request. Never throws, never fails the job.
 * @param {string} markdown the neutral summary (the same bytes on every forge)
 * @param {ReturnType<typeof contextFromEnv> & { fetchImpl?: typeof fetch, timeoutMs?: number }} ctx
 */
export async function postSummary(markdown, ctx) {
  if (!ctx?.token) return notPosted("no token", { forge: FORGE });
  if (!ctx.apiUrl || !ctx.projectId) return notPosted("not in a GitLab CI job (CI_API_V4_URL or CI_PROJECT_ID unset)", { forge: FORGE });
  if (!ctx.mrIid) return notPosted("no merge request for this pipeline (CI_MERGE_REQUEST_IID unset)", { forge: FORGE });
  if (typeof markdown !== "string" || markdown.trim() === "") return notPosted("empty summary", { forge: FORGE });
  const body = markdown.includes(SUMMARY_MARKER) ? markdown : `${SUMMARY_MARKER}\n${markdown}`;
  if (body.length > NOTE_MAX_CHARS) return notPosted(`summary longer than ${NOTE_MAX_CHARS} characters`, { forge: FORGE });

  const base = `${ctx.apiUrl.replace(/\/+$/, "")}/projects/${encodeURIComponent(ctx.projectId)}/merge_requests/${encodeURIComponent(ctx.mrIid)}/notes`;
  const init = { headers: { "PRIVATE-TOKEN": ctx.token, "content-type": "application/json" }, fetchImpl: ctx.fetchImpl, timeoutMs: ctx.timeoutMs };

  let existing = null;
  for (let page = 1; page <= MAX_PAGES && !existing; page++) {
    const r = await requestJson(`${base}?per_page=${PAGE}&page=${page}`, { ...init, method: "GET" });
    if (r.status !== 200 || r.malformed) return notPosted(failure(r), { forge: FORGE });
    if (!Array.isArray(r.body)) return notPosted(`malformed response (HTTP ${r.status})`, { forge: FORGE });
    existing = r.body.find((n) => typeof n?.body === "string" && n.body.includes(SUMMARY_MARKER) && Number.isInteger(n.id)) ?? null;
    if (r.body.length < PAGE) break;
  }

  const r = existing
    ? await requestJson(`${base}/${existing.id}`, { ...init, method: "PUT", body: JSON.stringify({ body }) })
    : await requestJson(base, { ...init, method: "POST", body: JSON.stringify({ body }) });
  const okStatus = existing ? 200 : 201;
  if (r.status !== okStatus || r.malformed || !Number.isInteger(r.body?.id)) return notPosted(failure(r), { forge: FORGE });
  return posted(`merge request !${ctx.mrIid} note ${r.body.id} (${existing ? "updated" : "created"})`, { forge: FORGE, noteId: r.body.id, action: existing ? "updated" : "created" });
}

/** `See merge request group/project!N`, the trailer GitLab writes in a merge commit. Pure. */
export function identifyChange(commitMessage) {
  if (typeof commitMessage !== "string") return null;
  const m = /^See merge request ([A-Za-z0-9_.\-/]+)!(\d+)\s*$/m.exec(commitMessage);
  return m ? { forge: FORGE, id: `${m[1]}!${m[2]}`, project: m[1], number: Number(m[2]) } : null;
}

/** A link to a file of the repository at a ref, as GitLab's web UI serves it. Pure. */
export function renderPath(path, ctx) {
  if (!ctx?.serverUrl || !ctx?.projectPath || !ctx?.ref || typeof path !== "string" || path === "") return null;
  const segs = path.replace(/^\.?\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `${ctx.serverUrl.replace(/\/+$/, "")}/${ctx.projectPath}/-/blob/${encodeURIComponent(ctx.ref)}/${segs}`;
}

export async function readChangeFacts() { return refuseFactsNotShipped(FORGE); }
export async function setExternalStatus() { return refuseExternalStatusWithoutPolicy(FORGE); }
