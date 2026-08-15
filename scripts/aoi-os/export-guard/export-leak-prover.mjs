/**
 * scripts/aoi-os/export-guard/export-leak-prover.mjs
 *
 * Deterministic Package Boundary & Export Leak Prover for AOI-OS:
 * Statically audits import specifiers across monorepo package boundaries,
 * proving zero unauthorized deep imports into internal/private package modules (0 LLM Tokens).
 */

/**
 * Audits source code for unauthorized deep imports into internal sub-paths.
 *
 * @param {string} sourceCode
 * @param {string[]} [protectedInternalPackages=[]] - e.g. ['@workspace/core', 'aoi-os']
 * @returns {object} Boundary leak report
 */
export function auditExportLeaks(sourceCode = '', protectedInternalPackages = []) {
  const leaks = []
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g

  let match
  while ((match = importRegex.exec(sourceCode)) !== null) {
    const importPath = match[1]

    for (const pkg of protectedInternalPackages) {
      if (importPath.startsWith(`${pkg}/internal`) || importPath.startsWith(`${pkg}/private`)) {
        leaks.push({
          importPath,
          package: pkg,
          type: 'UNAUTHORIZED_INTERNAL_DEEP_IMPORT',
          recommendation: `Import public symbols directly from '${pkg}' barrel root instead of '${importPath}'`,
        })
      }
    }
  }

  const hermetic = leaks.length === 0

  return {
    hermetic,
    leaksCount: leaks.length,
    leaks,
    boundaryProof: hermetic ? 'PACKAGE_BOUNDARIES_HERMETIC' : 'EXPORT_LEAK_VIOLATION_DETECTED',
  }
}
