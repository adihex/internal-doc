#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  inspectHtml,
  renderDocument,
  themes,
  validateDocument,
  type Theme,
} from "./index.js";
const [cmd, file, ...args] = process.argv.slice(2);
const fail = (m: string, n = 1): never => {
  console.error(m);
  process.exit(n);
};
try {
  if (!cmd || !file)
    fail("Usage: internal-doc <validate|render|inspect> <file> [options]", 2);
  const input = file!;
  if (cmd === "validate") {
    const e = validateDocument(JSON.parse(readFileSync(input, "utf8")));
    if (e.length) fail(e.join("\n"));
    console.log(`${input}: valid`);
  } else if (cmd === "render") {
    const theme = (args[args.indexOf("--theme") + 1] ?? "plain") as Theme;
    if (!themes.includes(theme)) fail(`Unsupported theme: ${theme}`);
    const output = args[args.indexOf("--output") + 1];
    if (!output) fail("--output is required", 2);
    writeFileSync(
      output!,
      renderDocument(JSON.parse(readFileSync(input, "utf8")), theme),
    );
    console.log(output);
  } else if (cmd === "inspect") {
    const info = inspectHtml(readFileSync(input, "utf8"));
    if (args.includes("--json")) console.log(JSON.stringify(info));
    else
      console.log(
        `theme: ${info.theme}\nstandalone: ${info.standalone}\nbytes: ${info.bytes}`,
      );
  } else fail(`Unknown command: ${cmd}`, 2);
} catch (e) {
  fail(
    e instanceof Error ? e.message : String(e),
    e instanceof SyntaxError ? 1 : 2,
  );
}
