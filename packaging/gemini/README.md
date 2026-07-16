# Gemini CLI extension — `runward-gate`

Runs the runward gate when the model finishes a turn and prints the verdict into the
Gemini CLI loop.

- **Format:** Gemini CLI extension (`gemini-extension.json` + `hooks/hooks.json`).
- **Seam:** `AfterAgent` — fires once per turn after the model produces its final response.
- **Gate tier:** *advisory end-of-turn.* The command ends in `|| true`, so it never blocks
  the turn; it surfaces `runward check --strict` so the agent can't close out with the gate
  unseen. The **hard gate is CI** (the Action / a pipeline check).

## Install

```sh
gemini extensions install https://github.com/stranxik/runward
```

### Repo-root limitation (honest)

Per the official docs, `gemini extensions install <url>` loads
`<home>/.gemini/extensions/<ext>` and **requires `gemini-extension.json` at the root** of
the installed source — subdirectories are not documented as supported. This packaging keeps
the canonical extension under `packaging/gemini/`. Two honest paths:

- **Local link (works from the subdirectory):**
  ```sh
  gemini extensions link ./packaging/gemini
  ```
  `link` points Gemini at a local path, so the manifest can live here.
- **Published extension:** to support `gemini extensions install <github-url>` directly,
  the two files here (`gemini-extension.json` + `hooks/`) must sit at the **root** of the
  target repo (or a dedicated extension repo). Copy them up, or publish a thin repo whose
  root is this folder.

## Format notes / verification

- Hooks are **not** declared in `gemini-extension.json`; they live in
  `hooks/hooks.json` inside the extension. Confirmed against the official reference.
- `AfterAgent` is the end-of-turn event; `timeout` is in **milliseconds** (default 60000),
  so `120000` = 120 s.
- Source verified July 2026:
  - `github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md`
  - `github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md`
