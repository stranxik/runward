---
title: Untrusted Input, Prompt Injection and the Lethal Trifecta
requires: junit
impact: CRITICAL
asi: [ASI01, ASI06]
phases: [floor, govern]
nonScope: Proves injection defenses were decided and traced; does not prove resistance to any actual injection attempt — only adversarial testing on the running system can
impactDescription: Treats prompt injection as a first-rank, structural threat constrained by architecture rather than detected by heuristics
tags: [security, llm, injection, trifecta, untrusted-input]
noTerritory: The defence is the shape of the whole system — no path may hold private data, untrusted content and an outbound channel at once — so the rule governs every path rather than a class of files.
---

## Untrusted Input, Prompt Injection and the Lethal Trifecta

> **Everything observed through a tool is data, not instructions.** Web pages, documents, retrieved memories, tool results, file contents: none of it carries authority to act.

Prompt injection is the first-rank threat of an agentic system: hostile instructions slipped into the input. The direct form comes from the user; the indirect, more pernicious form hides in retrieved content (a page, a document, a memory) and fires when the model ingests it. It is therefore intrinsic to any memory or retrieval. You do not reliably *detect* it. You *constrain* it by architecture.

**The lethal trifecta.** The worst case is three properties meeting on one unguarded path:

1. access to private data,
2. ingestion of untrusted content,
3. a means of communication to the outside.

Remove any one of the three and the path is defused.

**Operational rule, scoped to the context window:** while untrusted content is present in the context, allow only two of those three properties at once. If all three are genuinely needed, the action does not auto-execute: it requires human approval.

**Incorrect:**

```typescript
// Untrusted page text flows straight into a tool that can exfiltrate.
const page = await fetch(url);                 // untrusted content
const data = await db.readPrivate(userId);     // private data
await sendEmail(extractRecipient(page), data); // BAD: trifecta: page chose the recipient
```

**Correct:**

```typescript
// Break the trifecta structurally: the recipient is only ever accepted
// from the user's request field. There is no code path that extracts a
// recipient from fetched content, so provenance is established by
// construction — not by detecting where a value "came from" after the fact.
const page = await fetch(url);              // untrusted content: data only
const data = await db.readPrivate(userId);
await sendEmail(request.recipient, data);   // recipient: user request field, nothing else

// If the workflow genuinely needs a recipient found in observed content,
// that action does not auto-execute: it is routed to human approval.
await requestHumanApproval({ action: 'sendEmail', to: candidateFromPage, payload: data });
```

**Constrain, do not detect:**

- **Least privilege.** Each tool gets the narrowest scope; a third-party connector is untrusted input.
- **Approval on the action.** Human approval is anchored in the tool's contract and enforced by infrastructure, not by the prompt.
- **Suspend, do not block.** A sensitive action serialises the agent's state and rehydrates it on the human decision (fail-closed without freezing the process); low-urgency approvals are batched in a prioritised queue.
- **Separate the untrusted.** Keep untrusted content out of the same path as private data and an outbound channel.

**Why this is structural, not behavioural:** a guard you can argue the model out of is not a guard. Approval anchored in the tool contract, least privilege enforced by infrastructure, and a broken trifecta hold regardless of what the injected text says.

**Checklist:**

- [ ] Observed content is treated as data; it never authorises an action.
- [ ] No path holds all three trifecta properties while untrusted content is in context.
- [ ] Sensitive actions require approval anchored in the tool contract.
- [ ] Approval suspends-and-rehydrates; it does not freeze the process.
