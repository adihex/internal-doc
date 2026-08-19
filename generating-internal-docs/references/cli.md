# CLI

```sh
internal-doc validate input.json
internal-doc render input.json --theme plain --output output.html
internal-doc render input.json --theme field-guide --artifact --output fragment.html
internal-doc inspect output.html --json
```

Successful command output goes to stdout. Diagnostics go to stderr. Exit 0 means success, 1 indicates invalid content or unsupported rendering input, and 2 indicates usage or file-system failure. `inspect --json` emits one JSON object suitable for automation.

## render

`--theme <plain|field-guide|technical-report|status-report|print|presentation|build-plan>` selects the visual theme (defaults to `plain`). `--output <path>` is required and sets the destination file. `--artifact` switches the output from a standalone HTML page to an artifact fragment — a dual-theme, responsive HTML fragment with no `<!doctype>`, `<html>`, `<head>`, or `<body>` wrapper, designed for publishing directly as a claude.ai Artifact with zero hand-editing. `--artifact` is valid only for `render` and rejected elsewhere.

## inspect

Classifies output as `standalone` or `artifact-fragment` and reports `mode` in both text and `--json` output. Hand-written HTML that is neither is rejected with exit code 1. The `--json` object includes `theme`, `mode`, `standalone` (boolean, true only for standalone), `title`, and `bytes`.
