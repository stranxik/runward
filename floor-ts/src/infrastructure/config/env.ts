// Schema-validated configuration at startup + feature detection.
// Config is typed and validated early; nothing crashes at boot because of a
// missing variable — degrade gracefully to a minimal mode (see rules:
// config-typing-zod, provider-no-crash-missing-env).

import { z } from "zod";

// Environment schema. Every variable is optional: the floor must run without
// any configuration (minimal mode, deterministic echo).
const EnvSchema = z.object({
  // When a key is present, a real OpenAI-compatible provider is enabled.
  // Its absence is not an error: switch to minimal mode (echo).
  MODEL_API_KEY: z.string().min(1).optional(),
  // Base URL of the OpenAI-compatible provider (OpenAI, LiteLLM, Novita, etc.).
  MODEL_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  // Per-tier model names. Absent in minimal mode; required when a key is set.
  MODEL_NAME_FAST: z.string().min(1).optional(),
  MODEL_NAME_BALANCED: z.string().min(1).optional(),
  MODEL_NAME_DEEP: z.string().min(1).optional(),
  // Maximum output tokens per model call (default 1024).
  // Some providers require it in the request body; it is always accepted.
  MODEL_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  // Per-run cost caps (governance from day zero).
  // Beyond them, the orchestrator stops and returns a partial synthesis
  // (status "capped").
  MAX_TOOL_CALLS: z.coerce.number().int().positive().default(16),
  MAX_MODEL_CALLS: z.coerce.number().int().positive().default(4),
  // Desired log level.
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

// Operating modes detected at startup.
export type FeatureMode = "minimal" | "full";

export interface Features {
  mode: FeatureMode;
  // Is a real model available, or are we running on the deterministic echo?
  realModelAvailable: boolean;
}

// Validates the environment. Throws only when a present variable is
// malformed, never because a variable is absent.
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid configuration: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return parsed.data;
}

// Feature detection: minimal mode by default (no key), full mode when a real
// model provider is configured. Graceful degradation.
export function detectFeatures(env: Env): Features {
  const realModelAvailable = Boolean(env.MODEL_API_KEY);
  return {
    mode: realModelAvailable ? "full" : "minimal",
    realModelAvailable,
  };
}
