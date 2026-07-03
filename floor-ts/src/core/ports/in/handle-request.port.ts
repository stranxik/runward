// Primary port: the domain's entry surface. An entry point (API, CLI, tool
// protocol) calls this contract without knowing anything about the internal
// orchestration. The entry point delegates to the orchestrator.

import type { UserRequest, AgentResponse, RequestId } from "../../domain/request.js";
import type { ToolRole } from "../out/tool.port.js";
import type { PromptProvenance } from "../out/run-repository.port.js";

export interface HandleRequestPort {
  // callerRole contract: resolved by the inbound adapter from an
  // authenticated principal — NEVER from the request payload. The payload is
  // untrusted client data; the role is a fact established by authentication.
  handle(input: UserRequest, callerRole: ToolRole): Promise<AgentResponse>;

  // Resumes a run suspended on a pending human approval (suspend-and-
  // rehydrate). "approve" executes the serialized tool call exactly as it was
  // suspended and finishes the run; "reject" ends the run "rejected" — the
  // tool never executes. Same callerRole contract as handle().
  resumeRun(
    runId: RequestId,
    decision: "approve" | "reject",
    callerRole: ToolRole,
  ): Promise<AgentResponse>;

  // Reads the provenance journal of a run: one fingerprint per model call
  // (prompt hash, model identity, tier, timestamp, recorded output). Audit
  // re-reads the recorded output; it never replays the call.
  getProvenance(runId: RequestId): Promise<PromptProvenance[]>;
}
