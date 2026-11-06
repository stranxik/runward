// The beta mission form and the beta page, kept in step (docs/beta.md, decided on 2026-11-06).
//
// Like the pilot form (pilot-form.test.js), this form is a promise made to a stranger, read before the
// page it summarises. Most of what it promises is about what the stranger risks by writing in public,
// and a form that drifts on that is worse than no form: it asks for nothing that identifies a person,
// an organisation or a system; it says the issue is public, and gives a regulated organisation and a
// security report their private routes, before its first question; it carries the page's commitment
// that no name is published without written agreement. It also works without a forge setting nobody
// made: GitHub does not add a label the repository does not have (its documented behaviour), so the
// form sets none, and it is found by its title prefix, the one the page's list of missions searches for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const FORM = loadYaml(read(".github/ISSUE_TEMPLATE/beta_mission.yml"));
const PAGE = read("docs/beta.md");
const VERSION = JSON.parse(read("package.json")).version;
// The page is hard-wrapped, so every sentence match tolerates a line break.
const loose = (s) => new RegExp(s.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "i");
// The same tolerance for a plain substring: SUPPORT.md wraps its address route across two lines.
const flat = (s) => s.replace(/\s+/g, " ");
const FIELDS = FORM.body.filter((e) => e.type !== "markdown");
const INTRO = FORM.body[0].type === "markdown" ? FORM.body[0].attributes.value : "";
const SECURITY_ROUTE = "https://github.com/stranxik/runward/security/advisories/new";
// Every link target a text carries, as written, compared by equality and never searched as a substring:
// a URL found inside a longer one is not the route the text gives.
const links = (text) => new Set([...text.matchAll(/https:\/\/[^\s)\]>"'`]+/g)].map((m) => m[0].replace(/[.,;:]+$/, "")));
const PRIVATE_SITE = "https://thibaultsouris.fr";

test("beta form: it needs no forge setting, and the page's list finds it by its title", () => {
  // Creating a label is a forge setting reserved to the maintainer, and a label the repository does
  // not have is not added to the issue. So the form carries none, and the title prefix is the filter.
  for (const key of ["labels", "assignees", "projects", "type"]) assert.equal(FORM[key], undefined, `the form sets no ${key}`);
  assert.equal(FORM.title, "beta mission: ", "the title prefix every beta mission starts with");
  assert.ok(PAGE.includes("in%3Atitle+%22beta+mission%22"), "the page lists the missions by that same prefix");
  assert.ok(PAGE.includes("issues/new?template=beta_mission.yml"), "and links the form by its file name");
});

test("beta form: it asks for nothing that identifies a person, an organisation or a system", () => {
  // The fields are a closed list. A new field is a new question asked in public: add it here only
  // after reading it as the stranger who answers it would.
  assert.deepEqual(FIELDS.map((f) => f.id), ["entry", "version", "repository", "model", "ci", "question", "terms", "anything"]);
  assert.ok(!FORM.body.some((e) => e.type === "upload"), "no upload: a file is the easiest way to publish what should not be");
  const repository = FIELDS.find((f) => f.id === "repository").attributes;
  assert.match(repository.label, /without identifying it/i, "the repository is described, never named");
  assert.match(repository.description, /No name, no URL, no code/, "and the field says so where it is filled in");
  for (const f of FIELDS) {
    assert.doesNotMatch(f.attributes.label, /e-?mail|company|employer|organi[sz]ation|url|link|handle|contact/i, `the ${f.id} field asks for an identity`);
  }
});

test("beta form: it says the issue is public, then gives the private routes, before the first question", () => {
  assert.equal(FORM.body[0].type, "markdown", "the form opens on its terms, not on a field");
  assert.ok(INTRO.startsWith("**This issue is public**"), "the first thing read is that the issue is public");
  assert.match(INTRO, loose("so is the GitHub account that opens it"), "including the account that opens it");
  // Each route is the one its policy file names, so the form cannot point somewhere they do not.
  for (const [where, text] of [["SECURITY.md", read("SECURITY.md")], ["the form", INTRO], ["the page", PAGE]]) {
    assert.ok(links(text).has(SECURITY_ROUTE), `${where} names the private reporting form`);
  }
  for (const [where, text] of [["SUPPORT.md", read("SUPPORT.md")], ["the form", INTRO], ["the page", PAGE]]) {
    assert.match(text, loose("address published at"), `${where} gives the author's address route`);
    assert.ok(links(text).has(PRIVATE_SITE), `${where} points that route at the same site`);
  }
  const intro = flat(INTRO);
  assert.ok(intro.indexOf("This issue is public") < intro.indexOf("A regulated organisation"), "public is said before the private route");
});

test("beta form and page: a green that should be red goes to the private form, never to the public issue", () => {
  // SECURITY.md classes a published version's false green as S1, a vulnerability with coordinated
  // disclosure. A feedback block that asked for it in a public issue would publish it before the fix.
  assert.match(read("SECURITY.md"), /S1, a verdict turned green/, "the class the route rests on");
  const firstVerdict = PAGE.slice(PAGE.indexOf("### First verdict"), PAGE.indexOf("### Closing"));
  assert.match(firstVerdict, /A green you think should be red: never described here/, "the feedback block never asks for it");
  assert.match(PAGE, loose("A green you think should be red is different"), "the page says why");
  // The sentence that says why, up to its "never in an issue", is the one that gives the route.
  const why = flat(PAGE).split("A green you think should be red is different")[1]?.split("never in an issue")[0] ?? "";
  assert.ok(links(why).has(SECURITY_ROUTE), "and sends it to the private reporting form before it says never in an issue");
  assert.match(INTRO, loose("including a green verdict you think should be red, goes only to the"), "the form says it before the first question");
  assert.match(flat(read("SUPPORT.md")), /A false green\*\* \(on a published version[^)]*\): that may be a vulnerability/, "and SUPPORT.md no longer sends it to a public issue");
});

test("beta form and page: no name is published without written agreement, in both", () => {
  assert.match(INTRO, loose("outside this issue without your written agreement"), "the form carries the commitment");
  assert.match(PAGE, loose("No name is published without written agreement."), "and the page states it");
  assert.match(PAGE, loose("outside your own issue"), "with the same boundary: the participant's own issue");
});

test("beta form: the cost comes before the benefit, and it is nothing in money", () => {
  const cost = INTRO.indexOf("What it costs you");
  assert.ok(cost > -1 && cost < INTRO.indexOf("What you get"), "the cost comes first");
  assert.match(INTRO, /Nothing in money/, "the form says what it costs");
  assert.match(PAGE, /Nothing in money/, "in the page's own words");
  assert.match(INTRO, loose("two structured feedbacks"), "and what is asked in return");
});

test("beta form: its three terms are required checkboxes, not prose a reader skips", () => {
  const terms = FIELDS.find((f) => f.id === "terms");
  assert.equal(terms.type, "checkboxes");
  assert.equal(terms.attributes.options.length, 3);
  assert.ok(terms.attributes.options.every((o) => o.required === true), "GitHub refuses the submission without each one");
  const labels = terms.attributes.options.map((o) => o.label).join("\n");
  assert.match(labels, /the runward maintainer did not write it/, "the criterion without which the beta asks nothing new");
  assert.match(labels, /This issue is public/, "the public term");
  assert.match(labels, /two structured feedbacks/, "the feedback term");
});

test("beta form and page: every link into the page lands on a heading the page has", () => {
  // GitHub's anchor for a heading: lower case, punctuation dropped, each space a hyphen.
  const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
  assert.equal(slug("What is asked: a structured feedback"), "what-is-asked-a-structured-feedback", "the slug drops the colon");
  assert.equal(slug("Who it's for — and when"), "who-its-for--and-when", "and keeps the hyphen a dropped dash leaves");
  // The feedback blocks carry `###` lines inside a fence: those are not headings of the page.
  const headings = (md) => new Set([...md.replace(/^```[^\n]*\n[\s\S]*?^```$/gm, "").matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1])));
  const own = headings(PAGE);
  assert.ok(!own.has("first-verdict"), "a fenced `### First verdict` is not read as a heading");
  const wanted = [
    ...[...JSON.stringify(FORM).matchAll(/docs\/beta\.md#([\w-]+)/g)].map((m) => ["the form", m[1]]),
    ...[...PAGE.matchAll(/\]\(#([\w-]+)\)/g)].map((m) => ["the page", m[1]]),
  ];
  assert.ok(wanted.length >= 5, `the sweep found ${wanted.length} links into the page: it went blind`);
  for (const [where, anchor] of wanted) assert.ok(own.has(anchor), `${where} links #${anchor}, which no heading of docs/beta.md produces`);
  const readme = PAGE.match(/github\.com\/stranxik\/runward#([\w-]+)/)?.[1];
  assert.ok(readme && headings(read("README.md")).has(readme), `the page links README#${readme}, which no README heading produces`);
});

test("beta page: the beta is not the pilot, changes nothing in it, and does not move its deadline", () => {
  assert.ok(PAGE.includes("(pilot-protocol.md)"), "the protocol is linked");
  assert.ok(PAGE.includes("template=pilot_candidate.yml"), "and so is the pilot's own form");
  // The pilot measures a repository before any mission is written in it; a beta mission first would
  // spend that measure. The order is said where a candidate reads it, in both places.
  assert.match(PAGE, loose("open the pilot form first"), "the page says which form comes first");
  assert.match(INTRO, loose("open that form first"), "and so does the form, before anyone writes a mission");
  assert.match(read("docs/pilot-protocol.md"), /maintainer \(the operator\)\*\* performs the intervention/, "in the pilot, the maintainer operates; in the beta, the team does");
  // The deadline the page names is ADR-0052's own, read from the ADR rather than copied by hand.
  const adr = read("docs/adr/ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md");
  const deadline = adr.match(/\*\*Trigger set on\*\*:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  assert.ok(deadline, "ADR-0052 carries a dated trigger");
  assert.match(PAGE, new RegExp(`sets it on ${deadline}`), "the page names the ADR's date");
});

test("beta page: the bridge is said to be unreleased while the current release lacks it", () => {
  // The page names the release that does not carry #483 and #484. When package.json moves, this
  // reddens until someone says whether the new release carries them and rewrites the section.
  const named = PAGE.match(/Neither is in runward\s+(\d+\.\d+\.\d+), the current release/)?.[1];
  assert.ok(named, "the bridge section names the current release as one that does not carry it");
  assert.equal(named, VERSION, `docs/beta.md calls runward ${named} the current release and package.json is ${VERSION}: say whether ${VERSION} carries #483 and #484, rewrite the bridge section, then this test`);
  for (const pr of ["483", "484"]) assert.ok(links(PAGE).has(`https://github.com/stranxik/runward/pull/${pr}`), `#${pr} is linked`);
  assert.match(PAGE, /Planned for the next release/, "planned, never shipped, until a release carries it");
});

test("beta page: the weekly slot is time set aside, not a response-time promise", () => {
  // SUPPORT.md refuses an unpaid promise of response times. The slot says what it is, or the two pages
  // contradict each other in front of the same reader.
  const support = read("SUPPORT.md");
  assert.match(support, /No SLA is promised here/, "the support page's own refusal");
  assert.ok(support.includes("docs/beta.md"), "and it routes a beta mission to the beta page");
  assert.match(PAGE, loose("It is time set aside, not a response-time guarantee."));
  assert.match(PAGE, loose("oldest first, as far as the slot goes"), "the slot promises to work through the questions, not to answer them all");
  assert.match(INTRO, loose("works through the questions asked in beta missions"), "and so does the form");
  const slot = PAGE.match(/\*\*Weekly support slot\*\*: ([A-Z][a-z]+day)s, (\d{2}:\d{2}) to (\d{2}:\d{2}) ([^·\n]+?) ·/);
  assert.ok(slot, "the slot's day, time and time zone are written at the top of the page");
  const open = PAGE.match(/\*\*Open\*\*: from ([A-Z][a-z]+day) (\d{4}-\d{2}-\d{2})/);
  assert.ok(open, "and the day the beta opens");
  assert.equal(open[1], slot[1], "it opens on the slot's day");
  assert.equal(new Date(`${open[2]}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }), open[1], "on a date that is that day");
});
