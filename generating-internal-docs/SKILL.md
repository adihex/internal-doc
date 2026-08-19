---
name: generating-internal-docs
description: Generates validated, deterministic, standalone HTML internal documents from a portable JSON schema. Use when drafting, validating, rendering, or reviewing internal guides, runbooks, reports, and operational documentation.
license: MIT
compatibility: Requires Node.js 20 or newer and the internal-doc package build output.
metadata:
  version: "1.0.0"
---

# Generating Internal Docs

Produce portable internal documentation without external runtime resources.

## Workflow

1. Choose the narrowest document kind and the `internal-doc.document.v1` schema. Read only `references/authoring.md`, the schema, and the block/theme reference needed for the task.
2. Author bounded semantic JSON. Copy `fixtures/every-block.json` only when broad block coverage helps. Markdown is allowed only in `prose.markdown`; never hand-author wrapper HTML, CSS, or JavaScript.
3. Validate with `internal-doc validate document.json` (or `scripts/validate.mjs document.json` from an installed package). Repair schema and semantic diagnostics before continuing.
4. Render with an existing theme: `internal-doc render document.json --theme plain --output document.html`. Add `--artifact` for a claude.ai-ready fragment (see below).
5. Inspect with `internal-doc inspect document.html --json`; require `mode: "standalone"` (or `mode: "artifact-fragment"` for artifact output). When a local browser exists, also review desktop, a true mobile viewport, focus order, overflow, copy controls, and print preview.
6. Revise the semantic JSON, never generated HTML, then repeat validation and rendering.
7. Deliver both canonical JSON and disposable HTML, plus any browser-gate limitation.

When valid source already exists, use this deterministic local-only lane directly. No agent or network access is needed for validation, rendering, inspection, or repeat builds.

## Theme Selection

- `plain`: neutral guides and general-purpose documents.
- `field-guide`: approachable procedures and handbooks.
- `technical-report`: formal findings, decisions, and engineering reports.
- `status-report`: dense updates and stand-up reports.
- `print`: print-first pages with minimal chrome and page breaks.
- `presentation`: large, screen-sharing friendly typography.
- `build-plan`: phased implementation plans with entry gates, stages, and verification checklists.

Read `references/themes.md` before changing visual presentation. Do not link remote CSS, JavaScript, fonts, or images.

## Safety and Provenance

Include only publication-safe metadata. Never include prompts, hidden instructions, private conversation, secrets, credentials, local paths, or model chain-of-thought. The renderer embeds only schema name, document version, and kind as provenance. Treat source JSON as publishable content.

## Quality Gate

- Validation has no errors.
- IDs are unique and local fragment references resolve.
- Prose has semantic heading order; the renderer owns title and section headings.
- Commands and code declare a language when known and use `copy` only when useful.
- Diagrams remain legible as text and tables remain usable at mobile widths.
- Generated HTML contains no external resources and is deterministic for identical input and theme.
- Source stays within the task's content budget; progressive references avoid loading irrelevant contracts.

For block details and examples, read `references/blocks.md`. For CLI behavior and exit codes, read `references/cli.md`.

## Publishing as a claude.ai Artifact

Use `--artifact` to emit a fragment instead of a standalone page:

```sh
internal-doc render document.json --theme technical-report --artifact --output fragment.html
internal-doc inspect fragment.html --json   # mode: "artifact-fragment"
```

The fragment contains no `<!doctype>`, `<html>`, `<head>`, or `<body>` tags — only a `<title>`, one inline `<style>` block with dual-theme CSS, the document content, and provenance. Paste it directly into a claude.ai Artifact. Do not hand-author HTML wrappers, CSS, or JavaScript; let the compiler produce the fragment so escaping, provenance, and determinism guarantees hold.
