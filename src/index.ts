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
  for (const s of sections) {
    for (const x of [
      s,
      ...(Array.isArray(s.blocks) ? (s.blocks as Obj[]) : []),
    ])
      if (typeof x.id === "string") {
        if (ids.has(x.id)) errors.push(`duplicate ID: ${x.id}`);
        ids.add(x.id);
      }
    for (const b of Array.isArray(s.blocks) ? (s.blocks as Obj[]) : []) {
      if (typeof b.markdown === "string") {
        for (const m of b.markdown.matchAll(/\[[^\]]*\]\(#([^)]+)\)/g))
          if (m[1] && !ids.has(m[1]) && !sections.some((q) => q.id === m[1]))
            errors.push(`Broken local reference: #${m[1]}`);
        if (/!\[[^\]]*\]\((?:https?:)?\/\//i.test(b.markdown))
          errors.push("External resource is not allowed");
        if (/^#\s/m.test(b.markdown))
          errors.push(
            "Semantic heading error: prose must not contain level-1 headings",
          );
      }
    }
  }
  return errors;
}
const md = new MarkdownIt({ html: false, linkify: false });
md.validateLink = (url) => /^(?:#|\/|\.\/|\.\.\/|mailto:)/.test(url);
function block(b: Obj): string {
  const id = typeof b.id === "string" ? ` id="${esc(b.id)}"` : "";
  switch (b.type) {
    case "prose":
      return `<div${id} class="prose">${md.render(String(b.markdown).replace(/javascript\s*:/gi, ""))}</div>`;
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
  const common = `*{box-sizing:border-box}:focus-visible{outline:3px solid var(--accent);outline-offset:2px}pre{overflow:auto;padding:1rem;background:var(--muted)}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:.5rem;text-align:left}.callout,.task{padding:1rem;margin:1rem 0;background:var(--muted)}@media(max-width:600px){body{padding:1rem}th,td{min-width:8rem}}@media print{button{display:none}body{max-width:none;padding:0;color:#000;background:#fff}a{color:#000}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}`;
  const content = sections
    .map(
      (s) =>
        `<section id="${esc(s.id)}"><h2>${esc(s.title)}</h2>${(s.blocks as Obj[]).map(block).join("")}</section>`,
    )
    .join("");
  const provenance = { schema: d.schema, version: m.version, kind: m.kind };
  return `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="internal-doc 1.0.0"><title>${esc(m.title)}</title><style>${css}${common}</style></head><body><header><h1>${esc(m.title)}</h1><p>${esc(m.summary)}</p><small>Version ${esc(m.version)} · ${esc(m.kind)}</small></header><main>${content}</main><script type="application/json" id="internal-doc-provenance">${JSON.stringify(provenance).replace(/</g, "\\u003c")}</script><script>(()=>{document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.parentElement.querySelector('code').textContent)))})()</script></body></html>`;
}
export function inspectHtml(html: string) {
  const theme = html.match(/data-theme="([^"]+)"/)?.[1] ?? null;
  return {
    theme,
    standalone:
      /^<!doctype html>/i.test(html) &&
      !/<(?:script[^>]+src|link[^>]+href|img[^>]+src)\s*=/i.test(html),
    title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
    bytes: Buffer.byteLength(html),
  };
}
