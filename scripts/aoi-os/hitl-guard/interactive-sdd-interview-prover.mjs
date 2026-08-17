/**
 * scripts/aoi-os/hitl-guard/interactive-sdd-interview-prover.mjs
 *
 * Deterministic Interactive SDD Interview Clarification Prover for AOI-OS Human-in-the-Loop:
 * Audits feature intention and story specifications during /sdd-new, identifying ambiguous
 * terms, unconfirmed architectural choices, or unresolved TBD markers to mandate an interactive
 * clarifying interview with the human governor before formal specification lock (0 LLM Tokens).
 */

const AMBIGUOUS_PATTERNS = [
  /\b(?:tbd|todo|fixme)\b/i,
  /\b(?:maybe|perhaps|probably|eventually)\b/i,
  /\b(?:as needed|if possible|etc\.?|and so on)\b/i,
  /\b(?:optional(?:ly)?|not sure)\b/i,
]

/**
 * Audits feature specification text for ambiguity requiring human clarification.
 *
 * @param {string} text - User story or feature intent text
 * @param {object} options
 * @param {boolean} [options.hasHumanClarificationResponse=false] - True if human explicitly answered
 * @returns {object} Interview audit report with mathematical proof
 */
export function auditSddInterviewClarification(text = '', options = {}) {
  const { hasHumanClarificationResponse = false } = options
  const detectedAmbiguities = []

  const lines = text.split('\n')
  lines.forEach((line, index) => {
    for (const pattern of AMBIGUOUS_PATTERNS) {
      if (pattern.test(line)) {
        detectedAmbiguities.push({
          line: index + 1,
          content: line.trim(),
          matchedPattern: pattern.toString(),
        })
      }
    }
  })

  const ambiguityCount = detectedAmbiguities.length
  const requiresClarification = ambiguityCount > 0 && !hasHumanClarificationResponse
  const valid = !requiresClarification

  return {
    valid,
    requiresClarification,
    hasHumanClarificationResponse,
    ambiguityCount,
    detectedAmbiguities,
    clarificationProof: valid
      ? (hasHumanClarificationResponse ? 'HUMAN_CLARIFICATION_RESOLVED' : 'INTENT_SPECIFICATION_FULLY_DETERMINISTIC')
      : 'MANDATORY_INTERACTIVE_HUMAN_INTERVIEW_REQUIRED',
  }
}
