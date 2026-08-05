import AjvModule from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";
import MarkdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
export const themes = ["plain", "field-guide", "technical-report"] as const;
export type Theme = (typeof themes)[number];
type Obj = Record<string, unknown>;
const root = fileURLToPath(new URL("../", import.meta.url));
const schema = JSON.parse(
  readFileSync(
    `${root}generating-internal-docs/schemas/internal-doc.document.v1.schema.json`,
    "utf8",
  ),
);
const Ajv = AjvModule.default;
const ajv = new Ajv({ allErrors: true, strict: false });
const check = ajv.compile(schema);
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const md = new MarkdownIt({ html: false, linkify: false });
/** Links may navigate locally, over HTTP(S), or open email. All other schemes are inert. */
const safeLink = (url: string) =>
  !/^[a-z][a-z0-9+.-]*:/i.test(url) || /^(?:https?:|mailto:)/i.test(url);
md.validateLink = safeLink;
export function validateDocument(value: unknown): string[] {
  const errors: string[] = [];
  if (!check(value))
    errors.push(
      ...(check.errors ?? []).map(
        (e: ErrorObject) => `${e.instancePath || "/"} ${e.message}`,
      ),
    );
  if (!value || typeof value !== "object") return errors;
  const d = value as Obj,
    sections = Array.isArray(d.sections) ? (d.sections as Obj[]) : [];
  const ids = new Set<string>();
  // This pass must finish before links are checked so forward references work.
  for (const s of sections) {
    for (const x of [
      s,
      ...(Array.isArray(s.blocks) ? (s.blocks as Obj[]) : []),
    ])
      if (typeof x.id === "string") {
        if (ids.has(x.id)) errors.push(`duplicate ID: ${x.id}`);
        ids.add(x.id);
      }
  }
  for (const s of sections) {
    let previousHeading = 2;
    for (const b of Array.isArray(s.blocks) ? (s.blocks as Obj[]) : []) {
      if (typeof b.markdown === "string") {
        const tokens = md.parse(b.markdown, {});
        for (const token of tokens) {
          if (token.type === "heading_open") {
            const level = Number(token.tag.slice(1));
            if (level === 1)
              errors.push(
                "Semantic heading error: prose must not contain level-1 headings",
              );
            else if (level > previousHeading + 1)
              errors.push(
                `Semantic heading skip: h${previousHeading} to h${level}`,
              );
            previousHeading = level;
          }
          for (const child of token.children ?? []) {
            if (child.type === "image")
              errors.push("Images are not allowed in prose");
            if (child.type === "link_open") {
              const href = child.attrGet("href");
              if (href?.startsWith("#") && !ids.has(href.slice(1)))
                errors.push(`Broken local reference: ${href}`);
            }
          }
        }
      }
      if (
        (b.type === "table" || b.type === "matrix") &&
        Array.isArray(b.columns)
      ) {
        for (const [index, row] of (Array.isArray(b.rows)
          ? b.rows
          : []
        ).entries())
          if (!Array.isArray(row) || row.length !== b.columns.length)
            errors.push(`Table row width mismatch at row ${index + 1}`);
      }
    }
  }
  return errors;
}
function block(b: Obj): string {
  const id = typeof b.id === "string" ? ` id="${esc(b.id)}"` : "";
  switch (b.type) {
    case "prose":
      return `<div${id} class="prose">${md.render(String(b.markdown))}</div>`;
    case "callout":
      return `<aside${id} class="callout ${esc(b.style)}"><strong>${esc(b.style)}</strong> ${esc(b.text)}</aside>`;
    case "code":
    case "command":
      return `<div${id} class="code"><pre><code class="language-${esc(b.language ?? "text")}">${esc(b.code)}</code></pre>${b.copy ? '<button type="button" class="copy">Copy</button>' : ""}</div>`;
    case "table":
    case "matrix":
      return `<div${id} class="table-wrap"><table><thead><tr>${(b.columns as unknown[]).map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${(b.rows as unknown[][]).map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    case "steps":
      return `<ol${id}>${(b.items as unknown[]).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
    case "task-card":
      return `<article${id} class="task"><h3>${esc(b.title)}</h3><dl><dt>Risk</dt><dd>${esc(b.risk)}</dd><dt>Mode</dt><dd>${esc(b.mode)}</dd><dt>Profile</dt><dd>${esc(b.profile)}</dd><dt>Routes</dt><dd>${esc((b.routes as unknown[]).join(", "))}</dd></dl></article>`;
    case "scorecard":
    case "checklist":
      return `<ul${id} class="${b.type}">${(b.items as Obj[]).map((x) => `<li>${esc(x.label)}: ${esc(x.value)}</li>`).join("")}</ul>`;
    case "diagram":
      return `<pre${id} class="diagram" aria-label="Diagram">${esc(b.text)}</pre>`;
    default:
      throw new Error(`Unsupported block type: ${String(b.type)}`);
  }
}
export function renderDocument(value: unknown, theme: Theme): string {
  if (!themes.includes(theme)) throw new Error(`Unsupported theme: ${theme}`);
  const errors = validateDocument(value);
  if (errors.length) throw new Error(errors.join("\n"));
  const d = value as Obj,
    m = d.metadata as Obj,
    sections = d.sections as Obj[];
  const css = readFileSync(
    `${root}generating-internal-docs/themes/${theme}.css`,
    "utf8",
  );
  const common = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{overflow-wrap:break-word}img,svg,video,canvas{max-width:100%}:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.skip-link{position:absolute;left:.75rem;top:-5rem;z-index:10;padding:.75rem 1rem;background:var(--ink);color:var(--paper)}.skip-link:focus{top:.75rem}nav ul{display:flex;flex-wrap:wrap;gap:.5rem 1rem;padding:0;list-style:none}nav a{display:inline-block;padding:.25rem 0}pre{overflow:auto;max-width:100%;padding:1rem;background:var(--muted)}.table-wrap{max-width:100%;overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:.5rem;text-align:left}.callout,.task{padding:1rem;margin:1rem 0;background:var(--muted)}@media(max-width:600px){body{padding:1rem}nav ul{display:block}nav li+li{margin-top:.35rem}th,td{min-width:8rem}}@media print{button,.skip-link,nav{display:none}body{max-width:none;padding:0;color:#000;background:#fff}a{color:#000}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}`;
  const navigation = sections
    .map((s) => `<li><a href="#${esc(s.id)}">${esc(s.title)}</a></li>`)
    .join("");
  const content = sections
    .map(
      (s) =>
        `<section id="${esc(s.id)}"><h2>${esc(s.title)}</h2>${(s.blocks as Obj[]).map(block).join("")}</section>`,
    )
    .join("");
  const provenance = { schema: d.schema, version: m.version, kind: m.kind };
  return `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="internal-doc 1.0.0"><title>${esc(m.title)}</title><style>${css}${common}</style></head><body><a class="skip-link" href="#content">Skip to content</a><header><h1>${esc(m.title)}</h1><p>${esc(m.summary)}</p><small>Version ${esc(m.version)} · ${esc(m.kind)}</small><nav aria-label="Document sections"><ul>${navigation}</ul></nav></header><main id="content">${content}</main><script type="application/json" id="internal-doc-provenance">${JSON.stringify(provenance).replace(/</g, "\\u003c")}</script><script>(()=>{document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.parentElement.querySelector('code').textContent)))})()</script></body></html>`;
}
export function inspectHtml(html: string) {
  const theme = html.match(/data-theme="([^"]+)"/)?.[1] ?? null;
  const provenanceText = html.match(
    /<script\b[^>]*type="application\/json"[^>]*id="internal-doc-provenance"[^>]*>([^<]*)<\/script>/i,
  )?.[1];
  let provenance = false;
  try {
    const parsed = JSON.parse(provenanceText ?? "");
    provenance =
      parsed?.schema === "internal-doc.document.v1" &&
      typeof parsed.version === "string" &&
      typeof parsed.kind === "string";
  } catch {
    provenance = false;
  }
  const externalAttribute =
    /<(?:script|img|iframe|frame|embed|audio|video|source|track|input)\b[^>]*\bsrc\s*=\s*["']?\s*(?:https?:)?\/\/|<link\b[^>]*\bhref\s*=\s*["']?\s*(?:https?:)?\/\/|<(?:object)\b[^>]*\bdata\s*=\s*["']?\s*(?:https?:)?\/\/|\b(?:poster|background)\s*=\s*["']?\s*(?:https?:)?\/\//i;
  const cssResource = /@import\b|url\s*\(\s*["']?\s*(?!data:|#)/i;
  return {
    theme,
    standalone:
      /^<!doctype html>/i.test(html) &&
      /<meta\b[^>]*name="generator"[^>]*content="internal-doc [^"]+"/i.test(
        html,
      ) &&
      provenance &&
      !externalAttribute.test(html) &&
      !cssResource.test(html),
    title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
    bytes: Buffer.byteLength(html),
  };
}
