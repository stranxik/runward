# ADR-0005: Human identity by passkeys only; one link mechanism for bootstrap, recovery and invitation

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0012, its accepted amendment and its note. Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0012, its accepted amendment and its note at the boundary where the code applies it

## Context

One human in the floor, private repositories behind the view, and the classic hole of first products: no entry for whoever has no passkey yet, and no recovery after the loss of the last one.

## Decision

Passkeys with user verification required, relying party `app.runward.dev`, a 5-minute single-use challenge consumed before verification (`src/application/identity.js#take`). Session: opaque token kept as a digest, cookie `__Host-rw_session` `HttpOnly` `Secure` `SameSite=Lax` (`src/http/server.js#setCookie`), idle 12 h, absolute 7 days, each session remembers the passkey that opened it. Fresh verification: 5 minutes; per-gesture verification bound to the gesture and its object for consent, export, adding or removing a passkey, confirming a repository, cancelling a recovery (`src/domain/identity.js#requireGesture`). Two passkeys before the first arrival opens, or the single-passkey choice said and journaled. Links: 256 bits drawn on the author's workstation (`scripts/operator-link.mjs`), only the digest leaves; the token travels in the fragment and in a POST; seven named states; dates written by the database (`db/migrations/0001_floor.sql#link_dates`). Recovery: usable 24 h after it opens, for 24 h, visible and cancellable in every open session; on arrival all sessions close and old passkeys are lost. No e-mail address is asked or kept.

## Alternatives discarded

- **Magic link by e-mail**: a sending provider in the identity path for one user
- **Sign in with GitHub**: a forge account outside the Union as the key to the proof
- **Passwords**: phishable, stored, reset by e-mail

## Consequences

- **Positive**: no human secret stored; phishing excluded by origin binding; a recovery path exists from day one
- **Negative, accepted**: the passkey ceremonies are the author's gestures; recovery waits 24 h
- **On other boundaries**: ADR-0006 (sessions and tenants), ADR-0008 (security log)

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a second human in a tenant; a first organisation tenant; a recovery used in earnest.

**Trigger set on**: 2026-11-06 · **Watched via**: `test/unit/identity.test.js`, the journal's access entries

## References

- PADR-0012 and its notes; W3C WebAuthn Level 3; NIST SP 800-63B-4
