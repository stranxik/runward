# ADR-0132: Code analysis beyond TypeScript and JavaScript: a second language is opened by the first pilot that asks for it, and until then the gate names what it does not read

**Date**: 2026-11-24
**Status**: proposed. It reopens ADR-0118 under that record's own trigger ("when a pilot asks for a second language"):
a candidate pilot, an integrator whose delivery estate is mostly Java, .NET and Python, is expected to ask. The
maintainer asked for this record on 2026-11-20; he has not read this text: it becomes accepted with his approval of
the pull request that carries it, or is amended on his review. Non-constitutional: it changes no format and amends no
accepted record. Fable review planned when the quota returns, non-blocking
**Deciders**: the maintainer, by approving the pull request that carries this record; proposed by an agent session.
Under ADR-0088 decision 4 the maintainer is the single accountable person, and the agent's writing is disclosed
throughput, not independent review
**Method**: read on `main@3ec1de3`: ADR-0114, ADR-0118, ADR-0119, `src/lib/analyze.ts`, `src/lib/conformance.ts`
(`PATH_TOKEN`, line 550), `src/lib/evidence.ts`, the 0.47.0 section of `CHANGELOG.md`. Measured on 2026-11-20 with
the published `runward@0.47.0`, outside this repository: `init --example`, then the same mission with every `.ts` file
of `code/` renamed `.java` and every pointer of the mission documents rewritten to match (the rule files left as
shipped). Not measured: a real Java, C# or Python project; any parser's cost
**Relates to**: [ADR-0118](ADR-0118-built-in-analyzers-read-the-delivered-code-against-what-the-mission-declares-under-a-policy-it-pins.md)
(the analyzers, policy 1), [ADR-0119](ADR-0119-three-levels-of-proof-and-one-required-level-each-row-says-whether-its-evidence-is-re-derived-attested-or-declared.md)
(the levels), [ADR-0114](ADR-0114-an-identifier-is-read-outside-comments-and-a-strict-green-requires-a-row-the-gate-verified.md)
(symbols read outside comments), ADR-0054 (no network, model or process spawn in the verdict path), ADR-0129
(proposed: zero runtime dependencies)

## Context

A team that delivers in Java, C# or Python reads runward's pages and asks whether runward works for them. The answer
the code gives is in two parts, and only one of them was ever written down.

**What works in every language, measured.** The example mission, its code renamed to Java and its pointers rewritten,
passes `check --strict` (exit 0) under the lock `init` writes (`"requiredLevel": "re-derived"`,
`"analysis": "runward-analysis/1"`). The run says why, in its own words:

```
◌ not analysed — Java source (the policy reads JavaScript and TypeScript): 13 file(s)
◌ not analysed — domain-core files in a language the policy does not read: their boundary is not checked: 7 file(s)
◌ not analysed — cited symbols in files the policy does not read: 8 file(s)
required: mechanical (re-derived asked by runward/scaffold-lock.json, `requiredLevel`) · ✓ met
! re-derived: not reachable, Java is not analysed; this run requires mechanical
```

Typed pointers (`file:`, `test:`, `adr:`), the symbol search, execution reports (JUnit, SARIF, LCOV), the seal and the
decision records do not depend on the language. Symbols are read outside comments for the languages ADR-0114 lists
(Java, Python, Go, Rust, Ruby, PHP among them); a C# file is read whole, comments included, and `.cs`, `.kt`, `.scala`,
`.swift` are not in `PATH_TOKEN`, so an untyped prose pointer to such a file is not taken as a path.

**What does not.** The analyzers of policy 1 read TypeScript and JavaScript only (ADR-0118). On any other language the
domain-core boundary, the cited symbols' invariants and the other checks of policy 1 are not run, and `re-derived` is
not reachable: the run falls back to `mechanical`, names the fallback, and passes. Nothing refuses; the assurance is
lower, and it is said. The fallback is the right default; what is missing is the reading itself, and a sentence on the
public pages that says which languages are read.

## Decision (proposed)

1. **A second language is opened by the first pilot that asks for it**, not chosen in advance. The pilot's language
   census (files and lines per language in the declared territory) fixes the order. Absent a pilot, the default order
   is Python (the common language of agentic systems), then Java, then C#.
2. **A language is "read" only once its analyzers meet policy 1's bar**: the same invariants as TypeScript and
   JavaScript (the core's import boundary, dynamic execution and process creation, secrets of known format, tests
   without an assertion, placeholder symbols), each with sabotage cases in `test/unit/analyze-bench.test.js` that the
   release must refuse, and the undue-refusal count of ADR-0118's trigger kept per language. Until then the language
   stays "not analysed" and nothing is judged as if it were covered (ADR-0118, unchanged).
3. **The parser stays inside the verdict's rules**: no process spawn (no `javac`, `python -c ast`, `dotnet`), no
   network, no model (ADR-0054). The candidates are a hand-written lexer per language, as ADR-0114 did for comments, or
   a parser shipped as code or WebAssembly inside the package, which ADR-0129 (proposed: zero runtime dependencies) must
   then admit by an amendment. The choice is made in the pull request that opens the first language, with its cost
   measured on the pilot's estate.
4. **Now, independently of 1 to 3**, a small change with its own pull request: `.cs`, `.kt`, `.kts`, `.scala` and
   `.swift` join `PATH_TOKEN` and the comment-aware symbol read of ADR-0114 (C#: `//`, `/* */`, verbatim and raw
   strings; Kotlin, Scala, Swift: `//` and nested `/* */`). It changes no verdict that was green on a file the gate
   could already read; it makes a C# symbol found in a comment stop counting.
5. **Say it**: the documentation (`concepts`, `formats`) and runward.dev say which languages the analysis reads, and
   that every language gets the evidence layer. The fallback line above is the wording to reuse.

## Alternatives discarded

- **Refuse a mission whose territory is in an unread language.** It turns a lower, named assurance into a red verdict
  for every Java, C# or Python team, while their evidence is checked like anyone else's.
- **Count an unread language as read when its evidence resolves.** It is ADR-0118's "judged as if it were covered", the
  false green that record exists to prevent.
- **Run each language's own compiler or interpreter.** A process spawn in the verdict path (ADR-0054), a toolchain to
  install, and a verdict that depends on that toolchain's version.

## Consequences

- A team in any language can adopt runward today at `mechanical`, with the reason printed on every run; the pages say
  so instead of leaving the question open.
- The first pilot that asks gets a dated plan for its language, and the bench says when the language is read.
- C# evidence becomes as precise as Java's for symbols (decision 4).
- The package may grow by a parser (decision 3), which reopens ADR-0129 if it is accepted by then.

## What would settle it

- A pilot's language census, and its first run of `check --strict` on a real repository: the fallback line, the count
  of files not analysed, and whether the evidence layer alone was enough for its accountable people.
- For the language opened: the bench's sabotage cases refused, the undue-refusal count after a month of the pilot's
  merges, and the analysis time on its largest repository.

## Reevaluation trigger (mandatory, dated)

Reopen when a pilot asks for a language (decision 1), at the first undue refusal caused by an analyzer of a newly read
language, when ADR-0129 is accepted or discarded, or on 2027-02-05 (ADR-0118's date), whichever comes first.

**Trigger set on**: 2026-11-24 · **Watched via**: the pilot's operator log, `test/unit/analyze-bench.test.js`, and
ADR-0129's pull request

## References

- `runward@0.47.0`, `init --example`, run on 2026-11-20 (Node.js of the session's machine), output quoted above.
- ADR-0114, ADR-0118, ADR-0119, ADR-0054, ADR-0129 (proposed).
