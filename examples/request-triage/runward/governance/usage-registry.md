# Usage registry — Request Triage

Risk is classed by deployment, not by platform. This floor is one deployment; the `topology-usage-registry-present` row of [execution-topology.md](../execution-topology.md) cites it here.

| Deployment | Risk class | Data classes touched | Action scopes | Owner / responsible | Last review |
|---|---|---|---|---|---|
| triage-bot / prod | medium | request text (personal possible), `TriageRecord` | read intake; write to ticketing (approval-gated for compliance-flagged records) | triage product owner | — |
