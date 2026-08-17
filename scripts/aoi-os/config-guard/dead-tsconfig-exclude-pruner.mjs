/**
 * scripts/aoi-os/config-guard/dead-tsconfig-exclude-pruner.mjs
 *
 * Deterministic Dead TypeScript Exclude Pattern Pruner for AOI-OS:
 * Statically audits compilerOptions/manifest "exclude" globs in tsconfig.json against existing workspace files and folders
 * to prune obsolete or redundant exclude patterns that degrade TypeScript initial scan performance (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json "exclude" patterns against existing workspace directory paths.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @param {string[]} existingFilesAndDirs - Array of existing file/directory relative paths
 * @returns {object} TS exclude patterns audit report
 */
export function auditDeadTsconfigExcludes(tsconfigJson = {}, existingFilesAndDirs = []) {
  const deadExcludes = []
  const excludeList = Array.isArray(tsconfigJson.exclude) ? tsconfigJson.exclude : []
  const normalizedExisting = new Set(existingFilesAndDirs.map((p) => p.replace(/^\.\//, '').replace(/\/\*$/, '').replace(/\/$/, '')))

  for (const pattern of excludeList) {
    if (typeof pattern === 'string') {
      const cleanPattern = pattern.replace(/^\.\//, '').replace(/\/\*+$/, '').replace(/\/\*\*\/.*$/, '').replace(/\/$/, '')

      if (cleanPattern && cleanPattern !== 'node_modules' && !normalizedExisting.has(cleanPattern)) {
        const matchesAny = existingFilesAndDirs.some((f) => f.startsWith(cleanPattern))
        if (!matchesAny) {
          deadExcludes.push({
            pattern,
            error: 'NON_MATCHING_TSCONFIG_EXCLUDE_PATTERN',
            recommendation: `Exclude pattern '${pattern}' does not match any existing file or directory in workspace. Prune from tsconfig.json exclude to optimize scan time.`,
          })
        }
      }
    }
  }

  const clean = deadExcludes.length === 0

  return {
    clean,
    deadCount: deadExcludes.length,
    deadExcludes,
    excludeProof: clean ? 'TSCONFIG_EXCLUDE_PATTERNS_CANONICAL' : 'DEAD_TSCONFIG_EXCLUDES_DETECTED',
  }
}
