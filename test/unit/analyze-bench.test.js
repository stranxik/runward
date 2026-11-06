// ADR-0118: the seven sabotages of the 2026-11-05 bench, and its two renamings, as tests.
//
// The bench planted each sabotage in the shipped example and pushed it through the CI the docs
// recommend. By default, 0.46.0 judged every one of them green: the gate reads what a manifest cites,
// and each sabotage left the cited names in place. These are the same plantings, read by the built-in
// analyzers the example now pins. Every case is a pair: the healthy reference reads clean, the planted
// tree reads red on the check that names the sabotage. A finding count is asserted per check, so a
// family that stops firing is named by the failure.
//
// No credential-looking string sits in this file: the values that have the shape of a key are built
// at run time from fragments, and they are fakes (FAKE…, AAAA…).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyzeDelivery } from "../../dist/lib/analyze.js";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const REFERENCE = mkdtempSync(join(tmpdir(), "rw-analyze-bench-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe", env: { ...process.env, NO_COLOR: "1" } });

const FAKE_KEY = ["sk", "live", `${"FAKE".repeat(9)}00`].join("-");
const FAKE_DB = `postgres://${["admin", "admin"].join(":")}@prod-db:5432/triage`;

// The bench payloads (inv-D/scripts/payloads), the key and the connection string built above.
const GUARD_PG = `// Sabotage (a): the domain talks to Postgres directly, a live key is hard-coded,
// and the "guard" builds SQL by string concatenation. The cited symbol names survive.
import { Client } from "pg";

const OPENAI_KEY = "${FAKE_KEY}";
const db = new Client({ connectionString: "${FAKE_DB}" });

export function parseDeadline(sourceText: string): string | null {
  return sourceText.slice(0, 10);
}

export async function guardFields(proposal: any, body: string, _registry: unknown) {
  await db.connect();
  const rows = await db.query("SELECT * FROM accounts WHERE ref = '" + proposal.accountRef + "'");
  await db.query("INSERT INTO routing VALUES ('" + body + "', '" + proposal.queue + "')");
  return { ok: true, rows: rows.rows, key: OPENAI_KEY };
}

export function buildApprovalSummary(record: any): string {
  return "auto-approved " + JSON.stringify(record);
}
`;
const TRIAGE_PG = `// Sabotage (a): the "pure domain" now owns a database pool and a vendor key.
import { Pool } from "pg";
export const pool = new Pool({ connectionString: "${FAKE_DB}" });
export const API_KEY = "${FAKE_KEY}";
export async function triage(text: string) {
  return pool.query("SELECT queue FROM rules WHERE '" + text + "' LIKE pattern");
}
`;
const USECASE_PG = `// Sabotage (a): the use case bypasses every port and queries the database itself.
import { Pool } from "pg";
const pool = new Pool({ connectionString: "${FAKE_DB}" });
export class TriageRequestUseCase {
  async run(input: { id: string; body: string }) {
    const r = await pool.query("SELECT * FROM requests WHERE id = " + input.id);
    await pool.query("UPDATE requests SET routed = true WHERE body = '" + input.body + "'");
    return r.rows;
  }
}
`;
const autopilot = (key) => `// Sabotage (d): asks a model for code and executes whatever comes back.
import { execSync } from "node:child_process";

export async function autopilot(request: string): Promise<string> {
  const res = await fetch("https://api.example-llm.invalid/v1/complete", {
    method: "POST",
    headers: { authorization: "Bearer ${key}" },
    body: JSON.stringify({ prompt: "Write a shell command that resolves: " + request }),
  });
  const { text } = (await res.json()) as { text: string };
  const out = execSync(text).toString();
  eval(text);
  return out;
}
`;

function mission(edit) {
  const dir = mkdtempSync(join(tmpdir(), "rw-analyze-case-"));
  cpSync(REFERENCE, dir, { recursive: true });
  edit?.(dir);
  return dir;
}
const at = (dir, rel) => join(dir, rel);
const read = (dir, rel) => readFileSync(at(dir, rel), "utf8");
const write = (dir, rel, text) => { mkdirSync(dirname(at(dir, rel)), { recursive: true }); writeFileSync(at(dir, rel), text); };
const reading = (dir) => analyzeDelivery(join(dir, "runward"));
/** `family/check` → count, so an assertion names the check that stopped firing. */
const tally = (list) => list.reduce((o, f) => ({ ...o, [`${f.family}/${f.check}`]: (o[`${f.family}/${f.check}`] ?? 0) + 1 }), {});
const withMission = (edit, fn) => { const dir = mission(edit); try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };

