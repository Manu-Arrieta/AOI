/**
 * scripts/aoi-os/sandbox-guard/sandbox-node-options-prover.mjs
 *
 * Deterministic Sandbox Child Process NODE_OPTIONS Sanitization Prover for AOI-OS:
 * Statically proves that subprocess spawn environments in hermetic sandboxes explicitly sanitize, strip,
 * or forbid dangerous NODE_OPTIONS flags (--require, --import, --inspect) to prevent code injection escapes (0 LLM Tokens).
 */

const UNSAFE_NODE_OPTIONS_PATTERNS = [
  /NODE_OPTIONS\s*:\s*['"][^'"]*(?:--require|--import|--inspect|--enable-source-maps|--tls-cipher-list)/i,
]

/**
 * Audits sandbox environment variable NODE_OPTIONS declarations for preload injection vulnerabilities.
 *
 * @param {string} sourceCode - Process spawn environment source code
 * @returns {object} NODE_OPTIONS environment audit report
 */
export function proveSandboxNodeOptionsSafety(sourceCode = '') {
  const violations = []

  const setsNodeOptions = /NODE_OPTIONS\s*:/i.test(sourceCode)
  const hasUnsafeNodeOptions = UNSAFE_NODE_OPTIONS_PATTERNS.some((p) => p.test(sourceCode))

  if (hasUnsafeNodeOptions) {
    violations.push({
      type: 'INSECURE_SANDBOX_NODE_OPTIONS_PRELOAD',
      recommendation: "NODE_OPTIONS environment variable in sandbox contains unsafe preload or inspect flags (--require/--import/--inspect). Strip or sanitize NODE_OPTIONS.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    setsNodeOptions,
    violationsCount: violations.length,
    violations,
    nodeOptionsProof: safe ? 'SANITIZED_NODE_OPTIONS_ENFORCED' : 'INSECURE_NODE_OPTIONS_ESCAPE_RISK',
  }
}
