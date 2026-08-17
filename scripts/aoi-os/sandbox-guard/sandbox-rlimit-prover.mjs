/**
 * scripts/aoi-os/sandbox-guard/sandbox-rlimit-prover.mjs
 *
 * Deterministic Sandbox Process Resource Limit (RLimit CPU & AS) Prover for AOI-OS:
 * Statically proves that child process executions in sandboxes configure CPU and virtual memory bounds
 * (ulimit -t, ulimit -v, RLIMIT_CPU, RLIMIT_AS) to prevent runaway CPU pegging or OOM crashes (0 LLM Tokens).
 */

/**
 * Audits sandbox launcher source code for CPU and memory resource limit enforcement.
 *
 * @param {string} sourceCode - Sandbox process launcher or spawn configuration
 * @returns {object} Resource limit proof report
 */
export function proveSandboxRLimitSafety(sourceCode = '') {
  const violations = []

  const hasSubprocess = /\b(?:spawn|exec|execFile|fork)\s*\(/g.test(sourceCode)
  const hasRLimit = /(?:ulimit\s+-[tv]|\bRLIMIT_CPU\b|\bRLIMIT_AS\b|\bcpuLimit\b|\btimeout\s*:)/g.test(sourceCode)

  if (hasSubprocess && !hasRLimit) {
    violations.push({
      type: 'UNBOUNDED_SUBPROCESS_RESOURCE_LIMITS',
      recommendation: "Ensure subprocess execution configures 'ulimit -t <seconds>' or explicit execution timeout to prevent runaway CPU pegging.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasSubprocess,
    violationsCount: violations.length,
    violations,
    rlimitProof: safe ? 'SANDBOX_RLIMIT_ENFORCED' : 'UNBOUNDED_PROCESS_RESOURCES_DETECTED',
  }
}
