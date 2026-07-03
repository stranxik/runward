// Default model adapter: deterministic echo. No network, no key.
// The model is an adapter behind the port. Swapping in a real provider does
// not touch the domain. Here the response is a pure function of the input,
// hence perfectly reproducible.

import type {
  ModelProviderPort,
  ModelRequest,
  ModelResult,
} from "../../core/ports/out/model-provider.port.js";

export class EchoModelAdapter implements ModelProviderPort {
  async generate(req: ModelRequest): Promise<ModelResult> {
    const prefixByTier: Record<ModelRequest["tier"], string> = {
      fast: "[fast]",
      balanced: "[balanced]",
      deep: "[deep]",
    };
    // Deterministic answer: the tier and the prompt in clear text.
    const text = `${prefixByTier[req.tier]} echo: ${req.prompt}`;
    // Simulated token count (words), good enough for the cost metric.
    const inputTokens = req.prompt.trim().split(/\s+/).filter(Boolean).length;
    const outputTokens = text.trim().split(/\s+/).filter(Boolean).length;
    return { text, tier: req.tier, inputTokens, outputTokens, model: "echo" };
  }
}
