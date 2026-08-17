/**
 * scripts/aoi-os/export-guard/dead-barrel-duplicate-pruner.mjs
 *
 * Deterministic Dead Barrel Duplicate Re-Export Pruner for AOI-OS:
 * Statically audits barrel index files (index.ts, index.mjs) to detect duplicate re-exported symbols
 * and redundant duplicate export statements that degrade tree-shaking and module resolution (0 LLM Tokens).
 */

/**
 * Audits barrel source code for duplicate symbol exports.
 *
 * @param {string} sourceCode - Barrel index source code
 * @returns {object} Barrel export audit report
 */
export function auditDeadBarrelDuplicates(sourceCode = '') {
  const duplicateExports = []
  const exportedSymbols = new Map()

  // Match named export statements: export { a, b, c as d } from '...'
  const namedExportMatches = sourceCode.matchAll(/export\s*\{([^}]+)\}(?:\s*from\s*['"][^'"]+['"])?/g)

  for (const match of namedExportMatches) {
    const rawList = match[1]
    const symbols = rawList.split(',').map((s) => s.trim()).filter(Boolean)

    for (const rawSymbol of symbols) {
      // Handle alias: foo as bar -> exported name is bar
      const parts = rawSymbol.split(/\s+as\s+/)
      const exportedName = parts.length > 1 ? parts[1].trim() : parts[0].trim()

      if (exportedSymbols.has(exportedName)) {
        duplicateExports.push({
          symbol: exportedName,
          error: 'DUPLICATE_BARREL_EXPORT',
          recommendation: `Symbol '${exportedName}' is re-exported multiple times in the same barrel file. Remove redundant export.`,
        })
      } else {
        exportedSymbols.set(exportedName, true)
      }
    }
  }

  const clean = duplicateExports.length === 0

  return {
    clean,
    totalExportedCount: exportedSymbols.size,
    duplicateCount: duplicateExports.length,
    duplicateExports,
    barrelProof: clean ? 'BARREL_EXPORTS_DEDUPLICATED' : 'DUPLICATE_BARREL_EXPORTS_DETECTED',
  }
}
