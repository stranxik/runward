// Append-only journal contract of the run repository. A run is created once,
// steps are appended, the status transitions — a record is never replaced.

import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryRunRepository } from "../src/adapters/persistence/in-memory-run.repo.ts";
import { NotFoundError, ValidationError } from "../src/infrastructure/errors.ts";

test("journal: create opens a running run; re-creating (replace) is forbidden", async () => {
  const repo = new InMemoryRunRepository();
  await repo.create("run_1");
  const record = await repo.get("run_1");
  assert.equal(record.status, "running");
  assert.deepEqual(record.steps, []);
  // Replace forbidden: creating the same run again must throw.
  await assert.rejects(() => repo.create("run_1"), ValidationError);
});

test("journal: appendStep accumulates, updateStatus transitions, history survives", async () => {
  const repo = new InMemoryRunRepository();
  await repo.create("run_2");
  await repo.appendStep("run_2", { at: "t1", kind: "plan", detail: "p" });
  await repo.appendStep("run_2", { at: "t2", kind: "model_call", detail: "m" });
  await repo.updateStatus("run_2", "done");
  const record = await repo.get("run_2");
  assert.equal(record.status, "done");
  // The status transition never erased the appended history.
  assert.deepEqual(record.steps.map((s) => s.kind), ["plan", "model_call"]);
});

test("journal: appendStep and updateStatus on a missing run throw NotFoundError", async () => {
  const repo = new InMemoryRunRepository();
  await assert.rejects(
    () => repo.appendStep("ghost", { at: "t", kind: "plan", detail: "p" }),
    NotFoundError,
  );
  await assert.rejects(() => repo.updateStatus("ghost", "done"), NotFoundError);
});

test("journal: get returns a defensive copy (mutating it does not alter the store)", async () => {
  const repo = new InMemoryRunRepository();
  await repo.create("run_3");
  await repo.appendStep("run_3", { at: "t1", kind: "plan", detail: "p" });
  const copy = await repo.get("run_3");
  copy.steps.push({ at: "t2", kind: "synthesis", detail: "tampered" });
  copy.status = "failed";
  const fresh = await repo.get("run_3");
  assert.equal(fresh.status, "running");
  assert.equal(fresh.steps.length, 1);
});
