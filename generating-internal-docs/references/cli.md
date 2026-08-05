# CLI

```sh
internal-doc validate input.json
internal-doc render input.json --theme plain --output output.html
internal-doc inspect output.html --json
```

Successful command output goes to stdout. Diagnostics go to stderr. Exit 0 means success, 1 indicates invalid content or unsupported rendering input, and 2 indicates usage or file-system failure. `inspect --json` emits one JSON object suitable for automation.
