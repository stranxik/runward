# Reference Stack: runward

The generic reference stack (model gateway, persistence tiers, identity, observability backends) mostly does not apply here — runward has no model, no store, no service. This note records the stack actually in use, with its triggers.

| Layer | Choice in use | Evolution trigger |
|---|---|---|
| Language & runtime | TypeScript strict, ESM, Node ≥ 20; plain `tsc` build, no bundler | a capability that genuinely needs another runtime — none identified; a bundler only if install size becomes a measured problem |
| Runtime dependencies | exactly three: `commander` (CLI parsing), `chalk` (color), `inquirer` (init wizard prompts) | any of them unmaintained or with an open vulnerability window → replace or vendor; every addition is an ADR |
| Data | rules, templates, workflows and regime mappings as markdown + JSON, versioned in the package — no runtime fetch, ever | rule-set size outgrowing the npm package → a versioned data package, still no runtime fetch |
| Tests | node:test unit suites, seeded fuzz, byte-identical golden OSCAL with negative controls, end-to-end smoke, NIST schema validation | new gate surface ⇒ new unit suite before it ships |
| CI | GitHub Actions, all actions SHA-pinned; matrix on Node 20/22/24; grep guard + network-namespace-isolated core run; OSSF Scorecard; Dependabot | — |
| Distribution | npm, published only from the release workflow with `npm publish --provenance` (SLSA attestation via OIDC) | registry trust incident → mirror/alternate registry, decided by ADR |

What this stack deliberately omits: any model SDK, any HTTP client, any telemetry library, any database driver. Their absence is enforced in CI, not just intended — see [governance/threat-model.md](governance/threat-model.md) §3. For the generic doctrine defaults (model gateway, persistence tiers, identity, observability), read the shipped template `templates/mission/reference-stack.md`; they describe the systems runward gates, not runward itself.
