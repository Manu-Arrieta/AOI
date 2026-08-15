#!/usr/bin/env node
// Generate the human-readable `.md` view of a
// `.sandboxes/{name}/integration-manifest.json` file (spec §3.3, §4.3).
//
// Two surfaces:
//   - `renderManifestMarkdown(manifest)` — PURE, deterministic, no I/O. Returns
//     the full markdown string (banner + compartments table + per-compartment
//     elements tables). Safe to import from tests and from `/sandbox-new`.
//   - CLI — reads a manifest JSON path, renders it, and (by default) writes the
//     sibling `integration-manifest.md`. Pass `--stdout` to print instead.
//
// Pure Node built-ins, no external deps, following the `scripts/sandbox/` style.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Managed-folder banner marking the file as generated/non-editable (spec §4.3).
export const GENERATED_BANNER =
  "<!-- generated:do-not-edit — source: integration-manifest.json -->";

const COMPARTMENT_TABLE_HEADER = "| id | kind | surface | integration-target |";
const COMPARTMENT_TABLE_DIVIDER =
  "| -- | ---- | ------- | ------------------ |";
const ELEMENT_TABLE_HEADER = "| id | kind | disposition | status | target |";
const ELEMENT_TABLE_DIVIDER = "| -- | ---- | ----------- | ------ | ------ |";

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|");
}

function formatTarget(target) {
  return target === null || target === undefined ? "—" : String(target);
}

/**
 * Render the markdown view of a manifest. Pure and deterministic: identical
 * input always yields byte-identical output (no clock, no I/O, stable ordering).
 *
 * Ordering contract (spec §4.3): compartments in array order; per compartment,
 * an `## Elements — {id}` section listing the elements that reference it, in
 * element array order.
 */
export function renderManifestMarkdown(manifest) {
  const { sandbox, generatedAt } = manifest;
  const compartments =
    Array.isArray(manifest.compartments) ? manifest.compartments : [];
  const elements = Array.isArray(manifest.elements) ? manifest.elements : [];

  const lines = [];
  lines.push(GENERATED_BANNER);
  lines.push(`# Integration Manifest — ${sandbox}`);
  lines.push(
    `_Generated ${generatedAt} — DO NOT EDIT (regenerated from JSON)._`,
  );
  lines.push("");
  lines.push("## Compartments");
  lines.push(COMPARTMENT_TABLE_HEADER);
  lines.push(COMPARTMENT_TABLE_DIVIDER);
  for (const compartment of compartments) {
    lines.push(
      `| ${escapeCell(compartment.id)} | ${escapeCell(compartment.kind)} | ${escapeCell(compartment.surface)} | ${escapeCell(compartment.integrationTarget)} |`,
    );
  }

  for (const compartment of compartments) {
    const own = elements.filter(
      (element) => element.compartment === compartment.id,
    );
    lines.push("");
    lines.push(`## Elements — ${compartment.id}`);
    lines.push(ELEMENT_TABLE_HEADER);
    lines.push(ELEMENT_TABLE_DIVIDER);
    for (const element of own) {
      lines.push(
        `| ${escapeCell(element.id)} | ${escapeCell(element.kind)} | ${escapeCell(element.disposition)} | ${escapeCell(element.status)} | ${escapeCell(formatTarget(element.target))} |`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const toStdout = args.includes("--stdout");
  const filePath = args.find((arg) => !arg.startsWith("--"));

  if (!filePath) {
    process.stderr.write(
      "usage: node generate-manifest-md.mjs <path-to-integration-manifest.json> [--stdout]\n",
    );
    process.exitCode = 1;
    return;
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    process.stderr.write(`${filePath}: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  const markdown = renderManifestMarkdown(raw);

  if (toStdout) {
    process.stdout.write(markdown);
    return;
  }

  const outPath = path.join(path.dirname(filePath), "integration-manifest.md");
  await writeFile(outPath, markdown, "utf8");
  process.stdout.write(`wrote ${outPath}\n`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main();
}
