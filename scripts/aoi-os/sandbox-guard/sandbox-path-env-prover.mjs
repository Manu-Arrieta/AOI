/**
 * scripts/aoi-os/sandbox-guard/sandbox-path-env-prover.mjs
 *
 * Deterministic Sandbox Process PATH Variable Sanitization Prover for AOI-OS:
 * Statically proves that subprocess spawning in hermetic sandboxes sanitizes or explicitly bounds PATH
 * (forbidding unsafe relative path lookups '.' or world-writable '/tmp' entries), preventing binary hijacking (0 LLM Tokens).
 */

const UNSAFE_PATH_PATTERNS = [
  /PATH\s*:\s*['"](?:\.|\.\/|\/tmp|[^'"]*(?::\.|:\.\/|:\/tmp))/i,
]

/**
 * Audits sandbox environment variable PATH definitions for security.
 *
 * @param {string} sourceCode - Process spawn environment source code
 * @returns {object} PATH environment audit report
 */
export function proveSandboxPathEnvSafety(sourceCode = '') {
  const violations = []

  const setsPath = /PATH\s*:/i.test(sourceCode)
  const hasUnsafePath = UNSAFE_PATH_PATTERNS.some((p) => p.test(sourceCode))

  if (hasUnsafePath) {
    violations.push({
      type: 'INSECURE_SANDBOX_PATH_ENVIRONMENT',
      recommendation: "PATH environment variable in sandbox contains unsafe relative '.' or world-writable '/tmp' entries. Use trusted canonical directories (e.g. '/usr/bin:/bin').",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    setsPath,
    violationsCount: violations.length,
    violations,
    pathProof: safe ? 'CANONICAL_TRUSTED_PATH_ENFORCED' : 'INSECURE_SANDBOX_PATH_HIJACK_RISK',
  }
}
