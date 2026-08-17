/**
 * scripts/aoi-os/package-guard/dead-package-bin-pruner.mjs
 *
 * Deterministic Dead Monorepo Workspace Binary Pruner for AOI-OS:
 * Statically audits package.json "bin" executable entrypoints against existing files
 * in the package/monorepo to detect dead or broken binary mappings before publishing or linking (0 LLM Tokens).
 */

/**
 * Audits package.json "bin" entrypoints against valid files.
 *
 * @param {object} packageJson - Parsed package.json object
 * @param {string[]} existingFiles - Array of valid relative file paths in package
 * @returns {object} Binary entrypoints audit report
 */
export function auditDeadPackageBinaries(packageJson = {}, existingFiles = []) {
  const deadBinaries = []
  const binField = packageJson.bin || {}
  const validSet = new Set(existingFiles.map((f) => f.replace(/^\.\//, '')))

  if (typeof binField === 'string') {
    const normalized = binField.replace(/^\.\//, '')
    if (!validSet.has(normalized)) {
      deadBinaries.push({
        binName: packageJson.name || 'default',
        target: binField,
        error: 'ORPHAN_BINARY_TARGET_FILE',
        recommendation: `Binary target '${binField}' does not exist. Update or prune "bin" field.`,
      })
    }
  } else if (typeof binField === 'object' && binField !== null) {
    for (const [binName, target] of Object.entries(binField)) {
      if (typeof target === 'string') {
        const normalized = target.replace(/^\.\//, '')
        if (!validSet.has(normalized)) {
          deadBinaries.push({
            binName,
            target,
            error: 'ORPHAN_BINARY_TARGET_FILE',
            recommendation: `Binary target '${target}' for command '${binName}' does not exist. Update or prune entry.`,
          })
        }
      }
    }
  }

  const clean = deadBinaries.length === 0

  return {
    clean,
    deadCount: deadBinaries.length,
    deadBinaries,
    binaryProof: clean ? 'PACKAGE_BINARIES_CANONICAL' : 'DEAD_PACKAGE_BINARIES_DETECTED',
  }
}
