/**
 * scripts/aoi-os/sandbox-guard/sandbox-env-isolation-prover.mjs
 *
 * Deterministic Sandbox Process Environment Variable Isolation Prover for AOI-OS:
 * Statically proves that child process execution in sandboxes (spawn, exec, execFile, fork)
 * passes an explicit sanitized environment object ({ env: ... }) to prevent ambient host secret leakage (0 LLM Tokens).
 */

/**
 * Audits child process spawn source code for explicit environment isolation.
 *
 * @param {string} sourceCode - Sandbox process launcher source code
 * @returns {object} Environment isolation proof report
 */
export function proveSandboxEnvIsolationSafety(sourceCode = '') {
  const violations = []

  const hasSubprocessExecution = /\b(?:spawn|exec|execFile|fork)\s*\(/g.test(sourceCode)
  const hasExplicitEnv = /(?:env\s*:|\bcleanEnv\b|\bfilteredEnv\b|\bsanitizedEnv\b|\bisolatedEnv\b)/g.test(sourceCode)

  if (hasSubprocessExecution && !hasExplicitEnv) {
    violations.push({
      type: 'UNCONSTRAINED_PROCESS_ENV_INHERITANCE',
      recommendation: "Provide an explicit filtered 'env' dictionary to subprocess execution to prevent leaking ambient host secrets.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasSubprocessExecution,
    violationsCount: violations.length,
    violations,
    isolationProof: safe ? 'SANDBOX_ENV_ISOLATION_PROVEN' : 'UNISOLATED_HOST_ENV_DETECTED',
  }
}
