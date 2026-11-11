# ADR-0014: Design tokens: the family's structure, then one runward layer that holds every colour, font, radius and motion value

**Date**: 2026-11-06
**Status**: superseded by ADR-0019 (2026-11-10); accepted (2026-11-08), ratified on the author's delegation in chat ("ratifie pour moi", "ratify for me"), the session having recommended it; the author did not read this text again before delegating
**Deciders**: proposed by an agent session; Thibault Souris (author) decides.
**Method**: decision-loop

## Context

The preview of 2026-11-06 follows runward's identity (basalte, chaux, Inter). A family base (`jetons-famille`) appeared the same day; the author decided that the structure (scale, grid, heights, motion, focus) is common and that colours, fonts, letter spacing and radii belong to each product, runward keeping near-square 2 px corners, with no entrance animation in apps. Whether another base applies to the hosted app may still change.

## Decision

`web/famille.css` (the common structure, copied from the skill) loads first, then `web/tokens.css`, the runward layer, which alone holds every colour, font, radius and motion value and maps the family contract's roles (`--bg`, `--line`, `--text`, `--bar` at about 3.6:1, `--hit`, `--r-*` at 2 px). The fleet stylesheet served is runward-fleet's with its `:root` blocks removed, so the layer is the only source of values. `test/unit/tokens.test.js` fails on a literal colour anywhere else, on an undefined custom property, on indigo or tech black, and on an entrance animation; a planted colour proves it sees one. Changing the base is a change of `web/tokens.css` alone.

## Alternatives discarded

- **Literal values in the shell's stylesheet**: a change of base would touch every file
- **Adopting another base now**: the author has not decided it

## Consequences

- **Positive**: one file to change
- **Negative, accepted**: the fleet stylesheet still holds radii and motion of runward-fleet's own template
- **On other boundaries**: the preview's DA kept

## Reevaluation trigger (mandatory, dated)

Reopen when the author decides the base of the hosted app.

**Trigger set on**: 2026-11-06 · **Watched via**: `test/unit/tokens.test.js`

## References

- the author's decisions of 2026-11-06 relayed in this session
- runward-site CLAUDE.md (the identity)
