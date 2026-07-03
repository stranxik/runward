// Persistence adapter: in-memory triage log. Append-only journal per request
// id, plus the serialized suspension point of a record awaiting approval.

import type {
  TriageLogPort,
  TriageLogEntry,
  PendingRouting,
} from "../core/ports/triage-log.port.js";

export class InMemoryTriageLog implements TriageLogPort {
  private readonly entries = new Map<string, TriageLogEntry[]>();
  private readonly pending = new Map<string, PendingRouting>();

  async append(requestId: string, entry: TriageLogEntry): Promise<void> {
    const list = this.entries.get(requestId) ?? [];
    list.push({ ...entry });
    this.entries.set(requestId, list);
  }

  async read(requestId: string): Promise<TriageLogEntry[]> {
    return (this.entries.get(requestId) ?? []).map((e) => ({ ...e }));
  }

  async setPending(requestId: string, pending: PendingRouting): Promise<void> {
    if (this.pending.has(requestId)) {
      throw new Error(`Request "${requestId}" is already suspended.`);
    }
    this.pending.set(requestId, {
      ...pending,
      record: structuredClone(pending.record),
    });
  }

  async getPending(requestId: string): Promise<PendingRouting | null> {
    const p = this.pending.get(requestId);
    return p ? { ...p, record: structuredClone(p.record) } : null;
  }

  async clearPending(requestId: string): Promise<void> {
    this.pending.delete(requestId);
  }
}
