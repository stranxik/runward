// Minimal evaluation harness. A test answers true/false on deterministic
// code; an evaluation grades a quality on non-deterministic behavior. Both
// coexist (test the deterministic, evaluate the non-deterministic). This
// harness combines:
//   1. a deterministic case (exact assertion on the echo output),
//   2. a judge-model stub (grades a quality, here through a heuristic).
//
// The judge model is a stub: in production it would be a call to a "deep"
// model grading the answer. Here a pure function keeps things reproducible,
// but the interface is that of a judge.

import { createContainer } from "../infrastructure/container.js";
import { CapturingLogger } from "../infrastructure/observability/logger.js";
import type { AgentResponse } from "../core/domain/request.js";

export interface EvalCase {
  name: string;
  prompt: string;
  // Optional deterministic assertion: the exact expected answer.
  expectExact?: string;
}

export interface JudgeVerdict {
  score: number; // 0 to 1
  passed: boolean;
  reason: string;
}

export interface EvalCaseResult {
  name: string;
  deterministicOk: boolean;
  judge: JudgeVerdict;
}

export interface EvalReport {
  cases: EvalCaseResult[];
  passRate: number;
}

// Judge-model stub: grades relevance through a deterministic heuristic.
// Toy criterion: the answer mentions the model tier and is not empty.
export function stubJudge(prompt: string, response: AgentResponse): JudgeVerdict {
  const hasTierTag = /\[(fast|balanced|deep)\]/.test(response.answer);
  const nonEmpty = response.answer.trim().length > 0;
  const echoesPrompt = response.answer.includes(prompt.slice(0, 10));
  const score =
    (hasTierTag ? 0.4 : 0) + (nonEmpty ? 0.3 : 0) + (echoesPrompt ? 0.3 : 0);
  return {
    score,
    passed: score >= 0.7,
    reason: `tag=${hasTierTag} nonEmpty=${nonEmpty} echoesPrompt=${echoesPrompt}`,
  };
}

// Eval set used by the harness. NOTE: a true hold-out lives outside the
// repo, invisible to whoever optimizes — anything committed here is, by
// construction, visible to the optimizer and must be treated as a dev set.
export const EVAL_CASES: EvalCase[] = [
  {
    name: "simple_greeting",
    prompt: "hello",
    // The echo answer includes the tool results injected into the synthesis
    // prompt (the orchestrator feeds tool outputs to the model).
    expectExact: '[fast] echo: hello\n\n[tool_results]\nword_count: {"words":1}',
  },
  {
    name: "deep_analysis",
    prompt:
      "analyse in detail the trade-offs of our agentic execution topology",
  },
];

// Runs the harness on a set of cases. Deterministic container (frozen ids).
export async function runEval(cases: EvalCase[] = EVAL_CASES): Promise<EvalReport> {
  let counter = 0;
  const container = createContainer({
    logger: new CapturingLogger(),
    newRequestId: () => `eval_${++counter}`,
  });

  const results: EvalCaseResult[] = [];
  for (const c of cases) {
    const response = await container.useCase.handle({ prompt: c.prompt }, "viewer");
    const deterministicOk =
      c.expectExact === undefined ? true : response.answer === c.expectExact;
    const judge = stubJudge(c.prompt, response);
    results.push({ name: c.name, deterministicOk, judge });
  }

  const passed = results.filter((r) => r.deterministicOk && r.judge.passed).length;
  return { cases: results, passRate: passed / Math.max(results.length, 1) };
}
