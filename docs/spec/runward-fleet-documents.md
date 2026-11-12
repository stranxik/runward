# runward-fleet: the documents of a mission

**Status**: specification of `runward-fleet/documents`, dated 2026-11-11, with the code that implements it
(`packages/runward-fleet/ui/documents.js`) · **Decided by**:
[ADR-0127](../adr/ADR-0127-mission-documents-are-rendered-by-runward-fleet-from-a-closed-subset-of-markdown-safe-by-construction-and-checked-on-the-way-out-the-register-is-read-from-each-records-header.md)
· **Reads**: Markdown text handed by the caller, and nothing else

A mission's documents are written in a repository this package does not hold. Shown in a page they are
untrusted text. This module renders them from a closed subset of Markdown into a closed list of
elements, checks an output before a page inserts it, reads the register of the decision records and the
port placement table. It has no import, no clock, no network and no DOM.

## 1. What it exports

| Export | What it gives |
|---|---|
| `renderDocument(markdown, context?)` | a string of elements from the closed list (section 2) |
| `checkRendered(html)` | `{ ok, refusals }`: the second net a page asks before inserting (section 3) |
| `register(files)` | the register of decision records, `runward-fleet-register/0` (section 4) |
| `topology(markdown)` | the port placement table as data, `runward-fleet-topology/0` (section 5) |
| `DOCUMENT_ELEMENTS`, `DOCUMENT_ATTRIBUTES`, `EXTERNAL_REL`, `EXTERNAL_TARGET`, `MAX_DOCUMENT_LENGTH` | the closed lists and the limits below |
| `DOCUMENT_RULES` | rules D1 to D5, in English and French, with where each is held |
| `REGISTER_STATUSES`, `REGISTER_FORMAT`, `TOPOLOGY_FORMAT` | the template's status words, and the two formats |

## 2. `renderDocument`

`context` (every key optional):

| Key | Content |
|---|---|
| `path` | the document's path in its repository, such as `runward/adr/ADR-0001-x.md`; a relative link is resolved against it. Without it a relative link is shown as text |
| `route(path)` | the application's route for a path that is one of the mission's documents: a string matching `#/` then letters, digits and `._~%/-`; anything else is not believed |
| `source(path)` | the `https://` address of that file in the forge at the commit read; checked like an address of the document, and believed only when its path ends with `/` and the path asked, each segment encoded as `encodeURIComponent` does |

**The path handed to `route` and `source`** is decoded: segments joined by `/`, none empty, none `.` or
`..`, none holding a separator, a control character, `%`, `?` or `#`. It is text, not a piece of an
address: both functions encode it (`encodeURIComponent`, by segment or whole) before they write it into
what they answer. A function that concatenates it is handed nothing a second decoding or an address
parser would read as structure, and a `source` whose answer the URL parser rewrites is not believed; a
`route` is the application's own format, so what its router does with a segment is the application's.

**Elements**: `h1` `h2` `h3` `h4` `p` `ul` `ol` `li` `pre` `code` `b` `i` `blockquote` `table` `tr` `th`
`td` `hr` `a`. **Attributes**: `href`, `rel`, `target` on `a`; `id` on a heading. Nothing else, ever: no
class, no style, no event attribute, no image, no line break element. Blocks are separated by a line end.

**The `doc-` namespace is a contract with the page that hosts the document**: every `id` the renderer
writes and every fragment link it keeps starts with `doc-` (`#doc-…`), so a deployment gives no element
of its own an `id` that starts with `doc-`, and shows at most one rendered document per page, or two
documents could carry the same `id`.

**The subset**:

| Markdown | Output |
|---|---|
| `#` to `######` headings | `h1` to `h4` (levels five and six are `h4`), `id="doc-<slug>"`; a slug is at most 80 UTF-16 units and never ends inside a surrogate pair; a repeated slug gains `-2`, `-3`, the next suffix that no heading of the document carries, so no two headings share an `id`; a heading without a letter is `doc-section` |
| paragraphs | `p`; the line ends of the source stay line ends in the text |
| `-`, `*`, `+` and `1.` `1)` lists, nested by indentation | `ul`, `ol`, `li`; a list goes on past blank lines while a sibling item follows |
| `>` quotes, nested | `blockquote` |
| a row of `\|` cells followed by a divider row | `table`, `tr`, `th`, `td`; a row is cut to the header's width and a short row is left short (it is not filled with empty cells); at most 64 columns; `\|` is a bar in a cell; alignment is dropped |
| fences of three or more backticks or tildes | `pre` and `code`; the info string is dropped; an unterminated fence runs to the end |
| `---`, `***`, `___` | `hr` |
| `` `code` `` | `code` |
| `**bold**`, `__bold__`, `*italic*`, `_italic_` | `b`, `i`; an underscore inside a word is text; beyond 8 pairs one inside the other, a pair keeps its marks as text |
| `[text](address "title")`, `![text](address)` | `a` (the title is dropped; an image is a link with its text) |
| `<https://…>` and a bare `https://…` | `a`, with the address as its text |
| `\` before punctuation | that character, as text |

Everything else is text, shown as written: raw HTML, comments, entities (an `&` of the source is always
shown), reference links and their definitions, setext underlines, footnotes, task boxes.

**Addresses**. A link becomes an anchor only in three cases; otherwise the document's own text
(`[text](address)`) is shown:

| Written | Becomes |
|---|---|
| `#fragment` | `href="#doc-<slug>"` |
| a relative path, or a path from the repository's root (`/x`) | percent-decoded by segment, `.` and `..` resolved; refused if it leaves the repository, or if a decoded segment holds a separator, a control character, `%`, `?` or `#` (so `%252e%252e`, `a%3Fb` and `a%23b` are text, and so is a file whose name holds one of the three); then `route(path)`, else `source(path)`; the fragment and the query are dropped |
| `https://host…` | kept if the URL parser reads it, the scheme is `https:`, the host is made of letters, digits, `-`, `_` and dots (or is an address in brackets) and there are no credentials; written as the parser normalises it, with `rel="noopener noreferrer nofollow"` and `target="_blank"` |

