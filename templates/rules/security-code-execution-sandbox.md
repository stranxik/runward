---
title: Unexpected Code Execution Runs Sandboxed, Never In-Process
impact: CRITICAL
asi: [ASI05, ASI02]
phases: [govern]
impactDescription: Caps the blast radius of any code the agent runs (generated or tool-provided) by isolating it from the host, secrets and network
tags: [security, code-execution, sandbox, isolation]
---

## Unexpected Code Execution Runs Sandboxed, Never In-Process

> **Code the model produced, or a tool ran, is untrusted input that acts.** It executes in an isolated, least-privilege sandbox, never in the agent's own process.

Any path where a model output becomes execution — a code interpreter, a shell tool, an `eval`, a generated script, a plugin that runs code — is treated as **unexpected code execution** and confined:

- **Isolation, not trust.** The code runs in a sandbox with no access to the host filesystem, the agent's process memory, the network, or secrets, unless a capability was explicitly and narrowly granted. Generated code never inherits the agent's privileges.
- **An explicit, approved capability, never an implicit tool.** "Run arbitrary code" is not a default tool the model may call at will; it is a declared, approval-gated capability with a bounded scope (allowed language, timeout, resource ceiling, allowed paths and syscalls).
- **No path from untrusted content to execution.** Retrieved or user-supplied content must not reach a code-execution surface without the deterministic guard and human approval on the action (see `security-prompt-injection`, the 2-of-3 rule).

Form validation is not enough: a model can emit syntactically valid code that deletes data or exfiltrates a secret. The boundary around execution is owned and tested, not hoped.
