# runward-fleet: the documents of a mission

**Status**: specification of `runward-fleet/documents`, dated 2026-11-11, with the code that implements it
(`packages/runward-fleet/ui/documents.js`) · **Decided by**:
[ADR-0126](../adr/ADR-0126-mission-documents-are-rendered-by-runward-fleet-from-a-closed-subset-of-markdown-safe-by-construction-and-checked-on-the-way-out-the-register-is-read-from-each-records-header.md)
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
| `source(path)` | the `https://` address of that file in the forge at the commit read; checked like an address of the document |

**Elements**: `h1` `h2` `h3` `h4` `p` `ul` `ol` `li` `pre` `code` `b` `i` `blockquote` `table` `tr` `th`
`td` `hr` `a`. **Attributes**: `href`, `rel`, `target` on `a`; `id` on a heading. Nothing else, ever: no
class, no style, no event attribute, no image, no line break element. Blocks are separated by a line end.

**The subset**:

| Markdown | Output |
|---|---|
| `#` to `######` headings | `h1` to `h4` (levels five and six are `h4`), `id="doc-<slug>"`; a repeated slug gains `-2`, `-3`; a heading without a letter is `doc-section` |
| paragraphs | `p`; the line ends of the source stay line ends in the text |
| `-`, `*`, `+` and `1.` `1)` lists, nested by indentation | `ul`, `ol`, `li`; a list goes on past blank lines while a sibling item follows |
| `>` quotes, nested | `blockquote` |
| a row of `\|` cells followed by a divider row | `table`, `tr`, `th`, `td`; a row is cut or filled to the header's width; at most 64 columns; `\|` is a bar in a cell; alignment is dropped |
| fences of three or more backticks or tildes | `pre` and `code`; the info string is dropped; an unterminated fence runs to the end |
| `---`, `***`, `___` | `hr` |
| `` `code` `` | `code` |
| `**bold**`, `__bold__`, `*italic*`, `_italic_` | `b`, `i`; an underscore inside a word is text |
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
| a relative path, or a path from the repository's root (`/x`) | percent-decoded by segment, `.` and `..` resolved; refused if it leaves the repository, or if a decoded segment holds a separator or a control character; then `route(path)`, else `source(path)`; the fragment and the query are dropped |
| `https://host…` | kept if the URL parser reads it, the scheme is `https:`, the host is made of letters, digits, `-`, `_` and dots (or is an address in brackets) and there are no credentials; written as the parser normalises it, with `rel="noopener noreferrer nofollow"` and `target="_blank"` |

Refused in every case: an address of more than 1,024 characters, or holding a space of any kind, a
control or invisible character, or a backslash; any scheme other than `https:`; `//host`.

**Before anything is read**: line ends become `\n` (U+2028 and U+2029 included), a tab becomes four
spaces, and each control character, bidirectional override or isolate (U+202A to U+202E, U+2066 to
U+2069) and half surrogate pair becomes U+FFFD.

**Limits**: nesting beyond 8 levels of quotes and lists is shown flat; a document over
`MAX_DOCUMENT_LENGTH` (1,048,576 characters) is one `pre` of plain text. The renderer throws only on a
defect of its own (a piece it did not build, an element outside the list) or of a `context` function.

## 3. `checkRendered`

Returns `{ ok: boolean, refusals: [{ at, why, found }] }`, at most twenty refusals, `at` an offset in the
string. `why` is one of:

| `why` | Refused |
|---|---|
| `not-a-string` | anything that is not a string |
| `hidden` | a control character, a carriage return, a bidirectional override or isolate, half a surrogate pair, anywhere |
| `text` | a bare `>`, or an `&` that does not start `&amp;` `&lt;` `&gt;` `&quot;` `&#39;` |
| `tag` | a tag that is not `<name>`, `</name>` or `<name a="v" b="w">` with single spaces, lower-case names and double quotes; a value holding `<` or a bare `&`; a tag never closed |
| `element` | a name outside `DOCUMENT_ELEMENTS`; `</hr>` |
| `attribute` | an attribute outside `DOCUMENT_ATTRIBUTES`; a heading without `id="doc-…"`; an `a` whose attributes are neither `href` alone nor `href`, `rel`, `target` in that order |
| `href` | an address that is neither a route, a slug, nor `https://` with a plain host, an optional port and the exact `rel` and `target` |
| `nesting` | an element left open or closed out of order; a link inside a link; `li` outside a list, `tr` outside a table, a cell outside a row |

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
| `status`, `statusWritten` | `**Status**:`; `status` is the template's word the line starts with | `status` is `null` when the line starts with another word: it is shown as written |
| `supersededBy` | a status that starts with `superseded by ADR-NNNN` | `null` |
| `supersedes`, `refines` | `**Supersedes**:`, `**Refines**:`: the records the line names first, separated by commas or `and`, each optionally followed by a parenthesis | `[]` |
| `deciders`, `method` | `**Deciders**:`, `**Method**:` | `null` |
| `reopening` | the section `## Reevaluation trigger…`: `{ text, setOn, watchedVia }`, the last two from its `**Trigger set on**` line | `null`, or a `null` field |
| `settles` | the section `## What would settle it` | `null` |
| `references` | the list items of `## References` | `null` |

The header is read from the title line to the first `## ` heading, the first line of each name winning.
A `null` is read "not observed" by a view. Values are the file's text, unescaped.

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
| D3 | A link is rewritten, never copied: a slug, a route of the application, or an https address without credentials; anything else is text | the `address`, `relative`, `attribute` and `slug` families; eleven planted copies |
| D4 | A rendered document is inserted only if the check by closed list passes | 100 refused outputs with their reason; thirteen planted copies of the check; the deployment's page |
| D5 | The register says what each record's file says | the golden register of a real mission, a second reading of each header, five planted copies |

All in `test/unit/fleet-documents.test.js`; the vectors are `test/support/fleet-documents-corpus.js`.
