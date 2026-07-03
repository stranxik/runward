// Real model adapter, provider-agnostic, OpenAI-API-compatible.
// The model is an adapter behind the port: this adapter honors EXACTLY the
// same contract as the deterministic echo; the domain does not change, only
// the adapter wired in the container differs.
//
// Compatible with any provider exposing the chat completions endpoint in the
// OpenAI format: OpenAI, LiteLLM, Novita, etc. The base URL and the per-tier
// model names are configured through environment variables.
//
// Resilience: one bounded exponential retry loop, on transient failures only
// (network error, timeout, 429, 5xx). Deterministic failures (4xx, unreadable
// or empty body) are never retried. Multi-provider fallback stays a named
// deferral: this adapter talks to one provider; the trigger for a second one
// is a measured availability problem, not a reflex.
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
  // Maximum output tokens, placed in the body. Default 1024.
  maxTokens?: number;
  // Name of the body field carrying the output-token ceiling. Default
  // "max_tokens"; some provider/model families require another name (e.g.
  // "max_completion_tokens"). Resolved by the provider profile in the
  // container — the adapter stays neutral.
  maxTokensParam?: string;
  // Bounded retry on transient failures. Default: 2 retries.
  maxRetries?: number;
  // Base delay of the exponential backoff (delay = base * 2^attempt).
  retryBaseDelayMs?: number;
  // Injectable fetch, for tests. Default: the global fetch.
  fetchFn?: typeof fetch;
}

// Minimal shape of the chat completions response we care about.
interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_MAX_TOKENS_PARAM = "max_tokens";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;

// Outcome of a single attempt: success, or a typed error flagged as
// transient (worth retrying) or not.
type AttemptOutcome =
  | { ok: true; result: ModelResult }
  | { ok: false; error: ModelProviderError; transient: boolean };

export class OpenAiCompatibleModelAdapter implements ModelProviderPort {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelByTier: Record<ModelTier, string>;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly maxTokens: number;
  private readonly maxTokensParam: string;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: OpenAiCompatibleConfig) {
    this.apiKey = config.apiKey;
    // Strip any trailing slash to avoid a double slash on concatenation.
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.modelByTier = config.modelByTier;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.extraHeaders = config.extraHeaders ?? {};
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.maxTokensParam = config.maxTokensParam ?? DEFAULT_MAX_TOKENS_PARAM;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs =
      config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async generate(req: ModelRequest): Promise<ModelResult> {
    const model = this.modelByTier[req.tier];
    if (!model) {
      // Guardrail: a tier without a configured model name is a config error.
      throw new ModelProviderError(
        `No model name configured for tier "${req.tier}".`,
      );
    }

    // Bounded retry: maxRetries + 1 attempts in total, exponential backoff,
    // transient failures only. Bounded means bounded: no infinite loop, no
    // retry on deterministic errors (a 400 will be a 400 forever).
    let lastError: ModelProviderError | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const outcome = await this.attemptOnce(req, model);
      if (outcome.ok) return outcome.result;
      lastError = outcome.error;
      if (!outcome.transient || attempt === this.maxRetries) break;
      await sleep(this.retryBaseDelayMs * 2 ** attempt);
    }
    throw lastError ?? new ModelProviderError("Model provider call failed.");
  }

  // One HTTP attempt, no retry logic here.
  private async attemptOnce(
    req: ModelRequest,
    model: string,
  ): Promise<AttemptOutcome> {
    // Timeout through AbortController: a call is never left hanging forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: req.prompt }],
          // The field name is provider-profile-resolved (default max_tokens).
          [this.maxTokensParam]: this.maxTokens,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      // Network error or timeout: typed error, transient (worth a retry).
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? `timed out (${this.timeoutMs} ms)`
          : err instanceof Error
            ? err.message
            : String(err);
      return {
        ok: false,
        error: new ModelProviderError(`Model provider call failed: ${reason}.`),
        transient: true,
      };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Non-2xx status: read the body best-effort for an actionable message.
      const detail = await response.text().catch(() => "");
      const transient = response.status === 429 || response.status >= 500;
      return {
        ok: false,
        error: new ModelProviderError(
          `Model provider answered ${response.status} ${response.statusText}. ${detail}`.trim(),
        ),
        transient,
      };
    }

    let body: ChatCompletionResponse;
    try {
      body = (await response.json()) as ChatCompletionResponse;
    } catch {
      return {
        ok: false,
        error: new ModelProviderError(
          "Unreadable model provider response (invalid JSON).",
        ),
        transient: false,
      };
    }

    const text = body.choices?.[0]?.message?.content ?? "";
    if (!text) {
      return {
        ok: false,
        error: new ModelProviderError(
          "Empty model provider response (no content).",
        ),
        transient: false,
      };
    }

    // Token metrics expected by the port. When the provider does not return
    // them, fall back to a word count, good enough for the cost metric.
    const inputTokens = body.usage?.prompt_tokens ?? countWords(req.prompt);
    const outputTokens = body.usage?.completion_tokens ?? countWords(text);

    return {
      ok: true,
      result: { text, tier: req.tier, inputTokens, outputTokens, model },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Word count, metric fallback when the provider does not return usage.
function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
