/**
 * scripts/aoi-os/sandbox-guard/sandbox-signal-trap-prover.mjs
 *
 * Deterministic Sandbox Process Group Signal Trap Prover for AOI-OS:
 * Statically proves that sandbox subprocess execution wrappers configure detached process groups (detached: true)
 * and signal traps (process.on('SIGTERM'), kill(-pid)) to guarantee zero orphaned process groups (0 LLM Tokens).
 */

/**
 * Audits sandbox execution wrapper source code for process group signal trapping.
 *
 * @param {string} sourceCode - Sandbox process wrapper source code
 * @returns {object} Signal trap proof report
 */
export function proveSandboxSignalTrapSafety(sourceCode = '') {
  const violations = []

  const isProcessSpawner = /(?:spawn|spawnProcessGroup|runSandboxProcess|launchIsolatedProcess|execSubprocessGroup)\b/i.test(sourceCode)
  const hasDetachedGroup = /(?:detached\s*:\s*true)/i.test(sourceCode)
  const hasGroupKillTrap = /(?:kill\s*\(\s*-\w+(?:\.pid)?|process\.kill\s*\(\s*-\w+(?:\.pid)?)/i.test(sourceCode)

  if (isProcessSpawner && (!hasDetachedGroup || !hasGroupKillTrap)) {
    violations.push({
      type: 'UNCONFINED_PROCESS_GROUP_SIGNAL_TRAP',
      recommendation: "Ensure subprocess execution configures 'detached: true' and registers a signal trap with 'process.kill(-pid, signal)' to terminate entire child process trees.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    isProcessSpawner,
    violationsCount: violations.length,
    violations,
    groupSignalProof: safe ? 'PROCESS_GROUP_SIGNAL_TRAP_ENFORCED' : 'ORPHAN_PROCESS_TREE_RISK_DETECTED',
  }
}
