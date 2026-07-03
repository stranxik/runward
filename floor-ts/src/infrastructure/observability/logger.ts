// Observability: structured logs + propagated request id + cycle events.
// One line per event, typed context (module, request id, session). The same
// stream will one day feed evaluation and provenance (see rule:
// observability-structured-json-logs).

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  module?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface CycleEvent {
  requestId: string;
  step: string;
  data?: Record<string, unknown>;
}

// The logger is a simple infrastructure port. It stays injectable so tests
// can capture lines instead of writing to stdout.
export interface Logger {
  log(level: LogLevel, message: string, ctx?: LogContext): void;
  // Cycle event: a step crossed by the orchestrator or a tool.
  emitCycleEvent(event: CycleEvent): void;
}

// Fields considered sensitive: their value is replaced before any
// serialization. A secret must never travel through the logs (see rule:
// config-secrets-boundary).
const REDACTED = "[redacted]";

// A key is sensitive when its lowercased name CONTAINS one of these
// substrings. Substring matching (not exact names) catches the real-world
// variants: password, access_token, x-api-key, refreshToken, sessionId,
// authorization... Deterministic, dependency-free.
const SENSITIVE_SUBSTRINGS = [
  "token",
  "key",
  "secret",
  "password",
  "credential",
  "auth",
  "session",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_SUBSTRINGS.some((s) => k.includes(s));
}

// Numeric and boolean values under a sensitive-looking name are metrics, not
// secrets (inputTokens, outputTokens, runTokens...). Secrets are strings (or
// structures). Keeping the metrics preserves observability without weakening
// the redaction.
function isRedactableValue(value: unknown): boolean {
  return typeof value !== "number" && typeof value !== "boolean";
}

// Recursive redaction: replaces the value of any sensitive field with
// [redacted], including in nested objects. Returns a copy, never mutates the
// input.
export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] =
        isSensitiveKey(k) && isRedactableValue(v) ? REDACTED : redactSensitive(v);
    }
    return out;
  }
  return value;
}

// Default implementation: one JSON line per event on stdout/stderr.
export class StructuredLogger implements Logger {
  constructor(private readonly sink: (line: string) => void = console.log) {}

  log(level: LogLevel, message: string, ctx: LogContext = {}): void {
    // Deterministic redaction of sensitive fields before serialization.
    const safeCtx = redactSensitive(ctx) as LogContext;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...safeCtx,
    });
    this.sink(line);
  }

  emitCycleEvent(event: CycleEvent): void {
    this.log("info", "cycle_event", {
      module: "orchestrator",
      requestId: event.requestId,
      step: event.step,
      ...(event.data ?? {}),
    });
  }
}

// Test logger: stores the lines instead of printing them.
export class CapturingLogger implements Logger {
  readonly lines: Array<{ level: LogLevel; message: string; ctx: LogContext }> =
    [];
  readonly events: CycleEvent[] = [];

  log(level: LogLevel, message: string, ctx: LogContext = {}): void {
    // Same redaction as the real logger: a secret must never be captured.
    this.lines.push({ level, message, ctx: redactSensitive(ctx) as LogContext });
  }

  emitCycleEvent(event: CycleEvent): void {
    this.events.push(event);
    this.log("info", "cycle_event", { requestId: event.requestId, step: event.step });
  }
}
