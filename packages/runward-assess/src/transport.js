// transport.js: the only module that opens the network. snapshot.js receives it as an argument, so
// its tests run on recorded answers and the measure and the score never hold it.
//
// GitHub is read with `gh api --method GET` and nothing else: no field is ever sent, so no call can
// write. A token never reaches a file or an output: error lines are cut to their HTTP status. Pages are
// fetched with one plain GET and an honest user agent; a page that refuses (403, a challenge) is
// recorded as refused, never retried as a browser.
import { spawnSync } from "node:child_process";
import { connect } from "node:tls";

const UA = "runward-assess/0.1.0 (read-only assessment; +https://github.com/stranxik/runward/tree/main/packages/runward-assess)";
const scrub = (s) => String(s ?? "").replace(/gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/g, "<token>").split("\n")[0].slice(0, 160);

export function realTransport() {
  const log = [];
  const gh = (path, { paginate = false } = {}) => {
    const args = ["api", "--method", "GET", "-H", "Accept: application/vnd.github+json", "-H", "X-GitHub-Api-Version: 2022-11-28"];
    if (paginate) args.push("--paginate", "--slurp");
    args.push(path);
    const r = spawnSync("gh", args, { encoding: "utf8", maxBuffer: 1 << 30 });
    let res;
    if (r.status === 0) {
      try { const v = JSON.parse(r.stdout); res = { status: "ok", value: paginate ? v.flat() : v }; }
      catch { res = { status: "error", reason: "unparseable JSON" }; }
    } else {
      const m = (r.stderr + r.stdout).match(/HTTP (\d{3})/);
      res = { status: m ? `http-${m[1]}` : "error", reason: scrub(r.stderr || r.error) };
    }
    log.push({ kind: "gh", request: path.replace(/[?&](per_page|page)=\d+/g, ""), status: res.status });
    return res;
  };
  const get = async (url, { json = true, method = "GET", body = null } = {}) => {
    let res;
    try {
      const r = await fetch(url, { method, body: body ? JSON.stringify(body) : undefined, redirect: "follow", signal: AbortSignal.timeout(30000),
        headers: { "user-agent": UA, ...(body ? { "content-type": "application/json" } : {}) } });
      const headers = Object.fromEntries([...r.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
      const text = await r.text();
      if (!r.ok) res = { status: `http-${r.status}`, headers };
      else res = { status: "ok", headers, value: json ? JSON.parse(text) : text, http: r.status };
    } catch (e) { res = { status: "error", reason: scrub(e.cause?.code || e.name || e) }; }
    log.push({ kind: method === "GET" ? "get" : "post", request: url, status: res.status });
    return res;
  };
  const tls = (host) => new Promise((resolve) => {
    const s = connect({ host, port: 443, servername: host, timeout: 15000 });
    const done = (v) => { s.destroy(); log.push({ kind: "tls", request: host, status: v.status }); resolve(v); };
    s.on("secureConnect", () => {
      const cert = s.getPeerCertificate();
      done({ status: "ok", protocol: s.getProtocol(), authorized: s.authorized, validTo: cert?.valid_to ?? null });
    });
    s.on("timeout", () => done({ status: "error", reason: "timeout" }));
    s.on("error", (e) => done({ status: "error", reason: scrub(e.code || e.message) }));
  });
  const npm = (args, cwd) => {
    const r = spawnSync("npm", args, { cwd, encoding: "utf8", maxBuffer: 1 << 30, env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false" } });
    log.push({ kind: "npm", request: args.filter((a) => !a.startsWith("/")).join(" "), status: r.status === 0 ? "ok" : `exit-${r.status}` });
    return { code: r.status, out: r.stdout ?? "", err: scrub(r.stderr) };
  };
  return { gh, get, tls, npm, log, now: () => new Date().toISOString() };
}
