/**
 * scripts/aoi-os/package-guard/dead-package-export-condition-pruner.mjs
 *
 * Deterministic Dead Package Export Condition Pruner for AOI-OS:
 * Statically audits package.json conditional exports (import, require, types, default) against
 * actual existing files in the package/workspace to detect dead or broken export mappings (0 LLM Tokens).
 */

/**
 * Audits package.json conditional export maps against valid files.
 *
 * @param {object} packageJson - Parsed package.json object
 * @param {string[]} existingFiles - Array of valid relative file paths in package
 * @returns {object} Export conditions audit report
 */
export function auditDeadPackageExportConditions(packageJson = {}, existingFiles = []) {
  const deadExportConditions = []
  const exportsField = packageJson.exports || {}
  const validSet = new Set(existingFiles.map((f) => f.replace(/^\.\//, '')))

  function traverseExports(exportMap, subpath = '.') {
    if (typeof exportMap === 'string') {
      const normalized = exportMap.replace(/^\.\//, '')
      if (!validSet.has(normalized)) {
        deadExportConditions.push({
          subpath,
          target: exportMap,
          error: 'ORPHAN_EXPORT_TARGET_FILE',
          recommendation: `Export target '${exportMap}' for subpath '${subpath}' does not exist. Update or prune condition.`,
        })
      }
    } else if (typeof exportMap === 'object' && exportMap !== null) {
      for (const [key, value] of Object.entries(exportMap)) {
        traverseExports(value, subpath === '.' ? key : `${subpath}/${key}`)
      }
    }
  }

  traverseExports(exportsField)

  const clean = deadExportConditions.length === 0

  return {
    clean,
    deadCount: deadExportConditions.length,
    deadExportConditions,
    exportConditionProof: clean ? 'PACKAGE_EXPORT_CONDITIONS_CANONICAL' : 'DEAD_EXPORT_CONDITIONS_DETECTED',
  }
}
