// Sensitive-field redaction test. Detection is by case-insensitive
// substrings (token, key, secret, password, credential, auth, session): the
// real-world variants (access_token, x-api-key, refreshToken...) must be
// masked before serialization, including inside a nested object. Numeric
// metrics (inputTokens...) stay visible: a secret is not a number.

import { test } from "node:test";
import assert from "node:assert/strict";
import { StructuredLogger, redactSensitive } from "../src/infrastructure/observability/logger.ts";

test("redaction: apiKey, authorization, token and secret are masked", () => {
  const out = redactSensitive({
    apiKey: "sk-very-secret",
    authorization: "Bearer sk-very-secret",
    token: "abc",
    db_secret: "shhh",
    keep: "visible",
  }) as Record<string, unknown>;

  assert.equal(out.apiKey, "[redacted]");
  assert.equal(out.authorization, "[redacted]");
  assert.equal(out.token, "[redacted]");
  assert.equal(out.db_secret, "[redacted]");
  assert.equal(out.keep, "visible"); // a non-sensitive field stays intact
});

test("redaction: the logger never serializes the value of a key", () => {
  const lines: string[] = [];
  const logger = new StructuredLogger((line) => lines.push(line));

  logger.log("info", "container_ready", {
    module: "container",
    apiKey: "sk-must-not-leak",
    nested: { authorization: "Bearer sk-must-not-leak" },
  });

  const serialized = lines.join("\n");
  assert.ok(!serialized.includes("sk-must-not-leak")); // never in clear text
  assert.ok(serialized.includes("[redacted]"));
});

test("redaction: substring variants are masked (password, access_token, x-api-key, refreshToken)", () => {
  const out = redactSensitive({
    password: "hunter2",
    access_token: "at-123",
    "x-api-key": "xk-456",
    refreshToken: "rt-789",
    userCredentials: "u:p",
    AUTH_HEADER: "Bearer abc",
    sessionId: "sess-1",
    plain: "visible",
  }) as Record<string, unknown>;

  assert.equal(out.password, "[redacted]");
  assert.equal(out.access_token, "[redacted]");
  assert.equal(out["x-api-key"], "[redacted]");
  assert.equal(out.refreshToken, "[redacted]");
  assert.equal(out.userCredentials, "[redacted]");
  assert.equal(out.AUTH_HEADER, "[redacted]"); // case-insensitive
  assert.equal(out.sessionId, "[redacted]");
  assert.equal(out.plain, "visible");
});

test("redaction: numeric token metrics stay visible (observability preserved)", () => {
  const out = redactSensitive({
    inputTokens: 12,
    outputTokens: 34,
    runTokens: 46,
    api_key: "sk-secret",
  }) as Record<string, unknown>;

  assert.equal(out.inputTokens, 12);
  assert.equal(out.outputTokens, 34);
  assert.equal(out.runTokens, 46);
  assert.equal(out.api_key, "[redacted]"); // a string under a sensitive key is masked
});
