// The GitHub adapter (ADR-0094). On GitHub the summary goes to the job summary file the runner
// provides (GITHUB_STEP_SUMMARY): a file write, no network call and no token. The check run (the
// external status) and the fact reader answer with named refusals until the deliveries that ship them.
import { appendFile } from "node:fs/promises";
import { posted, notPosted, refuseFactsNotShipped, refuseExternalStatusWithoutPolicy } from "./port.js";

export const FORGE = "github";
/** GitHub's documented limit on one step's job summary (1 MiB). */
export const SUMMARY_MAX_BYTES = 1024 * 1024;

export function contextFromEnv(env = process.env) {
  return {
    summaryFile: env.GITHUB_STEP_SUMMARY || null,
    serverUrl: env.GITHUB_SERVER_URL ?? null,
    repository: env.GITHUB_REPOSITORY ?? null,
    ref: env.GITHUB_SHA ?? null,
  };
}

/** Append the summary to the job summary. Never throws, never fails the job. */
export async function postSummary(markdown, ctx) {
  if (!ctx?.summaryFile) return notPosted("no job summary file (GITHUB_STEP_SUMMARY unset)", { forge: FORGE });
  if (typeof markdown !== "string" || markdown.trim() === "") return notPosted("empty summary", { forge: FORGE });
  if (Buffer.byteLength(markdown) > SUMMARY_MAX_BYTES) return notPosted(`summary larger than ${SUMMARY_MAX_BYTES} bytes`, { forge: FORGE });
  try {
    await appendFile(ctx.summaryFile, markdown.endsWith("\n") ? markdown : markdown + "\n");
  } catch (e) {
    return notPosted(`job summary not writable (${e?.code ?? "error"})`, { forge: FORGE });
  }
  return posted("job summary", { forge: FORGE });
}

/** `Merge pull request #N from owner/branch`, the subject GitHub writes in a merge commit. Pure.
 *  A squash merge's `Title (#N)` subject is deliberately NOT read: any author can type it. */
export function identifyChange(commitMessage) {
  if (typeof commitMessage !== "string") return null;
  const m = /^Merge pull request #(\d+) from \S+/.exec(commitMessage);
  return m ? { forge: FORGE, id: `#${m[1]}`, number: Number(m[1]) } : null;
}

/** A link to a file of the repository at a ref, as GitHub's web UI serves it. Pure. */
export function renderPath(path, ctx) {
  if (!ctx?.serverUrl || !ctx?.repository || !ctx?.ref || typeof path !== "string" || path === "") return null;
  const segs = path.replace(/^\.?\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `${ctx.serverUrl.replace(/\/+$/, "")}/${ctx.repository}/blob/${encodeURIComponent(ctx.ref)}/${segs}`;
}

export async function readChangeFacts() { return refuseFactsNotShipped(FORGE); }
export async function setExternalStatus() { return refuseExternalStatusWithoutPolicy(FORGE); }
