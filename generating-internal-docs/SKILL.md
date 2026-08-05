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

1. Read `references/authoring.md` for content and privacy rules.
2. Copy `fixtures/every-block.json` and replace its generic content.
3. Keep `schema` set to `internal-doc.document.v1`; follow `schemas/internal-doc.document.v1.schema.json`.
4. Validate with `internal-doc validate document.json` (or run `scripts/validate.mjs document.json` from an installed repository).
5. Render with `internal-doc render document.json --theme plain --output document.html`.
6. Inspect with `internal-doc inspect document.html --json` and require `standalone: true`.
7. Review headings, links, print preview, narrow-screen tables, and all copy controls before publication.

## Theme Selection

- `plain`: neutral guides and general-purpose documents.
- `field-guide`: approachable procedures and handbooks.
- `technical-report`: formal findings, decisions, and engineering reports.

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

For block details and examples, read `references/blocks.md`. For CLI behavior and exit codes, read `references/cli.md`.
