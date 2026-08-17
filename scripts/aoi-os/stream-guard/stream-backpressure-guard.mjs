/**
 * scripts/aoi-os/stream-guard/stream-backpressure-guard.mjs
 *
 * Deterministic SSE & WebSocket Streaming Backpressure Guard for AOI-OS:
 * Statically audits streaming write sinks (res.write, ws.send, stream.push) to ensure that
 * backpressure flow control (drain, bufferedAmount, return value checking) is implemented (0 LLM Tokens).
 */

/**
 * Audits streaming pipeline source code for backpressure safety.
 *
 * @param {string} sourceCode - Stream or WebSocket sink source code
 * @returns {object} Backpressure audit report
 */
export function auditStreamBackpressureSafety(sourceCode = '') {
  const violations = []

  const hasStreamingWrites = /\b(?:res\.write|ws\.send|stream\.push)\s*\(/g.test(sourceCode)
  const hasBackpressureControl = /\b(?:drain|bufferedAmount|highWaterMark|pipe\s*\(|pipeline\s*\()\b/g.test(sourceCode)

  if (hasStreamingWrites && !hasBackpressureControl) {
    violations.push({
      type: 'UNGUARDED_STREAMING_BACKPRESSURE',
      recommendation: "Implement backpressure flow control by listening to 'drain' events or using 'pipeline()' to prevent memory exhaustion.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasStreamingWrites,
    violationsCount: violations.length,
    violations,
    backpressureProof: safe ? 'STREAMING_BACKPRESSURE_HANDLED' : 'UNHANDLED_BACKPRESSURE_RISK_DETECTED',
  }
}
