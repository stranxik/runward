// Secondary port: persistence of a trajectory's state (a "run").
// The agent is a stateless reducer; state lives behind this port. The
// orchestrator does not know whether it is a database, a distributed store,
// or a plain in-memory Map.
//
// CONTRACT — the run is an APPEND-ONLY JOURNAL. A run record is created once,
// steps are only ever appended, and the status moves through explicit
// transitions. Replacing a whole record is forbidden: it would allow an
// adapter (or a bug) to silently rewrite history, and the audit trail is the
// point of persisting the trajectory in the first place.

import type { RequestId } from "../../domain/request.js";

// Persisted step of a trajectory (one cycle event).
export interface RunStep {
  at: string; // ISO timestamp
  kind: "plan" | "tool_call" | "model_call" | "synthesis";
  detail: string;
}

export type RunStatus = "running" | "done" | "failed" | "capped";

export interface RunRecord {
  // "capped": run stopped on a cost cap.
  requestId: RequestId;
  status: RunStatus;
  steps: RunStep[];
}

export interface RunRepositoryPort {
  // Opens the journal for a new run (status "running", no steps). Must throw
  // when the run already exists: a journal is never replaced.
  create(requestId: RequestId): Promise<void>;
  // Appends a step to an existing run. Must throw NotFoundError when the run
  // does not exist. Steps are immutable once appended.
  appendStep(requestId: RequestId, step: RunStep): Promise<void>;
  // Moves the run status (running -> done | failed | capped). The only
  // mutation allowed besides appending steps.
  updateStatus(requestId: RequestId, status: RunStatus): Promise<void>;
  // Reads a run. Must throw NotFoundError when it does not exist.
  get(requestId: RequestId): Promise<RunRecord>;
}
