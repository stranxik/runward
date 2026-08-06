---
title: Every Port Has a Named Placement
impact: HIGH
phases: [topology]
impactDescription: Keeps the execution topology traced port by port, so a placement never drifts unseen behind the domain
tags: [topology, placement, ports, infrastructure]
appliesTo: [**/execution-topology.md, **/architecture.md]
---

## Every Port Has a Named Placement

> **The port is the bridge between the two visions.** The domain says what a port does; the topology says where its adapter runs. A port with no named placement is a decision no one made.

Every domain port named in `architecture.md` carries, in `execution-topology.md`, a location family: in-app, existing infrastructure, dedicated internal platform, managed infrastructure service, or managed model-vendor runtime. The grid is stable; its filling is a dated, context-specific exercise left to the operator. A placement that is not in-app is a structuring decision: lock it in an ADR. Moving a placement never changes the domain, "a service is just an adapter that has migrated into its own process; the domain does not change", so the row moves and the port does not. runward traces the placement decision; it never deploys.
