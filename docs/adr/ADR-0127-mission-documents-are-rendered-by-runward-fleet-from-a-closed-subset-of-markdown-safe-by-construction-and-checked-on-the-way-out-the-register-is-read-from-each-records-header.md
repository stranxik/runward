# ADR-0127: Mission documents are rendered by runward-fleet from a closed subset of Markdown, safe by construction and checked on the way out; the register of decision records is read from each record's header

**Date**: 2026-11-11
**Status**: proposed (written by an agent session; acceptance is the maintainer's, by approving the pull
request that carries this record). Non-constitutional: it adds one module and one export to
`runward-fleet`, changes no view, no rule of the index and no accepted record
**Deciders**: the maintainer, by approving the pull request that carries this record; proposed by an
agent session. Under ADR-0088 decision 4 the maintainer is the single accountable person, and the
agent's writing is disclosed throughput, not independent review
**Method**: read at `main@d05b597`: `packages/runward-fleet` (`ui/views.js` and its `md` reader, the view
rules, `test/unit/fleet-linear-readers.test.js`), ADR-0093 (decision 11), ADR-0121, ADR-0125, the record
template (`templates/mission/adr/ADR-0000-template.md`) and the topology note's template. The 21 decision
records and the topology note of a real public mission, read at one commit and kept as fixtures
(`test/fixtures/fleet/documents/hosted/`, `SOURCE.json` names the repository and the commit). The module
measured on 27 adversarial inputs of 100,000 characters
**Relates to**: [ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md)
(one interface, two deployments: the same module runs in the static build and in a hosted deployment),
[ADR-0125](ADR-0125-the-decision-reading-a-plain-language-projection-of-the-fleet-index-from-a-closed-lexicon-in-two-languages-without-a-model.md)
(a projection written once in `runward-fleet`, rules held by tests with planted controls),
[ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(decision 10: the package imports nothing from runward and opens no connection), ADR-0054 (nothing here
is on the verdict path)

## Context

A deployment that shows a mission wants to show more than its verdict: the mission's documents as a
reader would read them, and the register of its decision records. Those documents are Markdown files
written in a repository `runward-fleet` does not hold. Shown inside a page, they are untrusted content:
a document can carry a script element, an event handler, an address that runs code, a link that leaves
the application with the reader's context, or characters that hide or reorder what the reader sees. The
page that shows them may hold something worth stealing.

`ui/views.js` already has a small Markdown reader, `md`, for the pull-request summary runward itself
writes. It escapes first and knows headings, tables, code and three inline marks. It has no links and no
lists, and it was written for a text of known origin.

The index carries `adrCount` only. A register needs the text of the records, read by whoever has access
to the repository, and the same reading of that text everywhere.

No Markdown library is taken: a general parser accepts raw HTML by design and is made safe by a filter
applied afterwards, which is the construction this record avoids, and `runward-fleet` has no dependency.

## Decision

### 1. One module, `runward-fleet/documents`, pure

`ui/documents.js`, exported as `runward-fleet/documents`. No import, no clock, no network, no DOM, no
sink: the same code runs in a browser, on a server and in the tests. It is a new file, so the views are
untouched. It exports `renderDocument`, `checkRendered`, `register`, `topology`, the closed lists
(`DOCUMENT_ELEMENTS`, `DOCUMENT_ATTRIBUTES`) and its rules (`DOCUMENT_RULES`, D1 to D5, in English and
French). The specification is [docs/spec/runward-fleet-documents.md](../spec/runward-fleet-documents.md).

### 2. The renderer is safe by construction

`renderDocument(markdown, context)` returns a string of elements.

- **Nothing of the source is copied.** The output is assembled from pieces that only two functions
  make: `text`, which escapes `&`, `<`, `>`, `"` and `'`, and `el`, which writes a tag from a closed list
  around pieces already built. A string that did not pass through one of them is refused with an error
  where it is assembled. Raw HTML in a document (a script, an image, an SVG, an iframe, a comment) is
  therefore shown as the text it is.
- **A closed list of elements**: `h1` to `h4`, `p`, `ul`, `ol`, `li`, `pre`, `code`, `b`, `i`,
  `blockquote`, `table`, `tr`, `th`, `td`, `hr`, `a`. **A closed list of attributes**: `href`, `rel` and
  `target` on `a`; `id` on a heading, always a slug the renderer builds, prefixed `doc-`. No class, no
  style, no event attribute, no image: `![text](address)` becomes a link with that text. A deployment
  styles the document by element, inside the container it gives it.
- **A closed subset of Markdown**: headings, paragraphs, bullet and numbered lists (nested), quotes
  (nested), tables, fenced code, rules, code spans, bold, italic, inline links, autolinks and bare
  `https://` addresses. Reference links and their definitions are not followed: they are shown as written.
- **A link is rewritten, never copied.** `#fragment` becomes `#doc-` and a slug. A relative path is
  decoded, normalised and must stay inside the repository; it is handed to `context.route(path)`, which
  answers the application's route (`#/…`) when the file is one of the mission's documents, otherwise to
  `context.source(path)`, which answers the file's address in the forge at the commit read. What those
  functions answer is checked like any address of the source. The path they are handed is decoded text
  they must encode: a segment that decodes to something holding `%`, `?` or `#` is refused, so a
  function that concatenates is handed nothing a second decoding or an address parser would read as
  structure, and a forge address is believed only when its path ends with the path asked, encoded by
  segment. An absolute address is kept only when it
  is `https://`, names a host and carries no credentials; it is written as the URL parser normalises it,
  with `rel="noopener noreferrer nofollow"` and `target="_blank"`. Anything else (`javascript:`, `data:`,
  `vbscript:`, `file:`, `http:`, a protocol-relative `//`, a backslash, a space or a control character
  in the address, an evidence pointer such as `file:` or `adr:`) is shown as the text the document wrote,
  without an anchor. A link never holds a link.
- **Nothing hidden.** Control characters, bidirectional overrides and isolates, tag characters and
  half surrogate pairs are replaced by U+FFFD before anything is read. Invisible characters that writing
  in some scripts needs (zero-width space and joiners, directional marks, soft hyphen, word joiner) are
  left as written in text and refused in an address; the specification lists them.
- **Bounded.** Every scan is linear in the document: bracket pairs and runs of backticks are indexed
  once, emphasis is resolved with one stack per delimiter, a destination or a title is read no further
  than a fixed length, nesting beyond eight levels is shown flat, and emphasis beyond eight pairs one
  inside the other keeps its marks as text, so no piece is assembled more than eight times. A table row
  writes no more cells than it holds: a short row is not filled to the header's width. A document over
  1,048,576 characters is shown as one block of plain text.
- **No two headings share an id.** A repeated slug takes the next suffix that no heading carries, and a
  slug is never cut through a surrogate pair. The `doc-` prefix is a contract with the page that hosts
  the document.

### 3. A second net, `checkRendered`

`checkRendered(html)` reads an output as tokens, with its own reader, and answers
`{ ok, refusals: [{ at, why, found }] }`. It refuses an element or an attribute outside the lists, a
tag that is not written exactly as the renderer writes one, an `href` that is not a route (`#/…`), a
slug (`#doc-…`) or an `https://` address with a plain host and no credentials, an absolute link without
its exact `rel` and `target`, a heading without its slug, a link inside a link, an element left open or
closed out of order, a bare `>` or an entity other than the five the renderer writes, and any hidden
character. It also refuses an element where its holder may not hold it (a block in a paragraph, a
heading or a cell; anything but rows in a table and cells in a row; text between rows; an element in a
code span) and more than 64 elements open at once, so that a browser's parser reads an accepted string
as the tree it writes, without closing or moving anything. Its https rule is written apart from the
renderer's and does not use the URL parser.

A page inserts a rendered document only when `ok` is true; otherwise it shows the source as plain text.
The check is not a sanitiser: it changes nothing, it answers.

### 4. The register is read from each record's header

`register(files)` takes `[{ path, text }]` and reads the files named `adr/ADR-NNNN-*.md` (the template,
`ADR-0000`, is listed apart). For each record: its number (the file name's), its title and the number
its title line carries, `**Date**`, `**Status**`, `**Supersedes**`, `**Refines**`, `**Deciders**`,
`**Method**`, the reevaluation trigger with the day it was set on and what watches it, what would settle
it, and its references. The header ends at the first `## ` heading.

Nothing is inferred. A field the file does not carry is `null`, which a view reads "not observed". The
status word is one of the template's (`proposed`, `accepted`, `superseded`, `deprecated`) only when the
status line starts with it and says no other status after it: a second status word, `rejected` or
`withdrawn` makes `status` `null`, and the line is shown as written. One form is read, the one missions
write: `superseded by` a record, then the statuses it had before. A header line in a fenced block or in
an HTML comment is not a field. A record number is four digits and no more, and a linked record
(`[ADR-0030](…)`) is read like a bare one. A relation is
listed on the record that writes it and is never mirrored onto the record it names; of a line such as
"ADR-0018 (accepted …), which stays in force …; through it, ADR-0002" only the records named first are
relations. The groups by status arrive with their n / N and the list they count, so no view computes a
denominator (view rules 1 and 3 of ADR-0093). Every value is the file's text: a view escapes it or
renders it with `renderDocument`.

### 5. The topology note, as data

`topology(markdown)` reads the port placement table of a mission's topology note (the first table whose
header starts with `Port` and holds a `Location family` column) and gives its rows as written, by column,
with the ports grouped by location family, n / N and the list. It draws nothing. A drawing made from it,
and the diagram of where a mission's information comes from (which is read from the index, not from a
document), are a view's work and are not in this record: an SVG is outside the closed list of a rendered
document on purpose, and a drawing has to be made by code that escapes every label.

