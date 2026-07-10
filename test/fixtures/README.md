# Test fixtures

## `oscal_component_schema.v1.1.2.json`

The official NIST OSCAL **Component Definition** JSON Schema, vendored so the
OSCAL export test runs offline (no network in CI).

- **Source**: <https://github.com/usnistgov/OSCAL/releases/download/v1.1.2/oscal_component_schema.json>
- **Release**: OSCAL v1.1.2 (`usnistgov/OSCAL`)
- **Schema `$id`**: `http://csrc.nist.gov/ns/oscal/1.1.2/oscal-component-definition-schema.json`
- **JSON Schema draft**: draft-07
- **sha256**: `7b74710940ad39b6b63d4ddccbadf2c7d2e9bf11b07808d41d2aa27a4616e5ce`

Used by `test/oscal-schema.js` to prove `runward compliance` emits an OSCAL
component-definition that validates against the NIST schema. Pinned to the
`oscal-version` the exporter declares (`renderOscal` in `src/lib/compliance.ts`);
bump both together if the exporter targets a newer OSCAL release.

To refresh:

```sh
curl -sL "https://github.com/usnistgov/OSCAL/releases/download/v1.1.2/oscal_component_schema.json" \
  -o test/fixtures/oscal_component_schema.v1.1.2.json
shasum -a 256 test/fixtures/oscal_component_schema.v1.1.2.json   # update the hash above
```
