#!/bin/bash
# The test command Stryker runs per mutant, ordered so a killed mutant is cheap.
#
# WHY, MEASURED 2026-08-19. Stryker's command runner re-runs the whole test command for every
# mutant, so each mutant cost a full suite. The suite is 155 s sequential across 70 files, but the
# cost is extremely skewed: the ten slowest files are 121 s of it, while fifty-two files together
# cost 11.6 s. Most mutants die in the cheap half and were paying for the expensive half anyway.
#
# So: run the cheap files first, and exit at the first failure. This cannot change a verdict — a
# mutant is killed iff some test fails, and order decides only when we learn it — but it collapses
# the cost of the common case. A survivor still pays for the whole suite, which is correct: proving
# that nothing kills a mutant means running everything.
#
# Two stages rather than one file at a time: `node --test` parallelises the files inside one
# invocation, and 52 sequential process starts would spend more on startup than the tests cost.
#
# Set RUNWARD_MUTATION_MODULE to put that module's own tests at the very front of stage 1.
# Everything here is opt-in and degrades to "run the whole suite", which is always correct.

set -u
MODULE="${RUNWARD_MUTATION_MODULE:-}"
COST="test/unit-cost.json"

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
