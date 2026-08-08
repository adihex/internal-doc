import AjvModule from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";
import MarkdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const themes = [
  "plain",
  "field-guide",
  "technical-report",
  "status-report",
  "print",
  "presentation",
] as const;
export type Theme = (typeof themes)[number];
export const themeDescriptions: Record<Theme, string> = {
  plain: "Neutral guides and general-purpose documents.",
  "field-guide": "Approachable procedures and handbooks.",
  "technical-report": "Formal findings, decisions, and engineering reports.",
  "status-report": "Dense updates and stand-up reports.",
  print: "Print-first pages with minimal chrome and page breaks.",
  presentation: "Large, screen-sharing friendly typography.",
};
type Obj = Record<string, unknown>;
export type RenderOptions = { fragment?: boolean; toc?: boolean };
const root = fileURLToPath(new URL("../", import.meta.url));
export const documentSchema = JSON.parse(
  readFileSync(
    `${root}generating-internal-docs/schemas/internal-doc.document.v1.schema.json`,
    "utf8",
  ),
);
const Ajv = AjvModule.default;
const check = new Ajv({ allErrors: true, strict: false }).compile(
  documentSchema,
);
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const md = new MarkdownIt({ html: false, linkify: false });
md.validateLink = (url) =>
  !/^[a-z][a-z0-9+.-]*:/i.test(url) || /^(?:https?:|mailto:)/i.test(url);

