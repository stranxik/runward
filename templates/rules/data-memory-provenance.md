---
title: Memory Carries Provenance; an Untrusted Write Cannot Act Unreviewed
impact: HIGH
asi: [ASI06]
phases: [govern]
impactDescription: Every stored memory item carries its origin and trust tier; a memory written from untrusted content is quarantined and cannot influence a privileged action without human review
tags: [security, memory, provenance, poisoning]
---

# Memory carries provenance; an untrusted write cannot act unreviewed

> Prompt-injection defense guards the context window at read time. Memory poisoning is the same attack shifted in time: hostile content is written to memory now and replayed as trusted instruction later, long after the injection is out of the window. The write path needs its own guard.

**The rule.** Every stored memory item carries provenance: its origin, its trust tier (trusted / derived / untrusted), and its write time. An item written from untrusted content (a retrieved page, a tool output, a user message) is stored **quarantined** — usable as *data* for recall, never promotable to instruction, and never load-bearing for a privileged action without human review. Trust is a property of the write, recorded once and never silently upgraded on read.

```
memory.write(item, source):
  item.provenance = { origin: source.id, trust: source.trust, at: now }
  store(item)

memory.recall(query) -> items            # returns data; provenance travels with each item
guardPrivilegedAction(item):
  if item.provenance.trust != "trusted":
    require(humanReview)                  # a quarantined memory cannot act alone
```

**Boundary.** Deterministic provenance tagging plus a fail-closed guard on the action path — no model judgment of trust. Complements `security-prompt-injection` (read-time), `data-memory-invalidation` (revocation) and `state-event-sourcing` (traceability). Maps to OWASP Agentic ASI06 (memory & context poisoning).
