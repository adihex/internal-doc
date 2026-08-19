# Blocks

- `prose`: rich CommonMark Markdown; raw HTML is escaped.
- `callout`: `note`, `warning`, or `success` style and plain text.
- `command` / `code`: code string, optional language, optional copy control.
- `table` / `matrix`: columns and string-cell rows.
- `steps`: ordered string items.
- `task-card`: title plus risk (`low`, `medium`, `high`), mode, profile, routes.
- `scorecard` / `checklist`: label/value items.
- `definition-list`: term/definition pairs.
- `timeline`: timestamp/title/text events.
- `comparison`: two or more title/text panels.
- `details`: a summary plus collapsed Markdown.
- `diagram`: either plain `text` (including Unicode box-drawing characters) or an inline `svg` — see below.
- `mermaid`: Mermaid source, rendered as `<pre class="mermaid">` inside a scrollable `.mermaid-diagram` wrapper. Artifact hosts that render Mermaid natively pick it up; everywhere else it degrades to legible monospace source.

See `../fixtures/every-block.json` for one valid instance containing every block.

## Diagram: inline SVG

```json
{
  "type": "diagram",
  "title": "Figure A — build pipeline",
  "svg": "<svg viewBox=\"0 0 480 120\" role=\"img\" aria-label=\"Three stage flow\">…</svg>",
  "caption": "Each stage is a separate CLI invocation."
}
```

Renders as:

```html
<figure class="diagram">
  <p class="diagram-title">…</p>
  <svg viewBox="…" role="img" aria-label="…">…</svg>
  <figcaption>…</figcaption>
</figure>
```

`title` and `caption` are optional. The `svg` variant and the `text` variant are separate shapes of the same block type; a block supplies exactly one of them.

### One SVG, both themes

The point of the block is that a single diagram is legible in light and dark without a second copy. Authors must follow these rules, and validation enforces them:

- Strokes and body text use `stroke="currentColor"` / `fill="currentColor"`, with `stroke-opacity` and `opacity` for hierarchy. They inherit the theme's ink automatically.
- Emphasis uses `var(--accent)` and `var(--accent-soft)` directly. Give `var(--accent-soft, transparent)` a fallback so themes that do not define a soft accent stay readable.
- **Never** a hardcoded hex color. Any `#rgb` / `#rrggbb` literal inside `svg` is rejected with an explanation; `url(#marker-id)` fragment references are exempt.
- `viewBox` is required, so the figure scales to its column instead of overflowing.
- `role="img"` and a non-empty `aria-label` are required, so the figure has one accessible name.

### What the SVG may contain

Diagram SVG is inlined verbatim into the output, so it is validated against a strict allowlist rather than escaped. Only these elements are accepted: `svg`, `g`, `defs`, `marker`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text`, `tspan`, `title`, `desc`, `use`, `symbol`, `linearGradient`, `radialGradient`, `stop`, `clipPath`. Attributes are limited to geometry, presentation, ARIA, and `class`/`id`; `href` may only reference a local fragment. Every attribute must be written `name="value"` with double quotes. Event handlers, `<script>`, `<image>`, `<foreignObject>`, comments, and unbalanced tags are rejected. This keeps the standalone/artifact "no external resources" guarantee intact.

### SVG text classes

Each theme defines four utility classes for text inside a diagram, so labels match the document without per-diagram font declarations:

- `.svgtt` — tiny uppercase label, 700 / 9.5px, letter-spacing `.07em`.
- `.svgt` — 600 / 11px, element titles.
- `.svgs` — 11px, supporting text.
- `.svgm` — the theme's monospace face, 10.5px, annotations.
