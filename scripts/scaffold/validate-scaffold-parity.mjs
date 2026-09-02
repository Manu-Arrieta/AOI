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
  'scripts/memory-sync',
  'scripts/sdd-lifecycle',
  'scripts/mcp-gateway',
  'scripts/spatiotemporal-runtime',
  'scripts/multi-harness',
  'scripts/aoi-doctor.mjs',
  'scripts/aoi-doctor.test.mjs',
  'package.json',
  'pnpm-workspace.yaml',
  '.tasks/registry.md',
  '.resources/constitution.md',
  'AOI_REAL_WORLD_VERIFICATION_MATRIX.md',
  'CLAUDE.md',
  'AGENTS.md',
  '.cursorrules',
  '.clinerules',
  '.cursor/rules',
  '.agents/rules',
  'aoi_apps/agentic-ops-dashboard/app',
  'aoi_apps/agentic-ops-dashboard/server',
  'aoi_apps/agentic-ops-dashboard/shared',
  'aoi_apps/agentic-ops-dashboard/test',
]

/**
 * Recursively collects all relative file paths inside a directory or single file.
 * @param {string} baseDir
 * @param {string} [relDir='']
 * @returns {string[]}
 */
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
export function validateScaffoldParity(repoRoot, pathsToCheck = DEFAULT_SYNC_PATHS) {
  const errors = []
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

    const rootFiles = new Set(collectFilePaths(rootPath))
    const scaffoldFiles = new Set(collectFilePaths(scaffoldPath))

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
