// Sensitive-field redaction test. An API key and an Authorization header must
// be replaced with [redacted] before serialization, including inside a nested
// object.

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
