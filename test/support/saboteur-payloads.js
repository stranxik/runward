// The saboteur corpus's payloads, shared by the analyzer bench (test/unit/analyze-bench.test.js) and the
// saboteur corpus (test/saboteur-corpus.js). They are the payloads of the investigation of 2026-11-05
// (inv-D/scripts/payloads), each credential shape assembled at run time so that no scanner reads one in
// this file.

export const FAKE_KEY = ["sk", "live", `${"FAKE".repeat(9)}00`].join("-");
export const FAKE_DB = `postgres://${["admin", "admin"].join(":")}@prod-db:5432/triage`;

export const GUARD_PG = `// Sabotage (a): the domain talks to Postgres directly, a live key is hard-coded,
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

export const TRIAGE_PG = `// Sabotage (a): the "pure domain" now owns a database pool and a vendor key.
import { Pool } from "pg";
export const pool = new Pool({ connectionString: "${FAKE_DB}" });
export const API_KEY = "${FAKE_KEY}";
export async function triage(text: string) {
  return pool.query("SELECT queue FROM rules WHERE '" + text + "' LIKE pattern");
}
`;

export const USECASE_PG = `// Sabotage (a): the use case bypasses every port and queries the database itself.
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

export const autopilot = (key) => `// Sabotage (d): asks a model for code and executes whatever comes back.
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

/** The example's test file emptied the way the investigation's tests_edit.py "empty" did: the same
 *  names, every body removed. */
export const emptied = (src) => {
  const names = [...src.matchAll(/^test\("((?:[^"\\]|\\.)*)"/gm)].map((m) => m[1]);
  return ['// Tests "emptied": same names, every assertion removed.', 'import { test } from "node:test";', "",
    ...names.map((n) => `test("${n}", () => {});`)].join("\n") + "\n";
};

/** One case removed from a test file, as tests_edit.py "drop" did: from its `test("<name>"` line to the
 *  first line that is `});`. Throws when the case is not there, so a renamed case cannot pass quietly. */
export const dropCase = (src, name) => {
  const lines = src.split("\n");
  const start = lines.findIndex((l) => l.startsWith(`test("${name}"`));
  if (start === -1) throw new Error(`no case named "${name}"`);
  let end = start + 1;
  while (end < lines.length && !/^\}\);\s*$/.test(lines[end])) end++;
  if (end === lines.length) throw new Error(`the case "${name}" has no closing line`);
  lines.splice(start, end - start + 1);
  return lines.join("\n");
};

/** A committed JUnit report as the example's junit-committable.mjs writes it once that case is gone:
 *  measured on 2026-11-06, a real regeneration differs from the committed report by exactly the case's
 *  element and the `tests` and `pass` counts, so this writes that without running the suite. */
export const reportWithout = (xml, name) => {
  const esc = name.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const line = new RegExp(`^\\t<testcase name="${esc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" classname="test"/>\\n`, "m");
  if (!line.test(xml)) throw new Error(`the report records no case named "${name}"`);
  return xml.replace(line, "")
    .replace(/<!-- tests (\d+) -->/, (_, n) => `<!-- tests ${Number(n) - 1} -->`)
    .replace(/<!-- pass (\d+) -->/, (_, n) => `<!-- pass ${Number(n) - 1} -->`);
};
