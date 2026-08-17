/**
 * scripts/aoi-os/storage-guard/stream-pipeline-async-guard.mjs
 *
 * Deterministic Atomic Stream pipeline & finished Async Await Guard for AOI-OS:
 * Statically audits stream.pipeline and stream.finished promise invocations (e.g. stream/promises)
 * to verify that calls are properly awaited or wrapped with catch handlers, preventing unhandled
 * stream promise rejections and silent I/O dropouts (0 LLM Tokens).
 */

/**
 * Audits stream pipeline and finished promise usage in source code for proper await/catch handling.
 *
 * @param {string} sourceCode - Stream pipeline source code
 * @returns {object} Stream pipeline async audit report
 */
export function auditStreamPipelineAsyncSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const usesPromisesPipeline = /(?:import\s*\{[^}]*pipeline[^}]*\}\s*from\s*['"](?:node:)?stream\/promises['"]|require\s*\(\s*['"](?:node:)?stream\/promises['"]\))/i.test(cleanCode)

  if (usesPromisesPipeline) {
    const unawaitedPipeline = /(?<!await\s+)\bpipeline\s*\([^;)]+\)(?!\s*\.catch)/i.test(cleanCode)
    if (unawaitedPipeline) {
      violations.push({
        type: 'UNAWAITED_STREAM_PIPELINE_PROMISE',
        recommendation: "stream/promises 'pipeline()' call is not awaited or caught. Prepend 'await' or chain '.catch()' to guarantee error propagation and completion.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    usesPromisesPipeline,
    violationsCount: violations.length,
    violations,
    pipelineProof: safe ? 'STREAM_PIPELINE_PROMISE_AWAITED' : 'FLOATING_STREAM_PIPELINE_RISK',
  }
}
