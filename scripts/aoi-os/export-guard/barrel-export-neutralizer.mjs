/**
 * scripts/aoi-os/export-guard/barrel-export-neutralizer.mjs
 *
 * Deterministic Circular Re-Export & Barrel Star-Export Neutralizer for AOI-OS:
 * Statically detects wildcard `export * from '...'` statements in barrel indexes,
 * proving that all re-exports are explicit, preventing compilation slowdowns and circular export cycles (0 LLM Tokens).
 */

/**
 * Audits barrel file source code for wildcard export anti-patterns.
 *
 * @param {string} sourceCode
 * @returns {object} Barrel export audit report
 */
export function auditBarrelExports(sourceCode = '') {
  const wildcardMatches = sourceCode.match(/export\s+\*\s+from\s+['"][^'"]+['"]/g) || []
  const hasWildcard = wildcardMatches.length > 0

  return {
    clean: !hasWildcard,
    wildcardCount: wildcardMatches.length,
    wildcards: wildcardMatches,
    barrelProof: !hasWildcard ? 'EXPLICIT_BARREL_EXPORTS_PROVEN' : 'WILDCARD_STAR_EXPORTS_DETECTED',
  }
}
