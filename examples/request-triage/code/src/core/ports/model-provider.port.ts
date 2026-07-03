// Secondary port: the model proposes, it never decides
// (../../runward/contracts/model-port.md). The output is a hypothesis: a
// closed-vocabulary category, field extractions each carrying the span of
// source text they were read from, and a confidence level. Everything is
// provenance-marked "model-proposed" by construction; nothing downstream may
// act on it before the deterministic guard (ADR-0002).

import type { Category, Confidence } from "../domain/triage.js";

export interface ProposedField {
  name: "accountRef" | "deadline";
  value: string;
  // Span of source text the value was read from. A value with no span is
  // rejected at the schema boundary.
  sourceSpan: string;
}

export interface TriageProposal {
  category: Category;
  fields: ProposedField[];
  confidence: Confidence;
}

export interface TriageModelPort {
  propose(requestText: string): Promise<TriageProposal>;
}
