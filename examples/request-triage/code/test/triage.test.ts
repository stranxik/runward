// Test floor of the triage example: classification, deterministic guard on
// extracted fields, routing, fail-closed compliance (suspend-and-rehydrate),
// abstention on unknown. Everything deterministic: no model key, no network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { TriageRequestUseCase } from "../src/core/application/triage-request.usecase.ts";
import { KeywordModelAdapter } from "../src/adapters/keyword-model.adapter.ts";
import { HardcodedAccountRegistry } from "../src/adapters/hardcoded-account-registry.adapter.ts";
import {
  InMemoryRoutingAdapter,
  ProvenanceRefusalError,
  ApprovalMissingError,
} from "../src/adapters/in-memory-routing.adapter.ts";
import { InMemoryTriageLog } from "../src/adapters/in-memory-triage-log.adapter.ts";
import { parseDeadline } from "../src/core/domain/guard.ts";
import type { TriageModelPort } from "../src/core/ports/model-provider.port.ts";
import type { TriageRecord } from "../src/core/domain/triage.ts";

const fixedClock = { nowIso: () => "2026-06-01T00:00:00.000Z" };

function buildRig(model?: TriageModelPort) {
  const routing = new InMemoryRoutingAdapter();
  const log = new InMemoryTriageLog();
  const useCase = new TriageRequestUseCase({
    model: model ?? new KeywordModelAdapter(),
    registry: new HardcodedAccountRegistry(),
    routing,
    log,
    clock: fixedClock,
  });
  return { useCase, routing, log };
}

// --- Classification and routing ---------------------------------------------

test("support request: classified and routed to the support queue", async () => {
  const { useCase } = buildRig();
  const res = await useCase.triage({
    requestId: "r1",
    senderAddress: "jane@acme.example",
    body: "The export keeps failing with an error, please help. Account ACC-1001.",
  });
  assert.equal(res.record.category, "support");
  assert.equal(res.status, "routed");
  assert.equal(res.targetQueue, "support-queue");
  assert.ok(res.ticketRef);
});

test("sales request: classified and routed to the sales queue", async () => {
  const { useCase } = buildRig();
  const res = await useCase.triage({
    requestId: "r2",
    senderAddress: "buyer@globex.example",
    body: "We would like a pricing quote for 50 seats.",
  });
  assert.equal(res.record.category, "sales");
  assert.equal(res.status, "routed");
  assert.equal(res.targetQueue, "sales-queue");
});

test("compliance beats overlapping signals: a privacy request that also says 'help' is compliance", async () => {
  const { useCase } = buildRig();
  const res = await useCase.triage({
    requestId: "r3",
    senderAddress: "dpo@initech.example",
    body: "Please help us process this GDPR data deletion request.",
  });
  assert.equal(res.record.category, "compliance");
});

// --- Abstention ---------------------------------------------------------------

test("unknown category: the system abstains, nothing is routed", async () => {
  const { useCase, routing } = buildRig();
  const res = await useCase.triage({
    requestId: "r4",
    senderAddress: "someone@example.org",
    body: "Following up on the thing from last month.",
  });
  assert.equal(res.record.category, "unknown");
  assert.equal(res.status, "needs_review");
  assert.equal(res.targetQueue, "review-queue");
  assert.equal(routing.assignments, 0); // abstention: no action taken
});

// --- Deterministic guard on extracted fields (ADR-0002) -----------------------

test("guard: an account reference that resolves in the registry is verified", async () => {
  const { useCase } = buildRig();
  const res = await useCase.triage({
    requestId: "r5",
    senderAddress: "jane@acme.example",
    body: "Login is broken for account ACC-1001.",
  });
  assert.equal(res.record.accountRef?.value, "ACC-1001");
  assert.equal(res.record.accountRef?.provenance, "verified");
  assert.equal(res.record.accountRef?.accountName, "Acme Corp");
});

test("guard: a fabricated account reference never routes — escalated to review", async () => {
  const { useCase, routing } = buildRig();
  const res = await useCase.triage({
    requestId: "r6",
    senderAddress: "jane@acme.example",
    body: "Our app crashes constantly. Account ACC-9999.", // not in the registry
  });
  assert.equal(res.status, "needs_review");
  assert.ok(res.reason?.includes("ACC-9999"));
  assert.equal(routing.assignments, 0); // fail-closed: no routing happened
});

