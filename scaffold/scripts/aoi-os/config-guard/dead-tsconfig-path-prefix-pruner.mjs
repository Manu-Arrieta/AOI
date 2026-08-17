/**
 * scripts/aoi-os/config-guard/dead-tsconfig-path-prefix-pruner.mjs
 *
 * Deterministic Dead TypeScript Path Mapping Prefix Pruner for AOI-OS:
 * Statically audits compilerOptions.paths mappings in tsconfig.json against existing filesystem directories
 * to prune dead or non-existent path alias targets that cause resolution ambiguities or LSP slow-downs (0 LLM Tokens).
 */

/**
 * Audits tsconfig.json compilerOptions.paths against existing directories/paths in workspace.
 *
 * @param {object} tsconfigJson - Parsed tsconfig.json object
 * @param {string[]} existingDirPaths - Array of existing directory relative paths in workspace (e.g. ['src/core', 'src/components'])
 * @returns {object} TS paths prefix audit report
 */
export function auditDeadTsconfigPathPrefixes(tsconfigJson = {}, existingDirPaths = []) {
  const deadPaths = []
  const pathsMap = tsconfigJson?.compilerOptions?.paths || {}
  const normalizedExisting = new Set(existingDirPaths.map((p) => p.replace(/^\.\//, '').replace(/\/\*$/, '').replace(/\/$/, '')))

  for (const [alias, targets] of Object.entries(pathsMap)) {
    const targetList = Array.isArray(targets) ? targets : [targets]
    for (const target of targetList) {
      if (typeof target === 'string') {
        const cleanTarget = target.replace(/^\.\//, '').replace(/\/\*$/, '').replace(/\/$/, '')
        if (cleanTarget && !normalizedExisting.has(cleanTarget)) {
          deadPaths.push({
            alias,
            target,
            error: 'NON_EXISTENT_TSCONFIG_PATH_TARGET',
            recommendation: `Path alias target '${target}' for alias '${alias}' points to a non-existent directory. Create the target directory or prune from tsconfig.json paths.`,
          })
        }
      }
    }
  }

  const clean = deadPaths.length === 0

  return {
    clean,
    deadCount: deadPaths.length,
    deadPaths,
    pathsProof: clean ? 'TSCONFIG_PATH_MAPPINGS_CANONICAL' : 'DEAD_TSCONFIG_PATH_PREFIXES_DETECTED',
  }
}
