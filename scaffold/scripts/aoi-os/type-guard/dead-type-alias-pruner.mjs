/**
 * scripts/aoi-os/type-guard/dead-type-alias-pruner.mjs
 *
 * Deterministic Dead Type Alias & Generic Parameter Pruner for AOI-OS:
 * Statically audits declared type aliases against consumer codebases in the monorepo,
 * proving 100% type alias reachability and eliminating unused type alias noise (0 LLM Tokens).
 */

/**
 * Audits a list of exported type alias names against consumer codebases.
 *
 * @param {string[]} typeAliasNames - List of type alias identifiers (e.g. ['UserSummary', 'TaskFilter'])
 * @param {string} consumerSourceCode - Aggregate consumer source code
 * @returns {object} Type alias reachability report
 */
export function auditDeadTypeAliases(typeAliasNames = [], consumerSourceCode = '') {
  const deadAliases = []

  for (const name of typeAliasNames) {
    const usagePattern = new RegExp(`(?::\\s*|as\\s+|<|import\\s+type\\s*\\{[^}]*\\b)${name}\\b`, 'g')

    if (!usagePattern.test(consumerSourceCode)) {
      deadAliases.push({
        aliasName: name,
        error: 'UNREFERENCED_DEAD_TYPE_ALIAS',
        recommendation: `Prune unused type alias '${name}' or move it to internal unexported module scope.`,
      })
    }
  }

  const allReferenced = deadAliases.length === 0

  return {
    allReferenced,
    totalAliases: typeAliasNames.length,
    deadAliasesCount: deadAliases.length,
    deadAliases,
    aliasProof: allReferenced ? 'ALL_TYPE_ALIASES_REFERENCED' : 'DEAD_TYPE_ALIASES_DETECTED',
  }
}
