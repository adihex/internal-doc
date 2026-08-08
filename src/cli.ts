#!/usr/bin/env node
import { readFileSync, watch, writeFileSync } from "node:fs";
import { basename } from "node:path";
import {
  documentSchema,
  inspectHtml,
  renderDocument,
  themeDescriptions,
  themes,
  validateDocument,
  type Theme,
} from "./index.js";

const usage =
  "Usage: internal-doc <validate|render|inspect|themes|schema|diff|new> [file] [options]";
const fail = (message: string, code: 1 | 2): never => {
  console.error(message);
  process.exit(code);
};
type Options = {
  theme: Theme | undefined;
  output: string | undefined;
  json: boolean;
  artifact: boolean;
  fragment: boolean;
  toc: boolean;
  strict: boolean;
  watch: boolean;
  bump: "patch" | "minor" | "major" | undefined;
  kind: string | undefined;
};
function flags(values: string[]): Options {
  const out: Options = {
    theme: undefined,
    output: undefined,
    bump: undefined,
    kind: undefined,
    json: false,
    artifact: false,
    fragment: false,
    toc: false,
    strict: false,
    watch: false,
  };
  const booleans = new Set([
    "--json",
    "--artifact",
    "--fragment",
    "--toc",
    "--strict",
    "--watch",
  ]);
  const seen = new Set<string>();
  for (let i = 0; i < values.length; i++) {
    const flag = values[i]!;
    if (seen.has(flag)) fail(`Invalid option: ${flag}`, 2);
    seen.add(flag);
    if (booleans.has(flag)) {
      const key = flag.slice(2) as
        | "json"
        | "artifact"
        | "fragment"
        | "toc"
        | "strict"
        | "watch";
      if (out[key]) fail(`Invalid option: ${flag}`, 2);
      out[key] = true;
      continue;
    }
    const value = values[++i];
    if (!value || value.startsWith("--")) fail(`${flag} requires a value`, 2);
    const optionValue = value!;
    if (flag === "--theme") {
      if (!themes.includes(optionValue as Theme))
        fail(`Unsupported theme: ${value}`, 1);
      out.theme = optionValue as Theme;
    } else if (flag === "--output") out.output = optionValue;
    else if (
      flag === "--bump" &&
      ["patch", "minor", "major"].includes(optionValue)
    )
      out.bump = optionValue as NonNullable<Options["bump"]>;
    else if (flag === "--kind") out.kind = optionValue;
    else fail(`Invalid option: ${flag}`, 2);
  }
  return out;
}
function load(file: string): unknown {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), 2);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), 1);
  }
}
function bump(version: string, kind: NonNullable<Options["bump"]>) {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return version;
  if (kind === "major") return `${parts[0]! + 1}.0.0`;
  if (kind === "minor") return `${parts[0]}.${parts[1]! + 1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2]! + 1}`;
}
function render(file: string, options: Options) {
  const doc = load(file) as Record<string, unknown>;
  const metadata = doc.metadata as Record<string, unknown>;
  let changed = false;
  if (!metadata.updated) {
    metadata.updated = new Date().toISOString().slice(0, 10);
    changed = true;
  }
  if (options.bump) {
    metadata.version = bump(String(metadata.version), options.bump);
    changed = true;
  }
  const errors = validateDocument(doc, options.strict);
  if (errors.length) fail(errors.join("\n"), 1);
  if (!options.output) fail("--output is required", 2);
  if (changed) writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
  writeFileSync(
    options.output!,
    renderDocument(
      doc,
      options.theme,
      options.artifact
        ? "artifact"
        : { fragment: options.fragment, toc: options.toc },
    ),
  );
  console.log(options.output!);
}
const [rawCommand, file, ...rest] = process.argv.slice(2);
const command = rawCommand ?? "";
if (!command) fail(usage, 2);
if (command === "themes") {
  if (file) fail(usage, 2);
  console.log(themes.map((t) => `${t}\t${themeDescriptions[t]}`).join("\n"));
} else if (command === "schema") {
  if (file) fail(usage, 2);
  console.log(JSON.stringify(documentSchema, null, 2));
} else if (command === "new") {
  const options = flags([file, ...rest].filter((x): x is string => Boolean(x)));
  const kind = options.kind ?? "report";
  const output = options.output ?? `new-${kind}.json`;
  const doc = {
    schema: "internal-doc.document.v1",
    metadata: {
      title: "Untitled document",
      summary: "Describe this document.",
      version: "0.1.0",
      kind,
      updated: new Date().toISOString().slice(0, 10),
    },
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [{ type: "prose", markdown: "Start writing here." }],
      },
    ],
  };
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(output);
} else if (command === "diff") {
  if (!file || !rest[0]) fail("Usage: internal-doc diff <a.json> <b.json>", 2);
  const a = load(file!) as Record<string, unknown>,
    b = load(rest[0]!) as Record<string, unknown>;
  const as = new Map(
      ((a.sections ?? []) as Record<string, unknown>[]).map((s) => [
        String(s.id),
        s,
      ]),
    ),
    bs = new Map(
      ((b.sections ?? []) as Record<string, unknown>[]).map((s) => [
        String(s.id),
        s,
      ]),
    );
  const lines: string[] = [];
  for (const id of bs.keys())
    lines.push(
      as.has(id)
        ? JSON.stringify(as.get(id)) === JSON.stringify(bs.get(id))
          ? ""
          : `changed section: ${id}`
        : `added section: ${id}`,
    );
  for (const id of as.keys())
    if (!bs.has(id)) lines.push(`removed section: ${id}`);
  console.log(lines.filter(Boolean).join("\n") || "no changes");
} else if (["validate", "render", "inspect"].includes(command)) {
  if (!file) fail(usage, 2);
  const options = flags(rest);
  if (command === "inspect") {
    if (
      options.artifact ||
      options.fragment ||
      options.toc ||
      options.strict ||
      options.watch ||
      options.theme ||
      options.output ||
      options.bump
    )
      fail("Invalid option for inspect", 2);
    const info = inspectHtml(readFileSync(file!, "utf8"));
    if (!info.mode)
      fail(`${file}: invalid HTML (not standalone or artifact-fragment)`, 1);
    console.log(
      options.json
        ? JSON.stringify(info)
        : `theme: ${info.theme}\nmode: ${info.mode}\nbytes: ${info.bytes}\ncontrast: passed`,
    );
  } else if (command === "validate") {
    if (
      options.json ||
      options.artifact ||
      options.fragment ||
      options.toc ||
      options.watch ||
      options.theme ||
      options.output ||
      options.bump
    )
      fail("Invalid option for validate", 2);
    const errors = validateDocument(load(file!), options.strict);
    if (errors.length) fail(errors.join("\n"), 1);
    console.log(`${file}: valid`);
  } else {
    render(file!, options);
    if (options.watch) {
      console.error(`Watching ${basename(file!)}`);
      watch(file!, { persistent: true }, () => {
        try {
          render(file!, options);
        } catch {
          // The next filesystem event retries rendering.
        }
      });
    }
  }
} else fail(`Unknown command: ${command}`, 2);
