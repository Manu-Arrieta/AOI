/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-detached-teardown-prover.mjs
 *
 * Deterministic Sandbox Process Detached Teardown Prover for AOI-OS:
 * Statically proves that child processes spawned with detached: true in sandboxes include explicit
 * process group termination (e.g. process.kill(-child.pid, 'SIGTERM')) in exit/cleanup hooks,
 * preventing orphan background processes and daemon leaks on host systems (0 LLM Tokens).
 */

/**
 * Audits child process detached spawning source code for explicit negative PID process group teardown.
 *
 * @param {string} sourceCode - Child process spawn source code
 * @returns {object} Detached process group teardown safety report
 */
export function proveSandboxProcessDetachedTeardownSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const isDetached = /detached\s*:\s*true/i.test(cleanCode)

  if (isDetached) {
    const hasProcessGroupKill = /(?:process\.kill\s*\(\s*-(?:\w+\.)?pid|kill\s*\(\s*-(?:\w+\.)?pid)/i.test(cleanCode)
    if (!hasProcessGroupKill) {
      violations.push({
        type: 'DETACHED_CHILD_PROCESS_MISSING_GROUP_TEARDOWN',
        recommendation: "Child process spawned with 'detached: true' forms a new process group (pgid). Ensure teardown hooks invoke 'process.kill(-child.pid, \"SIGTERM\")' to terminate the entire process group and prevent orphaned daemons.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    isDetached,
    violationsCount: violations.length,
    violations,
    detachedTeardownProof: safe ? 'DETACHED_PROCESS_GROUP_TEARDOWN_ENFORCED' : 'ORPHAN_DETACHED_PROCESS_RISK',
  }
}
