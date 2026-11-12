# ADR-0017: No load test before the preview; the bounds are tested, a k6 run comes before the first third-party tenant

**Date**: 2026-11-08
**Status**: accepted (2026-11-09), by the author in chat ("je confirme et j'accepte")
**Deciders**: Thibault Souris (author). Written by an agent session.
**Method**: decision-loop

## Context

`checklist-pre-production-performance` asks for a load-test summary (k6 or JMeter) before production. The preview runs one container (max_scale 1) for the author's own tenant and the witness reader; there is no third-party tenant and no traffic to shape a load profile from. A load test run now would measure a profile invented for the occasion, against an instance that does not exist yet (the infrastructure is created by infra/h0).

## Decision

The performance row is **deviated** until the trigger below. What holds in its place is tested, each bound with a test that fails if it goes:

- every statement has a deadline (`statement_timeout` 10 s, `src/adapters/store/postgres.js#postgresStore`);
- every call out has a deadline and each host a circuit breaker (`src/adapters/system/egress.js`, `test/unit/egress.test.js`);
- the public routes are rate limited per address and for the instance (`src/http/limits.js`, `test/unit/limits.test.js`);
- an export is bounded in size (`src/domain/workload.js#MAX_EXPORT_BYTES`);
- the read budget per screen (architecture section 6) is measured by the browser witness.

## Alternatives discarded

- **A k6 run against a local instance now**: it would measure the workstation, not the hoster, and a profile with no traffic behind it
- **Marking the row applied on the bounds above**: the rule asks for a measured load; bounds are not a measure, and saying so is the point of this ADR

## Consequences

- **Positive**: the row says what is true: bounded, not measured under load
- **Negative, accepted**: the first third-party tenant waits for a k6 run against the preview
- **On other boundaries**: ADR-0010 (operating with one human), ADR-0013 (hosting)

## Reevaluation trigger (mandatory, dated)

Reopen before the first third-party tenant is invited, or when the probe's error-rate alert fires twice in a week: a k6 run against the preview with its thresholds, committed as `reports/k6-summary.json`, and the row applied on it.

**Trigger set on**: 2026-11-08 · **Watched via**: the invitation gesture (ADR-0011) and `.github/workflows/probe.yml`

## References

- `runward explain checklist-pre-production-performance`