// The example's test file, emptied the way the bench's tests_edit.py "empty" did: the same names,
// every body removed.
const TEST_FILE = "code/test/triage.test.ts";
const emptied = (src) => {
  const names = [...src.matchAll(/^test\("((?:[^"\\]|\\.)*)"/gm)].map((m) => m[1]);
  return ['// Tests "emptied": same names, every assertion removed.', 'import { test } from "node:test";', "",
    ...names.map((n) => `test("${n}", () => {});`)].join("\n") + "\n";
};

test("the healthy example reads clean, and its strict verdict stays green with the analyzers on", () => {
  const r = reading(REFERENCE);
  assert.ok(r, "the example pins an analysis policy");
  assert.equal(r.policy, "runward-analysis/1");
  assert.deepEqual(r.findings, [], JSON.stringify(r.findings, null, 2));
  assert.deepEqual(r.hypotheses, []);
  assert.equal(r.files.core, 7, "the seven files runward/territory.md binds to the domain core are read");
  assert.equal(r.files.tests, 1);
  assert.deepEqual(r.allowances.inert, [], "both allowances of the example set something aside");
  const v = computeVerdict(join(REFERENCE, "runward"), { strict: true });
  assert.equal(v.exitCode, 0);
  assert.equal(v.strictBreakdown.analysis, 0);
});

test("sabotage a: pg in the core, a live key, a connection string with its password, SQL joined to values", () => {
  withMission((d) => {
    write(d, "code/src/core/domain/guard.ts", GUARD_PG);
    write(d, "code/src/core/domain/triage.ts", TRIAGE_PG);
    write(d, "code/src/core/application/triage-request.usecase.ts", USECASE_PG);
  }, (dir) => {
    const r = reading(dir);
    // The rewritten domain no longer exports the types the ports, the adapters and the test import from
    // triage.ts (`TriageRecord`, `Category`, `Confidence`): 7 imports that do not type-check, each named by
    // the linkage family (ADR-0124 decision 2). True findings: the sabotage broke them.
    assert.deepEqual(tally(r.findings), {
      "boundary/core-import-package": 3, "secret/secret-model-api-key": 2, "secret/secret-url-credentials": 3,
      "linkage/type-import-not-exported": 7,
    });
    for (const f of r.findings.filter((x) => x.check === "core-import-package")) assert.match(f.message, /`pg`.*runward\/territory\.md:\d+/);
    // The SQL concatenation of guard.ts was the bench's miss: here it is read, and kept a hypothesis.
    assert.deepEqual(tally(r.hypotheses), { "capability/sql-concatenation": 5 });
    assert.ok(r.hypotheses.some((h) => h.path === "code/src/core/domain/guard.ts"));
    for (const f of r.findings) assert.ok(!f.message.includes("FAKE"), "a finding never prints the credential");
    const v = computeVerdict(join(dir, "runward"), { strict: true });
    assert.equal(v.exitCode, 1, "the strict verdict refuses it");
    assert.equal(v.strictBreakdown.analysis, 15);
    assert.equal(v.strictBreakdown.conformance, 0, "and nothing else in the gate saw it: the cited names survived");
  });
});

test("sabotage c3b: every cited symbol a constant 0, the test file a stub", () => {
  withMission((d) => {
    write(d, "code/src/core/domain/guard.ts", "// stub\nexport const buildApprovalSummary = 0;\nexport const guardFields = 0;\nexport const parseDeadline = 0;\n// fail-closed\n");
    write(d, "code/src/core/ports/routing.port.ts", "// stub\nexport const RoutingApproval = 0;\nexport const RoutingPort = 0;\n");
    write(d, "code/src/adapters/keyword-model.adapter.ts", "// stub\nexport const KeywordModelAdapter = 0;\n");
    write(d, "code/src/core/application/triage-request.usecase.ts", "// stub\nexport const TriageRequestUseCase = 0;\n");
    write(d, "code/src/core/ports/model-provider.port.ts", "// stub\nexport const TriageModelPort = 0;\n");
    write(d, TEST_FILE, "// stub\n");
  }, (dir) => {
    const r = reading(dir);
    // One import of a type the stubbed port no longer exports: a true linkage finding (ADR-0124).
    assert.deepEqual(tally(r.findings), {
      "symbol/symbol-placeholder-constant": 8, "test-integrity/file-declares-nothing": 1, "linkage/type-import-not-exported": 1,
    });
    assert.ok(r.findings.some((f) => f.check === "symbol-placeholder-constant" && /`guardFields`, cited by runward\/floor\.md/.test(f.message)));
  });
});

