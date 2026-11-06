// ADR-0117, What would settle it, criterion 2: the false reds the built-in analyzers (ADR-0118) raised on
// three repositories runward did not write (express, fastify and hono, pinned at a commit), as an
// independent reviewer classified them on 2026-11-06.
//
// Each test below is built from a minimal excerpt of a case the reviewer classified FALSE, with the file
// and line it comes from, and fails on the reading that raised it. Beside each one, a case the reviewer
// classified TRUE, or a sabotage the bench of 2026-11-05 planted, still reads red: a false red is fixed
// by reading the code better, never by reading less of it.
//
// No credential-looking string sits in this file: the PEM armour is built at run time from fragments,
// and its body is a fake (AAAA…).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { analyzeDelivery } from "../../dist/lib/analyze.js";

// A synthetic mission: a lock that pins the policy, and the files given.
function delivery(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-analyze-fp-"));
  const lock = { version: 1, writtenBy: "test", analysis: "runward-analysis/1", files: {} };
  const all = { "runward/scaffold-lock.json": JSON.stringify(lock), ...files };
  for (const [rel, text] of Object.entries(all)) { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); }
  try { return analyzeDelivery(join(dir, "runward")); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const core = (...patterns) => ["# Territory", "", "| Pattern | Category | Effect | Why |", "|---|---|---|---|",
  ...patterns.map((p) => `| \`${p}\` | \`domain-core\` | declare | the library's own source, declared for the test |`), ""].join("\n");
const cites = (...pointers) => ["# Architecture", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|",
  `| cited-symbols | applied | ${pointers.map((p) => `file:${p}`).join("; ")} |`, ""].join("\n");
const at = (r, path) => r.findings.filter((f) => f.path === path).map((f) => `${f.family}/${f.check}:${f.line}`);
const lines = (...l) => `${l.join("\n")}\n`;

// ── test-integrity ────────────────────────────────────────────────────────────────────────────────

test("test-integrity: a type alias instantiating an assertion type constrained `extends true` asserts (hono src/client/client.test.ts:654)", () => {
  const r = delivery({
    "src/utils/types.ts": lines(
      "export type Expect<T extends true> = T",
      "export type Equal<X, Y> =",
      "  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false",
      "export type Loose<T> = T",
    ),
    "src/client/client.ts": "export const hc = <T>(base: string) => ({ base }) as unknown as T\n",
    "src/client/client.test.ts": lines(
      "import type { Equal, Expect, Loose } from '../utils/types'",
      "import { hc } from './client'",
      "",
      "describe('infer', () => {",
      "  it('Should infer response type the type correctly', () => {",
      "    const client = hc<{ index: { $get: () => { id: number } } }>('/')",
      "    const req = client.index.$get",
      "    type Actual = ReturnType<typeof req>",
      "    type Expected = {",
      "      id: number",
      "    }",
      "    type verify = Expect<Equal<Expected, Actual>>",
      "  })",
      "",
      // hono src/validator/validator.test.ts:1094, classified TRUE: the only assertion is commented out.
      "  it('`app.on`', () => {",
      "    const route = hc<{ a: 1 }>('/')",
      "    type Actual = typeof route",
      "    //type verify = Expect<Equal<Expected, Actual>>",
      "  })",
      "",
      // hono src/hono.test.ts:578, classified TRUE: compile-only, no type assertion.
      "  it('Should mount routes with no type errors', () => {",
      "    const app = hc<{ api: 1 }>('/api')",
      "  })",
      "",
      // A generic that is not constrained to `true` checks nothing when instantiated.
      "  it('instantiates a type that asserts nothing', () => {",
      "    type verify = Loose<Equal<1, 2>>",
      "  })",
      "})",
    ),
  });
  assert.deepEqual(at(r, "src/client/client.test.ts"), [
    "test-integrity/case-asserts-nothing:15", "test-integrity/case-asserts-nothing:21", "test-integrity/case-asserts-nothing:25",
  ], "the type assertion clears its case; the commented one, the compile-only one and an unconstrained generic do not");
});

test("test-integrity: a `// @ts-expect-error` directive inside the case asserts, in a TypeScript file (hono src/middleware/jsx-renderer/index.test.tsx:69)", () => {
  const r = delivery({
    "src/jsx-renderer.ts": "export const jsxRenderer = (f: () => string) => f\n",
    "src/jsx-renderer.test.tsx": lines(
      "import { jsxRenderer } from './jsx-renderer'",
      "describe('JSX renderer', () => {",
      "  it('does not accept a null result', () => {",
      "    // @ts-expect-error A JSX renderer component must produce renderable content.",
      "    jsxRenderer(() => null)",
      "  })",
      "  it('names the directive only in a string', () => {",
      "    const s = '// @ts-expect-error'",
      "    jsxRenderer(() => s)",
      "  })",
      "})",
    ),
    // A JavaScript file is not type-checked by the directive's compiler unless it opts in: not read as one.
    "src/plain.test.js": lines(
      "const { jsxRenderer } = require('./jsx-renderer')",
      "it('in a JavaScript file', () => {",
      "  // @ts-expect-error",
      "  jsxRenderer(() => null)",
      "})",
    ),
  });
  assert.deepEqual(at(r, "src/jsx-renderer.test.tsx"), ["test-integrity/case-asserts-nothing:7"]);
  assert.deepEqual(at(r, "src/plain.test.js"), ["test-integrity/case-asserts-nothing:2"]);
});

test("test-integrity: an assertion inside a `const` arrow helper whose parameters span lines (hono src/middleware/compress/index.test.ts:121)", () => {
  const r = delivery({
    "src/compress.ts": "export const compress = () => async (c: unknown, next: () => Promise<void>) => { await next() }\n",
    "src/compress.test.ts": lines(
      "import { compress } from './compress'",
      "describe('Compress Middleware', () => {",
      "  const app = { request: async (req: Request) => new Response(null, { headers: req.headers }) }",
      "  void compress",
      "  const testCompression = async (",
      "    path: string,",
      "    acceptEncoding: string,",
      "    expectedEncoding: string | null",
      "  ) => {",
      "    const req = new Request(`http://localhost${path}`, {",
      "      method: 'GET',",
      "      headers: new Headers({ 'Accept-Encoding': acceptEncoding }),",
      "    })",
      "    const res = await app.request(req)",
      "    expect(res.headers.get('Content-Encoding')).toBe(expectedEncoding)",
      "    return res",
      "  }",
      "  const notAHelper = async (",
      "    path: string",
      "  ) => {",
      "    return app.request(new Request(path))",
      "  }",
      "  it('should prioritize gzip over deflate when both are accepted', async () => {",
      "    await testCompression('/large', 'gzip, deflate', 'gzip')",
      "  })",
      "  it('calls a helper that asserts nothing', async () => {",
      "    await notAHelper('/large')",
      "  })",
      "})",
    ),
  });
  assert.deepEqual(at(r, "src/compress.test.ts"), ["test-integrity/case-asserts-nothing:26"]);
});

test("test-integrity: mocha's done handed to the code under test, as an argument, a property value or a listener (express test/Route.js:10, Router.js:19, app.js:8, app.listen.js:7 and :38)", () => {
  const r = delivery({
    "lib/express.js": "module.exports = function express() { return {} }\n",
    "test/done.js": lines(
      "var express = require('../lib/express')",
      "var assert = require('node:assert')",
      "describe('done', function(){",
      "  it('should work without handlers', function(done) {",
      "    var req = { method: 'GET', url: '/' }",
      "    var route = new express.Route('/foo')",
      "    route.dispatch(req, {}, done)",
      "  })",
      "  it('should support .use of other routers', function (done) {",
      "    var router = new express.Router();",
      "    router.handle({ url: '/foo/bar', method: 'GET' }, { end: done }, function () { });",
      "  });",
      "  it('should inherit from event emitter', function(done){",
      "    var app = express();",
      "    app.on('foo', done);",
      "    app.emit('foo');",
      "  })",
      "  it('should wrap with an HTTP server', function(done){",
      "    var app = express();",
      "    var server = app.listen(0, function () {",
      "      server.close(done)",
      "    });",
      "  })",
      "  it('accepts just a callback (no args)', function (done) {",
      "    const app = express();",
      "    const server = app.listen();",
      "    server.close(done);",
      "  });",
      // What hands done to nothing under test: a direct call, a timer, a helper of this file.
      "  it('calls done itself', function (done) {",
      "    express();",
      "    done();",
      "  });",
      "  it('hands done to a timer', function (done) {",
      "    express();",
      "    setTimeout(done, 10);",
      "  });",
      "  it('hands done to a helper of this file', function (done) {",
      "    later(done);",
      "  });",
      // express test/Router.js:202, classified TRUE: a synchronous call and nothing else.
      "  it('should not throw if all callbacks are functions', function () {",
      "    var router = new express.Router();",
      "    router.route('/foo').all(function () { }).all(function () { });",
      "  })",
      "})",
      "function later(cb) { setImmediate(cb) }",
    ),
  });
  assert.deepEqual(at(r, "test/done.js"), [
    "test-integrity/case-asserts-nothing:29", "test-integrity/case-asserts-nothing:33",
    "test-integrity/case-asserts-nothing:37", "test-integrity/case-asserts-nothing:40",
  ]);
});

test("test-integrity: an awaited method of an object the case built and set up, the promise form of done (fastify test/schema-special-usage.test.js:423, test/http2/closing.test.js:118)", () => {
  const r = delivery({
    "fastify.js": "module.exports = function Fastify() { return { ready: async () => {}, listen: async () => {}, close: async () => {}, addSchema() {} } }\n",
    "lib/compose.js": "module.exports.compose = () => async (c) => c\n",
    "test/schema.test.js": lines(
      "'use strict'",
      "const { test } = require('node:test')",
      "const Fastify = require('..')",
      "const { compose } = require('../lib/compose')",
      "test('side effect on schema let the server crash', async t => {",
      "  const firstSchema = { $id: 'example1', type: 'object' }",
      "  const fastify = Fastify()",
      "  fastify.addSchema(firstSchema)",
      "  await fastify.ready()",
      "})",
      "test('http/2 closes successfully with async await', async t => {",
      "  const fastify = Fastify({ http2: true })",
      "  await fastify.listen({ port: 0 })",
      "  await fastify.close()",
      "})",
      // hono src/compose.test.ts:505, classified TRUE: a bare call awaited, nothing observed.
      "test('should work with 0 middleware', async () => {",
      "  await compose([])({ req: 'http://localhost/' })",
      "})",
      // fastify test/wrap-thenable.test.js:8, classified TRUE: the case resolves its own promise.
      "test('should resolve immediately when reply[kReplyHijacked] is true', async t => {",
      "  await new Promise(resolve => {",
      "    const reply = {}",
      "    compose([])(reply)",
      "    resolve()",
      "  })",
      "})",
      // A promise of the runtime, and an await that runs in a handler the case never calls.
      "test('awaits a resolved promise', async () => {",
      "  const fastify = Fastify()",
      "  await Promise.resolve(fastify)",
      "})",
      "test('only types, awaits inside a handler', () => {",
      "  const app = Fastify()",
      "  const route = (async (c, next) => { await app.ready() })",
      "  void route",
      "})",
      // A bare call stays a bare call when it is a method: nothing set up, nothing observed.
      "test('builds an object and awaits one call on it, nothing set up', async () => {",
      "  const fastify = Fastify()",
      "  await fastify.ready()",
      "})",
      // A value computed and never checked: the shape an assertion leaves when it is deleted.
      "test('keeps the value it computed, and checks nothing about it', async () => {",
      "  const fastify = Fastify()",
      "  fastify.addSchema({ $id: 'x' })",
      "  const out = await fastify.ready()",
      "})",
    ),
  });
  assert.deepEqual(at(r, "test/schema.test.js"), [
    "test-integrity/case-asserts-nothing:16", "test-integrity/case-asserts-nothing:19",
    "test-integrity/case-asserts-nothing:26", "test-integrity/case-asserts-nothing:30",
    "test-integrity/case-asserts-nothing:35", "test-integrity/case-asserts-nothing:39",
  ]);
});

test("test-integrity: an awaited promise that rejects on a failure condition (fastify test/reply-trailers.test.js:269)", () => {
  const r = delivery({
    "lib/client.js": "module.exports.request = (url, cb) => ({ on() {}, end() { cb({ on() {} }) } })\n",
    "test/trailers.test.js": lines(
      "const { test } = require('node:test')",
      "const http = require('../lib/client')",
      "test('stream error before end does not hang the response', async (t) => {",
      "  await new Promise((resolve, reject) => {",
      "    const req = http.request('http://localhost/', (res) => {",
      "      res.on('end', () => resolve())",
      "    })",
      "    req.on('error', () => resolve())",
      "    req.end()",
      "    const hangTimer = setTimeout(() => reject(new Error('response hung')), 2000)",
      "    t.after(() => clearTimeout(hangTimer))",
      "  })",
      "})",
      "test('the same promise without its failure path', async (t) => {",
      "  await new Promise((resolve, reject) => {",
      "    const req = http.request('http://localhost/', (res) => {",
      "      res.on('end', () => resolve())",
      "    })",
      "    req.end()",
      "  })",
      "})",
    ),
  });
  assert.deepEqual(at(r, "test/trailers.test.js"), ["test-integrity/case-asserts-nothing:14"]);
});

test("test-integrity: the bench's emptied suite still reads red, and a literal-only case is never said to be by design", () => {
  const r = delivery({
    "src/triage.ts": "export const triage = (s: string) => s.length\n",
    "test/triage.test.ts": lines(
      'import { test } from "node:test";',
      'import assert from "node:assert/strict";',
      'import { triage } from "../src/triage.ts";',
      'test("sales request: classified and routed to the sales queue", () => {});',
      'test("guard: a fabricated account reference never routes", async () => {});',
      'test("asserts only on a literal", () => { triage("x"); assert.ok(true); });',
    ),
  });
  assert.deepEqual(at(r, "test/triage.test.ts"), ["test-integrity/case-asserts-nothing:4", "test-integrity/case-asserts-nothing:5"]);
  const h = r.hypotheses.filter((x) => x.check === "case-asserts-literals");
  assert.equal(h.length, 1);
  assert.doesNotMatch(h[0].message, /by design/, "a case that cannot fail on the code is not by design (decision of 2026-11-06)");
  assert.match(h[0].message, /does not throw/);
});

// ── capability ────────────────────────────────────────────────────────────────────────────────────

test("capability: a loader whose name is a `const` bound to a literal in its scope loads that module (hono src/utils/color.ts:48)", () => {
  const color = lines(
    "export async function getColorEnabledAsync(): Promise<boolean> {",
    "  const { navigator } = globalThis as any",
    "  // Avoid analysis of cloudflare scheme by bundlers",
    "  const cfWorkers = 'cloudflare:workers'",
    "",
    "  const isNoColor =",
    "    navigator !== undefined && navigator.userAgent === 'Cloudflare-Workers'",
    "      ? await (async () => {",
    "          try {",
    "            return 'NO_COLOR' in ((await import(cfWorkers)).env ?? {})",
    "          } catch {",
    "            return false",
    "          }",
    "        })()",
    "      : true",
    "  return !isNoColor",
    "}",
  );
  const r = delivery({
    "src/utils/color.ts": color,
    // hono benchmarks/fetch/bench.mts:27, classified TRUE: the name comes from the environment.
    "benchmarks/bench.mts": lines(
      "import { pathToFileURL } from 'node:url'",
      "const src = process.env.HONO_SRC ?? '../../src'",
      "const makeApp = async (src: string): Promise<any> => {",
      "  const { Hono } = await import(pathToFileURL(`${src}/index.ts`).href)",
      "  return new Hono()",
      "}",
      "const app = await makeApp(src)",
    ),
    // express lib/view.js:81, classified TRUE: the name is computed from the application's settings.
    "lib/view.js": lines(
      "function View(name) { this.ext = name.slice(name.lastIndexOf('.')) }",
      "View.prototype.load = function load() {",
      "  var mod = this.ext.slice(1)",
      "  return require(mod).__express",
      "}",
      "module.exports = View",
    ),
    "src/let.ts": "let name = 'cloudflare:workers'\nexport const load = () => import(name)\n",
  });
  assert.deepEqual(at(r, "src/utils/color.ts"), []);
  assert.deepEqual(at(r, "benchmarks/bench.mts"), ["capability/computed-import:4"]);
  assert.deepEqual(at(r, "lib/view.js"), ["capability/computed-import:4"]);
  assert.deepEqual(at(r, "src/let.ts"), ["capability/computed-import:2"], "a `let` may be reassigned: not read as a literal");
  // The module it loads is judged like a literal one: in a declared core, the boundary reads it.
  const inCore = delivery({ "runward/territory.md": core("src/utils/**"), "src/utils/color.ts": color });
  assert.deepEqual(inCore.findings.map((f) => `${f.family}/${f.check}:${f.line}`), ["boundary/core-import-package:10"]);
  assert.match(inCore.findings[0].message, /dynamic import of the package `cloudflare:workers`/);
});

test("capability: `require(param)` of a local function that is not exported and is only called with a literal (express examples/content-negotiation/index.js:34)", () => {
  const negotiation = (tail) => lines(
    "'use strict'",
    "var express = require('../../');",
    "var app = module.exports = express();",
    "function format(path) {",
    "  var obj = require(path);",
    "  return function(req, res){",
    "    res.format(obj);",
    "  };",
    "}",
    "app.get('/users', format('./users'));",
    ...tail,
  );
  const r = delivery({
    "examples/content-negotiation/index.js": negotiation([]),
    "examples/exported/index.js": negotiation(["exports.format = format;"]),
    "examples/computed/index.js": negotiation(["app.get('/other', format(process.argv[2]));"]),
    // express examples/mvc/lib/boot.js:18, classified TRUE: every directory found at run time.
    "examples/mvc/lib/boot.js": lines(
      "var fs = require('node:fs')",
      "var path = require('node:path')",
      "module.exports = function(parent, options){",
      "  var dir = path.join(__dirname, '..', 'controllers');",
      "  fs.readdirSync(dir).forEach(function(name){",
      "    var file = path.join(dir, name)",
      "    var obj = require(file);",
      "    parent.use(obj);",
      "  });",
      "};",
    ),
  });
  assert.deepEqual(at(r, "examples/content-negotiation/index.js"), []);
  assert.deepEqual(at(r, "examples/exported/index.js"), ["capability/computed-import:5"], "an exported function is called from elsewhere");
  assert.deepEqual(at(r, "examples/computed/index.js"), ["capability/computed-import:5"], "one call passes a value computed at run time");
  assert.deepEqual(at(r, "examples/mvc/lib/boot.js"), ["capability/computed-import:7"]);
});

test("capability: a network module bound only for its constants is a built-in import of the core, never the network (express lib/request.js:17, lib/utils.js:15; fastify fastify.js:6, lib/error-handler.js:3)", () => {
  const r = delivery({
    "runward/territory.md": core("lib/**", "fastify.js"),
    "package.json": JSON.stringify({ dependencies: { finalhandler: "1.0.0" } }),
    "lib/request.js": lines(
      "var isIP = require('node:net').isIP;",
      "var http = require('node:http');",
      "var req = Object.create(http.IncomingMessage.prototype)",
      "module.exports = req",
      "req.subdomains = function (hostname) { return !isIP(hostname) }",
    ),
    "lib/utils.js": lines(
      "var { METHODS } = require('node:http');",
      "exports.methods = METHODS.map((method) => method.toLowerCase());",
    ),
    "fastify.js": lines(
      "const http = require('node:http')",
      "function route (method, code) {",
      "  if (typeof method !== 'string' || http.METHODS.indexOf(method) === -1) throw new Error(method)",
      "  return http.STATUS_CODES[code]",
      "}",
      "module.exports = route",
    ),
    "lib/error-handler.js": lines(
      "const statusCodes = require('node:http').STATUS_CODES",
      "module.exports = (statusCode) => ({ error: statusCodes[statusCode + ''] })",
    ),
    "lib/types.ts": "import type { IncomingMessage } from 'node:http'\nexport type Req = IncomingMessage\n",
    // Classified TRUE: a server, a DNS lookup, the environment, a dependency package.
    "lib/application.js": lines(
      "var finalhandler = require('finalhandler');",
      "var http = require('node:http');",
      "exports.listen = function listen() {",
      "  var server = http.createServer(this);",
      "  return server.listen.apply(server, arguments);",
      "};",
      "exports.defaultConfiguration = function () {",
      "  var env = process.env.NODE_ENV || 'development';",
      "  return finalhandler && env;",
      "};",
    ),
    "lib/server.js": lines(
      "const dns = require('node:dns')",
      "module.exports = (host, cb) => dns.lookup(host, cb)",
    ),
    "lib/passes-it-on.js": "const http = require('node:http')\nmodule.exports = { http }\n",
  });
  assert.deepEqual(at(r, "lib/request.js"), ["boundary/core-import-builtin:1", "capability/network:2"],
    "isIP is a string predicate; http.IncomingMessage is the connection");
  assert.deepEqual(at(r, "lib/utils.js"), ["boundary/core-import-builtin:1"]);
  assert.deepEqual(at(r, "fastify.js"), ["boundary/core-import-builtin:1"]);
  assert.deepEqual(at(r, "lib/error-handler.js"), ["boundary/core-import-builtin:1"]);
  assert.deepEqual(at(r, "lib/types.ts"), ["boundary/core-import-builtin:1"], "a type-only import binds no value");
  assert.match(r.findings.find((f) => f.path === "lib/utils.js").message, /require call of the Node\.js built-in `node:http` in the declared domain core/);
  assert.deepEqual(at(r, "lib/application.js"), ["boundary/core-import-package:1", "capability/network:2", "capability/environment:8"]);
  assert.deepEqual(at(r, "lib/server.js"), ["capability/network:1"]);
  assert.deepEqual(at(r, "lib/passes-it-on.js"), ["capability/network:1"], "a module handed on whole is judged by what it can reach");
});

// ── secret ────────────────────────────────────────────────────────────────────────────────────────

test("secret: a PEM private key block needs a body; armour around an interpolation is none (hono src/utils/jwt/jwt.test.ts:1561 and :1794)", () => {
  const begin = `-----BEGIN ${"PRIVATE"} KEY-----`;
  const end = `-----END ${"PRIVATE"} KEY-----`;
  const rsaBegin = `-----BEGIN ${"RSA PRIVATE"} KEY-----`;
  const rsaEnd = `-----END ${"RSA PRIVATE"} KEY-----`;
  const body = (n) => `MII${"A".repeat(61)}`.repeat(n).slice(0, 64 * n);
  const r = delivery({
    "src/jwt.test.ts": lines(
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { encodeBase64 } from './encode'",
      "test('imports a generated key', async () => {",
      "  const exported = await crypto.subtle.exportKey('pkcs8', key)",
      `  const pem = \`${begin}\\n\${encodeBase64(exported)}\\n${end}\``,
      "  const base64Key = encodeBase64(exported)",
      `  const privateKey = \`${begin}\\n\${base64Key}\\n${end}\``,
      "  assert.ok(pem && privateKey)",
      "})",
    ),
    "src/encode.ts": "export const encodeBase64 = (b: ArrayBuffer) => String(b)\n",
    // A parser that names the armour, and a documentation placeholder: no key either.
    "src/pem.ts": lines(`export const isKey = (line: string) => line === '${rsaBegin}'`, `export const doc = '${begin}\\n...\\n${end}'`),
    // A key, written the ways a repository holds one: JSON with escaped newlines, concatenated strings,
    // a template literal, and a block whose END line was lost.
    "config/service-account.json": JSON.stringify({ private_key: `${begin}\n${body(3)}\n${end}\n` }, null, 2),
    "src/key.js": lines(`module.exports = '${rsaBegin}\\n' +`, `  '${body(1)}\\n' +`, `  '${body(1)}\\n' +`, `  '${rsaEnd}'`),
    "src/key-template.ts": lines(`export const key = \`${begin}`, body(2), `${end}\``),
    "src/key-truncated.ts": lines(`export const key = \`${rsaBegin}`, body(2), "`"),
  });
  const found = r.findings.filter((f) => f.check === "secret-private-key-block").map((f) => `${f.path}:${f.line}`);
  assert.deepEqual(found, ["config/service-account.json:2", "src/key-template.ts:1", "src/key-truncated.ts:1", "src/key.js:1"]);
  for (const f of r.findings) assert.ok(!f.message.includes("AAAA"), "the value is never printed");
});

// ── symbol ────────────────────────────────────────────────────────────────────────────────────────

test("symbol: an empty constant the code reads as a value is a sentinel, not a placeholder (hono src/router/reg-exp-router/matcher.ts:9)", () => {
  const r = delivery({
    "runward/architecture.md": cites(
      "src/router/matcher.ts#emptyParam", "src/router/empty.ts#noValues",
      "src/core/guard.ts#guardFields", "src/core/guard.ts#parseDeadline",
    ),
    "src/router/matcher.ts": lines(
      "export const emptyParam: string[] = []",
      "export function match(path: string): [string[], string[]] {",
      "  const m = path.match(/^\\/(\\w+)$/)",
      "  if (!m) {",
      "    return [[], emptyParam]",
      "  }",
      "  return [[], [...m]]",
      "}",
    ),
    // Read only by the module that imports it: a sentinel too.
    "src/router/empty.ts": "// the shared empty set of values\nexport const noValues = {}\n",
    "src/router/use.ts": "import { noValues } from './empty'\nexport const valuesOf = (v?: object) => v ?? noValues\n",
    // The bench's c3b: every cited symbol a constant, and nothing reads it.
    "src/core/guard.ts": "// stub\nexport const guardFields = 0;\nexport const parseDeadline = [];\n",
  });
  assert.deepEqual(r.findings.map((f) => `${f.path}:${f.check}:${f.line}`), [
    "src/core/guard.ts:symbol-placeholder-constant:2", "src/core/guard.ts:symbol-placeholder-constant:3",
  ]);
  const h = r.hypotheses.filter((x) => x.family === "symbol").map((x) => `${x.path}:${x.check}:${x.line}`);
  assert.deepEqual(h, ["src/router/empty.ts:symbol-sentinel-constant:2", "src/router/matcher.ts:symbol-sentinel-constant:1"],
    "what the reading cannot settle is said, and never counted");
});

test("symbol: a cited name resolves to the module's declaration, never to a block's local of the same name (fastify lib/reply.js:606)", () => {
  const r = delivery({
    "runward/architecture.md": cites("lib/reply.js#header", "lib/other.js#header"),
    "lib/reply.js": lines(
      "'use strict'",
      "function Reply () {}",
      "Reply.prototype.header = function (key, value = '') {",
      "  this[key] = value",
      "  return this",
      "}",
      "function onSendEnd (reply, payload) {",
      "  if (reply.trailers !== null) {",
      "    let header = ''",
      "    for (const name of Object.keys(reply.trailers)) {",
      "      header += ' '",
      "      header += name",
      "    }",
      "    reply.header('Trailer', header.trim())",
      "  }",
      "}",
      "module.exports = { Reply, onSendEnd }",
    ),
    "lib/other.js": "'use strict'\nconst header = ''\nmodule.exports = {}\n",
  });
  assert.deepEqual(r.findings.map((f) => `${f.path}:${f.check}:${f.line}`), ["lib/other.js:symbol-placeholder-constant:2"]);
});
