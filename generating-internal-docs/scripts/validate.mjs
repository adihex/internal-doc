#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
const result = spawnSync(
  process.execPath,
  [cli, "validate", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
