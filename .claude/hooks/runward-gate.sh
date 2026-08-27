#!/bin/bash
# THE AUTHOR SUBMITS TO THE CONSTRAINT HE SELLS. Stop hook, HARD: a red gate refuses the end of turn.
#
# What this repository shipped, and what it did not do to itself. `plugins/runward-gate` carries a
# Stop hook that ends in `|| true`, documented as a decision — "Advisory in session, hard in CI (by
# design)", with the README naming the escape: "remove the `|| true` … the operator's choice, not a
# default". That is defensible for a consumer. It is not defensible here, because on 2026-08-27 the
# audit of my own harness found that runward's repository did not install that hook AT ALL. Not
# advisory: absent. The author was at tier zero while selling three tiers.
#
# So this hook takes the HARD tier, one notch stricter than the shipped default, on the principle
# that whoever sells a constraint takes its strictest form rather than its most comfortable.
#
# THE BINARY IS THE TREE'S, NEVER THE PUBLISHED ONE. The shipped hooks run `npx --yes runward`,
# which is right for a consumer and WRONG here: it would judge 0.37.0-dev with whatever npm last
# published (0.36.2 today), so the gate would be a different program from the one being built. On
# this repository, "exactly the latest runward" means `dist/` compiled from this working tree — so
# the hook builds first, and a build that fails blocks too, because an unbuildable tree has no
# verdict at all.
#
# THE LOOP, AND WHY THE ESCAPE LEAVES A TRACE. A Stop hook that always blocks traps the session:
# Claude re-stops, the hook re-blocks, forever. The contract's answer is `stop_hook_active`, true
# once the hook has already blocked. So this blocks ONCE, hard, with the verdict. On the second pass
# it lets go — and appends to .claude/gate-bypass.log, which is COMMITTED. The gate cannot be
# contourned silently; it can only be contourned in a diff someone can read. That is the same line
# the product takes: a bypass is a visible act, never a quiet one.
#
# Fail-open on infrastructure, never on a verdict: no jq, no payload, wrong directory -> allow.

payload=$(cat 2>/dev/null) || exit 0
command -v jq >/dev/null 2>&1 || exit 0

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 0
[ -f "$ROOT/package.json" ] || exit 0
grep -q '"name": *"runward"' "$ROOT/package.json" 2>/dev/null || exit 0

if [ "$(printf '%s' "$payload" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ]; then
  # Already blocked once. Let go so the session is not trapped — and record that it happened.
  if ! (cd "$ROOT" && npm run build >/dev/null 2>&1 && node dist/cli.js check --strict >/dev/null 2>&1); then
    printf '%s  gate red at end of turn, released after one block\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      >> "$ROOT/.claude/gate-bypass.log"
    echo "runward gate: still red. Releasing so the session is not trapped, and recording it in .claude/gate-bypass.log — this is a bypass, and it is in the diff." >&2
  fi
  exit 0
fi

cd "$ROOT" || exit 0
if ! build=$(npm run build 2>&1); then
  echo "runward gate: the tree does not build, so there is no verdict to give. Fix this before ending the turn." >&2
  printf '%s\n' "$build" | tail -20 >&2
  exit 2
fi
if ! verdict=$(node dist/cli.js check --strict 2>&1); then
  echo "runward gate: check --strict refuses this tree. The turn does not end on a red gate." >&2
  # The REFUSALS, not the tail. `tail -30` showed the summary and the green rows above it, which is
  # the least useful part of a red run: a block that does not name what is red is a block the
  # operator has to re-run the gate to understand.
  printf '%s\n' "$verdict" | grep -E "✗|! [0-9]" | head -20 >&2
  printf '%s\n' "$verdict" | sed -n '/^Summary/,$p' | head -8 >&2
  exit 2
fi
exit 0
