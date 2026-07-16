# MCP registry descriptor — discovery only

- **Format:** `server.json` for the official MCP registry (`registry.modelcontextprotocol.io`).
- **Namespace:** `io.github.stranxik/runward` (GitHub-auth namespace rule).
- **Gate tier:** **discovery only — never a gate.**

## An MCP server is NOT a gate. Read this.

A gate is a deterministic authority that returns a verdict and can stop bad work. An MCP
server is the opposite kind of thing:

- It is **model-controlled.** The model decides whether, when, and how to call it. Anything
  the model can choose to skip is, by definition, **not** an enforcement path.
- So runward's gate is **never** exposed as an MCP tool. The enforcing gate is
  `runward check --strict`, run **in CI** (the Action / a pipeline required check), where no
  agent chooses whether it runs.
- If a runward MCP surface ever ships, it exposes **read-only discovery** at most —
  `status`, `rules --json` — so an agent can *learn* the rules and the current verdict. It
  never exposes the enforcement path, never mutates state, never seals anything.

This descriptor exists so runward is **discoverable** in the MCP registry, not so it can be
**enforced** through MCP. Discovery ≠ gate.

## No server ships here

There is **no executable MCP server** in this folder — no server code, on purpose. This is a
**descriptor sketch** only. That is why `"packages": []` is empty: nothing runnable is
published. A real registry publish would require:

1. an actual read-only MCP server package on npm whose `package.json` carries
   `"mcpName": "io.github.stranxik/runward"` matching the `name` here;
2. `mcp-publisher login github` + `mcp-publisher publish`.

None of that is done here, and building that server is explicitly out of scope: runward's
value is the deterministic gate, and the gate does not belong behind a model-controlled call.

## Format notes / verification

- `server.json` shape (`$schema` URL, `name` as `io.github.<user>/<name>`, `description`,
  `repository`, `version`, `packages`) is from the official registry quickstart. The `name`
  must match `mcpName` in the eventual package's `package.json`, and GitHub auth requires the
  `io.github.<user>/` prefix.
- Source verified July 2026: `modelcontextprotocol.io/registry/quickstart`.
