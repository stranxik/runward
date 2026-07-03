// Dependency injection container. Explicit dependencies, assembly in one
// place. This is the only spot where the core (ports, use cases) meets the
// concrete adapters. Swapping an adapter (echo -> real model, in-memory ->
// database) happens here, without touching the domain.

import { randomUUID } from "node:crypto";

import type { ModelProviderPort } from "../core/ports/out/model-provider.port.js";
import type { RunRepositoryPort } from "../core/ports/out/run-repository.port.js";
import type { ClockPort } from "../core/ports/out/clock.port.js";
import { HandleRequestUseCase } from "../core/application/handle-request.usecase.js";
import type { RequestId } from "../core/domain/request.js";

import { EchoModelAdapter } from "../adapters/model/echo-model.adapter.js";
import { OpenAiCompatibleModelAdapter } from "../adapters/model/openai-compatible-model.adapter.js";
import { InMemoryRunRepository } from "../adapters/persistence/in-memory-run.repo.js";
import { wordCountTool, publishNoteTool } from "../adapters/tools/example-tools.js";

import { ToolRegistry } from "./registry.js";
import {
  loggingMiddleware,
  accessMiddleware,
  costMiddleware,
  approvalMiddleware,
  type ApprovalGate,
} from "./middleware.js";
import { StructuredLogger, type Logger } from "./observability/logger.js";
import { detectFeatures, loadEnv, type Env, type Features } from "./config/env.js";

// Injectable overrides: very handy for tests (frozen clock, capturing logger,
// deterministic identifiers, controlled approval gate).
export interface ContainerOverrides {
  model?: ModelProviderPort;
  repo?: RunRepositoryPort;
  clock?: ClockPort;
  logger?: Logger;
  approvalGate?: ApprovalGate;
  newRequestId?: () => RequestId;
}

export interface Container {
  features: Features;
  logger: Logger;
  registry: ToolRegistry;
  useCase: HandleRequestUseCase;
}

// Default system clock.
class SystemClock implements ClockPort {
  nowIso(): string {
    return new Date().toISOString();
  }
}

// Default identifier generator. Overridden in tests for determinism.
// crypto.randomUUID(): collision-resistant and non-predictable, unlike
// Math.random() which is neither (a guessable id weakens the audit trail).
function defaultRequestId(): RequestId {
  return `req_${randomUUID()}`;
}

// Assembles the container. This is where the environment is read, the mode
// detected, the adapters wired, and the middleware chain composed.
export function createContainer(overrides: ContainerOverrides = {}): Container {
  const env = loadEnv();
  const features = detectFeatures(env);

  const logger = overrides.logger ?? new StructuredLogger();
  // Model adapter selection: when a key is present, wire the real
  // OpenAI-compatible provider; otherwise, the deterministic echo (default).
  // Selection never crashes on a missing key (minimal mode = echo).
  const model = overrides.model ?? selectModelAdapter(env, features, logger);
  const repo = overrides.repo ?? new InMemoryRunRepository();
  const clock = overrides.clock ?? new SystemClock();
  const newRequestId = overrides.newRequestId ?? defaultRequestId;

  // Approval gate: by default no synchronous decision exists ("absent"), so
  // an impactful tool SUSPENDS the run instead of executing or failing — the
  // human decides later through resumeRun (suspend-and-rehydrate,
  // fail-closed without freezing the process). Override with () => true /
  // () => false for an explicit synchronous decision. The guard lives in the
  // infrastructure, not in the model.
  const approvalGate: ApprovalGate = overrides.approvalGate ?? (() => "absent");

  // Middleware chain: log -> access -> cost -> approval -> tool.
  const registry = new ToolRegistry([
    loggingMiddleware(logger),
    accessMiddleware(),
    costMiddleware(logger),
    approvalMiddleware(approvalGate),
  ]);
  registry.register(wordCountTool);
  registry.register(publishNoteTool);

  const useCase = new HandleRequestUseCase({
    model,
    repo,
    clock,
    registry,
    logger,
    newRequestId,
    // Per-run cost caps, read from the environment. Governance from day zero.
    // MAX_RUN_TOKENS (optional) caps cumulated tokens, i.e. the actual bill.
    limits: {
      maxToolCalls: env.MAX_TOOL_CALLS,
      maxModelCalls: env.MAX_MODEL_CALLS,
      maxRunTokens: env.MAX_RUN_TOKENS,
    },
  });

  logger.log("info", "container_ready", {
    module: "container",
    mode: features.mode,
    realModelAvailable: features.realModelAvailable,
  });

  return { features, logger, registry, useCase };
}

// Model adapter choice based on the environment. Never fails on a missing
// key: without a key, return the deterministic echo (minimal mode). With a
// key, wire the real OpenAI-compatible provider. Per-tier model names fall
// back to the "balanced" target when a tier is not specified, so the minimal
// configuration (key + a single model) is enough to start.
function selectModelAdapter(
  env: Env,
  features: Features,
  logger: Logger,
): ModelProviderPort {
  if (!features.realModelAvailable || !env.MODEL_API_KEY) {
    return new EchoModelAdapter();
  }

  const balanced = env.MODEL_NAME_BALANCED ?? env.MODEL_NAME_FAST ?? env.MODEL_NAME_DEEP;
  if (!balanced) {
    // Key present but no model name: degrade to echo rather than crash.
    // Signal it in the logs to ease diagnosis.
    logger.log("warn", "model_provider_not_configured", {
      module: "container",
      reason: "MODEL_API_KEY present but no MODEL_NAME_* configured; falling back to echo.",
    });
    return new EchoModelAdapter();
  }

  // The provider profile adds the quirks of a given provider (required
  // headers, notes). Only the container knows those details; the adapter
  // stays neutral and the domain knows nothing about the provider.
  const profile = resolveProviderProfile(env.MODEL_BASE_URL);

  return new OpenAiCompatibleModelAdapter({
    apiKey: env.MODEL_API_KEY,
    baseUrl: env.MODEL_BASE_URL,
    modelByTier: {
      fast: env.MODEL_NAME_FAST ?? balanced,
      balanced,
      deep: env.MODEL_NAME_DEEP ?? balanced,
    },
    extraHeaders: profile.extraHeaders,
    maxTokens: env.MODEL_MAX_TOKENS,
    maxTokensParam: profile.maxTokensParam,
  });
}

// Provider profile derived from the base URL. This is the only place that
// knows per-provider quirks. The table is deliberately minimal and extensible
// in one line: adding a provider = adding an entry here, without touching the
// domain or the adapter (which only receives neutral headers).
export interface ProviderProfile {
  extraHeaders: Record<string, string>;
  // Name of the body field carrying the output-token ceiling. Defaults to
  // "max_tokens" in the adapter; a provider/model family that rejects it
  // (e.g. OpenAI reasoning models want "max_completion_tokens") gets the
  // right name here, without touching the adapter or the domain.
  maxTokensParam?: string;
  notes: string;
}

export function resolveProviderProfile(baseUrl: string): ProviderProfile {
  const url = baseUrl.toLowerCase();
  if (url.includes("anthropic.com")) {
    // This provider requires an API version header, otherwise silent timeout.
    return {
      extraHeaders: { "anthropic-version": "2023-06-01" },
      notes: "API version header required.",
    };
  }
  // Default case: any standard OpenAI-compatible proxy or provider (OpenAI,
  // LiteLLM, Novita, etc.). No special header.
  return { extraHeaders: {}, notes: "Standard OpenAI-compatible, no special header." };
}
