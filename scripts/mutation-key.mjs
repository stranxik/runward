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

/** The separator is a control character so it cannot occur in source text or in a replacement.
 *  Exported so a migration can append a component without re-deriving the whole key. */
export const SEP = "";

/**
 * @param {{module: string, function?: string, mutator: string, replacement: string,
 *           original?: string, source: string}} m
 * @returns {string} an identity stable under code moving above the mutant
 *
 * THE RESIDUE, AND HOW IT IS SEPARATED WITHOUT REINTRODUCING AN OFFSET. Two mutants that replace
 * textually identical code, with the same mutator and the same replacement, on the same line, share
 * everything above. Measured: one pair among the 217 committed verdicts (two empty string literals
 * on one line of `unsafeSignature`), and a second found on 2026-08-26 in `onDiskSpelling`, where
 * `normalize("NFC")` appears twice on one line and each occurrence is its own mutant.
 *
 * This comment used to argue the ambiguity was the price of position-independence, because the only
 * separator considered was the COLUMN, and a column is exactly the offset this key exists not to
 * depend on. That was a false choice. An ORDINAL is not an offset: it is the mutant's rank among its
 * textually identical siblings on the same line, so it survives re-indentation, reformatting and any
 * edit leaving those siblings in the same order, and it changes only when one of them is added or
 * removed, which is when a human should look.
 *
 * It is appended ONLY from the second sibling on, so a key with no collision is byte-identical to
 * what it was before: 216 of the 217 committed verdicts keep their key exactly.
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
  const base = [
    m.module,
    m.function ?? "(top level)",
    m.mutator,
    normalise(m.replacement),
    normalise(m.original ?? ""),
    normalise(m.source),
  ].join(SEP);
  const n = Number(m.ordinal ?? 1);
  return n > 1 ? `${base}${SEP}#${n}` : base;
}

/**
 * Number the mutants that would otherwise share an identity, in the order they appear on their line.
 *
 * Call this on a WHOLE module's mutants before keying any of them: an ordinal is a rank among
 * siblings, so it cannot be computed one mutant at a time. Items need `line` and `column` for the
 * ordering and the key fields for the grouping; the ordinal is written back onto each item.
 */
export function assignOrdinals(mutants) {
  const groups = new Map();
  for (const m of mutants) {
    const base = stableKey({ ...m, ordinal: 1 });
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(m);
  }
  for (const siblings of groups.values()) {
    if (siblings.length === 1) { siblings[0].ordinal = 1; continue; }
    siblings.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0));
    siblings.forEach((m, i) => { m.ordinal = i + 1; });
  }
  return mutants;
}

/** Human-readable form, for a message a person has to act on. */
export function describeKey(key) {
  const [mod, fn, mutator, replacement, original, source, ordinal] = key.split(SEP);
  const nth = ordinal ? ` (occurrence ${ordinal.replace("#", "")} on its line)` : "";
  return `${mod}/${fn} ${mutator}: ${JSON.stringify(original)} -> ${JSON.stringify(replacement)}` +
    ` on ${JSON.stringify(source)}${nth}`;
}

/**
 * Which TOP-LEVEL DECLARATION a line belongs to — the second half of a survivor's identity, and
 * therefore one implementation here rather than one per consumer (ADR-0059 criterion 5).
 *
 * It used to record only where a `function` STARTS, never where its span ends, so every line after
 * the last function in a module belonged to it forever. Measured 2026-08-28 over the 621 committed
 * verdicts: seven rows of the register named a function the mutated line does not sit in at all —
 * `conformance L230` was filed under `adrDecision` while it lives in the data constant
 * `ADR_SET_ASIDE`, declared after that function. A trust artifact stating where a defect lives must
 * not state it wrongly (RWD-2026-0088, same family as RWD-2026-0085).
 *
 * A `const`/`let`/`class` at column zero therefore opens a span of its own: it names the constant
 * the line actually sits in, AND it closes the function above it. The field keeps the name
 * `function` — what it holds is the enclosing top-level declaration, and a data constant is one.
 */
const DECLARATION = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z0-9_$]+)|class\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=)/;

/** @param {string} source @returns {(line: number) => string} */
export function declarationAt(source) {
  const bounds = [];
  String(source).split("\n").forEach((l, i) => {
    const m = DECLARATION.exec(l);
    if (m) bounds.push({ line: i + 1, name: m[1] ?? m[2] ?? m[3] });
  });
  return (line) => {
    let name = "(top level)";
    for (const b of bounds) {
      if (b.line <= line) name = b.name; else break;
    }
    return name;
  };
}
