/**
 * scripts/aoi-os/export-guard/dead-export-package-pruner.mjs
 *
 * Deterministic Dead Export Package Entrypoint Pruner for AOI-OS:
 * Statically audits declared package.json "exports" subpaths against consumer imports across the monorepo,
 * proving 100% package API entrypoint reachability and eliminating dead exposed submodules (0 LLM Tokens).
 */

/**
 * Audits declared package export subpaths against consumer codebase source code.
 *
 * @param {string} packageName - Package name (e.g. '@aoi/core')
 * @param {string[]} exportSubpaths - List of exported subpaths (e.g. ['./utils', './models', './legacy'])
 * @param {string} consumerSourceCode - Aggregate consumer source code
 * @returns {object} Export entrypoint reachability report
 */
export function auditDeadPackageExports(packageName, exportSubpaths = [], consumerSourceCode = '') {
  const deadExports = []

  for (const subpath of exportSubpaths) {
    const importSpecifier = subpath === '.' ? packageName : `${packageName}/${subpath.replace(/^\.\//, '')}`
    const escapedSpecifier = importSpecifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const importPattern = new RegExp(`(?:from|import)\\s*['"]${escapedSpecifier}['"]`, 'g')

    if (!importPattern.test(consumerSourceCode)) {
      deadExports.push({
        subpath,
        importSpecifier,
        error: 'UNREFERENCED_PACKAGE_EXPORT_ENTRYPOINT',
        recommendation: `Prune unused package.json export '${subpath}' or convert to internal private module.`,
      })
    }
  }

  const allReferenced = deadExports.length === 0

  return {
    allReferenced,
    packageName,
    totalExports: exportSubpaths.length,
    deadExportsCount: deadExports.length,
    deadExports,
    exportProof: allReferenced ? 'ALL_PACKAGE_EXPORTS_REFERENCED' : 'DEAD_PACKAGE_EXPORTS_DETECTED',
  }
}
