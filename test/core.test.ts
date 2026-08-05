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
  it("rejects external resources and bad heading semantics", () => {
    const x = structuredClone(doc);
    x.sections[0].blocks.push({
      type: "prose",
      markdown: "![x](https://evil/x.png)\n\n# Wrong",
    });
    expect(validateDocument(x).join()).toMatch(/External resource|heading/);
  });
});
describe("render", () => {
  for (const theme of ["plain", "field-guide", "technical-report"] as const)
    it(`renders ${theme}`, () => {
      const html = renderDocument(doc, theme);
      expect(inspectHtml(html)).toMatchObject({ standalone: true, theme });
      expect(html).not.toMatch(/<script src=|<link[^>]+href=/);
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
    expect(html).not.toContain("javascript:bad()");
    expect(html).toContain("&lt;/code&gt;");
  });
});
