---
title: Pin Every Consumed Tool/MCP Server by Version and Hash
impact: CRITICAL
asi: [ASI04, ASI10]
phases: [architect, govern]
impactDescription: A consumed tool or MCP server is pinned by version and content hash, so a supply-chain swap or rug-pull cannot silently change what the agent may call
tags: [security, supply-chain, mcp, tools, integrity]
---

# Pin every consumed tool/MCP server by version and hash

> Everything the agent calls is part of your attack surface. A server you trusted at approval time can change its tool set after the fact (a "rug-pull"): a tool that summarized yesterday exfiltrates today. Trust the version you reviewed, not the endpoint.

**The rule.** Every external tool provider — an MCP server, a plugin, a remote tool endpoint — is pinned to a specific version **and** a content hash of its declared tool set (names, schemas, descriptions, permissions). The pin is recorded in the mission, versioned with the code. On connect, the agent verifies the live tool set against the pinned hash. A mismatch **fails closed**: the tools are not exposed to the model until the change is re-reviewed and the pin is updated on purpose (see `security-tool-change-reapproval`).

**Why structured trust is not enough.** A schema tells you a tool is well-formed, not that it is the tool you approved. Only a pinned hash of the declared surface catches a silent redefinition.

```
onConnect(server):
  live = hash(server.declaredTools)      # names + schemas + descriptions + permissions
  if live != pinned[server].hash:
    reject(server)                       # fail closed — do NOT expose to the model
    raise ToolSurfaceChanged(server, pinned[server].version)
```

**Boundary.** This is a deterministic integrity check on the tool surface, not a judgment of the tool's behavior. It belongs at the integration boundary (architect) and is enforced at run (govern). It maps to OWASP Agentic ASI04 (supply-chain) and ASI10 (rogue resources).
