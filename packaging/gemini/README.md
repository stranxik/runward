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
gemini extensions install https://github.com/stranxik/runward-gemini
```

### Why a dedicated repo (honest)

Per the official docs, `gemini extensions install <url>` **requires `gemini-extension.json`
at the root** of the installed source — subdirectories are not documented as supported. The
root of *this* repo carries other harnesses' manifests, so the Gemini extension is published
from a thin dedicated repo, **[stranxik/runward-gemini](https://github.com/stranxik/runward-gemini)**,
whose root is exactly the two files here (`gemini-extension.json` + `hooks/`). That repo is
the install target above; the files under `packaging/gemini/` are the source they mirror.

For local development you can still link the subdirectory directly:

```sh
gemini extensions link ./packaging/gemini
```

## Format notes / verification

- Hooks are **not** declared in `gemini-extension.json`; they live in
  `hooks/hooks.json` inside the extension. Confirmed against the official reference.
- `AfterAgent` is the end-of-turn event; `timeout` is in **milliseconds** (default 60000),
  so `120000` = 120 s.
- Source verified July 2026:
  - `github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md`
  - `github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md`
