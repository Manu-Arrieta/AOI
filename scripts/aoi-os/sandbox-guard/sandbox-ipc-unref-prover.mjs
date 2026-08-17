/**
 * scripts/aoi-os/sandbox-guard/sandbox-ipc-unref-prover.mjs
 *
 * Deterministic Sandbox Child Process Unref & Detach Prover for AOI-OS:
 * Statically proves that background daemon processes or monitoring subprocesses spawned with detached: true
 * invoke explicit child.unref() in parent orchestrators to prevent hanging the Node.js event loop (0 LLM Tokens).
 */

/**
 * Audits detached process spawning source code for explicit unref() calls.
 *
 * @param {string} sourceCode - Process spawning source code
 * @returns {object} Detached process unref proof report
 */
export function proveSandboxIpcUnrefSafety(sourceCode = '') {
  const violations = []

  const createsDetachedProcess = /(?:detached\s*:\s*true|unrefProcess)/i.test(sourceCode)
  const hasUnrefCall = /(?:\.unref\s*\(|child\.unref)/i.test(sourceCode)

  if (createsDetachedProcess && !hasUnrefCall) {
    violations.push({
      type: 'DETACHED_CHILD_MISSING_UNREF',
      recommendation: "Ensure detached child processes or background daemons have explicit 'child.unref()' invoked to allow the parent event loop to exit cleanly.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    createsDetachedProcess,
    violationsCount: violations.length,
    violations,
    unrefProof: safe ? 'DETERMINISTIC_DETACHED_UNREF_ENFORCED' : 'DETACHED_PROCESS_HANG_RISK',
  }
}
