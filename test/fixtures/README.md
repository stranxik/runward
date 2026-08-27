# Test fixtures

## `sarif_schema.v2.1.0.json`

The official OASIS **SARIF 2.1.0** JSON Schema, vendored so the SARIF emission test runs
offline (no network in CI), exactly as the OSCAL and in-toto schemas are.

- **Source**: <https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json>
- **Vendored**: 2026-08-27
- **Schema `$id`**: `https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json`
- **JSON Schema draft**: draft-04
- **sha256**: `c3b4bb2d6093897483348925aaa73af03b3e3f4bd4ca38cef26dcb4212a2682e`

Used by `test/sarif-shape.js`. Draft-04 is why it needs `ajv-draft-04` rather than the `ajv`
already here: ajv 8 dropped draft-04 (`id` vs `$id`, boolean `exclusiveMinimum`). That package is
published by the same `ajv-validator` organisation as `ajv` and `ajv-formats`, is dev-only, and the
decision to add it is [ADR-0062](../../docs/adr/ADR-0062-the-sarif-schema-is-validated-against-the-official-one.md).

## `oscal_component_schema.v1.2.2.json`

The official NIST OSCAL **Component Definition** JSON Schema, vendored so the
OSCAL export test runs offline (no network in CI).

- **Source**: <https://github.com/usnistgov/OSCAL/releases/download/v1.2.2/oscal_component_schema.json>
- **Release**: OSCAL v1.2.2 (`usnistgov/OSCAL`)
- **Schema `$id`**: `http://csrc.nist.gov/ns/oscal/1.2.2/oscal-component-definition-schema.json`
- **JSON Schema draft**: draft-07
- **sha256**: `3b6e0765c44037c4d1bfb2cdb972713917d3eca73e566c0e6c6881a565638830`

Used by `test/oscal-schema.js` to prove `runward compliance` emits an OSCAL
component-definition that validates against the NIST schema. Pinned to the
`oscal-version` the exporter declares (`renderOscal` in `src/lib/compliance.ts`);
bump both together if the exporter targets a newer OSCAL release. The bump to
1.2.2 is recorded in [ADR-0032](../../docs/adr/ADR-0032-track-current-oscal-and-watch-dated-external-facts.md).

To refresh:

```sh
curl -sL "https://github.com/usnistgov/OSCAL/releases/download/v1.2.2/oscal_component_schema.json" \
  -o test/fixtures/oscal_component_schema.v1.2.2.json
shasum -a 256 test/fixtures/oscal_component_schema.v1.2.2.json   # update the hash above
```