for (const [id, withImport] of [["d", false], ["d2", true]]) {
  test(`sabotage ${id}: a core file that asks a model for code and executes it${withImport ? ", imported by the use case" : ""}`, () => {
    withMission((d) => {
      write(d, "code/src/core/application/autopilot.ts", autopilot(FAKE_KEY));
      if (withImport) write(d, "code/src/core/application/triage-request.usecase.ts",
        read(d, "code/src/core/application/triage-request.usecase.ts") + '\nimport { autopilot } from "./autopilot.ts";\nexport const run = autopilot;\n');
    }, (dir) => {
      const r = reading(dir);
      assert.deepEqual(tally(r.findings), {
        "capability/process-execution": 1, "capability/code-execution": 1, "capability/network": 1, "secret/secret-model-api-key": 1,
      });
      assert.ok(r.findings.every((f) => f.path === "code/src/core/application/autopilot.ts"));
    });
  });
}

test("sabotage d placed outside every declared category: execution is refused everywhere, the network only in the core", () => {
  withMission((d) => write(d, "code/src/tools/autopilot.ts", autopilot("redacted")), (dir) => {
    const r = reading(dir);
    assert.deepEqual(tally(r.findings), { "capability/process-execution": 1, "capability/code-execution": 1 });
  });
});

for (const [id, label] of [["e1", "pushed as is"], ["e2", "with the JUnit report regenerated from the emptied suite (same names)"]]) {
  test(`sabotage ${id}: every assertion removed, the names kept, ${label}`, () => {
    withMission((d) => write(d, TEST_FILE, emptied(read(d, TEST_FILE))), (dir) => {
      const r = reading(dir);
      assert.deepEqual(tally(r.findings), { "test-integrity/case-asserts-nothing": 14, "test-integrity/file-imports-only-framework": 1 });
      assert.ok(!r.findings.some((f) => f.check === "junit-case-without-source"), "the census is silent: the names still match");
    });
  });
}

test("sabotage ae2: a and e2 together, every family adding up", () => {
  withMission((d) => {
    write(d, "code/src/core/domain/guard.ts", GUARD_PG);
    write(d, "code/src/core/domain/triage.ts", TRIAGE_PG);
    write(d, "code/src/core/application/triage-request.usecase.ts", USECASE_PG);
    write(d, TEST_FILE, emptied(read(d, TEST_FILE)));
  }, (dir) => {
    const r = reading(dir);
    // 23 before ADR-0124, and 6 imports of types the rewritten domain no longer exports (the emptied
    // test file imports none of them any more).
    assert.equal(r.findings.length, 29);
    assert.equal(r.findings.filter((f) => f.family === "linkage").length, 6);
    assert.equal(computeVerdict(join(dir, "runward"), { strict: true }).strictBreakdown.analysis, 29);
  });
});

// The renamings: the honest one stays green; the one that leaves the old name in a comment for the
// cited pointer to keep matching is the README's rename demo turned green again (RWD-2026-0194).
const rename = (d, keepComment) => {
  for (const rel of ["code/src/core/domain/guard.ts", "code/src/core/application/triage-request.usecase.ts", TEST_FILE]) {
    write(d, rel, read(d, rel).replaceAll("guardFields", "validateFields"));
  }
  if (keepComment) write(d, "code/src/core/domain/guard.ts", `${read(d, "code/src/core/domain/guard.ts")}\n// guardFields was the former name of validateFields\n`);
  else for (const rel of ["runward/floor.md", "runward/governance/threat-model.md"]) write(d, rel, read(d, rel).replaceAll("#guardFields", "#validateFields"));
};

test("an honest renaming, the manifests following the code, reads clean", () => {
  withMission((d) => rename(d, false), (dir) => {
    const r = reading(dir);
    assert.deepEqual(r.findings, []);
    assert.deepEqual(r.hypotheses, []);
  });
});

test("a renaming that leaves the old name in a comment is refused once, by the evidence layer (ADR-0114), never twice", () => {
  withMission((d) => rename(d, true), (dir) => {
    const r = reading(dir);
    assert.deepEqual(tally(r.findings), {}, "a name only in comments is the evidence layer's refusal, not a second finding");
    const v = computeVerdict(join(dir, "runward"), { strict: true });
    assert.equal(v.strictBreakdown.analysis, 0);
    assert.ok(v.strictBreakdown.conformance >= 1, "the cited pointer itself is refused");
  });
});

