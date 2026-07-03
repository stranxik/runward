// Persistence adapter: in-memory repository. State lives behind a port; in a
// PoC a Map is enough, in production a durable store. The domain only sees
// the RunRepositoryPort contract, never this implementation.

import type {
  RunRepositoryPort,
  RunRecord,
  RunStep,
} from "../../core/ports/out/run-repository.port.js";
import type { RequestId } from "../../core/domain/request.js";
import { NotFoundError } from "../../infrastructure/errors.js";

export class InMemoryRunRepository implements RunRepositoryPort {
  private readonly store = new Map<RequestId, RunRecord>();

  async save(record: RunRecord): Promise<void> {
    // Defensive copy: never share the reference with the caller.
    this.store.set(record.requestId, {
      ...record,
      steps: [...record.steps],
    });
  }

  async appendStep(requestId: RequestId, step: RunStep): Promise<void> {
    const record = this.store.get(requestId);
    if (!record) {
      throw new NotFoundError(`Run not found: "${requestId}".`);
    }
    record.steps.push(step);
  }

  async get(requestId: RequestId): Promise<RunRecord> {
    const record = this.store.get(requestId);
    if (!record) {
      throw new NotFoundError(`Run not found: "${requestId}".`);
    }
    return { ...record, steps: [...record.steps] };
  }
}
