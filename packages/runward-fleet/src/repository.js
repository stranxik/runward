// The identity of a repository, for any forge (ADR-0130): a host and a path of two to eight segments.
//
//   github.com/org/app                          GitHub: owner, repository
//   gitlab.example.com/group/subgroup/project   GitLab: nested groups, then the project
//   dev.azure.com/org/project/_git/repo         Azure DevOps Services: as its clone address writes it
//
// One grammar, closed, read before anything is folded:
//   - the whole identity is ASCII and at most 512 characters;
//   - the host is a DNS name: labels of letters, digits and inner hyphens (63 at most each, 253 in all),
//     the last one starting with a letter, so it is a name and never an address (`10.0.0.1`, `0x7f.1`),
//     without a port and without an internationalised label (`xn--`): a look-alike host is refused in
//     both of its spellings;
//   - the path has 2 to 8 segments of letters, digits, `_`, `.` and `-` (255 at most each); a segment is
//     never empty and never made of dots alone (`.`, `..`), and nothing is decoded: `%`, `\`, `:`, `@`,
//     `?`, `#` and a space are outside the set, so an encoded slash or an encoded dot has no way in;
//   - one `.git` at the end is the forge's clone suffix and is dropped; a name that still ends in
//     `.git` is refused, so the canonical form reads back as itself.
// The canonical form is the lower-case spelling: DNS, GitHub, GitLab and Azure DevOps all resolve a
// path without regard to case, so two spellings that differ by case are one repository, and the fold
// is ASCII only (U+212A, the Kelvin sign, lower-cases to `k` under Unicode rules: it is refused before
// the fold, never folded into a letter). A canonical identity needs no encoding in a URL: every
// character is unreserved (RFC 3986) and no segment is a dot segment.
//
// Linear in the length of what it reads, which is bounded first (RWD-2026-0206).

/** The path of a repository identity holds this many segments at least and at most. */
export const REPOSITORY_SEGMENTS = Object.freeze({ min: 2, max: 8 });
export const REPOSITORY_MAX_LENGTH = 512;
/** What a refusal says the identity must read like. */
export const REPOSITORY_SHAPE = "host/path with 2 to 8 path segments (e.g. github.com/org/app, gitlab.example.com/group/subgroup/project, dev.azure.com/org/project/_git/repo)";

const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const SEGMENT = /^[A-Za-z0-9_.-]{1,255}$/;
const DOTS = /^\.+$/;
const lower = (s) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
const endsInGit = (s) => s.length >= 4 && lower(s.slice(-4)) === ".git";

function read(s) {
  if (typeof s !== "string" || s === "") return { why: "it is not a text" };
  if (s.length > REPOSITORY_MAX_LENGTH) return { why: `it is longer than ${REPOSITORY_MAX_LENGTH} characters` };
  const [host, ...segments] = s.split("/");
  if (host.length > 253) return { why: "its host is longer than 253 characters" };
  const labels = host.split(".");
  if (!labels.every((l) => LABEL.test(l))) return { why: "its host is not a DNS name (letters, digits and inner hyphens, no port, no scheme)" };
  if (labels.some((l) => lower(l.slice(0, 4)) === "xn--")) return { why: "its host holds an internationalised label (xn--), which this version does not read" };
  if (!/^[A-Za-z]/.test(labels[labels.length - 1])) return { why: "its host is an address, not a name" };
  if (segments.length < REPOSITORY_SEGMENTS.min) return { why: `its path holds ${segments.length} segment${segments.length === 1 ? "" : "s"}, fewer than ${REPOSITORY_SEGMENTS.min}` };
  if (segments.length > REPOSITORY_SEGMENTS.max) return { why: `its path holds ${segments.length} segments, more than ${REPOSITORY_SEGMENTS.max}` };
  const last = segments.length - 1;
  if (endsInGit(segments[last])) segments[last] = segments[last].slice(0, -4);
  for (const seg of segments) {
    if (seg === "") return { why: "a segment of its path is empty" };
    if (!SEGMENT.test(seg)) return { why: "a segment of its path holds a character outside letters, digits, _ . and - (nothing is decoded)" };
    if (DOTS.test(seg)) return { why: "a segment of its path is made of dots alone" };
  }
  if (endsInGit(segments[last])) return { why: "its last segment still ends in .git once the clone suffix is dropped" };
  return { host: lower(host), segments: segments.map(lower) };
}

/** Why a declared identity is refused, in a few words, or null when it is one. */
export function repositoryProblem(s) {
  return read(s).why ?? null;
}

/** The canonical identity (`host/segment/segment…`, lower case, no `.git`) of a declared one, or null. */
export function canonRepository(s) {
  const r = read(s);
  return r.why ? null : `${r.host}/${r.segments.join("/")}`;
}

/** The host and the path segments of an identity, `{ id, host, segments }`, or null. */
export function repositoryParts(s) {
  const r = read(s);
  return r.why ? null : { id: `${r.host}/${r.segments.join("/")}`, host: r.host, segments: r.segments };
}

/**
 * The canonical identity of a repository as a forge or a signature names it: one `https://` or
 * `http://` in front and slashes at the end are taken off, and what is left is read by the same
 * grammar. Null when it is not an identity; such a name is equal to no repository.
 */
export function foreignRepository(s) {
  if (typeof s !== "string" || s.length > REPOSITORY_MAX_LENGTH + 16) return null;
  let t = s.startsWith("https://") ? s.slice(8) : s.startsWith("http://") ? s.slice(7) : s;
  let end = t.length;
  while (end > 0 && t[end - 1] === "/") end--;
  t = t.slice(0, end);
  return canonRepository(t);
}

/**
 * The https address of a repository in its forge, `https://host/segment/…`, or null when the identity
 * is not one. Nothing is encoded because nothing needs to be: the address a URL parser reads back has
 * this host and this path, no credentials, no port, no query and no fragment.
 */
export function repositoryUrl(s) {
  const id = canonRepository(s);
  return id === null ? null : `https://${id}`;
}

/**
 * A name as a signature wrote it, for display beside the identity it was compared with: no scheme, no
 * `.git`, no trailing slash, ASCII lower case. Never compared: `foreignRepository` decides equality.
 * The trailing slashes come off from the end, one at a time: `/\/+$/` restarted from every slash of a
 * run and took 7.8 s on a run of 100,000 (RWD-2026-0206).
 */
export const normRepo = (s) => {
  const t = String(s ?? "").replace(/^https?:\/\//, "").replace(/\.git$/, "");
  let end = t.length;
  while (end > 0 && t[end - 1] === "/") end--;
  return lower(t.slice(0, end));
};
