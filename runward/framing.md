# Framing Note: runward

**Date**: 2026-07-16 · **Sponsor**: Thibault Souris (maintainer) · **Entry mode**: greenfield · **Stopping tier**: full chain

## 1. Problem

Teams that deliver software with coding agents accumulate generated code faster than they accumulate decisions. The spec-driven tools cover the moment before the code is written; nothing covers the moment after: which architecture rules the change was held to, which decisions were made and why, and what evidence says a rule was actually applied rather than merely cited. The friction is lived by the maintainer who inherits an agent-built codebase and by the operator who must answer "why is it like this?" months later — today the answer is archaeology through commit messages and chat transcripts. A per-rule conformance gate that a CI can run — deterministic, repeatable, with no model in the verdict — did not exist.

## 2. Value

If this works, an operator can hold agent-delivered changes to a named rule set and refuse to cross a phase gate until every CRITICAL/HIGH rule is accounted for with evidence. Value lands three ways: decisions stop being lost (the ADR journal and the mission deliverables are gated, not optional), lying to the gate gets expensive (typed pointers are resolved, symbols checked, signatures matched — bytes, not vibes), and the same artifacts later feed a compliance evidence pack at no extra cost. The beneficiaries are maintainers of agent-assisted repositories and the operators accountable for them, on every gated change.

## 3. Observable success criterion

`runward check --strict` gives a deterministic, replayable verdict: the same working tree always produces the same exit code (0 green, 1 gaps, 2 no mission), with every violation named and actionable. Operationally observed as: the full CI chain green on every commit to main (unit, fuzz, golden OSCAL, smoke, network-isolated core run), and the package installable from npm with provenance. Adoption of the OSS package is the trailing indicator — watched, not gated.

## 4. Floor

The smallest system that proves the value is the CLI itself: `init` scaffolds a mission, `check --strict` verifies the rule-conformance manifests deterministically, `status` names the open gate. Persistence is the operator's own git repository — runward writes markdown and JSON into `runward/` and nothing else. Guardrails are structural: zero network, zero model call, zero telemetry in `src/`. Observability is the CI chain and the exit-code contract. That floor shipped first and the rest of the chain (manifest sync, typed evidence, sealing, compliance packs) grew on its own gate discipline.

## 5. Target (named, not built)

A rule set rich enough that regional regulatory profiles (EU AI Act, ISO 42001, NIST AI RMF) stay thin lenses over one universal manifest; harness adapters for every major CI and agent harness, all inert samples the operator wires; a brownfield path (`characterize`) that reconstructs decisions from an existing repository as ratifiable hypotheses. No runtime ambitions: runward never executes the operator's code, never deploys, never proxies a model.

## 6. Named deferrals

| Deferred capability | Lean default in place | Trigger to revisit |
|---|---|---|
| LLM-assisted conformance judgment | deterministic form/evidence checks only; the semantic pass is an agent-run workflow above the gate (ADR-0007) | never enters the verdict; revisit only the advisory workflow's ergonomics |
| Auto-wiring the gate into git hooks or CI | inert adapter samples in `templates/adapters/` the operator copies (ADR-0012) | none — writing into `.git/` or CI config is out of scope by decision |
| A web dashboard or hosted service | local CLI output plus machine-readable JSON (`rules --json`, OSCAL) | sustained demand from operators who cannot run a CLI; would be a separate product, same gate |
| Usage telemetry | none — the CLI emits nothing | none for data leaving the machine; a local, operator-readable stats file could be considered on demand |

## 7. Hard constraints

- **Deterministic verdict**: no model call and no network call anywhere in `src/` — enforced by a CI grep guard and by running the core tests inside a no-network namespace.
- **Sovereignty**: no user data ever leaves the operator's machine; no telemetry, no phone-home, no crash reporting.
- **Not a runtime**: runward reads files and writes into `runward/` (plus files the operator explicitly asks for); it never executes the operator's code.
- **Vendor neutrality**: every agent harness and CI is a peer; no adapter is privileged.
- **Supply chain**: published to npm with SLSA provenance from a SHA-pinned release workflow.

## 8. Presumed boundaries

One primary port: the gate itself — a process contract (argv in; exit code 0/1/2 plus human-readable and machine-readable output). Secondary boundaries: the filesystem (read the working tree, write `runward/`) and local git for `characterize`'s archaeology. The integration protocol with harnesses and CIs is deliberately the thinnest one that exists: run a process, read its exit code. Language and internal structure were left open at framing; they are locked in `architecture.md` and the decision matrix.

## 9. Definition of Ready check

| Condition | Status | If missing: named risk |
|---|---|---|
| Real problem, identified sponsor | met — the maintainer is sponsor and first operator | — |
| Observable success criterion | met — deterministic exit-code contract plus green CI chain | — |
| Floor-first principle accepted | met — the CLI shipped as `init`/`check`/`status` before any richer feature | — |
| Access to the real process and people | met — the repo itself is the delivery process under study | — |
| Usable data or a path to it | met — the doctrine's rule set, versioned in `templates/rules/` | — |
| Access to technical infrastructure | met — GitHub Actions, npm registry | — |
| Hard constraints known | met — §7, enforced in CI | — |
| Human available to decide and approve | met — the maintainer curates every rule and ADR | — |