Refused in every case: an address of more than 1,024 characters, or holding a space of any kind, a
control or invisible character (those below included), or a backslash; any scheme other than `https:`;
`//host`.

**Before anything is read**: line ends become `\n` (U+2028 and U+2029 included), a tab becomes four
spaces, and each control character, bidirectional override or isolate (U+202A to U+202E, U+2066 to
U+2069), tag character (U+E0000 to U+E007F) and half surrogate pair becomes U+FFFD.

**Left as written in text**, because writing in some scripts needs them: the zero-width space, non-joiner
and joiner (U+200B to U+200D), the left-to-right and right-to-left marks (U+200E, U+200F), the Arabic
letter mark (U+061C), the soft hyphen (U+00AD), the word joiner (U+2060) and the combining grapheme
joiner (U+034F). They are invisible, so a document can use them to make two texts that differ look the
same, and the three directional marks can change where neighbouring punctuation is drawn. None is
accepted in an address and none reaches a heading's `id`. A deployment that wants them shown does so
in its style or before it renders.

**Limits**: nesting beyond 8 levels of quotes and lists is shown flat, and beyond 8 pairs of emphasis
the marks are text; a table row writes no more cells than it holds; a document over
`MAX_DOCUMENT_LENGTH` (1,048,576 characters) is one `pre` of plain text. On the 32 pathological inputs
of the test, 100,000 characters each, the output is at most 16.4 times its source (a document made of
one-character headings). The renderer throws only on a defect of its own (a piece it did not build, an
element outside the list) or of a `context` function.

## 3. `checkRendered`

Returns `{ ok: boolean, refusals: [{ at, why, found }] }`, at most twenty refusals, `at` an offset in the
string. `why` is one of:

| `why` | Refused |
|---|---|
| `not-a-string` | anything that is not a string |
| `hidden` | a control character, a carriage return, a bidirectional override or isolate, a tag character, half a surrogate pair, anywhere |
| `text` | a bare `>`, or an `&` that does not start `&amp;` `&lt;` `&gt;` `&quot;` `&#39;` |
| `tag` | a tag that is not `<name>`, `</name>` or `<name a="v" b="w">` with single spaces, lower-case names and double quotes; a value holding `<` or a bare `&`; a tag never closed |
| `element` | a name outside `DOCUMENT_ELEMENTS`; `</hr>` |
| `attribute` | an attribute outside `DOCUMENT_ATTRIBUTES`; a heading without `id="doc-…"`; an `a` whose attributes are neither `href` alone nor `href`, `rel`, `target` in that order |
| `href` | an address that is neither a route, a slug, nor `https://` with a plain host, an optional port and the exact `rel` and `target` |
| `nesting` | an element left open or closed out of order; a link inside a link; `li` outside a list, `tr` outside a table, a cell outside a row; an element where its holder may not hold it (below); text directly in `ul`, `ol`, `table`, `tr` or `pre`; more than 64 elements open at once |

**What an element may hold**:

| Holder | Holds |
|---|---|
| the document, `blockquote`, `li` | text and any element but `li`, `tr`, `th`, `td` |
| `p`, `h1` to `h4`, `th`, `td`, `a`, `b`, `i` | text and `a`, `b`, `i`, `code` (never a link in a link) |
| `ul`, `ol` | `li` only, no text |
| `table` | `tr` only, no text |
| `tr` | `th` and `td` only, no text |
| `pre` | `code` only, no text |
| `code` | text only |

