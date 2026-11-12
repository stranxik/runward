# ADR-0019: The hosted app has its own design layer over the family's structure; it supersedes ADR-0014

**Date**: 2026-11-10
**Status**: accepted 2026-11-10 by the author in chat ("je suis ok pour tout ce que tu m'as cité", in answer to a list that named this record), after he agreed to its direction and validated the mock-up of all states the same day
**Supersedes**: ADR-0014 (accepted 2026-11-08), whose trigger fired on 2026-11-10
**Deciders**: Thibault Souris (author). Written by an agent session.
**Method**: decision-loop: the layer and the token test at `main`; the author's design references of 2026-11-10; a palette validator; two adversarial reviews of the mock-up; durable position

## Context

ADR-0014 loads the family's structure, then one runward layer (`web/tokens.css`) that follows the identity of runward's site (basalte, chaux, Inter, 2 px corners), and names its own trigger: "Reopen when the author decides the base of the hosted app". On 2026-11-10 the author decided it: the app no longer takes the site's identity; it takes the look of a recent product, on the model of the interface of one of his other products, and it speaks to decision makers who do not read code.

What was observed. The model interface forces a dark theme and uses two surfaces, `#0a0a0a` and `#fafafa`, that `test/unit/tokens.test.js` and runward-fleet's page rules refuse. A review of the mock-up found that one alert hue for two states does not hold at a glance, and that an amber alert reads "to watch" where a refused application must read as refused. A palette validator run on the raw Okabe-Ito values showed that each theme needs its own step of each hue.

The decision is taken at the boundary ADR-0014 set: one file holds every value.

## Decision

The structure stays (`web/famille.css`, unchanged). A new layer, `web/couche-runward-app.css`, replaces `web/tokens.css` and alone holds every colour, font, letter spacing and radius.

1. Neutral greys and three inks; 1 px lines. Two second surfaces, `#f7f7f8` and `#0c0c0e`, next to the two refused values.
2. Geist and Geist Mono, served by the app from its own files (OFL) under a closed list, with no call to a third party; the mono face for measured values only.
3. Radii: pill for controls, 8 px for panels, 6, 12 and 14 px for thumbnails, notices and showcase windows.
4. A state is said three times: a shape, a word, then a hue. Refused by the check: a filled diamond and a vermilion. Required level not met: an outlined diamond and an orange. No check received: a dotted circle, no hue. Nothing is blocking: a filled circle in ink, no green. Never a red and green pair. Text stays in ink.
5. Each theme takes its own step of each hue, validated against its surfaces.
6. A sky blue marks what is live, and nothing else.
7. Light by default, the dark theme shipped as an option and verified; the printed statement forces light.
8. No brand accent at the floor.

`test/unit/tokens.test.js` is rewritten, not removed: every role of the family's contract defined in both themes, the main ink at 7:1, the two secondary inks at 4.5:1, lines, focus and state hues at 3:1, no green, and the refusal of indigo, `#241CC4`, `#0A0A0A` and `#FAFAFA` kept; broken layers planted on purpose prove it sees each fault.

## Alternatives discarded

- **Keeping the runward layer**: the people the app is for read it as the site of a method, and the author decided otherwise.
- **Copying the model layer as it is**: two refused surfaces, a forced dark theme.
- **One alert hue for two states**: not told apart at a glance; amber reads "to watch".
- **Green for "nothing is blocking"**: a green reads as a go, which the reading never gives, and it pairs with red.
- **A brand accent now**: the author has not decided the identity of the app.

## Consequences

- **Positive**: one file to change, as before; the two alert states are told apart by shape, word and hue.
- **Negative, accepted**: two alert hues; a hue that reads red; two themes to verify; the static page built by runward-fleet keeps runward-fleet's own template until the decision view has its own style roles.
- **On other boundaries**: the framing's "identity of runward's design (no indigo, one gold, no red or green)" becomes "the app's layer (no indigo, no tech black, no cold paper white, never a red and green pair)"; every screen written by another lot takes the layer as an entry constraint; the server serves the layer and a closed list of six font files (`src/http/assets.js`), the content security policy unchanged.

## What would settle it

- **Confirms**: the token test is green with its planted controls; the captures of the app at 1280, 768, 390 and 360 px in both themes show no overflow, no text under 12 px and no contrast under AA measured on the render; people who do not read code tell the two alert states apart.
- **Reverses**: the author refuses a hue that reads red (then one alert hue, the two states told apart by shape and word); the comprehension measure shows the two alert states are confused.

## Reevaluation trigger (mandatory, dated)

Reopen on 2026-11-19 on what was observed on 2026-11-18, or earlier: the author decides a brand accent; a third theme is asked for; the family's structure changes its scale.

**Trigger set on**: 2026-11-10 · **Watched via**: `test/unit/tokens.test.js`, `test/unit/assets.test.js`, the palette validator

## References

- ADR-0014 (superseded by this record)
- The family's structure (`web/famille.css`) and its contract for a product layer
- M. Okabe and K. Ito, Color Universal Design (2008)
