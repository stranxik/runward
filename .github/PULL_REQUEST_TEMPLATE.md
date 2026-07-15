<!--
  Thanks for contributing. runward keeps a small, deliberate surface.
  See CONTRIBUTING.md before opening: one concern per PR, defaults move on evidence.
-->

## What and why

<!-- What does this change, and what problem or trigger justifies it? -->

## Scope

- [ ] This PR addresses a single concern.
- [ ] If it changes a default, the evidence or trigger is stated above.
- [ ] If it makes a structural decision, an ADR is added under `docs/adr/`.

## Checks

- [ ] `npm test` passes locally (build + smoke + OSCAL schema).
- [ ] The gate is still deterministic, read-only and zero-LLM (no model call added to the check path).
- [ ] No text from the doctrine "Designing and Running Agentic Systems" (CC BY-ND) is copied in; only original MIT prose, with short attributed quotes at most.
- [ ] Docs / CHANGELOG updated if user-facing behavior changed.
