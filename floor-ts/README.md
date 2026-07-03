# Runward reference floor (TypeScript)

The smallest runnable floor implementing the Runward defaults. It is a
clonable scaffold: it runs (green smoke test), stays minimal, and serves as
the starting point for any floor delivery.

Guiding principle: hexagonal architecture, the domain at the center, the model
treated as an adapter behind a port. Everything that can be deterministic,
testable and reproducible stays out of the model.

**Zero keys by default.** The default model adapter is a deterministic echo:
no key, no network call, everything reproducible.

## Quickstart

Prerequisite: Node 20+ (tested on Node 22).

```bash
npm install
npm test     # green tests via node:test + tsx
npm run demo # end-to-end toy case, no network, no key
```

## What the demo does

A request comes in, the orchestrator plans (deterministic complexity
classification mapped to a model tier), calls a tool through the registry and
the middleware chain, the model port (deterministic echo) answers, the
trajectory state is persisted in memory, structured logs and cycle events are
emitted with the request id propagated, and a response goes out. The demo also
runs the evaluation harness (deterministic test plus a judge-model stub on a
hold-out set).

## Minimal mode / full mode

Feature detection at startup (`src/infrastructure/config/env.ts`) picks the
mode without ever crashing on a missing variable:

- Minimal mode (default): no key. The model port uses the deterministic echo.
  Everything works, reproducible, offline.
- Full mode: when `MODEL_API_KEY` is present, the container wires a real
  OpenAI-API-compatible provider
  (`src/adapters/model/openai-compatible-model.adapter.js`). The domain does
  not change: only the adapter behind the model port is swapped.

The wiring happens in the injection container
(`src/infrastructure/container.ts`), the single place where the core meets the
concrete adapters.

## Real mode

To run the floor against a real provider (on your machine):

```bash
cp .env.example .env
# edit .env: set MODEL_API_KEY, MODEL_BASE_URL and at least one MODEL_NAME_*
npm install
npm run demo
```

The real adapter is provider-agnostic: it talks to any OpenAI-API-compatible
endpoint (`/chat/completions`). It works with OpenAI, a LiteLLM proxy, Novita,
etc., simply by changing `MODEL_BASE_URL`. The three tiers fast / balanced /
deep map to model names through `MODEL_NAME_FAST`, `MODEL_NAME_BALANCED`,
`MODEL_NAME_DEEP` (when only one is set, it serves all three).

Without a `.env`, or with an empty `MODEL_API_KEY`, the floor stays in
deterministic echo mode: no key, no network. The `demo` script loads the
`.env` when present through `node --env-file-if-exists=.env` (Node 20+),
without adding a dependency.

**Provider profiles.** The adapter stays neutral, it names no provider. A
provider's quirks (required headers or fields) are resolved at assembly time,
in `resolveProviderProfile(baseUrl)` inside the container. Shipped example: a
base URL containing `anthropic.com` injects the `anthropic-version` header.
Adding a demanding provider is one line in that table, not a change to the
adapter or the domain. `max_tokens` is always sent (tunable through
`MODEL_MAX_TOKENS`); some providers require it.

**Governance from day zero.** A per-run cost cap is active (`MAX_TOOL_CALLS`,
`MAX_MODEL_CALLS`): when exceeded, the orchestrator stops, emits the
`cost_cap_reached` event and returns a partial synthesis (status `capped`).
The logger redacts sensitive fields (key, authorization, token) before
serialization: an API key never appears in the logs.

Note: the tests (`npm test`) always run on the echo through the container
overrides. They never hit the network and depend on no key.

## Principle → where in the code

| Principle | Where in the code |
| --- | --- |
| Pure domain, zero framework | `src/core/domain/request.ts` (only zod, as a schema library) |
| Domain ports (contracts) | `src/core/ports/in/`, `src/core/ports/out/` |
| Model as an adapter behind a port | `src/core/ports/out/model-provider.port.ts` plus `src/adapters/model/echo-model.adapter.ts` (echo) and `src/adapters/model/openai-compatible-model.adapter.ts` (real) |
| Three-tier model port (fast / balanced / deep) | `ModelTier` type in `model-provider.port.ts`, mapped from complexity in the use case |
| Persistence behind a port | `src/core/ports/out/run-repository.port.ts` plus `src/adapters/persistence/in-memory-run.repo.ts` |
| Clock behind a port (determinism) | `src/core/ports/out/clock.port.ts` |
| Stateless reducer agent | `src/core/application/handle-request.usecase.ts` (no instance state, everything goes through the repo) |
| Plan-and-execute orchestrator (composes, no business logic) | same file, steps plan -> tool -> model -> synthesis |
| Tool registry, single surface | `src/infrastructure/registry.ts` |
| Middleware chain (log, access, cost, approval) | `src/infrastructure/middleware.ts` |
| Tool-level access control (filtered before exposure) | `ToolRegistry.listFor` plus `accessMiddleware` |
| Human approval anchored in the tool contract | `requiresApproval` field in `tool.port.ts` plus `approvalMiddleware` |
| Structured logs, propagated request id, cycle events | `src/infrastructure/observability/logger.ts`, propagated in the use case |
| Per-model-call metrics (tokens, tier) | `ModelResult` in `model-provider.port.ts`, traced in the use case |
| Typed error model | `src/infrastructure/errors.ts` (`AppError` and subclasses) |
| Dependency injection container | `src/infrastructure/container.ts` |
| Feature detection at startup (minimal / full) | `src/infrastructure/config/env.ts` (`loadEnv`, `detectFeatures`) |
| Contract validation at the boundary | zod schemas plus `safeParse` in the use case and the registry |
| Evaluation harness (deterministic test, contract, judge-model stub) | `src/eval/harness.ts` and `test/*.test.ts` |

## Test pyramid

| Floor | File | What |
| --- | --- | --- |
| Unit (pure domain) | `test/domain.test.ts` | deterministic business rule, no mock |
| Contract (valid / invalid schema) | `test/contract.test.ts` | catches schema-to-data drift |
| Integration (use case through the container) | `test/orchestration.test.ts` | full path, access, approval, persistence |
| Evaluation (behavioral quality) | `src/eval/harness.ts` | judge-model stub on hold-out |

## Layout

```
floor-ts/
  README.md
  AGENTS.md
  package.json
  tsconfig.json
  src/
    demo.ts
    core/
      domain/request.ts
      ports/in/handle-request.port.ts
      ports/out/model-provider.port.ts
      ports/out/run-repository.port.ts
      ports/out/clock.port.ts
      ports/out/tool.port.ts
      application/handle-request.usecase.ts
    adapters/
      model/echo-model.adapter.ts
      model/openai-compatible-model.adapter.ts
      persistence/in-memory-run.repo.ts
      tools/example-tools.ts
    infrastructure/
      config/env.ts
      container.ts
      registry.ts
      middleware.ts
      observability/logger.ts
      errors.ts
    eval/harness.ts
  test/
    domain.test.ts
    contract.test.ts
    orchestration.test.ts
    cost-cap.test.ts
    provider-profile.test.ts
    redaction.test.ts
```

## Golden rule for extending

New capability equals new adapter, never a change to the core. Wiring a real
model, a database, an extra tool: write an adapter that honors the port, and
wire it in the container. The domain and the use cases do not move.

## Technical note

The `.ts` is executed directly by `tsx` (no build). Tests run through
`node --import tsx --test`. Internal imports use the `.js` extension in the
source code (standard ESM resolution, transparent with tsx); tests import
`.ts` because they are loaded directly by the runner.
