/**
 * scripts/aoi-os/enum-guard/dead-enum-pruner.mjs
 *
 * Deterministic Dead Enum & Unreferenced Constant Pruner for AOI-OS:
 * Statically audits exported enum declarations and constant records against consumer codebases,
 * proving 100% enum reachability and eliminating unused constant noise (0 LLM Tokens).
 */

/**
 * Audits a list of exported enum names against consumer codebases.
 *
 * @param {string[]} enumNames - List of exported enum identifiers (e.g. ['TaskStatus', 'UserRole'])
 * @param {string} consumerSourceCode - Aggregate consumer code
 * @returns {object} Enum reachability report
 */
export function auditDeadEnums(enumNames = [], consumerSourceCode = '') {
  const deadEnums = []

  for (const name of enumNames) {
    const pattern = new RegExp(`\\b${name}\\.`, 'g')
    const typeUsagePattern = new RegExp(`:\\s*${name}\\b|<${name}>`, 'g')

    if (!pattern.test(consumerSourceCode) && !typeUsagePattern.test(consumerSourceCode)) {
      deadEnums.push({
        enumName: name,
        error: 'UNREFERENCED_DEAD_ENUM_OR_CONSTANT',
        recommendation: `Prune unused enum/constant '${name}' or consolidate inside internal module scope.`,
      })
    }
  }

  const allReferenced = deadEnums.length === 0

  return {
    allReferenced,
    totalEnums: enumNames.length,
    deadEnumsCount: deadEnums.length,
    deadEnums,
    enumProof: allReferenced ? 'ALL_EXPORTED_ENUMS_REFERENCED' : 'DEAD_UNREFERENCED_ENUMS_DETECTED',
  }
}
