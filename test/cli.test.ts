import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const cli = join(process.cwd(), "dist/cli.js");
const fixture = join(
  process.cwd(),
  "generating-internal-docs/fixtures/every-block.json",
);
describe("CLI", () => {
  beforeAll(() => execFileSync("npm", ["run", "build"], { stdio: "pipe" }));
  it("validates and uses clean channels/exits", () => {
    expect(
      execFileSync(process.execPath, [cli, "validate", fixture], {
        encoding: "utf8",
      }),
    ).toContain("valid");
    const p = spawnSync(process.execPath, [cli, "validate", "missing.json"], {
      encoding: "utf8",
    });
    expect(p.status).toBe(2);
    expect(p.stdout).toBe("");
    expect(p.stderr).toBeTruthy();
  });
  it("renders deterministically and inspects JSON", () => {
    const d = mkdtempSync(join(tmpdir(), "idoc-"));
    const a = join(d, "a.html"),
      b = join(d, "b.html");
    execFileSync(process.execPath, [
      cli,
      "render",
      fixture,
      "--theme",
      "plain",
      "--output",
      a,
    ]);
    execFileSync(process.execPath, [
      cli,
      "render",
      fixture,
      "--theme",
      "plain",
      "--output",
      b,
    ]);
    expect(readFileSync(a, "utf8")).toBe(readFileSync(b, "utf8"));
    const info = JSON.parse(
      execFileSync(process.execPath, [cli, "inspect", a, "--json"], {
        encoding: "utf8",
      }),
    );
    expect(info.standalone).toBe(true);
    expect(info.theme).toBe("plain");
  });
  it("rejects unsupported theme", () => {
    expect(
      spawnSync(process.execPath, [cli, "render", fixture, "--theme", "nope"], {
        encoding: "utf8",
      }).status,
    ).toBe(1);
  });
  it("defaults to plain and rejects unknown, duplicate, and valueless flags as usage", () => {
    const d = mkdtempSync(join(tmpdir(), "idoc-"));
    const output = join(d, "out.html");
    execFileSync(process.execPath, [
      cli,
      "render",
      fixture,
      "--output",
      output,
    ]);
    expect(readFileSync(output, "utf8")).toContain('data-theme="plain"');
    for (const args of [
      ["validate", fixture, "--json"],
      ["render", fixture, "--output"],
      ["render", fixture, "--output", output, "--output", output],
      ["validate", fixture, "--artifact"],
      ["inspect", output, "--artifact"],
    ])
      expect(spawnSync(process.execPath, [cli, ...args]).status).toBe(2);
  });
  it("renders artifact mode and inspects it as artifact-fragment", () => {
    const d = mkdtempSync(join(tmpdir(), "idoc-"));
    const output = join(d, "artifact.html");
    execFileSync(process.execPath, [
      cli,
      "render",
      fixture,
      "--theme",
      "field-guide",
      "--artifact",
      "--output",
      output,
    ]);
    const html = readFileSync(output, "utf8");
    expect(html).not.toMatch(/<!doctype|<html[\s>]/i);
    expect(html).toMatch(/^<title>/);
    const info = JSON.parse(
      execFileSync(process.execPath, [cli, "inspect", output, "--json"], {
        encoding: "utf8",
      }),
    );
    expect(info.mode).toBe("artifact-fragment");
    expect(info.standalone).toBe(false);
    expect(info.theme).toBe("field-guide");
  });
  it("artifact output is deterministic across two renders", () => {
    const d = mkdtempSync(join(tmpdir(), "idoc-"));
    const a = join(d, "a.html"),
      b = join(d, "b.html");
    for (const out of [a, b])
      execFileSync(process.execPath, [
        cli,
        "render",
        fixture,
        "--theme",
        "technical-report",
        "--artifact",
        "--output",
        out,
      ]);
    expect(readFileSync(a, "utf8")).toBe(readFileSync(b, "utf8"));
  });
  it("classifies invalid JSON/content as 1 and filesystem failures as 2", () => {
    const d = mkdtempSync(join(tmpdir(), "idoc-"));
    const invalidJson = join(d, "bad.json");
    const invalidContent = join(d, "invalid.json");
    writeFileSync(invalidJson, "{");
    writeFileSync(invalidContent, "{}");
    expect(
      spawnSync(process.execPath, [cli, "validate", invalidJson]).status,
    ).toBe(1);
    expect(
      spawnSync(process.execPath, [cli, "validate", invalidContent]).status,
    ).toBe(1);
  });
  it("portable validation script resolves its CLI relative path", () => {
    const script = join(
      process.cwd(),
      "generating-internal-docs/scripts/validate.mjs",
    );
    expect(
      spawnSync(process.execPath, [script, fixture], { cwd: tmpdir() }).status,
    ).toBe(0);
  });
});
