import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateDocument, renderDocument, inspectHtml } from "../src/index.js";
const doc = JSON.parse(
  readFileSync("generating-internal-docs/fixtures/every-block.json", "utf8"),
);
describe("validation", () => {
  it("accepts every block", () => expect(validateDocument(doc)).toEqual([]));
  it("rejects malformed and unsupported blocks", () => {
    expect(validateDocument({ title: "x" }).length).toBeGreaterThan(0);
    expect(
      validateDocument({
        ...doc,
        sections: [{ id: "x", title: "X", blocks: [{ type: "alien" }] }],
      }).length,
    ).toBeGreaterThan(0);
  });
  it("finds duplicate IDs and broken refs", () => {
    const x = structuredClone(doc);
    x.sections.push({ ...x.sections[0] });
    expect(validateDocument(x).join()).toMatch(/duplicate/);
    const y = structuredClone(doc);
    y.sections[0].blocks.push({ type: "prose", markdown: "[bad](#missing)" });
    expect(validateDocument(y).join()).toMatch(/Broken local reference/);
  });
  it("resolves forward fragment references after globally collecting IDs", () => {
    const x = structuredClone(doc);
    x.sections[0].blocks.unshift({
      type: "prose",
      markdown: "[later](#later)",
    });
    x.sections[0].blocks.push({
      type: "callout",
      id: "later",
      style: "note",
      text: "Here",
    });
    expect(validateDocument(x)).toEqual([]);
  });
  it("uses Markdown tokens for images and heading semantics", () => {
    const x = structuredClone(doc);
    x.sections[0].blocks.push({
      type: "prose",
      markdown: "![local](asset.png)",
    });
    expect(validateDocument(x).join()).toMatch(/Images are not allowed/);
    for (const markdown of ["Title\n=====", "### Fine\n\n##### Skip"]) {
      const y = structuredClone(doc);
      y.sections[0].blocks.push({ type: "prose", markdown });
      expect(validateDocument(y).join()).toMatch(/heading/i);
    }
    const z = structuredClone(doc);
    z.sections[0].blocks.push({
      type: "prose",
      markdown: "```md\n# code only\n```",
    });
    expect(validateDocument(z)).toEqual([]);
  });
  it("requires every table row to match its columns", () => {
    const x = structuredClone(doc);
    x.sections[0].blocks.push({
      type: "table",
      columns: ["a", "b"],
      rows: [["one"]],
    });
    expect(validateDocument(x).join()).toMatch(/row width/i);
  });
});
describe("render", () => {
  for (const theme of ["plain", "field-guide", "technical-report"] as const)
    it(`renders ${theme}`, () => {
      const html = renderDocument(doc, theme);
      expect(inspectHtml(html)).toMatchObject({ standalone: true, theme });
      expect(html).not.toMatch(/<script src=|<link[^>]+href=/);
    });
  it("renders fragments, opt-in TOCs, and new semantic blocks", () => {
    const x = structuredClone(doc);
    x.metadata.toc = true;
    x.metadata.theme = "presentation";
    x.sections[0].blocks.push(
      { type: "mermaid", code: "flowchart LR\nA-->B" },
      {
        type: "definition-list",
        items: [{ term: "API", definition: "Interface" }],
      },
      {
        type: "timeline",
        events: [{ timestamp: "2026-01-01", title: "Start", text: "Began" }],
      },
      { type: "details", summary: "Evidence", markdown: "Hidden detail" },
    );
    expect(validateDocument(x)).toEqual([]);
    const html = renderDocument(x, undefined, { fragment: true });
    expect(html).toContain('<nav class="toc"');
    expect(html).toContain('class="mermaid"');
    expect(html).toContain('class="definitions"');
    expect(html).not.toContain("<!doctype");
    expect(html).not.toContain("<head>");
  });
  it("renders keyboard-usable document navigation from semantic sections", () => {
    const html = renderDocument(doc, "technical-report");
    expect(html).toContain('<nav aria-label="Document sections">');
    expect(html).toContain('<a href="#overview">Overview</a>');
    expect(html).toContain('<main id="content">');
    expect(html).toContain('class="theme-toggle"');
    expect(html).toContain('data-document-theme="technical-report"');
    expect(html).toContain("root.dataset.theme=dark()?'light':'dark'");
    expect(html).toContain(
      '<a class="skip-link" href="#content">Skip to content</a>',
    );
  });
  it("escapes injection in markdown, code, URL and embedded JSON", () => {
    const x = structuredClone(doc);
    x.metadata.title = "</script><script>bad()</script>";
    x.sections[0].blocks = [
      {
        type: "prose",
        markdown: "<img src=x onerror=bad()> [x](javascript:bad())",
      },
      { type: "code", code: "</code><script>bad()</script>", language: "html" },
    ];
    const html = renderDocument(x, "plain");
    expect(html).not.toContain("<script>bad()");
    expect(html).not.toContain('href="javascript:bad()"');
    expect(html).toContain("&lt;/code&gt;");
  });
  it("applies an explicit safe hyperlink policy", () => {
    const x = structuredClone(doc);
    x.sections[0].blocks = [
      {
        type: "prose",
        markdown:
          "[web](https://example.com) [mail](mailto:a@example.com) [bad](data:text/html,x)",
      },
    ];
    const html = renderDocument(x, "plain");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="mailto:a@example.com"');
    expect(html).not.toContain('href="data:');
  });
  it("detects broad external resources and requires compiler provenance", () => {
    const html = renderDocument(doc, "plain");
    for (const external of [
      '<iframe src="https://evil.test"></iframe>',
      '<video poster="//evil.test/x"></video>',
      '<style>@import "x.css"</style>',
      "<style>x{background:url(https://evil.test/x)}</style>",
    ])
      expect(inspectHtml(html + external).standalone).toBe(false);
    expect(
      inspectHtml(html.replace('name="generator"', 'name="other"')).standalone,
    ).toBe(false);
    expect(
      inspectHtml(html.replace('id="internal-doc-provenance"', 'id="other"'))
        .standalone,
    ).toBe(false);
  });
  it("includes overflow safeguards and theme-owned print contracts", () => {
    for (const theme of ["plain", "field-guide", "technical-report"] as const) {
      const html = renderDocument(doc, theme);
      expect(html).toMatch(/overflow-wrap:break-word/);
      expect(html).toMatch(/@media print/);
      expect(html).toMatch(new RegExp(`--print-theme:\\s*${theme}`));
    }
  });
});
describe("artifact mode", () => {
  for (const theme of ["plain", "field-guide", "technical-report"] as const)
    it(`renders ${theme} as artifact-fragment`, () => {
      const html = renderDocument(doc, theme, "artifact");
      expect(inspectHtml(html)).toMatchObject({
        mode: "artifact-fragment",
        theme,
        standalone: false,
      });
      expect(html).not.toMatch(/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i);
      expect(html).toMatch(/^<title>/);
      expect((html.match(/<style\b[^>]*>/gi) ?? []).length).toBe(1);
      expect(html).not.toMatch(/<script src=|<link[^>]+href=/);
    });
  it("is deterministic across two renders for every theme", () => {
    for (const theme of ["plain", "field-guide", "technical-report"] as const) {
      const a = renderDocument(doc, theme, "artifact");
      const b = renderDocument(doc, theme, "artifact");
      expect(a).toBe(b);
    }
  });
  it("contains dual-theme custom properties with manual toggle override", () => {
    for (const theme of ["plain", "field-guide", "technical-report"] as const) {
      const html = renderDocument(doc, theme, "artifact");
      expect(html).toContain("@media (prefers-color-scheme: dark)");
      expect(html).toContain(':root[data-theme="light"]');
      expect(html).toContain(':root[data-theme="dark"]');
    }
  });
  it("includes responsive artifact CSS: balanced headings, tabular-nums, overflow-x", () => {
    const html = renderDocument(doc, "plain", "artifact");
    expect(html).toContain("text-wrap:balance");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("overflow-x:auto");
  });
  it("escapes injection identically in both modes", () => {
    const x = structuredClone(doc);
    x.metadata.title = "</script><script>bad()</script>";
    x.sections[0].blocks = [
      {
        type: "prose",
        markdown: "<img src=x onerror=bad()> [x](javascript:bad())",
      },
      { type: "code", code: "</code><script>bad()</script>", language: "html" },
    ];
    for (const mode of ["standalone", "artifact"] as const) {
      const html = renderDocument(x, "plain", mode);
      expect(html).not.toContain("<script>bad()");
      expect(html).not.toContain('href="javascript:bad()"');
      expect(html).toContain("&lt;/code&gt;");
    }
  });
  it("applies the safe hyperlink policy in artifact mode", () => {
    const x = structuredClone(doc);
    x.sections[0].blocks = [
      {
        type: "prose",
        markdown:
          "[web](https://example.com) [mail](mailto:a@example.com) [bad](data:text/html,x)",
      },
    ];
    const html = renderDocument(x, "plain", "artifact");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="mailto:a@example.com"');
    expect(html).not.toContain('href="data:');
  });
  it("includes provenance and theme-toggle in artifact output", () => {
    const html = renderDocument(doc, "plain", "artifact");
    expect(html).toContain('id="internal-doc-provenance"');
    expect(html).toContain('class="theme-toggle"');
  });
});
describe("inspect classification", () => {
  it("classifies standalone output", () => {
    const html = renderDocument(doc, "plain");
    expect(inspectHtml(html)).toMatchObject({ mode: "standalone" });
  });
  it("classifies artifact-fragment output", () => {
    const html = renderDocument(doc, "field-guide", "artifact");
    expect(inspectHtml(html)).toMatchObject({ mode: "artifact-fragment" });
  });
  it("rejects hand-written HTML that is neither", () => {
    expect(inspectHtml("<html><body>Hi</body></html>").mode).toBeNull();
    expect(inspectHtml("<p>just text</p>").mode).toBeNull();
    expect(
      inspectHtml("<title>Test</title><style>body{}</style>").mode,
    ).toBeNull();
  });
  it("rejects artifact fragments with external resources", () => {
    const html = renderDocument(doc, "plain", "artifact");
    for (const external of [
      '<iframe src="https://evil.test"></iframe>',
      '<style>@import "x.css"</style>',
      "<style>x{background:url(https://evil.test/x)}</style>",
    ])
      expect(inspectHtml(html + external).mode).toBeNull();
  });
  it("rejects artifact fragments with multiple style blocks", () => {
    const html = renderDocument(doc, "plain", "artifact");
    expect(inspectHtml(html + "<style>extra</style>").mode).toBeNull();
  });
});
