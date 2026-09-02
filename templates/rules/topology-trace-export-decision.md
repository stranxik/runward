---
title: Trace Export Is a Decision, Because Traces Are Data
requires: adr
impact: HIGH
phases: [topology]
asi: [ASI04]
impactDescription: Stops the most sensitive payloads leaving under the name "telemetry" without a named, reviewed decision
tags: [topology, observability, data, exfiltration]
appliesTo: [**/execution-topology.md, **/governance/observability-schema.md]
---

## Trace Export Is a Decision, Because Traces Are Data

> **Execution traces contain the prompts and the outputs: your most sensitive payloads.** Shipping them to a third party under the name "telemetry" is exfiltration unless a decision says otherwise.

Any export of execution traces to a third-party service is either absent, or covered by a traced decision naming the recipient, the data class, and the retention, the same review as any data transfer. "Exporting them to a third-party service is an exfiltration like any other." Traces follow the same sovereignty gradient as the data they carry, and the decision lives in `execution-topology.md`, cross-referenced from `governance/observability-schema.md`.
