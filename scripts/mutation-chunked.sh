#!/bin/bash
# Runs a mutation pass in resumable line-range chunks.
#
# ADR-0046 decision 3 keeps mutation out of the pull-request path because it is slow.
# Slow on a laptop also means interruptible: a single 1.8 h pass loses everything when the
# machine sleeps, which is how two passes were lost on 2026-08-18. Chunking bounds the loss
# to one chunk, and a chunk already on disk is never recomputed.
#
#   scripts/mutation-chunked.sh evidence 808     # module, line count
#
# Each chunk writes its own report under reports/mutation/chunks/. Re-running skips the
# chunks already there, so an interrupted pass resumes by re-issuing the same command.

set -u

MODULE="${1:?usage: mutation-chunked.sh <module> <line-count> [chunk-size]}"
LINES="${2:?usage: mutation-chunked.sh <module> <line-count> [chunk-size]}"
STEP="${3:-100}"

TARGET="dist/lib/${MODULE}.js"
OUT="reports/mutation/chunks"
mkdir -p "$OUT"

# Read by scripts/mutation-testcmd.sh inside Stryker's sandbox, to put this module's own tests at
# the front of the cheap stage. Exported, not passed: Stryker spawns the command runner itself.
export RUNWARD_MUTATION_MODULE="$MODULE"

[ -f "$TARGET" ] || { echo "no $TARGET — run npm run build first"; exit 2; }

echo "module $MODULE: $LINES lines in chunks of $STEP"

start=1
while [ "$start" -le "$LINES" ]; do
  end=$(( start + STEP - 1 ))
  [ "$end" -gt "$LINES" ] && end="$LINES"
  chunk="$OUT/${MODULE}-$(printf '%04d' "$start")-$(printf '%04d' "$end").json"

  if [ -f "$chunk" ]; then
    echo "  lines $start-$end — already on disk, skipped"
  else
    echo "  lines $start-$end — running $(date '+%H:%M:%S')"
    # --force, not --incremental false: `--incremental` is a boolean flag, so a `false`
    # after it is read as the config file name and Stryker dies on "Invalid config file".
    # --force keeps each chunk an honest measurement of the tree as it is now, rather than
    # replaying a cached verdict from a previous build.
    if npx stryker run \
        --mutate "${TARGET}:${start}-${end}" \
        --force \
        >> "reports/mutation/chunks/${MODULE}.log" 2>&1; then
      cp reports/mutation/mutation.json "$chunk"
      echo "    -> $chunk"
    else
      # A failed chunk leaves no file behind, so the next invocation retries exactly it.
      echo "    FAILED (see reports/mutation/chunks/${MODULE}.log) — will retry on re-run"
    fi
  fi
  start=$(( end + 1 ))
done

echo "done: $(ls -1 "$OUT"/${MODULE}-*.json 2>/dev/null | wc -l | tr -d ' ') chunk report(s)"
echo
echo "REQUIRED NEXT STEP — chunking leaves a gap, and it is silent:"
echo "  npx stryker run --mutate ${TARGET}      # no --force: incremental reuses what is measured"
echo
echo "A mutant whose source range straddles a chunk boundary (a block, a function body) is fully"
echo "inside neither range, so it is measured by neither chunk. On evidence.js this lost 16 of 960"
echo "mutants, 1.7 %, with nothing in the output to say so. The full-file pass above re-runs only"
echo "the ones the cache is missing, which is exactly what incremental mode is for."
