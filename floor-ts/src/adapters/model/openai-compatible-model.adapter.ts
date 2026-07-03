// Real model adapter, provider-agnostic, OpenAI-API-compatible.
// The model is an adapter behind the port: this adapter honors EXACTLY the
// same contract as the deterministic echo; the domain does not change, only
// the adapter wired in the container differs.
//
// Compatible with any provider exposing the chat completions endpoint in the
// OpenAI format: OpenAI, LiteLLM, Novita, etc. The base URL and the per-tier
// model names are configured through environment variables.
//
// No new dependency: Node's global fetch is used (Node 18+).

import type {
  ModelProviderPort,
  ModelRequest,
  ModelResult,
  ModelTier,
} from "../../core/ports/out/model-provider.port.js";
import { ModelProviderError } from "../../infrastructure/errors.js";

// Adapter configuration, resolved from the environment at assembly time
// (container). The model names map the three tiers.
export interface OpenAiCompatibleConfig {
  apiKey: string;
  baseUrl: string;
  modelByTier: Record<ModelTier, string>;
  // Maximum duration of one call, in milliseconds. Reasonable default.
  timeoutMs?: number;
  // Extra headers injected as-is into every request. The adapter stays
  // neutral: it does not know which provider they belong to, it just sets them.
  extraHeaders?: Record<string, string>;
  // Maximum output tokens, placed in the body (always accepted by the OpenAI
  // API, required by some providers). Default 1024.
  maxTokens?: number;
}

// Minimal shape of the chat completions response we care about.
interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1024;

export class OpenAiCompatibleModelAdapter implements ModelProviderPort {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelByTier: Record<ModelTier, string>;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly maxTokens: number;

  constructor(config: OpenAiCompatibleConfig) {
    this.apiKey = config.apiKey;
    // Strip any trailing slash to avoid a double slash on concatenation.
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.modelByTier = config.modelByTier;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.extraHeaders = config.extraHeaders ?? {};
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async generate(req: ModelRequest): Promise<ModelResult> {
    const model = this.modelByTier[req.tier];
    if (!model) {
      // Guardrail: a tier without a configured model name is a config error.
      throw new ModelProviderError(
        `No model name configured for tier "${req.tier}".`,
      );
    }

    // Timeout through AbortController: a call is never left hanging forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: req.prompt }],
          max_tokens: this.maxTokens,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      // Network error or timeout: surface a typed error, never a raw one.
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? `timed out (${this.timeoutMs} ms)`
          : err instanceof Error
            ? err.message
            : String(err);
      throw new ModelProviderError(`Model provider call failed: ${reason}.`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Non-2xx status: read the body best-effort for an actionable message.
      const detail = await response.text().catch(() => "");
      throw new ModelProviderError(
        `Model provider answered ${response.status} ${response.statusText}. ${detail}`.trim(),
      );
    }

    let body: ChatCompletionResponse;
    try {
      body = (await response.json()) as ChatCompletionResponse;
    } catch {
      throw new ModelProviderError(
        "Unreadable model provider response (invalid JSON).",
      );
    }

    const text = body.choices?.[0]?.message?.content ?? "";
    if (!text) {
      throw new ModelProviderError(
        "Empty model provider response (no content).",
      );
    }

    // Token metrics expected by the port. When the provider does not return
    // them, fall back to a word count, good enough for the cost metric.
    const inputTokens =
      body.usage?.prompt_tokens ?? countWords(req.prompt);
    const outputTokens =
      body.usage?.completion_tokens ?? countWords(text);

    return { text, tier: req.tier, inputTokens, outputTokens };
  }
}

// Word count, metric fallback when the provider does not return usage.
function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
