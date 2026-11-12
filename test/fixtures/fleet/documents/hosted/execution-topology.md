# Execution Topology

**Date**: 2026-11-06 · **Revised**: 2026-11-10 (the operator's gateway of ADR-0016, a second container: the independent review of a4ede14 found this map still describing one)

## The two visions, behind the same ports

The application domain is the hosted service; the execution topology is two containers of the same image at the hoster, both attached to one private network with a managed PostgreSQL that has no public endpoint: the service (public) and the operator's gateway (private, ADR-0016), which the hoster's schedule also calls twice a day; an S3 bucket in the same region; the OIDC issuer's keys as the only destination outside the hoster.

## The port → placement map

| Port | Adapter (what runs) | Location family | Data class(es) crossing it | Sovereignty level | ADR | Re-evaluation trigger |
|---|---|---|---|---|---|---|
| TenantStore and Ledger | PostgreSQL managed (DB-DEV-S), private network | Managed infrastructure service | internal business, personal (names in received exports) | raised | ADR-0013 | a buyer requires qualified hosting |
| ExportStore, SecurityLog, Archive | S3 bucket, same region, no versioning; one object outside `tenants/`, the health check's witness (`health/witness`, no data) | Managed infrastructure service | personal (exports), internal | raised | ADR-0013 | a first third-party tenant: a key per tenant |
| EntryPort (HTTP) | `node:http`, in-app | In-app | personal (sessions), internal business | raised | — | a second entry (MCP) |
| OperatorEntry (the operator's gateway) | `node:http` in a second process of the same image (`src/operator-gateway.js`), in its own **private** Serverless Container `runward-hosted-operator`, in the private network; two scheduled triggers of the hoster (`retention` 03:23, `verify-chains` 03:53, Europe/Paris); each gesture a child process holding one database role | In-app (a second process) | in: gesture arguments (link digests, tenant and member identifiers), the operator's token (secret); held: the four database roles' URLs and the bucket's key (secret); out: a status and a code only | high | ADR-0016 | Serverless Jobs can join a Private Network; a gesture needs more than 900 s; a second operator |
| WorkloadVerifier | in-app, reads GitHub's public keys | In-app | public reference (public keys) | standard | ADR-0003 | GitLab declared |
| HumanAuthenticator | in-app library | In-app | personal (public keys of passkeys) | raised | ADR-0005 | a second human |
| IndexAssembler | in-app, runward-fleet pinned | In-app | internal business | raised | ADR-0004 | runward-fleet changes its contract |
| Clock, Log | standard output of both containers, collected by the hoster's Cockpit (project `runward`, fr-par), kept 7 days (the default, `governance/observability-schema.md` §6) | Existing infrastructure | internal: no body, token, name or path; the free fields bounded and scrubbed | raised | ADR-0013 | a third-party trace export requested: its own ADR |

Secrets live in four places, and nowhere else. (1) The containers' secret environment variables at the hoster: the service's database URL and the bucket's key; the gateway's four database roles' URLs and the bucket's key, and only the sha256 of the operator's token. (2) The GitHub environment `production` of this repository, reserved to `main`: `SCW_SECRET_KEY` (the CI's key, which pushes and deploys the image) and `RW_OPERATOR_TOKEN` (the gestures after a deploy). (3) The OpenTofu state, which keeps the containers' secret environment variables, so the database roles' passwords once phase 2 is applied: encrypted by OpenTofu (pbkdf2 and AES-GCM, enforced) and kept outside any repository, on the author's machine (runbook §11). (4) The author's macOS keychain, which holds them all, the state's passphrase included. The private repository `stranxik/runward-hosted-ops` and its environment `operateur` are planned to hold the operator's secrets for runs that wait for the author's approval; on 2026-11-10 that repository is empty, with no environment and no secret, and the gestures run from the author's workstation (runbook §8). Never in the image, a repository file, a log or a report.

## Protection level by data class

One level per class of data, whatever port it crosses; a port that several classes cross holds the highest of their levels (the map above).

| Data class | Examples | Level | Where it may live | ADR |
|---|---|---|---|---|
| public reference | the OIDC issuer's public keys, the published send workflow commits | standard | anywhere it is published | ADR-0003 |
| internal business | the fleet index, missions, repository declarations, the operator journal | raised | the hoster in Paris (fr-par), in the Union | ADR-0013 |
| personal | passkey public keys, sessions, members, names inside consented exports | raised | the hoster in Paris (fr-par), in the Union; erased on demand or 30 days after a removal | ADR-0009, ADR-0013 |
| secret | the database roles' passwords, the object storage keys, the CI's key, the operator's token, the state's passphrase | high | the containers' secret environment at the hoster, the GitHub environment `production` of this repository, the OpenTofu state (encrypted, outside any repository, on the author's machine) and the author's keychain; the environment `operateur` of the private operator repository once it exists (empty on 2026-11-10); never in the image, a repository file, a log or a report | ADR-0008, ADR-0016 |

