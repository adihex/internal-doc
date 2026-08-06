# Themes

Themes own typography, colors, and print presentation. `plain` is neutral, `field-guide` is warm and instructional, and `technical-report` is compact and formal. Shared renderer CSS provides visible keyboard focus, reduced-motion handling, responsive spacing, horizontally scrollable tables, readable code, and print-safe output. Keep assets local and embedded.

## Artifact mode and dark variants

Artifact fragments (`--artifact`) are dual-theme: each theme defines its palette as CSS custom properties on `:root`, redefines them under `@media (prefers-color-scheme: dark)`, and again under `:root[data-theme="dark"]` and `:root[data-theme="light"]` so a manual toggle overrides the OS preference in both directions. Dark variants are stored in `themes/<name>.dark.css` and are only loaded in artifact mode — standalone output is unchanged. Each dark variant is designed for legible contrast and an accent that works on both grounds, not naive color inversion.
