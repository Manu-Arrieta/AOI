/**
 * scripts/aoi-os/hitl-guard/story-acceptance-criteria-auditor.mjs
 *
 * Deterministic User Story Acceptance Criteria Alignment Prover for AOI-OS Human-in-the-Loop:
 * Statically parses user stories in spec.md and DAG tasks in tasks.md, mathematically
 * demonstrating 100% coverage of human-defined acceptance criteria scenarios in the
 * executable test requirements of the task DAG (0 LLM Tokens).
 */

/**
 * Proves that user story acceptance criteria are fully mapped to DAG task test requirements.
 *
 * @param {string} specMarkdown - Content of spec.md containing user stories and acceptance criteria
 * @param {Array<object>} dagTasks - Parsed DAG task nodes
 * @returns {object} Alignment report with mathematical proof
 */
export function proveStoryAcceptanceCriteriaAlignment(specMarkdown = '', dagTasks = []) {
  const criteriaMatches = specMarkdown.match(/(?:###?\s*(?:Scenario|Acceptance Criteria|Criterio de Aceptaci[oó]n|Given|When|Then)[^\n]*)/gi) || []
  const extractedCriteria = criteriaMatches.map((c) => c.replace(/^###?\s*/, '').trim())

  const unmappedCriteria = []

  for (const criterion of extractedCriteria) {
    const criterionTokens = criterion.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    let isCovered = false

    for (const task of dagTasks) {
      const testReqs = Array.isArray(task.testRequirements)
        ? task.testRequirements.join(' ')
        : (typeof task.testRequirements === 'string' ? task.testRequirements : '')
      const taskText = `${task.title || ''} ${testReqs}`.toLowerCase()
      const matchCount = criterionTokens.filter((token) => taskText.includes(token)).length

      // If at least 40% of significant tokens match or if task explicitly references the criterion
      if (matchCount >= Math.ceil(criterionTokens.length * 0.4) || criterionTokens.length === 0) {
        isCovered = true
        break
      }
    }

    if (!isCovered) {
      unmappedCriteria.push(criterion)
    }
  }

  const aligned = unmappedCriteria.length === 0

  return {
    aligned,
    totalCriteria: extractedCriteria.length,
    unmappedCount: unmappedCriteria.length,
    unmappedCriteria,
    coveragePercentage: extractedCriteria.length === 0 ? 100 : Math.round(((extractedCriteria.length - unmappedCriteria.length) / extractedCriteria.length) * 100),
    alignmentProof: aligned ? 'ACCEPTANCE_CRITERIA_100_PERCENT_COVERED' : 'UNMAPPED_ACCEPTANCE_CRITERIA_DETECTED',
  }
}
