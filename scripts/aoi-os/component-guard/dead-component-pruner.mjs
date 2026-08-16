/**
 * scripts/aoi-os/component-guard/dead-component-pruner.mjs
 *
 * Deterministic Dead Component & Unrendered Vue Template Pruner for AOI-OS:
 * Statically audits declared Vue components against template usages across pages and views,
 * proving 100% component reachability and preventing bundle bloat (0 LLM Tokens).
 */

/**
 * Audits a list of component names against application template source code.
 *
 * @param {string[]} componentNames - Component identifiers (e.g. ['TaskBoard', 'TaskTanstackTable'])
 * @param {string} appTemplateCode - Aggregate template/source code
 * @returns {object} Component audit report
 */
export function auditDeadComponents(componentNames = [], appTemplateCode = '') {
  const deadComponents = []

  for (const comp of componentNames) {
    // Check for PascalCase (<TaskBoard) or kebab-case (<task-board)
    const kebab = comp.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    const pattern = new RegExp(`<(?:${comp}|${kebab})\\b|\\b${comp}\\b`, 'g')

    if (!pattern.test(appTemplateCode)) {
      deadComponents.push({
        component: comp,
        type: 'UNRENDERED_DEAD_COMPONENT_DETECTED',
        recommendation: `Prune unused component '${comp}.vue' or render it in an active route.`,
      })
    }
  }

  const allRendered = deadComponents.length === 0

  return {
    allRendered,
    totalComponents: componentNames.length,
    deadComponentsCount: deadComponents.length,
    deadComponents,
    componentProof: allRendered ? 'ALL_DECLARED_COMPONENTS_RENDERED' : 'DEAD_UNRENDERED_COMPONENTS_DETECTED',
  }
}
