/**
 * scripts/aoi-os/security-guard/supply-chain-dependency-guard.mjs
 *
 * Deterministic Supply Chain and Dependency Security Guard for AOI-OS:
 * Statically audits package.json manifests for suspicious install lifecycle scripts (preinstall/postinstall),
 * typosquatting name heuristics, and non-permissive license risks with zero LLM token overhead (0 LLM Tokens).
 */

const SUSPICIOUS_INSTALL_HOOKS = ['preinstall', 'postinstall', 'install', 'preuninstall', 'postuninstall']

const POPULAR_PACKAGES = ['express', 'lodash', 'react', 'vue', 'axios', 'typescript', 'vitest', 'zod', 'pinia', 'nuxt']

const RESTRICTIVE_LICENSES = ['GPL', 'AGPL', 'SSPL', 'Commons Clause']

/**
 * Calculates simple Levenshtein distance between two strings for typosquatting detection.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function calculateLevenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[a.length][b.length]
}

/**
 * Audits a parsed package.json manifest for supply chain security risks.
 *
 * @param {object} packageJson - Parsed package.json manifest
 * @returns {object} Supply chain audit report
 */
export function auditSupplyChainSecurity(packageJson = {}) {
  const scripts = packageJson.scripts || {}
  const dependencies = Object.keys(packageJson.dependencies || {})
  const devDependencies = Object.keys(packageJson.devDependencies || {})
  const allDeps = [...dependencies, ...devDependencies]
  const license = packageJson.license || 'UNLICENSED'

  const violations = []
  const warnings = []

  // 1. Check for suspicious install lifecycle scripts
  for (const hook of SUSPICIOUS_INSTALL_HOOKS) {
    if (scripts[hook]) {
      const scriptContent = scripts[hook]
      if (/curl|wget|bash\s+-c|sh\s+-c|eval|base64\s+-d/i.test(scriptContent)) {
        violations.push(`SUSPICIOUS_REMOTE_EXECUTION_IN_INSTALL_HOOK: '${hook}' -> '${scriptContent}'`)
      } else {
        warnings.push(`EXPLICIT_LIFECYCLE_INSTALL_HOOK: '${hook}' is defined`)
      }
    }
  }

  // 2. Typosquatting heuristic detection
  for (const dep of allDeps) {
    for (const pop of POPULAR_PACKAGES) {
      if (dep !== pop) {
        const dist = calculateLevenshteinDistance(dep, pop)
        if (dist === 1 && dep.length > 3) {
          violations.push(`POSSIBLE_TYPOSQUATTING_PACKAGE: '${dep}' is 1 edit away from popular package '${pop}'`)
        }
      }
    }
  }

  // 3. License audit
  for (const rest of RESTRICTIVE_LICENSES) {
    if (typeof license === 'string' && license.toUpperCase().includes(rest)) {
      warnings.push(`RESTRICTIVE_OR_COPYLEFT_LICENSE_DETECTED: '${license}' contains '${rest}'`)
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    violations,
    warnings,
    dependencyCount: allDeps.length,
    supplyChainProof: safe
      ? 'SUPPLY_CHAIN_SECURITY_VERIFIED'
      : 'SUPPLY_CHAIN_SECURITY_RISK_DETECTED',
  }
}
