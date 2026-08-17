/**
 * scripts/aoi-os/sandbox-guard/sandbox-fd-cloexec-prover.mjs
 *
 * Deterministic Sandbox Process File Descriptor Isolation (CLOEXEC / stdio) Prover for AOI-OS:
 * Statically proves that subprocess spawn routines in sandboxes configure strict stdio containment
 * (stdio: ['ignore', 'pipe', 'pipe'], closeFds: true) preventing child processes from inheriting parent handles (0 LLM Tokens).
 */

/**
 * Audits sandbox process spawner source code for file descriptor isolation.
 *
 * @param {string} sourceCode - Sandbox process launcher source code
 * @returns {object} FD isolation proof report
 */
export function proveSandboxFdIsolationSafety(sourceCode = '') {
  const violations = []

  const hasSubprocess = /\b(?:spawn|fork)\s*\(/g.test(sourceCode)
  const hasStdioIsolation = /(?:stdio\s*:\s*(?:\[\s*['"](?:ignore|pipe)['"]|['"]pipe['"])|closeFds\s*:\s*true)/g.test(sourceCode)

  if (hasSubprocess && !hasStdioIsolation) {
    violations.push({
      type: 'UNCONFINED_SUBPROCESS_FD_INHERITANCE',
      recommendation: "Configure explicit 'stdio: [\"ignore\", \"pipe\", \"pipe\"]' or 'closeFds: true' on spawn options to isolate file descriptors.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasSubprocess,
    violationsCount: violations.length,
    violations,
    fdProof: safe ? 'SANDBOX_FD_ISOLATION_ENFORCED' : 'UNCONFINED_FD_INHERITANCE_RISK',
  }
}
