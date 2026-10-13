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

## `oscal_component_schema.v1.2.3.json`

The official NIST OSCAL **Component Definition** JSON Schema, vendored so the
OSCAL export test runs offline (no network in CI).

- **Source**: <https://github.com/usnistgov/OSCAL/releases/download/v1.2.3/oscal_component_schema.json>
- **Release**: OSCAL v1.2.3 (`usnistgov/OSCAL`)
- **Schema `$id`**: `http://csrc.nist.gov/ns/oscal/1.2.3/oscal-component-definition-schema.json`
- **JSON Schema draft**: draft-07
- **sha256**: `95e76881151ececd5cb1a93ff0f70ad74b8cc1aa58771626ac8b262bf2c8e001`

Used by `test/oscal-schema.js` to prove `runward compliance` emits an OSCAL
component-definition that validates against the NIST schema. Pinned to the
`oscal-version` the exporter declares (`renderOscal` in `src/lib/compliance.ts`);
bump both together if the exporter targets a newer OSCAL release. The bump to
1.2.2 is recorded in [ADR-0032](../../docs/adr/ADR-0032-track-current-oscal-and-watch-dated-external-facts.md),
the bump to 1.2.3 in [ADR-0076](../../docs/adr/ADR-0076-oscal-1-2-3-a-widening-measured-not-announced.md).

To refresh:

```sh
curl -sL "https://github.com/usnistgov/OSCAL/releases/download/v1.2.3/oscal_component_schema.json" \
  -o test/fixtures/oscal_component_schema.v1.2.3.json
shasum -a 256 test/fixtures/oscal_component_schema.v1.2.3.json   # update the hash above
```

## `audit-corpus-ids.json`

The ledger of the attack corpus identifiers (`AC-001` …) declared in `test/audit-corpus.js`. Not a
vendored file: it is written here, by hand, and only ever appended to.

- `assigned`: every identifier in use, pinned to the name of its case. A case renamed in the corpus
  is renamed here in the same commit, so the change is visible in review.
- `retired`: an identifier whose case was removed, with the date and the reason. Its number is never
  given to another case.

`test/unit/audit-corpus-ids.test.js` checks that every case declares an identifier of the form
`AC-NNN`, that no identifier is used twice, that the cases and the ledger name the same identifiers
with the same names, that no retired identifier is in use, and that the numbers run from `AC-001`
without a hole, so a new case takes the next one.

## `gitlab/`

GitLab API responses for the GitLab bench (layer 1, [docs/gitlab-bench.md](../../docs/gitlab-bench.md)),
replayed by `test/support/gitlab-stub.js`. One file per response; each names its `endpoint`, its date
(`recorded_at`) and its `source`:

- `recorded`: recorded by `.github/workflows/gitlab-bench.yml` from the GitLab CE instance it boots,
  with the GitLab version, revision and image digest, and the run that recorded it;
- `docs-example`: copied from the GitLab API documentation at the pinned `gitlab-org/gitlab` commit
  in `docs.commit`, by `test/gitlab-bench/docs-fixtures.py`; no GitLab version (the documentation
  gives none), and the HTTP status is the REST default, flagged `status_from_docs: false`.

All 7 files are `docs-example` today. To refresh them: `python3 test/gitlab-bench/docs-fixtures.py test/fixtures/gitlab`
(reads gitlab.com). To replace them with recordings: the procedure in `docs/gitlab-bench.md`.
`test/unit/gitlab-bench.test.js` refuses a file with no provenance and any unredacted credential.
