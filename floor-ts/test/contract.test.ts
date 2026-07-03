// Contract test: a schema accepts valid payloads and rejects invalid ones.
// Its real value is catching silent drift between the schema and the data
// actually produced.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UserRequestSchema,
  AgentResponseSchema,
} from "../src/core/domain/request.ts";

test("UserRequest: valid payload accepted", () => {
  const parsed = UserRequestSchema.parse({ prompt: "hi" });
  assert.equal(parsed.prompt, "hi");
});

test("UserRequest: empty prompt rejected", () => {
  assert.throws(() => UserRequestSchema.parse({ prompt: "" }));
});

test("UserRequest: a 'role' key in the payload is rejected (strict schema)", () => {
  // Self-declared privilege must not enter through the payload: the role is
  // resolved by the inbound adapter from an authenticated principal. The
  // strict schema rejects the smuggled key instead of silently honoring it.
  assert.throws(() =>
    UserRequestSchema.parse({ prompt: "hi", role: "admin" }),
  );
});

test("UserRequest: any unknown key is rejected (strict schema)", () => {
  assert.throws(() =>
    UserRequestSchema.parse({ prompt: "hi", isAdmin: true }),
  );
});

test("AgentResponse: valid payload accepted", () => {
  const ok = AgentResponseSchema.parse({
    requestId: "req_1",
    answer: "[fast] echo: hi",
    toolsUsed: ["word_count"],
  });
  assert.equal(ok.requestId, "req_1");
});

test("AgentResponse: missing field rejected (schema/data drift)", () => {
  assert.throws(() =>
    AgentResponseSchema.parse({ requestId: "req_1", answer: "x" }),
  );
});
