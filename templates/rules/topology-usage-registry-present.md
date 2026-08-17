---
title: A Usage Registry, Because Risk Is Classed by Deployment
impact: HIGH
phases: [topology]
noAsi: regulatory risk classification per deployment (the EU AI Act reading), not an ASI attack category.
impactDescription: Lets you answer, at audit time, what runs where touching what — risk attaches to a deployment, not a platform
tags: [topology, governance, registry, compliance]
appliesTo: [**/execution-topology.md]
---

## A Usage Registry, Because Risk Is Classed by Deployment

> **The same platform hosts a harmless FAQ bot and an agent with write access to payments.** A platform-level risk label would strangle the first or wave the second through.

Keep a usage registry: per deployment, the risk class, the data classes touched, the action scopes, and the owner, under an identified responsible party and a periodic review. "Risk is classified per deployment, not per platform": the same foundation reused for a sensitive use tips that deployment into a more demanding regime, without the architecture changing. The registry lives in `execution-topology.md`, beside the port → placement map that names what runs where. It is a governed engineering artifact that feeds `runward compliance` through its conformance row, never a compliance declaration in itself.
