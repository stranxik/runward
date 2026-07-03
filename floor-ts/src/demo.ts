// End-to-end demo. A request comes in, the orchestrator plans, calls a tool
// through the registry + middleware, the model port (deterministic echo)
// answers, state is persisted in memory, structured logs and cycle events are
// emitted, and a response goes out. No network, no key.
//
// Run: npm run demo

import { createContainer } from "./infrastructure/container.js";
import { runEval } from "./eval/harness.js";

async function main(): Promise<void> {
  // Deterministic container: frozen request id for a readable demo.
  let n = 0;
  const container = createContainer({
    newRequestId: () => `demo_req_${++n}`,
    // Approve impactful tools in the demo, to show the full path.
    approvalGate: () => true,
  });

  console.log("");
  console.log(`Detected mode: ${container.features.mode} (real model: ${container.features.realModelAvailable})`);
  console.log("Tools visible to role 'viewer':", container.registry.listFor("viewer").map((t) => t.name));
  console.log("Tools visible to role 'operator':", container.registry.listFor("operator").map((t) => t.name));
  console.log("");
  console.log("=== Handling one request (the JSON lines below are the traces + cycle events) ===");
  console.log("");

  // The caller's role comes from the inbound adapter (here: the demo shell),
  // resolved from an authenticated principal — never from the payload.
  const response = await container.useCase.handle(
    { prompt: "analyse the trade-offs of our execution topology" },
    "viewer",
  );

  console.log("");
  console.log("=== Final response ===");
  console.log("requestId :", response.requestId);
  console.log("answer    :", response.answer);
  console.log("toolsUsed :", response.toolsUsed);

  console.log("");
  console.log("=== Evaluation harness (deterministic test + judge-model stub on the eval set) ===");
  const report = await runEval();
  for (const c of report.cases) {
    console.log(
      `- ${c.name}: deterministic=${c.deterministicOk ? "OK" : "KO"} | judge score=${c.judge.score.toFixed(2)} (${c.judge.passed ? "passed" : "failed"})`,
    );
  }
  console.log(`Overall pass rate: ${(report.passRate * 100).toFixed(0)}%`);
  console.log("");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
