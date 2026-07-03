// Primary port: the domain's entry surface. An entry point (API, CLI, tool
// protocol) calls this contract without knowing anything about the internal
// orchestration. The entry point delegates to the orchestrator.

import type { UserRequest, AgentResponse } from "../../domain/request.js";
import type { ToolRole } from "../out/tool.port.js";

export interface HandleRequestPort {
  // callerRole contract: resolved by the inbound adapter from an
  // authenticated principal — NEVER from the request payload. The payload is
  // untrusted client data; the role is a fact established by authentication.
  handle(input: UserRequest, callerRole: ToolRole): Promise<AgentResponse>;
}
