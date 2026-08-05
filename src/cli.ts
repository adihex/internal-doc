#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  inspectHtml,
  renderDocument,
  themes,
  validateDocument,
  type Theme,
} from "./index.js";

const usage = "Usage: internal-doc <validate|render|inspect> <file> [options]";
const fail = (message: string, code: 1 | 2): never => {
  console.error(message);
  process.exit(code);
};
type Parsed = { theme: Theme; output: string | undefined; json: boolean };
function flags(command: string, values: string[]): Parsed {
  const allowed =
    command === "render"
      ? new Set(["--theme", "--output"])
      : command === "inspect"
        ? new Set(["--json"])
        : new Set<string>();
  const seen = new Set<string>();
  const parsed: Parsed = { theme: "plain", output: undefined, json: false };
  for (let i = 0; i < values.length; i++) {
    const flag = values[i]!;
    if (!allowed.has(flag) || seen.has(flag))
      fail(`Invalid option: ${flag}`, 2);
    seen.add(flag);
    if (flag === "--json") parsed.json = true;
    else {
      const value = values[++i];
      if (!value || value.startsWith("--")) fail(`${flag} requires a value`, 2);
      if (flag === "--theme") {
        if (!themes.includes(value as Theme))
          fail(`Unsupported theme: ${value}`, 1);
        parsed.theme = value as Theme;
      } else parsed.output = value;
    }
  }
  if (command === "render" && !parsed.output) fail("--output is required", 2);
  return parsed;
}

const [command, file, ...values] = process.argv.slice(2);
if (!command || !file || !["validate", "render", "inspect"].includes(command))
  fail(
    command && !["validate", "render", "inspect"].includes(command)
      ? `Unknown command: ${command}`
      : usage,
    2,
  );
const selectedCommand = command!;
const input = file!;
const options = flags(selectedCommand, values);
let source = "";
try {
  source = readFileSync(input, "utf8");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error), 2);
}
if (selectedCommand === "inspect") {
  const info = inspectHtml(source);
  if (!info.standalone) fail(`${input}: invalid or non-standalone HTML`, 1);
  console.log(
    options.json
      ? JSON.stringify(info)
      : `theme: ${info.theme}\nstandalone: ${info.standalone}\nbytes: ${info.bytes}`,
  );
} else {
  let document: unknown;
  try {
    document = JSON.parse(source);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), 1);
  }
  const errors = validateDocument(document);
  if (errors.length) fail(errors.join("\n"), 1);
  if (selectedCommand === "validate") console.log(`${input}: valid`);
  else {
    try {
      writeFileSync(options.output!, renderDocument(document, options.theme));
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error), 2);
    }
    console.log(options.output);
  }
}
