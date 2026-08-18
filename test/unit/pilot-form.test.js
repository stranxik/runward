// The pilot candidate form (ADR-0052 decision 2, the open-source shape of the invitation).
//
// A participation form is a PROMISE made to a stranger, in a place they read before they read the
// protocol. If it promises something the protocol does not hold — or quietly drops what the protocol
// makes non-negotiable — the pre-registration is worth nothing, because the person who volunteered
// agreed to different terms than the ones committed. This guard keeps the two in step.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FORM = readFileSync(join(ROOT, ".github/ISSUE_TEMPLATE/pilot_candidate.yml"), "utf8");
const PROTOCOL = readFileSync(join(ROOT, "docs/pilot-protocol.md"), "utf8");
// Prose is hard-wrapped in both files, so every sentence match tolerates a line break.
const loose = (s) => new RegExp(s.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(?:\\s|>|#)+"), "i");

test("pilot form: the three non-negotiables are required checkboxes, not prose a reader skips", () => {
  // These are the terms that make the measurement opposable. A form that lets someone volunteer
  // without them produces a candidate who agreed to something else.
  assert.match(FORM, /Our engineer scores both runs/i, "the third party scores");
  assert.match(FORM, /published whichever way it points/i, "publication is committed either way");
  assert.match(FORM, /will not be edited for us/i, "the protocol is frozen, including for the candidate");
  // Each of the three sits under `required: true`, so GitHub refuses the submission without them.
  const box = FORM.slice(FORM.indexOf("id: understood"));
  assert.equal((box.match(/required:\s*true/g) || []).length, 3, "all three are required, not optional reading");
});

test("pilot form: it states the cost before the benefit, and the cost is the protocol's own", () => {
  // 8 hours twice is the real price. A form that leads with the free mission and buries the hours
  // recruits someone who will drop out at the second run — which destroys the comparison, since the
  // two runs must be scored by the same engineer.
  assert.match(FORM, loose("up to 8 hours boxed"), "the time box is stated");
  assert.match(FORM, /twice/i, "and that it happens twice");
  assert.match(PROTOCOL, /8 hours total/i, "the same box the protocol committed to");
  assert.ok(FORM.indexOf("What it costs you") < FORM.indexOf("What you get"), "the cost comes first");
});

test("pilot form: it points at the committed protocol and its empty instruments", () => {
  assert.match(FORM, /docs\/pilot-protocol\.md/, "the protocol is linked, not summarised away");
  assert.match(FORM, /docs\/pilot/, "and the instruments, so a candidate can see they are empty");
  assert.match(FORM, loose("before any data exists"), "the pre-registration is stated in the invitation itself");
});

test("pilot form: the repository must be one the maintainer did not write", () => {
  // The single condition without which the pilot measures nothing at all.
  assert.match(FORM, loose("did **not** write"), "stated in the form");
  assert.match(PROTOCOL, loose("the runward maintainer did not write"), "and it is the protocol's own condition");
});

test("pilot form: anonymity is offered as a choice, and the failure criterion is not hidden behind it", () => {
  assert.match(FORM, /Describe both by size, stack and age only/i, "full anonymity is available");
  assert.match(FORM, loose("counts against the method"), "and the losing outcome is named in the invitation, not only in the protocol");
});
