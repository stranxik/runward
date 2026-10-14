// One HTTP call with the retry decision 3 of ADR-0094 allows: a 5xx or a timeout is retried once,
// anything else is answered as it came. Node's own `fetch`, no dependency, no proxy logic.

export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number, fetchImpl?: typeof fetch }} init
 * @returns {Promise<{ status: number, body: unknown, malformed: boolean } | { status: "timeout" | "network", body: null, malformed: false }>}
 */
export async function requestJson(url, init = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch, ...rest } = init;
  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    last = await once(url, rest, timeoutMs, fetchImpl);
    const retryable = last.status === "timeout" || last.status === "network" || (typeof last.status === "number" && last.status >= 500);
    if (!retryable) return last;
  }
  return last;
}

async function once(url, init, timeoutMs, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timeout = e?.name === "TimeoutError" || e?.name === "AbortError";
    return { status: timeout ? "timeout" : "network", body: null, malformed: false };
  }
  const text = await res.text();
  try {
    return { status: res.status, body: text === "" ? null : JSON.parse(text), malformed: false };
  } catch {
    return { status: res.status, body: null, malformed: true };
  }
}
