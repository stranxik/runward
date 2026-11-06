// selftest.js: what the determinism self-test compares. A run is { id, node, record, md, html } with
// the sha256 of each output; the outputs are the same only when every digest of every run is equal.
export function sameOutputs(rows) {
  if (rows.length < 2) return false;
  return rows.every((r) => r.record === rows[0].record && r.md === rows[0].md && r.html === rows[0].html);
}
