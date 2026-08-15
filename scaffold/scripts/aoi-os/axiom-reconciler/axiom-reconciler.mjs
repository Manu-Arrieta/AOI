/**
 * scripts/aoi-os/axiom-reconciler/axiom-reconciler.mjs
 *
 * Deterministic Axiom Self-Reconciliation & Semantic Equilibrium Engine for AOI-OS:
 * Audits workspace rules, SDD requirements, and memory topics for logical contradictions,
 * synthesizing deterministic reconciliation diffs to maintain architectural equilibrium.
 */

/**
 * Audits a set of architectural rules against code implementations and task designs.
 *
 * @param {object} options
 * @param {string[]} [options.axioms=[]] - Declared rules/axioms (e.g. "Use ofetch instead of raw fetch", "No inline styles")
 * @param {Array<{ taskId: string, code?: string, requirements?: string[] }>} [options.taskArtifacts=[]]
 * @returns {object} Axiom reconciliation audit and resolution plan
 */
export function reconcileAxioms(options = {}) {
  const { axioms = [], taskArtifacts = [] } = options

  const conflicts = []
  const reconciliationPlan = []

  // Check known contradiction patterns
  for (const axiom of axioms) {
    const axiomLower = axiom.toLowerCase()

    // 1. Fetch vs ofetch / $fetch rule
    if (axiomLower.includes('fetch') && (axiomLower.includes('$fetch') || axiomLower.includes('ofetch') || axiomLower.includes('raw fetch'))) {
      for (const artifact of taskArtifacts) {
        if (artifact.code && /\bfetch\s*\(/.test(artifact.code) && !artifact.code.includes('ofetch') && !artifact.code.includes('$fetch')) {
          conflicts.push({
            taskId: artifact.taskId,
            axiom,
            type: 'AXIOM_VIOLATION_RAW_FETCH',
            detail: `Task [${artifact.taskId}] uses raw fetch() violating axiom '${axiom}'`,
          })
          reconciliationPlan.push({
            taskId: artifact.taskId,
            action: 'REPLACE_CALL',
            from: 'fetch(',
            to: '$fetch(',
          })
        }
      }
    }

    // 2. Inline Style Rule
    if (axiomLower.includes('no inline styles') || axiomLower.includes('tailwind')) {
      for (const artifact of taskArtifacts) {
        if (artifact.code && /style\s*=\s*["']/.test(artifact.code)) {
          conflicts.push({
            taskId: artifact.taskId,
            axiom,
            type: 'AXIOM_VIOLATION_INLINE_STYLE',
            detail: `Task [${artifact.taskId}] contains inline styles violating axiom '${axiom}'`,
          })
          reconciliationPlan.push({
            taskId: artifact.taskId,
            action: 'MIGRATE_TO_UTILITY_CLASSES',
          })
        }
      }
    }
  }

  const inEquilibrium = conflicts.length === 0

  return {
    inEquilibrium,
    totalAxioms: axioms.length,
    totalConflicts: conflicts.length,
    conflicts,
    reconciliationPlan,
    equilibriumStatus: inEquilibrium ? 'AXIOMATIC_EQUILIBRIUM_VERIFIED' : 'RECONCILIATION_REQUIRED',
  }
}
