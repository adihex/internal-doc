# Themes

Themes own typography, colors, and print presentation. Shared renderer CSS provides visible keyboard focus, reduced-motion handling, responsive spacing, horizontally scrollable tables, readable code, and print-safe output. Keep assets local and embedded.

## Registry

- `plain`: neutral guides and general-purpose documents.
- `field-guide`: warm and instructional; approachable procedures and handbooks.
- `technical-report`: compact and formal; findings, decisions, and engineering reports.
- `status-report`: dense updates and stand-up reports.
- `print`: print-first pages with minimal chrome and page breaks.
- `presentation`: large, screen-sharing friendly typography.
- `build-plan`: phased implementation plans — numbered phases, entry gates, atomic stages, deliverables, verification checklists, and rollback notes. Blue-biased neutrals under a teal accent, serif display over a sans body with a mono utility register. Signature elements: a masthead with a mono accent kicker, standfirst, and bordered mono meta chips; a sticky 232px left rail at 1060px and wider whose links carry a tabular-nums section index (hidden below that width, where the masthead chips carry navigation); section headings rendered as phase headings with a mono `PHASE n` eyebrow above a serif title and a 2px accent top rule; prose `h2` with a 2px ink top rule; `h4` through `h6` demoted to mono uppercase micro-labels; and checklists rendered as verification gates — accent-soft ground, 3px accent left border, custom square unchecked boxes. Code blocks and task cards take a 3px accent left border on `--surface`; tables scroll inside their wrapper with mono uppercase headers on `--surface-2` and tabular-nums cells; `details` reads as a rollback or contingency disclosure in the stop color.

## Fonts

Themes must not link remote fonts. `inspect` rejects any `@import` or non-`data:` `url()` in generated CSS, so webfont files cannot be referenced and Google Fonts cannot be linked. Themes therefore declare font _stacks_ whose first entry is the intended face and whose fallbacks are real system faces. `build-plan` asks for `Newsreader` (display, 600), `IBM Plex Sans` (body, 400/500/600), and `IBM Plex Mono` (utility, 400/500); readers with those families installed locally get the intended setting, and everyone else gets `Georgia, serif`, `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, and `ui-monospace, monospace` respectively. Metrics are tuned so both paths stay legible.

## Artifact mode and dark variants

Artifact fragments (`--artifact`) are dual-theme: each theme defines its palette as CSS custom properties on `:root`, redefines them under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]` and `:root[data-theme="light"]` so a manual toggle overrides the OS preference in both directions. Every token has its base definition on bare `:root`; dark blocks only redefine existing tokens. Dark variants are stored in `themes/<name>.dark.css` and are only loaded in artifact mode — standalone output is unchanged. Each dark variant is designed for legible contrast and an accent that works on both grounds, not naive color inversion.
