// End-to-end demo of the triage floor. Four inbound requests: a support
// issue, a sales inquiry, a compliance request (suspends, then approved),
// and one the system abstains on. No network, no key: the model adapter is
// the deterministic keyword classifier.
//
// Run: npm run demo

import { TriageRequestUseCase } from "./core/application/triage-request.usecase.js";
import { KeywordModelAdapter } from "./adapters/keyword-model.adapter.js";
import { HardcodedAccountRegistry } from "./adapters/hardcoded-account-registry.adapter.js";
import { InMemoryRoutingAdapter } from "./adapters/in-memory-routing.adapter.js";
import { InMemoryTriageLog } from "./adapters/in-memory-triage-log.adapter.js";

async function main(): Promise<void> {
  const log = new InMemoryTriageLog();
  const useCase = new TriageRequestUseCase({
    model: new KeywordModelAdapter(),
    registry: new HardcodedAccountRegistry(),
    routing: new InMemoryRoutingAdapter(),
    log,
    clock: { nowIso: () => new Date().toISOString() },
  });

  const samples = [
    {
      requestId: "req-001",
      senderAddress: "jane@acme.example",
      body: "Our dashboard crashes with an error on login. Account ACC-1001. Please help.",
    },
    {
      requestId: "req-002",
      senderAddress: "buyer@globex.example",
      body: "Could we get a pricing quote for the enterprise plan? Account ACC-2002.",
    },
    {
      requestId: "req-003",
      senderAddress: "dpo@initech.example",
      body: "GDPR data deletion request for account ACC-3003, response required by 2026-08-01.",
    },
    {
      requestId: "req-004",
      senderAddress: "someone@example.org",
      body: "Following up on the thing we discussed last month.",
    },
  ];

  for (const sample of samples) {
    const result = await useCase.triage(sample);
    console.log(
      `${sample.requestId}: category=${result.record.category} status=${result.status} queue=${result.targetQueue}` +
        (result.ticketRef ? ` ticket=${result.ticketRef}` : "") +
        (result.reason ? `\n  reason: ${result.reason}` : ""),
    );
  }

  // The compliance request suspended: a human approves, the run rehydrates.
  console.log("\nApproving the suspended compliance request (req-003)...");
  const resumed = await useCase.resumeTriage("req-003", "approve", "ops-coordinator");
  console.log(
    `req-003: status=${resumed.status} queue=${resumed.targetQueue} ticket=${resumed.ticketRef}`,
  );

  console.log("\nJournal of req-003:");
  for (const entry of await log.read("req-003")) {
    console.log(`  [${entry.event}] ${entry.detail}`);
  }
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
