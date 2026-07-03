// Primary port: the domain's entry surface. An entry point (API, CLI, tool
// protocol) calls this contract without knowing anything about the internal
// orchestration. The entry point delegates to the orchestrator.

import type { UserRequest, AgentResponse } from "../../domain/request.js";

export interface HandleRequestPort {
  handle(input: UserRequest): Promise<AgentResponse>;
}
