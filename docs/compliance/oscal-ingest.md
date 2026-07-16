# Ingesting the OSCAL export into a GRC tool

`runward compliance <regime>` writes `runward/compliance/oscal-component-definition.json` — an OSCAL
**component-definition** (v1.1.2), the machine-readable layer of the evidence pack (ADR-0016). The
shipped, offline proof of well-formedness is schema validation against the vendored NIST schema with
negative controls (`test/oscal-schema.js`). This note covers the next hop: feeding it to a GRC tool.

## Real-ingest test dependency: evaluated, none adopted (2026-07-16)

ADR-0022 (point 5) conditions a real-ingest CI test on a credible, maintained OSS OSCAL ingester that
runs offline after install. Evaluation of the npm registry on 2026-07-16:

| Package | Last publish | Verdict |
|---|---|---|
| `oscal` (oscal-js, GSA) | 2024-12 | Rejected — stale (~19 months); runtime deps include `openai` and the squatted `child_process` npm placeholder; validation shells out to the Java `oscal-cli`. Not offline-clean, dependency hygiene disqualifying for the gate's test path. |
| `@grc-claw/oscal` | 2026-06 | Rejected — single release ever (0.8.0), single personal maintainer, no track record, no dependents. |
| `lula2` (Defense Unicorns) | 2026-02 | Rejected — a GitHub compliance-as-code app (express/ws server), not a parse/import library API. |
| `attesting` | 2026-04 | Rejected — 0.x single-maintainer platform (express + sqlite + react deps), not an ingest library. |
| `@mitre/hdf-converters` | 2026-07 | Rejected — actively maintained, but converts scanner outputs to/from HDF; no OSCAL component-definition import path. |
| `@easydynamics/oscal-types`, `oscal-types`, `@oscal/oscal-deep-diff` | 2021–2023 | Rejected — type stubs / diff tooling, abandoned; not ingesters. |

Conclusion: **no dependency added**. A flaky or abandoned package in the test path is worse than an
honest documented boundary. Re-evaluate at each regime-mapping release review (ADR-0022 trigger).

## Manual ingest procedure

The export is a standard OSCAL 1.1.2 component-definition, so any OSCAL-aware GRC tool takes it as-is:

1. Generate the pack: `runward compliance <regime>` (pin the lens with `--regime-version` if needed).
   The lens that framed the pack is stamped in `metadata.props` (`runward-regime-lens`, e.g.
   `eu-ai-act@2024-1689`) — keep it with the pack so a reviewer can re-assemble against the same lens.
2. Pre-flight (optional, offline): validate against the NIST schema vendored in this repo —
   `npx ajv-cli validate -s test/fixtures/oscal_component_schema.v1.1.2.json -d runward/compliance/oscal-component-definition.json --spec=draft7`.
3. Import `oscal-component-definition.json` as a **component definition** in your GRC tool
   (e.g. RegScale, Paramify, Xacta, or NIST's oscal-cli for format conversion to XML/YAML).
   The 10 implemented-requirements map the OWASP ASI01–ASI10 categories with a derived
   `implementation-status` (`implemented` / `partial` / `planned`).
4. Attach the human-readable readiness draft (`<regime>-readiness.md`) alongside it as the narrative
   evidence, and fill the "Required from the operator" sections yourself.
5. Hand the result over as **supporting evidence** — never as a certification or a conformity claim.
