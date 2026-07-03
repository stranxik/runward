// Persistence adapter: in-memory repository. State lives behind a port; in a
// PoC a Map is enough, in production a durable store. The domain only sees
// the RunRepositoryPort contract, never this implementation.
//
// The port contract is an append-only journal: create once, append steps,
// move the status. No replace operation exists.

import type {
  RunRepositoryPort,
  RunRecord,
  RunStep,
  RunStatus,
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
    this.store.set(requestId, { requestId, status: "running", steps: [] });
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

  async get(requestId: RequestId): Promise<RunRecord> {
    const record = this.requireRecord(requestId);
    // Defensive copy: never share the internal reference with the caller.
    return { ...record, steps: record.steps.map((s) => ({ ...s })) };
  }

  private requireRecord(requestId: RequestId): RunRecord {
    const record = this.store.get(requestId);
    if (!record) {
      throw new NotFoundError(`Run not found: "${requestId}".`);
    }
    return record;
  }
}
