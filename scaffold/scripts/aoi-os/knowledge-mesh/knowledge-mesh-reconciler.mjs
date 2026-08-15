/**
 * scripts/aoi-os/knowledge-mesh/knowledge-mesh-reconciler.mjs
 *
 * Deterministic Knowledge Mesh Reconciler & Decision Drift Auditor for AOI-OS:
 * Audits persistent ICM memories against active ADRs and code architecture rules,
 * detecting obsolete decisions and synthesizing deterministic reconciliation diffs (0 LLM Tokens).
 */

/**
 * Audits semantic consistency between ICM memory graph and active architecture rules.
 *
 * @param {object} options
 * @param {Array<{ id: string, topic: string, content: string }>} [options.memories=[]]
 * @param {string[]} [options.activeRules=[]]
 * @returns {object} Knowledge reconciliation audit and drift report
 */
export function reconcileKnowledgeMesh(options = {}) {
  const { memories = [], activeRules = [] } = options

  const drifts = []
  const reconciliationPlan = []

  // Check known contradiction patterns between memories and active rules
  for (const memory of memories) {
    const memContent = memory.content.toLowerCase()

    for (const rule of activeRules) {
      const ruleLower = rule.toLowerCase()

      // Example: Memory references deprecated library while rule mandates new one
      if (ruleLower.includes('no vuex') || ruleLower.includes('use pinia')) {
        if (memContent.includes('vuex')) {
          drifts.push({
            memoryId: memory.id,
            topic: memory.topic,
            rule,
            type: 'OBSOLETE_DECISION_DRIFT',
            detail: `Memory [${memory.id}] refers to Vuex which contradicts rule '${rule}'`,
          })
          reconciliationPlan.push({
            memoryId: memory.id,
            action: 'UPDATE_MEMORY_CONTENT',
            suggestedContent: memory.content.replace(/vuex/gi, 'Pinia'),
          })
        }
      }

      if (ruleLower.includes('tailwind v4') || ruleLower.includes('no tailwind v3')) {
        if (memContent.includes('tailwind v3')) {
          drifts.push({
            memoryId: memory.id,
            topic: memory.topic,
            rule,
            type: 'DEPRECATED_VERSION_DRIFT',
            detail: `Memory [${memory.id}] refers to Tailwind v3 which contradicts rule '${rule}'`,
          })
          reconciliationPlan.push({
            memoryId: memory.id,
            action: 'UPDATE_MEMORY_CONTENT',
            suggestedContent: memory.content.replace(/tailwind v3/gi, 'Tailwind CSS v4'),
          })
        }
      }
    }
  }

  const inSync = drifts.length === 0

  return {
    inSync,
    totalMemoriesAudited: memories.length,
    totalDrifts: drifts.length,
    drifts,
    reconciliationPlan,
    meshStatus: inSync ? 'KNOWLEDGE_MESH_SYNCHRONIZED' : 'KNOWLEDGE_DRIFT_DETECTED',
  }
}
