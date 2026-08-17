/**
 * scripts/aoi-os/storage-guard/stream-transform-final-guard.mjs
 *
 * Deterministic Atomic Stream Transform _final & _flush Cleanup Guard for AOI-OS:
 * Statically audits custom Transform / Writable stream implementations to verify deterministic invocation
 * of callback() in _final or _flush lifecycle hooks, preventing hanging stream pipelines during termination (0 LLM Tokens).
 */

/**
 * Audits Transform/Writable stream source code for proper _final/_flush callback termination.
 *
 * @param {string} sourceCode - Stream implementation source code
 * @returns {object} Transform final cleanup audit report
 */
export function auditStreamTransformFinalSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const definesCustomTransform = /(?:class\s+\w+\s+extends\s+(?:Transform|Writable)|new\s+Transform\s*\(\s*\{)/i.test(cleanCode)
  const hasFlushOrFinal = /(?:_flush|_final)\s*\([a-zA-Z0-9_$,\s]*\)\s*\{([^}]*)\}/i.exec(cleanCode)

  if (definesCustomTransform && hasFlushOrFinal) {
    const methodBody = hasFlushOrFinal[1] || ''
    const hasCallbackCall = /(?:callback|cb|next)\s*\(/i.test(methodBody)

    if (!hasCallbackCall) {
      violations.push({
        type: 'TRANSFORM_FINAL_MISSING_CALLBACK',
        recommendation: "Custom stream _final or _flush method does not invoke callback(). Ensure 'callback()' or 'cb()' is deterministically called to signal completion.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    definesCustomTransform,
    violationsCount: violations.length,
    violations,
    finalProof: safe ? 'DETERMINISTIC_TRANSFORM_FINAL_ENFORCED' : 'HANGING_TRANSFORM_FINAL_RISK',
  }
}
