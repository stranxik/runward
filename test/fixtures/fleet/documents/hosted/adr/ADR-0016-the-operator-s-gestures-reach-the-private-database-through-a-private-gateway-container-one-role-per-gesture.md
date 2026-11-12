# ADR-0016: The operator's gestures reach the private database through a private gateway container, one role per gesture

**Date**: 2026-11-08
**Status**: accepted (2026-11-08), ratified by the author in chat ("ratifie", "ratify"), the session having recommended it
**Deciders**: Thibault Souris (author). Written by an agent session.
**Method**: decision-loop: reality-check (provider 2.88.0 schema, the hoster's documentation and the phase 1 state), sourced state of the art, challenge, durable position

## Context

The database is created (phase 1, 2026-11-08) with one endpoint, in the private network `runward-hosted` (172.16.16.2:5432), and no public endpoint by decision (ADR-0013, a postcondition in `infra/scaleway/main.tf`). Four kinds of work must reach it and are not the service: the roles (`scripts/roles.mjs`, as `rw_admin`), the migrations (`scripts/migrate.mjs`, as `rw_owner`, before the service switches), the operator's closed list including the two daily gestures (`src/operator.js`, as `rw_maint`), and the isolation suite on the deployed base (`scripts/isolation-deployed.mjs`, as `rw_app`, after each deploy, S4).

They were written as Serverless Jobs. Serverless Jobs cannot join a Private Network: "Scaleway Serverless Jobs does not currently support Scaleway VPC or Private Networks, though this feature is under development" (Serverless Jobs FAQ, read 2026-11-08); the provider 2.88.0 has no such field on `scaleway_job_definition`. So none of the four can run, and `roles` and `migrate` block the first start.

Serverless Containers can join a Private Network (one per container), can be private (an unauthenticated call is "rejected, and your container will not receive the incoming request", Secure a container, read 2026-11-08), and carry scheduled triggers with a time zone (`scaleway_container_trigger`, block `cron { schedule, timezone, body, headers }` and `destination_config { http_path, http_method }`, provider 2.88.0; `scaleway_container_cron` is deprecated and has no time zone). A container has no Secret Manager reference: its secrets are secret environment variables.

The decision is taken at a process boundary: one more entry point of the same image, and an HTTP contract between the CI (or the author) and the private network.

## Decision

Every gesture that needs the private database and is not the service is one authenticated HTTPS call to a second Serverless Container, `runward-hosted-operator`, private, attached to the private network, of the same image, which runs `node src/operator-gateway.js`:

- **One route per gesture**: `POST /gestures/{roles|migrate|isolation|retention|verify-chains|open-bootstrap|open-recovery|reset-access|maintenance|restore-replay}`, arguments as a closed, validated list per gesture, passed as argv (never through a shell).
- **One role per gesture, by construction**: the gateway holds the four connection URLs; each gesture runs as a child process whose environment carries the configuration and exactly one URL (`ADMIN_URL` for roles, `MIGRATE_URL` for migrate, `DATABASE_URL` of `rw_app` for isolation, of `rw_maint` with the bucket's key for the operator's list). `rw_admin`'s URL never enters the process that runs retention.
- **Two barriers**: the hoster refuses a call without `X-Auth-Token` (privacy `private`; the caller's IAM principal needs `ContainersPrivateAccess`, which a condition can scope to the gateway's own namespace `runward-hosted-operator`); the gateway refuses a call whose `X-RW-Operator-Token` does not hash to `RW_OPERATOR_TOKEN_SHA256` (timing-safe comparison; only the hash is in its environment, the token is a secret of the environment `production` and of the author's keychain).
- **The schedule** (retention 03:23, verify-chains 03:37, `Europe/Paris`) is two `scaleway_container_trigger` that call `POST /scheduled/{retention|verify-chains}`: a trigger cannot hold a secret except in clear in its configuration, so these two paths take no token and no argument, and run only those two idempotent gestures; every other path needs the token.
- **Bounded, serial, journalled**: one gesture at a time (409 otherwise; `max_scale` 1), each with its own deadline (2 to 14 minutes, killed past it, 504; the container's request timeout is 900 s), each outcome one JSON log line (gesture, role, exit, duration, the last line of the error with every secret value and connection URL removed), never a header, a body or a token.
- **Idempotent**: `roles` creates only what is missing and checks the rest; `migrate` records what ran; retention is idempotent (a second pass erases nothing, asserted by a unit test); verify-chains and isolation write nothing.
- **Sizing**: 0.25 vCPU, 512 MB, `min_scale` 0, `max_scale` 1.
- **Order of a deploy** (`.github/workflows/deploy.yml`): the gateway takes the new digest, runs `roles` then `migrate`; then the service switches; after the smoke and the real send, `isolation`. The first deploy creates the containers from an image pushed by `push-image.yml` (runbook §12).

The Serverless Jobs, their Secret Manager entries and the variable `jobs_reach_database` are removed from `infra/scaleway/main.tf`.

## Alternatives discarded

- **A public endpoint on the database, with an ACL**: excluded. Serverless resources "do not have dedicated or predictable IP addresses" (Jobs FAQ), so the ACL would be the hoster's whole range: the database would face the Internet behind a password. Contrary to ADR-0013 and to the postcondition of phase 1.
- **A bastion in the private network** (an Instance the CI or the author reaches by SSH): a machine to patch, a key to rotate, a public IP or a VPN, a few euros a month for a few minutes of use a day, and a shell with every role's password, wider than one route per gesture. Tempered rather than eliminated: it stays the recourse for a restore drill that needs `psql` by hand.
- **Waiting for Serverless Jobs in a Private Network**: "under development", no date; the service cannot start without `roles` and `migrate`.
- **Running the gestures inside the service's own container** (admin routes on the public service): the service would hold `rw_admin`'s and `rw_owner`'s passwords, and its public surface would carry the operator's routes. One process, one role, is the property ADR-0006 rests on.
- **The operator's token in the triggers' headers**: the headers are plain configuration of the trigger, readable by anyone who reads the container, and plain in the state; two argument-free idempotent gestures are a smaller exposure than a token that opens the bootstrap.

## Consequences

- **Positive**: the four kinds of work have a path today, through the private network only; the schedule follows the hour of Paris across the clock change; one role per process holds for every gesture; the gateway is tested without the hoster (`test/unit/operator-gateway.test.js`: refusal without a valid token, the URL each child receives, a failure journalled, a deadline, the serial lock).
- **Negative, accepted**: the gateway's four connection URLs are secret environment variables, kept in the OpenTofu state (encrypted, outside any repository), as the service's already were; a second container to deploy at each release; the gesture's duration is bounded by the HTTP request (900 s), enough for the floor's volumes; the schedule's two paths are reachable without the operator's token by whoever passes the hoster's barrier.
- **On other boundaries**: the private operator repository's workflow (`stranxik/runward-hosted-ops`, environment `operateur`) calls `scripts/operator-call.sh <gesture> '<json args>'` instead of starting a job; the CI's Scaleway key needs `ContainersPrivateAccess` on the namespace `runward-hosted-operator`; the probe and the witness reader are unchanged; the threat model gains one entry point (two barriers, closed list).

## What would settle it

- **Confirms**: the first `roles`, `migrate` and `isolation` calls through the gateway answer 200 with `DATABASE_SSL=verify-full` against 172.16.16.2; a call without `X-Auth-Token` is refused by the hoster (HTTP 401 or 403, measured on the public endpoint, the gateway's log showing nothing); the two triggers have run at 03:23 and 03:37 Paris time on a day before and a day after a clock change.
- **Reverses**: a trigger that cannot reach a private container's path (then the schedule moves to a CI cron calling the gateway with the token), or the hoster forwarding a trigger without being able to authenticate it (then the token goes in a header from a sensitive variable and this ADR is superseded).

## Reevaluation trigger (mandatory, dated)

Reopen when Serverless Jobs can join a Private Network (Jobs FAQ or provider changelog), when a gesture needs more than 900 s, or when a second operator needs a separate credential.

**Trigger set on**: 2026-11-08 · **Watched via**: the provider upgrade review, the gateway's `operator.gesture` log lines (duration), the deploy's run summary

## References

- Scaleway: Serverless Jobs FAQ (Private Networks), Secure a container (private, `X-Auth-Token`, IAM conditions on the namespace), Use Serverless Containers with Private Networks, Add a trigger to a container (cron with time zone), all read 2026-11-08; provider `scaleway/scaleway` 2.88.0 schema (`scaleway_container`, `scaleway_container_trigger`).
- ADR-0006 (one role per process, forced RLS), ADR-0008 (deploy by digest), ADR-0010 (operating with one human), ADR-0013 (no public database endpoint); `runward/runbook.md` §8, §11, §12.
