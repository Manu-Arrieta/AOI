/**
 * scripts/sandbox/workspace-globs.mjs
 *
 * How a pnpm workspace declaration is read.
 *
 * Split out of `detect-base-project.mjs`, which sat at 342 LOC against the
 * 300 limit. The split follows a real seam: parsing `pnpm-workspace.yaml`
 * and expanding its globs against the filesystem is one subject, and
 * deciding whether a package is a frontend or a backend is another. Only the
 * first is about pnpm.
 *
 * There is no YAML dependency on purpose — the file is read for one key, and
 * pulling a parser in to find `packages:` would cost every workspace an
 * install for a nine-line loop.
 */

import fs from "node:fs";
import path from "node:path";

/** Strips leading and trailing slashes so segments join predictably. */
function normalizeDir(dir) {
  return String(dir ?? "").replace(/^[./]+/, "").replace(/\/+$/, "");
}

/**
 * Parse the `packages:` list out of `pnpm-workspace.yaml` without a YAML
 * dependency. Returns workspace-relative glob strings, skipping `!`-exclusions.
 */
export function parsePnpmWorkspacePackages(yamlText) {
  if (typeof yamlText !== "string" || yamlText.trim().length === 0) {
    return [];
  }

  const packages = [];
  let inPackages = false;

  for (const rawLine of yamlText.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    if (!inPackages) {
      if (/^packages\s*:/.test(trimmed)) {
        inPackages = true;
      }
      continue;
    }

    const listItem = line.match(/^\s*-\s*(.+?)\s*$/);
    if (listItem) {
      let value = listItem[1].trim().replace(/^['"]|['"]$/g, "");
      if (value && !value.startsWith("!")) {
        packages.push(value);
      }
      continue;
    }

    // A new non-indented key ends the `packages:` block.
    if (/^\S/.test(line)) {
      inPackages = false;
    }
  }

  return packages;
}

/** True when the path exists and is a directory; false for anything else. */
export function isDirectory(absPath) {
  try {
    return fs.statSync(absPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Expand a simple pnpm-workspace glob (e.g. `apps/*`, `packages/*`, exact paths)
 * against the filesystem into workspace-relative directory paths. `*` and `**`
 * match immediate child directories.
 */
export function expandWorkspaceGlob(glob, cwd) {
  const segments = normalizeDir(glob).split("/").filter(Boolean);
  let candidates = [""];

  for (const segment of segments) {
    const next = [];
    for (const base of candidates) {
      const absBase = path.join(cwd, base);
      if (segment === "*" || segment === "**") {
        let entries = [];
        try {
          entries = fs.readdirSync(absBase, { withFileTypes: true });
        } catch {
          entries = [];
        }
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith(".")) {
            next.push(base ? `${base}/${entry.name}` : entry.name);
          }
        }
      } else {
        const candidate = base ? `${base}/${segment}` : segment;
        if (isDirectory(path.join(cwd, candidate))) {
          next.push(candidate);
        }
      }
    }
    candidates = next;
  }

  return candidates;
}
