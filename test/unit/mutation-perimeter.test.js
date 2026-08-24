// Every library module has a stated place in the mutation perimeter. ADR-0046 decision 5.
//
// That decision requires the perimeter to be published WITH ITS ABSENCES. Making the perimeter data
// (the `mutate` array) made it auditable; it did not make it COMPLETE. Measured 2026-08-24:
// `sarif.ts` shipped on 2026-08-17 emitting the verdict as a machine contract a CI reads, and was
// never added — nobody had to decide anything for it to fall out, because falling out was silent.
//
// So a module is in `mutate`, in `excluded`, or in `candidates`, and this fails when it is in none.
// The point is not to force everything into the perimeter: an exclusion with a reason is a decision,
// and this guard is satisfied by one. What it refuses is the absence of a decision.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIB = join(ROOT, "src", "lib");
const config = JSON.parse(readFileSync(join(ROOT, "stryker.config.json"), "utf8"));

/** A reason short enough to fit in a field without saying anything is what this guards against. */
const MIN_REASON = 60;

const measured = new Set(
  config.mutate.map((p) => p.replace(/^.*\//, "").replace(/\.js.*$/, "")),
);
const perimeter = config._perimeter ?? {};
const excluded = perimeter.excluded ?? {};
const candidates = perimeter.candidates ?? {};

const modules = readdirSync(LIB)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
  .map((f) => f.replace(/\.ts$/, ""));

test("the perimeter declares a rule for what belongs in it", () => {
  // Without a stated rule, "excluded" and "candidate" are taste. With one, an exclusion can be
  // argued with — which is the only kind of published absence worth publishing.
  assert.ok(Array.isArray(perimeter.rule) && perimeter.rule.join(" ").length > 200,
    "stryker.config.json needs a `_perimeter.rule` saying what puts a module in the perimeter");
});

test("every module under src/lib has a stated place", () => {
  const orphans = modules.filter(
    (m) => !measured.has(m) && !(m in excluded) && !(m in candidates),
  );
  assert.deepEqual(orphans, [],
    "these modules are in no category — measured, excluded, or candidate. A module that falls out " +
    "of the perimeter by nobody deciding anything is how sarif.ts spent a week outside it.");
});

test("no module is in two categories at once", () => {
  const conflicts = [];
  for (const m of modules) {
    const places = [measured.has(m) && "mutate", m in excluded && "excluded", m in candidates && "candidate"]
      .filter(Boolean);
    if (places.length > 1) conflicts.push(`${m}: ${places.join(" + ")}`);
  }
  assert.deepEqual(conflicts, [], "a module cannot be both measured and set aside");
});

test("every exclusion carries a reason that can be argued with", () => {
  for (const [m, reason] of Object.entries(excluded)) {
    assert.ok(typeof reason === "string" && reason.length >= MIN_REASON,
      `${m}: an exclusion needs a reason, not a label — got ${String(reason).length} characters`);
  }
});

test("every candidate says what holds it out and what would let it in", () => {
  for (const [m, reason] of Object.entries(candidates)) {
    assert.ok(typeof reason === "string" && reason.length >= MIN_REASON,
      `${m}: a candidate needs its reason`);
  }
});

test("nothing in the perimeter names a module that no longer exists", () => {
  const known = new Set(modules);
  const ghosts = [
    ...[...measured].map((m) => [m, "mutate"]),
    ...Object.keys(excluded).map((m) => [m, "excluded"]),
    ...Object.keys(candidates).map((m) => [m, "candidates"]),
  ].filter(([m]) => !known.has(m));
  assert.deepEqual(ghosts, [],
    "a perimeter that names deleted modules looks wider than it is");
});

// Meta-guard: a test that reads nothing passes everything.
test("the guard is actually reading the library", () => {
  assert.ok(modules.length > 20, `only ${modules.length} modules found under src/lib`);
  assert.ok(measured.size > 0, "no measured modules parsed out of `mutate`");
});
