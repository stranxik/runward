---
title: Re-approve a Tool on Any Change to Its Signed Definition
impact: HIGH
asi: [ASI02, ASI04]
phases: [govern]
impactDescription: A change to a registered tool's definition (name, schema, description, permissions) forces re-approval before the agent may call it, closing the rug-pull window
signature: re[-\s]?approv|re[-\s]?authori[sz]
nonScope: A matching signature proves a re-approval or re-authorisation token appears in the cited evidence; it does not prove the gate blocks an unapproved tool change at runtime or that every registered tool is covered.
tags: [security, tools, approval, supply-chain]
noTerritory: The gate sits in the tool registry, a component the rule identifies by responsibility and never by location, so no path selects the code it governs.
---

# Re-approve a tool on any change to its signed definition

> Approval is not a one-time event. A tool approved once and never re-checked is a standing invitation to a rug-pull: change the description or widen the permissions after approval, and the agent keeps calling it.

**The rule.** The tool registry records, per tool, a signature over its full definition (name, input/output schema, description, declared permissions). Any change to that signature **revokes the prior approval**: the tool moves to a pending state and the agent may not call it until an operator re-approves the new definition. Re-approval is deterministic and human-owned — the registry gates the call, never the model's discretion.

```
registry.resolve(toolCall):
  tool = registry[toolCall.name]
  if sign(tool.definition) != tool.approvedSignature:
    tool.state = "pending-reapproval"
    deny(toolCall)                       # gated by infrastructure, not by the model
    notifyOperator(tool, diff(tool.definition, tool.approvedDefinition))
```

**Boundary.** Deterministic, infrastructure-enforced, operator-owned — it never asks the model to judge whether a change is safe. Pairs with `security-mcp-server-pinning` (pin the surface) and `tools-registry-pattern` (filter by role). Maps to OWASP Agentic ASI02 (tool misuse) and ASI04 (supply-chain).
