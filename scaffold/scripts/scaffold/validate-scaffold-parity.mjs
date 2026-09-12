#!/usr/bin/env node
/**
 * scripts/scaffold/validate-scaffold-parity.mjs
 *
 * Validates Principle I (Scaffold Mirror Integrity):
 * Ensures that all governed directories (.github/instructions, .github/agents,
 * .github/prompts, scripts/, dashboard components, server, shared) and governed
 * root files have 100% byte-for-byte parity between root and scaffold/.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const DEFAULT_SYNC_PATHS = [
  '.github/instructions',
  '.github/agents',
  '.github/prompts',
  'scripts/subagent-context',
  'scripts/sandbox',
  'scripts/scaffold',
  // Se envia a toda instalacion via scaffold/ pero no estaba gobernado: raiz y
  // espejo podian derivar sin que nada fallara, que es la misma forma del
  // protocolo duplicado que esta auditoria encontro divergido.
  'scripts/code-lens',
  'scripts/memory-sync',
  'scripts/sdd-lifecycle',
  'scripts/mcp-gateway',
  'scripts/spatiotemporal-runtime',
  'scripts/multi-harness',
  'scripts/aoi-doctor.mjs',
  'scripts/aoi-doctor.test.mjs',
  'LICENSE',
  'package.json',
  'pnpm-workspace.yaml',
  '.resources/constitution.md',
  'AOI_REAL_WORLD_VERIFICATION_MATRIX.md',
  'CLAUDE.md',
  'AGENTS.md',
  '.cursorrules',
  '.clinerules',
  '.cursor/rules',
  '.agents/rules',
  '.agents/skills',
  '.github/scripts',
  '.github/skills',
  // The guard is copied into the target twice — by rsync from the scaffold
  // and by an explicit `cp` from the repository root — so an ungoverned
  // mirror lets the two drift and the winner is whichever ran last.
  '.githooks',
  'scripts/aoi-headroom-wrap.sh',
  'scripts/aoi-headroom-wrap.ps1',
  'aoi_apps/agentic-ops-dashboard/app',
  'aoi_apps/agentic-ops-dashboard/server',
  'aoi_apps/agentic-ops-dashboard/shared',
  'aoi_apps/agentic-ops-dashboard/test',
  'aoi_apps/agentic-ops-dashboard/tsconfig.json',
]

/**
 * Recursively collects all relative file paths inside a directory or single file.
 * @param {string} baseDir
 * @param {string} [relDir='']
 * @returns {string[]}
 */
/** Suffix that marks a collected entry as a symlink rather than a regular file. */
export const SYMLINK_MARKER = ' [symlink]'

export function collectFilePaths(baseDir, relDir = '') {
  const currentDir = path.join(baseDir, relDir)
  if (!fs.existsSync(currentDir)) return []

  const stat = fs.statSync(currentDir)
  if (stat.isFile()) {
    return ['']
  }

  const entries = fs.readdirSync(currentDir, { withFileTypes: true })
  let files = []

  for (const entry of entries) {
    if (
      entry.name.startsWith('.DS_Store') ||
      entry.name.startsWith('.git') ||
      entry.name === '.nuxt' ||
      entry.name === 'node_modules' ||
      entry.name === '.output'
    ) {
      continue
    }
    const relativePath = path.join(relDir, entry.name)

    if (entry.isDirectory()) {
      files = files.concat(collectFilePaths(baseDir, relativePath))
    } else if (entry.isFile()) {
      files.push(relativePath)
    } else if (entry.isSymbolicLink()) {
      // Neither a file nor a directory to `readdirSync`, so it used to be
      // dropped in silence. On one side only that surfaces as an
      // EXTRA_IN_SCAFFOLD, which is noisy but honest; on BOTH sides the two
      // trees look identical because neither contains the path at all, and a
      // governed file pointing anywhere on the filesystem ships to every
      // workspace unremarked.
      //
      // A governed file is a regular file. Collecting the link under a
      // reserved marker makes the comparison see it and report it.
      files.push(`${relativePath}${SYMLINK_MARKER}`)
    }
  }

  return files
}

/**
 * Verifies parity for a list of relative directory paths or files between root and scaffold.
 *
 * @param {string} repoRoot
 * @param {string[]} pathsToCheck
 * @returns {{ valid: boolean, errors: string[], checkedFilesCount: number }}
 */
/**
 * Things that must never live inside the scaffold.
 *
 * The scaffold is what gets installed into a workspace, so the installer has
 * no business being in it, and neither has a nested copy of the scaffold.
 */
export const FORBIDDEN_IN_SCAFFOLD = ['setup.sh', 'scaffold', '.git', 'node_modules']

/**
 * Catches a file that has no business being in the scaffold at all.
 *
 * Parity compares the paths it is told to compare, so anything outside
 * `DEFAULT_SYNC_PATHS` is invisible to it — it can prove that governed files
 * match, never that an ungoverned one snuck in. A stray `cp setup.sh
 * scaffold/` therefore passed parity twice while quietly installing the
 * installer into every workspace, where its presence flips `validate-srp` and
 * `validate-test-globs` into development-repository mode and turns the whole
 * suite red for reasons that point nowhere near the cause.
 *
 * @returns {string[]} errors
 */
