#!/usr/bin/env node
/**
 * scripts/scaffold/validate-scaffold-tracked.mjs
 *
 * Principle I says the scaffold mirrors the governed tree. `validate-scaffold-parity`
 * proves that on disk — and disk is not what ships. What ships is what git carries.
 *
 * The two diverge because of `scaffold/.gitignore`. That file is payload: it is
 * the `.gitignore` an installed workspace ends up with, and there it is right to
 * ignore `aoi_apps/`, `scripts/`, `docs/`, `CLAUDE.md` and the rest, because in a
 * workspace those are AOI's, not the Owner's. But it also sits inside this
 * repository, where git reads it and applies it to `scaffold/` itself. The mirror
 * files committed before it existed survive, since a tracked file outranks an
 * ignore rule. Every mirror file added AFTER it is ignored in silence.
 *
 * Nothing catches that. Parity walks the filesystem and sees the mirror present.
 * `git status` stays clean because the file is ignored, not untracked-and-noisy.
 * The commit looks complete, and a clone gets a scaffold with a hole in it. It
 * had already happened twice before this gate existed: `sync-paths.mjs` and
 * `governed-paths.mjs` — the modules `validate-scaffold-parity` and
 * `validate-srp` import — were mirrored on disk and absent from HEAD. Local
 * installs kept working by accident, because the installer copies the working
 * tree, which still had them; a fresh clone would have shipped a scaffold whose
 * own parity gate could not load.
 *
 * So this gate asks the question parity cannot: of every governed file, on both
 * sides, is it in the index? Staging is enough — the question is whether the
 * file will ship, not whether it is already committed.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { DEFAULT_SYNC_PATHS } from './sync-paths.mjs'
import { collectFilePaths, parityPathsForProfile, SYMLINK_MARKER } from './validate-scaffold-parity.mjs'

/**
 * Every path in the index, as git spells it — forward slashes, repo-relative.
 *
 * `git ls-files` reads the index rather than HEAD on purpose: a file staged in
 * this change is going to ship, and failing the gate on it would make the gate
 * unpassable in the same commit that fixes it.
 */
export function trackedFiles(repoRoot) {
  const stdout = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, maxBuffer: 1 << 28 })
  return new Set(stdout.toString('utf8').split('\0').filter(Boolean))
}

/** git speaks posix separators in `ls-files`; the walkers speak the platform's. */
function asGitPath(relativePath) {
  return relativePath.split(path.sep).join('/')
}

/**
 * Collects the governed files under one side of the mirror, as git paths.
 * Symlinks are skipped: parity already refuses them, and reporting the same
 * file under two gates buries the one that matters.
 */
function governedFilesUnder(repoRoot, prefix) {
  const base = path.join(repoRoot, prefix)
  if (!fs.existsSync(base)) return []

  return collectFilePaths(base)
    .filter((relativePath) => !relativePath.endsWith(SYMLINK_MARKER))
    .map((relativePath) => asGitPath(path.join(prefix, relativePath)))
}

/**
 * @param {string} repoRoot
 * @param {string[]} [pathsToCheck]
 * @param {(repoRoot: string) => Set<string>} [listTracked] — seam for the tests
 * @returns {{ valid: boolean, errors: string[], checkedFilesCount: number, sourceRepo: boolean }}
 */
export function auditScaffoldTracking(repoRoot, pathsToCheck = DEFAULT_SYNC_PATHS, listTracked = trackedFiles) {
  // The same guard parity carries, for the same reason: `scaffold/` is a payload
  // only in the repository that ships it. An installed workspace has no mirror
  // to track, and judging it here would turn its suite red over AOI's concern.
  if (!fs.existsSync(path.join(repoRoot, 'setup.sh'))) {
    return { valid: true, errors: [], checkedFilesCount: 0, sourceRepo: false }
  }

  const tracked = listTracked(repoRoot)
  const errors = []
  let checkedFilesCount = 0

  for (const subpath of parityPathsForProfile(repoRoot, pathsToCheck)) {
    const sides = [subpath, path.join('scaffold', subpath)]

    for (const prefix of sides) {
      for (const gitPath of governedFilesUnder(repoRoot, prefix)) {
        checkedFilesCount++
        if (!tracked.has(gitPath)) {
          errors.push(`[UNTRACKED_GOVERNED_FILE] ${gitPath} exists on disk but is not in the git index — it will not ship`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, checkedFilesCount, sourceRepo: true }
}

function main() {
  const repoRoot = process.cwd()
  const result = auditScaffoldTracking(repoRoot)

  if (!result.sourceRepo) {
    process.stdout.write('✅ Scaffold Tracking: workspace instalado; no hay espejo que versionar.\n')
    return
  }

  if (!result.valid) {
    process.stderr.write(`❌ Scaffold Tracking FAILED (${result.errors.length} violations):\n`)
    for (const error of result.errors) {
      process.stderr.write(`   - ${error}\n`)
    }
    process.stderr.write('\n   scaffold/.gitignore también rige dentro de este repo. Un espejo nuevo necesita `git add -f`.\n')
    process.exit(1)
  }

  process.stdout.write(`✅ Scaffold Tracking OK: ${result.checkedFilesCount} archivos gobernados están en el índice.\n`)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
