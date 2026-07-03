// Secondary port: persistence of triage decisions
// (../../runward/contracts/persistence-port.md, reduced). An append-only
// journal keyed by request id, plus the serialized suspension point of a
// compliance record awaiting human approval (suspend-and-rehydrate: the
// process is freed, the decision rehydrates the run).

import type { TriageRecord } from "../domain/triage.js";

export interface TriageLogEntry {
  at: string; // ISO timestamp
  event: string;
  detail: string;
}

// Serialized suspension point: the exact validated record and target queue,
// plus a deterministic summary built by code from the real fields — never a
// model reformulation.
export interface PendingRouting {
  record: TriageRecord;
  targetQueue: string;
  summary: string;
  suspendedAt: string;
}

export interface TriageLogPort {
  append(requestId: string, entry: TriageLogEntry): Promise<void>;
  read(requestId: string): Promise<TriageLogEntry[]>;
  // Suspension point management. setPending throws if one already exists
  // (a record is suspended at most once at a time).
  setPending(requestId: string, pending: PendingRouting): Promise<void>;
  getPending(requestId: string): Promise<PendingRouting | null>;
  clearPending(requestId: string): Promise<void>;
}
