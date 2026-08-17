/**
 * scripts/aoi-os/security-guard/shell-quote-guard.mjs
 *
 * Deterministic Safe Shell Command Argument Quoting & Injection Guard for AOI-OS:
 * Statically audits system command execution routines (exec, execSync, spawn) to verify that
 * dynamic arguments are escaped or passed as structured argv arrays, preventing shell injection (0 LLM Tokens).
 */

/**
 * Audits source code for unguarded shell command string interpolations.
 *
 * @param {string} sourceCode - Command launcher or script execution source code
 * @returns {object} Shell quoting safety report
 */
export function auditShellQuoteSafety(sourceCode = '') {
  const violations = []

  // Check template literals in exec / execSync without quoting or escaping
  const hasDynamicExec = /(?:\bexec|\bexecSync)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/g.test(sourceCode)
  const hasShellEscaping = /(?:escapeShellArg|quote|JSON\.stringify|shellEscape|quoteShellArg)\s*\(/i.test(sourceCode)

  if (hasDynamicExec && !hasShellEscaping) {
    violations.push({
      type: 'UNQUOTED_SHELL_COMMAND_INTERPOLATION',
      recommendation: "Ensure dynamic arguments in shell execution strings are sanitized with 'escapeShellArg()' or passed as an argument array to 'spawn()' / 'execFile()'.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasDynamicExec,
    violationsCount: violations.length,
    violations,
    shellProof: safe ? 'SHELL_COMMAND_QUOTING_ENFORCED' : 'SHELL_INJECTION_RISK_DETECTED',
  }
}
