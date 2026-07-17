# Ingesting the OSCAL export into a GRC tool

`runward compliance <regime>` writes `runward/compliance/oscal-component-definition.json` — an OSCAL
**component-definition** (v1.1.2), the machine-readable layer of the evidence pack (ADR-0016). The
shipped, offline proof of well-formedness is schema validation against the vendored NIST schema with
negative controls (`test/oscal-schema.js`). This note covers the next hop: feeding it to a GRC tool.

## Third-party ingestion proof, in CI (2026-07-17)

The schema check above proves *our* copy of the NIST schema is satisfied. To answer the harder
question a regulated buyer asks — does the pack load in a real, independent OSCAL tool? — a dedicated
CI job (`oscal-ingest` in `.github/workflows/ci.yml`) generates a pack from the reference mission and
loads it in **IBM compliance-trestle** (`test/oscal-ingest.py`): a compliance toolkit used in
FedRAMP/NIST workflows, whose Pydantic models are generated from the NIST OSCAL metaschemas. If the
pack violates the NIST model, `oscal_read` raises and the job fails. This closes the
"validated only against our vendored schema" gap (ADR-0031).

It lives in a *separate* CI job (Python, with network to `pip install` trestle), **not** in the core
Node test path — the core stays zero-dependency and network-isolated (ADR-0001). Because trestle is
Python, the npm-registry evaluation below (which found no offline-clean *Node* ingester for the test
path) does not apply to it. End-to-end ingestion into a specific GRC **SaaS** (RegScale/Paramify/Xacta)
remains the operator's step; this proves the artifact is ingestible by a genuine third-party tool.

## Real-ingest test dependency in the Node path: evaluated, none adopted (2026-07-16)

ADR-0022 (point 5) conditions a real-ingest CI test *in the offline Node test path* on a credible,
maintained OSS OSCAL ingester that runs offline after install. Evaluation of the npm registry on 2026-07-16:

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
