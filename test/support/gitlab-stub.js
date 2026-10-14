// The GitLab bench, layer 1 (docs/gitlab-bench.md): a GitLab API stub for the unit tests.
//
// Test-only. It binds 127.0.0.1 on a port the system picks, and never anything else: no test that
// uses it touches the network, and nothing in src/ imports it. It answers from the fixtures under
// test/fixtures/gitlab/, each of which says where it came from (recorded from a GitLab CE instance
// by .github/workflows/gitlab-bench.yml, or copied from the GitLab API documentation).
//
// Two behaviours, kept apart so a test knows which one it relies on:
// - replay: a request whose method and path (query included) equal a fixture's is answered with
//   that fixture's status and body, byte for byte;
// - merge request notes: a small stateful model of create, list and update, enough for D1's summary
//   note (create once, find by marker, update in place). Each note it returns is the shape of the
//   `mr-note-get` fixture with the stub's own id, body and timestamps: the shape is the fixture's,
//   the behaviour is the stub's, and the tests that use it say so.
// Anything else is answered as GitLab answers an unknown route, 404 {"message":"404 Not Found"},
// and kept in `unmatched` so a test can assert it asked for nothing it did not expect.
import { createServer } from "node:http";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "gitlab");
export const SOURCES = ["recorded", "docs-example"];

// Load every fixture and refuse one that does not say where it came from.
export function loadGitlabFixtures(dir = FIXTURES_DIR) {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => {
    const fx = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const where = `${f}:`;
    if (fx.fixture !== f.replace(/\.json$/, "")) throw new Error(`${where} "fixture" must equal the file name`);
    if (!SOURCES.includes(fx.source)) throw new Error(`${where} "source" must be one of ${SOURCES.join(", ")}`);
    if (!/^(GET|POST|PUT|DELETE) \/\S+$/.test(fx.endpoint ?? "")) throw new Error(`${where} "endpoint" must be "METHOD /path/template"`);
    if (!/^\d{4}-\d{2}-\d{2}/.test(fx.recorded_at ?? "")) throw new Error(`${where} "recorded_at" must be a date`);
    if (fx.source === "recorded" && !(fx.gitlab?.version && fx.gitlab?.image)) throw new Error(`${where} a recorded fixture names its GitLab version and image`);
    if (fx.source === "docs-example" && !/^[0-9a-f]{40}$/.test(fx.docs?.commit ?? "")) throw new Error(`${where} a docs example names the documentation commit it was copied from`);
    if (!fx.request?.method || !fx.request?.path?.startsWith("/api/v4/")) throw new Error(`${where} "request" needs a method and an /api/v4/ path`);
    if (!Number.isInteger(fx.response?.status)) throw new Error(`${where} "response.status" must be an integer`);
    return fx;
  });
}

const json = (res, status, body) => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": typeof body === "string" ? "text/plain" : "application/json" });
  res.end(text);
};

const NOTES_PATH = /^\/api\/v4\/projects\/([^/]+)\/merge_requests\/(\d+)\/notes(?:\/(\d+))?$/;

/**
 * Start the stub. Resolves to { url, requests, unmatched, notes, close }.
 * @param {{ fixtures?: object[], token?: string }} [options]
 */
export function startGitlabStub({ fixtures = loadGitlabFixtures(), token = "stub-token" } = {}) {
  const requests = [];
  const unmatched = [];
  const notes = new Map(); // "<project>!<iid>" -> note[]
  const noteShape = fixtures.find((f) => f.fixture === "mr-note-get")?.response.body;
  let nextNoteId = 1;

  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const url = new URL(req.url, "http://127.0.0.1");
      const path = url.pathname + url.search;
      let body = null;
      if (raw) {
        try { body = JSON.parse(raw); } catch { body = Object.fromEntries(new URLSearchParams(raw)); }
      }
      requests.push({ method: req.method, path, body, token: req.headers["private-token"] ?? null });
      if (req.headers["private-token"] !== token) return json(res, 401, { message: "401 Unauthorized" });

      const fx = fixtures.find((f) => f.request.method === req.method && f.request.path === path);
      if (fx) return json(res, fx.response.status, fx.response.body);

      const m = noteShape && NOTES_PATH.exec(url.pathname);
      if (m) {
        const key = `${m[1]}!${m[2]}`;
        const list = notes.get(key) ?? [];
        notes.set(key, list);
        const now = new Date(0).toISOString(); // deterministic: the stub has no clock
        if (req.method === "GET" && !m[3]) return json(res, 200, list);
        if (req.method === "POST" && !m[3] && typeof body?.body === "string") {
          const note = { ...structuredClone(noteShape), id: nextNoteId++, body: body.body, created_at: now, updated_at: now, noteable_iid: Number(m[2]) };
          list.push(note);
          return json(res, 201, note);
        }
        const note = m[3] && list.find((n) => n.id === Number(m[3]));
        if (note && req.method === "GET") return json(res, 200, note);
        if (note && req.method === "PUT" && typeof body?.body === "string") {
          note.body = body.body;
          return json(res, 200, note);
        }
      }
      unmatched.push({ method: req.method, path });
      return json(res, 404, { message: "404 Not Found" });
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // Loopback only, by construction: the host is not a parameter.
    server.listen(0, "127.0.0.1", () => {
      const { address, port } = server.address();
      resolve({
        url: `http://${address}:${port}`,
        address,
        requests,
        unmatched,
        notes,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
