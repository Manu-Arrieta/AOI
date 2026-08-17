/**
 * scripts/aoi-os/async-guard/unhandled-rejection-guard.mjs
 *
 * Deterministic Unhandled Rejection & Process Exception Lifecycle Guard for AOI-OS:
 * Statically audits process entrypoints and daemon dispatchers to verify that
 * unhandledRejection and uncaughtException hooks or top-level try/catch handlers are present (0 LLM Tokens).
 */

/**
 * Audits process entrypoint source code for unhandled rejection and exception safety.
 *
 * @param {string} sourceCode - Process entrypoint or worker launcher code
 * @returns {object} Exception handler audit report
 */
export function auditUnhandledRejectionSafety(sourceCode = '') {
  const violations = []

  const hasAsyncDispatch = /(?:\basync\s+function\s+main\b|\bprocess\.on\s*\(|\bstartDaemon\b|\blaunchWorker\b)/g.test(sourceCode)
  const hasExceptionHandlers = /(?:process\.on\s*\(\s*['"](?:unhandledRejection|uncaughtException)['"]|\.catch\s*\(|try\s*\{[\s\S]*\}\s*catch\s*\()/g.test(sourceCode)

  if (hasAsyncDispatch && !hasExceptionHandlers) {
    violations.push({
      type: 'MISSING_UNHANDLED_REJECTION_HOOKS',
      recommendation: "Ensure process registers 'process.on(\"unhandledRejection\")' or wraps top-level dispatch in a try/catch handler.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasAsyncDispatch,
    violationsCount: violations.length,
    violations,
    rejectionProof: safe ? 'PROCESS_EXCEPTIONS_GOVERNED' : 'UNGOVERNED_UNHANDLED_REJECTIONS_RISK',
  }
}
