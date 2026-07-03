// Secondary port: the model treated as an adapter behind a contract.
// The engine placed behind the model port is bound only by its contract, not
// by its nature. Today an LLM, tomorrow something else (see rule:
// hexa-llm-boundary-principle).
//
// The port exposes three tiers (three-tier model gateway):
//   - "fast"     : quick answers, simple tasks.
//   - "balanced" : main agent, common case.
//   - "deep"     : deep reasoning, strategic analysis.

export type ModelTier = "fast" | "balanced" | "deep";

export interface ModelRequest {
  tier: ModelTier;
  prompt: string;
}

export interface ModelResult {
  text: string;
  // Per-model-call metrics: the raw material of cost control.
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  // Identity of the engine that answered (adapter-reported). Feeds the
  // provenance journal: an audit must know WHICH model saw the prompt.
  model: string;
}

// The contract. No provider detail leaks here.
export interface ModelProviderPort {
  generate(req: ModelRequest): Promise<ModelResult>;
}
