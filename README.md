# internal-doc

A small typed Node.js CLI and portable Agent Skill for validated, deterministic, standalone internal-document HTML. It is generic and contains no organization-specific content.

## Install and use

Requires Node.js 20+. `npm ci && npm run build`, then:

```sh
node dist/cli.js validate generating-internal-docs/fixtures/every-block.json
node dist/cli.js render generating-internal-docs/fixtures/every-block.json --theme field-guide --output guide.html
node dist/cli.js inspect guide.html --json
```

The top-level `generating-internal-docs/` directory is a self-contained Agent Skill with progressive references, canonical JSON Schema, themes, script, and fixture. Package files include the skill for portable publication.

## Development

Run `npm run check`. See [DEVELOPMENT.md](DEVELOPMENT.md) for the TDD baseline record. Licensed under MIT.
