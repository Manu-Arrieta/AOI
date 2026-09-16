#!/usr/bin/env node
// Confirmed writer for `.specify/memory/base-project.json`.
//
// `detect-base-project.mjs` only ever PROPOSES — it prints a shape and its own
// header says so ("It NEVER writes the file"). The confirmed write lives here,
// as an executable, because the alternative was a step in `/init`'s prose: a
// contract that two consumers (`sdd-verify.prompt.md` and
// `@integration-specialist`) resolve real destination paths against, produced
// by an LLM writing a JSON file by hand. Nothing could test it, and nothing
// could tell a proposal from a decision.
//
// That distinction is the one rule enforced here. A persisted map names the
// Owner who confirmed it. `confirmedBy: null` is the marker of a PROPOSAL, and
// a proposal on disk is a lie about its own state — which is exactly how a
// workspace ended up with the ICM fact, the memoir concept and two consumers
// all asserting a map that the detector had merely printed.
//
// Dependency-light (Node built-ins only), mirroring the `scripts/sandbox/`
// precedent set by `detect-base-project.mjs` and `workspace-globs.mjs`.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { detectFromDisk } from "./detect-base-project.mjs";
import { allowedRootKeys } from "./manifest-schema.mjs";

export const BASE_PROJECT_RELATIVE_PATH = path.join(".specify", "memory", "base-project.json");

const USAGE = `Usage: node scripts/sandbox/write-base-project.mjs --confirmed-by <owner> [options]

Writes .specify/memory/base-project.json from the detector's proposal.
Run with no flags to see this text; nothing is written.

Options:
  --confirmed-by <owner>   REQUIRED. The Owner who confirmed the roots.
                           Refused when empty, "null" or "undefined".
  --cwd <path>             Project root to detect and write into. Default: cwd.
  --dry-run                Print what would be written; touch nothing.
  --json                   Emit the resulting map as JSON on stdout.
  --help                   This text.
`;

/**
 * Accepts only an actual Owner.
 *
 * A whitespace-only string, and the literal words `null` / `undefined`, are all
 * ways a caller can mean "nobody confirmed this" without saying so. Letting any
 * of them through would persist the proposal marker under a different spelling.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeOwner(value) {
  const owner = String(value ?? "").trim();
  const disowned = ["", "null", "undefined", "none"];
  if (disowned.includes(owner.toLowerCase())) {
    throw new Error(
      "--confirmed-by is required and must name the Owner: a persisted " +
        "base-project map records WHO confirmed the roots. `confirmedBy: " +
        "null` is the marker of an unconfirmed proposal and must never be " +
        "written to disk.",
    );
  }
  return owner;
}

/**
 * Turns a detector proposal into the confirmed artifact.
 *
 * Pure: takes the proposal as data, so the confirmation rule is testable
 * without touching the disk or a real workspace.
 *
 * @param {{ proposal?: object, confirmedBy: unknown }} input
 * @returns {object}
 */
export function buildConfirmedMap({ proposal, confirmedBy }) {
  const owner = normalizeOwner(confirmedBy);
  const proposedRoots = proposal?.roots ?? {};

  const roots = {};
  for (const key of allowedRootKeys) {
    const list = proposedRoots[key] ?? [];
    if (!Array.isArray(list)) {
      throw new Error(`proposal.roots.${key} must be an array of paths.`);
    }
    roots[key] = [...list];
  }

  return {
    $schemaVersion: proposal?.$schemaVersion ?? 1,
    // The base project IS the install directory, so this is always relative to
    // itself. It stays a field because downstream resolves destinations by
    // joining it first.
    baseRoot: proposal?.baseRoot ?? ".",
    detectedAt: proposal?.detectedAt ?? new Date().toISOString(),
    confirmedBy: owner,
    workspaceManager: proposal?.workspaceManager ?? "unknown",
    roots,
  };
}

/**
 * Writes to a sibling temp file and renames over the target.
 *
 * A half-written `base-project.json` is worse than a missing one: the missing
 * file fails loudly at the first consumer, while a truncated one parses as
 * JSON only if the truncation lands on a value boundary — and resolves paths
 * against a map nobody confirmed.
 */
function writeAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.tmp`,
  );

  const fd = fs.openSync(tmpPath, "w");
  try {
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.renameSync(tmpPath, filePath);
}

/**
 * Detects, confirms and writes.
 *
 * @param {{ cwd?: string, confirmedBy: unknown, proposal?: object, dryRun?: boolean }} input
 * @returns {{ filePath: string, content: string, map: object, existed: boolean, written: boolean }}
 */
export function writeBaseProject({
  cwd = process.cwd(),
  confirmedBy,
  proposal,
  dryRun = false,
} = {}) {
  const map = buildConfirmedMap({
    proposal: proposal ?? detectFromDisk(cwd),
    confirmedBy,
  });

  const filePath = path.join(cwd, BASE_PROJECT_RELATIVE_PATH);
  const content = `${JSON.stringify(map, null, 2)}\n`;
  const existed = fs.existsSync(filePath);

  if (!dryRun) {
    writeAtomic(filePath, content);
  }

  return { filePath, content, map, existed, written: !dryRun };
}

/**
 * Flag parser, deliberately strict: an unknown flag is an error rather than
 * something to ignore. A typo like `--confirmed_by` would otherwise fall
 * through to the missing-owner path and read as "the Owner never confirmed".
 */
export function parseArgs(argv = []) {
  const options = { dryRun: false, json: false, help: false };
  const takesValue = new Set(["--confirmed-by", "--cwd"]);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (takesValue.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      options[arg === "--cwd" ? "cwd" : "confirmedBy"] = value;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}`);
    process.exitCode = 2;
    return;
  }

  // Checked BEFORE anything else: a bare invocation is a question, not a write.
  if (options.help || process.argv.length <= 2) {
    process.stdout.write(USAGE);
    return;
  }

  let result;
  try {
    result = writeBaseProject(options);
  } catch (error) {
    process.stderr.write(`❌ ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result.map, null, 2)}\n`);
    return;
  }

  const rootSummary = Object.entries(result.map.roots)
    .map(([key, list]) => `${key}: ${list.length === 0 ? "(none)" : list.join(", ")}`)
    .join(" · ");

  const lines = [
    result.written
      ? `✅ base-project map ${result.existed ? "updated" : "written"}: ${result.filePath}`
      : `▸ dry run — nothing written. Target: ${result.filePath}`,
    `   confirmedBy: ${result.map.confirmedBy}`,
    `   baseRoot:    ${result.map.baseRoot}  (${result.map.workspaceManager})`,
    `   roots:       ${rootSummary}`,
  ];

  // An empty map is a legitimate outcome (a project with no packages yet), and
  // saying so at write time is the only chance to catch "the detector saw
  // nothing" being mistaken for "the project has nothing".
  if (Object.values(result.map.roots).every((list) => list.length === 0)) {
    lines.push(
      "   ⚠ all three roots are empty — confirm this is right. An empty map " +
        "still resolves nothing; targets will need `baseRoot`-relative paths.",
    );
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main();
}
