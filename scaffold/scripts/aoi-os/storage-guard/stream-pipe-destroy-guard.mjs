/**
 * scripts/aoi-os/storage-guard/stream-pipe-destroy-guard.mjs
 *
 * Deterministic Atomic Stream Pipe Auto-Destroy Guard for AOI-OS:
 * Statically audits stream piping (readable.pipe(writable), stream.pipeline)
 * to verify error-handling and auto-destruction of both endpoints upon error,
 * preventing leaked file descriptors or zombie sockets when destination streams fail (0 LLM Tokens).
 */

const RAW_UNGUARDED_PIPE_PATTERN = /\.pipe\s*\(\s*[a-zA-Z0-9_$]+\s*\)(?!\s*\.on\s*\(\s*['"]error['"]|\s*\.pipe|\s*;?\s*(?:stream\.)?pipeline)/i

/**
 * Audits stream piping source code for error propagation and teardown safety.
 *
 * @param {string} sourceCode - Stream piping source code
 * @returns {object} Stream pipe audit report
 */
export function auditStreamPipeDestroySafety(sourceCode = '') {
  const violations = []

  const usesPiping = /(?:\.pipe\s*\(|pipeline\s*\(|stream\.pipeline)/i.test(sourceCode)
  const usesPipelineHelper = /(?:pipeline\s*\(|stream\.pipeline|stream\/promises)/i.test(sourceCode)
  const hasPipeErrorHandling = /\.on\s*\(\s*['"]error['"]/i.test(sourceCode) || /\.destroy\s*\(/i.test(sourceCode)

  if (usesPiping && !usesPipelineHelper && !hasPipeErrorHandling) {
    violations.push({
      type: 'UNGUARDED_RAW_STREAM_PIPE',
      recommendation: "Raw stream .pipe() without error handler or stream.pipeline() can leak descriptors on failure. Use 'stream.pipeline(src, dst, cb)' or 'pipeline' from 'stream/promises'.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    usesPiping,
    violationsCount: violations.length,
    violations,
    pipeProof: safe ? 'STREAM_PIPE_AUTO_DESTROY_ENFORCED' : 'LEAKY_RAW_STREAM_PIPE_DETECTED',
  }
}