## Alternatives discarded

- **A Markdown library and a sanitiser.** The usual construction: parse everything, raw HTML included,
  then remove what is dangerous. Its safety is the completeness of a deny list against a parser's
  behaviour, and it adds a dependency to a package that has none.
- **Extending `md` of `ui/views.js`.** It would change a view that has a golden test and a different
  input (runward's own summary), and put two origins behind one reader.
- **Escape everything and show the source.** Safe, and the fallback when the check refuses. As the only
  reading it does not answer the need: a table of forty rows or a record's links are not readable as
  source.
- **Rendering in a sandboxed frame.** A deployment's choice, compatible with this module, and not a
  reason to emit markup that would be dangerous outside the frame.
- **A register computed from the index.** The index carries a count, not the records.

## Consequences

- **Positive**: one renderer and one register for the static build and a hosted deployment; no raw HTML
  of a document can reach a page through it; a document cannot set a class, a style or an image; the
  output needs no inline style and no script, so it fits a strict content security policy and a single
  Trusted Types sink; the index and its contract are untouched.
- **Negative, accepted**: the subset is smaller than what forges render (no image, no raw HTML, no
  reference link, no footnote, no task list, no alignment in tables), so a document reads plainer here
  than in its forge; a document's own line ends inside a paragraph are kept as line ends and shown only
  if the deployment's style asks for them; a host name outside letters, digits, hyphens, underscores and
  dots is not linked; the fixtures hold 21 records of a public repository, copied at one commit.
- **Not done here**: the drawings (section 5); the witness in a real browser on a planted mission; the
  check at ingestion of documents a deployment would store. They belong to the deployment that inserts
  the output.

## What would settle it

Shown in this pull request, in `test/unit/fleet-documents.test.js`, each with its planted control:

1. A corpus of 201 attack vectors in ten families (raw tags, raw tags inside each construct, addresses
   that are not https, attribute break-outs, entities, relative paths, slugs, structures left open or
   nested, hidden characters, very long inputs), each asserted on the parsed tokens of the output by a
   reader written in the test, which shares nothing with `checkRendered`: the exact list of anchors, the
   text the reader sees, the elements present and absent.
2. A seeded property test: 10,000 strings drawn from a dangerous alphabet yield nothing outside the
   closed lists; over 5,000 outputs with one random change each, whatever `checkRendered` accepts the
   test's reader accepts too.
3. Twenty-five copies of the module with one rule of the renderer loosened each turn the corpus red;
   for seventeen of them `checkRendered`, unloosened, refuses an output too, and the eight others are
   rules only the renderer can hold (where a relative path leads, what a context is handed and what it
   answers, which suffix a heading takes, what a refused link shows, the length limit). Eighteen copies
   with one rule of the check loosened each accept an output it must refuse, out of 126.
4. 100,000 characters of each of 32 pathological inputs render in under ten times the CPU time of a plain
   document of the same size on the same machine, and never under 200 ms (a fixed 200 ms failed on a slower
   Windows runner: 203 ms; on macOS the worst input takes about 3 times the plain document, a planted
   quadratic scan 26 to 50 times), grow at most 20 times (16.4 measured, on one-character headings) and
   are checked within the same bound. Three planted
   copies exceed it: an unbounded scan of backtick runs, emphasis nested without a limit (on the three
   closing shapes, `*`, `**` and `_`), and short rows filled to the header's width (more than 200 times
   the source).
