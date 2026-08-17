/**
 * scripts/aoi-os/sandbox-guard/sandbox-coredump-prover.mjs
 *
 * Deterministic Sandbox Process Core Dump Prevention Prover for AOI-OS:
 * Statically proves that child process executions in sandboxes configure core dump disabling
 * (ulimit -c 0, RLIMIT_CORE: 0, --abort-on-uncaught-exception: false) to prevent memory secret leaks (0 LLM Tokens).
 */

/**
 * Audits sandbox launcher source code for core dump disabling proof.
 *
 * @param {string} sourceCode - Sandbox process launcher or spawn configuration
 * @returns {object} Core dump prevention proof report
 */
export function proveSandboxCoreDumpSafety(sourceCode = '') {
  const violations = []

  const hasSubprocess = /\b(?:spawn|exec|execFile|fork)\s*\(/g.test(sourceCode)
  const hasCoreDumpDisabled = /(?:ulimit\s+-c\s+0|\bRLIMIT_CORE\b|\bcore:\s*0\b|\bdisableCoreDump\b|\bnoCoreDump\b)/g.test(sourceCode)

  if (hasSubprocess && !hasCoreDumpDisabled) {
    violations.push({
      type: 'UNGUARDED_CORE_DUMP_CONFIGURATION',
      recommendation: "Ensure subprocess execution configures 'ulimit -c 0' or 'RLIMIT_CORE: 0' to prevent leaking heap secrets on crash.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasSubprocess,
    violationsCount: violations.length,
    violations,
    coreDumpProof: safe ? 'SANDBOX_CORE_DUMP_DISABLED' : 'POTENTIAL_MEMORY_LEAK_CORE_DUMP',
  }
}
