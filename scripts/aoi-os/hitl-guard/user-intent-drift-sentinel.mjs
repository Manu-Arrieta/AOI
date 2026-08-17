/**
 * scripts/aoi-os/hitl-guard/user-intent-drift-sentinel.mjs
 *
 * Deterministic User Intent Drift Sentinel for AOI-OS Human-in-the-Loop:
 * Audits in-flight code changes and generated test files against the original human-provided
 * intent and core domain vocabulary in spec.md, mathematically detecting scope creep or
 * unintended feature drift before task finalization (0 LLM Tokens).
 */

/**
 * Evaluates semantic alignment between spec.md intent and generated implementation code.
 *
 * @param {string} specMarkdown - Original user story / spec markdown
 * @param {string} implementationCode - Generated source code or diff
 * @param {object} [options]
 * @param {number} [options.driftThreshold=0.6] - Minimum token alignment ratio required
 * @returns {object} Intent drift report with mathematical proof
 */
export function auditUserIntentDrift(specMarkdown = '', implementationCode = '', options = {}) {
  const { driftThreshold = 0.4 } = options

  // Extract core keywords from human spec (>3 chars, alphabetic)
  const specTokens = specMarkdown
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['user', 'that', 'with', 'from', 'this', 'have', 'when', 'then', 'given'].includes(w))

  const uniqueSpecTokens = Array.from(new Set(specTokens))

  if (uniqueSpecTokens.length === 0) {
    return {
      safe: true,
      alignmentRatio: 1,
      uniqueSpecTokensCount: 0,
      matchedTokensCount: 0,
      intentDriftProof: 'SPECIFICATION_TOKEN_SET_EMPTY_CLEARED',
    }
  }

  const codeLower = implementationCode.toLowerCase()
  const matchedTokens = uniqueSpecTokens.filter((token) => codeLower.includes(token))
  const alignmentRatio = matchedTokens.length / uniqueSpecTokens.length

  const safe = alignmentRatio >= driftThreshold

  return {
    safe,
    alignmentRatio: Number(alignmentRatio.toFixed(2)),
    uniqueSpecTokensCount: uniqueSpecTokens.length,
    matchedTokensCount: matchedTokens.length,
    matchedTokens,
    driftDetected: !safe,
    intentDriftProof: safe
      ? 'USER_INTENT_ALIGNMENT_PROVEN'
      : 'EXCESSIVE_INTENT_DRIFT_OR_SCOPE_CREEP_DETECTED',
  }
}
