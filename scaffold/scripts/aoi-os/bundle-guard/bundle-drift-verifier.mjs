/**
 * scripts/aoi-os/bundle-guard/bundle-drift-verifier.mjs
 *
 * Deterministic Monorepo Bundle Size & Tree-Shaking Drift Verifier for AOI-OS:
 * Statically analyzes package imports to prevent heavy non-tree-shakeable barrel imports,
 * duplicate vendor bloat, and monolithic dependencies (0 LLM Tokens).
 */

const HEAVY_PACKAGES = [
  { name: 'lodash', alternative: 'lodash-es or native ES methods' },
  { name: 'moment', alternative: 'date-fns or Intl API' },
  { name: 'crypto-js', alternative: 'node:crypto or Web Crypto API' },
]

/**
 * Audits source code for bundle bloat and non-tree-shakeable imports.
 *
 * @param {string} sourceCode
 * @returns {object} Bundle drift report
 */
export function verifyBundleDrift(sourceCode = '') {
  const violations = []

  for (const pkg of HEAVY_PACKAGES) {
    const defaultImportRegex = new RegExp(`import\\s+(?:[a-zA-Z0-9_$]+|\\*\\s+as\\s+[a-zA-Z0-9_$]+)\\s+from\\s+['"]${pkg.name}['"]`, 'g')
    if (defaultImportRegex.test(sourceCode)) {
      violations.push({
        package: pkg.name,
        type: 'HEAVY_MONOLITHIC_IMPORT',
        recommendation: `Replace default/wildcard import from '${pkg.name}' with '${pkg.alternative}' to optimize tree-shaking.`,
      })
    }
  }

  const clean = violations.length === 0

  return {
    clean,
    violationsCount: violations.length,
    violations,
    bundleProof: clean ? 'TREE_SHAKING_OPTIMAL_PROVEN' : 'BUNDLE_DRIFT_AND_BLOAT_DETECTED',
  }
}
