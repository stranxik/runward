# ADR-0013: Licence FSL-1.1-MIT; hosting in Paris at Scaleway; nothing outside the Union in the data path

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0009 (and its notes of 2026-11-06). Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0009 (and its notes of 2026-11-06) at the boundary where the code applies it

## Context

What the customer runs is MIT (runward, runward-fleet); what the operator runs is the product.

## Decision

This repository is under FSL-1.1-MIT (`LICENSE`), never called open source. The preview runs at Scaleway, Paris region (`infra/scaleway/main.tf`), with three portability rules: OCI image, PostgreSQL, S3; no service of the hoster in the data path; secrets in environment variables. No CDN, analytics or e-mail provider outside the Union in front of the app; the domain `app.runward.dev` resolves by DNS only.

## Alternatives discarded

- **A closed licence**: the customer could not read what holds its proof
- **A hoster outside the Union**: contrary to the product's constraint

## Consequences

- **Positive**: the code is readable and becomes MIT after two years
- **Negative, accepted**: a competitor may read it
- **On other boundaries**: ADR-0008 (two targets)

## Reevaluation trigger (mandatory, dated)

Reopen when the entity is registered, or at a first buyer who requires qualified hosting.

**Trigger set on**: 2026-11-06 · **Watched via**: the infrastructure validation in CI

## References

- PADR-0009; fsl.software