This is narrower than HTML allows and is what the renderer writes. It is there so that an accepted
string is read by a browser's parser as the tree the string writes: no block closes a paragraph early,
nothing is moved out of a table, no heading sits in a heading, and the depth stays far under the depth
at which a parser flattens. The check guarantees the closed lists and this shape; it does not run a
parser, and a page that inserts an output in a context other than the body of an HTML document (inside
`svg`, `math`, `select`, `template`, a table of its own) is outside what it answers.

A page inserts a document only when `ok` is true, and otherwise shows the source as plain text.

## 4. `register`

`files` is `[{ path, text }]`. Only paths in an `adr/` folder are looked at. The result:

| Key | Content |
|---|---|
| `format` | `runward-fleet-register/0` |
| `count` | the number of records |
| `adrs` | the records, by number then path |
| `byStatus` | one group per status of `REGISTER_STATUSES`, then `as-written` and `not-observed`: `{ status, n, of, numbers }`; each record is in one group |
| `duplicates` | the numbers two files carry |
| `unread` | `{ path, why }` for a file of `adr/` that is not a record: `template` (`ADR-0000`), `not-a-record-name`, `no-text` |

A record:

| Key | Read from | When absent |
|---|---|---|
| `number` | the file name, `ADR-NNNN-…md`, four digits | never |
| `path` | the path given | never |
| `title`, `titleNumber` | the first non-empty line, `# ADR-NNNN: title` | `null` |
| `date`, `dateWritten` | `**Date**:`; `date` is its leading `YYYY-MM-DD` | `null` |
| `status`, `statusWritten` | `**Status**:`; `status` is the template's word the line starts with, when the line says no other status | `status` is `null` when the line starts with another word, or goes on with a second status word: it is shown as written |
| `supersededBy` | a status read as `superseded` that starts with `superseded by ADR-NNNN` or `superseded by [ADR-NNNN…](…)` | `null` |
| `supersedes`, `refines` | `**Supersedes**:`, `**Refines**:`: the records the line names first, written `ADR-NNNN` or as a link whose text starts with it, separated by commas or `and`, each optionally followed by a parenthesis | `[]` |
| `deciders`, `method` | `**Deciders**:`, `**Method**:` | `null` |
| `reopening` | the section `## Reevaluation trigger…`: `{ text, setOn, watchedVia }`, the last two from its `**Trigger set on**` line | `null`, or a `null` field |
| `settles` | the section `## What would settle it` | `null` |
| `references` | the list items of `## References` | `null` |

The header is read from the title line to the first `## ` heading, the first line of each name winning.
A line inside a fenced block, inside an HTML comment, or that starts with one (`<!--`) is not a field:
a reader of the record does not see it as one. A `null` is read "not observed" by a view. Values are the
file's text, unescaped.

**A status line that says two things is not read.** After the template's word the line starts with, a
second status word (`proposed`, `accepted`, `superseded`, `deprecated`, `rejected`, `withdrawn`, as a
whole word, the first one repeated excepted) makes `status` `null`: `accepted, then superseded by
ADR-0030`, `accepted; deprecated on …` and `accepted: no, rejected by the author` are shown as written,
in the `as-written` group. One form is read, because it is the one missions write: a line that starts
with `superseded by` a record may go on with the template's statuses the record had before
(`superseded by ADR-0019 (2026-11-10); accepted (2026-11-08)` reads `superseded`, by `0019`). A record
number is four digits and no more: `ADR-00301` names no record.

## 5. `topology`

Returns `{ format: "runward-fleet-topology/0", found, columns, ports, families }`. `found` is true when
the note holds a table whose header starts with `Port` and has a `Location family` column. `ports` gives
each row as `{ port, adapter, family, dataClasses, level, adr, trigger, example }`, the cells as written
(`null` for a column the table does not have or an empty cell); `example` marks a template row
(`_e.g._ …`); a row of ellipses is left out. `families` groups the ports by location family:
`{ family, n, of, ports }`. Nothing is drawn.

## 6. Rules, and where each is held

| Rule | Statement | Held by |
|---|---|---|
| D1 | No character of a document reaches the page unescaped: raw HTML is shown as text | the corpus, the property test, planted copies that let `<` or `&` through |
| D2 | Markup comes from a closed list of elements and attributes; a document sets no class, no style, no image | the same, and three planted copies that try to emit outside the lists and throw |
| D3 | A link is rewritten, never copied: a slug, a route of the application, or an https address without credentials; anything else is text | the `address`, `relative`, `attribute` and `slug` families, with a context that encodes, one that concatenates and one that answers another file; fifteen planted copies |
| D4 | A rendered document is inserted only if the check by closed list passes | 126 refused outputs with their reason; eighteen planted copies of the check; the deployment's page |
| D5 | The register says what each record's file says | the golden register of a real mission, a second reading of each header, 21 status lines that say more than one word or sit in a comment or a fence, twelve planted copies |

All in `test/unit/fleet-documents.test.js`; the vectors are `test/support/fleet-documents-corpus.js`.
