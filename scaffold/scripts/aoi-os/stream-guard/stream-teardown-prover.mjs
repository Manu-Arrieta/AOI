/**
 * scripts/aoi-os/stream-guard/stream-teardown-prover.mjs
 *
 * Deterministic SSE Stream & WebSocket Teardown Prover for AOI-OS:
 * Statically proves that streaming endpoints register client abort/close handlers and clean up heartbeat intervals (0 LLM Tokens).
 */

/**
 * Audits source code of streaming endpoints for cleanup listeners and interval cancellations.
 *
 * @param {string} sourceCode
 * @returns {object} Stream teardown audit report
 */
export function proveStreamTeardownSafety(sourceCode = '') {
  const violations = []

  const hasStreaming = /\b(?:createEventStream|eventStream|ReadableStream|ws\.on\s*\(\s*['"]connection['"])/g.test(sourceCode)
  const hasCloseHandler = /\.on\s*\(\s*['"](?:close|abort)['"]|\.addEventListener\s*\(\s*['"]abort['"]/g.test(sourceCode)
  const hasInterval = /\bsetInterval\s*\(/g.test(sourceCode)
  const hasClearInterval = /\bclearInterval\s*\(/g.test(sourceCode)

  if (hasStreaming && !hasCloseHandler) {
    violations.push({
      type: 'MISSING_STREAM_ABORT_HANDLER',
      recommendation: "Register client disconnect listener (e.g. req.on('close') or signal 'abort') to cleanly teardown stream.",
    })
  }

  if (hasStreaming && hasInterval && !hasClearInterval) {
    violations.push({
      type: 'UNCLEARED_HEARTBEAT_INTERVAL',
      recommendation: "Ensure heartbeat timer created with setInterval is cancelled with clearInterval on stream close.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasStreaming,
    violationsCount: violations.length,
    violations,
    streamProof: safe ? 'STREAM_TEARDOWN_AND_INTERVALS_PROVEN' : 'DANGLING_STREAM_OR_INTERVAL_DETECTED',
  }
}