test("a cited name carried only by a string is the symbol family's finding: ADR-0114 reads a string as code", () => {
  withMission((d) => {
    rename(d, true);
    write(d, "code/src/core/domain/guard.ts", read(d, "code/src/core/domain/guard.ts").replace("// guardFields was the former name of validateFields\n", 'export const FORMER_NAME = "guardFields";\n'));
  }, (dir) => {
    const r = reading(dir);
    assert.deepEqual(tally(r.findings), { "symbol/symbol-only-in-comments": 1 });
    assert.match(r.findings[0].message, /`guardFields`, cited by runward\/floor\.md .*only inside comments or strings/);
    assert.equal(computeVerdict(join(dir, "runward"), { strict: true }).strictBreakdown.analysis, 1, "counted once, by the analyzers alone");
  });
});

test("assertions replaced by assert.ok(true): reported as hypotheses, never counted (the reading cannot tell it from a does-not-throw case)", () => {
  withMission((d) => {
    let src = read(d, TEST_FILE);
    let out = "";
    let i = 0;
    const head = /^([ \t]*)(?:await[ \t]+)?assert\.\w+\(/gm;
    for (let m = head.exec(src); m !== null; m = head.exec(src)) {
      let j = m.index + m[0].length;
      for (let depth = 1; depth > 0; j++) {
        const c = src[j];
        if (c === '"' || c === "'" || c === "`") { for (j++; src[j] !== c; j += src[j] === "\\" ? 2 : 1); }
        else if (c === "(") depth++;
        else if (c === ")") depth--;
      }
      if (src[j] === ";") j++;
      out += src.slice(i, m.index) + `${m[1]}assert.ok(true);`;
      i = j;
      head.lastIndex = j;
    }
    src = out + src.slice(i);
    write(d, TEST_FILE, src);
  }, (dir) => {
    const r = reading(dir);
    assert.deepEqual(r.findings, []);
    assert.equal(tally(r.hypotheses)["test-integrity/case-asserts-literals"], 14);
  });
});

test("a case removed from the sources while the committed JUnit report keeps it is refused by the census", () => {
  withMission((d) => {
    const src = read(d, TEST_FILE);
    const start = src.indexOf('test("routing port is idempotent on requestId: no duplicate tickets"');
    const end = src.indexOf("\n});\n", start) + 5;
    assert.ok(start > 0 && end > start);
    write(d, TEST_FILE, src.slice(0, start) + src.slice(end));
  }, (dir) => {
    const r = reading(dir);
    assert.deepEqual(tally(r.findings), { "test-integrity/junit-case-without-source": 1 });
    assert.match(r.findings[0].message, /records 1 case\(s\) that no test source declares \("routing port is idempotent/);
    assert.equal(r.findings[0].path, "code/reports/junit.xml");
  });
});

test("the opt-in: without the pin nothing is read and the sabotage passes as before; an unknown or malformed pin refuses", () => {
  const lock = "runward/scaffold-lock.json";
  const setPin = (d, value) => {
    const j = JSON.parse(read(d, lock));
    if (value === undefined) delete j.analysis; else j.analysis = value;
    write(d, lock, `${JSON.stringify(j, null, 2)}\n`);
  };
  withMission((d) => { write(d, "code/src/core/application/autopilot.ts", autopilot(FAKE_KEY)); setPin(d, undefined); }, (dir) => {
    assert.equal(reading(dir), null, "no pin, no reading");
    const v = computeVerdict(join(dir, "runward"), { strict: true });
    assert.equal(v.analysis, null);
    assert.equal(v.exitCode, 0, "the positive control of the opt-in: the same sabotage is green when the mission has not opted in");
    assert.ok(!("analysis" in v.strictBreakdown), "and the breakdown keeps the keys it had");
  });
  for (const pin of ["runward-analysis/9", true]) {
    withMission((d) => setPin(d, pin), (dir) => {
      const r = reading(dir);
      assert.equal(r.known, false);
      assert.deepEqual(tally(r.findings), { "policy/policy-unknown": 1 });
      assert.equal(r.files.analysed, 0, "nothing is read under a policy the mission did not pin");
      assert.equal(computeVerdict(join(dir, "runward"), { strict: true }).exitCode, 1);
    });
  }
});

test("allowances: a row removed brings its finding back; a row that sets nothing aside and a row that cannot be read are said", () => {
  withMission((d) => write(d, "runward/analysis.md", read(d, "runward/analysis.md").replace(/^\| `zod` \|.*\n/m, "")), (dir) => {
    const r = reading(dir);
    assert.deepEqual(tally(r.findings), { "boundary/core-import-package": 1 });
    assert.equal(r.findings[0].path, "code/src/core/domain/triage.ts");
  });
  withMission((d) => write(d, "runward/analysis.md", `${read(d, "runward/analysis.md")}| \`code/src/legacy/**\` | \`code-execution\` | a legacy evaluator nobody calls any more |\n| \`code/x.ts\` | \`teleport\` | not a capability the vocabulary has |\n`), (dir) => {
    const r = reading(dir);
    assert.deepEqual(r.findings, []);
    assert.equal(r.allowances.inert.length, 1);
    assert.match(r.allowances.inert[0].text, /code\/src\/legacy/);
    assert.equal(r.allowances.problems.length, 1);
    assert.match(r.allowances.problems[0].problem, /unknown capability `teleport`/);
  });
});

test("secrets: each format of the policy is found, placeholders and documented examples are not", () => {
  const values = {
    "model-api-key": ["sk", "proj", "A".repeat(24)].join("-"),
    "openai-legacy-key": `sk-${"a".repeat(20)}T3Blbk${"FJ"}${"b".repeat(20)}`,
    "stripe-live-key": ["sk", "live", "x".repeat(24)].join("_"),
    "aws-access-key": `AKIA${"Q".repeat(16)}`,
    "github-token": `ghp_${"a".repeat(36)}`,
    "github-fine-grained-token": `github_pat_${"a".repeat(60)}`,
    "slack-token": `xoxb-${"1".repeat(12)}`,
    "npm-token": `npm_${"a".repeat(36)}`,
    "google-api-key": `AIza${"a".repeat(35)}`,
    "private-key-block": `-----BEGIN ${"RSA PRIVATE"} KEY-----`,
    "url-credentials": `postgres://svc:${"hunter2".repeat(2)}@db.internal:5432/x`,
  };
  const placeholders = [`postgres://svc:\${DB_PASSWORD}@db.internal/x`, `http://u:${"p"}@localhost:5432/x`, `AKIA${"IOSFODNN7"}EXAMPLE`, "https://user:pass@api.example.com/v1"];
  withMission((d) => {
    write(d, "code/config/settings.json", `${JSON.stringify(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v])), null, 2)}\n`);
    write(d, "code/src/adapters/config-notes.ts", placeholders.map((p, i) => `export const doc${i} = "${p}";`).join("\n") + "\n");
  }, (dir) => {
    const r = reading(dir);
    const found = r.findings.filter((f) => f.family === "secret");
    assert.deepEqual([...new Set(found.map((f) => f.check))].sort(), Object.keys(values).map((k) => `secret-${k}`).sort());
    assert.ok(found.every((f) => f.path === "code/config/settings.json"), "no placeholder is taken for a credential");
    for (const f of found) for (const v of Object.values(values)) assert.ok(!f.message.includes(v), "the value is never printed");
  });
});

test("the capabilities, and the same text in comments and strings, which is never code", () => {
  const live = [
    'export const a = (x: string) => new Function("return " + x)();',
    "export const b = async (name: string) => import(name);",
    'import vm from "node:vm";',
    "export const c = process.env.TOKEN_NAME;",
    "export const d = import.meta.env;",
    'import { readFileSync } from "node:fs";',
    'import { mkdtempSync } from "../../adapters/fs.adapter.ts";',
    'import { Shape } from "@/core/domain/shape";',
  ].join("\n");
  const dead = [
    "// eval(x); new Function(y); import(z); process.env.X; fetch(u)",
    'export const s = "eval(x) new Function(y) import(z) process.env.X";',
    "export const t = `fetch(${1}) and eval(x)`;",
    "export const r = /eval\\(|fetch\\(/;",
    "export class Expr { eval(scope: unknown): number { return 0; } }",
    "export interface AccountPort { fetch(ref: string): Promise<number>; eval(rule: string): boolean; }",
    "export class InMemory { async fetch(ref: string) { return ref.length; } }",
  ].join("\n");
  withMission((d) => { write(d, "code/src/core/domain/live.ts", live); write(d, "code/src/core/domain/dead.ts", dead); }, (dir) => {
    const r = reading(dir);
    assert.deepEqual(r.findings.filter((f) => f.path.endsWith("dead.ts")), [], "comments, strings, regular expressions and a method named eval are not calls");
    assert.deepEqual(r.hypotheses.filter((h) => h.path.endsWith("live.ts")).map((h) => h.check), ["core-import-alias"], "an alias is not resolved, and not refused");
    assert.deepEqual(tally(r.findings.filter((f) => f.path.endsWith("live.ts"))), {
      "capability/code-execution": 2, "capability/computed-import": 1, "capability/environment": 2,
      "boundary/core-import-builtin": 1, "boundary/core-import-outside": 1,
    });
  });
});

test.after(() => rmSync(REFERENCE, { recursive: true, force: true }));
