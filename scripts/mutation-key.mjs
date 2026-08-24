// The one implementation of a survivor's identity. ADR-0059 decision 2.
//
// A mutant's Stryker identity is `line|column|endLine|endColumn|mutator|replacement`. Every one of
// those offsets moves when anything above it moves: three fixes in 0.36.1 shifted `evidenceReport`
// by 47 lines, so 84 mutants changed identity while none of their code changed. A ratchet keyed on
// offsets would report those as new survivors, and a signal that cries on every honest change is a
// signal that gets switched off.
//
// So identity is (module, function, mutator, replacement, the TEXT that was mutated, and the TEXT of
// the line it sits on). It survives code moving above it, and it changes exactly when the mutated
// code changes — which is when a human should look.
//
// The mutated text is in the key because the line alone is not enough: measured 2026-08-24 on the
// 215 committed survivors, keying on the line only left 9 pairs indistinguishable — two
// `ConditionalExpression -> true` mutants can sit on one line and differ only in which
// sub-expression they replace. Adding what was replaced cuts that to ONE. The residue is real and
// documented below rather than hidden.
//
// ADR-0059 ratification criterion 5 requires ONE implementation, consumed by both the register
// generator and the ratchet: two would drift, and a ratchet whose sides key differently reports
// noise. test/unit/mutation-key.test.js fails if a second one appears.

/** Collapse runs of whitespace so re-indentation is not a change of identity. */
const normalise = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

/** The separator is a control character so it cannot occur in source text or in a replacement. */
const SEP = "";

/**
 * @param {{module: string, function?: string, mutator: string, replacement: string,
 *           original?: string, source: string}} m
 * @returns {string} an identity stable under code moving above the mutant
 *
 * RESIDUAL AMBIGUITY, stated because it is a property of the key and not an accident: two mutants
 * that replace textually identical code, with the same mutator and the same replacement, on the same
 * line, share an identity. Exactly ONE pair of the 215 committed survivors does — two empty string
 * literals on the same line of `unsafeSignature`, both mutated the same way. No position-independent
 * key can separate those: they are the same mutation of the same text, and only a column tells them
 * apart. A column is exactly the offset this key exists to avoid depending on, so the ambiguity is
 * accepted rather than traded for fragility. The ratchet is not blind to it: the register also
 * declares COUNTS per function, so one of a colliding pair disappearing moves a number even when it
 * does not move the key set.
 */
export function stableKey(m) {
  for (const field of ["module", "mutator", "source"]) {
    if (!m || m[field] === undefined || m[field] === null) {
      throw new Error(`stableKey: missing "${field}" — an identity built from a partial mutant is` +
        " not stable, it is merely different");
    }
  }
  // `replacement` may legitimately be the empty string (a StringLiteral mutated to ""), so it is
  // checked for presence rather than for truthiness.
  if (m.replacement === undefined || m.replacement === null) {
    throw new Error('stableKey: missing "replacement"');
  }
  return [
    m.module,
    m.function ?? "(top level)",
    m.mutator,
    normalise(m.replacement),
    normalise(m.original ?? ""),
    normalise(m.source),
  ].join(SEP);
}

/** Human-readable form, for a message a person has to act on. */
export function describeKey(key) {
  const [mod, fn, mutator, replacement, original, source] = key.split(SEP);
  return `${mod}/${fn} ${mutator}: ${JSON.stringify(original)} -> ${JSON.stringify(replacement)}` +
    ` on ${JSON.stringify(source)}`;
}
