// Real model adapter tests, on a mocked fetch (no network, no key).
// Covered: bounded retry on transient failures only, and the provider-
// profile-resolved max-tokens field name.

import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAiCompatibleModelAdapter } from "../src/adapters/model/openai-compatible-model.adapter.ts";
import { ModelProviderError } from "../src/infrastructure/errors.ts";

const MODELS = { fast: "m-fast", balanced: "m-bal", deep: "m-deep" } as const;

function okResponse(content = "answer"): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function buildAdapter(fetchFn: typeof fetch, extra: Record<string, unknown> = {}) {
  return new OpenAiCompatibleModelAdapter({
    apiKey: "test-key",
    baseUrl: "https://provider.example/v1",
    modelByTier: { ...MODELS },
    retryBaseDelayMs: 1, // keep tests fast
    fetchFn,
    ...extra,
  });
}

test("retry: a transient 429 is retried and the second attempt succeeds", async () => {
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    if (calls === 1) return new Response("rate limited", { status: 429 });
    return okResponse();
  }) as typeof fetch;

  const adapter = buildAdapter(fetchFn);
  const result = await adapter.generate({ tier: "fast", prompt: "hi" });

  assert.equal(calls, 2);
  assert.equal(result.text, "answer");
  assert.equal(result.inputTokens, 3);
});

test("retry: a network error is retried, then succeeds", async () => {
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    return okResponse();
  }) as typeof fetch;

  const adapter = buildAdapter(fetchFn);
  const result = await adapter.generate({ tier: "balanced", prompt: "hi" });
  assert.equal(calls, 2);
  assert.equal(result.text, "answer");
});

test("retry is bounded: persistent 5xx stops after maxRetries+1 attempts", async () => {
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    return new Response("boom", { status: 503 });
  }) as typeof fetch;

  const adapter = buildAdapter(fetchFn); // default maxRetries = 2
  await assert.rejects(
    () => adapter.generate({ tier: "fast", prompt: "hi" }),
    ModelProviderError,
  );
  assert.equal(calls, 3); // 1 attempt + 2 retries, never more
});

test("retry: a deterministic 400 is NOT retried", async () => {
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    return new Response("bad request", { status: 400 });
  }) as typeof fetch;

  const adapter = buildAdapter(fetchFn);
  await assert.rejects(
    () => adapter.generate({ tier: "fast", prompt: "hi" }),
    ModelProviderError,
  );
  assert.equal(calls, 1); // a 400 will be a 400 forever: single attempt
});

test("max tokens field: defaults to max_tokens in the request body", async () => {
  let capturedBody: Record<string, unknown> = {};
  const fetchFn = (async (_url: unknown, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body));
    return okResponse();
  }) as typeof fetch;

  const adapter = buildAdapter(fetchFn, { maxTokens: 512 });
  await adapter.generate({ tier: "fast", prompt: "hi" });

  assert.equal(capturedBody.max_tokens, 512);
  assert.equal(capturedBody.max_completion_tokens, undefined);
});

test("max tokens field: a provider profile can rename it (max_completion_tokens)", async () => {
  let capturedBody: Record<string, unknown> = {};
  const fetchFn = (async (_url: unknown, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body));
    return okResponse();
  }) as typeof fetch;

  const adapter = buildAdapter(fetchFn, {
    maxTokens: 512,
    maxTokensParam: "max_completion_tokens",
  });
  await adapter.generate({ tier: "deep", prompt: "hi" });

  assert.equal(capturedBody.max_completion_tokens, 512);
  assert.equal(capturedBody.max_tokens, undefined);
});
