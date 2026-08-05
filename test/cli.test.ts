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
    ])
      expect(spawnSync(process.execPath, [cli, ...args]).status).toBe(2);
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