## Usage registry

| Deployment | Risk class | Data classes touched | Action scopes | Owner / responsible | Last review |
|---|---|---|---|---|---|
| runward-hosted / preview (app.runward.dev) | medium | internal business, personal (consented exports) | read for members; append for workloads; gestures per passkey | Thibault Souris | 2026-11-06 |
| send.yml / customer CI | low | the customer's own export | upload of runward's output only | Thibault Souris | 2026-11-06 |
| temoin.yml / witness reader | low | the authorized fleet's index and archive | read only | Thibault Souris | 2026-11-06 |
| runward-hosted-operator / the operator's gateway (private container, two daily triggers) | high: the most privileged deployment, it holds every database role | every class of the database (through rw_admin, rw_owner, rw_maint, rw_app), the bucket; arguments: link digests, tenant and member identifiers | the closed list of gestures (roles, migrate, isolation, open-bootstrap, open-recovery, reset-access, maintenance, retention, verify-chains, restore-replay), one role per gesture, one at a time, each with a deadline; called behind the hoster's barrier and the operator's token, except the two argument-free daily gestures; answers a status and a code | Thibault Souris | 2026-11-10 |
| push-image.yml, deploy.yml, rollback.yml / the deploy chain (this repository, environment `production`, reserved to `main`) | high: the CI's key pushes the image and replaces the image of both containers | secret (the CI's key; `deploy.yml` also the operator's token) | build and push an image only when the CI of its exact commit is green; deploy or roll back that image; after a deploy, `roles`, `migrate` and `isolation` through the gateway, without arguments | Thibault Souris | 2026-11-10 |
| the author's workstation / the operator's gestures (`scripts/operator-call.sh`, `npm run operateur:*`) | high: it reads every key from the keychain, by name, inside a command | secret; arguments: link digests, tenant and member identifiers | the closed list of gestures, through the hoster's barrier and the operator's token; a link's token is drawn there and only its sha256 leaves | Thibault Souris | 2026-11-10 |
| stranxik/runward-hosted-ops / the operator's workflows (private repository, environment `operateur`) | high, planned: empty on 2026-11-10 | none yet; once it exists, the operator's token and the hoster's key, tenant and member identifiers as inputs | none yet; once it exists, the workstation's gestures, each run approved by the author | Thibault Souris | 2026-11-10 |

## Rule conformance

> Rows are proposed by an agent session and ratified by the author, never by the agent (AGENTS.md, ADR-0082 of runward). The gate refuses a proposed row until it is ratified.

| Rule | Status | Evidence |
|---|---|---|
| topology-port-placement-mapped | applied | file:infra/scaleway/main.tf#scaleway_container_trigger; file:src/main.js#compose; file:src/operator-gateway.js#createGateway; adr:0013; adr:0016 — every port of the architecture note, the operator's entry included, has its row in the map above |
| topology-sovereignty-by-data-class | applied | adr:0013; adr:0009; adr:0016; file:runward/execution-topology.md#"Protection level by data class" |
| topology-trace-export-decision | applied | file:src/adapters/system/log.js#jsonLog; test:reports/junit.xml::a log line's free fields are bounded and scrubbed: no credential, address, path, identifier or second line in detail and error; adr:0013 (no third-party telemetry: the lines stay in the hoster's Cockpit, fr-par, 7 days; the log never carries a body, a token, a name or a path; the operator's gestures answer a status and a code) |
| topology-usage-registry-present | applied | file:runward/execution-topology.md#"Usage registry" — seven deployments: the service, the send workflow, the witness reader, the operator's gateway, the deploy chain, the author's workstation for the operator's gestures, and the private operator repository, planned and empty (reviewed 2026-11-10) |

## Cross-references

`runward/architecture.md`, `infra/`, ADR-0008, ADR-0013, ADR-0016; `governance/threat-model.md` (T30 to T33).

### Ratification
- 2026-11-10 · rows: topology-port-placement-mapped, topology-sovereignty-by-data-class, topology-trace-export-decision, topology-usage-registry-present · by: Claude Fable 5.2 (independent reviewer) (declared, agent) · for: Thibault Souris (declared, accountable) · bound: topology-port-placement-mapped@9390eb23559e372e, topology-sovereignty-by-data-class@618439f3176fee80, topology-trace-export-decision@974d89e7e0cdd32e, topology-usage-registry-present@e2dc16c1c07eb7cf · mode: agent
