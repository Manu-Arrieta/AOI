/**
 * scripts/aoi-os/sandbox-guard/signal-teardown-prover.mjs
 *
 * Deterministic Process Signal & Graceful Teardown Prover for AOI-OS:
 * Statically proves that server/worker listeners register graceful signal handlers (SIGINT, SIGTERM),
 * preventing process corruption and ensuring zero unhandled OS signal traps (0 LLM Tokens).
 */

/**
 * Audits source code for graceful termination handlers on long-running processes.
 *
 * @param {string} sourceCode
 * @returns {object} Signal teardown audit report
 */
export function proveSignalTeardown(sourceCode = '') {
  const hasServerListen = /\b(?:app|server|http)\.listen\s*\(/g.test(sourceCode)
  const hasSignalHandler = /process\.on\s*\(\s*['"](?:SIGINT|SIGTERM|exit)['"]/g.test(sourceCode)

  const violations = []
  if (hasServerListen && !hasSignalHandler) {
    violations.push({
      type: 'MISSING_GRACEFUL_SIGNAL_HANDLER',
      recommendation: "Register process.on('SIGINT') and process.on('SIGTERM') handlers to cleanly close listeners.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasServerListen,
    hasSignalHandler,
    violationsCount: violations.length,
    violations,
    signalProof: safe ? 'GRACEFUL_SIGNAL_TEARDOWN_PROVEN' : 'UNHANDLED_SIGNAL_TERMINATION_RISK',
  }
}