test("guard: the deadline is re-parsed from the source text; the model's proposal is discarded", async () => {
  // Adversarial model stub: proposes a WRONG deadline (and a valid category).
  const lyingModel: TriageModelPort = {
    async propose() {
      return {
        category: "support",
        confidence: "high",
        fields: [{ name: "deadline", value: "2099-12-31", sourceSpan: "made up" }],
      };
    },
  };
  const { useCase } = buildRig(lyingModel);
  const res = await useCase.triage({
    requestId: "r7",
    senderAddress: "jane@acme.example",
    body: "The report is broken and we need it fixed by 2026-07-15.",
  });
  // The system's value comes from the deterministic parser, not the model.
  assert.equal(res.record.deadline?.value, "2026-07-15");
  assert.equal(res.record.deadline?.provenance, "computed");
});

test("guard: the deadline parser rejects well-shaped non-dates", () => {
  assert.equal(parseDeadline("due 2026-13-45, then 2026-02-30"), null);
  assert.equal(parseDeadline("due 2026-02-28"), "2026-02-28");
});

// --- Fail-closed compliance: suspend and rehydrate ----------------------------

test("compliance: suspended awaiting approval, never routed silently", async () => {
  const { useCase, routing, log } = buildRig();
  const res = await useCase.triage({
    requestId: "r8",
    senderAddress: "dpo@initech.example",
    body: "GDPR erasure request for ACC-3003, respond by 2026-08-01.",
  });
  assert.equal(res.status, "suspended");
  assert.equal(routing.assignments, 0); // fail-closed: nothing routed yet
  // The trajectory is serialized: the exact validated record awaits.
  const pending = await log.getPending("r8");
  assert.equal(pending?.record.accountRef?.value, "ACC-3003");
  // The approval summary is deterministic, built from the validated fields.
  assert.ok(pending?.summary.includes("ACC-3003 (verified)"));
  assert.ok(pending?.summary.includes("2026-08-01 (computed)"));
  assert.equal(res.reason, pending?.summary);
});

test("compliance resume approve: routed to the compliance queue with the approval recorded", async () => {
  const { useCase, log } = buildRig();
  await useCase.triage({
    requestId: "r9",
    senderAddress: "dpo@initech.example",
    body: "GDPR data access request for ACC-3003.",
  });
  const resumed = await useCase.resumeTriage("r9", "approve", "ops-coordinator");
  assert.equal(resumed.status, "routed");
  assert.equal(resumed.targetQueue, "compliance-queue");
  assert.ok(resumed.ticketRef);
  assert.equal(await log.getPending("r9"), null); // suspension point cleared
  const journal = await log.read("r9");
  assert.ok(journal.some((e) => e.event === "approval_decision"));
});

test("compliance resume reject: the routing never happens", async () => {
  const { useCase, routing, log } = buildRig();
  await useCase.triage({
    requestId: "r10",
    senderAddress: "dpo@initech.example",
    body: "Privacy complaint escalated by the regulator, account ACC-2002.",
  });
  const resumed = await useCase.resumeTriage("r10", "reject", "ops-coordinator");
  assert.equal(resumed.status, "rejected");
  assert.equal(routing.assignments, 0); // never executed
  assert.equal(await log.getPending("r10"), null);
});

// --- Routing port invariants ---------------------------------------------------

test("routing port refuses, fail-closed, a record with model-proposed action-bearing fields", async () => {
  const routing = new InMemoryRoutingAdapter();
  const record: TriageRecord = {
    requestId: "r11",
    category: "support",
    confidence: "high",
    accountRef: { value: "ACC-1001", provenance: "model-proposed" },
  };
  await assert.rejects(
    () => routing.assign(record, "support-queue"),
    ProvenanceRefusalError,
  );
  // And a compliance record without a recorded approval is refused too.
  const compliance: TriageRecord = {
    requestId: "r12",
    category: "compliance",
    confidence: "high",
  };
  await assert.rejects(
    () => routing.assign(compliance, "compliance-queue"),
    ApprovalMissingError,
  );
});

test("routing port is idempotent on requestId: no duplicate tickets", async () => {
  const routing = new InMemoryRoutingAdapter();
  const record: TriageRecord = {
    requestId: "r13",
    category: "support",
    confidence: "high",
  };
  const first = await routing.assign(record, "support-queue");
  const second = await routing.assign(record, "support-queue");
  assert.equal(first.ticketRef, second.ticketRef);
  assert.equal(routing.assignments, 1);
});

// --- Boundary -------------------------------------------------------------------

test("input boundary: a malformed payload is rejected, unknown keys included", async () => {
  const { useCase } = buildRig();
  await assert.rejects(() =>
    useCase.triage({ requestId: "", senderAddress: "a@b.c", body: "x" }),
  );
  await assert.rejects(() =>
    useCase.triage({
      requestId: "r14",
      senderAddress: "a@b.c",
      body: "hello",
      role: "admin",
    } as never),
  );
});
