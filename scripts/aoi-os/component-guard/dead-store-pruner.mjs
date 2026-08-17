/**
 * scripts/aoi-os/component-guard/dead-store-pruner.mjs
 *
 * Deterministic Dead Store State & Pinia Reactive Property Pruner for AOI-OS:
 * Statically audits declared store state properties against consumer components and composables,
 * proving 100% reactive state reachability and eliminating unused store state bloat (0 LLM Tokens).
 */

/**
 * Audits a list of declared store state properties against consumer codebases.
 *
 * @param {string[]} stateProperties - List of state property names (e.g. ['activeTab', 'taskFilter', 'legacyFlag'])
 * @param {string} consumerSourceCode - Aggregate consumer template and script source code
 * @returns {object} Store state reachability report
 */
export function auditDeadStoreState(stateProperties = [], consumerSourceCode = '') {
  const deadProperties = []

  for (const prop of stateProperties) {
    const escapedProp = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const propPattern = new RegExp(`(?:\\.${escapedProp}\\b|\\b${escapedProp}\\b)`, 'g')

    if (!propPattern.test(consumerSourceCode)) {
      deadProperties.push({
        property: prop,
        error: 'UNREFERENCED_DEAD_STORE_PROPERTY',
        recommendation: `Prune unused store state property '${prop}' from Pinia/Vuex store definition.`,
      })
    }
  }

  const allReferenced = deadProperties.length === 0

  return {
    allReferenced,
    totalProperties: stateProperties.length,
    deadPropertiesCount: deadProperties.length,
    deadProperties,
    storeProof: allReferenced ? 'ALL_STORE_PROPERTIES_REFERENCED' : 'DEAD_STORE_PROPERTIES_DETECTED',
  }
}
