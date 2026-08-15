/**
 * scripts/aoi-os/diagnostics/root-cause-synthesizer.mjs
 *
 * Deterministic Root Cause Diagnostic Synthesizer & Error Archetype Classifier for AOI-OS:
 * Classifies test failures, compiler diagnostics, and stack traces into formal archetypes,
 * synthesizing actionable remediation blueprints for the self-healing loop (0 LLM Tokens).
 */

/**
 * Classifies an error diagnostic and generates a remediation blueprint.
 *
 * @param {string} errorMessage
 * @param {string} [stackTrace='']
 * @returns {object} Root cause diagnostic and action blueprint
 */
export function diagnoseRootCause(errorMessage = '', stackTrace = '') {
  const combined = `${errorMessage}\n${stackTrace}`.toLowerCase()

  let archetype = 'UNKNOWN_ANOMALY'
  let confidence = 'MEDIUM'
  let suggestedRemediation = 'Review code diff and re-run isolated test.'

  if (combined.includes('assertionerror') || combined.includes('expected') || combined.includes('strictEqual')) {
    archetype = 'ASSERTION_VALUE_MISMATCH'
    confidence = 'HIGH'
    suggestedRemediation = 'Align expected return value in business logic with test fixture assertion.'
  } else if (combined.includes('typeerror: cannot read propert') || combined.includes('undefined') || combined.includes('null')) {
    archetype = 'NULL_POINTER_OR_UNDEFINED_DEREFERENCE'
    confidence = 'HIGH'
    suggestedRemediation = 'Add optional chaining (?.) or defensive null guards before property access.'
  } else if (combined.includes('deadlock') || combined.includes('mutex') || combined.includes('lock acquired')) {
    archetype = 'MUTEX_CONCURRENCY_DEADLOCK'
    confidence = 'CRITICAL'
    suggestedRemediation = 'Wrap lock acquisition in try/finally blocks to ensure unconditional release.'
  } else if (combined.includes('unhandledpromiserejection') || combined.includes('async') || combined.includes('promise')) {
    archetype = 'UNHANDLED_ASYNC_REJECTION'
    confidence = 'HIGH'
    suggestedRemediation = 'Ensure all async promises are awaited or caught with .catch() handlers.'
  } else if (combined.includes('syntaxerror') || combined.includes('unexpected token')) {
    archetype = 'SYNTAX_OR_PARSING_ERROR'
    confidence = 'HIGH'
    suggestedRemediation = 'Fix syntax typo, unclosed brace, or invalid token in target source file.'
  }

  return {
    archetype,
    confidence,
    suggestedRemediation,
    diagnosticProof: 'ROOT_CAUSE_DIAGNOSED',
  }
}
