// Provider-profile resolver test. The adapter's neutrality rests on the
// container being the only place that knows provider quirks: verify that an
// anthropic URL resolves the API version header, and that a standard OpenAI
// URL resolves no special header.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveProviderProfile } from "../src/infrastructure/container.ts";

test("provider profile: an anthropic URL resolves anthropic-version", () => {
  const profile = resolveProviderProfile("https://api.anthropic.com/v1");
  assert.equal(profile.extraHeaders["anthropic-version"], "2023-06-01");
});

test("provider profile: a standard OpenAI URL resolves no header", () => {
  const profile = resolveProviderProfile("https://api.openai.com/v1");
  assert.deepEqual(profile.extraHeaders, {});
});

test("provider profile: an OpenAI-compatible proxy (LiteLLM) resolves no header", () => {
  const profile = resolveProviderProfile("http://localhost:4000/v1");
  assert.deepEqual(profile.extraHeaders, {});
});

test("provider profile: anthropic.com elsewhere than in the host resolves no header", () => {
  for (const url of [
    "https://gateway.example/anthropic.com/v1",
    "https://api.anthropic.com.attacker.example/v1",
    "https://proxy.example/v1?upstream=anthropic.com",
    "not a url",
  ]) {
    assert.deepEqual(resolveProviderProfile(url).extraHeaders, {}, url);
  }
  assert.equal(resolveProviderProfile("HTTPS://API.ANTHROPIC.COM/v1").extraHeaders["anthropic-version"], "2023-06-01",
    "the host is compared case-insensitively");
});
