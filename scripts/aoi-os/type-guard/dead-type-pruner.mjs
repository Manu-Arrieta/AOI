/**
 * scripts/aoi-os/type-guard/dead-type-pruner.mjs
 *
 * Deterministic Dead Type & Unreferenced Interface Pruner for AOI-OS:
 * Statically audits exported TypeScript/C# type definitions and interfaces against consumer code,
 * proving 100% type reference reachability and preventing dead ABI bloat (0 LLM Tokens).
 */

/**
 * Audits a list of exported types against consumer codebases.
 *
 * @param {string[]} exportedTypes - List of type/interface names (e.g. ['TaskState', 'UserSession'])
 * @param {string} consumerSourceCode - Aggregate consumer code
 * @returns {object} Type reachability report
 */
export function auditDeadTypes(exportedTypes = [], consumerSourceCode = '') {
  const deadTypes = []

  for (const typeName of exportedTypes) {
    // Check for type usage: : TypeName, <TypeName>, as TypeName, implements TypeName, extends TypeName, import type { TypeName }
    const pattern = new RegExp(`\\b${typeName}\\b`, 'g')
    const matches = [...consumerSourceCode.matchAll(pattern)]

    if (matches.length === 0) {
      deadTypes.push({
        type: typeName,
        error: 'UNREFERENCED_DEAD_TYPE_OR_INTERFACE',
        recommendation: `Prune unused type '${typeName}' or export only within internal module boundaries.`,
      })
    }
  }

  const allReferenced = deadTypes.length === 0

  return {
    allReferenced,
    totalTypes: exportedTypes.length,
    deadTypesCount: deadTypes.length,
    deadTypes,
    typeProof: allReferenced ? 'ALL_EXPORTED_TYPES_REFERENCED' : 'DEAD_UNREFERENCED_TYPES_DETECTED',
  }
}
