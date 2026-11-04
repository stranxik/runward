#!/bin/bash
# The test command Stryker runs per mutant, ordered so a killed mutant is cheap, and narrowed so a
# survivor is too (ADR-0105).
#
# WHY, MEASURED 2026-08-19. Stryker's command runner re-runs the whole test command for every
# mutant, so each mutant cost a full suite. The suite is 155 s sequential across 70 files, but the
# cost is extremely skewed: the ten slowest files are 121 s of it, while fifty-two files together
# cost 11.6 s. Most mutants die in the cheap half and were paying for the expensive half anyway.
#
# So: run the cheap files first, and exit at the first failure. This cannot change a verdict — a
# mutant is killed iff some test fails, and order decides only when we learn it — but it collapses
# the cost of the common case. A survivor still paid for the whole suite, which was correct as long
# as nothing knew which tests could reach the mutant: proving that nothing kills a mutant means
# running everything that could.
#
# WHAT A SURVIVOR PAYS SINCE ADR-0105, MEASURED 2026-11-03. Survivors were 56 % of a release
# ratchet's runner time. A coverage map (scripts/mutation-coverage-map.mjs: every unit test file run
# alone with NODE_V8_COVERAGE, subprocesses included) says which files execute each line of each
# perimeter module, and a mutant table (scripts/mutation-mutant-table.mjs) says which line the
# mutant Stryker named in __STRYKER_ACTIVE_MUTANT__ sits on. When the caller exports both
# (RUNWARD_MUTATION_MAP, RUNWARD_MUTATION_TABLE, absolute paths), scripts/mutation-select-tests.mjs
# runs only the covering files: median 25 % of the suite's seconds per mutated line. A test that
# never executes the line cannot fail because of it, so this cannot turn a survivor into a kill;
# it can only, if the map is wrong, turn a kill into a survivor the ratchet then refuses.
#
# Two stages rather than one file at a time: `node --test` parallelises the files inside one
# invocation, and 52 sequential process starts would spend more on startup than the tests cost.
#
# Set RUNWARD_MUTATION_MODULE to put that module's own tests at the very front of stage 1.
# Everything here is opt-in and degrades to "run the whole suite", which is always correct.

set -u
MODULE="${RUNWARD_MUTATION_MODULE:-}"
COST="test/unit-cost.json"

# Narrowed run: only when the caller gave a map and a table AND the selector found no reason to
# doubt them. Every doubt prints ALL, and ALL takes the ordered whole-suite path below — never
# fewer tests silently.
if [ -n "${RUNWARD_MUTATION_MAP:-}" ] && [ -n "${RUNWARD_MUTATION_TABLE:-}" ] && [ -n "${__STRYKER_ACTIVE_MUTANT__:-}" ]; then
  SELECTED=$(node scripts/mutation-select-tests.mjs)
  if [ -n "$SELECTED" ] && [ "$SELECTED" != "ALL" ]; then
    SEL_FAST=$(printf '%s\n' "$SELECTED" | sed -n '1p')
    SEL_SLOW=$(printf '%s\n' "$SELECTED" | sed -n '2p')
    [ -n "$SEL_FAST" ] && { node --test ${SEL_FAST} || exit 1; }
    [ -n "$SEL_SLOW" ] && { node --test ${SEL_SLOW} || exit 1; }
    exit 0
  fi
fi

# No cost file, no node to read it, or a tree without tests: fall back to the plain suite. Every
# fallback in this script runs MORE tests, never fewer — a broken optimisation must cost time, not
# turn a survivor into a false kill.
if [ ! -f "$COST" ]; then
  exec node --test test/unit/*.test.js
fi

SLOW=$(node -e '
  const c = require("./test/unit-cost.json");
  process.stdout.write((c.slow || []).join("\n"));
' 2>/dev/null)

if [ -z "$SLOW" ]; then
  exec node --test test/unit/*.test.js
fi

# Stage 1: everything not on the slow list, with the module under test first.
FAST=""
for f in test/unit/*.test.js; do
  case "$SLOW" in
    *"$f"*) continue ;;
  esac
  FAST="$FAST $f"
done

FRONT=""
if [ -n "$MODULE" ]; then
  for f in test/unit/${MODULE}*.test.js; do
    [ -e "$f" ] || continue
    case "$SLOW" in
      *"$f"*) continue ;;
    esac
    FRONT="$FRONT $f"
  done
fi

if [ -n "$FRONT" ]; then
  node --test ${FRONT} || exit 1
  REST=""
  for f in $FAST; do
    case " $FRONT " in
      *" $f "*) continue ;;
    esac
    REST="$REST $f"
  done
  FAST="$REST"
fi

[ -n "$FAST" ] && { node --test ${FAST} || exit 1; }

# Stage 2: the expensive tail. Reached only when nothing cheap killed the mutant.
node --test ${SLOW}
