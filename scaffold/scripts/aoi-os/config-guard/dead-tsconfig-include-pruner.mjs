/**
 * scripts/aoi-os/config-guard/dead-tsconfig-include-pruner.mjs
 *
 * Deterministic Dead Workspace TypeScript Include Path Pruner for AOI-OS:
 * Statically audits "include" glob pattern entries in tsconfig.json against existing workspace
 * directory structures to prune dead or non-matching include patterns before tsc compilation (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json "include" patterns against valid existing directories/files.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @param {string[]} existingFilesAndDirs - Array of valid relative files and directories
 * @returns {object} TS include path audit report
 */
export function auditDeadTsconfigIncludes(tsconfigJson = {}, existingFilesAndDirs = []) {
  const deadIncludes = []
  const includePatterns = Array.isArray(tsconfigJson.include) ? tsconfigJson.include : []
  const normalizedExisting = new Set(
    existingFilesAndDirs.map((p) => p.replace(/^\.\//, '').replace(/\/+$/, ''))
  )

  for (const pattern of includePatterns) {
    if (typeof pattern === 'string') {
      const cleanPattern = pattern.replace(/^\.\//, '')
      const rootDir = cleanPattern.split('/')[0].replace(/\*.*$/, '')

      // Check if root directory or literal file exists in workspace
      let matchesAny = false
      if (rootDir === '' || normalizedExisting.has(cleanPattern)) {
        matchesAny = true
      } else {
        for (const item of normalizedExisting) {
          if (item === rootDir || item.startsWith(`${rootDir}/`)) {
            matchesAny = true
            break
          }
        }
      }

      if (!matchesAny) {
        deadIncludes.push({
          pattern,
          error: 'ORPHAN_TSCONFIG_INCLUDE_GLOB',
          recommendation: `TypeScript include pattern '${pattern}' does not match any existing workspace directory. Prune from 'include'.`,
        })
      }
    }
  }

  const clean = deadIncludes.length === 0

  return {
    clean,
    deadCount: deadIncludes.length,
    deadIncludes,
    includeProof: clean ? 'TSCONFIG_INCLUDE_PATHS_CANONICAL' : 'DEAD_TSCONFIG_INCLUDES_DETECTED',
  }
}
