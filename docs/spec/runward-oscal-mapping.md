# The runward OSCAL mapping — gate-level audit evidence for agentic delivery

**Spec version: 1.0** · 2026-07-16 · status: stable · changes: additive within 1.x; a breaking change bumps the major and leaves this text in place.
**Normative example**: [`test/fixtures/golden/oscal-component-definition.json`](../../test/fixtures/golden/oscal-component-definition.json) — the byte-exact output of the reference implementation on a freshly scaffolded mission, verified by a golden test on every commit.
**Cite as**: see [`CITATION.cff`](../../CITATION.cff) at the repository root.

This document specifies how runward derives a machine-readable [OSCAL](https://pages.nist.gov/OSCAL/) component-definition from a mission's engineering artifacts, so that a GRC tool, an auditor or another implementation can consume — or reproduce — the mapping without reading runward's source. It is written to be implementable independently.

**Scope, stated once.** The output is *supporting evidence assembled deterministically at the delivery gate*. It is never a compliance claim, never a certification, never a conformity assessment. Applicability, risk acceptance and management sign-off remain the operator's. No credible maintained OSS OSCAL ingester existed at the date of writing (dated evaluation: [`docs/compliance/oscal-ingest.md`](../compliance/oscal-ingest.md)); the shipped proof is validation against the vendored NIST OSCAL 1.1.2 JSON schema with negative controls.

---

## 1. The evidence chain

The mapping's unit is a **traced engineering decision**, not a catalogue entry. Four layers, each an artifact at rest:

```
craft rule (versioned, ASI-mapped)                 runward/rules/<slug>.md
  → decision record                                 runward/adr/ADR-NNNN-*.md
  → rule-conformance manifest row                   "## Rule conformance" table in a gated deliverable
     (applied + evidence pointer | deviated + ADR | n/a + reason)
  → OSCAL implemented-requirement                   oscal-component-definition.json
```

- A **craft rule** declares its OWASP ASI mapping in frontmatter: `asi: [ASI01, …]` — values match `/^ASI\d{2}$/` after uppercasing; anything else is ignored.
- A **gated deliverable** carries a `## Rule conformance` markdown table with columns `Rule | Status | Evidence`. Statuses are exactly `applied`, `deviated`, `n/a`. As of runward v0.16, the gated (phase, deliverable) pairs are: `architect → architecture.md`, `topology → execution-topology.md`, `floor → floor.md`, `govern → governance/threat-model.md`, `handover → handover.md`.
- The gate (`runward check --strict`) verifies the manifests **and the evidence's shape** before the pack is credible: typed pointers resolve to real, non-empty content; signed rules match their signature; stale pointers fail; an optional seal (`evidence-lock.json`, §6) hashes the evidence at crossing time.

Because every OSCAL statement below is derived from these artifacts and nothing else — no live state, no network, no model call — the output is a pure function of the repository's content plus one date input.

## 2. Document shape

One JSON document, an OSCAL **`component-definition`** (not `assessment-results`), `oscal-version: "1.1.2"`, validating against NIST's `oscal_component_schema`:

```
component-definition
├── uuid                       (deterministic, §5)
├── metadata
│   ├── title                  "runward — agentic-security control evidence (<mission>)"
│   ├── last-modified          "<generatedAt>T00:00:00Z"
│   ├── version                "<generatedAt>"
│   ├── oscal-version          "1.1.2"
│   ├── props                  [{ name: "runward-regime-lens", value: "<regime>@<version>" }]   (§4)
│   └── remarks                the scope statement (draft / supporting evidence / never a claim)
└── components[1]
    ├── uuid, type: "software", title: <mission name>
    └── control-implementations[1]
        ├── uuid
        ├── source             https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
        └── implemented-requirements[10]      one per ASI category, §3
```

`<generatedAt>` is the generation date (`YYYY-MM-DD`); implementations MUST allow it to be injected (runward: the `RUNWARD_NOW` environment variable in non-interactive runs) so reruns can be byte-identical.

## 3. Controls and the status derivation rule

The control set is the **OWASP Top 10 for Agentic Applications** (ASI01–ASI10) — the regime-neutral grammar; regulatory regimes are lenses above it (§4). Each category becomes one `implemented-requirement`:

- `control-id`: `asi-01` … `asi-10` (lowercase, zero-padded).
- `description`: the category name plus either `"Addressed by rules: <slug list>."` or `"No rule mapped — gap to assess."`.
- `props`: exactly one, `{ name: "implementation-status", value: <status> }`.

**The derivation rule** — given, for one ASI category, the set of rules mapped to it and the manifest rows of those rules across all gated deliverables:

| Condition | `implementation-status` |
|---|---|
| No rule maps this category | `planned` — an unaddressed risk is a gap, stated as one |
| At least one mapped rule has a manifest row, and **every** row found is `applied` | `implemented` |
| Anything else (a `deviated` or `n/a` row, or mapped rules not yet in any manifest) | `partial` |

Note the honest asymmetry: mapping a rule without accounting for it yields `partial`, never `implemented` — paper coverage does not upgrade the status.

## 4. The regime lens

Regulatory regimes (ISO/IEC 42001, NIST AI RMF, EU AI Act) never change the OSCAL structure: they are **versioned data lenses** rendered as human-readable readiness drafts beside it. The OSCAL records which lens produced the pack in `metadata.props`: `{ name: "runward-regime-lens", value: "<regime>@<mapping-version>" }` (e.g. `eu-ai-act@2024-1689`). A pack is thereby reproducible against the exact mapping text an auditor saw; lens versions are shipped, never silently edited.

## 5. Deterministic UUIDs

Every `uuid` is an RFC-4122-shaped, name-based identifier derived from a stable seed — two runs on the same artifacts produce the same ids:

```
hex   = SHA-256("runward-oscal:" + seed), lowercase hex
d     = first 32 hex digits of hex
d[12] = "5"                                  (version nibble)
d[16] = hex digit of ((int(d[16],16) & 0x3) | 0x8)   (RFC-4122 variant)
uuid  = d[0..8]-d[8..12]-d[12..16]-d[16..20]-d[20..32]
```

**Seed grammar** (`<ns>` is the mission name — the project root's directory basename):

| Object | Seed |
|---|---|
| component-definition | `<ns>:component-definition` |
| component | `<ns>:component` |
| control-implementation | `<ns>:control-implementation` |
| implemented-requirement for ASIxx | `<ns>:ir:ASIxx` (e.g. `<ns>:ir:ASI01`) |

## 6. Byte identity and the evidence seal

- **Byte identity**: same artifacts + same `<generatedAt>` ⇒ byte-identical output (stable key order, 2-space indentation, trailing newline). This is a tested invariant (the golden test), not an aspiration. Across days, only the two date-bearing metadata fields differ.
- **The evidence seal** (`runward/evidence-lock.json`, format `version: 1`): an opt-in record taken on a green gate — `{ "version": 1, "sealedAt": "<date>", "files": { "<root-relative path>": "<sha256 hex>" } }`, keys sorted, sealing every evidence file the manifests' `applied` rows resolve to. A sealed file that later changes or disappears fails the gate until re-verified and re-sealed. For an auditor, the seal answers "is the evidence the pack cites still the evidence that crossed?" with a hash, not a promise.

## 7. Conformance of an independent implementation

An implementation conforms to this mapping if its output (a) validates against the NIST OSCAL 1.1.2 component-definition schema, (b) reproduces the normative example byte-for-byte from the same input artifacts, mission name and date, and (c) derives `implementation-status` exactly per §3 — including the paper-coverage asymmetry. Extensions MUST be additive (new props, never repurposed ones).

---

*Maintained with runward (MIT). The reference implementation is `src/lib/compliance.ts`; where this text and the normative example disagree, the example wins and the text gets fixed — a spec drifting from its conformance suite is a defect.*