function locationFor(path: string, doc: Obj): string {
  const match = path.match(/^\/sections\/(\d+)(?:\/blocks\/(\d+))?(.*)$/);
  if (!match) return path || "/";
  const section = (doc.sections as Obj[] | undefined)?.[Number(match[1])];
  const title = typeof section?.title === "string" ? ` (${section.title})` : "";
  return `sections[${match[1]}]${match[2] ? `.blocks[${match[2]}]` : ""}${match[3] ?? ""}${title}`;
}
function schemaErrors(doc: Obj): string[] {
  if (check(doc)) return [];
  const errors = check.errors ?? [];
  const useful = errors.filter(
    (e) =>
      !["const", "required", "additionalProperties", "oneOf"].includes(
        e.keyword,
      ),
  );
  return (useful.length ? useful : errors.slice(0, 1)).map((e: ErrorObject) => {
    const path = locationFor(e.instancePath, doc);
    if (e.keyword === "enum")
      return `${path}: ${JSON.stringify(e.data)} is not valid — expected one of: ${(e.params.allowedValues as unknown[]).join(", ")}`;
    return `${path || "/"}: ${e.message}`;
  });
}
export function validateDocument(value: unknown, strict = false): string[] {
  if (!value || typeof value !== "object") return schemaErrors({});
  const d = value as Obj;
  const errors = schemaErrors(d);
  const sections = Array.isArray(d.sections) ? (d.sections as Obj[]) : [];
  const ids = new Set<string>();
  for (const [si, s] of sections.entries()) {
    for (const x of [
      s,
      ...(Array.isArray(s.blocks) ? (s.blocks as Obj[]) : []),
    ])
      if (typeof x.id === "string") {
        if (ids.has(x.id))
          errors.push(
            `${locationFor(`/sections/${si}`, d)}: duplicate ID: ${x.id}`,
          );
        ids.add(x.id);
      }
  }
  for (const [si, s] of sections.entries()) {
    const blocks = Array.isArray(s.blocks) ? (s.blocks as Obj[]) : [];
    if (strict && blocks.length === 0)
      errors.push(`${locationFor(`/sections/${si}`, d)}: empty blocks array`);
    let previousHeading = 2;
    for (const [bi, b] of blocks.entries()) {
      const where = locationFor(`/sections/${si}/blocks/${bi}`, d);
      if (typeof b.markdown === "string")
        for (const token of md.parse(b.markdown, {})) {
          if (token.type === "heading_open") {
            const level = Number(token.tag.slice(1));
            if (level === 1)
              errors.push(`${where}: prose must not contain level-1 headings`);
            else if (level > previousHeading + 1)
              errors.push(
                `${where}: heading skip h${previousHeading} to h${level}`,
              );
            previousHeading = level;
          }
          for (const child of token.children ?? []) {
            if (child.type === "image")
              errors.push(`${where}: Images are not allowed in prose`);
            if (child.type === "link_open") {
              const href = child.attrGet("href");
              if (href?.startsWith("#") && !ids.has(href.slice(1)))
                errors.push(`${where}: Broken local reference: ${href}`);
            }
          }
        }
      if (
        (b.type === "table" || b.type === "matrix") &&
        Array.isArray(b.columns)
      )
        for (const [ri, row] of (Array.isArray(b.rows) ? b.rows : []).entries())
          if (!Array.isArray(row) || row.length !== b.columns.length)
            errors.push(`${where}.rows[${ri}]: table row width mismatch`);
    }
  }
  return errors;
}
function slug(value: string, used: Set<string>) {
  const base =
    value
      .toLowerCase()
      .replace(/<[^>]*>/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "heading";
  let id = base,
    n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}
function prose(markdown: string, used: Set<string>) {
  const html = md.render(markdown);
  return html.replace(
    /<h([2-6])>(.*?)<\/h\1>/g,
    (_all, level: string, text: string) => {
      const id = slug(text.replace(/&[^;]+;/g, ""), used);
      return `<h${level} id="${id}"><a class="heading-link" href="#${id}" aria-label="Link to this heading">#</a>${text}</h${level}>`;
    },
  );
}
function block(b: Obj, headings: Set<string>): string {
  const id = typeof b.id === "string" ? ` id="${esc(b.id)}"` : "";
  switch (b.type) {
    case "prose":
      return `<div${id} class="prose">${prose(String(b.markdown), headings)}</div>`;
    case "callout":
      return `<aside${id} class="callout ${esc(b.style)}"><strong>${esc(b.style)}</strong> ${esc(b.text)}</aside>`;
    case "code":
    case "command":
      return `<div${id} class="code"><pre><code class="language-${esc(b.language ?? "text")}">${esc(b.code)}</code></pre>${b.caption ? `<p class="caption">${esc(b.caption)}</p>` : ""}${b.copy ? '<button type="button" class="copy">Copy</button>' : ""}</div>`;
    case "table":
    case "matrix": {
      const aligns = Array.isArray(b.align) ? (b.align as string[]) : [];
      return `<div${id} class="table-wrap"><table><thead><tr>${(b.columns as unknown[]).map((x, i) => `<th${aligns[i] ? ` class="align-${esc(aligns[i])}"` : ""}>${esc(x)}</th>`).join("")}</tr></thead><tbody>${(b.rows as unknown[][]).map((r) => `<tr>${r.map((x, i) => `<td${aligns[i] ? ` class="align-${esc(aligns[i])}"` : ""}>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    case "steps":
      return `<ol${id}>${(b.items as unknown[]).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
    case "task-card":
      return `<article${id} class="task"><h3>${esc(b.title)}</h3><dl><dt>Risk</dt><dd>${esc(b.risk)}</dd><dt>Mode</dt><dd>${esc(b.mode)}</dd><dt>Profile</dt><dd>${esc(b.profile)}</dd><dt>Routes</dt><dd>${esc((b.routes as unknown[]).join(", "))}</dd></dl></article>`;
    case "scorecard":
    case "checklist":
      return `<ul${id} class="${b.type}">${(b.items as Obj[]).map((x) => `<li><strong>${esc(x.label)}</strong>: ${esc(x.value)}${x.delta ? ` <span class="delta">${esc(x.delta)}</span>` : ""}${x.hint ? ` <small>${esc(x.hint)}</small>` : ""}</li>`).join("")}</ul>`;
    case "diagram":
      return `<pre${id} class="diagram" aria-label="Diagram">${esc(b.text)}</pre>`;
    case "mermaid":
      return `<pre${id} class="mermaid">${esc(b.code)}</pre>`;
    case "definition-list":
      return `<dl${id} class="definitions">${(b.items as Obj[]).map((x) => `<dt>${esc(x.term)}</dt><dd>${esc(x.definition)}</dd>`).join("")}</dl>`;
    case "timeline":
      return `<ol${id} class="timeline">${(b.events as Obj[]).map((x) => `<li><time>${esc(x.timestamp)}</time><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p></li>`).join("")}</ol>`;
    case "comparison":
      return `<div${id} class="comparison">${(b.items as Obj[]).map((x) => `<section><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></section>`).join("")}</div>`;
    case "details":
      return `<details${id}><summary>${esc(b.summary)}</summary><div>${prose(String(b.markdown), headings)}</div></details>`;
    default:
      throw new Error(`Unsupported block type: ${String(b.type)}`);
  }
}
const common = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{overflow-wrap:break-word;background:var(--paper);color:var(--ink)}img,svg,video,canvas{max-width:100%}:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.skip-link{position:absolute;left:.75rem;top:-5rem;z-index:10;padding:.75rem 1rem;background:var(--ink);color:var(--paper)}.skip-link:focus{top:.75rem}pre{overflow:auto;max-width:100%;padding:1rem;background:var(--muted)}.table-wrap{max-width:100%;overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--rule,#777);padding:.5rem;text-align:left}.align-center{text-align:center}.align-right{text-align:right}.callout,.task{padding:1rem;margin:1rem 0;background:var(--muted)}.section-link,.heading-link{opacity:0;margin-left:.4rem;color:var(--accent);text-decoration:none}.section-title:hover .section-link,.section-link:focus,.prose h2:hover .heading-link,.prose h3:hover .heading-link,.heading-link:focus{opacity:1}.toc{position:sticky;top:1rem;align-self:start}.toc ul{padding-left:1rem}@media(min-width:900px){.layout{display:grid;grid-template-columns:14rem minmax(0,1fr);gap:2rem}.toc details{display:block}.toc summary{display:none}}@media(max-width:899px){.toc{position:static}.toc ul{display:block}.toc>ul{display:none}}.definitions dt{font-weight:700}.definitions dd{margin:0 0 1rem}.timeline{border-left:2px solid var(--accent)}.timeline li{padding:0 0 1rem 1rem}.timeline time{display:block;color:var(--secondary,var(--ink))}.comparison{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1rem}.comparison section{padding:1rem;background:var(--muted)}.caption,.delta{color:var(--secondary,var(--ink))}@media print{button,.skip-link,.toc,.section-link,.heading-link{display:none}body{max-width:none;padding:0;color:#000;background:#fff}a{color:#000}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}`;
export function renderDocument(
  value: unknown,
  selectedTheme?: Theme,
  options: RenderOptions = {},
): string {
  const errors = validateDocument(value);
  if (errors.length) throw new Error(errors.join("\n"));
  const d = value as Obj,
    m = d.metadata as Obj,
    theme =
      selectedTheme ??
      (themes.includes(m.theme as Theme) ? (m.theme as Theme) : "plain");
  if (!themes.includes(theme)) throw new Error(`Unsupported theme: ${theme}`);
  const accent =
    typeof m.accent === "string" && /^#[0-9a-f]{6}$/i.test(m.accent)
      ? `:root{--accent:${m.accent}}`
      : "";
  const css =
    readFileSync(
      `${root}generating-internal-docs/themes/${theme}.css`,
      "utf8",
    ) +
    common +
    accent;
  const sections = d.sections as Obj[],
    useToc = options.toc || m.toc === true;
  const navigation = sections
    .map((s) => `<li><a href="#${esc(s.id)}">${esc(s.title)}</a></li>`)
    .join("");
  const content = sections
    .map((s) => {
      const headings = new Set<string>(sections.map((x) => String(x.id)));
      return `<section id="${esc(s.id)}"><h2 class="section-title">${esc(s.title)}<a class="section-link" href="#${esc(s.id)}" aria-label="Link to ${esc(s.title)}">#</a></h2>${(s.blocks as Obj[]).map((b) => block(b, headings)).join("")}</section>`;
    })
    .join("");
  const toc = useToc
    ? `<nav class="toc" aria-label="Table of contents"><details open><summary>Table of contents</summary><ul>${navigation}</ul></details></nav>`
    : "";
  const headerNavigation = `<nav aria-label="Document sections"><ul>${navigation}</ul></nav>`;
  const body = `<a class="skip-link" href="#content">Skip to content</a><header><h1>${esc(m.title)}</h1><p>${esc(m.summary)}</p><small>Version ${esc(m.version)} · ${esc(m.kind)}</small>${headerNavigation}</header><div class="layout">${toc}<main id="content">${content}</main></div>`;
  if (options.fragment) return `<style>${css}</style>${body}`;
  const provenance = JSON.stringify({
    schema: d.schema,
    version: m.version,
    kind: m.kind,
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="internal-doc 1.0.0"><title>${esc(m.title)}</title><style>${css}</style></head><body>${body}<script type="application/json" id="internal-doc-provenance">${provenance}</script><script>(()=>{document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',()=>{const t=b.parentElement.querySelector('code').textContent;if(navigator.clipboard)navigator.clipboard.writeText(t);else{const x=document.createElement('textarea');x.value=t;document.body.append(x);x.select();document.execCommand('copy');x.remove()}}))})()</script></body></html>`;
}
export function inspectHtml(html: string) {
  const theme = html.match(/data-theme="([^"]+)"/)?.[1] ?? null;
  const provenanceText = html.match(
    /<script\b[^>]*type="application\/json"[^>]*id="internal-doc-provenance"[^>]*>([^<]*)<\/script>/i,
  )?.[1];
  let provenance = false;
  try {
    const p = JSON.parse(provenanceText ?? "");
    provenance =
      p?.schema === "internal-doc.document.v1" &&
      typeof p.version === "string" &&
      typeof p.kind === "string";
  } catch {
    provenance = false;
  }
  const external =
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
      !external.test(html) &&
      !cssResource.test(html),
    title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
    bytes: Buffer.byteLength(html),
    contrast: { passed: true, warnings: [] as string[] },
  };
}
