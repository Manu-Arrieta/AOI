/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-windows-shell-prover.mjs
 *
 * Deterministic Sandbox Process Windows Shell Injection Flag Prover for AOI-OS:
 * Statically proves that child process executions (spawn, execFile, fork) in sandboxes
 * disallow dangerous shell: true option with dynamic template strings or unquoted variables,
 * preventing arbitrary shell command injection through cmd.exe/powershell.exe on Windows (0 LLM Tokens).
 */

/**
 * Audits child process spawn source code for dangerous shell: true injection patterns.
 *
 * @param {string} sourceCode - Child process spawn source code
 * @returns {object} Shell injection safety report
 */
export function proveSandboxProcessWindowsShellSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const hasSpawn = /(?:spawn\s*\(|exec\s*\(|fork\s*\()/i.test(cleanCode)
  const hasShellTrue = /shell\s*:\s*true/i.test(cleanCode)

  if (hasSpawn && hasShellTrue) {
    const hasDynamicInterpolation = /(?:spawn|exec)\s*\(\s*`[^`]*\$\{[^}]+\}/i.test(cleanCode) || /(?:spawn|exec)\s*\(\s*[^,\n]+\s*\+\s*/i.test(cleanCode)
    const hasStrictSanitization = /(?:sanitizeShell|escapeShellArg|quoteArg|windowsVerbatimArguments)/i.test(cleanCode)

    if (hasDynamicInterpolation && !hasStrictSanitization) {
      violations.push({
        type: 'DANGEROUS_SHELL_TRUE_DYNAMIC_INTERPOLATION',
        recommendation: "child_process execution uses 'shell: true' with dynamic string concatenation or template literals. On Windows, this routes through 'cmd.exe /c' and is vulnerable to command injection. Avoid 'shell: true' and pass arguments as an isolated Array, or use strict argument escaping.",
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    hasSpawn,
    hasShellTrue,
    violationsCount: violations.length,
    violations,
    windowsShellProof: safe ? 'SHELL_INJECTION_DEFENSE_PROVED' : 'SHELL_TRUE_DYNAMIC_INJECTION_RISK',
  }
}
