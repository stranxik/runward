# Your first mission in 15 minutes

This tutorial takes you from a clean machine to the one thing runward exists to show: **a mission
where the tests are green and the gate is red — for a reason your test suite cannot see.** You will
scaffold the shipped reference mission, break it with a perfectly clean refactor, watch the gate
name the exact line to fix, repair it, and carry the verdict away as a file anyone can re-check
offline. No API key, no account, no network call after the install.

Every command and output below was replayed against the shipped binary before this page was
committed. If a step does not behave as written here, that is a bug — please open an issue.

You need **Node.js 22.12+** and **git**.

## 1. Install

```bash
npm install -g runward
runward --version
```

You should see the version number. (`npx runward <command>` works everywhere `runward <command>`
appears below, if you prefer not to install globally.)

## 2. Scaffold the reference mission

The shipped example is a complete, filled mission — a small request-triage service with its code,
its tests, and every delivery document pointing at the evidence that backs it.

```bash
mkdir triage-demo && cd triage-demo
git init
runward init --example
```

The last line tells you the chain is green out of the box:

```
✓ All expected deliverables are filled. Cross gates on evidence, not on paperwork.
```

Confirm it, in strict mode — the mode CI runs:

```bash
runward check --strict
echo $?
```

Exit code `0`. Every phase is crossed, every CRITICAL/HIGH rule is accounted for in the
`Rule conformance` manifests, and every `applied` row carries a pointer the gate opened and
verified: a file, a symbol, a test.

Take one minute to look around before breaking it:

- `code/` — the service itself, with its test suite (`cd code && npm install && npm test`
  runs it: all green).
- `runward/framing.md`, `runward/architecture.md`, `runward/floor.md` — the delivery documents,
  each with a manifest table at the bottom binding rules to evidence.
- `runward/governance/threat-model.md` — the security claims, bound the same way.
- `runward/adr/` — the decision journal.

## 3. Break it with a clean refactor

Rename a function the way any careful engineer would — everywhere, consistently:

```bash
grep -rl guardFields code/src | xargs sed -i.bak 's/guardFields/validateFields/g'
find code/src -name '*.bak' -delete
```

Now run the tests:

```bash
cd code && npm install && npm test && cd ..
```

**All green.** Of course they are: the behavior did not change by one bit. Every tool you already
have agrees this refactor is perfect.

Now ask the gate:

```bash
runward check --strict
```

```
✗ Floor · frontier-deterministic-boundary — typed pointer
    file:code/src/core/domain/guard.ts#guardFields — symbol "guardFields"
    not found in the file (moved or renamed? update the pointer)
✗ Govern · security-prompt-injection — typed pointer
    file:code/src/core/domain/guard.ts#guardFields — symbol "guardFields"
    not found in the file (moved or renamed? update the pointer)
```

Exit code `1`. Two red lines in a field of green — and read the second one again: it is the
**threat model**. The mission's defense against prompt injection cited that function as its
evidence. Your refactor was clean, your tests are green, and your security document now describes
a function that no longer exists. Nothing else in your toolchain would have said a word.

## 4. Repair it

The gate told you exactly where. Update the two pointers:

```bash
sed -i.bak 's/#guardFields/#validateFields/' runward/floor.md runward/governance/threat-model.md
find runward -name '*.bak' -delete
runward check --strict
```

Exit code `0`. The documents tell the truth again, and it took two lines — because the refusal
named the file, the rule, and the reason.

## 5. Carry the verdict away

The verdict is not a feeling in your terminal; it is a file anyone can re-derive:

```bash
runward check --strict --attest > verdict.intoto.json
runward verify verdict.intoto.json
```

```
✓ subject digest matches — this attestation is about this exact tree
✓ verdict re-derives (clean) under --strict
✓ verified — the attestation binds to this tree, and its verdict re-derives on the repo alone.
```

No network, no key, no account — `verify` recomputes everything from the working tree. Change any
file by one line and run `verify` again: it refuses, and names the drift. Commit the attestation,
attach it to a release, or hand it to a reviewer; months later, on a laptop with the wifi off,
they can check it alone.

## 6. Point your agent at the method

The reference mission is a destination. Your real missions are built by your agent, under your
gates. Open any project in your agent (anything that reads `AGENTS.md`: Claude Code, Cursor,
Copilot, Gemini CLI, Windsurf…) and the charter runward wrote binds it to the loop: surface the
rules that govern the files it touches (`runward rules --for <paths>`), read them
(`runward explain <rule>`), account for each in the manifest, and **run the gate itself before
ending its turn**. You own every crossing; `runward check` tells you where the mission stands at
any moment.

For a blank project, `runward init` scaffolds the empty mission and walks you through the framing
prompts (tool profiles are opt-in — pick the ones matching your agent, or keep the vendor-neutral
`AGENTS.md` alone). For an existing repository, start with:

```bash
runward characterize
```

Read-only archaeology: it inventories what the repo already proves, drafts the retroactive
decision records as hypotheses, and leaves the gate red until you — not it — ratify each one.

## Where to go next

- **The filled reference, at rest**: [`examples/request-triage/`](../examples/request-triage/) in
  the git repository — every deliverable completed, with the runnable floor in `code/`.
- **Start a floor from the reference stack**: [`floor-ts/`](../floor-ts/) — a clonable scaffold
  (it lives in the git repository, not in the npm package).
- **Your role in all this**: [the operator role](operator-role.md) — one accountable human; the
  agent executes under their gates.
- **Where runward fits, and where it does not**: [when to use it](when-to-use.md).
