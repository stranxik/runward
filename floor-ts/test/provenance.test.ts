// Prompt provenance. Every model call leaves a fingerprint in the run
// journal: request id, SHA-256 of the prompt actually sent, model identity,
// tier, timestamp, and the recorded output. Audit re-reads the recorded
// output — the call is never replayed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createContainer } from "../src/infrastructure/container.ts";
import { InMemoryRunRepository } from "../src/adapters/persistence/in-memory-run.repo.ts";
import { CapturingLogger } from "../src/infrastructure/observability/logger.ts";

const fixedClock = { nowIso: () => "2026-01-01T00:00:00.000Z" };

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function build(requestId: string) {
  const repo = new InMemoryRunRepository();
  const c = createContainer({
    logger: new CapturingLogger(),
    repo,
    clock: fixedClock,
    newRequestId: () => requestId,
  });
  return { c, repo };
}

test("provenance: one fingerprint per model call, with every field", async () => {
  const { c } = build("req_prov_1");
  await c.useCase.handle({ prompt: "one two three" }, "viewer");

  const prov = await c.useCase.getProvenance("req_prov_1");
  // The floor makes exactly one model call per run: exactly one entry.
  assert.equal(prov.length, 1);
  const entry = prov[0]!;
  assert.equal(entry.requestId, "req_prov_1");
  assert.equal(entry.model, "echo"); // adapter-reported model identity
  assert.equal(entry.tier, "fast");
  assert.equal(entry.at, "2026-01-01T00:00:00.000Z");
  assert.match(entry.promptSha256, /^[0-9a-f]{64}$/);
  assert.ok(entry.outputText.length > 0);
  assert.ok(entry.inputTokens > 0 && entry.outputTokens > 0);
});

test("provenance: the hash matches the prompt actually sent to the model", async () => {
  const { c } = build("req_prov_2");
  await c.useCase.handle({ prompt: "one two three" }, "viewer");

  // The synthesis prompt the orchestrator really sends: the user prompt plus
  // the injected tool results. Recomputing its SHA-256 must match the
  // recorded fingerprint exactly.
  const sentPrompt =
    'one two three\n\n[tool_results]\nword_count: {"words":3}';
  const [entry] = await c.useCase.getProvenance("req_prov_2");
  assert.equal(entry!.promptSha256, sha256Hex(sentPrompt));
  // Different prompt, different fingerprint (the hash is discriminating).
  assert.notEqual(entry!.promptSha256, sha256Hex("one two three"));
});

test("provenance: the output is re-read from the journal, never replayed", async () => {
  const { c, repo } = build("req_prov_3");
  const res = await c.useCase.handle({ prompt: "hello" }, "viewer");

  // What the journal recorded is exactly what was served: audit reads the
  // journal back instead of calling the model again.
  const [entry] = await repo.getProvenance("req_prov_3");
  assert.equal(entry!.outputText, res.answer);

  // The journal hands out copies: tampering with the returned entry does not
  // rewrite history.
  entry!.outputText = "tampered";
  const [fresh] = await repo.getProvenance("req_prov_3");
  assert.equal(fresh!.outputText, res.answer);
});

test("provenance: distinct runs keep distinct journals and fingerprints", async () => {
  const { c: c1 } = build("req_prov_a");
  const { c: c2 } = build("req_prov_b");
  await c1.useCase.handle({ prompt: "hello" }, "viewer");
  await c2.useCase.handle({ prompt: "goodbye now" }, "viewer");

  const [a] = await c1.useCase.getProvenance("req_prov_a");
  const [b] = await c2.useCase.getProvenance("req_prov_b");
  assert.equal(a!.requestId, "req_prov_a");
  assert.equal(b!.requestId, "req_prov_b");
  assert.notEqual(a!.promptSha256, b!.promptSha256);
});