5. Every Markdown file of this repository's own mission, records, specifications and templates renders
   inside the closed lists.
6. The register of the 21 records of the real mission is golden and is compared with the header lines
   found by a plain search of each file; five planted readings (a status guessed, a word found anywhere,
   the template counted, every mention taken as a relation, a field read below the header) are caught.
   Twenty-one status lines that say more than their first word, or sit in a comment or a fence, are
   read as the specification says, and seven planted readings (a second word not looked for, any word
   after `superseded by`, a template status after any first word, a commented line, a fenced line, a
   number that goes on with a digit, a linked record not read) each change exactly the lines they hold.
7. The findings of the adversarial review of 2026-11-11 are in those tests, each input as a vector:
   nested emphasis that closes rendered in time quadratic in its length (100 KB in 789 ms, 400 KB in
   9.1 s; now 88 ms and 161 ms), a table of 64 columns and short rows grew its source 292 times (100 KB
   to 29.2 MB, checked in 1.16 s; now 4.5 times, checked in 59 ms), segments encoded twice reached a
   context that concatenates, a status line that went on with another status read as its first word, a
   heading could be given an id another heading wrote, and the check accepted strings a browser
   re-orders. The times are CPU on the author's machine, one run each.

Still to be seen, outside this repository: a browser shows the corpus on a planted mission with no
dialog, no `securitypolicyviolation` event and no request to a host other than the service and the
declared forge. Against: a vector that reaches a page as markup, or a real record whose status the
register reads differently from its file, reopens this record.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, with ADR-0121; or earlier when: a rendering defect is reported; the record
template changes its header; a construct outside the subset is asked for by three missions (images
first: they need a decision on where they load from); a forge renders an address form this module
refuses and readers ask for it; a static analyzer raises a polynomial pattern on `ui/documents.js`.

**Trigger set on**: 2026-11-11 · **Watched via**: `test/unit/fleet-documents.test.js` (corpus, property,
planted controls, time bound, golden register), code scanning on `packages/runward-fleet`

## References

- [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
  (decisions 10 and 11),
  [ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md),
  [ADR-0125](ADR-0125-the-decision-reading-a-plain-language-projection-of-the-fleet-index-from-a-closed-lexicon-in-two-languages-without-a-model.md),
  ADR-0054, ADR-0088 (decision 4).
- [docs/spec/runward-fleet-documents.md](../spec/runward-fleet-documents.md);
  `packages/runward-fleet/ui/documents.js`; `test/unit/fleet-documents.test.js`;
  `test/support/fleet-documents-corpus.js`; `test/fixtures/fleet/documents/hosted/`.
- RWD-2026-0206 (`test/unit/fleet-linear-readers.test.js`): the readers of `runward-fleet` are linear,
  measured as CPU time.
- The HTML Standard (tokenization, character references); the URL Standard (parsing, special schemes);
  the Content Security Policy and Trusted Types specifications; CommonMark 0.31 (the constructs kept).
