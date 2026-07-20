# ADR-0037: `runward characterize` detects infrastructure and framework/DB config signals (presence only)

**Date**: 2026-07-20
**Status**: proposed
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — resume-existing audit finding, reality-checked against `detectContainers` (`characterize.ts:143`, a short fixed list) and the M2 need for an architecture note that starts from real signals.

## Context

`detectContainers` (`characterize.ts:143`) checks a small fixed list (Dockerfile, compose, vercel/netlify/fly, Procfile, Chart.yaml). It misses the signals that most define a modern system's architecture: **Infrastructure-as-Code** (Terraform, Pulumi, Kubernetes manifests, `serverless.yml`, AWS SAM) and **framework/DB configuration** (`next.config.*`, `vite.config.*`, `nuxt.config.*`, `tsconfig.json`, `prisma/schema.prisma`, `drizzle.config.*`, `alembic.ini`). For brownfield mode `M2 — join a project in flight`, the architecture note is reconstructed "by observation" — but `characterize` hands the observer almost nothing on the infra/architecture axis. These are pure-presence facts sitting at rest in the repo.

## Decision

**`characterize` adds two presence-only detectors and reports them as facts, feeding `--mine` candidates.**

- **Infrastructure & deployment.** Detect presence of `*.tf`/`*.tf.json` (bounded walk), `Pulumi.yaml`, Kubernetes manifests (a `k8s/`/`kubernetes/` dir or `kustomization.yaml`), `serverless.yml`/`serverless.yaml`, `template.yaml`/`samconfig.toml` (SAM). Report under a new **"Infrastructure & deployment"** section, sorted.
- **Framework / DB config.** Detect presence of `next.config.*`, `vite.config.*`, `nuxt.config.*`, `svelte.config.*`, `astro.config.*`, `tailwind.config.*`, `tsconfig.json`, `prisma/schema.prisma`, `drizzle.config.*`, `alembic.ini`, `knexfile.*`. Report under **"Framework / DB config"**, sorted.
- **Presence, never intent.** The report says "a Terraform configuration is present", never "infrastructure is well-managed" or "the DB schema is X". Pure existence; parsing the content into an architecture claim is the operator's job (ADR-0013).
- **Feeds `--mine`.** A detected IaC/framework signal becomes a candidate DRAFT (ADR-0038) — a hypothesis with provenance, `why: UNKNOWN`, never an asserted architecture.

Deterministic (sorted), read-only, zero-LLM.

## Alternatives discarded

- **Parse the IaC/config to extract the real topology** (resources, providers, the DB schema). Rejected: heavy, per-tool, and interpretive — it manufactures an architecture claim from a machine read, the overclaim ADR-0014 forbids. Presence is a fact; topology is reconstructed by the operator.
- **One ever-growing flat "deploy descriptors" list.** Rejected: infra and framework/DB config answer different questions (how it ships vs what it is built on); two labelled sections are more legible and map to the architecture note's structure.
- **Deep-walk for every possible config filename.** Rejected as unbounded/noisy; a curated, bounded set of high-signal markers (the ones that actually define architecture) via the existing bounded `walk()` and root checks.

## Consequences

- **Positive.** The M2 architecture note starts from real infra/framework signals instead of zero. `--mine` gains meaningful structural candidates beyond stack/CI/deps. Still offline, reproducible, fact-only.
- **Negative, accepted.** A curated marker list will lag new tools; extending it is a one-line addition per marker (and a reopening trigger watches for the gap). Presence without parsing can feel thin — deliberately, to stay on the fact side.
- **On other boundaries.** `Inventory` grows `infra` + `frameworkConfig` lists; `renderCharacterization` grows two sections; `mineDrafts` (ADR-0038) consumes them. The gate is untouched.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) a common IaC/framework marker is repeatedly missing from real repos — extend the curated list; (b) operators need parsed topology (resource inventory, schema tables) badly enough to justify per-tool parsing behind the read-only contract — then design it as labelled facts or `--mine` hypotheses, never an asserted architecture; or (c) the presence lists prove too noisy (false positives on vendored configs).

**Trigger set on**: 2026-07-20 · **Watched via**: dogfooding `characterize` on infra-heavy repos.

## References

- [ADR-0014](ADR-0014-the-characterize-command-contract.md) — the read-only/fact-only contract this extends.
- [ADR-0013](ADR-0013-retro-documentation-as-transmission-pointed-backward.md) — presence-fact vs operator-reconstructed architecture.
- `src/lib/characterize.ts` (`detectContainers` neighbours, `renderCharacterization`, `mineDrafts`) — edited.
- The resume-existing / brownfield audit (2026-07-20).
