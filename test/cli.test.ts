import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const cli = join(process.cwd(), "dist/cli.js");
const fixture = join(
  process.cwd(),
  "generating-internal-docs/fixtures/every-block.json",
);
describe("CLI", () => {
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
});
