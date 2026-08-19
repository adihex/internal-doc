# internal-doc

A small typed Node.js CLI and portable Agent Skill for validated, deterministic, standalone internal-document HTML. It is generic and contains no organization-specific content.

## Install

Requires Node.js 20+. For a clean checkout:

```sh
npm ci
npm run build
npm link
```

## Deterministic use

```sh
internal-doc validate generating-internal-docs/fixtures/every-block.json
internal-doc render generating-internal-docs/fixtures/every-block.json --theme field-guide --output guide.html
internal-doc render generating-internal-docs/fixtures/every-block.json --theme technical-report --artifact --output fragment.html
internal-doc inspect guide.html --json
```

Identical valid JSON and theme input produce byte-identical HTML in both standalone and artifact modes. The compiler performs no network access and generated HTML embeds its CSS, JavaScript, and sanitized provenance. Artifact fragments (`--artifact`) omit the page skeleton and inline dual-theme CSS for direct publishing as claude.ai Artifacts.

## Agent use

Install the published Amp skill with `amp skill add --global @adihex/generating-internal-docs`, or expose the top-level `generating-internal-docs/` directory in another Agent Skills-compatible harness. Then follow `SKILL.md`. Agents author bounded semantic JSON, validate, render with a named theme, inspect the result, and revise the JSON rather than disposable HTML. The package includes the skill's progressive references, schema, themes, fixture, scripts, tests, and license.

## Schema and theme extension

`internal-doc.document.v1` is the canonical compiler boundary. Add a block only by extending the JSON Schema, typed renderer switch, validation, every-block fixture, escaping tests, and all-theme render tests together. Themes are trusted packaged CSS selected from the validated `plain`, `field-guide`, `technical-report`, `status-report`, `print`, `presentation`, or `build-plan` registry; document input cannot provide CSS, templates, render commands, or shell strings.

## Safety and limitations

Rich Markdown is accepted only in typed prose fields with raw HTML disabled and an explicit URL policy. Images and external resource loads are rejected. `inspect` is a deterministic structural gate for compiler output, not a general-purpose HTML security scanner. Browser responsive, accessibility, overflow, and print review is an additional gate when a local browser is available; it does not replace schema and standalone validation. The compiler does not render arbitrary plugins, execute project commands, or fetch network assets.

## Development

Run `npm run check`. See [DEVELOPMENT.md](DEVELOPMENT.md) for the TDD baseline record. Licensed under MIT.
