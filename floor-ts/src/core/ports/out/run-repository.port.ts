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
//
// Two structures ride alongside the steps, both append-or-set through
// explicit methods, never through a replace:
//   - the PENDING APPROVAL: the serialized point where a suspended run
//     stopped (tool, exact arguments, resume context). Suspend-and-rehydrate:
//     the process is freed; resuming rehydrates from here.
//   - the PROVENANCE JOURNAL: one fingerprint per model call (prompt hash,
//     model identity, tier, timestamp, recorded output). Audit reads the
//     recorded output back; it never replays the call.

import type { RequestId } from "../../domain/request.js";

// Persisted step of a trajectory (one cycle event).
export interface RunStep {
  at: string; // ISO timestamp
  kind:
    | "plan"
    | "tool_call"
    | "model_call"
    | "synthesis"
    | "approval_requested"
    | "approval_decision";
  detail: string;
}

export type RunStatus =
  | "running"
  | "done"
  | "failed"
  | "capped"
  | "suspended"
  | "rejected";

// Serialized suspension point of a run awaiting human approval. Carries the
// EXACT tool arguments (never a model reformulation) and everything needed to
// resume precisely where the run stopped.
export interface PendingToolApproval {
  // Tool awaiting approval, with its exact, already-validated arguments.
  tool: string;
  input: unknown;
  // Deterministic summary presented to the approver. Built by code from the
  // real arguments; the model never phrases it.
  summary: string;
  suspendedAt: string; // ISO timestamp
  // Resume context: what the trajectory had produced before suspending.
  answerSoFar: string;
  toolsUsed: string[];
  costMeter: { toolCalls: number; modelCalls: number; tokens: number };
}

// Provenance fingerprint of ONE model call: enough to know exactly what the
// model saw and answered, without ever replaying the call.
export interface PromptProvenance {
  requestId: RequestId;
  // SHA-256 (hex) of the prompt actually sent through the model port.
  promptSha256: string;
  // Identity of the engine that answered (adapter-reported model name).
  model: string;
  tier: string;
  at: string; // ISO timestamp
  // Recorded output, re-read from here on audit — the call is never replayed.
  outputText: string;
  inputTokens: number;
  outputTokens: number;
}

export interface RunRecord {
  // "capped": run stopped on a cost cap. "suspended": run serialized, waiting
  // for a human approval. "rejected": approval denied on resume.
  requestId: RequestId;
  status: RunStatus;
  steps: RunStep[];
  // Present only while the run is suspended.
  pending?: PendingToolApproval;
  // One entry per model call, in call order.
  provenance: PromptProvenance[];
}

export interface RunRepositoryPort {
  // Opens the journal for a new run (status "running", no steps). Must throw
  // when the run already exists: a journal is never replaced.
  create(requestId: RequestId): Promise<void>;
  // Appends a step to an existing run. Must throw NotFoundError when the run
  // does not exist. Steps are immutable once appended.
  appendStep(requestId: RequestId, step: RunStep): Promise<void>;
  // Moves the run status (running -> done | failed | capped | suspended |
  // rejected). The only mutation allowed besides appending.
  updateStatus(requestId: RequestId, status: RunStatus): Promise<void>;
  // Suspends the run: status "suspended" + the serialized suspension point.
  // Must throw NotFoundError when the run does not exist.
  suspend(requestId: RequestId, pending: PendingToolApproval): Promise<void>;
  // Clears the suspension point once the human decision has been applied.
  clearPending(requestId: RequestId): Promise<void>;
  // Appends a provenance fingerprint (one per model call). Append-only.
  appendProvenance(requestId: RequestId, entry: PromptProvenance): Promise<void>;
  // Reads the provenance journal of a run (copies, in call order).
  getProvenance(requestId: RequestId): Promise<PromptProvenance[]>;
  // Reads a run. Must throw NotFoundError when it does not exist.
  get(requestId: RequestId): Promise<RunRecord>;
}
