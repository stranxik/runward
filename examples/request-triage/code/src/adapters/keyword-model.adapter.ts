// Default model adapter: deterministic keyword classifier and extractor.
// No key, no network, everything reproducible — the fallback classifier of
// the mission's model-port contract, honoring the same contract as a real
// model with lower recall. The adapter proposes; it never decides: every
// value it emits is a hypothesis the deterministic guard will verify or
// recompute (ADR-0002).

import type {
  TriageModelPort,
  TriageProposal,
  ProposedField,
} from "../core/ports/model-provider.port.js";
import type { Category } from "../core/domain/triage.js";

// Order matters: compliance wins over support/sales when signals overlap —
// a data-privacy request that also says "help" must surface as compliance
// (a silent compliance miss is the one failure the mission forbids).
const RULES: Array<{ category: Category; pattern: RegExp }> = [
  {
    category: "compliance",
    pattern: /\b(gdpr|data (deletion|erasure|access)|privacy|regulator|dpo|right to be forgotten)\b/i,
  },
  {
    category: "support",
    pattern: /\b(crash(es|ed)?|error|bug|broken|fail(s|ed|ing)?|cannot|can't|not working|help)\b/i,
  },
  {
    category: "sales",
    pattern: /\b(pricing|quote|purchase|demo|upgrade|licen[sc]e|subscription|buy)\b/i,
  },
];

const ACCOUNT_REF = /\bACC-\d{4}\b/;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;

export class KeywordModelAdapter implements TriageModelPort {
  async propose(requestText: string): Promise<TriageProposal> {
    const rule = RULES.find((r) => r.pattern.test(requestText));
    const category: Category = rule?.category ?? "unknown";

    const fields: ProposedField[] = [];
    const ref = requestText.match(ACCOUNT_REF);
    if (ref) {
      fields.push({ name: "accountRef", value: ref[0], sourceSpan: ref[0] });
    }
    const date = requestText.match(ISO_DATE);
    if (date) {
      fields.push({ name: "deadline", value: date[0], sourceSpan: date[0] });
    }

    return {
      category,
      fields,
      confidence: rule ? "high" : "low",
    };
  }
}
