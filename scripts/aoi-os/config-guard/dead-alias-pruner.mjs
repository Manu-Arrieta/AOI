/**
 * scripts/aoi-os/config-guard/dead-alias-pruner.mjs
 *
 * Deterministic Dead Config Path Alias & Monorepo Import Pruner for AOI-OS:
 * Statically audits module and path aliases declared in tsconfig.json / vite.config.ts
 * against consumer codebases to detect unused, orphan, or dead path aliases (0 LLM Tokens).
 */

/**
 * Audits a list of configured aliases against consumer imports.
 *
 * @param {string[]} declaredAliases - Array of declared alias prefixes (e.g., ['@components', '@utils'])
 * @param {string} consumerCodebase - Monorepo source code containing import statements
 * @returns {object} Alias audit report
 */
export function auditDeadConfigAliases(declaredAliases = [], consumerCodebase = '') {
  const deadAliases = []

  for (const rawAlias of declaredAliases) {
    const cleanAlias = rawAlias.replace(/\/\*$/, '')
    const escaped = cleanAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`['"]${escaped}[/'"]`, 'i')

    if (!regex.test(consumerCodebase)) {
      deadAliases.push({
        alias: rawAlias,
        error: 'ORPHAN_CONFIG_ALIAS',
        recommendation: `Path alias '${rawAlias}' is never imported in the codebase. Remove from tsconfig.json / vite.config.ts.`,
      })
    }
  }

  const clean = deadAliases.length === 0

  return {
    clean,
    totalDeclared: declaredAliases.length,
    deadCount: deadAliases.length,
    deadAliases,
    aliasProof: clean ? 'CONFIG_ALIASES_CANONICAL' : 'DEAD_CONFIG_ALIASES_DETECTED',
  }
}
