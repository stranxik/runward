// Contract test: a schema accepts valid payloads and rejects invalid ones.
// Its real value is catching silent drift between the schema and the data
// actually produced.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UserRequestSchema,
  AgentResponseSchema,
} from "../src/core/domain/request.ts";

test("UserRequest: valid payload accepted, default role applied", () => {
  const parsed = UserRequestSchema.parse({ prompt: "hi" });
  assert.equal(parsed.prompt, "hi");
  assert.equal(parsed.role, "viewer"); // schema default value
});

test("UserRequest: empty prompt rejected", () => {
  assert.throws(() => UserRequestSchema.parse({ prompt: "" }));
});

test("UserRequest: unknown role rejected", () => {
  assert.throws(() =>
    UserRequestSchema.parse({ prompt: "hi", role: "superuser" }),
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
