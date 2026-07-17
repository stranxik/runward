# Test fixtures

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
