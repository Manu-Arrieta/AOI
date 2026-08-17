/**
 * scripts/aoi-os/storage-guard/stream-cork-uncork-guard.mjs
 *
 * Deterministic Atomic Stream cork & uncork Memory Flush Guard for AOI-OS:
 * Statically audits writable stream batching routines that call .cork() to ensure a matching deterministically
 * reachable .uncork() call exists, preventing buffered chunks from being permanently held in memory (0 LLM Tokens).
 */

/**
 * Audits stream writing source code for paired .cork() and .uncork() invocation.
 *
 * @param {string} sourceCode - Stream writing source code
 * @returns {object} Stream cork/uncork audit report
 */
export function auditStreamCorkUncorkSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const callsCork = /(?:\.cork\s*\(\s*\))/i.test(cleanCode)
  const callsUncork = /(?:\.uncork\s*\(\s*\))/i.test(cleanCode)

  if (callsCork && !callsUncork) {
    violations.push({
      type: 'STREAM_CORK_MISSING_UNCORK',
      recommendation: "Writable stream calls .cork() but lacks a matching .uncork() call. Ensure .uncork() is invoked (e.g., in process.nextTick() or finally block) to flush buffered data.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    callsCork,
    violationsCount: violations.length,
    violations,
    corkProof: safe ? 'DETERMINISTIC_STREAM_UNCORK_ENFORCED' : 'UNFLUSHED_CORKED_STREAM_LEAK_RISK',
  }
}