export function validateScaffoldContents(repoRoot, forbidden = FORBIDDEN_IN_SCAFFOLD) {
  const scaffoldDir = path.join(repoRoot, 'scaffold')
  if (!fs.existsSync(scaffoldDir)) return []

  const errors = forbidden
    .filter((name) => fs.existsSync(path.join(scaffoldDir, name)))
    .map((name) => `[FORBIDDEN_IN_SCAFFOLD] scaffold/${name} must not be shipped into a workspace`)

  // The denylist above names things that DO exist at the repo root and still
  // must not ship. This catches the general case it cannot: an entry at the
  // scaffold root with no counterpart at the repo root got there by accident.
  //
  // It happened twice in one audit, both times from a careless `cp x
  // scaffold/` that landed at the top instead of the mirrored subdirectory —
  // and parity reported OK both times, because it only walks the paths it is
  // told to walk. A file it was never told about is not a mismatch; it is
  // invisible.
  for (const entry of fs.readdirSync(scaffoldDir)) {
    if (entry === '.DS_Store' || forbidden.includes(entry)) continue
    if (fs.existsSync(path.join(repoRoot, entry))) continue
    errors.push(`[STRAY_IN_SCAFFOLD] scaffold/${entry} no tiene contraparte en la raíz — llegó por accidente`)
  }

  return errors
}

export function validateScaffoldParity(repoRoot, pathsToCheck = DEFAULT_SYNC_PATHS) {
  const errors = validateScaffoldContents(repoRoot)
  let checkedFilesCount = 0

  for (const subpath of pathsToCheck) {
    const rootPath = path.join(repoRoot, subpath)
    const scaffoldPath = path.join(repoRoot, 'scaffold', subpath)

    if (!fs.existsSync(rootPath)) {
      if (fs.existsSync(scaffoldPath)) {
        errors.push(`[ORPHAN_SCAFFOLD] Path exists in scaffold but not in root: ${subpath}`)
      }
      continue
    }

    if (!fs.existsSync(scaffoldPath)) {
      errors.push(`[MISSING_SCAFFOLD] Path exists in root but missing in scaffold: ${subpath}`)
      continue
    }

    // Symlinks are reported and then removed from the comparison. Leaving the
    // marked entry in would send `<path> [symlink]` to readFileSync and crash
    // the gate with an ENOENT trace instead of printing the violation — the
    // exact failure shape this gate exists to catch elsewhere.
    const collected = { root: collectFilePaths(rootPath), scaffold: collectFilePaths(scaffoldPath) }
    for (const [side, list] of Object.entries(collected)) {
      for (const link of list.filter((f) => f.endsWith(SYMLINK_MARKER))) {
        const clean = link.slice(0, -SYMLINK_MARKER.length)
        const where = side === 'root' ? subpath : path.join('scaffold', subpath)
        errors.push(`[SYMLINK_IN_GOVERNED_PATH] ${path.join(where, clean)} — un archivo gobernado debe ser un archivo regular`)
      }
    }

    const noLinks = (list) => list.filter((f) => !f.endsWith(SYMLINK_MARKER))
    const rootFiles = new Set(noLinks(collected.root))
    const scaffoldFiles = new Set(noLinks(collected.scaffold))

    // Check for files in root missing from scaffold
    for (const relFile of rootFiles) {
      checkedFilesCount++
      if (!scaffoldFiles.has(relFile)) {
        errors.push(`[MISSING_IN_SCAFFOLD] ${path.join(subpath, relFile)} is missing in scaffold/`)
        continue
      }

      const rootContent = fs.readFileSync(path.join(rootPath, relFile))
      const scaffoldContent = fs.readFileSync(path.join(scaffoldPath, relFile))

      if (!rootContent.equals(scaffoldContent)) {
        errors.push(`[CONTENT_MISMATCH] ${path.join(subpath, relFile)} differs between root and scaffold/`)
      }
    }

    // Check for files in scaffold missing from root
    for (const relFile of scaffoldFiles) {
      if (!rootFiles.has(relFile)) {
        errors.push(`[EXTRA_IN_SCAFFOLD] ${path.join('scaffold', subpath, relFile)} does not exist in root`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    checkedFilesCount,
  }
}

// CLI Execution
async function main() {
  const repoRoot = process.cwd()

  // The installer has to rebuild this mirror inside the target workspace, and
  // it must cover exactly the paths this gate judges. Hard-coding the list in
  // setup.sh would let the two drift, and the drift is invisible: the mirror
  // would simply stop matching for whatever path was added here and nowhere
  // else. So the list is published instead of duplicated.
  if (process.argv.includes('--list-paths')) {
    process.stdout.write(DEFAULT_SYNC_PATHS.join('\n') + '\n')
    return
  }

  const result = validateScaffoldParity(repoRoot)

  if (!result.valid) {
    process.stderr.write(`❌ Scaffold Mirror Parity FAILED (${result.errors.length} violations):\n`)
    for (const err of result.errors) {
      process.stderr.write(`   - ${err}\n`)
    }
    process.exit(1)
  }

  process.stdout.write(`✅ Scaffold Mirror Parity OK: ${result.checkedFilesCount} governed files verified byte-for-byte.\n`)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
