# ADR-0001: One Node.js monolith, no web framework, the domain behind ports, one network exit

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0016 (and its note: more than sixty routes reopens it). Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0016 (and its note: more than sixty routes reopens it) at the boundary where the code applies it

## Context

The product imports the runward-fleet library, written in JavaScript ES modules for Node.js 22.12 or later. A full web framework would bring a second server-side rendering of the fleet view, many dependencies and a slope towards the vendor that edits it.

## Decision

One deployable: Node.js 22 LTS or later, ES modules, `node:http` with a table router (`src/http/server.js#routes`), no framework. Layers: entry (`src/http/`), application (`src/application/`), pure domain (`src/domain/`, imports only itself and `node:crypto`), adapters (`src/adapters/`). Production dependencies: one WebAuthn library (`@simplewebauthn/server`), one PostgreSQL client (`postgres`), one generic S3 signer (`aws4fetch`), and the pinned runward-fleet. The only destination outside the hoster is the OIDC issuer's keys, enforced by `src/adapters/system/egress.js#boundFetch`. A boundary test follows the real imports transitively with planted controls (`test/unit/boundary.test.js`).

## Alternatives discarded

- **Next.js or another server-rendering framework**: it doubles the view and multiplies the supply chain
- **A second language for the core**: runward-fleet would have to be rewritten or run apart
- **Separate services**: no distinct life cycle today; the ports keep a later split local

## Consequences

- **Positive**: one view, a small image, few dependencies
- **Negative, accepted**: more hand-written entry code
- **On other boundaries**: PADR-0011 (one view), ADR-0009 (one image)

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: more than sixty routes (37 today); a need the static shell cannot cover, measured; runward-fleet changes language.

**Trigger set on**: 2026-11-06 · **Watched via**: the boundary test, `package.json` dependencies

## References

- PADR-0016 and its note of 2026-11-06
- M. Fowler, MonolithFirst (2015); A. Cockburn, Hexagonal Architecture (2005)
