// Secondary port: persistence of a trajectory's state (a "run").
// The agent is a stateless reducer; state lives behind this port. The
// orchestrator does not know whether it is a database, a distributed store,
// or a plain in-memory Map.

import type { RequestId } from "../../domain/request.js";

// Persisted step of a trajectory (one cycle event).
export interface RunStep {
  at: string; // ISO timestamp
  kind: "plan" | "tool_call" | "model_call" | "synthesis";
  detail: string;
}

export interface RunRecord {
  // "capped": run stopped on a cost cap.
  requestId: RequestId;
  status: "running" | "done" | "failed" | "capped";
  steps: RunStep[];
}

export interface RunRepositoryPort {
  // Creates or replaces a run record.
  save(record: RunRecord): Promise<void>;
  // Appends a step to an existing run.
  appendStep(requestId: RequestId, step: RunStep): Promise<void>;
  // Reads a run. Must throw NotFoundError when it does not exist.
  get(requestId: RequestId): Promise<RunRecord>;
}
