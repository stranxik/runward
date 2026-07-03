// Persistence adapter: in-memory repository. State lives behind a port; in a
// PoC a Map is enough, in production a durable store. The domain only sees
// the RunRepositoryPort contract, never this implementation.
//
// The port contract is an append-only journal: create once, append steps,
// move the status. No replace operation exists. The suspension point
// (pending approval) is set on suspend and cleared once decided; the
// provenance journal only ever grows.

import type {
  RunRepositoryPort,
  RunRecord,
  RunStep,
  RunStatus,
  PendingToolApproval,
  PromptProvenance,
} from "../../core/ports/out/run-repository.port.js";
import type { RequestId } from "../../core/domain/request.js";
import { NotFoundError, ValidationError } from "../../infrastructure/errors.js";

export class InMemoryRunRepository implements RunRepositoryPort {
  private readonly store = new Map<RequestId, RunRecord>();

  async create(requestId: RequestId): Promise<void> {
    if (this.store.has(requestId)) {
      // Append-only journal: an existing run is never replaced.
      throw new ValidationError(
        `Run already exists: "${requestId}" (append-only journal, replace forbidden).`,
      );
    }
    this.store.set(requestId, {
      requestId,
      status: "running",
      steps: [],
      provenance: [],
    });
  }

  async appendStep(requestId: RequestId, step: RunStep): Promise<void> {
    const record = this.requireRecord(requestId);
    // Defensive copy: the caller keeps no handle on the stored step.
    record.steps.push({ ...step });
  }

  async updateStatus(requestId: RequestId, status: RunStatus): Promise<void> {
    const record = this.requireRecord(requestId);
    record.status = status;
  }

  async suspend(
    requestId: RequestId,
    pending: PendingToolApproval,
  ): Promise<void> {
    const record = this.requireRecord(requestId);
    record.status = "suspended";
    // Deep-enough copy: the caller keeps no handle on the stored state.
    record.pending = {
      ...pending,
      toolsUsed: [...pending.toolsUsed],
      costMeter: { ...pending.costMeter },
    };
  }

  async clearPending(requestId: RequestId): Promise<void> {
    const record = this.requireRecord(requestId);
    delete record.pending;
  }

  async appendProvenance(
    requestId: RequestId,
    entry: PromptProvenance,
  ): Promise<void> {
    const record = this.requireRecord(requestId);
    record.provenance.push({ ...entry });
  }

  async getProvenance(requestId: RequestId): Promise<PromptProvenance[]> {
    const record = this.requireRecord(requestId);
    return record.provenance.map((p) => ({ ...p }));
  }

  async get(requestId: RequestId): Promise<RunRecord> {
    const record = this.requireRecord(requestId);
    // Defensive copy: never share the internal reference with the caller.
    return {
      ...record,
      steps: record.steps.map((s) => ({ ...s })),
      provenance: record.provenance.map((p) => ({ ...p })),
      pending: record.pending
        ? {
            ...record.pending,
            toolsUsed: [...record.pending.toolsUsed],
            costMeter: { ...record.pending.costMeter },
          }
        : undefined,
    };
  }

  private requireRecord(requestId: RequestId): RunRecord {
    const record = this.store.get(requestId);
    if (!record) {
      throw new NotFoundError(`Run not found: "${requestId}".`);
    }
    return record;
  }
}
