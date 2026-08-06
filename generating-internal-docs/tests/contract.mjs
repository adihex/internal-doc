#!/usr/bin/env node
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
const fixture = join(skill, "fixtures", "every-block.json");
const directory = mkdtempSync(join(tmpdir(), "internal-doc-contract-"));

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

run(["validate", fixture]);
for (const theme of ["plain", "field-guide", "technical-report"]) {
  const first = join(directory, `${theme}-a.html`);
  const second = join(directory, `${theme}-b.html`);
  run(["render", fixture, "--theme", theme, "--output", first]);
  run(["render", fixture, "--theme", theme, "--output", second]);
  if (readFileSync(first, "utf8") !== readFileSync(second, "utf8"))
    throw new Error(`${theme} output is not deterministic`);
  const inspection = JSON.parse(run(["inspect", first, "--json"]));
  if (!inspection.standalone || inspection.theme !== theme)
    throw new Error(`${theme} contract failed`);
}
for (const theme of ["plain", "field-guide", "technical-report"]) {
  const first = join(directory, `${theme}-artifact-a.html`);
  const second = join(directory, `${theme}-artifact-b.html`);
  run(["render", fixture, "--theme", theme, "--artifact", "--output", first]);
  run(["render", fixture, "--theme", theme, "--artifact", "--output", second]);
  if (readFileSync(first, "utf8") !== readFileSync(second, "utf8"))
    throw new Error(`${theme} artifact output is not deterministic`);
  const inspection = JSON.parse(run(["inspect", first, "--json"]));
  if (inspection.mode !== "artifact-fragment" || inspection.theme !== theme)
    throw new Error(`${theme} artifact contract failed`);
}
process.stdout.write(
  "skill contract: valid, deterministic, standalone and artifact-fragment\n",
);
